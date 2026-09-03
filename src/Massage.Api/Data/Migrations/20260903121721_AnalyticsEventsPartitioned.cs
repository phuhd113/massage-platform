using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Bảng sự kiện hiển thị của KTV — nguồn cho phễu "hiện ra → xem hồ sơ → liên hệ"
    /// trên dashboard, và là bằng chứng để KTV quyết định có gia hạn gói đẩy tin hay không.
    ///
    /// <b>Partition theo tháng ngay từ đầu, không phải bảng thường rồi chuyển sau.</b>
    /// Đây là bảng ghi nhiều nhất hệ thống (mỗi lượt tìm kiếm trả 20 KTV là 20 dòng
    /// impression) trong khi mỗi hàng chỉ có ý nghĩa vài tuần. Chuyển một bảng đang có
    /// hàng triệu dòng sống sang partition đòi hỏi chép toàn bộ dữ liệu và khoá bảng —
    /// làm ngay bây giờ, lúc nó còn rỗng, là lúc rẻ nhất và cũng là lúc duy nhất rẻ.
    ///
    /// Ba điều của bảng partition khác bảng thường, đều bắt buộc chứ không phải tuỳ chọn:
    ///
    /// 1. <b>PRIMARY KEY phải chứa cột phân mảnh.</b> Postgres không ép được tính duy nhất
    ///    xuyên partition nếu khoá không nói được hàng nằm ở partition nào, nên khoá là
    ///    <c>(id, created_at)</c> chứ không phải <c>id</c>. Không phải lựa chọn thẩm mỹ —
    ///    <c>PRIMARY KEY (id)</c> trần bị từ chối thẳng.
    ///
    /// 2. <b>Không có khoá ngoại tới <c>ktv_profiles</c></b> (khác <c>leads</c>). Khoá ngoại
    ///    từ bảng partition phải khai lại ở từng partition, nên job tạo partition hằng
    ///    tháng sẽ phải nhớ làm đúng điều đó mãi mãi — quên một tháng là mất ràng buộc
    ///    trong im lặng. Đây là dữ liệu đo đếm: một dòng trỏ tới KTV đã xoá là rác vô hại
    ///    và tự biến mất khi partition bị drop.
    ///
    /// 3. <b>Index khai trên bảng cha</b> thì Postgres 11+ tự tạo bản tương ứng cho mọi
    ///    partition, kể cả partition tạo sau. Khai riêng ở từng partition là tự nhận việc
    ///    giữ chúng khớp nhau.
    /// </summary>
    public partial class AnalyticsEventsPartitioned : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE analytics_events (
                    id          UUID NOT NULL DEFAULT gen_random_uuid(),
                    type        VARCHAR(20) NOT NULL,
                    ktv_id      UUID NOT NULL,
                    area_id     UUID,
                    position    INT,
                    viewer_hash VARCHAR(64),
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

                    -- Cột phân mảnh bắt buộc nằm trong khoá chính (xem ghi chú ở trên).
                    CONSTRAINT pk_analytics_events PRIMARY KEY (id, created_at),

                    CONSTRAINT chk_analytics_event_type
                        CHECK (type IN ('IMPRESSION', 'VIEW', 'LEAD')),

                    -- position chỉ có nghĩa với IMPRESSION. Ép ở DB chứ không chỉ ở code:
                    -- một dòng VIEW mang position sẽ làm mọi phép tính "hạng trung bình"
                    -- lệch đi mà không có gì báo.
                    CONSTRAINT chk_analytics_position
                        CHECK (position IS NULL OR type = 'IMPRESSION')
                ) PARTITION BY RANGE (created_at);

                -- Truy vấn dashboard luôn là "một KTV, loại sự kiện này, trong khoảng thời
                -- gian này" — thứ tự cột theo đúng hình dạng đó. Thiếu vế thời gian trong
                -- index thì bảng ghi nhiều nhất hệ thống bị quét toàn bộ mỗi lần mở dashboard.
                CREATE INDEX idx_analytics_ktv_type_time
                    ON analytics_events (ktv_id, type, created_at DESC);

                -- Gộp lượt lặp: tra "người xem này đã xem KTV này trong 30 phút qua chưa".
                -- Partial vì chỉ dòng có hash mới được gộp, và impression thì không gộp.
                CREATE INDEX idx_analytics_dedupe
                    ON analytics_events (ktv_id, viewer_hash, created_at DESC)
                    WHERE viewer_hash IS NOT NULL;

                -- Hiệu quả gói theo khu vực: "gói mua ở Quận 7 có làm tôi hiện ra nhiều
                -- hơn ở Quận 7 không". Partial vì chỉ impression tìm theo khu vực mới có.
                CREATE INDEX idx_analytics_area_time
                    ON analytics_events (area_id, created_at DESC)
                    WHERE area_id IS NOT NULL;
                """);

            // Partition mặc định: bắt mọi hàng không rơi vào tháng nào đã tạo.
            //
            // Không có nó thì thiếu một partition là INSERT **lỗi** — tức là mất số liệu,
            // và tệ hơn, nếu đường ghi không nuốt lỗi thì hỏng luôn chức năng gọi nó.
            // Có nó thì dữ liệu vẫn vào được, chỉ nằm sai chỗ và sẽ được job dọn.
            //
            // Đây là lưới an toàn, không phải chỗ để dựa vào: hàng nằm trong default
            // partition không được hưởng partition pruning, và quan trọng hơn, sự tồn tại
            // của một hàng ở đó **chặn** việc tạo partition cho chính tháng nó thuộc về.
            // Vì vậy job hằng tháng phải cảnh báo khi thấy nó không rỗng.
            migrationBuilder.Sql("""
                CREATE TABLE analytics_events_default PARTITION OF analytics_events DEFAULT;
                """);

            // Tạo sẵn partition cho tháng này và vài tháng tới. Job Hangfire lo phần duy
            // trì về sau, nhưng migration không được để lại một bảng chưa ghi được ngay
            // sau khi chạy — thời điểm job chạy lần đầu là sau khi app đã lên.
            migrationBuilder.Sql("""
                DO $$
                DECLARE
                    m DATE := date_trunc('month', now())::date;
                    i INT;
                BEGIN
                    FOR i IN 0..3 LOOP
                        EXECUTE format(
                            'CREATE TABLE IF NOT EXISTS analytics_events_%s '
                            || 'PARTITION OF analytics_events FOR VALUES FROM (%L) TO (%L)',
                            to_char(m + (i || ' month')::interval, 'YYYY_MM'),
                            (m + (i || ' month')::interval)::date,
                            (m + ((i + 1) || ' month')::interval)::date);
                    END LOOP;
                END $$;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder) =>
            // Drop bảng cha kéo theo mọi partition — không cần liệt kê từng tháng, và
            // cũng không thể liệt kê được vì tên phụ thuộc thời điểm chạy.
            migrationBuilder.Sql("DROP TABLE IF EXISTS analytics_events CASCADE;");
    }
}
