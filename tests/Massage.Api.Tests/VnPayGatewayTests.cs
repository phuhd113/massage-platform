using FluentAssertions;
using Massage.Api.Modules.Wallets.Infrastructure;
using Microsoft.Extensions.Options;

namespace Massage.Api.Tests;

/// <summary>
/// Chữ ký là thứ <b>duy nhất</b> phân biệt lời gọi thật của cổng thanh toán với
/// một request bất kỳ từ internet — endpoint IPN buộc phải công khai. Bỏ hoặc làm
/// hỏng bước kiểm này đồng nghĩa với việc ai cũng tự nạp tiền vào ví mình được,
/// nên nó cần test riêng chứ không thể chỉ đọc code.
///
/// Không cần database.
/// </summary>
public class VnPayGatewayTests
{
    private const string Secret = "test-hash-secret-not-a-real-one";

    private static VnPayGateway Gateway() => new(Options.Create(new VnPayOptions
    {
        TmnCode = "TESTSHOP",
        HashSecret = Secret,
        PaymentUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
        ReturnUrl = "http://localhost:3000/nap-tien/ket-qua",
    }));

    /// <summary>Dựng một callback hợp lệ bằng chính thuật toán ký của adapter.</summary>
    private static Dictionary<string, string> SignedCallback(
        string txnRef = "ref-123", string amountX100 = "50000000",
        string responseCode = "00", string txnStatus = "00")
    {
        var fields = new Dictionary<string, string>
        {
            ["vnp_Amount"] = amountX100,
            ["vnp_BankCode"] = "NCB",
            ["vnp_ResponseCode"] = responseCode,
            ["vnp_TmnCode"] = "TESTSHOP",
            ["vnp_TransactionNo"] = "14000001",
            ["vnp_TransactionStatus"] = txnStatus,
            ["vnp_TxnRef"] = txnRef,
        };

        var sorted = new SortedDictionary<string, string>(fields, StringComparer.Ordinal);
        var data = string.Join('&', sorted.Select(kv =>
            $"{Uri.EscapeDataString(kv.Key)}={Uri.EscapeDataString(kv.Value)}"));

        using var hmac = new System.Security.Cryptography.HMACSHA512(
            System.Text.Encoding.UTF8.GetBytes(Secret));
        fields["vnp_SecureHash"] = Convert.ToHexString(
            hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(data))).ToLowerInvariant();

