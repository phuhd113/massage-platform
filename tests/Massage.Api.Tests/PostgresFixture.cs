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

    private NpgsqlDataSource _dataSource = null!;

    /// <summary>
    /// Data source dùng chung cho cả test và ứng dụng dựng trong <c>ApiFactory</c>.
    ///
    /// Phải là **một** instance: Npgsql tra data source theo chuỗi kết nối trong cache
    /// dùng chung cả process, nên hai bản cho cùng chuỗi sẽ tranh nhau chỗ đó và bản nào
    /// thiếu plugin NetTopologySuite thắng thì mọi lệnh ghi Point đều hỏng.
    /// </summary>
    public NpgsqlDataSource DataSource => _dataSource;

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

        // Tạo extension trước, bằng một data source dùng một lần rồi bỏ.
        //
        // Npgsql đọc danh mục kiểu của database ngay khi mở kết nối đầu tiên rồi
        // cache lại. Nếu để chính migration tạo postgis thì bản cache đã chụp lúc
        // chưa có kiểu geography, và mọi lệnh ghi toạ độ sau đó fail với
        // "NpgsqlDbType 'Geography' isn't present in your database" — migration vẫn
        // xanh nên lỗi chỉ lộ ra ở test đầu tiên chạm toạ độ.
        // ApplicationName riêng để chuỗi kết nối này KHÁC chuỗi mà ứng dụng dùng.
        //
        // Npgsql tra data source theo chuỗi kết nối trong một cache dùng chung cả
        // process. Nếu bootstrap mở đúng chuỗi của ứng dụng, nó chiếm chỗ bằng một
        // data source *không* có plugin NetTopologySuite — và ứng dụng dựng sau
        // (WebApplicationFactory) nhận lại bản đó, rồi fail khi đọc cột geography.
        // Đúng lỗi này đã làm đỏ test upload chứng chỉ.
        var bootstrapConnectionString = new NpgsqlConnectionStringBuilder(ConnectionString)
        {
            ApplicationName = "massage-tests-bootstrap",
        }.ConnectionString;

        await using (var bootstrap = new NpgsqlConnection(bootstrapConnectionString))
        {
            await bootstrap.OpenAsync();
            await using (var ext = new NpgsqlCommand(
                "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pgcrypto;", bootstrap))
            {
                await ext.ExecuteNonQueryAsync();
            }
            // Kết nối này đã đọc danh mục kiểu *trước* khi extension tồn tại; nạp
            // lại để bản cache dùng chung không giữ lại trạng thái thiếu geography.
            bootstrap.ReloadTypes();
        }
        NpgsqlConnection.ClearAllPools();

        // Data source tường minh, không để EF tự dựng từ chuỗi kết nối: khi dựng
        // ngầm, Npgsql tra data source theo chuỗi kết nối trong một cache dùng
        // chung — và một kết nối thường mở trước đó sẽ chiếm chỗ bằng bản *không*
        // có plugin NetTopologySuite, khiến lệnh ghi Point báo
        // "Writing values of 'Point' is not supported for parameters having NpgsqlDbType 'Geography'".
        var dataSourceBuilder = new NpgsqlDataSourceBuilder(ConnectionString);
        dataSourceBuilder.UseNetTopologySuite();
        _dataSource = dataSourceBuilder.Build();

        await using var db = CreateContext();
        await db.Database.MigrateAsync();
    }

    public AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_dataSource, o => o.UseNetTopologySuite())
            .Options);

    public async Task DisposeAsync() => await _dataSource.DisposeAsync();
}

[CollectionDefinition(Name)]
public class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "postgres";
}
