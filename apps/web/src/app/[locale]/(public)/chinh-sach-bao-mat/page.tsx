import type { Metadata } from 'next';
import { normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { LegalList, LegalPage, LegalSection } from '@/components/LegalPage';
import { LEGAL_ENTITY, LEGAL_ENTITY_INCOMPLETE } from '@/lib/legal';
import { alternatesFor } from '@/lib/seo';

/**
 * Chính sách bảo vệ dữ liệu cá nhân, theo Nghị định 13/2023/NĐ-CP.
 *
 * Sàn thu thập **dữ liệu cá nhân nhạy cảm** (ảnh CCCD của KTV) và dữ liệu vị trí của
 * khách, nên đây là nghĩa vụ pháp lý chứ không phải một trang cho đủ bộ. Hai điều
 * khiến chính sách này nói được điều cụ thể thay vì chung chung — và cả hai là quyết
 * định kiến trúc có thật, đừng viết khác đi nếu code chưa đổi:
 *
 * - **Không lưu số CCCD và tên trên thẻ**, chỉ lưu ảnh; admin đọc trực tiếp trên ảnh
 *   lúc duyệt. Đây là điểm mạnh nhất của cả trang: thứ không lưu thì không lộ được.
 * - **Số điện thoại KTV chỉ trả về khi khách bấm liên hệ**, không nằm trong hồ sơ
 *   công khai — quyết định chống quét số từ Phase 1.
 *
 * Mục 8 liệt kê đúng ba chỗ dùng browser storage đã ghi trong rules (khu vực đã lưu,
 * cờ đã đọc thông báo KTV, cờ popup lọc trong phiên). Thêm chỗ thứ tư thì phải sửa
 * mục này — một chính sách kê thiếu là kê sai.
 */

export const revalidate = 86400;

interface Props {
  params: { locale: string };
}

const PATH = '/chinh-sach-bao-mat';

export function generateMetadata({ params }: Props): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return {
    title: t('privacy.metaTitle'),
    description: t('privacy.metaDescription'),
    alternates: alternatesFor(locale, PATH),
  };
}

export default function PrivacyPage({ params }: Props) {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return (
    <LegalPage
      locale={locale}
      t={t}
      path={PATH}
      title={t('privacy.h1')}
      lead={t('privacy.lead')}
    >
      <LegalSection id="muc-1" title={t('privacy.s1Title')}>
        <h3 className="font-display text-h4 text-ink-900">{t('privacy.s1CustomerTitle')}</h3>
        <LegalList>
          <li>{t('privacy.s1Customer1')}</li>
          <li>{t('privacy.s1Customer2')}</li>
          <li>{t('privacy.s1Customer3')}</li>
          <li>{t('privacy.s1Customer4')}</li>
        </LegalList>

        <h3 className="mt-4 font-display text-h4 text-ink-900">{t('privacy.s1KtvTitle')}</h3>
        <LegalList>
          <li>{t('privacy.s1Ktv1')}</li>
          {/* Dòng "không lưu số CCCD" in đậm: đây là câu duy nhất trên trang nói về
              thứ chúng tôi **không** làm với dữ liệu nhạy cảm nhất, và nó là thứ
              người lo lắng nhất đang tìm. */}
          <li className="font-semibold text-ink-900">{t('privacy.s1Ktv2')}</li>
          <li>{t('privacy.s1Ktv3')}</li>
          <li>{t('privacy.s1Ktv4')}</li>
          <li>{t('privacy.s1Ktv5')}</li>
          <li>{t('privacy.s1Ktv6')}</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="muc-2" title={t('privacy.s2Title')}>
        <LegalList>
          <li>{t('privacy.s2p1')}</li>
          <li>{t('privacy.s2p2')}</li>
          <li>{t('privacy.s2p3')}</li>
          <li>{t('privacy.s2p4')}</li>
          <li>{t('privacy.s2p5')}</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="muc-3" title={t('privacy.s3Title')}>
        <p>{t('privacy.s3p1')}</p>
        <p>{t('privacy.s3p2')}</p>
        <p>{t('privacy.s3p3')}</p>
      </LegalSection>

      <LegalSection id="muc-4" title={t('privacy.s4Title')}>
        <p>{t('privacy.s4p1')}</p>
        <p>{t('privacy.s4p2')}</p>
      </LegalSection>

      <LegalSection id="muc-5" title={t('privacy.s5Title')}>
        <p>{t('privacy.s5Lead')}</p>
        <LegalList>
          <li>{t('privacy.s5r1')}</li>
          <li>{t('privacy.s5r2')}</li>
          <li>{t('privacy.s5r3')}</li>
          <li>{t('privacy.s5r4')}</li>
          <li>{t('privacy.s5r5')}</li>
          <li>{t('privacy.s5r6')}</li>
          <li>{t('privacy.s5r7')}</li>
        </LegalList>

        {/* Đầu mối liên hệ lặp lại ngay tại mục "quyền của bạn", dù khối pháp nhân
            đã có ở chân trang. Cố ý: quyền mà không kèm cách thực hiện ngay tại chỗ
            là quyền hình thức, và bắt người đọc cuộn đi tìm địa chỉ là ma sát đặt
            đúng vào chỗ không nên có. Vẫn đọc từ LEGAL_ENTITY nên không có nguồn
            sự thật thứ hai. */}
        <p>{t('privacy.s5Contact')}</p>
        {/* Cùng luật với khối pháp nhân ở `LegalPage`: chưa điền thì ẩn hẳn, không in
            ra chỗ trống. Ở đây hệ quả còn trực tiếp hơn — dòng này là **cách thực
            hiện** bảy quyền vừa liệt kê ngay trên, nên một placeholder ở đó nói với
            người đọc rằng quyền có tồn tại nhưng không có đường nào dùng. */}
        {!LEGAL_ENTITY_INCOMPLETE && (
          <p className="text-ink-800">
            <span className="text-ink-500">{t('legal.entityPrivacyEmail')}: </span>
            {LEGAL_ENTITY.privacyEmail}
          </p>
        )}
      </LegalSection>

      <LegalSection id="muc-6" title={t('privacy.s6Title')}>
        <p>{t('privacy.s6p1')}</p>
        <p>{t('privacy.s6p2')}</p>
      </LegalSection>

      <LegalSection id="muc-7" title={t('privacy.s7Title')}>
        <p>{t('privacy.s7p1')}</p>
      </LegalSection>

      <LegalSection id="muc-8" title={t('privacy.s8Title')}>
        <p>{t('privacy.s8p1')}</p>
        <p>{t('privacy.s8p2')}</p>
      </LegalSection>

      <LegalSection id="muc-9" title={t('privacy.s9Title')}>
        <p>{t('privacy.s9p1')}</p>
      </LegalSection>
    </LegalPage>
  );
}
