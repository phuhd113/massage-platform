using FluentAssertions;
using Massage.Api.Modules.KtvProfiles;

namespace Massage.Api.Tests;

public class SlugHelperTests
{
    [Theory]
    [InlineData("Nguyễn Thị Hồng Ánh", "nguyen-thi-hong-anh")]
    [InlineData("Trần Văn Đức", "tran-van-duc")]
    [InlineData("Quận 1", "quan-1")]
    [InlineData("TP. Hồ Chí Minh", "tp-ho-chi-minh")]
    public void Bỏ_dấu_tiếng_Việt_và_nối_bằng_gạch_ngang(string input, string expected) =>
        SlugHelper.ToSlug(input).Should().Be(expected);

    [Fact]
    public void Xử_lý_được_chữ_đ_vốn_không_tách_được_bằng_chuẩn_hoá_Unicode() =>
        SlugHelper.ToSlug("Đặng Đình Đạt").Should().Be("dang-dinh-dat");

    [Fact]
    public void Không_để_lại_gạch_ngang_thừa_ở_hai_đầu() =>
        SlugHelper.ToSlug("  --- Massage trị liệu !!! ").Should().Be("massage-tri-lieu");

    [Fact]
    public void Cắt_slug_quá_dài_nhưng_không_để_kết_thúc_bằng_gạch_ngang()
    {
        var slug = SlugHelper.ToSlug(string.Join(" ", Enumerable.Repeat("nguyen", 40)));

        slug.Length.Should().BeLessThanOrEqualTo(120);
        slug.Should().NotEndWith("-");
    }
}
