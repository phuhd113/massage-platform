import type { Metadata } from 'next';
import { normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { LegalPage, LegalSection } from '@/components/LegalPage';
import { alternatesFor } from '@/lib/seo';

/**
 * Điều khoản sử dụng.
 *
 * Điều quan trọng nhất của cả trang nằm ở mục 1: MasGo là **nền tảng trung gian**,
 * không phải bên cung cấp dịch vụ massage. Mọi mục về trách nhiệm phía dưới đều dựa
 * vào đó, nên đừng làm mờ nó — một câu "chúng tôi mang tới dịch vụ massage tận nơi"
 * viết cho thuận tai ở đây là tự nhận mình là bên cung cấp, và kéo theo nghĩa vụ với
 * từng buổi hẹn mà sàn không có cách nào thực hiện.
 *
 * Mục 6 (gói đẩy tin) phải khớp hành vi thật của hệ thống: hoàn tiền tính theo **đúng
 * đơn vị khung của gói** (gói theo giờ hoàn theo giờ), và gói đẩy tin **không** ảnh
 * hưởng tới kết quả duyệt hồ sơ. Cả hai đều là quyết định đã ghi trong rules; viết
 * khác đi ở đây là hứa một cơ chế hoàn tiền không tồn tại.
 */

export const revalidate = 86400;

interface Props {
  params: { locale: string };
}

const PATH = '/dieu-khoan';

export function generateMetadata({ params }: Props): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return {
    title: t('terms.metaTitle'),
    description: t('terms.metaDescription'),
    alternates: alternatesFor(locale, PATH),
  };
}

export default function TermsPage({ params }: Props) {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return (
    <LegalPage locale={locale} t={t} path={PATH} title={t('terms.h1')} lead={t('terms.lead')}>
      <LegalSection id="dieu-1" title={t('terms.s1Title')}>
        <p>{t('terms.s1p1')}</p>
        <p>{t('terms.s1p2')}</p>
      </LegalSection>

      <LegalSection id="dieu-2" title={t('terms.s2Title')}>
        <p>{t('terms.s2p1')}</p>
        <p>{t('terms.s2p2')}</p>
      </LegalSection>

      <LegalSection id="dieu-3" title={t('terms.s3Title')}>
        <p>{t('terms.s3p1')}</p>
        <p>{t('terms.s3p2')}</p>
        <p>{t('terms.s3p3')}</p>
      </LegalSection>

      <LegalSection id="dieu-4" title={t('terms.s4Title')}>
        <p>{t('terms.s4p1')}</p>
        <p>{t('terms.s4p2')}</p>
      </LegalSection>

      <LegalSection id="dieu-5" title={t('terms.s5Title')}>
        <p>{t('terms.s5p1')}</p>
        <p>{t('terms.s5p2')}</p>
      </LegalSection>

      <LegalSection id="dieu-6" title={t('terms.s6Title')}>
        <p>{t('terms.s6p1')}</p>
        <p>{t('terms.s6p2')}</p>
        <p>{t('terms.s6p3')}</p>
        <p>{t('terms.s6p4')}</p>
      </LegalSection>

      <LegalSection id="dieu-7" title={t('terms.s7Title')}>
        <p>{t('terms.s7p1')}</p>
        <p>{t('terms.s7p2')}</p>
      </LegalSection>

      <LegalSection id="dieu-8" title={t('terms.s8Title')}>
        <p>{t('terms.s8p1')}</p>
        <p>{t('terms.s8p2')}</p>
      </LegalSection>

      <LegalSection id="dieu-9" title={t('terms.s9Title')}>
        <p>{t('terms.s9p1')}</p>
      </LegalSection>

      <LegalSection id="dieu-10" title={t('terms.s10Title')}>
        <p>{t('terms.s10p1')}</p>
      </LegalSection>
    </LegalPage>
  );
}
