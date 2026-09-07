import type { Metadata } from 'next';
import { PasswordAuthForm } from '@/components/PasswordAuthForm';
import { normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { redirectIfAuthenticated, safeNext } from '@/lib/session';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  return {
    title: t('login.metaTitleRegister'),
    robots: { index: false, follow: false },
  };
}

/**
 * Đăng ký tài khoản khách.
 *
 * Tồn tại vì mật khẩu, khác OTP, không gộp được đăng ký vào đăng nhập: hệ thống không
 * biết người gõ sai mật khẩu là ai, nên một form chung sẽ hoặc phải lộ "số này đã có
 * tài khoản" (mở đường dò), hoặc trả một câu lỗi không nói được gì.
 *
 * Giữ `?next=` như trang đăng nhập: người tạo tài khoản để viết đánh giá cũng cần
 * quay về đúng hồ sơ họ đang xem.
 */
export default function RegisterPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string };
}) {
  const next = safeNext(searchParams.next);

  // Người đã có phiên không cần tạo tài khoản thứ hai — và nếu thật sự muốn, họ phải
  // đăng xuất trước, chứ không phải điền một form mà backend sẽ trả 409.
  redirectIfAuthenticated(next);

  return (
    <PasswordAuthForm
      mode="register"
      role="CUSTOMER"
      locale={normalizeLocale(params.locale)}
      redirectTo={next}
    />
  );
}
