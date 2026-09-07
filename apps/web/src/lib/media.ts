/**
 * Ảnh hồ sơ KTV — nơi duy nhất frontend quyết định hiển thị ảnh gì.
 *
 * Backend đã trả về URL đầy đủ (nó là chỗ biết file nằm ở R2 hay đĩa local), nên ở
 * đây **không dựng URL**. Việc của file này là hai câu hỏi còn lại: URL nào dùng
 * được, và hiện gì khi không có ảnh.
 */

/**
 * Origin ảnh, chỉ để so khớp — không dùng để ghép URL.
 *
 * Phải khớp với `remotePatterns` trong `next.config.mjs`: `next/image` chặn mọi host
 * không khai ở đó, và lỗi hiện ra dưới dạng ảnh không tải được chứ không phải một
 * thông báo. Hai nơi cùng đọc một biến môi trường nên chúng không trôi khỏi nhau.
 */
const MEDIA_BASE_URL = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? '';

/**
 * Backend trả URL tương đối (`/uploads/...`) khi chạy đĩa local, và URL tuyệt đối khi
 * chạy R2. Đường tương đối trỏ vào origin của **API**, không phải của Next, nên nó
 * phải được ghép với origin API trước khi đưa cho trình duyệt.
 */
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5080/api/v1').replace(
  /\/api\/v1\/?$/,
  '',
);

/**
 * URL dùng được cho thẻ ảnh, hoặc null khi KTV chưa có ảnh.
 *
 * Trả null thay vì một URL ảnh mặc định: chỗ gọi cần *biết* là không có ảnh để chọn
 * cách lấp chỗ trống (chữ cái đầu tên, khung rỗng, hay bỏ hẳn khu vực đó), và một
 * ảnh placeholder dùng chung khiến mọi hồ sơ chưa có ảnh trông giống hệt nhau trên
 * cùng một trang kết quả.
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith('/')) return url;

  // Đường tải file riêng tư (chỉ có khi chạy đĩa local) cần token, mà token nằm
  // trong cookie httpOnly của origin Next — gọi thẳng sang origin API sẽ nhận 401.
  // Vòng qua proxy để nó gắn Authorization. Với R2 thì `url` là URL ký tuyệt đối và
  // nhánh này không chạy tới.
  //
  // Khớp cả hai loại file riêng tư: chứng chỉ và ảnh CCCD. Thiếu một loại thì URL của
  // loại đó đi thẳng sang origin API và nhận 401 — hỏng chỉ ở môi trường chạy đĩa
  // local, tức là đúng môi trường dev nơi nó dễ bị coi là lỗi cấu hình.
  const priv = url.match(/^\/api\/v1\/(ktv\/(?:certifications\/file|profile\/identity\/file))\?key=(.+)$/);
  if (priv) return `/api/proxy/${priv[1]}?key=${priv[2]}`;

  return `${API_ORIGIN}${url}`;
}

/**
 * Có đi qua trình tối ưu ảnh của Next được không.
 *
 * `next/image` từ chối mọi host ngoài `remotePatterns`, và khi bị từ chối nó **không**
 * rơi về ảnh gốc — nó hỏng. Ảnh ngoài danh sách (ví dụ `/uploads` của API lúc dev)
 * vẫn hiện được bằng thẻ `img` thường; đổi lại là không có srcset và không đổi định
 * dạng, chấp nhận được cho môi trường dev.
 */
export function isOptimizable(url: string): boolean {
  if (url.startsWith('/')) return true;
  if (!MEDIA_BASE_URL) return false;

  try {
    return new URL(url).origin === new URL(MEDIA_BASE_URL).origin;
  } catch {
    return false;
  }
}

/**
 * Chữ cái đại diện khi chưa có ảnh — lấy từ **tên**, phần người Việt dùng để gọi nhau.
 *
 * "Nguyễn Thị Lan" ra "L", không phải "N".
 */
export function initialOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.at(-1) ?? name).charAt(0).toUpperCase();
}

/**
 * `alt` cho ảnh hồ sơ.
 *
 * Không bao giờ để rỗng: đây là ảnh mang nội dung trên trang sống nhờ SEO, và ảnh
 * không có alt vừa mất điểm accessibility vừa mất một chỗ Google đọc được tên KTV.
 * Chú thích do KTV nhập được ưu tiên vì nó mô tả đúng tấm ảnh đó.
 */
export function photoAlt(ktvName: string, caption: string | null | undefined): string {
  return caption?.trim() ? `${caption.trim()} — ${ktvName}` : `Ảnh hồ sơ của ${ktvName}`;
}
