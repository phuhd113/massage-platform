import type { Metadata } from 'next';
import Link from 'next/link';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { LegalList, LegalPage, LegalSection } from '@/components/LegalPage';
import { alternatesFor } from '@/lib/seo';

/**
 * Trang an toàn và quy tắc cộng đồng.
 *
 * Đây không phải trang trang trí. Nó phục vụ ba việc, theo thứ tự quan trọng:
 *
 * 1. **Ngữ cảnh chống phân loại nhầm.** Google hạ hạng mạnh tên miền bị xếp vào
 *    nội dung người lớn, và hình phạt rơi lên **cả tên miền** — tức lên ~760 trang
 *    khu vực đang là kênh acquisition chính. Một sàn massage tận nơi không có trang
 *    nào nói rõ phạm vi dịch vụ và điều cấm là đang để thuật toán tự đoán nghĩa của
 *    mình. Đây là bằng chứng ngữ cảnh rẻ nhất chống lại điều đó.
 * 2. **Nơi lời hứa "đã duyệt" sống ở đúng MỘT chỗ.** Trước đây câu khẳng định về
 *    việc duyệt hồ sơ nằm rải rác trong footer, badge trang chủ và meta description
 *    của ~700 trang khu vực — và đã trôi khỏi luật thật ở
 *    `AdminService.DecideProfileAsync` mà không có gì báo đỏ (2026-09-09).
 * 3. Trả lời nỗi lo có thật của khách trước khi họ gọi.
 *
 * **Mọi câu trong phần "chúng tôi kiểm tra gì" phải kiểm được ở
 * `DecideProfileAsync`.** Hiện là đúng hai điều kiện: CCCD đã xác minh + cam kết
 * đúng phiên bản. Chứng chỉ hành nghề **không** phải điều kiện — có mục riêng nói
 * rõ điều đó, vì không nói ra thì khách tự hiểu là bắt buộc và ta lại hứa thừa.
 */

export const revalidate = 86400;

interface Props {
  params: { locale: string };
}

const PATH = '/an-toan';

export function generateMetadata({ params }: Props): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return {
    title: t('safety.metaTitle'),
    description: t('safety.metaDescription'),
    alternates: alternatesFor(locale, PATH),
  };
}

