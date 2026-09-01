import type { Metadata } from 'next';
import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = {
  title: 'Đăng nhập kỹ thuật viên',
  // Trang chức năng cho KTV, không phải nội dung để xếp hạng.
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginForm />;
}
