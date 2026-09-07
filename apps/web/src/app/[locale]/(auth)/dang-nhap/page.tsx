import type { Metadata } from 'next';
import { PasswordAuthForm } from '@/components/PasswordAuthForm';
import { normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { safeNext } from '@/lib/session';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  return {
    title: t('login.metaTitleCustomer'),
    // Trang chức năng, không phải nội dung để xếp hạng.
    robots: { index: false, follow: false },
  };
}

/**
 * Cửa đăng nhập, dùng chung cho cả khách lẫn KTV.
 *
 * Không phân biệt vai trò ở đây: đăng nhập thì vai trò đã nằm sẵn trên tài khoản, và
 * form điều hướng theo vai trò **thật** trả về từ server. Chỉ việc *đăng ký* mới cần
 * biết người mới vào là ai, và đó là hai trang riêng (`/dang-ky`, `/dang-ky-ktv`).
 *
 * `?next=` để quay lại đúng trang khách đang đứng — người bấm đăng nhập từ một hồ sơ
 * KTV gần như luôn đang định viết đánh giá cho chính hồ sơ đó.
 */
export default function LoginPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string };
}) {
  return (
    <PasswordAuthForm
      mode="login"
      locale={normalizeLocale(params.locale)}
      redirectTo={safeNext(searchParams.next)}
    />
  );
}
