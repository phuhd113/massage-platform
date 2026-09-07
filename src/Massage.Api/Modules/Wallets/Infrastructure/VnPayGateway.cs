using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;

namespace Massage.Api.Modules.Wallets.Infrastructure;

public class VnPayOptions
{
    public const string Section = "VnPay";

    public string TmnCode { get; set; } = "";
    public string HashSecret { get; set; } = "";
    public string PaymentUrl { get; set; } = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

    /// <summary>
    /// Nơi cổng trả trình duyệt về sau khi thanh toán. Tiếng Việt **không có prefix
    /// locale** (xem middleware i18n), nên đường dẫn đúng là `/nap-tien/ket-qua`
    /// chứ không phải `/vi/...` — bản có prefix trả 404, và trả đúng vào mặt KTV
    /// ngay sau khi họ vừa trả tiền xong.
    /// </summary>
    public string ReturnUrl { get; set; } = "http://localhost:3000/nap-tien/ket-qua";
}

public sealed record PaymentSession(string ProviderRef, string RedirectUrl);

/// <summary>
/// Kết quả cổng gửi về qua IPN, đã kiểm chữ ký.
/// </summary>
/// <param name="ProviderTxnId">
/// Mã giao dịch của cổng. Đây chính là khoá chống lặp khi ghi bút toán nạp tiền —
/// cổng sẽ gọi lại nhiều lần khi nó không nhận được 200 kịp thời.
/// </param>
public sealed record PaymentCallback(
    string ProviderRef, string ProviderTxnId, decimal Amount, bool Succeeded);

public interface IPaymentGateway
{
    string Provider { get; }
    PaymentSession CreateSession(string providerRef, decimal amount, string clientIp);

    /// <summary>
    /// Kiểm chữ ký rồi đọc kết quả. Trả <c>null</c> khi chữ ký sai.
    ///
    /// Chữ ký là thứ duy nhất phân biệt lời gọi thật của cổng với một request bất
    /// kỳ từ internet — endpoint IPN buộc phải công khai, nên bỏ bước này đồng
    /// nghĩa với việc ai cũng nạp tiền vào ví mình được.
    /// </summary>
    PaymentCallback? VerifyCallback(IReadOnlyDictionary<string, string> query);
}

/// <summary>
/// Adapter VNPay.
///
/// Chỉ có một cổng ở Phase 2 là cố ý: adapter thứ hai rẻ, adapter đầu tiên đắt vì
/// phải dựng cả luồng intent → redirect → IPN → đối soát. Thêm Momo/ZaloPay sau
/// chỉ là thêm một hiện thực của <see cref="IPaymentGateway"/>.
/// </summary>
public class VnPayGateway(IOptions<VnPayOptions> options) : IPaymentGateway
{
    private readonly VnPayOptions _opt = options.Value;

    public string Provider => "VNPAY";

    public PaymentSession CreateSession(string providerRef, decimal amount, string clientIp)
    {
        if (string.IsNullOrWhiteSpace(_opt.TmnCode) || string.IsNullOrWhiteSpace(_opt.HashSecret))
        {
            // Fail fast và nói rõ chỗ cần cấu hình, thay vì dựng một URL thanh toán
            // hỏng rồi để KTV phát hiện ở màn hình cổng.
            throw new InvalidOperationException(
                "Chưa cấu hình VnPay:TmnCode và VnPay:HashSecret — không thể tạo phiên thanh toán.");
        }

        // Giờ Việt Nam, không phải giờ máy chủ: cổng đọc hai mốc dưới đây theo GMT+7
        // và container chạy UTC.
        var now = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));

        var fields = new SortedDictionary<string, string>(StringComparer.Ordinal)
        {
            ["vnp_Version"] = "2.1.0",
            ["vnp_Command"] = "pay",
            ["vnp_TmnCode"] = _opt.TmnCode,
            // VNPay tính tiền theo đơn vị nhỏ nhất, tức nhân 100. Làm tròn tường minh
            // thay vì ép kiểu: `(long)` cắt cụt phần lẻ, nên một số tiền lỡ mang sai
            // số dấu phẩy động sẽ **thu nhỏ** khoản khách phải trả và lệch luôn với
            // số đã ghi ở phiên — IPN sau đó từ chối vì lệch tiền, và khách đã trả rồi.
            ["vnp_Amount"] = ((long)decimal.Round(amount * 100, 0, MidpointRounding.AwayFromZero))
                .ToString(CultureInfo.InvariantCulture),
            ["vnp_CurrCode"] = "VND",
            ["vnp_TxnRef"] = providerRef,
            ["vnp_OrderInfo"] = $"Nap tien vi {providerRef}",
            ["vnp_OrderType"] = "other",
            ["vnp_Locale"] = "vn",
            ["vnp_ReturnUrl"] = _opt.ReturnUrl,
            ["vnp_IpAddr"] = clientIp,
            ["vnp_CreateDate"] = now.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture),
            // Bắt buộc theo đặc tả 2.1.0. Thiếu nó thì phiên thanh toán không có hạn
            // và một link nạp tiền cũ vẫn trả được nhiều ngày sau, trong khi KTV đã
            // quên hẳn — 15 phút đủ cho một lượt chuyển khoản qua ngân hàng.
            ["vnp_ExpireDate"] = now.AddMinutes(15)
                .ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture),
        };

        var data = BuildQuery(fields);
        var signature = Sign(data);

        return new PaymentSession(providerRef, $"{_opt.PaymentUrl}?{data}&vnp_SecureHash={signature}");
    }

    public PaymentCallback? VerifyCallback(IReadOnlyDictionary<string, string> query)
    {
        if (!query.TryGetValue("vnp_SecureHash", out var received)) return null;

        var signed = new SortedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var (key, value) in query)
        {
            // Hai trường chữ ký không nằm trong dữ liệu được ký.
            if (key is "vnp_SecureHash" or "vnp_SecureHashType") continue;
            if (!string.IsNullOrEmpty(value)) signed[key] = value;
        }

        var expected = Sign(BuildQuery(signed));

        // So sánh theo thời gian hằng: so sánh chuỗi thường thoát sớm ở ký tự khác
        // nhau đầu tiên và làm lộ dần chữ ký đúng qua thời gian phản hồi.
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(expected.ToLowerInvariant()),
                Encoding.ASCII.GetBytes(received.ToLowerInvariant())))
        {
            return null;
        }

        if (!signed.TryGetValue("vnp_TxnRef", out var providerRef)) return null;
        if (!signed.TryGetValue("vnp_Amount", out var rawAmount)) return null;
        if (!long.TryParse(rawAmount, NumberStyles.Integer, CultureInfo.InvariantCulture, out var amount))
            return null;

        var txnId = signed.GetValueOrDefault("vnp_TransactionNo", providerRef);
        var succeeded = signed.GetValueOrDefault("vnp_ResponseCode") == "00"
                        && signed.GetValueOrDefault("vnp_TransactionStatus") == "00";

        return new PaymentCallback(providerRef, txnId, amount / 100m, succeeded);
    }

    private static string BuildQuery(SortedDictionary<string, string> fields) =>
        string.Join('&', fields.Select(kv => $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

    private string Sign(string data)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(_opt.HashSecret));
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(data))).ToLowerInvariant();
    }
}
