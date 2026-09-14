using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.Areas;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Tests;

/// <summary>
/// Đường ghi nội dung biên tập khu vực.
///
/// Trước đợt này <c>editorial_note</c> chỉ **được đọc**: không endpoint ghi, không trang
/// admin, không đường nhập nào ngoài UPDATE bằng SQL tay. Đo trên production ngày
/// 2026-09-14: 0/759 khu vực có nội dung, nên **không trang khu vực nào index được** kể
/// cả khu vực đủ KTV — trong khi SEO là kênh acquisition chính của sàn.
/// </summary>
[Collection(PostgresCollection.Name)]
public class AreaEditorialTests(PostgresFixture fixture)
{
    private AreaService Service() => new(fixture.CreateContext());

    [Fact]
    public async Task Ghi_nội_dung_đủ_dài_thì_mở_được_index_cho_khu_vực_đủ_KTV()
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

        // Đủ KTV nhưng chưa có nội dung: vẫn noindex. Đây là trạng thái của **toàn bộ**
        // 759 khu vực trên production trước đợt này.
        var trước = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        trước.Indexable.Should().BeFalse();

        var kếtQuả = await Service().SetEditorialNoteAsync(quận.Id, NộiDungHợpLệ);

        kếtQuả.Indexable.Should().BeTrue("đủ cả hai vế: ngưỡng KTV và nội dung riêng");
        kếtQuả.KtvCount.Should().Be(AreaService.MinKtvForIndex);

        // Trả về **cặp** slug tỉnh + quận để lớp gọi xoá đúng đường dẫn ISR. Thiếu vế
        // tỉnh là đúng chỗ cặp slug từng bị gửi thiếu vế ở ô tìm khu vực.
        kếtQuả.ProvinceSlug.Should().Be(tỉnh.Slug);
        kếtQuả.DistrictSlug.Should().Be(quận.Slug);

        var sau = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        sau.Indexable.Should().BeTrue();
        sau.EditorialNote.Should().Be(NộiDungHợpLệ);
    }

    [Fact]
    public async Task Nội_dung_quá_ngắn_bị_từ_chối()
    {
        await using var db = fixture.CreateContext();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);

        // Ngưỡng tồn tại vì IsIndexable chỉ kiểm chuỗi rỗng hay không — một dấu chấm
        // cũng qua được vế đó, tức mở index cho một trang vẫn là bản sao của ~760 trang
        // cùng mẫu. Chặn ở đường ghi rẻ hơn nhiều so với gỡ ra sau khi đã bị hạ hạng.
        var quáNgắn = new string('a', AreaService.MinEditorialNoteLength - 1);

        var act = async () => await Service().SetEditorialNoteAsync(tỉnh.Id, quáNgắn);

        await act.Should().ThrowAsync<BadRequestException>();

        await using var kiểm = fixture.CreateContext();
        var lưu = await kiểm.AdministrativeAreas.AsNoTracking().FirstAsync(a => a.Id == tỉnh.Id);
        lưu.EditorialNote.Should().BeNull("lượt ghi bị từ chối thì không được để lại gì");
    }

    [Fact]
    public async Task Gửi_chuỗi_rỗng_là_gỡ_nội_dung_và_đưa_trang_ra_khỏi_index()
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

        await Service().SetEditorialNoteAsync(quận.Id, NộiDungHợpLệ);

        // Việc gỡ phải làm được: thiếu nó thì mở index là một chiều, và không có đường
        // nào đưa một trang ra khỏi index khi nội dung hoá ra sai.
        var sauKhiGỡ = await Service().SetEditorialNoteAsync(quận.Id, "   ");

        sauKhiGỡ.EditorialNote.Should().BeNull("khoảng trắng cũng là gỡ, không phải nội dung");
        sauKhiGỡ.Indexable.Should().BeFalse();
    }

    [Fact]
    public async Task Phường_xã_không_nhận_nội_dung_biên_tập()
    {
        await using var db = fixture.CreateContext();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var phường = await TestData.CreateAreaAsync(db, AreaLevels.Ward, quận.Id);

        // Phường không có trang riêng nên nội dung viết cho nó không hiển thị ở đâu cả —
        // một ô nhập cho phường là mời người ta viết vào hư không.
        var act = async () => await Service().SetEditorialNoteAsync(phường.Id, NộiDungHợpLệ);

        await act.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Danh_sách_onlyReady_chỉ_trả_khu_vực_đủ_KTV_mà_chưa_có_nội_dung()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var đủKtvChưaViết = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var đủKtvĐãViết = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var thiếuKtv = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        for (var i = 0; i < AreaService.MinKtvForIndex; i++)
        {
            var a = await TestData.CreateKtvAsync(db, lat, lon);
            await TestData.CoverAsync(db, a.Id, đủKtvChưaViết.Id);

            var b = await TestData.CreateKtvAsync(db, lat, lon);
            await TestData.CoverAsync(db, b.Id, đủKtvĐãViết.Id);
        }

        await Service().SetEditorialNoteAsync(đủKtvĐãViết.Id, NộiDungHợpLệ);

        var (items, _) = await Service().ListForEditorialAsync(onlyReady: true, q: null, page: 1, limit: 200);
        var ids = items.Select(x => x.Id).ToList();

        // Đây đúng nghĩa là danh sách việc cần làm: viết một đoạn vào đây là trang lên
        // index ngay, còn khu vực thiếu KTV thì viết xong vẫn noindex.
        ids.Should().Contain(đủKtvChưaViết.Id);
        ids.Should().NotContain(đủKtvĐãViết.Id, "đã có nội dung thì không còn là việc cần làm");
        ids.Should().NotContain(thiếuKtv.Id, "viết cho khu vực thiếu KTV không đổi được trạng thái");
    }

    [Fact]
    public async Task Danh_sách_không_bao_giờ_chứa_phường_xã()
    {
        await using var db = fixture.CreateContext();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var phường = await TestData.CreateAreaAsync(db, AreaLevels.Ward, quận.Id);

        var (items, _) = await Service().ListForEditorialAsync(onlyReady: false, q: null, page: 1, limit: 500);

        items.Select(x => x.Id).Should().NotContain(phường.Id);
        items.Select(x => x.Level).Should().NotContain(AreaLevels.Ward);
    }

    /// <summary>
    /// Nội dung mẫu dài hơn ngưỡng. Dựng từ hằng số chứ không viết cứng một chuỗi:
    /// đổi ngưỡng ở service mà test vẫn xanh nhờ chuỗi tự dài theo.
    /// </summary>
    private static readonly string NộiDungHợpLệ =
        "Đây là đoạn nội dung biên tập riêng cho khu vực, đủ dài để vượt ngưỡng tối thiểu. "
        + new string('x', AreaService.MinEditorialNoteLength);
}
