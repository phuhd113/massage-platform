using Massage.Api.Common;
using Massage.Api.Common.Storage;
using Massage.Api.Data;
using Massage.Api.Modules.Collaborators;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Massage.Api.Modules.KtvProfiles;

public class KtvProfileService(
    AppDbContext db, MediaUrls urls, CollaboratorService collaborators)
{
    private static Point ToPoint(double lon, double lat) =>
        new(lon, lat) { SRID = 4326 };

    public async Task<KtvProfile> CreateAsync(Guid userId, CreateKtvProfileDto dto, CancellationToken ct = default)
    {
        if (await db.KtvProfiles.AnyAsync(p => p.UserId == userId, ct))
            throw new ConflictException("Tài khoản này đã có hồ sơ KTV");

        await AssertAreasExistAsync(dto.CoverageAreaIds, ct);
        await AssertWardExistsAsync(dto.BaseWardId, ct);

        // Tra mã **trước** khi dựng hồ sơ: mã sai thì ném lỗi ở đây và không có gì được
        // ghi. Bỏ trống là hợp lệ — đa số hồ sơ tự đến qua SEO, không qua cộng tác viên.
        var referrer = string.IsNullOrWhiteSpace(dto.ReferralCode)
            ? null
            : await collaborators.RequireActiveByCodeAsync(dto.ReferralCode, ct);

        var profile = new KtvProfile
        {
            UserId = userId,
            FullName = dto.FullName,
            Gender = dto.Gender,
            Slug = await GenerateUniqueSlugAsync(dto.FullName, ct),
            YearsExperience = dto.YearsExperience ?? 0,
            BasePoint = ToPoint(dto.Lon, dto.Lat),
            BaseAddress = dto.BaseAddress,
            BaseWardId = dto.BaseWardId,
            BaseStreet = dto.BaseStreet,
            ServiceRadiusKm = dto.ServiceRadiusKm,
            VerificationStatus = VerificationStatuses.Pending,
            ReferredByCollaboratorId = referrer?.Id,
            ReferredAt = referrer is null ? null : DateTimeOffset.UtcNow,
        };

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync(ct);
        await ReplaceCoverageAreasAsync(profile.Id, dto.CoverageAreaIds, ct);
        await tx.CommitAsync(ct);

        return profile;
    }

    public async Task<KtvProfile> UpdateAsync(Guid userId, UpdateKtvProfileDto dto, CancellationToken ct = default)
    {
        var profile = await GetByUserIdAsync(userId, ct);
        await AssertAreasExistAsync(dto.CoverageAreaIds, ct);
        await AssertWardExistsAsync(dto.BaseWardId, ct);

        if (dto.FullName is not null) profile.FullName = dto.FullName;
        // Không có nhánh nào đưa Gender về null: null ở đây là "không đổi" (xem DTO),
        // và giá trị NULL chỉ dành cho hồ sơ chưa từng được hỏi.
        if (dto.Gender is not null) profile.Gender = dto.Gender;
        if (dto.YearsExperience.HasValue) profile.YearsExperience = dto.YearsExperience.Value;
        if (dto.BaseAddress is not null) profile.BaseAddress = dto.BaseAddress;
        if (dto.BaseWardId.HasValue) profile.BaseWardId = dto.BaseWardId;
        if (dto.BaseStreet is not null) profile.BaseStreet = dto.BaseStreet;
        if (dto.ServiceRadiusKm.HasValue) profile.ServiceRadiusKm = dto.ServiceRadiusKm.Value;
        if (dto.Lat.HasValue && dto.Lon.HasValue) profile.BasePoint = ToPoint(dto.Lon.Value, dto.Lat.Value);

        // Hồ sơ đã duyệt mà sửa thông tin thì phải duyệt lại: nếu không, KTV có thể
        // được duyệt bằng hồ sơ sạch rồi đổi sang nội dung khác sau lưng admin.
        if (profile.VerificationStatus == VerificationStatuses.Verified)
        {
            profile.VerificationStatus = VerificationStatuses.Pending;
            profile.RejectionReason = null;
        }

        profile.UpdatedAt = DateTimeOffset.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.SaveChangesAsync(ct);
        if (dto.CoverageAreaIds is not null)
            await ReplaceCoverageAreasAsync(profile.Id, dto.CoverageAreaIds, ct);
        await tx.CommitAsync(ct);

        return profile;
    }

    /// <summary>Bật/tắt trạng thái "đang nhận khách" của chính mình.</summary>
    /// <remarks>
    /// Cố ý <b>không</b> đi qua <see cref="UpdateAsync"/>, dù cùng ghi lên một hàng.
    /// Đường sửa hồ sơ đưa hồ sơ đã duyệt về PENDING — đúng cho việc đổi tên hay đổi
    /// khu vực, nhưng ở đây thì tai hại: KTV tắt nhận khách lúc đi ngủ sẽ rớt khỏi kết
    /// quả tìm kiếm cho tới khi admin duyệt lại, và không có gì báo cho họ biết. Đây là
    /// công tắc dùng nhiều lần mỗi ngày, không phải một lượt khai báo lại hồ sơ.
    ///
    /// Vì vậy nó cũng không đụng <c>UpdatedAt</c>: cột đó là "hồ sơ đổi nội dung lần
    /// cuối lúc nào" và sitemap đọc nó (xem <c>SitemapEntryDto</c>). Bật/tắt trong ngày
    /// không đổi nội dung trang, nên đẩy <c>lastmod</c> lên mỗi lần là khai với Google
    /// rằng hàng trăm trang vừa được sửa trong khi không trang nào đổi một chữ.
    ///
    /// <c>ExecuteUpdate</c> ghi thẳng một cột thay vì nạp cả hồ sơ kèm bốn bảng con chỉ
    /// để đổi một bit.
    /// </remarks>
    public async Task<bool> SetOnlineAsync(Guid userId, bool isOnline, CancellationToken ct = default)
    {
        var changed = await db.KtvProfiles
            .Where(p => p.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsOnline, isOnline), ct);

        if (changed == 0) throw new NotFoundException("Chưa có hồ sơ KTV cho tài khoản này");

        return isOnline;
    }

    public async Task<KtvProfile> GetByUserIdAsync(Guid userId, CancellationToken ct = default) =>
        await db.KtvProfiles.Include(p => p.Certifications).Include(p => p.Photos)
            .Include(p => p.IdentityDocument)
            .FirstOrDefaultAsync(p => p.UserId == userId, ct)
        ?? throw new NotFoundException("Chưa có hồ sơ KTV cho tài khoản này");

    public async Task<KtvProfile> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.KtvProfiles.Include(p => p.Certifications).Include(p => p.Photos)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
        ?? throw new NotFoundException("Không tìm thấy hồ sơ KTV");

    /// <summary>
    /// Hồ sơ công khai, tra theo id hoặc theo slug (URL công khai là
    /// <c>/ktv/{slug}-{id}</c> nên frontend có sẵn cả hai).
    ///
    /// Chỉ trả hồ sơ đã duyệt: hồ sơ PENDING không xuất hiện trong kết quả tìm
    /// kiếm, nên nếu endpoint này vẫn trả về thì chỉ cần đoán id là xem được hồ sơ
    /// chưa qua kiểm duyệt — và trang đó có thể bị Google index trước khi ai kịp
    /// nhìn vào nội dung.
    /// </summary>
    public async Task<PublicKtvProfileDto> GetPublicAsync(
        Guid? id, string? slug, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles
            .AsNoTracking()
            .Include(p => p.Certifications)
            .Include(p => p.Photos)
            .FirstOrDefaultAsync(p =>
                p.VerificationStatus == VerificationStatuses.Verified &&
                (id != null ? p.Id == id : p.Slug == slug), ct)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ KTV");

        var areas = await db.CoverageAreas
            .Where(c => c.KtvId == profile.Id)
            .Join(db.AdministrativeAreas, c => c.AreaId, a => a.Id, (_, a) => a)
            .OrderBy(a => a.Name)
            .Select(a => new PublicAreaDto(a.Id, a.Name, a.Slug, a.Level,
                a.Parent != null ? a.Parent.Slug : null))
            .ToListAsync(ct);

        var services = await db.KtvServices
            .Where(s => s.KtvId == profile.Id && s.Service!.IsActive)
            .OrderBy(s => s.Service!.SortOrder)
            .Select(s => new PublicKtvServiceDto(
                s.ServiceId, s.Service!.Name, s.Service.Slug, s.PriceFrom, s.DurationMin))
            .ToListAsync(ct);

        return new PublicKtvProfileDto(
            profile.Id,
            profile.FullName,
            profile.Slug,
            profile.Gender,
            profile.YearsExperience,
            Math.Round(profile.BasePoint.Y, 3),
            Math.Round(profile.BasePoint.X, 3),
            profile.ServiceRadiusKm,
            profile.RatingAvg,
            profile.RatingCount,
            profile.IsOnline,
            profile.CreatedAt,
            urls.Public(profile.AvatarKey),
            profile.Photos
                .Where(x => x.VerifyStatus == VerificationStatuses.Verified)
                .OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt)
                .Select(x => new PublicKtvPhotoDto(x.Id, urls.Public(x.StorageKey)!, x.Caption))
                .ToList(),
            profile.Certifications
                .Where(c => c.VerifyStatus == VerificationStatuses.Verified)
                .OrderBy(c => c.Name)
                .Select(c => new PublicCertificationDto(c.Id, c.Name, c.IssuingOrg, c.IssuedAt))
                .ToList(),
            areas,
            services);
    }

    /// <summary>
    /// Khu vực KTV nhận phục vụ, kèm tên để hiển thị.
    ///
    /// Tách riêng khỏi <see cref="GetByUserIdAsync"/> vì nav property
    /// <c>CoverageAreas</c> chỉ có cặp id — form sửa hồ sơ cần biết KTV đang chọn
    /// những quận nào, không thể để họ chọn lại từ đầu mỗi lần sửa một dòng thông tin.
    /// </summary>
    public async Task<List<PublicAreaDto>> ListCoverageAreasAsync(
        Guid ktvId, CancellationToken ct = default) =>
        await db.CoverageAreas
            .Where(c => c.KtvId == ktvId)
            .Join(db.AdministrativeAreas, c => c.AreaId, a => a.Id, (_, a) => a)
            .OrderBy(a => a.Name)
            .Select(a => new PublicAreaDto(a.Id, a.Name, a.Slug, a.Level,
                a.Parent != null ? a.Parent.Slug : null))
            .ToListAsync(ct);

    /// <summary>
    /// Địa chỉ hành chính của hồ sơ, dựng bằng hai bước join lên <c>parent_id</c> từ
    /// phường đã lưu. Trả cả tên lẫn slug để form sửa hiển thị được lựa chọn hiện tại
    /// mà không phải gọi thêm ba lượt tra khu vực.
    ///
    /// Chỉ nhận phường làm điểm xuất phát: <c>base_ward_id</c> được validate đúng cấp
    /// ở đường ghi, nên gặp cấp khác ở đây là dữ liệu hỏng chứ không phải trường hợp
    /// hợp lệ — trả null để trang vẫn hiện được thay vì ném lỗi.
    /// </summary>
    public async Task<BaseAreaDto?> GetBaseAreaAsync(Guid? wardId, CancellationToken ct = default)
    {
        if (wardId is null) return null;

        return await db.AdministrativeAreas
            .Where(w => w.Id == wardId && w.Level == AreaLevels.Ward)
            .Select(w => new BaseAreaDto(
                w.Id, w.Name, w.Slug,
                w.Parent!.Id, w.Parent.Name, w.Parent.Slug,
                w.Parent.Parent!.Id, w.Parent.Parent.Name, w.Parent.Parent.Slug))
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Dữ liệu sinh <c>sitemap.xml</c>: chỉ hồ sơ đã duyệt, kèm mốc cập nhật để
    /// Google biết trang nào cần crawl lại.
    /// </summary>
    public async Task<List<SitemapEntryDto>> GetSitemapEntriesAsync(CancellationToken ct = default) =>
        await db.KtvProfiles
            .AsNoTracking()
            .Where(p => p.VerificationStatus == VerificationStatuses.Verified)
            .OrderByDescending(p => p.UpdatedAt)
            .Select(p => new SitemapEntryDto(p.Id, p.Slug, p.UpdatedAt))
            .ToListAsync(ct);

    public async Task<Certification> AddCertificationAsync(
        Guid userId, CreateCertificationDto dto, string storageKey, CancellationToken ct = default)
    {
        var profile = await GetByUserIdAsync(userId, ct);

        var cert = new Certification
        {
            KtvId = profile.Id,
            Name = dto.Name,
            IssuingOrg = dto.IssuingOrg,
            IssuedAt = dto.IssuedAt,
            StorageKey = storageKey,
            VerifyStatus = VerificationStatuses.Pending,
        };

        db.Certifications.Add(cert);
        await db.SaveChangesAsync(ct);
        return cert;
    }

    /// <summary>
    /// Ghi nhận KTV đã chấp nhận bản cam kết.
    ///
    /// Từ chối khi <paramref name="version"/> không phải bản đang có hiệu lực: số đó
    /// đến từ màn hình người dùng vừa đọc, nên lệch số nghĩa là họ đang nhìn một bản
    /// khác với bản ta sắp ghi nhận — thường là tab mở từ trước lúc cập nhật.
    ///
    /// Ghi đè mốc cũ khi cam kết lại ở phiên bản mới: cái cần chứng minh là "đã đồng ý
    /// với bản đang có hiệu lực", còn lịch sử các bản trước không có ai đọc tới. Nếu
    /// sau này cần lịch sử đầy đủ thì đó là một bảng append-only riêng, không phải thêm
    /// cột vào đây.
    /// </summary>
    public async Task<KtvProfile> AcceptCommitmentsAsync(
        Guid userId, int version, string? ip, CancellationToken ct = default)
    {
        if (version != KtvCommitments.CurrentVersion)
            throw new BadRequestException(
                $"Bản cam kết đã được cập nhật (bản {KtvCommitments.CurrentVersion}). "
                + "Tải lại trang và đọc lại trước khi xác nhận.");

        var profile = await GetByUserIdAsync(userId, ct);

        profile.CommitmentVersion = version;
        profile.CommittedAt = DateTimeOffset.UtcNow;
        profile.CommittedIp = ip;
        profile.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return profile;
    }

    /// <summary>
    /// Gửi (hoặc gửi lại) ảnh CCCD. Trả về bản ghi mới cùng danh sách key **cũ** để
    /// tầng gọi xoá file khỏi storage sau khi DB đã commit — cùng lý do với
    /// <see cref="SetAvatarAsync"/>: xoá trước mà lưu DB hỏng là mất file không lấy lại được.
    ///
    /// Ghi đè tại chỗ chứ không thêm hàng: một KTV có nhiều nhất một CCCD
    /// (<c>uq_identity_doc_ktv</c>), và giữ lại các lần gửi trước nghĩa là giữ thêm
    /// nhiều bản sao giấy tờ tuỳ thân mà không ai đọc.
    ///
    /// Gửi lại luôn **đưa trạng thái về PENDING** và xoá lý do từ chối. Giữ nguyên
    /// VERIFIED khi ảnh đã đổi là để một hồ sơ đã duyệt thay thẻ khác vào mà không ai
    /// nhìn lại — tức là đúng cái lỗ mà việc bắt buộc CCCD sinh ra để bịt.
    /// </summary>
    public async Task<(IdentityDocument Document, List<string> PreviousKeys)> SubmitIdentityDocumentAsync(
        Guid userId, string frontKey, string backKey, CancellationToken ct = default)
    {
        var profile = await GetByUserIdAsync(userId, ct);
        var now = DateTimeOffset.UtcNow;

        var doc = await db.IdentityDocuments.FirstOrDefaultAsync(d => d.KtvId == profile.Id, ct);
        var previous = new List<string>();

        if (doc is null)
        {
            doc = new IdentityDocument { KtvId = profile.Id, CreatedAt = now };
            db.IdentityDocuments.Add(doc);
        }
        else
        {
            previous.Add(doc.FrontKey);
            previous.Add(doc.BackKey);
        }

        doc.FrontKey = frontKey;
        doc.BackKey = backKey;
        doc.VerifyStatus = VerificationStatuses.Pending;
        doc.RejectionReason = null;
        doc.VerifiedBy = null;
        doc.VerifiedAt = null;
        doc.SubmittedAt = now;

        await db.SaveChangesAsync(ct);
        return (doc, previous);
    }

    /// <summary>
    /// Tra CCCD theo key lưu trữ (mặt trước hoặc mặt sau), để đường tải file kiểm được
    /// **ai** sở hữu nó. Cùng hình dạng và cùng lý do với
    /// <see cref="FindCertificationByKeyAsync"/>.
    /// </summary>
    public async Task<IdentityDocument?> FindIdentityDocumentByKeyAsync(
        string key, CancellationToken ct = default) =>
        await db.IdentityDocuments.AsNoTracking()
            .FirstOrDefaultAsync(d => d.FrontKey == key || d.BackKey == key, ct);

    /// <summary>
    /// Tra chứng chỉ theo key lưu trữ, để đường tải file kiểm được **ai** sở hữu nó.
    ///
    /// Tra theo key chứ không theo id vì URL do <c>MediaUrls.Signed</c> dựng ra mang
    /// key — cùng thứ mà adapter R2 ký. Hai đường dùng chung một định danh thì không
    /// lệch nhau được.
    /// </summary>
    public async Task<Certification?> FindCertificationByKeyAsync(
        string key, CancellationToken ct = default) =>
        await db.Certifications.AsNoTracking().FirstOrDefaultAsync(c => c.StorageKey == key, ct);

    /// <summary>
    /// Đặt ảnh đại diện mới và trả về key **cũ** để tầng gọi xoá file khỏi storage.
    ///
    /// Trả key cũ ra ngoài thay vì tự xoá ở đây có chủ ý: xoá file phải xảy ra **sau**
    /// khi DB đã commit. Đảo lại thì một lỗi lưu DB sẽ để hồ sơ trỏ tới file vừa bị
    /// xoá — ảnh vỡ trên trang công khai, và không có cách nào lấy lại.
    /// </summary>
    /// <remarks>
    /// Ảnh vào <b>hàng chờ duyệt</b> (<c>pending_avatar_key</c>), không ghi thẳng vào
    /// <c>avatar_key</c>. Ảnh đang hiển thị giữ nguyên trên sàn cho tới khi admin duyệt
    /// bản mới — đổi ảnh không bao giờ làm hồ sơ mất ảnh, kể cả khi bản mới bị từ chối.
    ///
    /// Key trả ra để controller dọn là <b>key chờ duyệt cũ</b>, không phải avatar đang
    /// dùng: gửi lại lần hai thì bản chờ lần một thành rác, còn ảnh công khai thì không
    /// được đụng tới.
    /// </remarks>
    public async Task<string?> SetAvatarAsync(Guid userId, string key, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct)
                      ?? throw new NotFoundException("Chưa có hồ sơ KTV cho tài khoản này");

        var previousPending = profile.PendingAvatarKey;

        profile.PendingAvatarKey = key;
        profile.AvatarVerifyStatus = VerificationStatuses.Pending;
        // Xoá lý do từ chối cũ: nó nói về tấm ảnh vừa bị thay, để lại là dán một lời chê
        // lên tấm ảnh mới mà chưa ai xem.
        profile.AvatarRejectionReason = null;
        profile.AvatarVerifiedBy = null;
        // submitted_at tách khỏi created_at vì hàng bị ghi đè tại chỗ: xếp hàng đợi theo
        // thời điểm tạo hồ sơ thì người bị từ chối rồi gửi lại nằm nguyên chỗ cũ và không
        // bao giờ được xem lại (cùng lý do với ktv_identity_documents).
        profile.AvatarSubmittedAt = DateTimeOffset.UtcNow;
        profile.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        // Cùng key nghĩa là không có gì để dọn — không bao giờ xảy ra với GUID mới mỗi
        // lần upload, nhưng xoá nhầm ở đây là mất đúng ảnh vừa đặt.
        return previousPending == key ? null : previousPending;
    }

    /// <summary>Gỡ ảnh đại diện: xoá cả ảnh đang hiển thị lẫn ảnh đang chờ duyệt.</summary>
    /// <remarks>
    /// Gỡ là "tôi không muốn có ảnh nào", nên nó dọn cả hai cột. Chỉ xoá bản đang hiển thị
    /// sẽ để một ảnh chờ duyệt sống sót và tự lên sàn khi admin duyệt — tức ảnh KTV đã chủ
    /// động gỡ lại xuất hiện, muộn vài giờ, không ai hiểu vì sao.
    /// </remarks>
    public async Task<IReadOnlyList<string>> RemoveAvatarAsync(Guid userId, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct)
                      ?? throw new NotFoundException("Chưa có hồ sơ KTV cho tài khoản này");

        var removed = new[] { profile.AvatarKey, profile.PendingAvatarKey }
            .Where(k => !string.IsNullOrEmpty(k))
            .Select(k => k!)
            .Distinct()
            .ToList();

        profile.AvatarKey = null;
        profile.PendingAvatarKey = null;
        profile.AvatarVerifyStatus = null;
        profile.AvatarRejectionReason = null;
        profile.AvatarVerifiedBy = null;
        profile.AvatarSubmittedAt = null;
        profile.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        return removed;
    }

    /// <summary>Quyết định của admin về ảnh đại diện đang chờ duyệt.</summary>
    /// <returns>Key cần xoá khỏi storage sau khi DB commit, hoặc null.</returns>
    /// <remarks>
    /// Duyệt: ảnh chờ thay ảnh đang hiển thị, và <b>ảnh cũ trở thành rác</b> — trả nó ra
    /// cho controller dọn sau commit, đúng quy ước "xoá file sau khi DB commit".
    ///
    /// Từ chối: ảnh chờ bị xoá, <b>avatar đang hiển thị không đụng tới</b>. Lý do từ chối
    /// phải lưu lại — KTV cần biết chụp lại thế nào, chứ không phải thấy ảnh lặng lẽ biến
    /// mất khỏi hàng chờ.
    /// </remarks>
    public async Task<string?> DecideAvatarAsync(
        Guid ktvId, Guid adminId, string decision, string? reason, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles.FirstOrDefaultAsync(p => p.Id == ktvId, ct)
                      ?? throw new NotFoundException("Không tìm thấy hồ sơ KTV");

        if (profile.PendingAvatarKey is null)
            throw new BadRequestException("Hồ sơ này không có ảnh đại diện nào đang chờ duyệt");

        profile.AvatarVerifiedBy = adminId;
        profile.UpdatedAt = DateTimeOffset.UtcNow;

        string? orphan;

        if (decision == VerificationStatuses.Verified)
        {
            orphan = profile.AvatarKey;
            profile.AvatarKey = profile.PendingAvatarKey;
            profile.AvatarRejectionReason = null;
        }
        else
        {
            orphan = profile.PendingAvatarKey;
            profile.AvatarRejectionReason = reason;
        }

        // Cả hai nhánh đều dọn hàng chờ: duyệt xong hay từ chối xong thì không còn gì chờ.
        // Giữ lại status = 'VERIFIED'/'REJECTED' kèm pending_avatar_key = NULL sẽ làm hàng
        // đợi sạch nhưng để KTV không đọc được kết quả — nên status theo đúng quyết định,
        // chỉ có key là được nhả.
        profile.PendingAvatarKey = null;
        profile.AvatarVerifyStatus = decision;

        await db.SaveChangesAsync(ct);

        return orphan == profile.AvatarKey ? null : orphan;
    }

    /// <summary>
    /// Thêm một ảnh vào gallery. Ảnh vào hàng đợi duyệt, chưa hiện trên trang công khai.
    ///
    /// Giới hạn số ảnh đếm **mọi trạng thái**, kể cả ảnh bị từ chối: đếm riêng ảnh đã
    /// duyệt thì một tài khoản bị từ chối liên tục vẫn upload được không giới hạn, và
    /// mỗi lần đều tốn dung lượng thật cùng một lượt người thật phải ngồi xem.
    /// </summary>
    public async Task<KtvPhoto> AddPhotoAsync(
        Guid userId, string key, string? caption, int maxPhotos, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct)
                      ?? throw new NotFoundException("Chưa có hồ sơ KTV cho tài khoản này");

        var count = await db.KtvPhotos.CountAsync(x => x.KtvId == profile.Id, ct);
        if (count >= maxPhotos)
            throw new BadRequestException($"Tối đa {maxPhotos} ảnh trong bộ sưu tập");

        var photo = new KtvPhoto
        {
            KtvId = profile.Id,
            StorageKey = key,
            Caption = caption,
            // Ảnh mới xuống cuối. Dùng số ảnh hiện có làm mốc chứ không dùng max+1:
            // hai cách chỉ khác nhau khi đã có ảnh bị xoá, và ở đó "xuống cuối" vẫn đúng
            // vì thứ tự chỉ cần so sánh được với nhau, không cần liền mạch.
            SortOrder = (short)count,
            VerifyStatus = VerificationStatuses.Pending,
        };

        db.KtvPhotos.Add(photo);
        await db.SaveChangesAsync(ct);
        return photo;
    }

    /// <summary>Xoá một ảnh của chính chủ, trả key để tầng gọi dọn file sau khi commit.</summary>
    public async Task<string> RemovePhotoAsync(Guid userId, Guid photoId, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles.FirstOrDefaultAsync(p => p.UserId == userId, ct)
                      ?? throw new NotFoundException("Chưa có hồ sơ KTV cho tài khoản này");

        // Lọc theo cả KtvId: thiếu vế đó thì một id đoán được là đường xoá ảnh của
        // người khác, và response 404 hay 204 đều không phân biệt nổi từ bên ngoài.
        var photo = await db.KtvPhotos
                        .FirstOrDefaultAsync(x => x.Id == photoId && x.KtvId == profile.Id, ct)
                    ?? throw new NotFoundException("Không tìm thấy ảnh");

        db.KtvPhotos.Remove(photo);
        await db.SaveChangesAsync(ct);
        return photo.StorageKey;
    }


    /// <summary>
    /// Khu vực hoạt động phải tồn tại **và phải ở cấp quận/huyện**.
    ///
    /// Kiểm cấp là bắt buộc chứ không thừa: đặt một tỉnh làm khu vực hoạt động sẽ
    /// khiến KTV được đếm hai lần ở rollup tỉnh, còn đặt một phường thì cộng vào cha
    /// của nó — tức vào một quận, như thể quận đó là tỉnh. Cả hai đều làm sai con số
    /// quyết định trang nào được index.
    /// </summary>
    private async Task AssertAreasExistAsync(List<Guid>? areaIds, CancellationToken ct)
    {
        if (areaIds is null || areaIds.Count == 0) return;

        var distinct = areaIds.Distinct().ToList();
        var found = await db.AdministrativeAreas
            .CountAsync(a => distinct.Contains(a.Id) && a.Level == AreaLevels.District, ct);

        if (found != distinct.Count)
            throw new BadRequestException("Khu vực hoạt động phải là quận/huyện có thật");
    }

    /// <summary>
    /// Phường/xã của địa chỉ cơ sở phải tồn tại và đúng cấp phường. Nhận nhầm một quận
    /// ở đây sẽ làm địa chỉ hiển thị thiếu một cấp mà không có lỗi nào hiện ra.
    /// </summary>
    private async Task AssertWardExistsAsync(Guid? wardId, CancellationToken ct)
    {
        if (wardId is null) return;

        var ok = await db.AdministrativeAreas
            .AnyAsync(a => a.Id == wardId && a.Level == AreaLevels.Ward, ct);

        if (!ok) throw new BadRequestException("Phường/xã của địa chỉ không hợp lệ");
    }

    private async Task ReplaceCoverageAreasAsync(Guid ktvId, List<Guid>? areaIds, CancellationToken ct)
    {
        await db.CoverageAreas.Where(c => c.KtvId == ktvId).ExecuteDeleteAsync(ct);
        if (areaIds is null || areaIds.Count == 0) return;

        db.CoverageAreas.AddRange(areaIds.Distinct()
            .Select(areaId => new CoverageArea { KtvId = ktvId, AreaId = areaId }));
        await db.SaveChangesAsync(ct);
    }

    private async Task<string> GenerateUniqueSlugAsync(string fullName, CancellationToken ct)
    {
        var baseSlug = SlugHelper.ToSlug(fullName);
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "ktv";

        var candidate = baseSlug;
        var suffix = 1;
        while (await db.KtvProfiles.AnyAsync(p => p.Slug == candidate, ct))
        {
            suffix++;
            candidate = $"{baseSlug}-{suffix}";
        }
        return candidate;
    }
}
