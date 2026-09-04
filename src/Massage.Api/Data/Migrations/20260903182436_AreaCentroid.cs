using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Toạ độ tâm của tỉnh và quận/huyện, để suy ngược từ vị trí GPS của khách ra khu
    /// vực hành chính họ đang đứng — nút "Tìm quanh tôi" điền sẵn ô khu vực thay vì để
    /// nó trống trong khi kết quả đã lọc theo toạ độ.
    ///
    /// <b>Centroid, không phải ranh giới — và đó là một đánh đổi có chủ đích.</b> Quận
    /// gần tâm nhất không phải lúc nào cũng là quận chứa điểm đó; sai ở rìa những huyện
    /// dài hoặc lõm. Nhập polygon ranh giới thật (~20–50MB cho 696 quận) sẽ chính xác
    /// tuyệt đối, nhưng cột này chỉ dùng để <b>hiển thị</b> khu vực đang đứng, còn kết
    /// quả tìm kiếm vẫn lọc theo bán kính quanh toạ độ thật. Đổi 50MB dữ liệu địa lý
    /// lấy một nhãn chính xác hơn ở vùng rìa là không đáng — cho tới khi có nhu cầu
    /// quyết định boost theo khu vực từ toạ độ, lúc đó mới cần polygon thật.
    ///
    /// Index GiST là bắt buộc chứ không phải tối ưu: truy vấn tra ngược là
    /// <c>ORDER BY centroid &lt;-&gt; :point LIMIT 1</c>, và không có index thì Postgres
    /// quét toàn bộ 759 dòng mỗi lần bấm — vẫn đúng, chỉ chậm dần theo lượng khách.
    ///
    /// Cột NULL được, cố ý: phường/xã không cần tâm (không có trang khu vực), và hai
    /// huyện đảo Hoàng Sa/Trường Sa không có hình học trong nguồn dữ liệu. Điểm quan
    /// trọng hơn là partial index bên dưới — chỉ index dòng có tâm, nên hàng nghìn
    /// phường NULL không phình cây tìm kiếm.
    /// </summary>
    public partial class AreaCentroid : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE administrative_areas
                  ADD COLUMN centroid geography(Point, 4326);

                CREATE INDEX idx_area_centroid
                  ON administrative_areas USING GIST (centroid)
                  WHERE centroid IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS idx_area_centroid;
                ALTER TABLE administrative_areas DROP COLUMN IF EXISTS centroid;
                """);
        }
    }
}
