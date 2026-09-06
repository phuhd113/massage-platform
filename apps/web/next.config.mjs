/**
 * Origin phục vụ ảnh hồ sơ KTV.
 *
 * Khi chạy R2 đây là custom domain / r2.dev của bucket; để trống thì backend trả
 * URL tương đối `/uploads/...` và không có host nào cần khai.
 *
 * `next/image` chặn mọi host không nằm trong `remotePatterns` — không có cách khai
 * "cho phép tất cả" nào an toàn, vì nó biến trình tối ưu ảnh thành proxy mở cho cả
 * internet. Vì vậy origin phải có mặt ở đây **lúc build**, không chỉ lúc chạy.
 */
const mediaBaseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Trang public phải render ở server; standalone để image production nhẹ.
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
    // Một entry cho mỗi tiền tố công khai. **Không** gộp bằng brace
    // (`/{avatars,photos}/**`): picomatch hiểu cú pháp đó, nhưng Next khớp
    // `remotePatterns` bằng đường khác và từ chối thẳng với
    // `"url" parameter is not allowed` — ảnh 400, trang vẫn 200, nên lỗi chỉ lộ ra
    // khi có người nhìn vào đúng tấm ảnh. Đã cắn.
    //
    // Cũng không mở nguyên bucket (`/**`): thế thì bất cứ thứ gì lọt vào bucket —
    // kể cả `certifications/` — đều đi qua được trình tối ưu ảnh của Next.
    remotePatterns: mediaBaseUrl
      ? ['/avatars/**', '/photos/**'].map((pathname) => ({
          protocol: new URL(mediaBaseUrl).protocol.replace(':', ''),
          hostname: new URL(mediaBaseUrl).hostname,
          pathname,
        }))
      : [],
  },

  /**
   * Slug trang khu vực đổi `/massage-tai-nha/*` → `/massage-tan-noi/*` (2026-09-06).
   *
   * ~760 URL cũ đã được index và là kênh acquisition chính, nên **bắt buộc**
   * `permanent: true` chứ không `false`: chỉ redirect vĩnh viễn mới chuyển link
   * equity sang URL mới và khiến Google thay thế URL cũ trong index. Redirect tạm
   * giữ URL cũ trong index vô thời hạn — đổi slug xong mà Google vẫn hiện đường dẫn
   * đã bỏ.
   *
   * Lưu ý khi đi kiểm chứng: `permanent: true` phát ra **308**, không phải 301
   * (Next chọn 308 để giữ nguyên method). Google tuyên bố xử lý 308 y hệt 301 cho
   * mục đích index, nên đây không phải lỗi — nhưng người quen `curl -I` tìm chữ
   * "301" sẽ tưởng cấu hình sai và "sửa" nó thành redirect tạm.
   *
   * Hai luật vì bản tiếng Anh nằm dưới `/en` và **middleware không chạy trước
   * redirect của `next.config`** — `/en/massage-tai-nha/...` không tự khớp luật
   * không có prefix. Thiếu luật thứ hai thì URL tiếng Anh cũ trả 404 trong khi bản
   * tiếng Việt vẫn chạy: hỏng đúng một nửa, và là nửa ít ai mở nên lâu mới phát hiện.
   *
   * `:path*` giữ nguyên phần đuôi, nên cả `/{tinh}` lẫn `/{tinh}/{quan}` đều đi qua
   * đúng một luật.
   */
  async redirects() {
    return [
      {
        source: '/massage-tai-nha/:path*',
        destination: '/massage-tan-noi/:path*',
        permanent: true,
      },
      {
        source: '/en/massage-tai-nha/:path*',
        destination: '/en/massage-tan-noi/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
