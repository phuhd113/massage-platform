using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Massage.Api.Common.Notifications;

/// <summary>
/// Gửi email qua Resend (API HTTP). Chọn API thay vì SMTP vì VPS thường chặn port
/// outbound 25/587 và việc đó hỏng **im lặng** — kết nối treo tới lúc timeout, đọc như
/// lỗi cấu hình chứ không như lỗi mạng.
/// </summary>
public class ResendEmailSender(
    IHttpClientFactory httpClientFactory,
    IOptions<ResendOptions> resend,
    IOptions<NotificationOptions> notifications,
    ILogger<ResendEmailSender> logger) : IEmailSender
{
    public const string HttpClientName = "resend";

    private readonly ResendOptions _resend = resend.Value;
    private readonly NotificationOptions _notifications = notifications.Value;

    public bool IsRealDelivery => true;

    public async Task SendAsync(
        IReadOnlyList<string> to, string subject, string body, CancellationToken ct = default)
    {
        if (to.Count == 0) return;

        var client = httpClientFactory.CreateClient(HttpClientName);

        var payload = new Dictionary<string, object>
        {
            ["from"] = $"{_notifications.FromName} <{_notifications.FromEmail}>",
            ["to"] = to,
            ["subject"] = subject,
            ["text"] = body,
        };

        // Header đặt trên **request**, không trên `client.DefaultRequestHeaders`:
        // `IHttpClientFactory` tái sử dụng handler và message handler chain giữa các lượt
        // gọi, nên gán vào DefaultRequestHeaders là tích luỹ thêm một header mỗi lần gửi.
        using var request = new HttpRequestMessage(
            HttpMethod.Post, $"{_resend.ApiBaseUrl.TrimEnd('/')}/emails")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _resend.ApiKey);

        using var response = await client.SendAsync(request, ct);

        var raw = await response.Content.ReadAsStringAsync(ct);

        // Log **nguyên văn body**, không chỉ status code: "domain chưa verify" và "API key
        // sai" đều là 4xx và chỉ phân biệt được bằng câu chữ trong thân. Đây là thứ duy nhất
        // nói được nguyên nhân khi lượt gửi hỏng trên production.
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Resend từ chối lượt gửi (HTTP {(int)response.StatusCode}): {Truncate(raw)}");

        string? id = null;
        try
        {
            using var doc = JsonDocument.Parse(raw);
            if (doc.RootElement.TryGetProperty("id", out var idProp))
                id = idProp.GetString();

            // Phòng xa cho thân 200 mang `error`. Chưa quan sát thấy Resend làm vậy, nhưng
            // đó là dạng lỗi đắt nhất — mọi thứ trông như đã gửi trong khi không email nào
            // tới nơi — và `ZaloZnsSender` đã cắn đúng hình dạng đó (ZNS trả HTTP 200 cho
            // cả lượt thất bại). Một nhánh `if` là cái giá rẻ để không phải phát hiện lại.
            if (doc.RootElement.TryGetProperty("error", out var err)
                && err.ValueKind is not JsonValueKind.Null)
                throw new InvalidOperationException($"Resend trả lỗi trong thân 200: {Truncate(raw)}");
        }
        catch (JsonException)
        {
            // Thân không phải JSON nhưng status 2xx: coi như đã gửi. Ném ở đây sẽ biến một
            // lượt gửi có thể đã thành công thành một dòng log lỗi gây hiểu nhầm.
            logger.LogWarning("Resend trả 2xx với thân không phải JSON: {Body}", Truncate(raw));
        }

        logger.LogInformation(
            "Đã gửi email tới {Count} người nhận qua Resend (id {Id}): {Subject}",
            to.Count, id ?? "?", subject);
    }

    private static string Truncate(string s) => s.Length <= 500 ? s : s[..500] + "…";
}
