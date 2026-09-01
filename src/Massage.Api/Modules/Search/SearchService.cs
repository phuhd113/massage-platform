using Massage.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Massage.Api.Modules.Search;

/// <summary>
/// Geo-search chạy thẳng trên PostGIS. Phase 3 sẽ chuyển đường đọc chính sang
/// Redis, lúc đó truy vấn này vẫn giữ nguyên vai trò fallback khi cache miss hoặc
/// Redis chết — nên nó phải luôn tự chạy đúng một mình.
/// </summary>
public class SearchService(AppDbContext db)
{
    /// <summary>
    /// Số review "ảo" dùng để làm mượt rating theo kiểu Bayesian. Không có nó, một
    /// KTV đúng một review 5 sao sẽ đứng trên KTV 200 review 4.8 sao.
    /// </summary>
    private const int RatingSmoothing = 10;

    /// <summary>Mốc coi hồ sơ là "cũ" khi tính độ mới hoạt động.</summary>
    private const int RecencyWindowDays = 30;

    /// <summary>
    /// Điểm cuối = BoostPoints + BaseScore, và hai phần cố ý tách rời nhau.
    ///
    /// BoostPoints lấy <c>MAX</c> chứ không <c>SUM</c> các gói đang chạy: cộng dồn
    /// thì mua Featured Badge kèm Instant Boost sẽ vượt VIP Pin, và thứ tự giữa các
    /// hạng — thứ KTV trả tiền để mua — bị quyết định bởi phép cộng thay vì bởi
    /// bảng giá.
    ///
    /// Giới hạn đã biết: tìm theo toạ độ không xác định được khu vực hành chính của
    /// khách, vì <c>administrative_areas</c> chưa có ranh giới dạng polygon. Ở chế
    /// độ đó mọi gói đang chạy của KTV đều được tính. Phạm vi ảnh hưởng bị giới hạn
    /// bởi bán kính tìm kiếm, nhưng vẫn còn khe: mua gói ở quận ít cạnh tranh rồi
    /// hưởng thứ hạng ở quận bên cạnh. Bịt hẳn cần polygon ranh giới quận.
    ///
    /// Từ 2026-09-01 cả ba hạng gói đều có điểm lớn hơn dải BaseScore, nên KTV trả
    /// phí luôn đứng trên KTV không trả phí trong khu vực đã mua — không còn ngoại
    /// lệ nào. Xem <c>PackageTypes.TierGapsAreValid</c>.
    ///
    /// Trọng số BaseScore cộng lại đúng 1.0 và mọi thành phần đã chuẩn hoá về 0–1.
    /// Khi tìm theo khu vực (không có toạ độ), thành phần khoảng cách bằng 0 cho
    /// mọi hồ sơ — điểm tuyệt đối thấp hơn nhưng thứ tự tương đối vẫn đúng.
    /// </summary>
    private static readonly string Sql = $"""
        WITH origin AS (
            SELECT CASE WHEN @hasOrigin
                        THEN ST_SetSRID(ST_MakePoint(@lon, @lat), 4326)::geography
                   END AS pt
        ),
        global AS (
            -- Tiên nghiệm là trung bình trên từng *đánh giá*, không phải trung bình
            -- của các trung bình. Lấy trung bình cộng theo hồ sơ thì một KTV mới có
            -- đúng một review 5 sao kéo tiên nghiệm lên ngang với chính nó, và làm
            -- mượt mất tác dụng đúng vào trường hợp nó sinh ra để xử lý.
            SELECT COALESCE(
                       SUM(rating_avg * rating_count) / NULLIF(SUM(rating_count), 0),
                       4.5)::float8 AS avg_rating
            FROM ktv_profiles
            WHERE verification_status = 'VERIFIED' AND rating_count > 0
        ),
        candidates AS (
            SELECT k.id, k.full_name, k.slug, k.years_experience,
                   k.rating_avg, k.rating_count, k.response_rate, k.is_online,
                   k.last_active_at, k.created_at,
                   -- Làm tròn 3 chữ số (~100m) trước khi ra khỏi hệ thống. Khoảng
                   -- cách đã tính ở server nên client không cần toạ độ chính xác,
                   -- còn base_point là chỗ ở của KTV — đủ để đặt ghim bản đồ là đủ.
                   ROUND(ST_Y(k.base_point::geometry)::numeric, 3)::float8 AS lat,
                   ROUND(ST_X(k.base_point::geometry)::numeric, 3)::float8 AS lon,
                   CASE WHEN @hasOrigin THEN ST_Distance(k.base_point, o.pt) END AS distance_m
            FROM ktv_profiles k
            CROSS JOIN origin o
            WHERE k.verification_status = 'VERIFIED'
              AND (NOT @hasOrigin OR (
                    ST_DWithin(k.base_point, o.pt, @radiusM)
                    -- Bán kính thứ hai là vùng KTV nhận đi. Thiếu vế này, khách sẽ
                    -- gọi trúng KTV không phục vụ khu của mình và nghĩ là lỗi nền tảng.
                    AND ST_DWithin(k.base_point, o.pt, k.service_radius_km * 1000.0)
              ))
              AND (@serviceSlug IS NULL OR EXISTS (
                    SELECT 1 FROM ktv_services ks
                    JOIN services sv ON sv.id = ks.service_id
                    WHERE ks.ktv_id = k.id AND sv.slug = @serviceSlug AND sv.is_active
              ))
              AND (@areaSlug IS NULL OR EXISTS (
                    SELECT 1 FROM coverage_areas ca
                    JOIN administrative_areas aa ON aa.id = ca.area_id
                    WHERE ca.ktv_id = k.id AND aa.slug = @areaSlug
              ))
        ),
        scored AS (
            SELECT c.*,
                   COALESCE(b.boost_points, 0)::float8 AS boost_points,
                   100.0 * (
                       0.40 * (((c.rating_count * c.rating_avg + {RatingSmoothing} * g.avg_rating)
                                / (c.rating_count + {RatingSmoothing})) / 5.0)
                     + 0.35 * (CASE WHEN @hasOrigin
                                    THEN GREATEST(0.0, 1.0 - c.distance_m / @radiusM)
                                    ELSE 0.0 END)
                     + 0.15 * c.response_rate
                     + 0.10 * GREATEST(0.0, 1.0 -
                           EXTRACT(EPOCH FROM (now() - COALESCE(c.last_active_at, c.created_at)))
                           / {RecencyWindowDays * 86400}.0)
                   )::float8 AS base_score
            FROM candidates c
            CROSS JOIN global g
            -- Điểm boost của gói đang chạy. LEFT JOIN LATERAL để KTV không mua gói
            -- vẫn có mặt trong kết quả với 0 điểm, thay vì bị loại khỏi danh sách.
            LEFT JOIN LATERAL (
                SELECT MAX(cp.boost_points) AS boost_points
                FROM campaigns cp
                WHERE cp.ktv_id = c.id
                  AND cp.status = 'ACTIVE'
                  AND cp.start_at <= now()
                  AND cp.end_at > now()
                  -- Tìm theo khu vực thì chỉ gói mua cho đúng khu vực đó mới tính:
                  -- VIP Pin là ghim theo khu vực, mua ở Quận 7 không được ghim ở
                  -- Hà Nội. Tìm theo toạ độ thì không có khu vực để so — xem ghi
                  -- chú giới hạn ở đầu class.
                  AND (@areaSlug IS NULL OR cp.area_id IN (
                        SELECT aa.id FROM administrative_areas aa WHERE aa.slug = @areaSlug
                  ))
            ) b ON true
        )
        SELECT id            AS "Id",
               full_name     AS "FullName",
               slug          AS "Slug",
               years_experience AS "YearsExperience",
               rating_avg    AS "RatingAvg",
               rating_count  AS "RatingCount",
               is_online     AS "IsOnline",
               distance_m    AS "DistanceM",
               boost_points  AS "BoostPoints",
               base_score    AS "BaseScore",
               boost_points + base_score AS "Score",
               lat           AS "Lat",
               lon           AS "Lon",
               COUNT(*) OVER () AS "Total"
        FROM scored
        ORDER BY boost_points + base_score DESC, distance_m ASC NULLS LAST, id
        OFFSET @skip LIMIT @take
        """;

