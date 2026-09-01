/**
 * Nhúng structured data schema.org.
 *
 * Render ở server cùng HTML đầu tiên, không chèn bằng JS sau khi tải: Googlebot
 * có render JS nhưng xếp hàng đợi riêng và có thể chậm nhiều ngày — với trang
 * dựa vào rich result thì đó là mất hiển thị trong suốt thời gian chờ.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Nội dung do server sinh từ dữ liệu API, không phải input người dùng thô.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
