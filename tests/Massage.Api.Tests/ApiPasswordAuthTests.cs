using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;

namespace Massage.Api.Tests;

/// <summary>
/// Tầng HTTP cho đường đăng nhập bằng mật khẩu: mã trạng thái, quyền, và việc
/// response không phân biệt được nguyên nhân đăng nhập hỏng.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiPasswordAuthTests(PostgresFixture fixture)
{
    private readonly ApiFactory _api = new(fixture.ConnectionString, fixture.DataSource);

    private const string GoodPassword = "matkhau-du-dai";

    private sealed record Tokens(string AccessToken, TokenUser User);
    private sealed record TokenUser(Guid Id, string Phone, string Role);

    [Fact]
    public async Task Đăng_ký_trả_token_dùng_được_ngay()
    {
        var client = _api.CreateClient();
        var phone = ApiClient.UniquePhone();

        var res = await client.PostAsJsonAsync("/api/v1/auth/register",
            new { phone, password = GoodPassword, role = "CUSTOMER" });

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());
        var tokens = await res.Content.ReadFromJsonAsync<Tokens>();

        // Token phải mở được endpoint [Authorize] ngay, không cần thêm bước nào:
        // đăng ký xong mà còn phải đăng nhập lại là bắt người dùng gõ mật khẩu hai lần.
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", tokens!.AccessToken);
        var me = await client.GetAsync("/api/v1/auth/me");

        me.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Đăng_ký_rồi_đăng_nhập_lại_bằng_mật_khẩu()
    {
        var client = _api.CreateClient();
        var phone = ApiClient.UniquePhone();

        await client.PostAsJsonAsync("/api/v1/auth/register",
            new { phone, password = GoodPassword, role = "KTV" });

        var res = await client.PostAsJsonAsync("/api/v1/auth/login", new { phone, password = GoodPassword });

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());
        var tokens = await res.Content.ReadFromJsonAsync<Tokens>();
        tokens!.User.Role.Should().Be("KTV");
    }

    [Fact]
    public async Task Đăng_ký_trùng_số_trả_409()
    {
        var client = _api.CreateClient();
        var phone = ApiClient.UniquePhone();

        await client.PostAsJsonAsync("/api/v1/auth/register", new { phone, password = GoodPassword });
        var res = await client.PostAsJsonAsync("/api/v1/auth/register",
            new { phone, password = "mat-khau-khac-han" });

        // 409 chứ không phải 400: frontend map theo status để hiện đúng câu "số này
        // đã có tài khoản, mời đăng nhập" thay vì "dữ liệu không hợp lệ".
        res.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Sai_mật_khẩu_và_số_chưa_đăng_ký_trả_về_response_giống_hệt_nhau()
    {
        var client = _api.CreateClient();
        var phone = ApiClient.UniquePhone();
        await client.PostAsJsonAsync("/api/v1/auth/register", new { phone, password = GoodPassword });

        var saiMatKhau = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { phone, password = "sai-mat-khau-roi" });
        var chuaDangKy = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { phone = ApiClient.UniquePhone(), password = GoodPassword });

        saiMatKhau.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        chuaDangKy.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // Cả body cũng phải giống: khác một chữ là đủ để dò xem số nào đã có tài khoản.
        (await chuaDangKy.Content.ReadAsStringAsync())
            .Should().Be(await saiMatKhau.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Mật_khẩu_quá_ngắn_bị_từ_chối_khi_đăng_ký()
    {
        var client = _api.CreateClient();

        var res = await client.PostAsJsonAsync("/api/v1/auth/register",
            new { phone = ApiClient.UniquePhone(), password = "ngan" });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Không_ai_tự_phong_được_quyền_admin_khi_đăng_ký_bằng_mật_khẩu()
    {
        // Đối xứng với test cùng tên ở đường OTP: đây là đường thứ hai tạo được tài
        // khoản, nên nó phải chặn ADMIN y hệt đường thứ nhất.
        var client = _api.CreateClient();

        var res = await client.PostAsJsonAsync("/api/v1/auth/register",
            new { phone = ApiClient.UniquePhone(), password = GoodPassword, role = "ADMIN" });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Đổi_mật_khẩu_khi_chưa_đăng_nhập_trả_401()
    {
        var client = _api.CreateClient();

        var res = await client.PatchAsJsonAsync("/api/v1/auth/password",
            new { currentPassword = GoodPassword, newPassword = "mat-khau-moi-123" });

        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Đổi_mật_khẩu_rồi_đăng_nhập_bằng_mật_khẩu_mới()
    {
        var client = _api.CreateClient();
        var phone = ApiClient.UniquePhone();

        var registered = await client.PostAsJsonAsync("/api/v1/auth/register",
            new { phone, password = GoodPassword });
        var tokens = await registered.Content.ReadFromJsonAsync<Tokens>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", tokens!.AccessToken);

        var changed = await client.PatchAsJsonAsync("/api/v1/auth/password",
            new { currentPassword = GoodPassword, newPassword = "mat-khau-moi-123" });
        changed.StatusCode.Should().Be(HttpStatusCode.NoContent, _api.ErrorsOrEmpty());

        var anon = _api.CreateClient();
        var login = await anon.PostAsJsonAsync("/api/v1/auth/login",
            new { phone, password = "mat-khau-moi-123" });

        login.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Tài_khoản_tạo_bằng_OTP_có_hasPassword_false()
    {
        // Trang tài khoản dùng cờ này để quyết định có hỏi mật khẩu hiện tại không.
        var (client, _, _) = await _api.LoginAsync("CUSTOMER");

        var me = await client.GetFromJsonAsync<MeDto>("/api/v1/auth/me");

        me!.HasPassword.Should().BeFalse();
    }

    [Fact]
    public async Task Tài_khoản_đăng_ký_bằng_mật_khẩu_có_hasPassword_true()
    {
        var client = _api.CreateClient();
        var registered = await client.PostAsJsonAsync("/api/v1/auth/register",
            new { phone = ApiClient.UniquePhone(), password = GoodPassword });
        var tokens = await registered.Content.ReadFromJsonAsync<Tokens>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", tokens!.AccessToken);

        var me = await client.GetFromJsonAsync<MeDto>("/api/v1/auth/me");

        me!.HasPassword.Should().BeTrue();
    }

    [Fact]
    public async Task Số_điện_thoại_sai_định_dạng_trả_400_chứ_không_phải_429()
    {
        // Đây là lỗi đã cắn, và nó hỏng ở tầng *câu chữ* chứ không ở tầng chức năng:
        // khoá tài khoản trước đây cũng trả 400, nên màn hình đăng nhập không phân
        // biệt được "số nhập sai" với "đang bị khoá" và hiện "sai quá nhiều lần nên
        // tài khoản tạm khoá" cho người vừa gõ sai ở **lần thử đầu tiên** — đẩy họ
        // ngồi chờ 15 phút cho một lỗi sửa được trong ba giây.
        //
        // Hai tình huống dẫn tới hai hành động khác hẳn nhau, nên hai mã phải khác
        // nhau. Test này giữ vế "dữ liệu sai"; vế "bị khoá" ở test ngay dưới.
        var client = _api.CreateClient();

        var res = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { phone = "901234567", password = GoodPassword });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Khoá_tài_khoản_trả_429_chứ_không_phải_400()
    {
        var client = _api.CreateClient();
        var phone = ApiClient.UniquePhone();

        await client.PostAsJsonAsync("/api/v1/auth/register", new { phone, password = GoodPassword });

        // Gõ sai đủ số lần để tài khoản bị khoá.
        for (var i = 0; i < 5; i++)
        {
            await client.PostAsJsonAsync("/api/v1/auth/login",
                new { phone, password = "sai-mat-khau-nhung-du-dai" });
        }

        // Lượt tiếp theo bị chặn vì khoá — kể cả khi mật khẩu lần này đúng.
        var res = await client.PostAsJsonAsync("/api/v1/auth/login",
            new { phone, password = GoodPassword });

        res.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);

        // 429 cũng là mã của rate limiter (10 lượt / 5 phút, phân vùng theo IP), nên
        // riêng mã số không chứng minh được test này đang đo đúng thứ nó định đo.
        // Rate limiter chặn ở tầng middleware và trả body rỗng; khoá tài khoản đi qua
        // AppExceptionHandler và luôn kèm ProblemDetails. Thiếu vế này thì việc gỡ mất
        // khoá tài khoản vẫn để test xanh, miễn là rate limit tình cờ chạm ngưỡng.
        var body = await res.Content.ReadAsStringAsync();
        body.Should().Contain("khoá", "429 phải đến từ khoá tài khoản, không phải rate limiter");
    }

    private sealed record MeDto(Guid Id, string Phone, string Role, string? Email, bool HasPassword);
}
