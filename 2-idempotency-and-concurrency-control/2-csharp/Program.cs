using System.Text.Json;
using Npgsql;
using StackExchange.Redis;

var builder = WebApplication.CreateBuilder(args);

static string Env(string key, string def) =>
    Environment.GetEnvironmentVariable(key) is { Length: > 0 } v ? v : def;

var redisAddr = $"{Env("REDIS_HOST", "localhost")}:{Env("REDIS_PORT", "6379")}";
var pgConn = $"Host={Env("POSTGRES_HOST", "localhost")};Port={Env("POSTGRES_PORT", "5432")};" +
             $"Username={Env("POSTGRES_USER", "postgres")};Password={Env("POSTGRES_PASSWORD", "postgres")};" +
             $"Database={Env("POSTGRES_DB", "checkout")}";

// ConnectionMultiplexer is thread-safe and meant to be shared as a singleton;
// never open a new connection per request.
var redis = await ConnectionMultiplexer.ConnectAsync(redisAddr);
builder.Services.AddSingleton<IConnectionMultiplexer>(redis);

var dataSource = NpgsqlDataSource.Create(pgConn);
builder.Services.AddSingleton(dataSource);

var app = builder.Build();

// Create the orders table with a UNIQUE(idempotency_key) constraint at startup.
await using (var conn = await dataSource.OpenConnectionAsync())
await using (var cmd = conn.CreateCommand())
{
    cmd.CommandText = @"
        CREATE TABLE IF NOT EXISTS orders (
            id              UUID PRIMARY KEY,
            idempotency_key VARCHAR(128) NOT NULL,
            status          VARCHAR(16)  NOT NULL,
            amount          NUMERIC(12,2) NOT NULL,
            sku             VARCHAR(64)  NOT NULL,
            CONSTRAINT uq_orders_idempotency_key UNIQUE (idempotency_key)
        )";
    await cmd.ExecuteNonQueryAsync();
}

const string Pending = "PENDING";
var pendingTtl = TimeSpan.FromSeconds(30);
var resultTtl = TimeSpan.FromHours(24);
var delayMs = int.Parse(Env("CHECKOUT_PROCESSING_DELAY_MS", "1500"));
var jsonOpts = new JsonSerializerOptions(JsonSerializerDefaults.Web);

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapPost("/api/checkout/order", async (HttpContext ctx, IConnectionMultiplexer mux, NpgsqlDataSource ds) =>
{
    var key = ctx.Request.Headers["Idempotency-Key"].ToString();
    if (string.IsNullOrEmpty(key)) key = "missing-idempotency-key";

    var req = await JsonSerializer.DeserializeAsync<CreateOrderRequest>(ctx.Request.Body, jsonOpts)
              ?? new CreateOrderRequest("0.00", "");

    var db = mux.GetDatabase();
    var redisKey = $"idempotency:{key}";

    // SET NX is atomic first-wins: exactly one concurrent caller claims the key.
    var claimed = await db.StringSetAsync(redisKey, Pending, pendingTtl, When.NotExists);

    if (!claimed)
    {
        var existing = await db.StringGetAsync(redisKey);
        if (existing == Pending)
        {
            return Results.Json(new { statusCode = 409, message = "Request in progress", idempotencyKey = key },
                statusCode: StatusCodes.Status409Conflict);
        }
        var replay = JsonSerializer.Deserialize<OrderResponse>(existing!, jsonOpts)! with { Replayed = true };
        return Results.Json(replay, statusCode: StatusCodes.Status200OK);
    }

    // Widen the PENDING window so a concurrent duplicate hits the 409 branch.
    await Task.Delay(delayMs);

    var orderId = Guid.NewGuid();
    try
    {
        await using var conn = await ds.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "INSERT INTO orders (id, idempotency_key, status, amount, sku) " +
                          "VALUES (@id, @k, 'CONFIRMED', @a::numeric, @s)";
        cmd.Parameters.AddWithValue("id", orderId);
        cmd.Parameters.AddWithValue("k", key);
        cmd.Parameters.AddWithValue("a", req.Amount);
        cmd.Parameters.AddWithValue("s", req.Sku);
        await cmd.ExecuteNonQueryAsync();
    }
    catch (PostgresException ex) when (ex.SqlState == "23505")
    {
        // Last-line defense: UNIQUE(idempotency_key) rejected a duplicate insert.
        await using var conn = await ds.OpenConnectionAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT id FROM orders WHERE idempotency_key=@k";
        cmd.Parameters.AddWithValue("k", key);
        orderId = (Guid)(await cmd.ExecuteScalarAsync())!;
    }

    var result = new OrderResponse(orderId.ToString(), "CONFIRMED", req.Amount, false);
    await db.StringSetAsync(redisKey, JsonSerializer.Serialize(result, jsonOpts), resultTtl);
    return Results.Json(result, statusCode: StatusCodes.Status201Created);
});

app.Run($"http://0.0.0.0:{Env("PORT", "3031")}");

record CreateOrderRequest(string Amount, string Sku);

record OrderResponse(string OrderId, string Status, string Amount, bool Replayed);
