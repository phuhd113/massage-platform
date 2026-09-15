import Script from 'next/script';

/**
 * Tracking script của Umami (web analytics tự host tại analytics.masgo.vn).
 *
 * Bảy điều đừng vô tình đảo ngược:
 *
 * - **`strategy="afterInteractive"`, KHÔNG phải `beforeInteractive`.** Trang chủ và trang
 *   hồ sơ là nơi LCP được đo, và LCP là chỉ số xếp hạng của kênh acquisition chính. Một
 *   script chặn render ở đó đánh đổi thứ hạng lấy vài trăm mili giây số liệu sớm hơn.
 *
 * - **Không render gì khi thiếu biến môi trường.** Máy dev và CI không có
 *   `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, và một thẻ `<script src>` trỏ tới host không tồn tại
 *   sẽ nằm trong HTML của mọi trang, hỏng im lặng ở console của mọi người đang phát triển.
 *
 * - **`NEXT_PUBLIC_*` nên BẮT BUỘC là build arg trong Dockerfile.** Next inline chúng vào
 *   bundle lúc build; khai ở `environment:` là quá muộn và triệu chứng là script biến mất
 *   khỏi HTML trong khi build vẫn xanh. Đây là bẫy thứ tư cùng hình dạng với
 *   `NEXT_PUBLIC_MEDIA_BASE_URL` và `NEXT_PUBLIC_SITE_URL` — xem project-status.md.
 *
 * - **`data-domains` giới hạn theo domain production.** Không có nó thì mọi bản build
 *   chạy ở đâu cũng gửi số liệu về cùng một website id: lượt tải trang trên máy dev và
 *   trên môi trường thử nghiệm trộn lẫn vào số liệu thật, và không có cách nào tách ra
 *   sau khi đã ghi.
 *
 * - **KHÔNG đặt cookie, và đó là lý do chọn Umami thay vì GA4.** Vì không có cookie nên
 *   không cần banner đồng ý, và **mục 8 của /chinh-sach-bao-mat không phải sửa** — trang
 *   đó kê đúng ba chỗ dùng browser storage, và thêm chỗ thứ tư mà quên sửa thì chính sách
 *   kê thiếu, tức kê sai. Nếu sau này ai đổi sang một công cụ có cookie, việc sửa mục 8
 *   và dựng banner là **bắt buộc**, không phải tuỳ chọn.
 *
 * - **Không loại trừ đường dẫn nào ở đây.** `/dashboard` và `/admin` nằm dưới route group
 *   khác và không đi qua layout này, nên chúng vốn đã không được đếm — không cần thêm
 *   điều kiện, và thêm vào là dựng một luật thứ hai phải giữ cho khớp với cấu trúc route.
 *
 * - **Host là `analytics.masgo.vn`, cùng tên miền gốc.** Script bên thứ ba ở domain lạ là
 *   thứ các trình chặn quảng cáo nhắm vào đầu tiên; cùng tên miền thì tỉ lệ bị chặn thấp
 *   hơn hẳn, và cũng không tốn thêm một lượt DNS + TLS handshake.
 */
export function Analytics() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC;

  if (!websiteId || !src) return null;

  return (
    <Script
      src={src}
      data-website-id={websiteId}
      data-domains="masgo.vn"
      strategy="afterInteractive"
    />
  );
}
