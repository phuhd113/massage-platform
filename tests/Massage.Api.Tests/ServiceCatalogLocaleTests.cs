using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Massage.Api.Data;
using Massage.Api.Modules.ServiceCatalog.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Massage.Api.Tests;

/// <summary>
/// Bản dịch tiếng Anh của danh mục dịch vụ — nội dung nằm trên trang SEO
/// /en/dich-vu/{slug}, nên thiếu nó là H1 của trang tiếng Anh hiện tiếng Việt.
///
/// Trọng tâm là <b>nhánh backfill</b> của seeder. Mọi môi trường đã seed trước khi
/// có cột EN đều rơi vào đúng nhánh đó, và nếu nó sai thì hỏng hoàn toàn im lặng:
/// seeder báo "thêm mới 0/10" — đọc y hệt một lượt chạy thành công — trong khi cột
/// EN vĩnh viễn NULL và không có gì trên đường đọc báo lỗi.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ServiceCatalogLocaleTests(PostgresFixture fixture)
{
    private static Task SeedAsync(AppDbContext db) =>
        ServiceSeeder.SeedAsync(db, NullLogger.Instance);

    [Fact]
    public async Task Seed_lần_đầu_nạp_luôn_bản_tiếng_Anh()
    {
        await using var db = fixture.CreateContext();
        await db.Services.Where(s => s.Slug == "bam-huyet").ExecuteDeleteAsync();

        await SeedAsync(db);

        await using var đọc = fixture.CreateContext();
        var dịchVụ = await đọc.Services.SingleAsync(s => s.Slug == "bam-huyet");
        dịchVụ.NameEn.Should().Be("Acupressure");
        dịchVụ.DescriptionEn.Should().NotBeNullOrWhiteSpace();
    }

    /// <remarks>
    /// Đây là ca thật của mọi môi trường đang chạy: hàng đã tồn tại từ trước khi có
    /// cột EN. Seeder cũ <c>continue</c> ngay khi thấy slug trùng, nên bản dịch không
    /// bao giờ tới nơi.
    /// </remarks>
    [Fact]
    public async Task Hàng_đã_có_từ_trước_vẫn_được_bổ_sung_bản_dịch()
    {
        await using var db = fixture.CreateContext();
        await db.Services.Where(s => s.Slug == "giac-hoi").ExecuteDeleteAsync();
        db.Services.Add(new Service
        {
            Name = "Giác hơi",
            Slug = "giac-hoi",
            Description = "Mô tả cũ có sẵn trong DB.",
            SortOrder = 9,
        });
        await db.SaveChangesAsync();

        await using (var chạy = fixture.CreateContext()) await SeedAsync(chạy);

        await using var đọc = fixture.CreateContext();
        var dịchVụ = await đọc.Services.SingleAsync(s => s.Slug == "giac-hoi");
        dịchVụ.NameEn.Should().Be("Cupping");
        dịchVụ.DescriptionEn.Should().NotBeNullOrWhiteSpace();
    }

    /// <remarks>
    /// Đảo ngược từ quyết định ban đầu (2026-09-15): mô tả VI+EN giờ được **ghi đè**,
    /// cùng lý do với SortOrder — <c>Data</c> trong <see cref="ServiceSeeder"/> là
    /// nguồn sự thật duy nhất cho nội dung biên tập, không còn sửa tay trực tiếp trên
    /// DB. Lý do đảo: bản mô tả một câu ban đầu cần thay bằng bản mở rộng, và giữ
    /// <c>??=</c> sẽ khiến mọi môi trường đã seed trước đó không bao giờ nhận được
    /// nội dung mới — seeder báo "thêm mới 0" và trông y hệt một lượt chạy thành công.
    /// </remarks>
    [Fact]
    public async Task Ghi_đè_nội_dung_tiếng_Việt_đã_lỗi_thời()
    {
        await using var db = fixture.CreateContext();
        await db.Services.Where(s => s.Slug == "massage-thai").ExecuteDeleteAsync();
        db.Services.Add(new Service
        {
            Name = "Massage Thái",
            Slug = "massage-thai",
            Description = "Mô tả cũ trước đợt mở rộng nội dung.",
            SortOrder = 4,
        });
        await db.SaveChangesAsync();

        await using (var chạy = fixture.CreateContext()) await SeedAsync(chạy);

        await using var đọc = fixture.CreateContext();
        var dịchVụ = await đọc.Services.SingleAsync(s => s.Slug == "massage-thai");
        dịchVụ.Description.Should().NotBe("Mô tả cũ trước đợt mở rộng nội dung.");
        dịchVụ.NameEn.Should().Be("Thai massage");
    }

    /// <remarks>
    /// Bản dịch cũng là nội dung biên tập, nên nó theo cùng luật ghi đè với bản
    /// tiếng Việt — xem <see cref="Ghi_đè_nội_dung_tiếng_Việt_đã_lỗi_thời"/>.
    /// </remarks>
    [Fact]
    public async Task Ghi_đè_bản_dịch_đã_lỗi_thời()
    {
        await using var db = fixture.CreateContext();
        await db.Services.Where(s => s.Slug == "massage-chan").ExecuteDeleteAsync();
        db.Services.Add(new Service
        {
            Name = "Massage chân",
            Slug = "massage-chan",
            NameEn = "Foot and leg massage",
            DescriptionEn = "Bản dịch cũ trước đợt mở rộng nội dung.",
            SortOrder = 6,
        });
        await db.SaveChangesAsync();

        await using (var chạy = fixture.CreateContext()) await SeedAsync(chạy);

        await using var đọc = fixture.CreateContext();
        var dịchVụ = await đọc.Services.SingleAsync(s => s.Slug == "massage-chan");
        dịchVụ.NameEn.Should().Be("Foot and leg massage");
        dịchVụ.DescriptionEn.Should().NotBe("Bản dịch cũ trước đợt mở rộng nội dung.");
    }

    [Fact]
    public async Task Chạy_lại_nhiều_lần_không_nhân_bản_dòng_nào()
    {
        await using (var lần1 = fixture.CreateContext()) await SeedAsync(lần1);
        await using (var lần2 = fixture.CreateContext()) await SeedAsync(lần2);

        await using var đọc = fixture.CreateContext();
        var số = await đọc.Services.CountAsync(s => s.Slug == "massage-tri-lieu");
        số.Should().Be(1);
    }

    /// <remarks>
    /// Dịch vụ ngừng bán 2026-09-15. Tắt <c>IsActive</c> chứ không xoá hàng — kiểm cả
    /// việc hàng vẫn còn tồn tại (không mất dữ liệu KTV đã tham chiếu) lẫn việc nó
    /// không lọt ra đường đọc công khai nữa.
    /// </remarks>
    [Fact]
    public async Task Dịch_vụ_ngừng_bán_bị_tắt_IsActive_nhưng_không_bị_xoá()
    {
        await using var db = fixture.CreateContext();
        await db.Services.Where(s => s.Slug == "xong-hoi-thao-duoc").ExecuteDeleteAsync();
        db.Services.Add(new Service
        {
            Name = "Xông hơi thảo dược",
            Slug = "xong-hoi-thao-duoc",
            SortOrder = 99,
            IsActive = true,
        });
        await db.SaveChangesAsync();

        await using (var chạy = fixture.CreateContext()) await SeedAsync(chạy);

        await using var đọc = fixture.CreateContext();
        var dịchVụ = await đọc.Services.SingleAsync(s => s.Slug == "xong-hoi-thao-duoc");
        dịchVụ.IsActive.Should().BeFalse();

        await using var api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        var res = await api.CreateClient().GetAsync("/api/v1/services");
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        json.EnumerateArray().Any(s => s.GetProperty("slug").GetString() == "xong-hoi-thao-duoc")
            .Should().BeFalse();
    }

    /// <remarks>
    /// Kiểm qua HTTP chứ không gọi thẳng <c>ToDto</c>: thứ cần bảo vệ là payload
    /// frontend thật sự nhận. Serializer đổi tên trường (camelCase) trên đường ra,
    /// nên một test gọi thẳng hàm dựng DTO vẫn xanh khi tên trường tới nơi đã khác.
    ///
    /// Trả **cả hai** ngôn ngữ thay vì nhận tham số locale là có chủ đích: frontend
    /// cache ở tầng fetch theo URL, nên <c>?locale=</c> sẽ tạo hai cache key cho cùng
    /// một dữ liệu và nhân đôi lượt gọi backend mỗi khi ISR revalidate.
    /// </remarks>
    [Fact]
    public async Task Endpoint_danh_mục_trả_cả_hai_ngôn_ngữ_trong_một_lượt_gọi()
    {
        await using (var chạy = fixture.CreateContext()) await SeedAsync(chạy);

        await using var api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        var res = await api.CreateClient().GetAsync("/api/v1/services");

        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await res.Content.ReadFromJsonAsync<JsonElement>();
        var dịchVụ = json.EnumerateArray()
            .Single(s => s.GetProperty("slug").GetString() == "massage-tri-lieu");

        dịchVụ.GetProperty("name").GetString().Should().Be("Massage trị liệu");
        dịchVụ.GetProperty("nameEn").GetString().Should().Be("Therapeutic massage");
        dịchVụ.GetProperty("descriptionEn").GetString().Should().NotBeNullOrWhiteSpace();
    }
}
