using Hangfire;
using Massage.Api.Modules.Wallets;

namespace Massage.Api.Modules.Jobs;

/// <summary>
/// Điểm vào của các job định kỳ. Cố ý **rất mỏng**: mỗi phương thức chỉ gọi đúng một
/// việc đã có ở <see cref="WalletMaintenance"/> rồi ghi lại kết quả.
///
/// Nghiệp vụ không nằm ở đây, và đó là chủ ý. Lệnh CLI <c>maintenance</c> vẫn gọi cùng
/// những phương thức đó, nên chạy tay và chạy theo lịch không bao giờ làm hai việc khác
/// nhau — nếu copy logic sang đây thì hai đường sẽ trôi khỏi nhau đúng vào lúc cần
/// chúng khớp nhất: khi phải chạy tay để chữa sự cố mà job tự động đang hỏng.
/// </summary>
public class MaintenanceJobs(WalletMaintenance maintenance, ILogger<MaintenanceJobs> logger)
{
    /// <summary>Tên job dùng cho cả lịch lẫn log — gõ tay ở hai chỗ là cách tạo job mồ côi.</summary>
    public const string HoldCleanup = "hold:cleanup";
    public const string PromotionExpireSweep = "promotion:expire-sweep";
    public const string WalletReconcile = "wallet:reconcile";

    /// <summary>
    /// Nhả tiền của hold quá hạn (cron 5 phút).
    ///
    /// <see cref="DisableConcurrentExecutionAttribute"/> là bắt buộc chứ không phải
    /// đề phòng: job này lặp qua từng hold và mở transaction riêng cho mỗi cái, nên hai
    /// lượt chồng nhau sẽ cùng đọc một hold còn ACTIVE rồi cùng nhả. Khoá ví ở tầng dưới
    /// chặn được hỏng dữ liệu, nhưng lượt thứ hai vẫn ghi một dòng log cảnh báo cho một
    /// hold đã xử lý xong — nhiễu đúng ở chỗ cần đọc kỹ nhất khi có sự cố.
    ///
    /// Timeout 10 phút: dài hơn nhiều so với thời gian chạy thật (batch 500 hold), nhưng
    /// đủ ngắn để một lượt treo không chặn vĩnh viễn mọi lượt sau.
    /// </summary>
    [DisableConcurrentExecution(timeoutInSeconds: 600)]
    [AutomaticRetry(Attempts = 3)]
    public async Task ReleaseExpiredHoldsAsync(CancellationToken ct)
    {
        var released = await maintenance.ReleaseExpiredHoldsAsync(ct);

        // Chỉ ghi log khi có việc thật. Job chạy 288 lần/ngày, mà gần như lần nào cũng
        // không có gì để nhả — ghi hết thì log biến thành thứ không ai đọc, và dòng
        // quan trọng chìm giữa hàng trăm dòng "đã làm gì đâu".
        if (released > 0)
            logger.LogInformation("[{Job}] đã nhả {Count} hold quá hạn", HoldCleanup, released);
    }

    /// <summary>
    /// Lưới an toàn đóng campaign đã hết hạn (cron 1 phút).
    ///
    /// Roadmap gọi đây là "sweep" vì đường chính đáng lẽ là một job delayed đặt đúng vào
    /// <c>end_at</c>. Ở trạng thái hiện tại chưa cần job delayed đó: search đọc thẳng
    /// Postgres và tự lọc theo <c>now()</c>, nên campaign hết hạn **thôi được tính boost
    /// ngay lập tức** dù bảng chưa kịp đổi trạng thái. Sweep lo phần dọn trạng thái và
    /// trả slot về kho — chậm tối đa một phút là chấp nhận được.
    ///
    /// Điều này sẽ **hết đúng** khi đường đọc chuyển sang Redis: lúc đó trạng thái trong
    /// cache mới là thứ quyết định, và một phút trễ thành một phút bán sai.
    /// </summary>
    [DisableConcurrentExecution(timeoutInSeconds: 300)]
    [AutomaticRetry(Attempts = 3)]
    public async Task ExpireCampaignsAsync(CancellationToken ct)
    {
        var expired = await maintenance.ExpireCampaignsAsync(ct);

        if (expired > 0)
            logger.LogInformation(
                "[{Job}] đã đóng {Count} campaign hết hạn", PromotionExpireSweep, expired);
    }

    /// <summary>
    /// Đối soát ví hằng đêm: tổng sổ cái phải khớp số dư đang lưu.
    ///
    /// <b>Ném lỗi khi phát hiện lệch</b>, không chỉ ghi log. Hangfire sẽ đánh job này là
    /// Failed và giữ nó trong dashboard — một dòng log Error trôi qua lúc 3 giờ sáng thì
    /// không ai thấy, còn một job đỏ nằm đó thì có. Đây cũng là cùng một lựa chọn với
    /// lệnh CLI: nó thoát khác 0 khi ví lệch, thay vì chỉ in ra rồi trả về 0.
    ///
    /// Không retry: lệch sổ không phải lỗi tạm thời, chạy lại ba lần chỉ tạo ba lần đỏ
    /// cho cùng một sự việc và làm mờ mất thời điểm nó bắt đầu.
    /// </summary>
    [DisableConcurrentExecution(timeoutInSeconds: 1800)]
    [AutomaticRetry(Attempts = 0)]
    public async Task ReconcileWalletsAsync(CancellationToken ct)
    {
        var drifting = await maintenance.ReconcileAsync(ct);

        if (drifting > 0)
        {
            throw new InvalidOperationException(
                $"Đối soát ví: {drifting} ví lệch sổ. Chi tiết từng ví đã ghi ở log mức Error. " +
                "Không tự sửa — cần người xem lại đường ghi số dư nào không đi qua sổ cái.");
        }

        logger.LogInformation("[{Job}] đối soát ví: không có sai lệch", WalletReconcile);
    }
}
