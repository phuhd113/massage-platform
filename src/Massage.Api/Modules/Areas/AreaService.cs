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

    public async Task<List<AreaNodeDto>> GetTreeAsync(CancellationToken ct = default)
    {
        var areas = await db.AdministrativeAreas
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
                counts.GetValueOrDefault(p.Id) >= MinKtvForIndex,
                byParent.GetValueOrDefault(p.Id, [])
                    .Select(d => new AreaNodeDto(
                        d.Id, d.Name, d.Slug, d.Level,
                        counts.GetValueOrDefault(d.Id),
                        counts.GetValueOrDefault(d.Id) >= MinKtvForIndex,
                        []))
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
            counts.GetValueOrDefault(province.Id) >= MinKtvForIndex,
            Parent: null,
            Children: districts.Select(d => ToNode(d, counts)).ToList(),
            Siblings: []);
    }

    public async Task<AreaDetailDto> GetDistrictAsync(
        string provinceSlug, string districtSlug, CancellationToken ct = default)
    {
        var province = await FindAsync(provinceSlug, AreaLevels.Province, ct);

        var district = await db.AdministrativeAreas
            .FirstOrDefaultAsync(a => a.Slug == districtSlug && a.ParentId == province.Id, ct)
            ?? throw new NotFoundException($"Không tìm thấy khu vực \"{districtSlug}\" trong {province.Name}");

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
            counts.GetValueOrDefault(district.Id) >= MinKtvForIndex,
            Parent: ToNode(province, counts),
            Children: [],
            Siblings: siblings.Select(s => ToNode(s, counts)).ToList());
    }

    private async Task<AdministrativeArea> FindAsync(string slug, string level, CancellationToken ct) =>
        await db.AdministrativeAreas.FirstOrDefaultAsync(a => a.Slug == slug && a.Level == level, ct)
        ?? throw new NotFoundException($"Không tìm thấy khu vực \"{slug}\"");

    private static AreaNodeDto ToNode(AdministrativeArea a, IReadOnlyDictionary<Guid, int> counts) =>
        new(a.Id, a.Name, a.Slug, a.Level,
            counts.GetValueOrDefault(a.Id),
            counts.GetValueOrDefault(a.Id) >= MinKtvForIndex,
            []);

    /// <summary>
    /// Đếm KTV đã duyệt theo từng khu vực, tính trực tiếp thay vì đọc bảng đếm
    /// dựng sẵn. Ở quy mô Phase 1 (vài nghìn hồ sơ) truy vấn này rẻ, và quan trọng
    /// hơn: nó không bao giờ lệch. Một bảng đếm cũ khiến trang khu vực vừa đủ điều
    /// kiện vẫn bị gắn noindex — mất traffic mà không có lỗi nào hiện ra.
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
        var provinceCounts = await verified
            .Join(db.AdministrativeAreas, c => c.AreaId, a => a.Id, (c, a) => new { a.ParentId, c.KtvId })
            .Where(x => x.ParentId != null)
            .GroupBy(x => x.ParentId!.Value)
            .Select(g => new { AreaId = g.Key, Count = g.Select(x => x.KtvId).Distinct().Count() })
            .ToListAsync(ct);

        foreach (var row in provinceCounts)
            counts[row.AreaId] = row.Count;

        return counts;
    }
}
