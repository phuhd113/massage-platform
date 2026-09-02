namespace Massage.Promotion.Domain;

public static class CampaignStatuses
{
    public const string Active = "ACTIVE";
    public const string Expired = "EXPIRED";
    public const string Cancelled = "CANCELLED";

    public static readonly string[] All = [Active, Expired, Cancelled];
}

/// <summary>
/// Một lần mua gói đang chạy.
///
/// Campaign chỉ tồn tại khi tiền đã trừ và slot đã chiếm — cả hai xảy ra trong
/// cùng một transaction với việc tạo bản ghi này. Vì vậy không có trạng thái
/// DRAFT hay PENDING: một campaign nhìn thấy được là một campaign đã trả tiền.
/// Trạng thái trung gian chỉ cần khi thanh toán tách rời khỏi việc mua, và ở đây
/// tiền đã nằm sẵn trong ví.
/// </summary>
public sealed class Campaign
{
    public Guid Id { get; }
    public Guid KtvId { get; }
    public Guid PackageId { get; }
    public Guid AreaId { get; }
    public string PackageType { get; }
    public int BoostPoints { get; }
    public decimal PricePaid { get; }
    public DateTimeOffset StartAt { get; }
    public DateTimeOffset EndAt { get; }
    public string Status { get; private set; }
    public DateTimeOffset? CancelledAt { get; private set; }
    public decimal RefundedAmount { get; private set; }

    public Campaign(
        Guid id, Guid ktvId, Guid packageId, Guid areaId, string packageType,
        int boostPoints, decimal pricePaid,
        DateTimeOffset startAt, DateTimeOffset endAt, string status)
    {
        if (endAt <= startAt)
            throw new PromotionArgumentException("Thời điểm kết thúc phải sau thời điểm bắt đầu");

        Id = id;
        KtvId = ktvId;
        PackageId = packageId;
        AreaId = areaId;
        PackageType = packageType;
        BoostPoints = boostPoints;
        PricePaid = pricePaid;
        StartAt = startAt;
        EndAt = endAt;
        Status = status;
    }

    /// <summary>
    /// Bắt đầu một campaign, chạy đúng bằng các khung ngày mà nó chiếm slot.
    ///
    /// Mốc bắt đầu là đầu khung ngày chứa thời điểm mua, không phải chính thời điểm
    /// mua: KTV được tính trọn ngày hôm đó (đúng như slot đã chiếm), và số ngày của
    /// gói là số nguyên nên phần hoàn tiền theo ngày còn lại chia hết, không sinh ra
    /// những con số lẻ mà không ai giải thích được cho KTV.
    /// </summary>
    public static Campaign Start(
        Guid id, Guid ktvId, Guid areaId, PromotionPackage package, DateTimeOffset now)
    {
        // Mốc bắt đầu do gói quyết định theo độ mịn khung của nó: gói ngày cắt về
        // đầu ngày, gói giờ cắt về đầu giờ được tính tiền. Cắt cứng về đầu ngày như
        // trước sẽ cho Instant Boost một StartAt sớm hơn khung nó thật sự chiếm —
        // campaign coi như đang chạy trong khi chưa giữ slot nào.
        var startAt = package.StartAtFrom(now);
        return new Campaign(id, ktvId, package.Id, areaId, package.Type, package.BoostPoints,
            package.Price, startAt, package.EndAtFrom(now), CampaignStatuses.Active);
    }

    public bool IsRunning(DateTimeOffset now) =>
        Status == CampaignStatuses.Active && now >= StartAt && now < EndAt;

    /// <summary>
    /// Huỷ và tính số tiền hoàn.
    ///
    /// Hoàn theo số <b>ngày trọn vẹn còn lại</b>: ngày đang dùng dở không được
    /// hoàn, vì KTV đã nhận hiển thị của ngày đó. Làm tròn xuống về VND để nền
    /// tảng không bao giờ hoàn nhiều hơn số đã thu.
    /// </summary>
    public decimal Cancel(DateTimeOffset now)
    {
        if (Status != CampaignStatuses.Active)
            throw new InvalidCampaignTransitionException(Status, CampaignStatuses.Cancelled);

        // Đơn vị hoàn tiền phải là chính đơn vị khung mà gói chiếm slot.
        //
        // Tính theo ngày cho gói bán theo giờ thì "số ngày trọn vẹn còn lại" của một
        // campaign 3 giờ luôn bằng 0, và KTV huỷ ngay sau khi mua vẫn không được
        // hoàn đồng nào — một lỗi im lặng, vì hàm vẫn chạy và vẫn trả về số.
        var unit = SlotGranularities.For(PackageType) == SlotGranularity.Hour
            ? TimeSpan.FromHours(1)
            : TimeSpan.FromDays(1);

        var totalUnits = (EndAt - StartAt) / unit;
        var remainingFullUnits = Math.Floor(Math.Max(0, (EndAt - now) / unit));

        var refund = totalUnits <= 0
            ? 0m
            : Math.Floor(PricePaid * (decimal)remainingFullUnits / (decimal)totalUnits);

        Status = CampaignStatuses.Cancelled;
        CancelledAt = now;
        RefundedAmount = refund;

        return refund;
    }

    public void Expire(DateTimeOffset now)
    {
        if (Status != CampaignStatuses.Active)
            throw new InvalidCampaignTransitionException(Status, CampaignStatuses.Expired);
        if (now < EndAt)
            throw new InvalidCampaignTransitionException(Status, "EXPIRED (chưa tới hạn)");

        Status = CampaignStatuses.Expired;
    }
}

public sealed class PromotionArgumentException(string message) : PromotionDomainException(message);
