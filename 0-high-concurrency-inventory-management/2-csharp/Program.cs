using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;
using InventoryService;

var builder = WebApplication.CreateBuilder(args);

string Env(string key, string def) =>
    Environment.GetEnvironmentVariable(key) is { Length: > 0 } v ? v : def;

var redisHost = Env("REDIS_HOST", "localhost");
var redisPort = Env("REDIS_PORT", "6379");
var pgHost = Env("POSTGRES_HOST", "localhost");
var pgPort = Env("POSTGRES_PORT", "5432");
var pgUser = Env("POSTGRES_USER", "postgres");
var pgPass = Env("POSTGRES_PASSWORD", "postgres");
var pgDb = Env("POSTGRES_DB", "inventory_service");
var port = Env("PORT", "3029");

var connString =
    $"Host={pgHost};Port={pgPort};Username={pgUser};Password={pgPass};Database={pgDb}";

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
builder.Services.AddDbContext<InventoryDbContext>(o => o.UseNpgsql(connString));
builder.Services.AddSingleton<IConnectionMultiplexer>(
    _ => ConnectionMultiplexer.Connect($"{redisHost}:{redisPort}"));
builder.Services.AddSingleton<RedisInventoryService>();
builder.Services.AddScoped<DbInventoryService>();

var app = builder.Build();

const string seededSku = "IPHONE15";

// Warm the hot Redis counter from the authoritative DB stock on startup.
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
    var redis = app.Services.GetRequiredService<RedisInventoryService>();
    var seeded = await ctx.InventoryItems.FirstOrDefaultAsync(x => x.Sku == seededSku);
    if (seeded is not null) await redis.WarmAsync(seededSku, seeded.Stock);
}

IResult Conflict(string sku, long remaining) =>
    Results.Json(new { error = "insufficient_stock", sku, remaining }, statusCode: 409);

async Task<long> RemainingFor(string sku, RedisInventoryService redis, InventoryDbContext ctx)
{
    var r = await redis.ReadAsync(sku);
    if (r >= 0) return r;
    var item = await ctx.InventoryItems.FirstOrDefaultAsync(x => x.Sku == sku);
    return item?.Stock ?? 0;
}

app.MapPost("/api/inventory/decrement/redis", async (
    DecrementRequest req, RedisInventoryService redis, InventoryDbContext ctx) =>
{
    if (req.Sku is null || req.Quantity <= 0)
        return Results.Json(new { error = "bad_request" }, statusCode: 400);
    try
    {
        var remaining = await redis.DecrementAsync(req.Sku, req.Quantity);
        return Results.Json(new { sku = req.Sku, strategy = "redis-lua", remaining });
    }
    catch (InsufficientStockException)
    {
        return Conflict(req.Sku, await RemainingFor(req.Sku, redis, ctx));
    }
    catch (UnknownSkuException)
    {
        return Results.Json(new { error = "unknown_sku", sku = req.Sku }, statusCode: 404);
    }
});

app.MapPost("/api/inventory/decrement/db", async (
    DecrementRequest req, DbInventoryService dbSvc, RedisInventoryService redis, InventoryDbContext ctx) =>
{
    if (req.Sku is null || req.Quantity <= 0)
        return Results.Json(new { error = "bad_request" }, statusCode: 400);
    try
    {
        var remaining = await dbSvc.DecrementAsync(req.Sku, req.Quantity);
        return Results.Json(new { sku = req.Sku, strategy = "db-pessimistic-lock", remaining });
    }
    catch (InsufficientStockException)
    {
        return Conflict(req.Sku, await RemainingFor(req.Sku, redis, ctx));
    }
    catch (UnknownSkuException)
    {
        return Results.Json(new { error = "unknown_sku", sku = req.Sku }, statusCode: 404);
    }
});

app.MapGet("/api/inventory/stock/{sku}", async (
    string sku, RedisInventoryService redis, InventoryDbContext ctx) =>
{
    var item = await ctx.InventoryItems.FirstOrDefaultAsync(x => x.Sku == sku);
    if (item is null)
        return Results.Json(new { error = "unknown_sku", sku }, statusCode: 404);

    var ledger = await ctx.InventoryLedgers
        .Where(l => l.Sku == sku)
        .OrderBy(l => l.Id)
        .Select(l => new { delta = l.Delta, remaining = l.Remaining })
        .ToListAsync();

    return Results.Json(new
    {
        sku,
        dbStock = item.Stock,
        redisStock = await redis.ReadAsync(sku),
        ledger,
    });
});

app.Run();

namespace InventoryService
{
    public sealed record DecrementRequest(string? Sku, int Quantity);
}
