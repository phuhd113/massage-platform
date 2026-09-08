using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Common.Storage;
using Massage.Api.Modules.Admin;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Massage.Api.Tests;

/// <summary>
/// Trang tra cứu KTV của admin — khác hàng đợi duyệt ở chỗ nó trả mọi trạng thái và
/// tìm được theo tên hoặc số điện thoại.
/// </summary>
[Collection(PostgresCollection.Name)]
public class AdminKtvSearchTests(PostgresFixture fixture)
{
    /// <summary>
    /// Mỗi lần gọi dựng service trên một <c>DbContext</c> mới, đúng như thực tế mỗi
    /// HTTP request có context riêng.
    /// </summary>
    private AdminService Service() => new(
        fixture.CreateContext(),
        new MediaUrls(new FakeObjectStorage(), Options.Create(new UploadOptions())));

    /// <summary>
    /// Storage giả: những test ở đây chỉ quan tâm avatar có được map thành URL hay
    /// không, không quan tâm URL trỏ đi đâu. Dựng
    /// <see cref="Massage.Api.Common.Storage.LocalObjectStorage"/> thật sẽ kéo theo
    /// <c>IWebHostEnvironment</c> và một thư mục trên đĩa cho một trường hiển thị.
    /// </summary>
    private sealed class FakeObjectStorage : IObjectStorage
    {
        public Task<string> PutAsync(
            string key, Stream content, string contentType, CancellationToken ct = default) =>
            Task.FromResult(key);

        public Task DeleteAsync(string key, CancellationToken ct = default) => Task.CompletedTask;

        public Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default) =>
            Task.FromResult<Stream?>(null);

        public string PublicUrl(string key) => $"https://cdn.test/{key}";

