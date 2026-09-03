using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Massage.Api.Data;

/// <summary>
/// Seed danh mục hành chính toàn quốc từ <c>Data/SeedData/vietnam-areas.json</c>:
/// 63 tỉnh, 696 quận/huyện, ~10.000 phường/xã theo cơ cấu <b>trước sáp nhập 2025</b>
/// (URL /massage-tai-nha/{tinh}/{quan} đã được index — xem tools/area-dataset/README.md).
///
/// Idempotent theo <c>(level, code)</c> chứ <b>không</b> theo slug. Khớp theo slug là
/// cách bản cũ làm, và nó vỡ khi mở toàn quốc: "Huyện Châu Thành" có ở 11+ tỉnh, nên
/// seeder sẽ âm thầm gắn quận vào nhầm tỉnh thay vì báo lỗi.
///
/// Chạy lại nhiều lần là an toàn và <b>giữ nguyên id</b> của khu vực đã tồn tại —
/// <c>coverage_areas</c>, <c>campaigns</c>, <c>slot_allocations</c>, <c>leads</c> đều
/// tham chiếu id, xoá rồi tạo lại là làm mồ côi dữ liệu thật.
/// </summary>
public static class AreaSeeder
{
    private const string ResourceName = "Massage.Api.Data.SeedData.vietnam-areas.json";

    /// <summary>
    /// Chia lô cho pass phường. Một câu INSERT ~10.000 dòng vẫn chạy được, nhưng lô nhỏ
    /// giữ kích thước mảng tham số và bản ghi WAL ở mức hợp lý mà gần như không tốn thêm
    /// vòng round trip nào đáng kể.
    /// </summary>
    private const int BatchSize = 1000;

