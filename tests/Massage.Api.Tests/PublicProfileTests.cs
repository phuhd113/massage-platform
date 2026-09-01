using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class PublicProfileTests(PostgresFixture fixture)
{
    private KtvProfileService Service() => new(fixture.CreateContext());

    [Fact]
    public async Task Hồ_sơ_chưa_duyệt_không_xem_được_qua_đường_công_khai()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);

        // Hồ sơ chưa duyệt đã bị loại khỏi search; nếu endpoint công khai vẫn trả về
        // thì chỉ cần biết id là xem được nội dung chưa qua kiểm duyệt.
        var thử = async () => await Service().GetPublicAsync(ktv.Id, null);

        await thử.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Chỉ_chứng_chỉ_đã_duyệt_hiện_ra_công_khai()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        db.Certifications.AddRange(
            new Certification
            {
                KtvId = ktv.Id,
                Name = "Chứng chỉ đã duyệt",
                FileUrl = "/uploads/a.pdf",
                VerifyStatus = VerificationStatuses.Verified,
            },
            new Certification
            {
                KtvId = ktv.Id,
                Name = "Chứng chỉ chờ duyệt",
                FileUrl = "/uploads/b.pdf",
                VerifyStatus = VerificationStatuses.Pending,
            },
            new Certification
            {
                KtvId = ktv.Id,
                Name = "Chứng chỉ bị từ chối",
                FileUrl = "/uploads/c.pdf",
                VerifyStatus = VerificationStatuses.Rejected,
                RejectionReason = "Ảnh mờ không đọc được",
            });
        await db.SaveChangesAsync();

        var dto = await Service().GetPublicAsync(ktv.Id, null);

        dto.Certifications.Should().ContainSingle().Which.Name.Should().Be("Chứng chỉ đã duyệt");
    }

    [Fact]
    public async Task Tra_được_hồ_sơ_theo_slug_cho_URL_công_khai()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var dto = await Service().GetPublicAsync(null, ktv.Slug);

        dto.Id.Should().Be(ktv.Id);
    }

    [Fact]
    public async Task Hồ_sơ_công_khai_kèm_dịch_vụ_và_khu_vực_phục_vụ()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var service = await TestData.CreateServiceAsync(db);
        var area = await TestData.CreateAreaAsync(db, AreaLevels.District);
        await TestData.LinkServiceAsync(db, ktv.Id, service.Id);
        await TestData.CoverAsync(db, ktv.Id, area.Id);

        var dto = await Service().GetPublicAsync(ktv.Id, null);

        dto.Services.Should().ContainSingle().Which.Slug.Should().Be(service.Slug);
        dto.CoverageAreas.Should().ContainSingle().Which.Slug.Should().Be(area.Slug);
        // Toạ độ chính xác là chỗ ở của KTV — công khai bản làm tròn là đủ để đặt ghim.
        dto.Lat.Should().Be(Math.Round(lat, 3));
    }

    [Fact]
    public async Task Sitemap_chỉ_chứa_hồ_sơ_đã_duyệt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var duyệt = await TestData.CreateKtvAsync(db, lat, lon);
        var chờ = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);

        var entries = await Service().GetSitemapEntriesAsync();

        var ids = entries.Select(e => e.Id).ToList();
        ids.Should().Contain(duyệt.Id);
        ids.Should().NotContain(chờ.Id);
    }
}
