using Massage.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Massage.Api.Tests;

/// <summary>
/// Dựng một database test riêng và áp migration thật lên đó.
///
/// Chủ ý không dùng EF InMemory: nó không chạy được ExecuteUpdate, không có
/// CHECK constraint, không có PostGIS — nghĩa là test sẽ xanh trong khi code
/// thật vỡ. Với một hệ thống mà tính đúng đắn nằm phần lớn ở tầng DB, test
/// trên provider giả tạo cảm giác an toàn sai lệch.
/// </summary>
public class PostgresFixture : IAsyncLifetime
{
    private const string TestDbName = "massage_platform_test";

    public string ConnectionString { get; private set; } = null!;

    private static string AdminConnectionString =>
        Environment.GetEnvironmentVariable("TEST_DB_CONNECTION")
        ?? "Host=localhost;Port=5433;Database=postgres;Username=massage;Password=massage_dev_pw";

    public async Task InitializeAsync()
    {
        var builder = new NpgsqlConnectionStringBuilder(AdminConnectionString);

        await using (var admin = new NpgsqlConnection(builder.ConnectionString))
        {
            await admin.OpenAsync();
            // Dựng lại từ đầu mỗi lần chạy để test không phụ thuộc dữ liệu sót lại.
            await using (var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS {TestDbName} WITH (FORCE)", admin))
                await drop.ExecuteNonQueryAsync();
            await using var create = new NpgsqlCommand($"CREATE DATABASE {TestDbName}", admin);
            await create.ExecuteNonQueryAsync();
        }

        builder.Database = TestDbName;
        ConnectionString = builder.ConnectionString;

        await using var db = CreateContext();
        await db.Database.MigrateAsync();
    }

    public AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString, o => o.UseNetTopologySuite())
            .Options);

    public Task DisposeAsync() => Task.CompletedTask;
}

[CollectionDefinition(Name)]
public class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "postgres";
}
