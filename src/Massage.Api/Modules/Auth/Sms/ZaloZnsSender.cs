using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Massage.Api.Modules.Auth.Sms;

/// <summary>
/// Gửi OTP qua Zalo ZNS (Zalo Notification Service).
///
/// Chọn ZNS thay SMS thường vì gần như mọi người dùng Việt Nam đều có Zalo, giá rẻ hơn
/// SMS brandname, và tin đến từ OA đã xác thực nên khó bị giả mạo hơn.
/// </summary>
public class ZaloZnsSender(
    IHttpClientFactory httpClientFactory,
    IZaloTokenStore tokenStore,
    IOptions<ZaloZnsOptions> options,
    ILogger<ZaloZnsSender> logger) : IOtpSender
{
    public const string HttpClientName = "zalo";

    private readonly ZaloZnsOptions _options = options.Value;

    public string Channel => "ZNS";

    /// <summary>Không bao giờ trả mã về client — đó là toàn bộ mục đích của việc gửi tin.</summary>
    public bool RevealsCode => false;

    /// <summary>
    /// ZNS nhận số dạng <c>84xxxxxxxxx</c>: không có dấu cộng, không có số 0 đầu.
    /// Hệ thống lưu dạng <c>0xxxxxxxxx</c> (xem <c>AuthService.NormalizePhone</c>) nên
    /// phải đổi ở đây. Gửi sai dạng thì ZNS trả lỗi tham số chứ không gửi tin — và lỗi
    /// đó đọc như lỗi quyền.
    /// </summary>
    public static string ToZaloPhone(string phone)
    {
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("84", StringComparison.Ordinal)) return digits;
        if (digits.StartsWith('0')) return "84" + digits[1..];
        return digits;
    }

    public async Task SendAsync(string phone, string code, int ttlSeconds, CancellationToken ct = default)
    {
        // Một lần thử lại, và **chỉ** khi lỗi là token hết hiệu lực. Access token có thể
        // bị thu hồi sớm hơn hạn ghi trong DB (đổi secret, gỡ quyền ứng dụng), nên hạn
        // còn xa không chứng minh được token còn dùng được.
        try
        {
            await PostAsync(phone, code, ttlSeconds, ct);
        }
        catch (ZaloAccessTokenRejectedException)
        {
            logger.LogWarning("Zalo từ chối access token trước hạn, làm mới rồi gửi lại một lần.");
            await tokenStore.InvalidateAsync(ct);
            await PostAsync(phone, code, ttlSeconds, ct);
        }
    }

    private async Task PostAsync(string phone, string code, int ttlSeconds, CancellationToken ct)
    {
        var accessToken = await tokenStore.GetAccessTokenAsync(ct);
        var client = httpClientFactory.CreateClient(HttpClientName);

        var templateData = new Dictionary<string, string> { [_options.CodeParamName] = code };
        if (!string.IsNullOrWhiteSpace(_options.ExpiryParamName))
            templateData[_options.ExpiryParamName] = Math.Max(1, ttlSeconds / 60).ToString();

        var payload = new Dictionary<string, object>
        {
            ["phone"] = ToZaloPhone(phone),
            ["template_id"] = _options.TemplateId,
            ["template_data"] = templateData,
            // Zalo dùng để chống gửi trùng. Mỗi lượt xin mã là một tin riêng nên id phải
            // mới mỗi lần — dùng lại một id là Zalo lặng lẽ bỏ tin thứ hai.
            ["tracking_id"] = Guid.NewGuid().ToString("N"),
        };

        using var request = new HttpRequestMessage(
            HttpMethod.Post, $"{_options.ApiBaseUrl.TrimEnd('/')}/message/template")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("access_token", accessToken);
        if (_options.DevMode) request.Headers.Add("mode", "development");

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new OtpDeliveryException("Không gọi được Zalo ZNS.", ex);
        }

        using (response)
        {
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
                throw new OtpDeliveryException($"Zalo ZNS trả HTTP {(int)response.StatusCode}.");

            // Điểm dễ sai nhất của API này: ZNS trả **HTTP 200** cho cả lượt thất bại,
            // và chỉ `error` trong body mới nói thật. Đọc status code là đủ để tin rằng
            // mọi tin đều gửi được, trong khi không tin nào tới nơi.
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;
            var error = root.TryGetProperty("error", out var e) ? e.GetInt32() : -1;

            if (error == 0)
            {
                logger.LogInformation("Đã gửi OTP qua ZNS tới {Phone}", MaskPhone(phone));
                return;
            }

            var message = root.TryGetProperty("message", out var m) ? m.GetString() : null;

            // -124 / -216: access token sai hoặc hết hiệu lực. Tách riêng để lượt gọi
            // ngoài biết đây là lỗi đáng thử lại, khác hẳn hết quota hay sai template.
            if (error is -124 or -216)
                throw new ZaloAccessTokenRejectedException($"Zalo từ chối access token ({error}): {message}");

            throw new OtpDeliveryException($"Zalo ZNS lỗi {error}: {message}");
        }
    }

    /// <summary>Che 4 số giữa: log đủ để lần ra sự cố mà không thành một danh sách số điện thoại.</summary>
    private static string MaskPhone(string phone) =>
        phone.Length <= 6 ? "***" : phone[..3] + "****" + phone[^3..];
}

/// <summary>
/// Zalo từ chối access token. Không phải <see cref="OtpDeliveryException"/> vì đây là
/// lỗi tự chữa được: làm mới token rồi gửi lại.
/// </summary>
public class ZaloAccessTokenRejectedException(string message) : Exception(message);
