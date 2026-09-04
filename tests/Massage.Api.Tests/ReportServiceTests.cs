using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Reports;
using Massage.Api.Modules.Reports.Entities;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class ReportServiceTests(PostgresFixture fixture)
{
    /// <summary>
    /// Mỗi lần gọi dựng service trên một <c>DbContext</c> mới, đúng như thực tế mỗi
    /// HTTP request có context riêng — dùng lại một context cho cả ghi lẫn đọc sẽ
    /// đọc trúng entity còn trong change tracker thay vì trạng thái thật dưới DB.
    /// </summary>
    private ReportService Service() => new(fixture.CreateContext());

    private const string Ip = "203.0.113.7";
    private const string Ua = "Mozilla/5.0 (test)";

    [Fact]
    public async Task Báo_cáo_không_tự_gỡ_hồ_sơ_xuống()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        await Service().CreateAsync(
            new CreateReportDto(ktv.Id, ProfileReportReasons.Prostitution, "Có dấu hiệu trá hình"),
            reporterUserId: null, Ip, Ua);

        await using var đọcLại = fixture.CreateContext();
        var sau = await đọcLại.KtvProfiles.FindAsync(ktv.Id);

        sau!.VerificationStatus.Should().Be(
            VerificationStatuses.Verified,
            "một nút ẩn hồ sơ bằng vài lần bấm là vũ khí để KTV đối thủ hạ nhau; "
            + "báo cáo chỉ đưa hồ sơ vào hàng đợi cho admin quyết định");
    }

    [Fact]
    public async Task Cùng_thiết_bị_báo_cáo_lại_cùng_hồ_sơ_chỉ_tính_một_lần()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var dto = new CreateReportDto(ktv.Id, ProfileReportReasons.InappropriateContent, null);

        var lần1 = await Service().CreateAsync(dto, null, Ip, Ua);
        var lần2 = await Service().CreateAsync(dto, null, Ip, Ua);

        lần1.Deduplicated.Should().BeFalse();
        lần2.Deduplicated.Should().BeTrue();
        lần2.Id.Should().Be(lần1.Id, "lần gửi lặp phải trỏ về đúng dòng đã ghi, không tạo dòng mới");

        var hàngĐợi = await Service().ListAsync(ProfileReportStatuses.Pending, 1, 100);
        hàngĐợi.Items.Where(i => i.Report.KtvId == ktv.Id).Should().HaveCount(
            1,
            "số báo cáo còn chờ là thước đo mức độ nghiêm trọng admin dùng để xếp thứ tự đọc — "
            + "để một người tự bơm nó lên là làm hỏng chính thước đo đó");
    }

    [Fact]
    public async Task Thiết_bị_khác_nhau_báo_cáo_cùng_hồ_sơ_được_tính_riêng()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var dto = new CreateReportDto(ktv.Id, ProfileReportReasons.Prostitution, null);

        await Service().CreateAsync(dto, null, "198.51.100.1", Ua);
        var kháchThứHai = await Service().CreateAsync(dto, null, "198.51.100.2", Ua);

        kháchThứHai.Deduplicated.Should().BeFalse(
            "hai người khác nhau cùng báo cáo một hồ sơ là tín hiệu mạnh hơn hẳn "
            + "một người báo cáo hai lần");

        var hàngĐợi = await Service().ListAsync(ProfileReportStatuses.Pending, 1, 100);
        hàngĐợi.Items.Where(i => i.Report.KtvId == ktv.Id).Should().HaveCount(2);
    }

    [Fact]
    public async Task Hồ_sơ_bị_báo_cáo_nhiều_lần_xếp_lên_trước_trong_hàng_đợi()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        // Hồ sơ này bị báo cáo trước, nên xếp theo thời gian thuần thì nó đứng đầu.
        var mộtBáoCáo = await TestData.CreateKtvAsync(db, lat, lon);
        await Service().CreateAsync(
            new CreateReportDto(mộtBáoCáo.Id, ProfileReportReasons.Misconduct, null),
            null, "198.51.100.10", Ua);

        var baBáoCáo = await TestData.CreateKtvAsync(db, lat, lon);
        foreach (var octet in new[] { 21, 22, 23 })
            await Service().CreateAsync(
                new CreateReportDto(baBáoCáo.Id, ProfileReportReasons.Prostitution, null),
                null, $"198.51.100.{octet}", Ua);

        var hàngĐợi = await Service().ListAsync(ProfileReportStatuses.Pending, 1, 1000);
        var củaTest = hàngĐợi.Items
            .Where(i => i.Report.KtvId == mộtBáoCáo.Id || i.Report.KtvId == baBáoCáo.Id)
            .ToList();

        củaTest[0].Report.KtvId.Should().Be(
            baBáoCáo.Id,
            "một hồ sơ bị ba người báo cáo khác hẳn về mức độ so với ba hồ sơ mỗi cái một "
            + "báo cáo, mà nhìn danh sách xếp theo thời gian thì hai trường hợp trông giống hệt nhau");
        củaTest[0].PendingReportCount.Should().Be(3);
    }

    [Fact]
    public async Task Chốt_xong_thì_báo_cáo_rời_hàng_đợi_và_ghi_lại_ai_chốt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var admin = await TestData.CreateUserAsync(db, UserRoles.Admin);

        var báoCáo = await Service().CreateAsync(
            new CreateReportDto(ktv.Id, ProfileReportReasons.FalseInformation, "Chứng chỉ không khớp"),
            null, Ip, Ua);

        var đãChốt = await Service().ResolveAsync(
            báoCáo.Id, admin.Id,
            new ResolveReportDto(ProfileReportStatuses.Dismissed, "Đã đối chiếu, chứng chỉ hợp lệ"));

        đãChốt.Status.Should().Be(ProfileReportStatuses.Dismissed);
        đãChốt.ReviewedBy.Should().Be(admin.Id);
        đãChốt.ReviewedAt.Should().NotBeNull(
            "dòng đã chốt phải nói được ai chốt và lúc nào — đây là dữ liệu dùng để đối chất "
            + "khi KTV khiếu nại việc hồ sơ bị gỡ");

        var cònChờ = await Service().ListAsync(ProfileReportStatuses.Pending, 1, 1000);
        cònChờ.Items.Should().NotContain(i => i.Report.Id == báoCáo.Id);
    }

    [Fact]
    public async Task Chốt_hai_lần_thì_lần_sau_bị_từ_chối()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var admin = await TestData.CreateUserAsync(db, UserRoles.Admin);
        var adminKhác = await TestData.CreateUserAsync(db, UserRoles.Admin);

        var báoCáo = await Service().CreateAsync(
            new CreateReportDto(ktv.Id, ProfileReportReasons.Impersonation, null), null, Ip, Ua);

        await Service().ResolveAsync(
            báoCáo.Id, admin.Id,
            new ResolveReportDto(ProfileReportStatuses.ActionTaken, "Đã gỡ hồ sơ"));

        var lầnHai = async () => await Service().ResolveAsync(
            báoCáo.Id, adminKhác.Id, new ResolveReportDto(ProfileReportStatuses.Dismissed, null));

        await lầnHai.Should().ThrowAsync<ConflictException>(
            "hai admin mở cùng một hàng đợi là chuyện bình thường; ghi đè im lặng sẽ xoá mất "
            + "quyết định của người vào trước cùng lý do họ đã ghi");
    }

    [Fact]
    public async Task Báo_cáo_được_cả_hồ_sơ_đang_chờ_duyệt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);

        var kếtQuả = await Service().CreateAsync(
            new CreateReportDto(ktv.Id, ProfileReportReasons.Prostitution, null), null, Ip, Ua);

        kếtQuả.Id.Should().NotBeEmpty(
            "hồ sơ vừa bị gỡ xuống PENDING vì nghi vấn chính là hồ sơ cần thêm bằng chứng nhất");
    }

    [Fact]
    public async Task Báo_cáo_hồ_sơ_không_tồn_tại_trả_về_không_tìm_thấy()
    {
        var gọi = async () => await Service().CreateAsync(
            new CreateReportDto(Guid.NewGuid(), ProfileReportReasons.Other, "Mô tả"), null, Ip, Ua);

        await gọi.Should().ThrowAsync<NotFoundException>();
    }
}
