import type { Metadata } from 'next';
import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = {
  title: 'Đăng ký kỹ thuật viên',
  robots: { index: false, follow: false },
};

/**
 * Cửa vào cho kỹ thuật viên.
 *
 * Khác `/dang-nhap` đúng hai điều: vai trò xin cấp cho tài khoản mới là `KTV`, và
 * nội dung cột phải là phần thuyết phục người đi làm tạo hồ sơ. Cùng một biểu mẫu
 * OTP, vì luồng xác thực không có gì khác nhau.
 *
 * Vì sao tách route thay vì thêm ô chọn vai trò vào một trang: 95% người mở màn
 * hình đăng nhập là khách, và bắt tất cả họ trả lời "bạn là ai" trước khi nhập số
 * là dựng một rào chắn cho đa số để phục vụ thiểu số. Người đi làm thì tới đây từ
 * lời kêu gọi "Trở thành kỹ thuật viên", tức là đã tự chọn xong từ trước.
 *
 * Không gửi `redirectTo`: KTV luôn về `/dashboard`, và `LoginForm` quyết định điều
 * đó theo vai trò **thật** trả về từ server chứ không theo cửa vừa bước vào.
 */
export default function KtvSignUpPage() {
  return <LoginForm role="KTV" />;
}
