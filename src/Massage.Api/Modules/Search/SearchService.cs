using System.Text.Json;
using Massage.Api.Common.Storage;
using Massage.Api.Data;
using Massage.Api.Modules.Analytics;
using Massage.Api.Modules.Analytics.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Massage.Api.Modules.Search;

/// <summary>
/// Geo-search chạy thẳng trên PostGIS. Phase 3 sẽ chuyển đường đọc chính sang
/// Redis, lúc đó truy vấn này vẫn giữ nguyên vai trò fallback khi cache miss hoặc
/// Redis chết — nên nó phải luôn tự chạy đúng một mình.
/// </summary>
public class SearchService(AppDbContext db, IAnalyticsQueue analytics, MediaUrls urls)
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
        -- MATERIALIZED là bắt buộc, không phải gợi ý tối ưu.
        --
        -- Không có nó, Postgres inline CTE này vào nested loop và tính lại tiên
        -- nghiệm **một lần cho mỗi ứng viên** — mỗi lần là một seq scan toàn bảng
        -- ktv_profiles. Đo trên 5.000 hồ sơ / 1.117 ứng viên: 1.875ms so với 34ms,
        -- tức chậm hơn 55 lần, và càng nhiều KTV càng tệ theo cấp số nhân (số ứng
        -- viên × kích thước bảng).
        --
        -- Triệu chứng rất dễ đổ nhầm cho geo-search: index GiST vẫn hoạt động đúng
        -- và phần lọc toạ độ chỉ mất ~11ms. Chỗ tốn thời gian nằm trong EXPLAIN ở
        -- dòng "Seq Scan on ktv_profiles ... loops=1117".
        global AS MATERIALIZED (
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
            SELECT k.id, k.full_name, k.slug, k.gender, k.years_experience,
                   k.rating_avg, k.rating_count, k.response_rate, k.is_online,
                   k.last_active_at, k.created_at, k.avatar_key,
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
              AND (@areaId IS NULL OR EXISTS (
                    SELECT 1 FROM coverage_areas ca
                    WHERE ca.ktv_id = k.id
                      AND (ca.area_id = @areaId
                           -- Slug tỉnh cũng tìm được: KTV chỉ khai coverage ở mức quận,
                           -- nên so thẳng area_id với id tỉnh sẽ luôn rỗng và trang tỉnh
                           -- hiện danh sách trắng ngay dưới dòng "N kỹ thuật viên".
                           -- Chỉ mở một cấp — phường không bao giờ nằm trong coverage_areas
                           -- nên đây vẫn là quan hệ tỉnh → quận, không cần CTE đệ quy.
                           OR ca.area_id IN (SELECT id FROM administrative_areas
                                              WHERE parent_id = @areaId))
              ))
              -- Lọc "đang nhận khách". Đây là bộ lọc thu hẹp tập ứng viên nên phải
              -- nằm ở đây, trước khi tính điểm và phân trang.
              AND (NOT @onlineOnly OR k.is_online)
              -- Ba bộ lọc của popup. Cùng lý do vị trí với @onlineOnly: đặt sau CTE
              -- `paged` sẽ lọc trên đúng 20 dòng của trang hiện tại, tức mỗi trang
              -- trả về một số kết quả khác nhau và `total` nói dối.
              --
              -- Hồ sơ chưa khai giới tính (gender IS NULL) bị loại khi bộ lọc bật:
              -- `k.gender = @gender` đã tự làm điều đó (NULL không bằng gì cả), và
              -- đó là hành vi đúng — xem SearchQueryDto.Gender.
              AND (@gender IS NULL OR k.gender = @gender)
              AND (@minYears IS NULL OR k.years_experience >= @minYears)
              -- rating_count > 0 là bắt buộc, không thừa: hồ sơ chưa ai đánh giá có
              -- rating_avg = 0, nên với ngưỡng 0 sao chúng lọt qua và bộ lọc "từ 0
              -- sao" khác hẳn "không lọc" theo cách không ai đoán được.
              AND (@minRating IS NULL OR (k.rating_count > 0 AND k.rating_avg >= @minRating))
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
                  --
                  -- Khớp CHÍNH XÁC, cố ý không mở lên cấp cha như bộ lọc bên trên:
                  -- gói bán theo từng khu vực với giá của khu vực đó, nên để gói mua
                  -- ở một quận ăn thứ hạng trên trang tỉnh là phát không phần tồn kho
                  -- chưa bán.
                  AND (@areaId IS NULL OR cp.area_id = @areaId)
            ) b ON true
        ),
        -- Phân trang TRƯỚC khi đọc thêm dữ liệu cho thẻ. Ranh giới này quan trọng:
        -- mọi thứ dưới đây chạy trên đúng @take dòng (≤50), không phải trên toàn bộ
        -- ứng viên. Kéo chứng chỉ/dịch vụ lên trên CTE này sẽ biến chúng thành công
        -- việc nhân với số ứng viên — cùng hình dạng với sự cố MATERIALIZED.
        paged AS (
            SELECT *, COUNT(*) OVER () AS total
            FROM scored
            ORDER BY boost_points + base_score DESC, distance_m ASC NULLS LAST, id
            OFFSET @skip LIMIT @take
        )
        SELECT p.id            AS "Id",
               p.full_name     AS "FullName",
               p.slug          AS "Slug",
               p.gender        AS "Gender",
               p.years_experience AS "YearsExperience",
               p.rating_avg    AS "RatingAvg",
               p.rating_count  AS "RatingCount",
               p.is_online     AS "IsOnline",
               p.distance_m    AS "DistanceM",
               p.boost_points  AS "BoostPoints",
               p.base_score    AS "BaseScore",
               p.boost_points + p.base_score AS "Score",
               p.lat           AS "Lat",
               p.lon           AS "Lon",
               p.avatar_key    AS "AvatarKey",
               -- Chỉ đếm chứng chỉ ĐÃ DUYỆT: thẻ nói "n chứng chỉ đã duyệt", nên đếm
               -- cả hàng PENDING sẽ biến hồ sơ chờ xét thành hồ sơ đã xác minh trong
               -- mắt khách. Partial index idx_certification_ktv_verified phục vụ đúng
               -- vị từ này.
               (SELECT COUNT(*) FROM certifications ct
                 WHERE ct.ktv_id = p.id AND ct.verify_status = 'VERIFIED')::int
                               AS "VerifiedCertCount",
               -- Tối đa 2 dịch vụ, rẻ trước — thẻ chỉ có chỗ cho chừng đó, và giá thấp
               -- nhất là thứ khách dùng để so sánh. Gộp thành JSON tại DB thay vì trả
               -- nhiều dòng rồi ghép ở C#: giữ nguyên một dòng một KTV, không phải sửa
               -- vòng đọc kết quả.
               COALESCE((
                   SELECT jsonb_agg(jsonb_build_object(
                              'name', s.name,
                              'durationMin', s.duration_min,
                              'priceFrom', s.price_from)
                          ORDER BY s.price_from, s.name)
                   FROM (
                       SELECT sv.name, ks.duration_min, ks.price_from
                       FROM ktv_services ks
                       JOIN services sv ON sv.id = ks.service_id
                       WHERE ks.ktv_id = p.id AND sv.is_active
                       ORDER BY ks.price_from, sv.name
                       LIMIT 2
                   ) s
               ), '[]'::jsonb)::text AS "ServicesJson",
               p.total         AS "Total"
        FROM paged p
        ORDER BY p.boost_points + p.base_score DESC, p.distance_m ASC NULLS LAST, p.id
        """;

    /// <summary>
    /// Chính câu SQL trên, mở ra cho test chạy <c>EXPLAIN</c>.
    ///
    /// Có test canh kế hoạch thực thi (<c>SearchQueryPlanTests</c>) vì chi phí của
    /// truy vấn này không nhìn thấy được trên dữ liệu test nhỏ — xem ghi chú
    /// MATERIALIZED ở trên. Test phải đọc đúng chuỗi mà production chạy, nếu chép
    /// lại một bản riêng thì hai bản sẽ trôi khỏi nhau và test canh nhầm thứ.
    /// </summary>
    public static string SqlForDiagnostics => Sql;

    public async Task<SearchResponseDto> SearchAsync(SearchQueryDto q, CancellationToken ct = default)
    {
        var hasOrigin = q is { Lat: not null, Lon: not null };
        var radiusM = q.RadiusKm * 1000.0;

        var areaId = await ResolveAreaIdAsync(q, ct);

        // Slug không khớp khu vực nào: trả rỗng chứ KHÔNG rơi về areaId = NULL, vì
        // NULL nghĩa là "không giới hạn khu vực" tức trả về cả nước. Một URL cũ hoặc
        // sai chính tả phải cho trang rỗng, không phải danh sách toàn quốc — và cũng
        // không phải 500, để crawler gặp URL đã gỡ vẫn nhận phản hồi lành.
        if (q.AreaSlug is not null && areaId is null)
            return new SearchResponseDto([], q.Page, q.Size, 0);

        var rows = await db.Database
            .SqlQueryRaw<SearchRow>(
                Sql,
                Param("hasOrigin", NpgsqlDbType.Boolean, hasOrigin),
                Param("lat", NpgsqlDbType.Double, q.Lat ?? 0d),
                Param("lon", NpgsqlDbType.Double, q.Lon ?? 0d),
                Param("radiusM", NpgsqlDbType.Double, radiusM),
                Param("serviceSlug", NpgsqlDbType.Text, q.Service),
                Param("areaId", NpgsqlDbType.Uuid, areaId),
                Param("onlineOnly", NpgsqlDbType.Boolean, q.IsOnline == true),
                Param("gender", NpgsqlDbType.Text, q.Gender),
                Param("minYears", NpgsqlDbType.Smallint, q.MinYearsExperience),
                // numeric để khớp kiểu cột rating_avg NUMERIC(3,2): truyền double vào
                // đây buộc Postgres ép kiểu mỗi dòng, và so sánh dấu phẩy động với một
                // cột thập phân là chỗ 4.5 lọt hoặc trượt tuỳ vào biểu diễn nhị phân.
                Param("minRating", NpgsqlDbType.Numeric, q.MinRating),
                Param("skip", NpgsqlDbType.Integer, (q.Page - 1) * q.Size),
                Param("take", NpgsqlDbType.Integer, q.Size))
            .ToListAsync(ct);

        RecordImpressions(rows, areaId, q);

        return new SearchResponseDto(
            rows.Select(r => new SearchItemDto(
                r.Id, r.FullName, r.Slug, r.Gender, r.YearsExperience,
                r.RatingAvg, r.RatingCount, r.IsOnline,
                r.DistanceM, r.BoostPoints, r.BaseScore, r.Score, r.Lat, r.Lon,
                urls.Public(r.AvatarKey), r.VerifiedCertCount,
                ParseServices(r.ServicesJson))).ToList(),
            q.Page,
            q.Size,
            rows.Count > 0 ? rows[0].Total : 0);
    }

    /// <summary>
    /// Ghi nhận trang kết quả này đã hiện những KTV nào, ở hạng nào.
    ///
    /// Đặt ở đây chứ không ở controller vì đây là chỗ duy nhất biết cả kết quả lẫn
    /// <c>areaId</c> đã resolve — để controller làm thì nó phải tra slug ra id lần nữa,
    /// và hai chỗ tra sẽ lệch nhau vào lần sửa quy tắc đầu tiên.
    ///
    /// <b>Chỉ xếp vào hàng đợi trong bộ nhớ, không chạm DB.</b> 20 kết quả là 20 dòng;
    /// ghi thẳng ở đây sẽ biến một truy vấn 29ms thành 21 lần đi DB.
    /// </summary>
    private void RecordImpressions(List<SearchRow> rows, Guid? areaId, SearchQueryDto q)
    {
        if (rows.Count == 0) return;

        // Hạng thật trong toàn bộ kết quả, không phải vị trí trong trang: trang 2 bắt đầu
        // từ 21. Thiếu phần bù này thì mọi trang đều báo hạng 1..20 và "hạng trung bình"
        // thành con số vô nghĩa — mà đó chính là thứ gói đẩy tin bán.
        var firstPosition = ((q.Page - 1) * q.Size) + 1;
        var now = DateTimeOffset.UtcNow;

        for (var i = 0; i < rows.Count; i++)
        {
            analytics.Enqueue(new AnalyticsEvent
            {
                Type = AnalyticsEventTypes.Impression,
                KtvId = rows[i].Id,
                // Null khi tìm theo toạ độ: chưa xác định được khu vực hành chính của
                // khách (bảng khu vực chưa có polygon ranh giới), nên gán bừa một khu vực
                // sẽ làm báo cáo "hiệu quả gói ở Quận 7" tính cả lượt của người ở quận khác.
                AreaId = areaId,
                Position = firstPosition + i,
                CreatedAt = now,
            });
        }
    }

    /// <summary>
    /// Giải mã mảng dịch vụ Postgres đã gộp sẵn.
    ///
    /// JSON hỏng trả về danh sách rỗng thay vì ném lỗi: thẻ thiếu dòng giá vẫn dùng
    /// được, còn cả trang tìm kiếm đổ vì một hồ sơ có dữ liệu lạ thì không.
    /// </summary>
    private static IReadOnlyList<SearchItemServiceDto> ParseServices(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];

        try
        {
            return JsonSerializer.Deserialize<List<SearchItemServiceDto>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>Khoá JSON do SQL đặt theo camelCase để khớp thẳng tên property.</summary>
    private static readonly JsonSerializerOptions JsonOptions =
        new() { PropertyNameCaseInsensitive = true };

    /// <summary>
    /// Đổi cặp slug thành id khu vực **trước khi** vào câu SQL.
    ///
    /// Giải ở đây chứ không đẩy join vào truy vấn vì hai lẽ. Một: slug quận chỉ duy
    /// nhất trong phạm vi tỉnh — cả nước có 10 "huyen-chau-thanh" — nên khớp bằng
    /// slug trần bên trong SQL sẽ gộp KTV của mười tỉnh vào một trang, và tệ hơn, để
    /// gói VIP Pin mua ở Tiền Giang đẩy hạng trên trang Bến Tre. Hai: truyền
    /// <c>uuid</c> thay cho <c>text</c> giữ nguyên hình dạng câu truy vấn — CTE
    /// MATERIALIZED và kế hoạch thực thi không đổi, hai subquery còn bớt được một
    /// join mỗi cái. Nếu thấy mình đang sửa <c>SearchQueryShapeTests</c> thì đã đi
    /// sai đường, dừng lại.
    ///
    /// <c>areaSlug</c> đứng một mình = slug tỉnh (giữ tương thích với URL cũ); kèm
    /// <c>provinceSlug</c> = quận trong tỉnh đó.
    /// </summary>
    private async Task<Guid?> ResolveAreaIdAsync(SearchQueryDto q, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(q.AreaSlug)) return null;

        if (string.IsNullOrWhiteSpace(q.ProvinceSlug))
        {
            return await db.AdministrativeAreas
                .Where(a => a.Slug == q.AreaSlug && a.Level == AreaLevels.Province)
                .Select(a => (Guid?)a.Id)
                .FirstOrDefaultAsync(ct);
        }

        return await db.AdministrativeAreas
            .Where(a => a.Slug == q.AreaSlug
                        && a.Parent!.Slug == q.ProvinceSlug
                        && a.Parent.Level == AreaLevels.Province)
            .Select(a => (Guid?)a.Id)
            .FirstOrDefaultAsync(ct);
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

        /// <summary>Null cho hồ sơ tạo trước 2026-09-08 chưa khai lại.</summary>
        public string? Gender { get; set; }

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

        /// <summary>Key thô; đổi thành URL ở tầng dựng DTO qua <c>MediaUrls</c>.</summary>
        public string? AvatarKey { get; set; }

        public int VerifiedCertCount { get; set; }

        /// <summary>
        /// Mảng dịch vụ dạng JSON do Postgres gộp sẵn. Giữ nguyên chuỗi ở tầng này
        /// và chỉ giải mã khi dựng DTO — <c>SqlQueryRaw</c> không ánh xạ được kiểu
        /// phức hợp, nên jsonb phải đi qua đây dưới dạng text.
        /// </summary>
        public string ServicesJson { get; set; } = "[]";

        public long Total { get; set; }
    }
}
