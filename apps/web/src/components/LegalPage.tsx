import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { type Locale, localePath } from '@/i18n/config';
import type { Translator } from '@/i18n/t';
import { LEGAL_ENTITY, LEGAL_ENTITY_INCOMPLETE, legalEffectiveDate } from '@/lib/legal';

/**
 * Khung dùng chung cho ba trang pháp lý: /an-toan, /dieu-khoan, /chinh-sach-bao-mat.
 *
 * Ba trang này phải trông và cư xử như **một bộ văn bản**, không phải ba trang tình
 * cờ giống nhau. Chúng dùng chung: cùng breadcrumb, cùng dòng ngày hiệu lực, cùng
 * khối pháp nhân ở chân trang, và cùng cụm liên kết chéo sang hai trang còn lại.
 *
 * Cụm liên kết chéo là phần đáng giá nhất và cũng dễ quên nhất nếu mỗi trang tự
 * dựng: người đọc điều khoản gần như luôn cần chính sách dữ liệu ngay sau đó, và ba
 * trang trỏ về nhau cũng là cách rẻ nhất để Google hiểu chúng là một cụm. Thêm trang
 * pháp lý thứ tư thì thêm vào `LEGAL_PAGES` bên dưới, và **cả ba** trang cũ tự có
 * link tới nó — không phải đi sửa ba file.
 */

/** Ba trang pháp lý, khai một lần. Thứ tự này là thứ tự hiển thị ở cụm liên kết chéo. */
export const LEGAL_PAGES = [
  { path: '/an-toan', labelKey: 'legal.navSafety' },
  { path: '/dieu-khoan', labelKey: 'legal.navTerms' },
  { path: '/chinh-sach-bao-mat', labelKey: 'legal.navPrivacy' },
] as const;

export type LegalPath = (typeof LEGAL_PAGES)[number]['path'];

interface Props {
  locale: Locale;
  t: Translator;
  /** Đường dẫn không prefix của chính trang này — dùng để loại nó khỏi cụm liên kết chéo. */
  path: LegalPath;
  title: string;
  lead: string;
  children: React.ReactNode;
}

