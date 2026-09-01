using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
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
}
