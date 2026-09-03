using FluentAssertions;
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
        // hai trang /massage-tai-nha/{slug} cùng nhận canonical. Test này canh đúng
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
}
