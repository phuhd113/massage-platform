using System.Globalization;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Massage.Api.Modules.Areas;

public class AreaService(AppDbContext db)
{
    /// <summary>
    /// Số KTV đã duyệt tối thiểu để một trang khu vực được phép index.
    ///
    /// Ngưỡng nằm ở API chứ không ở frontend để chỉ có một nguồn sự thật: mô hình
    /// khu-vực × dịch-vụ sinh ra hàng nghìn URL, và nếu hai tầng hiểu ngưỡng khác
    /// nhau thì trang gần rỗng sẽ lọt vào index — Google gọi đó là doorway page và
    /// phạt cả tên miền, không riêng trang đó.
    /// </summary>
    public const int MinKtvForIndex = 3;

    /// <summary>
    /// Trang khu vực chỉ được index khi vừa đủ KTV vừa **có nội dung biên tập riêng**.
    ///
    /// Vế thứ hai thêm vào khi mở toàn quốc: 63 tỉnh và 696 quận/huyện sinh ra ~760
    /// trang từ đúng một mẫu chỉ thay tên khu vực. Ngưỡng KTV lo phần "có dữ liệu
    /// thật", <c>editorial_note</c> lo phần "có nội dung riêng" — thiếu vế nào thì
    /// trang cũng là doorway page. Gộp cả hai vào một cờ để frontend, sitemap và thẻ
    /// robots không thể hiểu khác nhau.
    /// </summary>
    private static bool IsIndexable(int ktvCount, string? editorialNote) =>
        ktvCount >= MinKtvForIndex && !string.IsNullOrWhiteSpace(editorialNote);

