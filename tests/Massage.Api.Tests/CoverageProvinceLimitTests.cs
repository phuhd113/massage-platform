using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Collaborators;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;

namespace Massage.Api.Tests;

/// <summary>
/// Khu vực nhận phục vụ của một hồ sơ chỉ được trải tối đa
/// <see cref="KtvProfileService.MaxCoverageProvinces"/> tỉnh/thành.
///
/// Luật này sống ở backend chứ không chỉ ở form dashboard, và đó là điều bộ test này
/// canh: form là **một** đường ghi, còn API nhận được từ bất cứ đâu.
///
/// Vì sao nó đáng có test riêng: hậu quả của việc mất luật không hiện ra ở hồ sơ gây
/// ra nó, mà ở chỗ khác hẳn — số KTV theo khu vực là thứ quyết định trang quận nào
/// được index, nên vài hồ sơ khai bừa cả nước sẽ đẩy hàng loạt trang qua ngưỡng bằng
/// những cái tên không bao giờ nhận khách ở đó. Đúng hình dạng doorway page mà Google
/// phạt lên cả tên miền, và không có gì trong ứng dụng báo đỏ.
/// </summary>
[Collection(PostgresCollection.Name)]
public class CoverageProvinceLimitTests(PostgresFixture fixture)
{
    private KtvProfileService Service()
    {
        var db = fixture.CreateContext();
        return new KtvProfileService(db, TestMedia.Urls, new CollaboratorService(db));
    }

    /// <summary>Dựng <paramref name="count"/> quận thuộc cùng một tỉnh mới.</summary>
    private static async Task<List<Guid>> DistrictsInNewProvinceAsync(AppDbContext db, int count)
    {
        var province = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var ids = new List<Guid>();
        for (var i = 0; i < count; i++)
        {
            var d = await TestData.CreateAreaAsync(db, AreaLevels.District, parentId: province.Id);
            ids.Add(d.Id);
        }
        return ids;
    }

    private static CreateKtvProfileDto Dto(List<Guid> areaIds) => new(
        FullName: "KTV Kiểm Thử",
        Gender: Genders.Female,
        YearsExperience: 1,
        Lat: 10.77,
        Lon: 106.7,
        BaseAddress: null,
        BaseWardId: null,
        BaseStreet: null,
        ServiceRadiusKm: 5,
        CoverageAreaIds: areaIds);

    [Fact]
    public async Task Hai_tỉnh_thì_tạo_được_hồ_sơ()
    {
        await using var db = fixture.CreateContext();
        var user = await TestData.CreateUserAsync(db);

        // Nhiều quận mỗi tỉnh, để chắc chắn trần đếm theo **tỉnh** chứ không theo số
        // khu vực — hai thứ này rất dễ bị gộp làm một khi sửa sau này.
        var areas = await DistrictsInNewProvinceAsync(db, 3);
        areas.AddRange(await DistrictsInNewProvinceAsync(db, 2));

        var profile = await Service().CreateAsync(user.Id, Dto(areas));

        profile.Id.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Ba_tỉnh_thì_bị_từ_chối()
    {
        await using var db = fixture.CreateContext();
        var user = await TestData.CreateUserAsync(db);

        var areas = await DistrictsInNewProvinceAsync(db, 1);
        areas.AddRange(await DistrictsInNewProvinceAsync(db, 1));
        areas.AddRange(await DistrictsInNewProvinceAsync(db, 1));

        var thử = async () => await Service().CreateAsync(user.Id, Dto(areas));

        await thử.Should().ThrowAsync<BadRequestException>()
            .Where(e => e.Message.Contains("tỉnh"));
    }

    [Fact]
    public async Task Đường_sửa_hồ_sơ_cũng_bị_chặn()
    {
        await using var db = fixture.CreateContext();
        var user = await TestData.CreateUserAsync(db);

        var start = await DistrictsInNewProvinceAsync(db, 1);
        await Service().CreateAsync(user.Id, Dto(start));

        // Chặn ở cả hai đường ghi, không chỉ lúc tạo: thiếu vế này thì KTV lập hồ sơ
        // hợp lệ rồi mở rộng ra cả nước ở lần sửa kế tiếp — cùng cái lỗ, chỉ muộn hơn
        // một bước.
        var tooMany = new List<Guid>(start);
        tooMany.AddRange(await DistrictsInNewProvinceAsync(db, 1));
        tooMany.AddRange(await DistrictsInNewProvinceAsync(db, 1));

        var thử = async () => await Service().UpdateAsync(
            user.Id,
            new UpdateKtvProfileDto(
                FullName: null, Gender: null, YearsExperience: null,
                Lat: null, Lon: null, BaseAddress: null, BaseWardId: null,
                BaseStreet: null, ServiceRadiusKm: null, CoverageAreaIds: tooMany));

        await thử.Should().ThrowAsync<BadRequestException>()
            .Where(e => e.Message.Contains("tỉnh"));
    }

    [Fact]
    public async Task Hồ_sơ_cũ_vượt_trần_vẫn_sửa_được_nếu_không_đụng_khu_vực()
    {
        await using var db = fixture.CreateContext();
        var user = await TestData.CreateUserAsync(db);

        var profile = await Service().CreateAsync(user.Id, Dto(await DistrictsInNewProvinceAsync(db, 1)));

        // Mô phỏng hồ sơ có từ trước khi có luật này: ghi thẳng xuống DB, vòng qua
        // đường validate. Không backfill và không cắt khu vực của ai đang chạy —
        // luật mới áp cho lượt **ghi khu vực**, nên sửa tên hay bán kính vẫn phải lưu
        // được. Nếu không thì một quyết định nội bộ biến thành hồ sơ bị khoá cứng,
        // và KTV không có cách nào tự gỡ ra khỏi tình trạng đó.
        foreach (var id in (await DistrictsInNewProvinceAsync(db, 1))
                 .Concat(await DistrictsInNewProvinceAsync(db, 1)))
        {
            db.CoverageAreas.Add(new CoverageArea { KtvId = profile.Id, AreaId = id });
        }
        await db.SaveChangesAsync();

        // CoverageAreaIds = null nghĩa là "không đổi khu vực" — đường sửa không được
        // đụng tới, nên luật trần tỉnh cũng không có gì để kiểm.
        var updated = await Service().UpdateAsync(
            user.Id,
            new UpdateKtvProfileDto(
                FullName: "Tên Mới", Gender: null, YearsExperience: null,
                Lat: null, Lon: null, BaseAddress: null, BaseWardId: null,
                BaseStreet: null, ServiceRadiusKm: null, CoverageAreaIds: null));

        updated.FullName.Should().Be("Tên Mới");
    }
}
