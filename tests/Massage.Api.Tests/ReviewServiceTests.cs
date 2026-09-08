using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Leads;
using Massage.Api.Modules.Leads.Entities;
using Massage.Api.Modules.Reviews;
using Massage.Api.Modules.Reviews.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class ReviewServiceTests(PostgresFixture fixture)
{
    private ReviewService Service() => new(fixture.CreateContext());

    [Fact]
    public async Task Đánh_giá_mới_cập_nhật_lại_rating_của_KTV()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var khách1 = await TestData.CreateUserAsync(db, UserRoles.Customer);
        var khách2 = await TestData.CreateUserAsync(db, UserRoles.Customer);

        await Service().CreateAsync(ktv.Id, khách1.Id, new CreateReviewDto(5, "Rất hài lòng"));
        await Service().CreateAsync(ktv.Id, khách2.Id, new CreateReviewDto(4, null));

        // Đọc bằng context mới: RecomputeRating dùng ExecuteUpdate, ghi thẳng xuống
        // DB và bỏ qua change tracker — đọc lại qua context cũ sẽ trúng bản ghi cũ.
        await using var fresh = fixture.CreateContext();
        var updated = await fresh.KtvProfiles.AsNoTracking().FirstAsync(k => k.Id == ktv.Id);

        updated.RatingCount.Should().Be(2);
        updated.RatingAvg.Should().Be(4.50m);
    }

    [Fact]
    public async Task Một_tài_khoản_chỉ_đánh_giá_một_KTV_một_lần()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var khách = await TestData.CreateUserAsync(db, UserRoles.Customer);

        await Service().CreateAsync(ktv.Id, khách.Id, new CreateReviewDto(5, null));

        var lầnHai = async () => await Service().CreateAsync(ktv.Id, khách.Id, new CreateReviewDto(1, "spam"));

        await lầnHai.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Không_thể_tự_đánh_giá_hồ_sơ_của_chính_mình()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var tựĐánhGiá = async () =>
            await Service().CreateAsync(ktv.Id, ktv.UserId, new CreateReviewDto(5, "Tôi tuyệt vời"));

        await tựĐánhGiá.Should().ThrowAsync<BadRequestException>();
    }

    [Fact]
    public async Task Không_đánh_giá_được_hồ_sơ_chưa_duyệt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);
        var khách = await TestData.CreateUserAsync(db, UserRoles.Customer);

        var thử = async () => await Service().CreateAsync(ktv.Id, khách.Id, new CreateReviewDto(5, null));

        await thử.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Gỡ_đánh_giá_thì_rating_được_tính_lại_không_còn_dấu_vết()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var khách = await TestData.CreateUserAsync(db, UserRoles.Customer);
        var admin = await TestData.CreateUserAsync(db, UserRoles.Admin);

        var review = await Service().CreateAsync(ktv.Id, khách.Id, new CreateReviewDto(1, "nội dung vi phạm"));
        await Service().ModerateAsync(review.Id, admin.Id,
            new ModerateReviewDto(ReviewStatuses.Rejected, "Nội dung vi phạm quy định"));

        await using var fresh = fixture.CreateContext();
        var updated = await fresh.KtvProfiles.AsNoTracking().FirstAsync(k => k.Id == ktv.Id);

        updated.RatingCount.Should().Be(0);
        updated.RatingAvg.Should().Be(0m);
    }

    [Fact]
    public async Task Danh_sách_công_khai_không_chứa_đánh_giá_đã_bị_gỡ()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var giữLại = await TestData.CreateUserAsync(db, UserRoles.Customer);
        var bịGỡ = await TestData.CreateUserAsync(db, UserRoles.Customer);
        var admin = await TestData.CreateUserAsync(db, UserRoles.Admin);

        await Service().CreateAsync(ktv.Id, giữLại.Id, new CreateReviewDto(5, "tốt"));
        var xấu = await Service().CreateAsync(ktv.Id, bịGỡ.Id, new CreateReviewDto(1, "vi phạm"));
        await Service().ModerateAsync(xấu.Id, admin.Id,
            new ModerateReviewDto(ReviewStatuses.Rejected, "Nội dung vi phạm quy định"));

        var list = await Service().ListPublishedAsync(ktv.Id, 1, 10);

        list.Total.Should().Be(1);
        list.Items.Should().ContainSingle().Which.Comment.Should().Be("tốt");
    }

    [Fact]
    public async Task Người_viết_vẫn_thấy_đánh_giá_của_mình_sau_khi_bị_gỡ()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var khách = await TestData.CreateUserAsync(db, UserRoles.Customer);
        var admin = await TestData.CreateUserAsync(db, UserRoles.Admin);

        var đánhGiá = await Service().CreateAsync(ktv.Id, khách.Id, new CreateReviewDto(2, "không hài lòng"));
        await Service().ModerateAsync(đánhGiá.Id, admin.Id,
            new ModerateReviewDto(ReviewStatuses.Rejected, "Ngôn từ không phù hợp"));

        var củaTôi = await Service().ListMineAsync(khách.Id);

        var dòng = củaTôi.Should().ContainSingle().Subject;
        dòng.Status.Should().Be(
            ReviewStatuses.Rejected,
            "đánh giá bị gỡ mà biến mất khỏi trang tài khoản thì người viết sẽ viết lại — "
            + "rồi nhận 409 vì ràng buộc một tài khoản một KTV");
        dòng.RejectionReason.Should().Be("Ngôn từ không phù hợp");
    }

    [Fact]
    public async Task Chỉ_thấy_đánh_giá_của_chính_mình()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var tôi = await TestData.CreateUserAsync(db, UserRoles.Customer);
        var ngườiKhác = await TestData.CreateUserAsync(db, UserRoles.Customer);

        await Service().CreateAsync(ktv.Id, tôi.Id, new CreateReviewDto(5, "của tôi"));
        await Service().CreateAsync(ktv.Id, ngườiKhác.Id, new CreateReviewDto(3, "của người khác"));

        var củaTôi = await Service().ListMineAsync(tôi.Id);

        củaTôi.Should().ContainSingle().Which.Comment.Should().Be("của tôi");
    }

    [Fact]
    public async Task Đánh_giá_kèm_tên_và_slug_KTV_để_dựng_được_link_ngược()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var khách = await TestData.CreateUserAsync(db, UserRoles.Customer);

        await Service().CreateAsync(ktv.Id, khách.Id, new CreateReviewDto(4, null));

        var dòng = (await Service().ListMineAsync(khách.Id)).Should().ContainSingle().Subject;

        // URL hồ sơ là /ktv/{slug}-{id} nên thiếu một trong hai là dòng đánh giá
        // không bấm về được hồ sơ đã đánh giá.
        dòng.KtvFullName.Should().Be(ktv.FullName);
        dòng.KtvSlug.Should().Be(ktv.Slug);
    }

    [Fact]
    public async Task Chưa_đánh_giá_ai_thì_trả_về_danh_sách_rỗng()
    {
        await using var db = fixture.CreateContext();
        var mới = await TestData.CreateUserAsync(db, UserRoles.Customer);

        var củaTôi = await Service().ListMineAsync(mới.Id);

        củaTôi.Should().BeEmpty("tài khoản mới chưa viết gì là trạng thái bình thường, không phải lỗi");
    }

    [Fact]
    public async Task Đánh_giá_gắn_được_lead_khi_khách_đã_từng_liên_hệ()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var khách = await TestData.CreateUserAsync(db, UserRoles.Customer);

        var leads = new LeadService(fixture.CreateContext(), new FakeAnalyticsQueue());
        await leads.CreateAsync(
            new CreateLeadDto(ktv.Id, LeadChannels.Call, null, null),
            khách.Id, "203.0.113.9", "test-agent");

        await Service().CreateAsync(ktv.Id, khách.Id, new CreateReviewDto(5, "đã dùng thật"));

        var hàngĐợi = await Service().ListForModerationAsync(unverifiedOnly: false, 1, 200);
        var dòng = hàngĐợi.Items.Single(i => i.KtvId == ktv.Id);

        dòng.HasLead.Should().BeTrue(
            "lead có customer_user_id là bằng chứng người viết từng thật sự liên hệ — "
            + "đó là thứ phân biệt đánh giá thật với tài khoản vừa lập để bơm sao");

        // Hàng đợi rà soát cũng phải dựng được link về hồ sơ công khai: admin đọc
        // một nhận xét đáng ngờ thì việc tiếp theo luôn là mở hồ sơ ra xem. Thiếu
        // slug là frontend nhận `undefined` rồi ghép ra đường dẫn trông vẫn hợp lệ.
        dòng.KtvSlug.Should().Be(ktv.Slug);
    }

    [Fact]
    public async Task Đánh_giá_không_có_lead_vẫn_được_đăng()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var khách = await TestData.CreateUserAsync(db, UserRoles.Customer);

        var kếtQuả = await Service().CreateAsync(ktv.Id, khách.Id, new CreateReviewDto(4, null));

        kếtQuả.Status.Should().Be(
            ReviewStatuses.Published,
            "phần lớn khách bấm gọi lúc chưa đăng nhập nên lead ẩn danh và không bao giờ khớp; "
            + "chặn họ đánh giá là cắt mất gần hết nguồn đánh giá thật");
    }

    [Fact]
    public async Task Hàng_đợi_rà_soát_lọc_được_đánh_giá_không_gắn_lead()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var cóLead = await TestData.CreateUserAsync(db, UserRoles.Customer);
        var khôngLead = await TestData.CreateUserAsync(db, UserRoles.Customer);

        var leads = new LeadService(fixture.CreateContext(), new FakeAnalyticsQueue());
        await leads.CreateAsync(
            new CreateLeadDto(ktv.Id, LeadChannels.Call, null, null),
            cóLead.Id, "203.0.113.10", "test-agent");

        await Service().CreateAsync(ktv.Id, cóLead.Id, new CreateReviewDto(5, "thật"));
        await Service().CreateAsync(ktv.Id, khôngLead.Id, new CreateReviewDto(5, "chưa rõ"));

        var lọc = await Service().ListForModerationAsync(unverifiedOnly: true, 1, 200);
        var củaKtvNày = lọc.Items.Where(i => i.KtvId == ktv.Id).ToList();

        củaKtvNày.Should().ContainSingle().Which.Comment.Should().Be("chưa rõ");
    }

    [Fact]
    public async Task Hàng_đợi_xếp_đánh_giá_chưa_gắn_lead_lên_trước()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var cóLead = await TestData.CreateUserAsync(db, UserRoles.Customer);
        var khôngLead = await TestData.CreateUserAsync(db, UserRoles.Customer);

        var leads = new LeadService(fixture.CreateContext(), new FakeAnalyticsQueue());
        await leads.CreateAsync(
            new CreateLeadDto(ktv.Id, LeadChannels.Call, null, null),
            cóLead.Id, "203.0.113.11", "test-agent");

        // Dòng có lead viết TRƯỚC, nên xếp thuần theo thời gian thì nó đứng đầu.
        await Service().CreateAsync(ktv.Id, cóLead.Id, new CreateReviewDto(5, "co-lead"));
        await Service().CreateAsync(ktv.Id, khôngLead.Id, new CreateReviewDto(1, "khong-lead"));

        var hàngĐợi = await Service().ListForModerationAsync(unverifiedOnly: false, 1, 200);
        var củaKtvNày = hàngĐợi.Items.Where(i => i.KtvId == ktv.Id).ToList();

        củaKtvNày[0].Comment.Should().Be(
            "khong-lead",
            "admin đọc từ trên xuống, nên thứ đáng nhìn trước phải nằm trên — "
            + "xếp theo thời gian thì dòng đáng ngờ lẫn vào giữa những dòng bình thường");
    }
}