    private sealed record WardJson(
        [property: JsonPropertyName("code")] string Code,
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("slug")] string Slug);

    private sealed record DistrictJson(
        [property: JsonPropertyName("code")] string Code,
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("slug")] string Slug,
        [property: JsonPropertyName("wards")] List<WardJson> Wards);

    private sealed record ProvinceJson(
        [property: JsonPropertyName("code")] string Code,
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("slug")] string Slug,
        [property: JsonPropertyName("districts")] List<DistrictJson> Districts);

    private sealed record Row(string Code, string Name, string Slug, string? ParentCode);

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        var provinces = await LoadAsync(ct);

        var districts = provinces
            .SelectMany(p => p.Districts.Select(d => (Province: p, District: d)))
            .ToList();

        var wards = districts
            .SelectMany(x => x.District.Wards.Select(w => (x.District, Ward: w)))
            .ToList();

        await AdoptExistingAsync(db, provinces, districts, logger, ct);

        var provinceRows = await UpsertLevelAsync(
            db, AreaLevels.Province,
            provinces.Select(p => new Row(p.Code, p.Name, p.Slug, null)).ToList(), ct);

        var districtRows = await UpsertLevelAsync(
            db, AreaLevels.District,
            districts.Select(x => new Row(
                x.District.Code, x.District.Name, x.District.Slug, x.Province.Code)).ToList(), ct);

        var wardRows = await UpsertLevelAsync(
            db, AreaLevels.Ward,
            wards.Select(x => new Row(
                x.Ward.Code, x.Ward.Name, x.Ward.Slug, x.District.Code)).ToList(), ct);

        logger.LogInformation(
            "Seed khu vực xong: {Provinces} tỉnh, {Districts} quận/huyện, {Wards} phường/xã",
            provinceRows, districtRows, wardRows);
    }

    private static async Task<List<ProvinceJson>> LoadAsync(CancellationToken ct)
    {
        await using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException(
                $"Không tìm thấy resource nhúng {ResourceName}. Kiểm tra EmbeddedResource trong Massage.Api.csproj.");

        return await JsonSerializer.DeserializeAsync<List<ProvinceJson>>(stream, cancellationToken: ct)
            ?? throw new InvalidOperationException("File dữ liệu khu vực rỗng hoặc sai định dạng.");
    }

    /// <summary>
    /// Gán mã cho những khu vực đã tồn tại từ trước (23 dòng seed tay của hai thành phố
    /// đầu tiên), khớp theo <c>(slug, level)</c> và chỉ khi <c>code</c> còn NULL.
    ///
    /// <b>Đây là bước giữ toàn vẹn khoá ngoại.</b> Không có nó, pass upsert bên dưới
    /// không khớp được theo mã nên sẽ chèn dòng mới trùng slug — vỡ ở
    /// <c>uq_area_parent_slug</c> nếu may, hoặc tạo ra khu vực song song mà mọi campaign
    /// và coverage cũ vẫn trỏ vào dòng cũ nếu không may.
    ///
    /// Chỉ áp cho tỉnh và quận: chưa từng có phường nào trong DB trước lần seed này.
    /// </summary>
    private static async Task AdoptExistingAsync(
        AppDbContext db,
        List<ProvinceJson> provinces,
        List<(ProvinceJson Province, DistrictJson District)> districts,
        ILogger logger,
        CancellationToken ct)
    {
        var slugs = new List<string>();
        var levels = new List<string>();
        var codes = new List<string>();

        foreach (var province in provinces)
        {
            slugs.Add(province.Slug);
            levels.Add(AreaLevels.Province);
            codes.Add(province.Code);
        }

        foreach (var (_, district) in districts)
        {
            slugs.Add(district.Slug);
            levels.Add(AreaLevels.District);
            codes.Add(district.Code);
        }

        var adopted = await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE administrative_areas a
               SET code = t.code
              FROM unnest(@slugs, @levels, @codes) AS t(slug, level, code)
             WHERE a.slug = t.slug AND a.level = t.level AND a.code IS NULL;
            """,
            [
                TextArray("slugs", slugs),
                TextArray("levels", levels),
                TextArray("codes", codes),
            ],
            ct);

        if (adopted > 0)
            logger.LogInformation("Đã gán mã cho {Count} khu vực có sẵn (giữ nguyên id)", adopted);
    }

    /// <summary>
    /// Upsert một cấp bằng đúng một câu lệnh cho mỗi lô. Bản cũ gọi
    /// <c>SaveChangesAsync</c> cho từng dòng — ở quy mô toàn quốc là ~10.700 vòng round
    /// trip, mất vài phút.
    ///
    /// Không dùng <c>COPY</c>: nó không làm được <c>ON CONFLICT</c>, muốn idempotent phải
    /// thêm bảng tạm rồi merge — nhiều bộ phận chuyển động hơn cho một thao tác vốn chỉ
    /// mất vài giây.
    /// </summary>
    private static async Task<int> UpsertLevelAsync(
        AppDbContext db, string level, List<Row> rows, CancellationToken ct)
    {
        var total = 0;

        for (var offset = 0; offset < rows.Count; offset += BatchSize)
        {
            var batch = rows.GetRange(offset, Math.Min(BatchSize, rows.Count - offset));

            // Cha tra theo mã ngay trong câu lệnh, nên không cần giữ bản đồ id ở phía
            // ứng dụng và không phụ thuộc thứ tự trả về của lần chèn trước.
            total += await db.Database.ExecuteSqlRawAsync(
                """
                INSERT INTO administrative_areas (code, name, slug, level, parent_id)
                SELECT t.code, t.name, t.slug, @level, p.id
                  FROM unnest(@codes, @names, @slugs, @parentCodes)
                       AS t(code, name, slug, parent_code)
                  LEFT JOIN administrative_areas p
                         ON p.code = t.parent_code AND p.level = @parentLevel
                ON CONFLICT (level, code) WHERE code IS NOT NULL
                DO UPDATE SET name = EXCLUDED.name,
                              slug = EXCLUDED.slug,
                              parent_id = EXCLUDED.parent_id;
                """,
                [
                    new NpgsqlParameter("level", NpgsqlDbType.Text) { Value = level },
                    new NpgsqlParameter("parentLevel", NpgsqlDbType.Text)
                    {
                        Value = (object?)ParentLevelOf(level) ?? DBNull.Value,
                    },
                    TextArray("codes", batch.Select(r => r.Code)),
                    TextArray("names", batch.Select(r => r.Name)),
                    TextArray("slugs", batch.Select(r => r.Slug)),
                    TextArray("parentCodes", batch.Select(r => r.ParentCode)),
                ],
                ct);
        }

        return total;
    }

    private static string? ParentLevelOf(string level) => level switch
    {
        AreaLevels.District => AreaLevels.Province,
        AreaLevels.Ward => AreaLevels.District,
        _ => null,
    };

    private static NpgsqlParameter TextArray(string name, IEnumerable<string?> values) =>
        new(name, NpgsqlDbType.Array | NpgsqlDbType.Text) { Value = values.ToArray() };
}
