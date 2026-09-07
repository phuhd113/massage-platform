namespace Massage.Api.Modules.KtvProfiles.Entities;

/// <summary>
/// Ảnh CCCD của KTV — hai mặt của **một** tấm thẻ, nên là một hàng chứ không phải hai.
///
/// Tách khỏi <see cref="Certification"/> dù cả hai đều là "giấy tờ chờ duyệt", vì ba
/// điểm khác nhau về bản chất:
///
/// <list type="bullet">
/// <item>CCCD là **một-đối-một** với hồ sơ (<c>UNIQUE (ktv_id)</c> ép ở tầng DB), còn
/// chứng chỉ hành nghề là danh sách nhiều-và-tuỳ-chọn.</item>
/// <item>Hai mặt phải duyệt **cùng nhau**: mặt trước có ảnh và họ tên, mặt sau có ngày
/// cấp và vân tay — duyệt riêng từng mặt là để lọt trường hợp ghép hai nửa của hai
/// thẻ khác nhau. Một hàng, một trạng thái.</item>
/// <item>Nó **chặn** hồ sơ sang VERIFIED (xem <c>AdminService.DecideProfileAsync</c>),
/// còn chứng chỉ thì không.</item>
/// </list>
///
/// **Cố ý không lưu số CCCD và họ tên trên thẻ.** Admin đọc thẳng trên ảnh lúc duyệt,
/// và hiện chưa có nghiệp vụ nào truy vấn theo số. Không lưu thì không lộ được — đây
/// là định danh cấp quốc gia, thứ mà một lần rò rỉ không có cách nào thu hồi. Khi nào
/// cần chặn một người mở nhiều hồ sơ thì thêm cột hash có muối, đừng thêm số thô.
/// </summary>
public class IdentityDocument
{
    public Guid Id { get; set; }
    public Guid KtvId { get; set; }

    /// <summary>
    /// Key mặt trước trong object storage — **riêng tư**, cùng luật với chứng chỉ.
    /// Xem <c>IObjectStorage</c>: DB giữ key, URL dựng lúc đọc qua <c>MediaUrls.Signed</c>.
    /// </summary>
    public string FrontKey { get; set; } = null!;

    /// <summary>Key mặt sau. Bắt buộc như mặt trước — thiếu một mặt là chưa duyệt được.</summary>
    public string BackKey { get; set; } = null!;

    public string VerifyStatus { get; set; } = VerificationStatuses.Pending;
    public string? RejectionReason { get; set; }
    public Guid? VerifiedBy { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Đổi mỗi lần KTV gửi lại ảnh. Cần riêng vì hàng này được **ghi đè tại chỗ**
    /// (một hàng mỗi KTV) chứ không thêm hàng mới: nếu chỉ có <c>created_at</c> thì
    /// hàng đợi duyệt xếp theo thời điểm gửi **lần đầu**, nên KTV bị từ chối rồi gửi
    /// lại vẫn nằm đúng chỗ cũ trong hàng đợi và không bao giờ được xem lại.
    /// </summary>
    public DateTimeOffset SubmittedAt { get; set; }

    public KtvProfile? Ktv { get; set; }
}
