import type { Metadata } from 'next';
import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = {
  title: 'Đăng nhập',
  // Trang chức năng, không phải nội dung để xếp hạng.
  robots: { index: false, follow: false },
};

/**
 * Cửa vào mặc định, dành cho khách.
 *
 * Với OTP thì đăng ký và đăng nhập là **cùng một thao tác** — số chưa có tài khoản
 * thì backend tạo mới, số đã có thì cấp token cho tài khoản cũ. Vì vậy không có
 * trang "đăng ký" riêng cho khách: tách ra sẽ là hai màn hình giống hệt nhau, và
 * bắt người dùng tự nhớ mình từng đăng ký hay chưa để chọn đúng cửa.
 *
 * `?next=` để quay lại đúng trang khách đang đứng — người bấm đăng nhập từ một hồ
 * sơ KTV gần như luôn đang định viết đánh giá cho chính hồ sơ đó.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return <LoginForm role="CUSTOMER" redirectTo={safeNext(searchParams.next)} />;
}

/**
 * Chỉ nhận đường dẫn nội bộ.
 *
 * `?next=` đến từ thanh địa chỉ, nên nhận nguyên trạng là mở một open redirect:
 * kẻ tấn công gửi link `/dang-nhap?next=https://trang-gia.example`, khách đăng nhập
 * thật trên site của ta rồi bị đẩy sang trang giả đã dựng sẵn màn hình "phiên hết
 * hạn, đăng nhập lại". Chặn cả `//host` vì trình duyệt hiểu nó là URL tuyệt đối.
 */
function safeNext(next: string | undefined): string | undefined {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return undefined;
  return next;
}
