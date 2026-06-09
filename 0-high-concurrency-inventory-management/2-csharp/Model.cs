using Microsoft.EntityFrameworkCore;

namespace InventoryService;

/// <summary>Authoritative durable stock per SKU. Schema owned by seed.sql.</summary>
public sealed class InventoryItem
{
    public string Sku { get; set; } = default!;
    public int Stock { get; set; }
}

/// <summary>Append-only audit trail: one row per database-path decrement.</summary>
public sealed class InventoryLedger
{
    public long Id { get; set; }
    public string Sku { get; set; } = default!;
    public int Delta { get; set; }
    public int Remaining { get; set; }
}

/// <summary>EF Core context mapped onto the existing tables created by seed.sql.</summary>
public sealed class InventoryDbContext : DbContext
{
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<InventoryLedger> InventoryLedgers => Set<InventoryLedger>();

    public InventoryDbContext(DbContextOptions<InventoryDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        // Map onto the EXISTING tables created by seed.sql; EF Core does not own the schema
        // (equivalent to synchronize: false in the TypeScript ORM).
        b.Entity<InventoryItem>(e =>
        {
            e.ToTable("inventories");
            e.HasKey(x => x.Sku);
            e.Property(x => x.Sku).HasColumnName("sku");
            e.Property(x => x.Stock).HasColumnName("stock");
        });
        b.Entity<InventoryLedger>(e =>
        {
            e.ToTable("inventory_ledgers");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Sku).HasColumnName("sku");
            e.Property(x => x.Delta).HasColumnName("delta");
            e.Property(x => x.Remaining).HasColumnName("remaining");
        });
    }
}