    public async Task<SearchResponseDto> SearchAsync(SearchQueryDto q, CancellationToken ct = default)
    {
        var hasOrigin = q is { Lat: not null, Lon: not null };
        var radiusM = q.RadiusKm * 1000.0;

        var rows = await db.Database
            .SqlQueryRaw<SearchRow>(
                Sql,
                Param("hasOrigin", NpgsqlDbType.Boolean, hasOrigin),
                Param("lat", NpgsqlDbType.Double, q.Lat ?? 0d),
                Param("lon", NpgsqlDbType.Double, q.Lon ?? 0d),
                Param("radiusM", NpgsqlDbType.Double, radiusM),
                Param("serviceSlug", NpgsqlDbType.Text, q.Service),
                Param("areaSlug", NpgsqlDbType.Text, q.AreaSlug),
                Param("skip", NpgsqlDbType.Integer, (q.Page - 1) * q.Size),
                Param("take", NpgsqlDbType.Integer, q.Size))
            .ToListAsync(ct);

        return new SearchResponseDto(
            rows.Select(r => new SearchItemDto(
                r.Id, r.FullName, r.Slug, r.YearsExperience,
                r.RatingAvg, r.RatingCount, r.IsOnline,
                r.DistanceM, r.BoostPoints, r.BaseScore, r.Score, r.Lat, r.Lon)).ToList(),
            q.Page,
            q.Size,
            rows.Count > 0 ? rows[0].Total : 0);
    }

    private static NpgsqlParameter Param(string name, NpgsqlDbType type, object? value) =>
        new(name, type) { Value = value ?? DBNull.Value };

    /// <summary>
    /// Kiểu trung gian cho <c>SqlQueryRaw</c>. Alias trong SQL được đặt trong dấu
    /// nháy kép để giữ nguyên PascalCase — Postgres hạ chữ thường mọi định danh
    /// không nháy, và EF khớp cột theo đúng tên property.
    /// </summary>
    private class SearchRow
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = null!;
        public string Slug { get; set; } = null!;
        public short YearsExperience { get; set; }
        public decimal RatingAvg { get; set; }
        public int RatingCount { get; set; }
        public bool IsOnline { get; set; }
        public double? DistanceM { get; set; }
        public double BoostPoints { get; set; }
        public double BaseScore { get; set; }
        public double Score { get; set; }
        public double Lat { get; set; }
        public double Lon { get; set; }
        public long Total { get; set; }
    }
}
