using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.ServiceCatalog.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.ServiceCatalog;

public class ServiceCatalogService(AppDbContext db)
{
    public async Task<List<Service>> ListAsync(CancellationToken ct = default) =>
        await db.Services
            .Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Name)
            .ToListAsync(ct);

    public async Task<Service> GetBySlugAsync(string slug, CancellationToken ct = default) =>
        await db.Services.FirstOrDefaultAsync(s => s.Slug == slug && s.IsActive, ct)
        ?? throw new NotFoundException("Không tìm thấy dịch vụ");

    public async Task<List<KtvService>> ListForKtvAsync(Guid ktvId, CancellationToken ct = default) =>
        await db.KtvServices
            .Include(x => x.Service)
            .Where(x => x.KtvId == ktvId && x.Service!.IsActive)
            .OrderBy(x => x.Service!.SortOrder)
            .ToListAsync(ct);

    /// <summary>
    /// Thay toàn bộ danh sách dịch vụ của một KTV. Dùng replace thay vì thêm/xoá
    /// từng dòng để client không phải tự tính diff — bảng chỉ có vài dòng mỗi KTV
    /// nên chi phí ghi lại không đáng kể.
    /// </summary>
    public async Task<List<KtvService>> ReplaceForKtvAsync(
        Guid ktvId, ReplaceKtvServicesDto dto, CancellationToken ct = default)
    {
        var ids = dto.Items.Select(i => i.ServiceId).ToList();
        if (ids.Count > 0)
        {
            var found = await db.Services.CountAsync(s => ids.Contains(s.Id) && s.IsActive, ct);
            if (found != ids.Count)
                throw new BadRequestException("Có dịch vụ không tồn tại hoặc đã ngừng cung cấp");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        await db.KtvServices.Where(x => x.KtvId == ktvId).ExecuteDeleteAsync(ct);
        db.KtvServices.AddRange(dto.Items.Select(i => new KtvService
        {
            KtvId = ktvId,
            ServiceId = i.ServiceId,
            PriceFrom = i.PriceFrom,
            DurationMin = i.DurationMin,
        }));
        await db.SaveChangesAsync(ct);

        await tx.CommitAsync(ct);

        // ExecuteDelete chạy ngoài change tracker nên context hiện tại vẫn giữ các
        // dòng vừa xoá. Đọc lại bằng context sạch để trả về đúng trạng thái đã lưu.
        db.ChangeTracker.Clear();
        return await ListForKtvAsync(ktvId, ct);
    }
}
