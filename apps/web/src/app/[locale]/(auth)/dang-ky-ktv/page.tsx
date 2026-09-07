import type { Metadata } from 'next';
import { PasswordAuthForm } from '@/components/PasswordAuthForm';
import { normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  return {
    title: t('login.metaTitleKtv'),
    robots: { index: false, follow: false },
  };
}

/**
 * Cửa đăng ký dành cho KTV, kèm cột phải bán hàng.
 *
 * Hai cửa tách theo **đối tượng**, không theo hành động: 95% người mở màn hình đăng
 * ký là khách, nên bắt tất cả trả lời "bạn là ai" là dựng rào cho đa số để phục vụ
 * thiểu số. KTV vào bằng link riêng trên trang bán hàng.
 *
 * Không nhận `?next=`: KTV luôn về `/dashboard`, nơi có màn làm việc đầy đủ của họ.
 */
export default function KtvSignUpPage({ params }: { params: { locale: string } }) {
  return <PasswordAuthForm mode="register" role="KTV" locale={normalizeLocale(params.locale)} />;
}