    /// <summary>
    /// Cây tỉnh → quận/huyện. **Không bao giờ chứa phường/xã.**
    ///
    /// Vừa là chuyện quy mô vừa là chuyện đúng sai. Quy mô: hàm này được gọi từ trang
    /// chủ, trang tìm kiếm, form hồ sơ, form mua gói, dashboard campaign và sitemap —
    /// nạp cả 10.700 dòng mỗi lần là không chấp nhận được, trong khi tỉnh + quận chỉ
    /// ~760 dòng. Đúng sai: frontend làm phẳng cây bằng <c>flatMap(p =&gt; p.children)</c>
    /// ở bốn chỗ, nên phường lọt vào cây sẽ thành "quận" chọn được — KTV đặt được
    /// phường làm khu vực phục vụ và mua được gói đẩy tin trên một phường.
    ///
    /// Phường lấy riêng qua <see cref="GetWardsAsync"/> khi form thật sự cần.
    /// </summary>
    public async Task<List<AreaNodeDto>> GetTreeAsync(CancellationToken ct = default)
    {
        var areas = await db.AdministrativeAreas
            .Where(a => a.Level != AreaLevels.Ward)
            .OrderBy(a => a.Name)
            .ToListAsync(ct);

        var counts = await GetVerifiedCountsAsync(ct);

        var byParent = areas.Where(a => a.ParentId is not null)
            .GroupBy(a => a.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        return areas
            .Where(a => a.Level == AreaLevels.Province)
            .Select(p => new AreaNodeDto(
                p.Id, p.Name, p.Slug, p.Level,
                counts.GetValueOrDefault(p.Id),
                IsIndexable(counts.GetValueOrDefault(p.Id), p.EditorialNote),
                byParent.GetValueOrDefault(p.Id, [])
                    .Select(d => ToNode(d, counts))
                    .ToList()))
            .ToList();
    }

    public async Task<AreaDetailDto> GetProvinceAsync(string slug, CancellationToken ct = default)
    {
        var province = await FindAsync(slug, AreaLevels.Province, ct);
        var counts = await GetVerifiedCountsAsync(ct);

        var districts = await db.AdministrativeAreas
            .Where(a => a.ParentId == province.Id)
            .OrderBy(a => a.Name)
            .ToListAsync(ct);

        return new AreaDetailDto(
            province.Id, province.Name, province.Slug, province.Level,
            counts.GetValueOrDefault(province.Id),
            IsIndexable(counts.GetValueOrDefault(province.Id), province.EditorialNote),
            province.EditorialNote,
            Parent: null,
            Children: districts.Select(d => ToNode(d, counts)).ToList(),
            Siblings: [],
            // Trang tỉnh gộp thống kê của toàn bộ quận trực thuộc: KTV khai coverage
            // ở mức quận, nên lọc thẳng theo id tỉnh sẽ luôn rỗng.
            Stats: await GetStatsAsync(districts.Select(d => d.Id).ToList(), ct));
    }

    public async Task<AreaDetailDto> GetDistrictAsync(
        string provinceSlug, string districtSlug, CancellationToken ct = default)
    {
        var province = await FindAsync(provinceSlug, AreaLevels.Province, ct);
        var district = await FindChildAsync(province, districtSlug, ct);

        var counts = await GetVerifiedCountsAsync(ct);

        // Khu vực lân cận dùng để liên kết chéo giữa các trang quận — vừa giúp khách
        // tìm tiếp khi quận hiện tại ít KTV, vừa giữ link equity chảy trong site.
        var siblings = await db.AdministrativeAreas
            .Where(a => a.ParentId == province.Id && a.Id != district.Id)
            .OrderBy(a => a.Name)
            .ToListAsync(ct);

        return new AreaDetailDto(
            district.Id, district.Name, district.Slug, district.Level,
            counts.GetValueOrDefault(district.Id),
            IsIndexable(counts.GetValueOrDefault(district.Id), district.EditorialNote),
            district.EditorialNote,
            Parent: ToNode(province, counts),
            Children: [],
            Siblings: siblings.Select(s => ToNode(s, counts)).ToList(),
            Stats: await GetStatsAsync([district.Id], ct));
    }

    /// <summary>
    /// Phường/xã của một quận, lấy riêng vì cây khu vực cố ý không mang chúng.
    ///
    /// Trả <see cref="WardDto"/> chứ không dùng lại <see cref="AreaNodeDto"/>: phường
    /// không có trang riêng nên không có khái niệm "được index", và một trường
    /// <c>indexable</c> luôn bằng false ở đó chỉ mời người đọc hiểu nhầm.
    /// </summary>
    public async Task<List<WardDto>> GetWardsAsync(
        string provinceSlug, string districtSlug, CancellationToken ct = default)
    {
        var province = await FindAsync(provinceSlug, AreaLevels.Province, ct);
        var district = await FindChildAsync(province, districtSlug, ct);

        return await db.AdministrativeAreas
            .Where(a => a.ParentId == district.Id && a.Level == AreaLevels.Ward)
            .OrderBy(a => a.Name)
            .Select(a => new WardDto(a.Id, a.Name, a.Slug))
            .ToListAsync(ct);
    }

    /// <summary>Số ký tự tối thiểu để bắt đầu gợi ý.</summary>
    /// <remarks>
    /// Một ký tự khớp gần như mọi khu vực trong nước, nên kết quả vô nghĩa với khách mà
    /// vẫn tốn một lượt quét — chặn ở đây rẻ hơn mọi thứ làm sau đó.
    /// </remarks>
    public const int MinSuggestQueryLength = 2;

    private const int DefaultSuggestLimit = 8;
    private const int MaxSuggestLimit = 20;

    /// <summary>
    /// Gợi ý khu vực theo từ khoá, gõ có dấu hay không dấu đều khớp.
    ///
    /// <b>Cố ý không dùng lại <see cref="GetVerifiedCountsAsync"/>.</b> Hàm đó đếm KTV cho
    /// **mọi** khu vực trong nước bằng hai lượt quét <c>coverage_areas</c> — chấp nhận được
    /// khi mỗi trang gọi một lần, nhưng ô gợi ý gọi theo từng phím khách gõ.
    ///
    /// Logic đếm vẫn phải trùng khít với hàm kia (tỉnh cộng dồn DISTINCT từ quận con, chỉ
    /// tính hồ sơ đã duyệt): hai công thức lệch nhau thì cùng một khu vực hiện số KTV khác
    /// nhau giữa ô gợi ý và trang khu vực, và cờ <c>indexable</c> cũng lệch theo.
    ///
    /// <b>Chốt top-N trước, đếm KTV sau</b> — đây là điều đo được chứ không phải suy đoán.
    /// Bản đầu để <c>ktv_count</c> tham gia ORDER BY, nghĩa là Postgres phải đếm cho **mọi**
    /// dòng khớp trước khi sắp xếp: từ khoá hai chữ như "xa" khớp 7.777 khu vực, mất 57ms và
    /// còn tăng theo số hồ sơ chứ không theo số khu vực. Cắt còn 8 dòng trước rồi mới đếm đưa
    /// nó về 36ms và làm chi phí đếm thành hằng số. Cái mất là <c>ktv_count</c> không còn
    /// tham gia xếp hạng — chấp nhận được: nó vốn là tiêu chí thứ tư, và truy vấn khớp 7.777
    /// khu vực là truy vấn khách chưa gõ đủ để phân biệt.
    /// </summary>
    public async Task<List<AreaSuggestionDto>> SuggestAsync(
        string? q, int? limit = null, CancellationToken ct = default)
    {
        var needle = NormalizeQuery(q);
        if (needle.Length < MinSuggestQueryLength)
            return [];

        var take = Math.Clamp(limit ?? DefaultSuggestLimit, 1, MaxSuggestLimit);

        // Raw SQL vì phần xếp hạng dùng similarity() của pg_trgm và một LATERAL —
        // cả hai đều nằm ngoài thứ LINQ diễn đạt được.
        //
        // Thứ tự xếp hạng, theo đúng cách khách nghĩ:
        //   1. Khớp từ đầu chuỗi trước ("quan 7" ra Quận 7, không phải Quận 17)
        //   2. Cấp quận trước tỉnh trước phường — khách tìm massage nghĩ theo quận
        //   3. Còn lại theo độ giống trigram, rồi tên để thứ tự ổn định giữa các lần gọi
        //
        // MATERIALIZED là bắt buộc, không phải tuỳ chọn: thiếu nó Postgres được phép kéo
        // phép đếm ở LATERAL ngược vào trong CTE và đếm lại cho toàn bộ dòng khớp — đúng
        // thứ cấu trúc này sinh ra để tránh. Cùng bài học với CTE `global` ở SearchService.
        var rows = await db.Database
            .SqlQueryRaw<SuggestRow>(
                """
                WITH candidates AS MATERIALIZED (
                    SELECT a.id, a.name, a.slug, a.level, a.parent_id, a.editorial_note,
                           -- Thứ hạng phải mang theo dưới dạng cột: LIMIT trong CTE chốt
                           -- *tập* 8 dòng, nhưng SQL không hứa giữ thứ tự đó qua các phép
                           -- JOIN bên ngoài. Không có cột này thì gợi ý đúng nhưng xếp sai.
                           ROW_NUMBER() OVER (
                               ORDER BY (a.name_ascii LIKE @needle || '%') DESC,
                                        CASE a.level
                                             WHEN 'DISTRICT' THEN 0
                                             WHEN 'PROVINCE' THEN 1 ELSE 2 END,
                                        similarity(a.name_ascii, @needle) DESC,
                                        a.name
                           ) AS rank
                      FROM administrative_areas a
                     WHERE a.name_ascii LIKE '%' || @needle || '%'
                     ORDER BY (a.name_ascii LIKE @needle || '%') DESC,
                              CASE a.level
                                   WHEN 'DISTRICT' THEN 0 WHEN 'PROVINCE' THEN 1 ELSE 2 END,
                              similarity(a.name_ascii, @needle) DESC,
                              a.name
                     LIMIT @take
                )
                SELECT c.id                                        AS "Id",
                       c.name                                      AS "Name",
                       c.slug                                      AS "Slug",
                       c.level                                     AS "Level",
                       CASE c.level
                            WHEN 'PROVINCE' THEN NULL
                            WHEN 'DISTRICT' THEN p.slug
                            ELSE gp.slug
                       END                                         AS "ProvinceSlug",
                       CASE WHEN c.level = 'WARD' THEN p.slug END   AS "DistrictSlug",
                       CASE c.level
                            WHEN 'PROVINCE' THEN ''
                            WHEN 'DISTRICT' THEN COALESCE(p.name, '')
                            ELSE COALESCE(p.name, '') || ', ' || COALESCE(gp.name, '')
                       END                                         AS "ParentPath",
                       COALESCE(n.ktv_count, 0)::int                AS "KtvCount",
                       c.editorial_note                             AS "EditorialNote"
                  FROM candidates c
                  LEFT JOIN administrative_areas p  ON p.id  = c.parent_id
                  LEFT JOIN administrative_areas gp ON gp.id = p.parent_id
                  LEFT JOIN LATERAL (
                      SELECT CASE WHEN c.level = 'PROVINCE' THEN (
                                 -- Tỉnh cộng dồn từ quận con, DISTINCT theo ktv_id: một KTV
                                 -- thường phủ nhiều quận trong cùng thành phố, cộng thẳng sẽ
                                 -- thổi phồng con số. Chỉ cộng từ cấp DISTRICT — dòng coverage
                                 -- trỏ vào phường (dữ liệu bẩn) sẽ cộng vào cha nó như thể
                                 -- quận đó là tỉnh.
                                 SELECT COUNT(DISTINCT ca.ktv_id)
                                   FROM coverage_areas ca
                                   JOIN administrative_areas d
                                     ON d.id = ca.area_id AND d.level = 'DISTRICT'
                                   JOIN ktv_profiles k
                                     ON k.id = ca.ktv_id AND k.verification_status = 'VERIFIED'
                                  WHERE d.parent_id = c.id
                             ) ELSE (
                                 SELECT COUNT(*)
                                   FROM coverage_areas ca
                                   JOIN ktv_profiles k
                                     ON k.id = ca.ktv_id AND k.verification_status = 'VERIFIED'
                                  WHERE ca.area_id = c.id
                             ) END AS ktv_count
                  ) n ON true
                 ORDER BY c.rank;
                """,
                new NpgsqlParameter("needle", NpgsqlDbType.Text) { Value = needle },
                new NpgsqlParameter("take", NpgsqlDbType.Integer) { Value = take })
            .ToListAsync(ct);

        return rows
            .Select(r => new AreaSuggestionDto(
                r.Id, r.Name, r.Slug, r.Level,
                r.ProvinceSlug, r.DistrictSlug, r.ParentPath, r.KtvCount,
                IsIndexable(r.KtvCount, r.EditorialNote)))
            .ToList();
    }

    /// <summary>
    /// Bán kính tối đa chấp nhận một quận là "khách đang đứng ở đây", tính từ tâm quận.
    ///
    /// 60km xấp xỉ nửa chiều ngang của huyện lớn nhất. Rộng hơn thì khách ở ngoài khơi
    /// hoặc bên kia biên giới vẫn được gán một quận nghe rất thuyết phục; hẹp hơn thì
    /// khách đứng ở rìa những huyện miền núi rộng lại không được gán gì, mà tâm quận
    /// cách họ xa là chuyện bình thường ở đó.
    /// </summary>
    private const int ResolveMaxDistanceMeters = 60_000;

    /// <summary>
    /// Tra ngược toạ độ GPS ra quận/huyện gần nhất — cho nút "Tìm quanh tôi" điền sẵn ô
    /// khu vực, để khách thấy mình đang tìm ở đâu thay vì một ô trống.
    ///
    /// <b>Đây là "gần tâm nhất", không phải "nằm trong ranh giới".</b> Bảng khu vực chỉ
    /// có centroid; nhập polygon ranh giới thật cho 696 quận là ~20–50MB dữ liệu địa lý
    /// cho một cái nhãn. Chấp nhận được vì kết quả tìm kiếm <b>không</b> phụ thuộc vào
    /// câu trả lời này — nó vẫn lọc theo bán kính quanh toạ độ thật. Hệ quả phải nhớ:
    /// đừng dùng hàm này để quyết định KTV nào được boost ở khu vực nào. Boost là tiền,
    /// và nó cần ranh giới thật chứ không phải điểm gần nhất.
    ///
    /// Chỉ xét cấp DISTRICT: tỉnh cũng có tâm nhưng trả về tỉnh khi không quận nào đủ gần
    /// nghĩa là gán một khu vực rộng hàng trăm km cho người đang ở ngoài lãnh thổ. Không
    /// tìm được thì trả về null và ô khu vực để trống — trạng thái đúng, không phải lỗi.
    /// </summary>
    public async Task<AreaSuggestionDto?> ResolveAsync(
        double lat, double lon, CancellationToken ct = default)
    {
        if (double.IsNaN(lat) || double.IsNaN(lon) ||
            lat is < -90 or > 90 || lon is < -180 or > 180)
        {
            throw new BadRequestException("Toạ độ không hợp lệ.");
        }

        // KNN bằng toán tử <-> để dùng được index GiST: ST_Distance(...) < x trong WHERE
        // buộc Postgres tính khoảng cách cho mọi dòng. Lọc bán kính đặt ở ST_DWithin —
        // dạng duy nhất mà index cũng phục vụ được.
        var id = await db.Database
            .SqlQueryRaw<Guid>(
                """
                SELECT a.id AS "Value"
                  FROM administrative_areas a
                 WHERE a.level = 'DISTRICT'
                   AND a.centroid IS NOT NULL
                   AND ST_DWithin(a.centroid, @point::geography, @radius)
                 ORDER BY a.centroid <-> @point::geography
                 LIMIT 1
                """,
                new NpgsqlParameter("point", NpgsqlDbType.Text)
                {
                    Value = $"SRID=4326;POINT({lon.ToString(CultureInfo.InvariantCulture)} " +
                            $"{lat.ToString(CultureInfo.InvariantCulture)})",
                },
                new NpgsqlParameter("radius", NpgsqlDbType.Double) { Value = (double)ResolveMaxDistanceMeters })
            .FirstOrDefaultAsync(ct);

        return id == Guid.Empty ? null : await DescribeAsync(id, ct);
    }

    /// <summary>
    /// Dựng một <see cref="AreaSuggestionDto"/> cho khu vực đã biết id.
    ///
    /// Trả về đúng hình dạng của ô gợi ý, không phải một DTO riêng: frontend đã có sẵn
    /// đường dựng URL từ hình dạng đó (<c>lib/area-search.ts</c>), và một kiểu thứ hai
    /// mang cùng thông tin sẽ đẻ ra đường dựng URL thứ hai — đúng chỗ mà cặp
    /// <c>areaSlug</c>/<c>provinceSlug</c> từng bị gửi thiếu vế.
    /// </summary>
    private async Task<AreaSuggestionDto?> DescribeAsync(Guid id, CancellationToken ct)
    {
        var row = await db.Database
            .SqlQueryRaw<SuggestRow>(
                """
                SELECT a.id                                        AS "Id",
                       a.name                                      AS "Name",
                       a.slug                                      AS "Slug",
                       a.level                                     AS "Level",
                       CASE a.level
                            WHEN 'PROVINCE' THEN NULL
                            WHEN 'DISTRICT' THEN p.slug
                            ELSE gp.slug
                       END                                         AS "ProvinceSlug",
                       CASE WHEN a.level = 'WARD' THEN p.slug END   AS "DistrictSlug",
                       CASE a.level
                            WHEN 'PROVINCE' THEN ''
                            WHEN 'DISTRICT' THEN COALESCE(p.name, '')
                            ELSE COALESCE(p.name, '') || ', ' || COALESCE(gp.name, '')
                       END                                         AS "ParentPath",
                       (SELECT COUNT(*)
                          FROM coverage_areas ca
                          JOIN ktv_profiles k
                            ON k.id = ca.ktv_id AND k.verification_status = 'VERIFIED'
                         WHERE ca.area_id = a.id)::int              AS "KtvCount",
                       a.editorial_note                             AS "EditorialNote"
                  FROM administrative_areas a
                  LEFT JOIN administrative_areas p  ON p.id  = a.parent_id
                  LEFT JOIN administrative_areas gp ON gp.id = p.parent_id
                 WHERE a.id = @id
                """,
                new NpgsqlParameter("id", NpgsqlDbType.Uuid) { Value = id })
            .FirstOrDefaultAsync(ct);

        return row is null
            ? null
            : new AreaSuggestionDto(
                row.Id, row.Name, row.Slug, row.Level,
                row.ProvinceSlug, row.DistrictSlug, row.ParentPath, row.KtvCount,
                IsIndexable(row.KtvCount, row.EditorialNote));
    }

    /// <summary>
    /// Độ dài tối thiểu của nội dung biên tập để được coi là "có nội dung riêng".
    ///
    /// Ngưỡng tồn tại vì <see cref="IsIndexable"/> chỉ kiểm chuỗi có rỗng hay không, và
    /// một dấu chấm cũng qua được vế đó — tức mở index cho một trang vẫn là bản sao của
    /// ~760 trang cùng mẫu. Đây đúng là thứ Google gọi là doorway page và phạt cả tên
    /// miền, nên chặn ở đường ghi rẻ hơn nhiều so với gỡ ra sau khi đã bị hạ hạng.
    ///
    /// 120 ký tự ≈ hai câu. Không đặt cao hơn: người viết sẽ độn chữ cho đủ, và văn độn
    /// còn tệ hơn văn ngắn.
    /// </summary>
    public const int MinEditorialNoteLength = 120;

    /// <summary>
    /// Danh sách khu vực cho trang biên tập của admin.
    ///
    /// **Chỉ tỉnh và quận/huyện, không bao giờ phường** — phường không có trang riêng
    /// nên nội dung biên tập cho nó không hiển thị ở đâu cả, cùng lý do với
    /// <see cref="GetTreeAsync"/>.
    ///
    /// Sắp xếp mặc định đặt khu vực **sắp đủ điều kiện index** lên đầu: đó là nơi một
    /// đoạn văn vừa viết đổi được trạng thái của trang ngay, còn khu vực 0 KTV thì viết
    /// xong vẫn `noindex` và công sức nằm chờ vô thời hạn.
    /// </summary>
    /// <param name="onlyReady">
    /// Chỉ khu vực đã đủ ngưỡng KTV mà **chưa** có nội dung — tức danh sách việc cần làm
    /// để mở index, đúng nghĩa đen.
    /// </param>
    public async Task<(List<AreaEditorialRowDto> Items, int Total)> ListForEditorialAsync(
        bool onlyReady,
        string? q,
        int page,
        int limit,
        CancellationToken ct = default)
    {
        // Đếm KTV bằng subquery tương quan chứ không join + GroupBy: cùng lý do đã ghi ở
        // module Reports — EF không dịch được left-join tới `GroupBy`, và khu vực 0 KTV
        // (phần lớn trong 759 dòng) phải xuất hiện với số 0 chứ không được biến mất.
        // `CoverageArea` cố ý không có navigation property tới KtvProfile (xem entity),
        // nên điều kiện "đã duyệt" đi qua một subquery trên `KtvProfiles` thay vì `c.Ktv`.
        var baseQuery =
            from a in db.AdministrativeAreas.AsNoTracking()
            where a.Level != AreaLevels.Ward
            let ktvCount = db.CoverageAreas
                .Count(c => c.AreaId == a.Id &&
                    db.KtvProfiles.Any(k => k.Id == c.KtvId &&
                        k.VerificationStatus == VerificationStatuses.Verified))
            select new { Area = a, KtvCount = ktvCount };

        if (onlyReady)
        {
            baseQuery = baseQuery.Where(x =>
                x.KtvCount >= MinKtvForIndex &&
                (x.Area.EditorialNote == null || x.Area.EditorialNote.Trim() == ""));
        }

        if (!string.IsNullOrWhiteSpace(q))
        {
            // Khớp theo `name_ascii` (trigger trong DB dựng) để gõ không dấu vẫn ra —
            // cùng đường khớp với ô gợi ý, nên hai chỗ không thể cho kết quả khác nhau.
            var needle = NormalizeQuery(q);
            baseQuery = baseQuery.Where(x => x.Area.NameAscii != null && x.Area.NameAscii.Contains(needle));
        }

        var total = await baseQuery.CountAsync(ct);

        var rows = await baseQuery
            // Sắp xếp **trước** projection sang record: EF không dịch được `OrderBy` trên
            // thuộc tính của record vừa dựng trong `Select`, và nó nổ lúc chạy chứ không
            // lúc biên dịch. Đã cắn một lần ở trang doanh thu.
            .OrderByDescending(x => x.KtvCount)
            .ThenBy(x => x.Area.Name)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(x => new AreaEditorialRowDto(
                x.Area.Id,
                x.Area.Name,
                x.Area.Slug,
                x.Area.Level,
                x.Area.Parent != null ? x.Area.Parent.Name : null,
                x.Area.Parent != null ? x.Area.Parent.Slug : null,
                x.KtvCount,
                x.Area.EditorialNote,
                // Cờ tính ở server, **không** để frontend tự so sánh: ngưỡng có hai vế và
                // hai tầng hiểu khác nhau là đúng cách trang gần rỗng lọt vào index.
                x.KtvCount >= MinKtvForIndex &&
                    x.Area.EditorialNote != null && x.Area.EditorialNote.Trim() != ""))
            .ToListAsync(ct);

        return (rows, total);
    }

    /// <summary>
    /// Ghi nội dung biên tập cho một khu vực.
    ///
    /// Trả về slug tỉnh + quận để lớp gọi xoá cache ISR đúng đường dẫn — trang khu vực
    /// dựng sẵn và không tự biết mình vừa đổi nội dung. Đây là lý do hàm trả về nhiều
    /// hơn một <c>bool</c>.
    /// </summary>
    /// <param name="note">
    /// Chuỗi rỗng hoặc null nghĩa là **gỡ** nội dung — hợp lệ và có chủ ý: đó là đường
    /// đưa một trang ra khỏi index khi nội dung hoá ra sai, và nó phải tồn tại vì
    /// không có nó thì việc mở index là một chiều.
    /// </param>
    public async Task<AreaEditorialUpdatedDto> SetEditorialNoteAsync(
        Guid id,
        string? note,
        CancellationToken ct = default)
    {
        var area = await db.AdministrativeAreas
            .Include(a => a.Parent)
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy khu vực");

        if (area.Level == AreaLevels.Ward)
            throw new BadRequestException("Phường/xã không có trang riêng nên không nhận nội dung biên tập");

        var trimmed = string.IsNullOrWhiteSpace(note) ? null : note.Trim();

        // Ngưỡng độ dài chỉ áp cho việc **ghi** nội dung, không áp cho việc gỡ. Chặn ở
        // đây chứ không chỉ ở FluentValidation phía form: khu vực cũng sửa được bằng SQL
        // tay và bằng lời gọi API trực tiếp, và một dòng ba chữ lọt qua sẽ mở index cho
        // một trang thin content mà không có gì báo đỏ.
        if (trimmed is not null && trimmed.Length < MinEditorialNoteLength)
        {
            throw new BadRequestException(
                $"Nội dung biên tập cần ít nhất {MinEditorialNoteLength} ký tự (đang có {trimmed.Length}). " +
                "Nội dung quá ngắn không phân biệt được trang này với hàng trăm trang khu vực cùng mẫu.");
        }

        area.EditorialNote = trimmed;
        await db.SaveChangesAsync(ct);

        var ktvCount = await db.CoverageAreas
            .CountAsync(c => c.AreaId == area.Id &&
                db.KtvProfiles.Any(k => k.Id == c.KtvId &&
                    k.VerificationStatus == VerificationStatuses.Verified), ct);

        // Tỉnh thì chính nó là vế tỉnh của đường dẫn; quận thì vế tỉnh nằm ở cha.
        var provinceSlug = area.Level == AreaLevels.Province ? area.Slug : area.Parent?.Slug;
        var districtSlug = area.Level == AreaLevels.District ? area.Slug : null;

        return new AreaEditorialUpdatedDto(
            area.Id,
            area.Name,
            provinceSlug ?? area.Slug,
            districtSlug,
            ktvCount,
            IsIndexable(ktvCount, area.EditorialNote),
            area.EditorialNote);
    }

    /// <summary>
    /// Đưa từ khoá về đúng dạng đã lưu ở <c>name_ascii</c>: bỏ dấu, thường hoá, gộp
    /// khoảng trắng. Dùng lại <see cref="SlugHelper.ToSlug"/> để hai bên không thể lệch
    /// nhau — chuỗi lưu trong cột cũng sinh từ chính quy tắc bỏ dấu đó.
    /// </summary>
    private static string NormalizeQuery(string? q) =>
        string.IsNullOrWhiteSpace(q) ? string.Empty : SlugHelper.ToSlug(q).Replace('-', ' ').Trim();

    /// <summary>
    /// Hình dạng thô của một dòng gợi ý. Mang <c>EditorialNote</c> thay vì <c>Indexable</c>
    /// để cờ index vẫn được tính bằng đúng <see cref="IsIndexable"/> như mọi endpoint khác,
    /// thay vì lặp lại điều kiện đó trong SQL nơi nó sẽ trôi khỏi bản gốc.
    /// </summary>
    private sealed record SuggestRow(
        Guid Id,
        string Name,
        string Slug,
        string Level,
        string? ProvinceSlug,
        string? DistrictSlug,
        string ParentPath,
        int KtvCount,
        string? EditorialNote);

    private async Task<AdministrativeArea> FindAsync(string slug, string level, CancellationToken ct) =>
        await db.AdministrativeAreas.FirstOrDefaultAsync(a => a.Slug == slug && a.Level == level, ct)
        ?? throw new NotFoundException($"Không tìm thấy khu vực \"{slug}\"");

    /// <summary>
    /// Tra con theo slug **trong phạm vi cha**. Không bao giờ tra quận chỉ bằng slug:
    /// cả nước có 10 tỉnh cùng chứa "Huyện Châu Thành", nên bỏ vế cha đi là trả về một
    /// trong mười khu vực mà không có gì quyết định là cái nào.
    /// </summary>
    private async Task<AdministrativeArea> FindChildAsync(
        AdministrativeArea parent, string slug, CancellationToken ct) =>
        await db.AdministrativeAreas
            .FirstOrDefaultAsync(a => a.Slug == slug && a.ParentId == parent.Id, ct)
        ?? throw new NotFoundException($"Không tìm thấy khu vực \"{slug}\" trong {parent.Name}");

    private static AreaNodeDto ToNode(AdministrativeArea a, IReadOnlyDictionary<Guid, int> counts) =>
        new(a.Id, a.Name, a.Slug, a.Level,
            counts.GetValueOrDefault(a.Id),
            IsIndexable(counts.GetValueOrDefault(a.Id), a.EditorialNote),
            []);

    /// <summary>
    /// Đếm KTV đã duyệt theo từng khu vực, tính trực tiếp thay vì đọc bảng đếm
    /// dựng sẵn. Ở quy mô hiện tại (vài nghìn hồ sơ) truy vấn này rẻ, và quan trọng
    /// hơn: nó không bao giờ lệch. Một bảng đếm cũ khiến trang khu vực vừa đủ điều
    /// kiện vẫn bị gắn noindex — mất traffic mà không có lỗi nào hiện ra.
    ///
    /// Mở toàn quốc **không** làm truy vấn này đắt thêm: nó quét theo số hồ sơ chứ
    /// không theo số khu vực. Đo lại khi số hồ sơ tăng, đừng cache trước khi đo.
    /// </summary>
    /// <summary>
    /// Ba con số tóm tắt cho phần đầu trang khu vực.
    ///
    /// Nhận sẵn tập id quận thay vì tự suy: trang tỉnh phải gộp toàn bộ quận trực
    /// thuộc (KTV khai coverage ở mức quận, nên lọc thẳng theo id tỉnh luôn rỗng),
    /// còn trang quận chỉ lấy đúng một id. Gọi bên ngoài đã biết mình đang ở cấp nào.
    ///
    /// Tất cả đều tính trên KTV **đã duyệt** — cùng tập với <c>KtvCount</c>, nếu
    /// không thì trang hiện "12 KTV" nhưng giá lại lấy từ một hồ sơ chưa duyệt.
    /// </summary>
    private async Task<AreaStatsDto> GetStatsAsync(IReadOnlyList<Guid> areaIds, CancellationToken ct)
    {
        if (areaIds.Count == 0) return new AreaStatsDto(null, null, null, 0, null);

        // Id của KTV đã duyệt phủ các khu vực này. Distinct vì một KTV thường phủ
        // nhiều quận trong cùng thành phố.
        var ktvIds = db.CoverageAreas
            .Where(c => areaIds.Contains(c.AreaId))
            .Where(c => db.KtvProfiles.Any(k =>
                k.Id == c.KtvId && k.VerificationStatus == VerificationStatuses.Verified))
            .Select(c => c.KtvId)
            .Distinct();

        var priceRange = await db.KtvServices
            .Where(s => ktvIds.Contains(s.KtvId) && s.PriceFrom > 0)
            .GroupBy(_ => 1)
            .Select(g => new { Min = (decimal?)g.Min(x => x.PriceFrom), Max = (decimal?)g.Max(x => x.PriceFrom) })
            .FirstOrDefaultAsync(ct);

        // Trung bình có trọng số theo số đánh giá, không phải trung bình của các
        // trung bình: một hồ sơ đúng một review 5 sao không được kéo cả khu vực lên
        // ngang với một hồ sơ 200 review 4.8 sao.
        //
        // Cộng bằng double chứ không decimal: `rating_avg` là NUMERIC(3,2) — tối đa
        // 9,99 — nên Postgres giữ nguyên scale đó cho tích và `4.60 * 500` tràn cột
        // ngay ở một hồ sơ có vài trăm đánh giá. Đây là lỗi chỉ lộ ra khi có dữ liệu
        // thật; sai số dấu phẩy động không đáng kể vì kết quả làm tròn về 1 chữ số.
        var rating = await db.KtvProfiles
            .Where(k => ktvIds.Contains(k.Id) && k.RatingCount > 0)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Weighted = (double?)g.Sum(k => (double)k.RatingAvg * k.RatingCount),
                Count = g.Sum(k => k.RatingCount),
            })
            .FirstOrDefaultAsync(ct);

