using StackExchange.Redis;
using WaitingRoom;

var builder = WebApplication.CreateBuilder(args);

// Honor the PORT env var so the container listens on :3030 like the other langs.
var port = Environment.GetEnvironmentVariable("PORT") ?? "3030";
builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// One shared, thread-safe multiplexer for the whole app (never per-request).
// Env vars (injected by Docker Compose) take precedence over appsettings.json defaults.
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
{
    var host = Environment.GetEnvironmentVariable("REDIS_HOST")
               ?? builder.Configuration["Redis:Host"] ?? "localhost";
    var redisPort = Environment.GetEnvironmentVariable("REDIS_PORT")
                    ?? builder.Configuration["Redis:Port"] ?? "6379";
    return ConnectionMultiplexer.Connect($"{host}:{redisPort}");
});
builder.Services.AddSingleton<WaitingRoomService>();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/waitingroom/token", async (WaitingRoomService svc) =>
    Results.Ok(await svc.EnqueueAsync()));

app.MapGet("/api/waitingroom/position", async (string token, WaitingRoomService svc) =>
    Results.Ok(await svc.PositionAsync(token)));

app.MapPost("/api/waitingroom/admit", async (AdmitRequest? body, WaitingRoomService svc) =>
{
    var count = Math.Max(1, body?.Count ?? 1);
    return Results.Ok(await svc.AdmitAsync(count));
});

app.MapGet("/api/waitingroom/status", async (string token, WaitingRoomService svc) =>
    Results.Ok(await svc.StatusAsync(token)));

app.Run();

public record AdmitRequest(int? Count);
