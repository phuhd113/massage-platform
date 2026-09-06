using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.Areas;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class AreaServiceTests(PostgresFixture fixture)
{
    private AreaService Service() => new(fixture.CreateContext());

    [Fact]
    public async Task Khu_vực_dưới_ngưỡng_KTV_không_được_cho_index()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        // Có sẵn nội dung biên tập để test này chỉ kiểm đúng một vế: ngưỡng số KTV.
        await TestData.SetEditorialNoteAsync(db, quận.Id, "Bài giới thiệu riêng cho quận này.");

        for (var i = 0; i < AreaService.MinKtvForIndex - 1; i++)
        {
            var ktv = await TestData.CreateKtvAsync(db, lat, lon);
            await TestData.CoverAsync(db, ktv.Id, quận.Id);
        }

        var trướcNgưỡng = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        trướcNgưỡng.KtvCount.Should().Be(AreaService.MinKtvForIndex - 1);
        trướcNgưỡng.Indexable.Should().BeFalse(
            "trang gần rỗng lọt vào index sẽ bị Google xếp là doorway page và kéo cả tên miền xuống");

        var thêmMột = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, thêmMột.Id, quận.Id);

        var sauNgưỡng = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        sauNgưỡng.KtvCount.Should().Be(AreaService.MinKtvForIndex);
        sauNgưỡng.Indexable.Should().BeTrue();
    }

    [Fact]
    public async Task Khu_vực_đủ_KTV_nhưng_chưa_có_nội_dung_riêng_vẫn_không_được_index()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        for (var i = 0; i < AreaService.MinKtvForIndex; i++)
        {
            var ktv = await TestData.CreateKtvAsync(db, lat, lon);
            await TestData.CoverAsync(db, ktv.Id, quận.Id);
        }

        // Mở toàn quốc sinh ~760 trang khu vực từ đúng một mẫu chỉ thay tên. Đủ KTV
        // mới chỉ chứng minh trang có dữ liệu thật; chưa có nội dung riêng thì nó vẫn
        // là doorway page, nên hai điều kiện phải cùng đúng.
        var chưaCóBài = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        chưaCóBài.KtvCount.Should().Be(AreaService.MinKtvForIndex);
        chưaCóBài.Indexable.Should().BeFalse("đủ KTV nhưng nội dung vẫn là mẫu dùng chung");

        await TestData.SetEditorialNoteAsync(db, quận.Id, "Bài giới thiệu riêng cho quận này.");

        var đãCóBài = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        đãCóBài.Indexable.Should().BeTrue();
        đãCóBài.EditorialNote.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task KTV_phủ_nhiều_quận_chỉ_được_đếm_một_lần_ở_cấp_tỉnh()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnA = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var quậnB = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktv.Id, quậnA.Id);
        await TestData.CoverAsync(db, ktv.Id, quậnB.Id);

        var tỉnhDto = await Service().GetProvinceAsync(tỉnh.Slug);

        // Cộng dồn số liệu quận sẽ ra 2 và đẩy trang tỉnh vượt ngưỡng index bằng
        // một KTV duy nhất — đúng kiểu thin content mà ngưỡng này sinh ra để chặn.
        tỉnhDto.KtvCount.Should().Be(1);
    }

    [Fact]
    public async Task Hồ_sơ_chưa_duyệt_không_được_tính_vào_số_KTV_của_khu_vực()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var duyệt = await TestData.CreateKtvAsync(db, lat, lon);
        var chờ = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);
        await TestData.CoverAsync(db, duyệt.Id, quận.Id);
        await TestData.CoverAsync(db, chờ.Id, quận.Id);

        var dto = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);

        dto.KtvCount.Should().Be(1);
    }

    [Fact]
    public async Task Quận_lân_cận_được_trả_về_để_liên_kết_chéo()
    {
        await using var db = fixture.CreateContext();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnA = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var quậnB = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var dto = await Service().GetDistrictAsync(tỉnh.Slug, quậnA.Slug);

        dto.Parent!.Slug.Should().Be(tỉnh.Slug);
        dto.Siblings.Select(s => s.Slug).Should().Contain(quậnB.Slug);
        dto.Siblings.Select(s => s.Slug).Should().NotContain(quậnA.Slug);
    }

    [Fact]
    public async Task Slug_quận_không_thuộc_tỉnh_thì_báo_không_tìm_thấy()
    {
        await using var db = fixture.CreateContext();
        var tỉnh1 = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var tỉnh2 = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnCủaTỉnh2 = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh2.Id);

        var thử = async () => await Service().GetDistrictAsync(tỉnh1.Slug, quậnCủaTỉnh2.Slug);

        await thử.Should().ThrowAsync<Massage.Api.Common.NotFoundException>();
    }
    [Fact]
    public async Task Hai_quận_trùng_slug_ở_hai_tỉnh_khác_nhau_tra_ra_đúng_quận()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        // Đây là lý do tồn tại của cả thay đổi ràng buộc: cả nước có 10 tỉnh cùng
        // chứa "Huyện Châu Thành". Ràng buộc cũ (slug, level) chỉ giữ nổi một trong
        // mười, nên chính lệnh chèn dưới đây từng là điều không làm được.
        var slugTrùng = $"huyen-chau-thanh-{Guid.NewGuid().ToString("N")[..8]}";

        var tỉnhA = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var tỉnhB = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnA = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnhA.Id, slug: slugTrùng);
        var quậnB = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnhB.Id, slug: slugTrùng);

        quậnA.Id.Should().NotBe(quậnB.Id);

        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktv.Id, quậnA.Id);

        var từTỉnhA = await Service().GetDistrictAsync(tỉnhA.Slug, slugTrùng);
        var từTỉnhB = await Service().GetDistrictAsync(tỉnhB.Slug, slugTrùng);

        từTỉnhA.Id.Should().Be(quậnA.Id);
        từTỉnhB.Id.Should().Be(quậnB.Id);
        từTỉnhA.KtvCount.Should().Be(1);
        từTỉnhB.KtvCount.Should().Be(0, "KTV của tỉnh A không được rò sang trang của tỉnh B");
    }

    [Fact]
    public async Task Không_thể_tạo_hai_tỉnh_trùng_slug()
    {
        await using var db = fixture.CreateContext();
        var slug = $"tinh-trung-{Guid.NewGuid().ToString("N")[..8]}";
        await TestData.CreateAreaAsync(db, AreaLevels.Province, slug: slug);

        // Tỉnh có parent_id NULL, mà UNIQUE (parent_id, slug) coi mọi NULL là khác
        // nhau — nên nếu thiếu partial index uq_area_root_slug thì lệnh này lọt, và
        // hai trang /massage-tan-noi/{slug} cùng nhận canonical. Test này canh đúng
        // cái bẫy đó: bỏ index đi là nó đỏ.
        var thử = async () => await TestData.CreateAreaAsync(db, AreaLevels.Province, slug: slug);

        await thử.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task Không_thể_tạo_hai_quận_trùng_slug_trong_cùng_tỉnh()
    {
        await using var db = fixture.CreateContext();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var slug = $"quan-trung-{Guid.NewGuid().ToString("N")[..8]}";
        await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id, slug: slug);

        var thử = async () => await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id, slug: slug);

        await thử.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task Cây_khu_vực_không_chứa_phường_xã()
    {
        await using var db = fixture.CreateContext();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var phường = await TestData.CreateAreaAsync(db, AreaLevels.Ward, quận.Id);

        var cây = await Service().GetTreeAsync();
        var nútTỉnh = cây.Single(p => p.Id == tỉnh.Id);
        var nútQuận = nútTỉnh.Children.Single(d => d.Id == quận.Id);

        // Frontend làm phẳng cây bằng flatMap(p => p.children) ở bốn chỗ, nên phường
        // lọt vào đây sẽ thành "quận" chọn được: KTV đặt được phường làm khu vực phục
        // vụ và mua được gói đẩy tin trên một phường. Cả nước có hơn 10.000 phường,
        // nên đây vừa là chuyện đúng sai vừa là chuyện tải dữ liệu.
        nútQuận.Children.Should().BeEmpty();
        cây.Should().NotContain(p => p.Id == phường.Id);
    }

    [Fact]
    public async Task Địa_chỉ_cấp_phường_không_làm_sai_số_KTV_của_quận()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var phường = await TestData.CreateAreaAsync(db, AreaLevels.Ward, quận.Id);

        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await db.KtvProfiles.Where(k => k.Id == ktv.Id)
            .ExecuteUpdateAsync(u => u.SetProperty(k => k.BaseWardId, phường.Id));

        // Địa chỉ cơ sở là "tôi ở đâu", coverage là "tôi nhận đi những đâu" — hai khái
        // niệm khác nhau, nên khai địa chỉ không làm KTV xuất hiện ở trang khu vực.
        var chỉCóĐịaChỉ = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        chỉCóĐịaChỉ.KtvCount.Should().Be(0);

        // Dữ liệu bẩn: một dòng coverage trỏ thẳng vào phường (bỏ qua validate ở đường
        // ghi). Rollup cộng từ cha của nó, tức là vào quận, như thể quận đó là tỉnh —
        // nên phải lọc theo cấp ở chính truy vấn đếm, không chỉ dựa vào đường ghi.
        await TestData.CoverAsync(db, ktv.Id, phường.Id);

        var sauKhiCóDữLiệuBẩn = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        sauKhiCóDữLiệuBẩn.KtvCount.Should().Be(0, "coverage cấp phường không được cộng vào quận");

        var tỉnhSau = await Service().GetProvinceAsync(tỉnh.Slug);
        tỉnhSau.KtvCount.Should().Be(0, "cũng không được cộng lên tỉnh");
    }

    /// <summary>
    /// Hậu tố ngẫu nhiên cho tên khu vực trong test gợi ý.
    ///
    /// Database test dùng chung với dữ liệu seed thật (10.810 khu vực) và xUnit chạy
    /// các test song song, nên gõ "Quận 7" trần sẽ khớp cả quận thật lẫn khu vực do test
    /// khác vừa tạo. Hậu tố biến mỗi test thành một không gian tên riêng.
    /// </summary>
    private static string Nonce() => Guid.NewGuid().ToString("N")[..8];

    [Fact]
    public async Task Gợi_ý_khu_vực_khớp_cả_khi_gõ_không_dấu_lẫn_có_dấu()
    {
        await using var db = fixture.CreateContext();
        var nonce = Nonce();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        await TestData.CreateAreaAsync(
            db, AreaLevels.District, tỉnh.Id, name: $"Quận Bình Thạnh {nonce}");

        // Đây là lý do cột name_ascii tồn tại: khách gõ trên bàn phím không dấu nhiều
        // hơn gõ có dấu, nhưng cả hai đều phải ra cùng một khu vực.
        var khôngDấu = await Service().SuggestAsync($"binh thanh {nonce}");
        var cóDấu = await Service().SuggestAsync($"Bình Thạnh {nonce}");

        khôngDấu.Should().ContainSingle().Which.Name.Should().Contain("Bình Thạnh");
        cóDấu.Select(s => s.Id).Should().Equal(khôngDấu.Select(s => s.Id));
    }

    [Fact]
    public async Task Gợi_ý_mang_theo_slug_tỉnh_để_phân_biệt_các_quận_trùng_slug()
    {
        await using var db = fixture.CreateContext();
        var nonce = Nonce();
        var slugTrùng = $"huyen-chau-thanh-{nonce}";
        var tên = $"Huyện Châu Thành {nonce}";

        var tỉnhA = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var tỉnhB = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnA = await TestData.CreateAreaAsync(
            db, AreaLevels.District, tỉnhA.Id, slug: slugTrùng, name: tên);
        var quậnB = await TestData.CreateAreaAsync(
            db, AreaLevels.District, tỉnhB.Id, slug: slugTrùng, name: tên);

        var gợiÝ = await Service().SuggestAsync($"chau thanh {nonce}");

        // Cả nước có 10 tỉnh chứa "Huyện Châu Thành". Slug trần không phân biệt được
        // chúng, nên gợi ý thiếu vế tỉnh là thứ frontend không dựng nổi thành URL đúng
        // và /search sẽ hiểu nhầm thành slug tỉnh — chính cái bug ô select cũ mắc phải.
        gợiÝ.Should().HaveCount(2);
        gợiÝ.Select(s => s.Slug).Should().AllBe(slugTrùng);
        gợiÝ.Select(s => s.ProvinceSlug).Should()
            .BeEquivalentTo([tỉnhA.Slug, tỉnhB.Slug], "mỗi gợi ý phải chỉ đúng tỉnh của nó");
        gợiÝ.Select(s => s.Id).Should().BeEquivalentTo([quậnA.Id, quậnB.Id]);
    }

    [Fact]
    public async Task Gợi_ý_phường_mang_đủ_cả_slug_quận_lẫn_slug_tỉnh()
    {
        await using var db = fixture.CreateContext();
        var nonce = Nonce();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        await TestData.CreateAreaAsync(
            db, AreaLevels.Ward, quận.Id, name: $"Phường Bến Nghé {nonce}");

        var gợiÝ = await Service().SuggestAsync($"ben nghe {nonce}");

        // Phường không có trang riêng nên frontend quy nó về quận cha — muốn làm được
        // điều đó thì gợi ý phải mang sẵn cả hai vế, client không tự tra ngược được.
        var phường = gợiÝ.Should().ContainSingle().Subject;
        phường.Level.Should().Be(AreaLevels.Ward);
        phường.DistrictSlug.Should().Be(quận.Slug);
        phường.ProvinceSlug.Should().Be(tỉnh.Slug);
        phường.ParentPath.Should().Contain(quận.Name).And.Contain(tỉnh.Name);
    }

    [Fact]
    public async Task Gõ_dưới_ngưỡng_ký_tự_thì_không_gợi_ý_gì()
    {
        // Một ký tự khớp gần như mọi khu vực trong nước: kết quả vô nghĩa với khách mà
        // vẫn tốn một lượt quét toàn bảng cho mỗi phím gõ.
        var quáNgắn = await Service().SuggestAsync("a");
        quáNgắn.Should().BeEmpty();

        (await Service().SuggestAsync("")).Should().BeEmpty();
        (await Service().SuggestAsync(null)).Should().BeEmpty();
        (await Service().SuggestAsync("   ")).Should().BeEmpty();
    }

    [Fact]
    public async Task Số_KTV_trong_gợi_ý_khớp_với_số_ở_trang_khu_vực()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var nonce = Nonce();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(
            db, AreaLevels.District, tỉnh.Id, name: $"Quận Đối Chiếu {nonce}");
        await TestData.SetEditorialNoteAsync(db, quận.Id, "Bài giới thiệu riêng.");

        for (var i = 0; i < AreaService.MinKtvForIndex; i++)
        {
            var ktv = await TestData.CreateKtvAsync(db, lat, lon);
            await TestData.CoverAsync(db, ktv.Id, quận.Id);
        }

        // Hồ sơ chưa duyệt không được tính — cùng quy tắc với trang khu vực.
        var chờDuyệt = await TestData.CreateKtvAsync(
            db, lat, lon, status: VerificationStatuses.Pending);
        await TestData.CoverAsync(db, chờDuyệt.Id, quận.Id);

        var gợiÝ = (await Service().SuggestAsync($"doi chieu {nonce}")).Should().ContainSingle().Subject;
        var trangKhuVực = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);

        // Ô gợi ý đếm KTV bằng truy vấn riêng (chỉ cho vài dòng đã khớp) thay vì dùng lại
        // hàm đếm toàn bảng của trang khu vực. Hai công thức lệch nhau thì cùng một quận
        // hiện hai con số khác nhau ở hai chỗ, và cờ indexable cũng lệch theo.
        gợiÝ.KtvCount.Should().Be(trangKhuVực.KtvCount);
        gợiÝ.KtvCount.Should().Be(AreaService.MinKtvForIndex);
        gợiÝ.Indexable.Should().Be(trangKhuVực.Indexable).And.BeTrue();
    }

    [Fact]
    public async Task Số_KTV_của_tỉnh_trong_gợi_ý_không_cộng_trùng_KTV_phủ_nhiều_quận()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var nonce = Nonce();

        var tỉnh = await TestData.CreateAreaAsync(
            db, AreaLevels.Province, name: $"Tỉnh Gộp Dồn {nonce}");
        var quậnA = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var quậnB = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktv.Id, quậnA.Id);
        await TestData.CoverAsync(db, ktv.Id, quậnB.Id);

        var gợiÝ = (await Service().SuggestAsync($"gop don {nonce}")).Should().ContainSingle().Subject;

        // Cộng thẳng số liệu hai quận ra 2 và đẩy tỉnh vượt ngưỡng index bằng đúng một
        // KTV — nên nhánh PROVINCE phải đếm DISTINCT, y như GetVerifiedCountsAsync.
        gợiÝ.KtvCount.Should().Be(1);
    }

    [Fact]
    public async Task Gợi_ý_xếp_quận_lên_trước_phường_và_ưu_tiên_khớp_từ_đầu()
    {
        await using var db = fixture.CreateContext();
        var nonce = Nonce();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        await TestData.CreateAreaAsync(
            db, AreaLevels.Ward, quận.Id, name: $"Xã Hoà Bình {nonce}");
        var quậnKhớp = await TestData.CreateAreaAsync(
            db, AreaLevels.District, tỉnh.Id, name: $"Huyện Hoà Bình {nonce}");

        var gợiÝ = await Service().SuggestAsync($"hoa binh {nonce}");

        // Khách tìm massage nghĩ theo quận/huyện trước — phường chỉ là nhãn địa chỉ.
        gợiÝ.Should().HaveCount(2);
        gợiÝ[0].Id.Should().Be(quậnKhớp.Id);
        gợiÝ[0].Level.Should().Be(AreaLevels.District);
        gợiÝ[1].Level.Should().Be(AreaLevels.Ward);
    }

    [Fact]
    public async Task Gợi_ý_không_trả_quá_số_dòng_yêu_cầu()
    {
        await using var db = fixture.CreateContext();
        var nonce = Nonce();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);

        for (var i = 0; i < 12; i++)
        {
            await TestData.CreateAreaAsync(
                db, AreaLevels.District, tỉnh.Id, name: $"Huyện Đông Sơn {nonce} {i}");
        }

        (await Service().SuggestAsync($"dong son {nonce}", limit: 5)).Should().HaveCount(5);

        // Không có limit thì rơi về mặc định 8, không phải "trả hết".
        (await Service().SuggestAsync($"dong son {nonce}")).Should().HaveCount(8);

        // Limit vượt trần bị kẹp lại thay vì cho khách tự chọn tải bao nhiêu cũng được.
        (await Service().SuggestAsync($"dong son {nonce}", limit: 500)).Should().HaveCount(12);
    }

    [Fact]
    public async Task Đổi_tên_khu_vực_thì_chuỗi_khớp_được_dựng_lại()
    {
        await using var db = fixture.CreateContext();
        var nonce = Nonce();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(
            db, AreaLevels.District, tỉnh.Id, name: $"Huyện Tên Cũ {nonce}");

        (await Service().SuggestAsync($"ten cu {nonce}")).Should().ContainSingle();

        await db.AdministrativeAreas.Where(a => a.Id == quận.Id)
            .ExecuteUpdateAsync(u => u.SetProperty(a => a.Name, $"Huyện Tên Mới {nonce}"));

        // name_ascii do trigger trong DB dựng, không do đường ghi ứng dụng điền. Đây là
        // điều làm cho lệnh seed-areas (raw SQL, không đi qua EF) không thể âm thầm bỏ
        // trống cột — lỗi mà không test ứng dụng nào khác nhìn thấy.
        (await Service().SuggestAsync($"ten moi {nonce}")).Should().ContainSingle()
            .Which.Id.Should().Be(quận.Id);
        (await Service().SuggestAsync($"ten cu {nonce}")).Should().BeEmpty();
    }

    [Fact]
    public async Task Danh_sách_phường_trả_đúng_theo_quận()
    {
        await using var db = fixture.CreateContext();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnA = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var quậnB = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var phườngA = await TestData.CreateAreaAsync(db, AreaLevels.Ward, quậnA.Id);
        var phườngB = await TestData.CreateAreaAsync(db, AreaLevels.Ward, quậnB.Id);

        var củaA = await Service().GetWardsAsync(tỉnh.Slug, quậnA.Slug);

        củaA.Select(w => w.Id).Should().Contain(phườngA.Id);
        củaA.Select(w => w.Id).Should().NotContain(phườngB.Id);
    }

    [Fact]
    public async Task Số_liệu_khu_vực_chỉ_tính_trên_KTV_đã_duyệt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var duyệt = await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 4.60m, ratingCount: 10);
        var chưaDuyệt = await TestData.CreateKtvAsync(
            db, lat, lon, status: VerificationStatuses.Pending, ratingAvg: 1.00m, ratingCount: 500);
        await TestData.CoverAsync(db, duyệt.Id, quận.Id);
        await TestData.CoverAsync(db, chưaDuyệt.Id, quận.Id);

        var dv = await TestData.CreateServiceAsync(db);
        await TestData.LinkServiceAsync(db, duyệt.Id, dv.Id, priceFrom: 300_000m);
        // Hồ sơ chưa duyệt khai giá rẻ hơn hẳn — nếu lọt vào thống kê, trang khu vực
        // quảng cáo một mức giá không ai gọi được.
        await TestData.LinkServiceAsync(db, chưaDuyệt.Id, dv.Id, priceFrom: 50_000m);

        var stats = (await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug)).Stats;

        stats.PriceFromMin.Should().Be(300_000m, "giá phải lấy từ hồ sơ khách gọi được");
        stats.RatingAvg.Should().Be(4.6m);
        stats.RatingCount.Should().Be(10, "500 đánh giá của hồ sơ chưa duyệt không được tính");
    }

    [Fact]
    public async Task Số_liệu_trang_tỉnh_gộp_từ_các_quận_trực_thuộc()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var ktv = await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 4.80m, ratingCount: 20);
        await TestData.CoverAsync(db, ktv.Id, quận.Id);
        var dv = await TestData.CreateServiceAsync(db);
        await TestData.LinkServiceAsync(db, ktv.Id, dv.Id, priceFrom: 420_000m);

        // KTV khai coverage ở mức quận, nên lọc thẳng theo id tỉnh luôn rỗng — trang
        // tỉnh phải gộp từ các quận, giống như cách KtvCount đã làm.
        var stats = (await Service().GetProvinceAsync(tỉnh.Slug)).Stats;

        stats.PriceFromMin.Should().Be(420_000m);
        stats.RatingAvg.Should().Be(4.8m);
        stats.TopServiceName.Should().Be(dv.Name);
    }

    [Fact]
    public async Task Khu_vực_chưa_có_dữ_liệu_trả_số_liệu_rỗng_chứ_không_lỗi()
    {
        await using var db = fixture.CreateContext();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var stats = (await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug)).Stats;

        // Khu vực trắng là trạng thái bình thường của một sàn đang lớn. Frontend bỏ
        // hẳn ô nào rỗng, nên null ở đây là hợp đồng chứ không phải thiếu sót.
        stats.PriceFromMin.Should().BeNull();
        stats.RatingAvg.Should().BeNull();
        stats.RatingCount.Should().Be(0);
        stats.TopServiceName.Should().BeNull();
    }

    [Fact]
    public async Task Toạ_độ_GPS_dò_ra_quận_gần_nhất_kèm_đủ_vế_tỉnh()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var gần = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var xa = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        await TestData.SetCentroidAsync(db, gần.Id, TestData.LatOffsetKm(lat, 2), lon);
        await TestData.SetCentroidAsync(db, xa.Id, TestData.LatOffsetKm(lat, 25), lon);

        var kết = await Service().ResolveAsync(lat, lon);

        kết.Should().NotBeNull();
        kết!.Id.Should().Be(gần.Id);

        // Vế tỉnh là thứ khiến kết quả này dùng được: `areaSlug` đứng một mình bị backend
        // hiểu là slug **tỉnh**, và mười tỉnh cùng có "Huyện Châu Thành". Thiếu nó thì ô
        // khu vực điền xong nhưng bấm tìm lại ra kết quả của một tỉnh nào khác.
        kết.ProvinceSlug.Should().Be(tỉnh.Slug);
        kết.ParentPath.Should().Be(tỉnh.Name);
    }

    [Fact]
    public async Task Toạ_độ_ngoài_mọi_khu_vực_trả_null_chứ_không_đoán_bừa()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        await TestData.SetCentroidAsync(db, quận.Id, lat, lon);

        // Xa hơn ngưỡng 60km rất nhiều: khách ở nước ngoài, hoặc GPS trôi ra giữa biển.
        // Trả về quận gần nhất bất kể xa bao nhiêu sẽ cho ra một cái tên nghe rất thuyết
        // phục mà sai hoàn toàn — tệ hơn hẳn một ô để trống.
        var kết = await Service().ResolveAsync(TestData.LatOffsetKm(lat, 500), lon);

        kết.Should().BeNull();
    }

    [Fact]
    public async Task Dò_ngược_chỉ_trả_về_cấp_quận_dù_tỉnh_có_tâm_gần_hơn()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        // Tỉnh đặt ngay tại chỗ khách đứng, quận cách 10km — nếu truy vấn không lọc cấp
        // thì tỉnh thắng. Trả về tỉnh nghĩa là gán một khu vực rộng hàng trăm km cho một
        // câu hỏi "tôi đang ở quận nào", và ô khu vực sẽ tìm ra kết quả của cả tỉnh.
        await TestData.SetCentroidAsync(db, tỉnh.Id, lat, lon);
        await TestData.SetCentroidAsync(db, quận.Id, TestData.LatOffsetKm(lat, 10), lon);

        var kết = await Service().ResolveAsync(lat, lon);

        kết.Should().NotBeNull();
        kết!.Level.Should().Be(AreaLevels.District);
        kết.Id.Should().Be(quận.Id);
    }

    [Fact]
    public async Task Khu_vực_chưa_có_toạ_độ_tâm_không_bao_giờ_được_dò_ra()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var khôngTâm = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var cóTâm = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        // Hai huyện đảo cố ý không có tâm, và mọi phường/xã cũng vậy. Chúng phải vô hình
        // với việc dò ngược chứ không được rơi vào một nhánh xử lý nào khác.
        await TestData.SetCentroidAsync(db, cóTâm.Id, TestData.LatOffsetKm(lat, 30), lon);

        var kết = await Service().ResolveAsync(lat, lon);

        kết.Should().NotBeNull();
        kết!.Id.Should().Be(cóTâm.Id, "khu vực không có tâm phải bị bỏ qua hoàn toàn");
        kết.Id.Should().NotBe(khôngTâm.Id);
    }

    [Theory]
    [InlineData(91, 0)]
    [InlineData(-91, 0)]
    [InlineData(0, 181)]
    [InlineData(double.NaN, 0)]
    public async Task Toạ_độ_không_hợp_lệ_bị_từ_chối_ở_biên(double lat, double lon)
    {
        // Bắt ở biên thay vì để PostGIS tự xử: ST_MakePoint nhận mọi số và cho ra một
        // điểm hợp lệ về mặt hình học, nên toạ độ rác sẽ lặng lẽ trả về null như thể
        // khách đang ở ngoài lãnh thổ — che mất lỗi thật của phía gọi.
        var lỗi = async () => await Service().ResolveAsync(lat, lon);

        await lỗi.Should().ThrowAsync<BadRequestException>();
    }
}
