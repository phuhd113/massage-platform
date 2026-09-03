using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Chuỗi khớp không dấu + index trigram cho ô gợi ý khu vực, thay cho thẻ
    /// <c>&lt;select&gt;</c> phẳng 696 quận/huyện mà khách phải cuộn tay.
    ///
    /// Ba quyết định ở đây, theo thứ tự quan trọng:
    ///
    /// <b>1. Cột vật chất, không phải biểu thức lúc query.</b> <c>unaccent()</c> là
    /// STABLE chứ không IMMUTABLE (từ điển của nó nằm ngoài DB và đổi được), nên
    /// Postgres từ chối dùng nó trong index. Bọc một wrapper IMMUTABLE là nói dối trình
    /// tối ưu. Quan trọng hơn: cột cho phép nhồi alias ("q7") mà không hàm bỏ dấu nào
    /// suy ra được.
    ///
    /// <b>2. Trigger giữ cột, không phải đường ghi ứng dụng.</b> Bảng này có <b>hai</b>
    /// đường ghi: EF (test, admin) và <c>seed-areas</c> — vốn là raw SQL upsert 10.700
    /// dòng, không đi qua EF chút nào. Bắt cả hai cùng nhớ điền một cột dẫn xuất là chỗ
    /// hỏng được đảm bảo: <c>seed-areas</c> chạy lại sẽ báo thành công trong khi ô gợi ý
    /// trả về rỗng — lỗi im lặng, không có test ứng dụng nào nhìn thấy. Trigger làm bất
    /// biến này thành thứ không quên được.
    ///
    /// <b>3. Bỏ dấu bằng <c>unaccent()</c> ở chính hàm dựng cột, không mượn slug.</b>
    /// Bản đầu lấy <c>slug</c> làm phần không dấu vì nó vốn đã không dấu — sai ở chỗ slug
    /// và name là hai thứ độc lập. Với dữ liệu thật chúng khớp nhau, nhưng khu vực do test
    /// hoặc admin tạo có thể mang slug chẳng liên quan gì tới tên, và khi đó gõ không dấu
    /// đúng cái tên đang hiển thị lại không ra gì. Cột phải chứa dạng không dấu của **tên**.
    ///
    /// <c>unaccent()</c> chỉ chạy lúc ghi nên chuyện nó không IMMUTABLE không cản gì ở đây;
    /// thứ được index là cột kết quả, một giá trị text bình thường.
    /// </summary>
    public partial class AreaNameAscii : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE EXTENSION IF NOT EXISTS pg_trgm;
                CREATE EXTENSION IF NOT EXISTS unaccent;

                ALTER TABLE administrative_areas ADD COLUMN name_ascii VARCHAR(400);
                """);

            // Hàm dựng chuỗi khớp. IMMUTABLE để trigger rẻ và để có thể dùng trong index
            // biểu thức về sau nếu cần; nó chỉ đọc tham số, không chạm bảng nào.
            //
            // Alias số quận: khách gõ "q7" nhiều không kém "quan 7". Chỉ áp cho quận đánh
            // số (slug dạng "quan-7"), không suy diễn cho "quan-ba-dinh" — "qbd" không ai gõ.
            migrationBuilder.Sql(
                """
                CREATE OR REPLACE FUNCTION area_name_ascii(p_name TEXT, p_slug TEXT, p_level TEXT)
                RETURNS TEXT
                LANGUAGE sql
                STABLE
                AS $$
                    SELECT
                        -- Dạng không dấu của chính TÊN — thứ khách đang nhìn thấy và gõ lại.
                        -- đ/Đ phải thay tay: trong Unicode nó là một chữ cái riêng chứ không
                        -- phải "d + dấu", nên unaccent() để nguyên. Cùng cái bẫy mà
                        -- SlugHelper.ToSlug đã ghi chú ở phía C#.
                        lower(unaccent(translate(p_name, 'đĐ', 'dD')))
                        -- Bản có dấu, để khách gõ đủ dấu cũng khớp.
                        || ' ' || lower(p_name)
                        -- Slug: giữ lại vì nó là thứ xuất hiện trên URL, khách dán lại được.
                        || ' ' || lower(replace(p_slug, '-', ' '))
                        -- "q7" ngắn bằng nửa "quan 7" và khách gõ nhiều không kém. Chỉ suy
                        -- cho quận đánh số; "quan-ba-dinh" không sinh ra "qbd" vì không ai gõ thế.
                        || COALESCE(
                             CASE WHEN p_level = 'DISTRICT'
                                  THEN ' q' || substring(p_slug from '^quan-([0-9]+)$')
                             END, '');
                $$;

                CREATE OR REPLACE FUNCTION trg_area_name_ascii() RETURNS trigger
                LANGUAGE plpgsql
                AS $$
                BEGIN
                    NEW.name_ascii := area_name_ascii(NEW.name, NEW.slug, NEW.level);
                    RETURN NEW;
                END;
                $$;

                CREATE TRIGGER trg_area_name_ascii
                    BEFORE INSERT OR UPDATE OF name, slug, level ON administrative_areas
                    FOR EACH ROW EXECUTE FUNCTION trg_area_name_ascii();
                """);

            // Backfill các dòng đã có. Chạy sau khi trigger tồn tại là an toàn (trigger chỉ
            // tính lại đúng giá trị này), và câu lệnh idempotent nên migration chạy lại được.
            migrationBuilder.Sql(
                """
                UPDATE administrative_areas
                   SET name_ascii = area_name_ascii(name, slug, level);
                """);

            // GIN trigram phục vụ được LIKE '%...%' — btree thì không, và khách gõ "chau
            // thanh" cần khớp giữa chuỗi chứ không chỉ tiền tố. Bảng ~10.700 dòng còn nhỏ
            // nên tạo index trong transaction của migration không khoá ghi đáng kể;
            // CONCURRENTLY (phải tách migration riêng) chưa cần ở quy mô này.
            migrationBuilder.Sql(
                """
                CREATE INDEX idx_area_name_ascii_trgm
                    ON administrative_areas USING GIN (name_ascii gin_trgm_ops);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Không drop extension pg_trgm: nó có thể đang được schema khác trong cùng
            // database dùng, và để lại một extension thừa vô hại hơn là gỡ mất của người khác.
            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS idx_area_name_ascii_trgm;
                DROP TRIGGER IF EXISTS trg_area_name_ascii ON administrative_areas;
                DROP FUNCTION IF EXISTS trg_area_name_ascii();
                DROP FUNCTION IF EXISTS area_name_ascii(TEXT, TEXT, TEXT);
                ALTER TABLE administrative_areas DROP COLUMN IF EXISTS name_ascii;
                """);
        }
    }
}
