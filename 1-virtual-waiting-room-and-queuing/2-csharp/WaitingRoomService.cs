using StackExchange.Redis;

namespace WaitingRoom;

/// <summary>
/// Encapsulates the Redis Sorted Set queue and the TTL-backed admitted set.
/// Redis is the single source of truth; no relational store is involved.
/// </summary>
public sealed class WaitingRoomService
{
    private const string QueueKey = "waitingroom:queue";
    private const string AdmittedKey = "waitingroom:admitted";

    private readonly IDatabase _db;
    private readonly TimeSpan _admittedTtl;

    public WaitingRoomService(IConnectionMultiplexer mux, IConfiguration config)
    {
        _db = mux.GetDatabase();
        _admittedTtl = TimeSpan.FromSeconds(config.GetValue("Admitted:TtlSeconds", 300));
    }

    /// <summary>
    /// Enqueue a fresh token scored by arrival time in milliseconds and return
    /// its 1-based position. ZADD NX never overwrites an existing score.
    /// </summary>
    public async Task<TokenResult> EnqueueAsync()
    {
        var token = Guid.NewGuid().ToString();
        double scoreMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        await _db.SortedSetAddAsync(QueueKey, token, scoreMs, When.NotExists);
        long? rank = await _db.SortedSetRankAsync(QueueKey, token, Order.Ascending);
        return new TokenResult(token, (rank ?? 0) + 1);
    }

    /// <summary>
    /// Look up a token's 1-based place in line; checks the admitted set first.
    /// position is null when the token is admitted or unknown.
    /// </summary>
    public async Task<PositionResult> PositionAsync(string token)
    {
        if (await _db.SetContainsAsync(AdmittedKey, token))
        {
            return new PositionResult(token, null, true);
        }

        long? rank = await _db.SortedSetRankAsync(QueueKey, token, Order.Ascending);
        return new PositionResult(token, rank.HasValue ? rank.Value + 1 : null, false);
    }

    /// <summary>
    /// Admit the front N tokens. ZPOPMIN atomically removes the N lowest-scored
    /// members (longest waiters), which enter the TTL-backed admitted set.
    /// </summary>
    public async Task<AdmitResult> AdmitAsync(int count)
    {
        SortedSetEntry[] popped = await _db.SortedSetPopAsync(QueueKey, count, Order.Ascending);
        var tokens = popped.Select(e => e.Element.ToString()).ToList();
        if (tokens.Count == 0)
        {
            return new AdmitResult(tokens, 0);
        }

        await _db.SetAddAsync(AdmittedKey, tokens.Select(t => (RedisValue)t).ToArray());
        await _db.KeyExpireAsync(AdmittedKey, _admittedTtl);
        return new AdmitResult(tokens, tokens.Count);
    }

    /// <summary>
    /// Report admitted / waiting / unknown plus the 1-based position.
    /// </summary>
    public async Task<StatusResult> StatusAsync(string token)
    {
        if (await _db.SetContainsAsync(AdmittedKey, token))
        {
            return new StatusResult(token, "admitted", null);
        }

        long? rank = await _db.SortedSetRankAsync(QueueKey, token, Order.Ascending);
        return rank is null
            ? new StatusResult(token, "unknown", null)
            : new StatusResult(token, "waiting", rank.Value + 1);
    }
}

public record TokenResult(string Token, long Position);

public record PositionResult(string Token, long? Position, bool Admitted);

public record AdmitResult(IReadOnlyList<string> Admitted, int Count);

public record StatusResult(string Token, string State, long? Position);