export default function SafetyPage({ params }: Props) {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return (
    <LegalPage
      locale={locale}
      t={t}
      path={PATH}
      title={t('safety.h1')}
      lead={t('safety.lead')}
    >
      <LegalSection id="pham-vi" title={t('safety.scopeTitle')}>
        <p>{t('safety.scopeBody')}</p>

        {/* Khối cấm dùng token `danger` chứ không phải một thẻ trung tính: đây là
            phần duy nhất trên toàn site nói "tuyệt đối không", và nó phải đọc như
            vậy ngay cả với người chỉ lướt qua. */}
        <div className="mt-2 rounded-2xl border border-danger-bd bg-danger-bg p-5">
          <h3 className="font-display text-h4 text-danger-fg">
            {t('safety.scopeProhibitedTitle')}
          </h3>
          <div className="mt-3 text-ink-800">
            <LegalList>
              <li>{t('safety.scopeProhibited1')}</li>
              <li>{t('safety.scopeProhibited2')}</li>
              <li>{t('safety.scopeProhibited3')}</li>
              <li>{t('safety.scopeProhibited4')}</li>
            </LegalList>
          </div>
          <p className="mt-3 text-body-s text-ink-700">{t('safety.scopeEnforcement')}</p>
        </div>
      </LegalSection>

      {/* `wide` vì mục này chứa hai thẻ bước và khối giới hạn trách nhiệm; các đoạn
          văn thuần bên trong tự giữ `max-w-prose` của riêng chúng. */}
      <LegalSection id="duyet-ho-so" title={t('safety.verifyTitle')} wide>
        <p className="max-w-prose">{t('safety.verifyLead')}</p>

        {/* Hai điều kiện bắt buộc, đánh số rõ. Thứ tự khớp thứ tự kiểm ở
            DecideProfileAsync — CCCD trước, cam kết sau. */}
        <ol className="mt-2 grid gap-4">
          <VerifyStep
            index={1}
            title={t('safety.verifyStep1Title')}
            body={t('safety.verifyStep1Body')}
          />
          <VerifyStep
            index={2}
            title={t('safety.verifyStep2Title')}
            body={t('safety.verifyStep2Body')}
          />
        </ol>

        <h3 className="mt-6 font-display text-h4 text-ink-900">
          {t('safety.verifyPhotoTitle')}
        </h3>
        <p className="max-w-prose">{t('safety.verifyPhotoBody')}</p>

        <h3 className="mt-4 font-display text-h4 text-ink-900">
          {t('safety.verifyCertTitle')}
        </h3>
        <p className="max-w-prose">{t('safety.verifyCertBody')}</p>

        {/* Giới hạn trách nhiệm nằm ngay trong phần nói về việc duyệt, không đẩy
            xuống cuối trang. Một trang an toàn chỉ liệt kê thứ mình làm được sẽ đọc
            như bảo lãnh cho từng cuộc hẹn — và người đọc kỹ nhất phần "chúng tôi
            kiểm tra gì" chính là người cần đọc vế còn lại nhất. */}
        <div className="mt-6 max-w-prose rounded-2xl border border-ink-200 bg-ink-50 p-5">
          <h3 className="font-display text-h4 text-ink-900">
            {t('safety.verifyLimitTitle')}
          </h3>
          <p className="mt-2 text-body leading-7 text-ink-700">
            {t('safety.verifyLimitBody')}
          </p>
        </div>
      </LegalSection>

      <LegalSection id="cho-khach" title={t('safety.customerTitle')} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Tip title={t('safety.customerTip1Title')} body={t('safety.customerTip1Body')} />
          <Tip title={t('safety.customerTip2Title')} body={t('safety.customerTip2Body')} />
          <Tip title={t('safety.customerTip3Title')} body={t('safety.customerTip3Body')} />
          <Tip title={t('safety.customerTip4Title')} body={t('safety.customerTip4Body')} />
        </div>
      </LegalSection>

      <LegalSection id="cho-ktv" title={t('safety.ktvTitle')}>
        <p>{t('safety.ktvBody')}</p>
      </LegalSection>

      <LegalSection id="bao-cao" title={t('safety.reportTitle')}>
        <p>{t('safety.reportBody')}</p>
        <p>{t('safety.reportNote')}</p>

        {/* Khẩn cấp dùng `warning` chứ không `danger`: khối cấm ở trên đã chiếm sắc
            đỏ cho nghĩa "vi phạm", và dùng lại cùng màu cho nghĩa "gọi 113" làm
            nhoè hai thông điệp rất khác nhau. */}
        <div className="mt-2 rounded-2xl border border-warning-bd bg-warning-bg p-5">
          <h3 className="font-display text-h4 text-warning-fg">
            {t('safety.reportUrgentTitle')}
          </h3>
          <p className="mt-2 text-body leading-7 text-ink-800">
            {t('safety.reportUrgentBody')}
          </p>
        </div>

        {/* Nút báo cáo nằm trên từng trang hồ sơ, nên trang này chỉ dẫn được tới
            danh sách. Vẫn đáng có: người đọc tới đây phần lớn đang muốn báo cáo một
            hồ sơ cụ thể và cần đường quay lại tìm nó. */}
        <p className="mt-2">
          <Link
            href={localePath(locale, '/tim-kiem')}
            className="text-body-l font-semibold text-brand-700 underline underline-offset-4 transition hover:text-brand-800"
          >
            {t('safety.reportCta')}
          </Link>
        </p>
      </LegalSection>
    </LegalPage>
  );
}

function VerifyStep({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <li className="flex gap-4 rounded-2xl border border-ink-200 bg-white p-5">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-body-l font-bold text-brand-700"
      >
        {index}
      </span>
      <div>
        <h3 className="font-display text-h4 text-ink-900">{title}</h3>
        <p className="mt-1.5 text-body leading-7 text-ink-700">{body}</p>
      </div>
    </li>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5">
      <h3 className="font-display text-h4 text-ink-900">{title}</h3>
      <p className="mt-1.5 text-body leading-7 text-ink-700">{body}</p>
    </div>
  );
}