        var topService = await db.KtvServices
            .Where(s => ktvIds.Contains(s.KtvId))
            .Join(db.Services.Where(sv => sv.IsActive), s => s.ServiceId, sv => sv.Id, (s, sv) => sv.Name)
            .GroupBy(name => name)
            .OrderByDescending(g => g.Count())
            .ThenBy(g => g.Key)
            .Select(g => g.Key)
            .FirstOrDefaultAsync(ct);

        var ratingCount = rating?.Count ?? 0;

        return new AreaStatsDto(
            priceRange?.Min,
            priceRange?.Max,
            ratingCount > 0 && rating?.Weighted is { } w
                ? Math.Round((decimal)(w / ratingCount), 1)
                : null,
            ratingCount,
            topService);
    }

    private async Task<Dictionary<Guid, int>> GetVerifiedCountsAsync(CancellationToken ct)
    {
        var verified = db.CoverageAreas.Where(c => db.KtvProfiles.Any(k =>
            k.Id == c.KtvId && k.VerificationStatus == VerificationStatuses.Verified));

        var counts = await verified
            .GroupBy(c => c.AreaId)
            .Select(g => new { AreaId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(r => r.AreaId, r => r.Count, ct);

        // Tỉnh/thành cộng dồn từ các quận trực thuộc, vì KTV khai khu vực hoạt động
        // ở mức quận — chỉ đếm coverage trực tiếp thì trang tỉnh luôn bằng 0.
        //
        // Phải đếm DISTINCT theo ktv_id chứ không cộng số liệu quận lại: một KTV
        // thường phủ nhiều quận trong cùng thành phố, cộng dồn sẽ thổi phồng con số
        // và đẩy một trang tỉnh chỉ có 2 KTV vượt ngưỡng cho index.
        //
        // Chỉ cộng dồn từ **quận**: từ khi có phường trong bảng, một dòng coverage trỏ
        // vào phường (dữ liệu cũ, hoặc client gọi thẳng API) sẽ cộng vào cha của nó —
        // tức là vào một quận, như thể quận đó là tỉnh. Lọc theo cấp ở đây để con số
        // đúng kể cả khi trong bảng đã có dữ liệu bẩn, chứ không chỉ dựa vào validate
        // ở đường ghi.
        var provinceCounts = await verified
            .Join(db.AdministrativeAreas.Where(a => a.Level == AreaLevels.District),
                  c => c.AreaId, a => a.Id, (c, a) => new { a.ParentId, c.KtvId })
            .Where(x => x.ParentId != null)
            .GroupBy(x => x.ParentId!.Value)
            .Select(g => new { AreaId = g.Key, Count = g.Select(x => x.KtvId).Distinct().Count() })
            .ToListAsync(ct);

        foreach (var row in provinceCounts)
            counts[row.AreaId] = row.Count;

        return counts;
    }
}
