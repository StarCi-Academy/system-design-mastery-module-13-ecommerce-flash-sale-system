using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace InventoryService;

public sealed class UnknownSkuException : Exception { }

public sealed class InsufficientStockException : Exception { }

/// <summary>Redis Lua atomic decrement path.</summary>
public sealed class RedisInventoryService
{
    private readonly IDatabase _db;

    // GET, check, and DECRBY run as ONE atomic server-side script: no command can
    // interleave between the check and the decrement.
    private const string DecrementScript = @"
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil then return -1 end
if stock < tonumber(ARGV[1]) then return -2 end
return redis.call('DECRBY', KEYS[1], ARGV[1])";

    public RedisInventoryService(IConnectionMultiplexer mux) => _db = mux.GetDatabase();

    public async Task<long> DecrementAsync(string sku, int quantity)
    {
        var result = (long)await _db.ScriptEvaluateAsync(
            DecrementScript,
            new RedisKey[] { $"stock:{sku}" },
            new RedisValue[] { quantity });

        if (result == -1) throw new UnknownSkuException();
        if (result == -2) throw new InsufficientStockException();
        return result;
    }

    public async Task<long> ReadAsync(string sku)
    {
        var raw = await _db.StringGetAsync($"stock:{sku}");
        return raw.HasValue && long.TryParse(raw!, out var v) ? v : -1;
    }

    public Task WarmAsync(string sku, int stock)
        => _db.StringSetAsync($"stock:{sku}", stock);
}

/// <summary>PostgreSQL pessimistic-lock decrement path.</summary>
public sealed class DbInventoryService
{
    private readonly InventoryDbContext _ctx;

    public DbInventoryService(InventoryDbContext ctx) => _ctx = ctx;

    public async Task<int> DecrementAsync(string sku, int quantity)
    {
        await using var tx = await _ctx.Database.BeginTransactionAsync();

        // SELECT ... FOR UPDATE: take a pessimistic write lock on this SKU's row,
        // serializing concurrent writers one at a time.
        var item = await _ctx.InventoryItems
            .FromSqlInterpolated($"SELECT sku, stock FROM inventories WHERE sku = {sku} FOR UPDATE")
            .AsTracking()
            .SingleOrDefaultAsync();

        if (item is null) throw new UnknownSkuException();
        if (item.Stock < quantity) throw new InsufficientStockException();

        item.Stock -= quantity;
        _ctx.InventoryLedgers.Add(new InventoryLedger
        {
            Sku = sku,
            Delta = -quantity,
            Remaining = item.Stock,
        });

        await _ctx.SaveChangesAsync();
        await tx.CommitAsync();
        return item.Stock;
    }
}