export function LegalPage({ locale, t, path, title, lead, children }: Props) {
  const others = LEGAL_PAGES.filter((p) => p.path !== path);

  return (
    <>
      <Breadcrumbs
        label={t('breadcrumbs.label')}
        items={[
          { name: t('common.home'), href: localePath(locale, '/') },
          { name: title, href: localePath(locale, path) },
        ]}
      />

      {/* Cảnh báo chỉ hiện ngoài production và chỉ khi lib/legal.ts còn placeholder.
          Nó nói với người phát triển, không với khách — nhưng đặt ngay trên đầu
          trang là chỗ duy nhất không thể bỏ qua. Ẩn ở production có chủ ý: nếu vẫn
          quên điền thì thứ hiện ra cho khách phải là chỗ trống trong khối pháp nhân
          bên dưới, không phải một dòng cảnh báo nội bộ về tên file. */}
      {LEGAL_ENTITY_INCOMPLETE && process.env.NODE_ENV !== 'production' && (
        <p className="mb-6 rounded-xl border border-warning-bd bg-warning-bg px-4 py-3 text-body-s text-warning-fg">
          {t('legal.placeholderWarning')}
        </p>
      )}

      {/* Giới hạn độ dài dòng đặt ở **từng khối chữ**, không ở `<article>`.
          Bó cả article vào `max-w-prose` thì lưới thẻ và khối cảnh báo cũng bị ép
          theo: hai cột "Lời khuyên an toàn" tụt xuống ~31 ký tự mỗi cột và tiêu đề
          ngắt giữa cụm ("Nói không với mọi đề / nghị ngoài phạm vi"), trong khi nửa
          phải màn hình bỏ trống. Đo bằng mắt trên bản dev trước khi sửa.

          `max-w-3xl` cho cả trang vẫn giữ trang khỏi trải hết màn hình rộng — thứ
          `max-w-shell` của PublicShell một mình không làm được với văn bản dài. */}
      <article className="max-w-3xl">
        {/* Cố ý KHÔNG dùng `sm:text-display` như trang khu vực và trang hồ sơ. Cỡ
            display (3rem, weight 800) là cỡ của tiêu đề bán hàng; ở đầu một văn bản
            pháp lý dài nó đọc như một khẩu hiệu, và nó cũng nuốt mất tương phản với
            các `h2` đánh số ngay bên dưới — thứ duy nhất giúp quét nhanh trang này. */}
        <h1 className="text-h1 text-ink-900">{title}</h1>

        {/* Ngày hiệu lực đứng ngay dưới tiêu đề, không ở chân trang: câu hỏi đầu tiên
            của bất kỳ ai mở một văn bản pháp lý là "bản này còn hiệu lực không". */}
        <p className="mt-3 text-body-s text-ink-500">
          {t('legal.effectiveDate', { date: legalEffectiveDate(locale) })}
        </p>

        <p className="mt-5 max-w-prose text-body-l leading-7 text-ink-700">{lead}</p>

        {children}

        {/* Pháp nhân ở chân trang, sau nội dung: người tới đây để đọc nghĩa vụ, còn
            địa chỉ liên hệ là thứ họ cần **sau khi** đã đọc — nhất là ở trang chính
            sách dữ liệu, nơi mục "quyền của bạn" kết bằng lời mời liên hệ.

            **Ẩn hẳn khối khi `lib/legal.ts` chưa được điền.** Một dòng
            "[TÊN ĐƠN VỊ VẬN HÀNH — CHƯA ĐIỀN]" trên trang điều khoản thật còn tệ hơn
            việc không nêu: nó là lời khai chủ động rằng sàn chưa biết mình là ai, ngay
            trong văn bản dùng để chứng minh điều ngược lại. Không nêu thì đó là một
            thiếu sót phải bổ sung; nêu ra chỗ trống thì đó là bằng chứng chống lại
            chính mình.

            Đây là trạng thái **tạm thời** — cảnh báo dev ở đầu trang vẫn kêu cho tới
            khi điền xong, và điền xong thì khối này tự hiện lại mà không phải sửa gì
            ở đây. */}
        {!LEGAL_ENTITY_INCOMPLETE && (
          <section className="mt-12 rounded-2xl border border-ink-200 bg-ink-50 p-5">
            <h2 className="font-display text-h4 text-ink-900">{t('legal.entityHeading')}</h2>
            <dl className="mt-3 grid gap-2 text-body-s">
              <LegalField label={t('legal.entityName')} value={LEGAL_ENTITY.name} />
              <LegalField label={t('legal.entityAddress')} value={LEGAL_ENTITY.address} />
              <LegalField label={t('legal.entityTaxCode')} value={LEGAL_ENTITY.taxCode} />
              <LegalField
                label={t('legal.entityPrivacyEmail')}
                value={LEGAL_ENTITY.privacyEmail}
              />
              <LegalField
                label={t('legal.entitySupportEmail')}
                value={LEGAL_ENTITY.supportEmail}
              />
            </dl>
          </section>
        )}

        <nav className="mt-8" aria-labelledby="legal-related">
          <h2 id="legal-related" className="font-display text-h4 text-ink-900">
            {t('legal.relatedTitle')}
          </h2>
          <ul className="mt-3 grid gap-2">
            {others.map((p) => (
              <li key={p.path}>
                <Link
                  href={localePath(locale, p.path)}
                  className="text-body-l text-brand-700 underline underline-offset-4 transition hover:text-brand-800"
                >
                  {t(p.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </>
  );
}

function LegalField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-800">{value}</dd>
    </div>
  );
}

/**
 * Một mục đánh số trong văn bản pháp lý.
 *
 * `id` bắt buộc: link tới một điều khoản cụ thể là việc bình thường khi trao đổi về
 * tranh chấp, và không có neo thì người ta phải mô tả "mục thứ sáu tính từ trên
 * xuống". `scroll-mt` để tiêu đề không nằm khuất sau header dính.
 */
export function LegalSection({
  id,
  title,
  wide = false,
  children,
}: {
  id: string;
  title: string;
  /**
   * Cho nội dung dùng hết chiều ngang thay vì bó vào độ dài dòng đọc được.
   *
   * Mặc định `false` vì phần lớn nội dung ba trang này là đoạn văn, và một dòng
   * chữ dài quá ~75 ký tự thì mắt đọc xong lại trượt về sai dòng. Bật cho những
   * mục có lưới thẻ (lời khuyên an toàn): thẻ không phải dòng chữ, và ép chúng
   * theo cùng giới hạn làm tiêu đề ngắt giữa cụm.
   */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="text-h3 text-ink-900">{title}</h2>
      <div
        className={`mt-3 grid gap-3 text-body leading-7 text-ink-700 ${
          wide ? '' : 'max-w-prose'
        }`}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Danh sách gạch đầu dòng trong văn bản pháp lý.
 *
 * Nhận sẵn các `<li>` thay vì một mảng chuỗi: vài chỗ cần chữ đậm hoặc link bên
 * trong một mục, và một prop `items: string[]` sẽ buộc chỗ đó phải đi đường khác —
 * tức hai kiểu danh sách khác nhau trên cùng một trang.
 */
export function LegalList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid list-disc gap-2 pl-5 marker:text-ink-400">{children}</ul>
  );
}
