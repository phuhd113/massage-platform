using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Mở danh mục khu vực từ 2 thành phố (23 dòng) ra toàn quốc: 63 tỉnh, 696
    /// quận/huyện, ~10.000 phường/xã — theo cơ cấu hành chính **trước sáp nhập 2025**,
    /// vì URL /massage-tai-nha/{tinh}/{quan} đã được index và là kênh acquisition chính.
    ///
    /// Migration này chỉ đổi schema. Dữ liệu vào bằng lệnh <c>seed-areas</c> đã có:
    /// 10.700 dòng nằm trong migration sẽ làm <c>database update 0</c> chậm và mong manh,
    /// và migration nên diễn đạt schema chứ không phải catalog.
    ///
    /// Thay đổi cốt lõi là **ràng buộc duy nhất**. <c>uq_area_slug_level (slug, level)</c>
    /// bắt slug duy nhất toàn cục theo cấp — điều đó đúng với 21 quận của hai thành phố
    /// nhưng sai với cả nước: "Huyện Châu Thành" có ở 11+ tỉnh. Giữ nguyên nó thì seeder
    /// (khớp theo slug) sẽ **âm thầm gắn quận vào nhầm tỉnh** thay vì báo lỗi, và mọi
    /// coverage/campaign của những quận đó trỏ sai khu vực.
    /// </summary>
    public partial class AreasNationwide : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE administrative_areas DROP CONSTRAINT uq_area_slug_level;

                -- Quận/huyện và phường/xã: duy nhất trong phạm vi cha.
                ALTER TABLE administrative_areas
                    ADD CONSTRAINT uq_area_parent_slug UNIQUE (parent_id, slug);

                -- Tỉnh có parent_id IS NULL, mà UNIQUE coi mọi NULL là khác nhau, nên
                -- ràng buộc trên KHÔNG chặn được hai tỉnh trùng slug. Partial unique
                -- index là chỗ duy nhất diễn đạt được "duy nhất trong tập gốc".
                -- Thiếu nó thì hai dòng (NULL,'ha-noi') cùng tồn tại được, AreaService
                -- tra ra kết quả không xác định, và hai trang cùng nhận canonical.
                CREATE UNIQUE INDEX uq_area_root_slug
                    ON administrative_areas (slug) WHERE parent_id IS NULL;

                -- Mã đơn vị hành chính của Tổng cục Thống kê: khoá ổn định để seed lại
                -- mà không nhân bản và KHÔNG đổi id — coverage_areas, campaigns,
                -- slot_allocations, leads đều tham chiếu id, xoá rồi tạo lại là làm mồ côi.
                --
                -- Duy nhất theo (level, code) chứ không riêng code: trong dữ liệu thật mã
                -- quận và mã phường đụng nhau ở 226 chỗ (mã quận 3 chữ số, mã phường 5 chữ
                -- số, nhưng hai dãy vẫn giao nhau). Ràng buộc chỉ trên code sẽ gộp nhầm
                -- một quận với một phường ngay lần seed đầu.
                --
                -- Nullable + partial index: khu vực do test tạo ra không có mã, nên ràng
                -- buộc là "mã duy nhất khi có mã".
                ALTER TABLE administrative_areas ADD COLUMN code VARCHAR(10);
                CREATE UNIQUE INDEX uq_area_level_code
                    ON administrative_areas (level, code) WHERE code IS NOT NULL;

                -- Nội dung biên tập riêng cho từng khu vực. Mở toàn quốc sinh ~760 trang
                -- từ đúng một mẫu chỉ thay tên quận — đó là định nghĩa doorway page và
                -- Google phạt cả tên miền. Cờ indexable nay đòi cả hai: đủ KTV VÀ có cột
                -- này. Xem AreaService.MinKtvForIndex.
                ALTER TABLE administrative_areas ADD COLUMN editorial_note TEXT;

                -- Cây khu vực không bao giờ trả về phường (10.000 dòng cho một dropdown),
                -- nên index phục vụ đúng truy vấn đó.
                CREATE INDEX idx_area_tree ON administrative_areas (level, name)
                    WHERE level <> 'WARD';

                -- parent_id chưa từng có index: khoá ngoại ở InitPhase0Schema được viết
                -- bằng raw SQL nên Postgres không tự tạo, dù snapshot của EF tưởng là có.
                -- AreaService tra con theo parent_id ở mọi trang tỉnh và trang quận, nên
                -- thiếu index là seq scan trên bảng ~10.700 dòng mỗi request.
                CREATE INDEX idx_area_parent ON administrative_areas (parent_id);
                """);

            migrationBuilder.Sql(
                """
                -- Địa chỉ cơ sở có cấu trúc. Một khoá ngoại ở cấp mịn nhất (phường) thay
                -- vì ba cột tỉnh/quận/phường: bộ ba có thể lệch nhau mà không ràng buộc
                -- nào chặn được (CHECK cần subquery), trong khi không truy vấn nào lọc
                -- theo địa chỉ cơ sở — search lọc theo coverage_areas, đếm KTV cũng vậy.
                --
                -- base_street là cột MỚI, không tái dụng base_address: tái dụng thì cùng
                -- một cột vừa chứa text tự do (dòng cũ) vừa chứa mỗi tên đường (dòng mới)
                -- mà không phân biệt được. base_address giữ nguyên, drop ở migration sau
                -- khi mọi hồ sơ đã chuyển.
                ALTER TABLE ktv_profiles
                    ADD COLUMN base_ward_id UUID REFERENCES administrative_areas(id),
                    ADD COLUMN base_street  VARCHAR(255);

                CREATE INDEX idx_ktv_base_ward ON ktv_profiles (base_ward_id);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS idx_ktv_base_ward;
                ALTER TABLE ktv_profiles
                    DROP COLUMN IF EXISTS base_street,
                    DROP COLUMN IF EXISTS base_ward_id;
                """);

            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS idx_area_parent;
                DROP INDEX IF EXISTS idx_area_tree;
                ALTER TABLE administrative_areas DROP COLUMN IF EXISTS editorial_note;
                DROP INDEX IF EXISTS uq_area_level_code;
                ALTER TABLE administrative_areas DROP COLUMN IF EXISTS code;
                DROP INDEX IF EXISTS uq_area_root_slug;
                ALTER TABLE administrative_areas DROP CONSTRAINT IF EXISTS uq_area_parent_slug;

                -- Cấu trúc cũ KHÔNG diễn đạt được dữ liệu toàn quốc: hàng trăm quận trùng
                -- slug khác tỉnh, và cả nghìn phường trùng slug. Thêm lại uq_area_slug_level
                -- khi dữ liệu đó còn nằm đó sẽ vỡ vì 23505.
                --
                -- CI chạy down trên DB rỗng nên vẫn xanh; chỗ đau là máy dev đã seed. Nên
                -- rollback phải chủ động vứt phần dữ liệu mà schema cũ không chứa nổi, và
                -- nói thẳng ra điều đó thay vì để lại một constraint không thêm được.
                --
                -- Phường xoá trước vì parent_id tự tham chiếu. Dòng nào còn được
                -- coverage_areas/campaigns/leads trỏ tới sẽ chặn lệnh xoá bằng lỗi khoá
                -- ngoại — đúng như mong muốn: rollback làm mất dữ liệu thật thì phải dừng
                -- lại để người chạy tự quyết, không im lặng xoá theo tầng.
                DELETE FROM administrative_areas WHERE level = 'WARD';

                DELETE FROM administrative_areas a
                 USING administrative_areas b
                 WHERE a.slug = b.slug AND a.level = b.level AND a.created_at > b.created_at;

                ALTER TABLE administrative_areas
                    ADD CONSTRAINT uq_area_slug_level UNIQUE (slug, level);
                """);
        }
    }
}
