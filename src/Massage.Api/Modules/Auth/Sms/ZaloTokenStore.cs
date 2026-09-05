using System.Text.Json;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Massage.Api.Modules.Auth.Sms;

public interface IZaloTokenStore
{
    /// <summary>Access token còn hạn, tự refresh khi cần.</summary>
    Task<string> GetAccessTokenAsync(CancellationToken ct = default);

    /// <summary>Đánh dấu access token hiện tại không dùng được, buộc lượt sau refresh.</summary>
    Task InvalidateAsync(CancellationToken ct = default);
}

/// <summary>
/// Giữ và xoay cặp token OAuth của Zalo.
///
/// Ba điều bắt buộc đúng ở đây, và cả ba đều hỏng im lặng nếu làm sai:
///
/// 1. <b>Refresh token phải ghi xuống DB trong cùng lượt refresh.</b> Zalo vô hiệu hoá
///    bản cũ ngay khi cấp bản mới. Đánh rơi bản mới là OA chết cho tới khi có người vào
///    Zalo lấy tay token khác — và nó chết ở đúng lúc không ai đang nhìn.
/// 2. <b>Chỉ một lượt refresh tại một thời điểm.</b> Hai request cùng thấy token hết hạn
///    sẽ cùng gọi refresh với cùng một refresh token; lượt thứ hai nhận lỗi và, tệ hơn,
///    có thể ghi đè bản vừa lấy được bằng bản đã chết.
/// 3. <b>Làm mới sớm hơn hạn thật.</b> Token hết hạn giữa lúc đang gửi thì tin không đi,
///    và người dùng chỉ thấy "không gửi được mã".
/// </summary>
public class ZaloTokenStore(
    IServiceScopeFactory scopeFactory,
    IHttpClientFactory httpClientFactory,
    IOptions<ZaloZnsOptions> options,
    ILogger<ZaloTokenStore> logger) : IZaloTokenStore
{
    private readonly ZaloZnsOptions _options = options.Value;

    // Refresh nối tiếp trong process: hai request cùng thấy token hết hạn sẽ cùng gọi
    // refresh với cùng một refresh token, và Zalo chỉ chấp nhận lượt đầu.
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    // Làm mới trước hạn 5 phút. Ngắn hơn thì một lượt gửi bắt đầu ngay trước mốc hết
    // hạn có thể hoàn tất sau nó.
    private static readonly TimeSpan RefreshSkew = TimeSpan.FromMinutes(5);

    public async Task<string> GetAccessTokenAsync(CancellationToken ct = default)
    {
        var current = await LoadAsync(ct);
        if (current is not null && current.ExpiresAt - RefreshSkew > DateTimeOffset.UtcNow)
            return current.AccessToken;

        await _refreshLock.WaitAsync(ct);
        try
        {
            // Đọc lại sau khi giành được khoá: một lượt khác có thể vừa refresh xong
            // trong lúc mình đang chờ, và refresh lần nữa sẽ giết token họ vừa lấy.
            current = await LoadAsync(ct);
            if (current is not null && current.ExpiresAt - RefreshSkew > DateTimeOffset.UtcNow)
                return current.AccessToken;

            // Hạt giống từ cấu hình chỉ dùng cho lần chạy đầu tiên. Từ lượt refresh đầu
            // tiên trở đi, DB là nguồn duy nhất — bản trong cấu hình đã bị Zalo vô hiệu.
            var refreshToken = current?.RefreshToken;
            if (string.IsNullOrWhiteSpace(refreshToken)) refreshToken = _options.RefreshToken;

            if (string.IsNullOrWhiteSpace(refreshToken))
                throw new OtpDeliveryException(
                    "Chưa có Zalo:Zns:RefreshToken. Lấy refresh token từ luồng OAuth của Zalo và đặt vào cấu hình.");

            return await RefreshAsync(refreshToken, ct);
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    public async Task InvalidateAsync(CancellationToken ct = default)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        // Chỉ đẩy hạn về quá khứ, **không** xoá hàng: refresh token trong hàng đó là thứ
        // duy nhất còn dùng được. Xoá đi là tự khoá mình ra ngoài.
        await db.ZaloTokens
            .Where(t => t.AppId == _options.AppId)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)), ct);
    }

    private async Task<ZaloToken?> LoadAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.ZaloTokens.AsNoTracking()
            .FirstOrDefaultAsync(t => t.AppId == _options.AppId, ct);
    }

    private async Task<string> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var client = httpClientFactory.CreateClient(ZaloZnsSender.HttpClientName);

        using var request = new HttpRequestMessage(
            HttpMethod.Post, $"{_options.OauthBaseUrl.TrimEnd('/')}/v4/oa/access_token")
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["refresh_token"] = refreshToken,
                ["app_id"] = _options.AppId,
                ["grant_type"] = "refresh_token",
            }),
        };
        // Zalo nhận secret qua header, không phải trong body.
        request.Headers.Add("secret_key", _options.SecretKey);

        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            throw new OtpDeliveryException("Không gọi được Zalo OAuth để làm mới token.", ex);
        }

        using (response)
        {
            var body = await response.Content.ReadAsStringAsync(ct);

            if (!response.IsSuccessStatusCode)
                throw new OtpDeliveryException(
                    $"Zalo OAuth trả {(int)response.StatusCode}. Refresh token có thể đã hết hạn (Zalo cấp hạn 3 tháng).");

            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            // Zalo trả HTTP 200 kèm `error` khác 0 khi thất bại — đọc status code là không
            // đủ, và bỏ qua nhánh này sẽ ghi chuỗi rỗng làm access token rồi hỏng ở lượt gửi.
            if (!root.TryGetProperty("access_token", out var accessEl))
            {
                var message = root.TryGetProperty("error_name", out var e) ? e.GetString() : body;
                throw new OtpDeliveryException($"Zalo OAuth từ chối làm mới token: {message}");
            }

            var accessToken = accessEl.GetString() ?? "";
            var newRefresh = root.TryGetProperty("refresh_token", out var r) ? r.GetString() : null;
            var expiresIn = root.TryGetProperty("expires_in", out var x)
                ? (x.ValueKind == JsonValueKind.String ? int.Parse(x.GetString()!) : x.GetInt32())
                : 3600;

            await PersistAsync(accessToken, newRefresh ?? refreshToken, expiresIn, ct);

            logger.LogInformation(
                "Đã làm mới access token Zalo, hạn {ExpiresIn}s, refresh token {Rotated}",
                expiresIn, newRefresh is null ? "giữ nguyên" : "đã xoay");

            return accessToken;
        }
    }

    private async Task PersistAsync(string accessToken, string refreshToken, int expiresIn, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTimeOffset.UtcNow;
        var row = await db.ZaloTokens.FirstOrDefaultAsync(t => t.AppId == _options.AppId, ct);

        if (row is null)
        {
            db.ZaloTokens.Add(new ZaloToken
            {
                AppId = _options.AppId,
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                ExpiresAt = now.AddSeconds(expiresIn),
                UpdatedAt = now,
            });
        }
        else
        {
            row.AccessToken = accessToken;
            row.RefreshToken = refreshToken;
            row.ExpiresAt = now.AddSeconds(expiresIn);
            row.UpdatedAt = now;
        }

        await db.SaveChangesAsync(ct);
    }
}