        public string SignedUrl(string key, TimeSpan lifetime) => $"https://cdn.test/{key}?sig=x";
    }

    [Fact]
    public async Task Trả_về_mọi_trạng_thái_khi_không_lọc()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var đãDuyệt = await TestData.CreateKtvAsync(db, lat, lon);
        var chờDuyệt = await TestData.CreateKtvAsync(
            db, lat, lon, status: VerificationStatuses.Pending);
        var bịTừChối = await TestData.CreateKtvAsync(
            db, lat, lon, status: VerificationStatuses.Rejected);

        var kếtQuả = await Service().SearchProfilesAsync(null, null, null, 1, 1000);
        var ids = kếtQuả.Items.Select(i => i.Id).ToList();

        ids.Should().Contain([đãDuyệt.Id, chờDuyệt.Id, bịTừChối.Id],
            "đây là trang tra cứu, không phải hàng đợi duyệt — hồ sơ bị từ chối chính là "
            + "hồ sơ hay bị hỏi tới nhất, mà nó không nằm trong bất kỳ hàng đợi nào");
    }

    /// <summary>
    /// Gõ không dấu vẫn tìm ra tên có dấu.
    ///
    /// Đây là ca dùng thật: admin nghe KTV đọc tên qua điện thoại rồi gõ vào, gần như
    /// không ai bỏ dấu tiếng Việt đúng lúc đang nghe máy. Khớp qua <c>slug</c> — vốn
    /// là chính cái tên đã bỏ dấu — nên không cần <c>unaccent()</c> lúc query.
    /// </summary>
    [Fact]
    public async Task Tìm_được_bằng_tên_không_dấu()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var hậuTố = Guid.NewGuid().ToString("N")[..10];
        ktv.FullName = $"Nguyễn Thị Hường {hậuTố}";
        ktv.Slug = $"nguyen-thi-huong-{hậuTố}";
        db.KtvProfiles.Update(ktv);
        await db.SaveChangesAsync();

        var khôngDấu = await Service().SearchProfilesAsync(null, "huong", null, 1, 100);
        khôngDấu.Items.Should().ContainSingle(i => i.Id == ktv.Id);

        var cóDấu = await Service().SearchProfilesAsync(null, "Hường", null, 1, 100);
        cóDấu.Items.Should().ContainSingle(i => i.Id == ktv.Id,
            "gõ đủ dấu cũng phải ra — nếu không thì tên hiển thị trên màn hình lại là "
            + "chuỗi duy nhất không tìm được");
    }

    [Fact]
    public async Task Tìm_được_bằng_số_điện_thoại()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var số = await db.Users.Where(u => u.Id == ktv.UserId).Select(u => u.Phone).SingleAsync();

        var kếtQuả = await Service().SearchProfilesAsync(null, số, null, 1, 100);

        var dòng = kếtQuả.Items.Should().ContainSingle(i => i.Id == ktv.Id).Subject;
        dòng.Phone.Should().Be(số,
            "số điện thoại là thứ admin tra cứu theo khi KTV gọi tới, nên nó phải có "
            + "trong kết quả chứ không chỉ khớp được lúc tìm");
    }

    /// <summary>
    /// Từ khoá chỉ có khoảng trắng phải được coi như không tìm gì.
    ///
    /// Bỏ sót ca này thì bộ lọc chạy với chuỗi rỗng — khớp mọi hồ sơ, trong khi giao
    /// diện hiện là đang tìm. Hỏng im lặng vì danh sách vẫn ra kết quả.
    /// </summary>
    [Fact]
    public async Task Từ_khoá_rỗng_không_lọc_gì()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        await TestData.CreateKtvAsync(db, lat, lon);

        var trống = await Service().SearchProfilesAsync(null, "   ", null, 1, 1000);
        var khôngTìm = await Service().SearchProfilesAsync(null, null, null, 1, 1000);

        trống.Total.Should().Be(khôngTìm.Total);
    }

    [Fact]
    public async Task Lọc_theo_giới_tính_bỏ_qua_hồ_sơ_chưa_khai()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var nữ = await TestData.CreateKtvAsync(db, lat, lon, gender: Genders.Female);
        var chưaKhai = await TestData.CreateKtvAsync(db, lat, lon, gender: null);

        var kếtQuả = await Service().SearchProfilesAsync(null, null, Genders.Female, 1, 1000);
        var ids = kếtQuả.Items.Select(i => i.Id).ToList();

        ids.Should().Contain(nữ.Id);
        ids.Should().NotContain(chưaKhai.Id,
            "suy giới tính từ tên là đoán, mà đoán sai ở đây nghĩa là lọc 'KTV nữ' ra "
            + "trúng một người nam — đúng cái nhu cầu trường này sinh ra để phục vụ");
    }

    /// <summary>
    /// Ví chưa tồn tại phải là null, không phải 0.
    ///
    /// Hai thứ đó trả lời hai câu khác nhau: null là "chưa từng nạp lần nào", còn 0 là
    /// "đã nạp và đã tiêu hết". Gộp lại thành 0 sẽ giấu mất một nửa câu trả lời cho câu
    /// hỏi "người này đã bao giờ trả tiền chưa".
    /// </summary>
    [Fact]
    public async Task Ví_chưa_có_trả_null_chứ_không_phải_0()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var chưaCóVí = await TestData.CreateKtvAsync(db, lat, lon);

        var cóVí = await TestData.CreateKtvAsync(db, lat, lon);
        await WalletTestData.SeedWalletAsync(db, cóVí.UserId, 0m);

        var kếtQuả = await Service().SearchProfilesAsync(null, null, null, 1, 1000);

        kếtQuả.Items.Single(i => i.Id == chưaCóVí.Id).WalletBalance.Should().BeNull();
        kếtQuả.Items.Single(i => i.Id == cóVí.Id).WalletBalance.Should().Be(0m);
    }

    [Fact]
    public async Task Mới_nhất_lên_đầu_ngược_với_hàng_đợi_duyệt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var cũ = await TestData.CreateKtvAsync(db, lat, lon);
        var mới = await TestData.CreateKtvAsync(db, lat, lon);

        var kếtQuả = await Service().SearchProfilesAsync(null, null, null, 1, 1000);
        var ids = kếtQuả.Items.Select(i => i.Id).ToList();

        ids.IndexOf(mới.Id).Should().BeLessThan(ids.IndexOf(cũ.Id),
            "hàng đợi duyệt xếp cũ nhất trước (ai chờ lâu nhất được xem trước), còn tra "
            + "cứu xếp mới nhất trước (hồ sơ vừa tạo là hồ sơ hay bị hỏi tới nhất)");
    }
}
