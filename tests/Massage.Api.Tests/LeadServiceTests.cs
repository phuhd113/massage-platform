using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Leads;
using Massage.Api.Modules.Leads.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class LeadServiceTests(PostgresFixture fixture)
{
    private LeadService Service() => new(fixture.CreateContext());

    private const string Ip = "203.0.113.10";
    private const string Agent = "Mozilla/5.0 (iPhone)";

    [Fact]
    public async Task Ghi_nhận_lượt_bấm_gọi_và_tăng_bộ_đếm_của_KTV()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var result = await Service().CreateAsync(
            new CreateLeadDto(ktv.Id, LeadChannels.Call, null, "/ktv/abc"), null, Ip, Agent);

        result.Deduplicated.Should().BeFalse();

        // lead_count tăng bằng ExecuteUpdate nên phải đọc lại bằng context sạch.
        await using var fresh = fixture.CreateContext();
        var updated = await fresh.KtvProfiles.AsNoTracking().FirstAsync(k => k.Id == ktv.Id);
        updated.LeadCount.Should().Be(1);
    }

    [Fact]
    public async Task Cùng_thiết_bị_bấm_lại_ngay_sau_đó_chỉ_tính_một_lead()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var dto = new CreateLeadDto(ktv.Id, LeadChannels.Call, null, null);

        var lần1 = await Service().CreateAsync(dto, null, Ip, Agent);
        var lần2 = await Service().CreateAsync(dto, null, Ip, Agent);

        lần2.Deduplicated.Should().BeTrue();
        lần2.Id.Should().Be(lần1.Id, "gọi hụt rồi bấm lại là một nhu cầu, không phải hai");

        await using var fresh = fixture.CreateContext();
        (await fresh.Leads.CountAsync(l => l.KtvId == ktv.Id)).Should().Be(1);
        (await fresh.KtvProfiles.AsNoTracking().FirstAsync(k => k.Id == ktv.Id)).LeadCount.Should().Be(1);
    }

    [Fact]
    public async Task Hai_thiết_bị_khác_nhau_là_hai_lead_riêng()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var dto = new CreateLeadDto(ktv.Id, LeadChannels.Call, null, null);

        await Service().CreateAsync(dto, null, Ip, Agent);
        var kháchKhác = await Service().CreateAsync(dto, null, "198.51.100.7", "Mozilla/5.0 (Android)");

        kháchKhác.Deduplicated.Should().BeFalse();

        await using var fresh = fixture.CreateContext();
        (await fresh.Leads.CountAsync(l => l.KtvId == ktv.Id)).Should().Be(2);
    }

    [Fact]
    public async Task Kênh_liên_hệ_khác_nhau_không_bị_gộp()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        await Service().CreateAsync(new CreateLeadDto(ktv.Id, LeadChannels.Call, null, null), null, Ip, Agent);
        var zalo = await Service().CreateAsync(new CreateLeadDto(ktv.Id, LeadChannels.Zalo, null, null), null, Ip, Agent);

        zalo.Deduplicated.Should().BeFalse("gọi điện rồi nhắn Zalo là hai hành vi khác nhau");
    }

    [Fact]
    public async Task Số_điện_thoại_chỉ_lộ_ra_cùng_lúc_với_việc_ghi_nhận_lead()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        var phone = await db.Users.Where(u => u.Id == ktv.UserId).Select(u => u.Phone).FirstAsync();

        var result = await Service().CreateAsync(
            new CreateLeadDto(ktv.Id, LeadChannels.Call, null, null), null, Ip, Agent);

        // Không có đường nào lấy số mà không đi qua đây — nếu số nằm sẵn trong hồ sơ
        // công khai thì vừa bị quét hàng loạt, vừa có lượt liên hệ không được đếm.
        result.Phone.Should().Be(phone);
    }

    [Fact]
    public async Task Không_ghi_lead_cho_hồ_sơ_chưa_duyệt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);

        var thử = async () => await Service().CreateAsync(
            new CreateLeadDto(ktv.Id, LeadChannels.Call, null, null), null, Ip, Agent);

        await thử.Should().ThrowAsync<NotFoundException>();
    }
}
