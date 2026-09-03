using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;

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
            Siblings: []);
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
            Siblings: siblings.Select(s => ToNode(s, counts)).ToList());
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