        return fields;
    }

    [Fact]
    public void Callback_đúng_chữ_ký_được_chấp_nhận()
    {
        var result = Gateway().VerifyCallback(SignedCallback());

        result.Should().NotBeNull();
        result!.ProviderRef.Should().Be("ref-123");
        result.ProviderTxnId.Should().Be("14000001");
        // VNPay tính tiền theo đơn vị nhỏ nhất nên phải chia 100 khi đọc về.
        result.Amount.Should().Be(500_000);
        result.Succeeded.Should().BeTrue();
    }

    [Fact]
    public void Sửa_số_tiền_sau_khi_ký_thì_bị_từ_chối()
    {
        var tampered = SignedCallback();
        tampered["vnp_Amount"] = "999900000";

        // Đây là kịch bản tấn công trực tiếp nhất: đổi số tiền trong URL callback.
        Gateway().VerifyCallback(tampered).Should().BeNull();
    }

    [Fact]
    public void Thiếu_chữ_ký_thì_bị_từ_chối()
    {
        var noHash = SignedCallback();
        noHash.Remove("vnp_SecureHash");

        Gateway().VerifyCallback(noHash).Should().BeNull();
    }

    [Fact]
    public void Chữ_ký_ký_bằng_secret_khác_bị_từ_chối()
    {
        var other = new VnPayGateway(Options.Create(new VnPayOptions
        {
            TmnCode = "TESTSHOP",
            HashSecret = "một-secret-hoàn-toàn-khác",
        }));

        other.VerifyCallback(SignedCallback()).Should().BeNull();
    }

    [Theory]
    [InlineData("24", "00")]  // khách huỷ giao dịch
    [InlineData("00", "02")]  // ngân hàng từ chối
    public void Giao_dịch_thất_bại_vẫn_hợp_lệ_nhưng_không_được_cộng_tiền(
        string responseCode, string txnStatus)
    {
        var result = Gateway().VerifyCallback(SignedCallback(
            responseCode: responseCode, txnStatus: txnStatus));

        // Chữ ký đúng nên vẫn đọc được — nhưng Succeeded=false, và use case sẽ đánh
        // dấu phiên FAILED thay vì cộng tiền.
        result.Should().NotBeNull();
        result!.Succeeded.Should().BeFalse();
    }

    [Fact]
    public void Chưa_cấu_hình_secret_thì_báo_lỗi_rõ_ràng_ngay_khi_tạo_phiên()
    {
        var unconfigured = new VnPayGateway(Options.Create(new VnPayOptions()));

        // Fail fast và nói rõ chỗ cần cấu hình, thay vì dựng một URL thanh toán
        // hỏng rồi để KTV phát hiện ở màn hình cổng.
        FluentActions.Invoking(() => unconfigured.CreateSession("ref-1", 500_000, "127.0.0.1"))
            .Should().Throw<InvalidOperationException>()
            .WithMessage("*VnPay:TmnCode*");
    }

    [Fact]
    public void URL_thanh_toán_mang_đủ_tham_số_bắt_buộc_và_chữ_ký()
    {
        var session = Gateway().CreateSession("ref-abc", 500_000, "127.0.0.1");

        session.RedirectUrl.Should().StartWith("https://sandbox.vnpayment.vn/");
        session.RedirectUrl.Should().Contain("vnp_TxnRef=ref-abc");
        session.RedirectUrl.Should().Contain("vnp_Amount=50000000");
        session.RedirectUrl.Should().Contain("vnp_SecureHash=");
    }

    /// <summary>
    /// `vnp_ExpireDate` là trường bắt buộc của đặc tả 2.1.0. Thiếu nó, cổng có thể
    /// từ chối thẳng phiên thanh toán — và lỗi đó chỉ lộ ra ở môi trường thật, vì
    /// mọi test tự ký đều không quan tâm trường nào có mặt.
    /// </summary>
    [Fact]
    public void URL_thanh_toán_có_hạn_dùng_và_hạn_nằm_sau_thời_điểm_tạo()
    {
        var session = Gateway().CreateSession("ref-abc", 500_000, "127.0.0.1");

        var query = System.Web.HttpUtility.ParseQueryString(
            session.RedirectUrl[(session.RedirectUrl.IndexOf('?') + 1)..]);

        var created = query["vnp_CreateDate"];
        var expires = query["vnp_ExpireDate"];

        created.Should().NotBeNull();
        expires.Should().NotBeNull();

        // Cùng định dạng yyyyMMddHHmmss nên so sánh chuỗi là so sánh thời gian.
        expires.Should().NotBe(created);
        string.CompareOrdinal(expires, created).Should().BePositive(
            "hạn thanh toán phải nằm sau thời điểm tạo phiên");
    }

    /// <summary>
    /// Ép kiểu `(long)` cắt cụt phần lẻ thay vì làm tròn. Với một số tiền lỡ mang
    /// sai số dấu phẩy động, bản cắt cụt **thu nhỏ** khoản gửi sang cổng và lệch
    /// luôn với số đã ghi ở phiên — IPN sau đó từ chối vì lệch tiền, trong khi
    /// khách thì đã trả rồi.
    /// </summary>
    [Fact]
    public void Số_tiền_gửi_sang_cổng_được_làm_tròn_chứ_không_bị_cắt_cụt()
    {
        // 123456.99 * 100 = 12345698.999... trong dấu phẩy động; cắt cụt ra 12345698.
        var session = Gateway().CreateSession("ref-abc", 123_456.99m, "127.0.0.1");

        session.RedirectUrl.Should().Contain("vnp_Amount=12345699");
    }

    /// <summary>
    /// Khép vòng ký → verify bằng chính URL adapter dựng ra, thay vì bằng payload
    /// do test tự ký. Các test khác dùng chung thuật toán ký của adapter nên chúng
    /// vẫn xanh kể cả khi quy ước ký sai với VNPay thật; test này ít nhất bắt được
    /// trường hợp hai chiều của adapter lệch nhau.
    /// </summary>
    [Fact]
    public void Chữ_ký_do_adapter_dựng_được_chính_adapter_chấp_nhận()
    {
        var gateway = Gateway();
        var session = gateway.CreateSession("ref-roundtrip", 500_000, "127.0.0.1");

        var parsed = System.Web.HttpUtility.ParseQueryString(
            session.RedirectUrl[(session.RedirectUrl.IndexOf('?') + 1)..]);

        var query = parsed.AllKeys
            .Where(k => k is not null)
            .ToDictionary(k => k!, k => parsed[k]!);

        // Cổng trả về thêm các trường kết quả; giữ nguyên phần đã ký và bổ sung
        // chúng sẽ đổi chữ ký, nên ở đây chỉ kiểm đúng phần adapter tự dựng.
        gateway.VerifyCallback(query).Should().NotBeNull(
            "chữ ký adapter tự dựng phải qua được chính bước kiểm của nó");
    }
}
