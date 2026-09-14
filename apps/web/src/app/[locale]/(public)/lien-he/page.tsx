import type { Metadata } from 'next';
import Link from 'next/link';
import { MailIcon, PhoneIcon, ZaloIcon } from '@/components/icons';
import { LegalPage, LegalSection } from '@/components/LegalPage';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import {
  ADMIN_CONTACTS,
  ADMIN_EMAIL,
  mailtoHref,
  prettyPhone,
  telHref,
  zaloHref,
} from '@/lib/contact';
import { alternatesFor } from '@/lib/seo';

/**
 * Trang liên hệ.
 *
 * Dùng chung khung `LegalPage` với ba trang pháp lý, và có mặt trong `LEGAL_PAGES` —
 * nên nó tự xuất hiện ở footer, trong sitemap và trong cụm liên kết chéo của cả ba
 * trang kia, không phải đi sửa ba chỗ. Đó cũng là điều làm trang này **tồn tại** với
 * người dùng và với Googlebot: một trang không có đường vào từ giao diện thì không
 * tồn tại, lỗi đã cắn bốn lần trong dự án này (xem rules).
 *
 * **Nguyên tắc của trang: mỗi mục dẫn tới một luồng đã có, không thay thế nó.** Sàn
 * đã có nút báo cáo trên từng hồ sơ, nút liên hệ hiện số KTV, và trang hồ sơ trong
 * dashboard hiện lý do bị từ chối. Một trang liên hệ khuyên "gọi cho chúng tôi" ở cả
 * ba trường hợp đó là đẩy việc vốn tự phục vụ được lên một đường dây chỉ có hai người
 * nghe — và làm mất luôn dấu vết mà các luồng kia ghi lại (báo cáo gắn đúng hồ sơ,
 * lead được đếm, quyết định duyệt ghi lại ai quyết định).
 *
 * **Cố ý KHÔNG có form gửi tin nhắn.** Một form đòi bảng `contact_messages`, endpoint,
 * rate limit, trang admin đọc tin **và** mục sidebar — thiếu vế cuối là đúng cái lỗi
 * "endpoint không có đường vào giao diện": khách bấm gửi, nhận câu "đã ghi nhận", và
 * không ai đọc. Hai số Zalo đang có người trực là kênh thật; một form không ai mở thì
 * tệ hơn không có, vì nó hứa hẹn thay cho kênh thật.
 *
 * **Email thì khác form, và đó là lý do nó được thêm vào** (2026-09-15): form là một
 * endpoint phải tự dựng cả đường đọc, còn `lienhe@masgo.vn` là hộp thư thật trên máy
 * chủ P.A, có người mở. Điều kiện để đăng nó lên đây cũng chính là điều đó — đã kiểm
 * bằng SMTP trước khi thêm. Nếu sau này hộp thư ngừng được đọc, gỡ khỏi trang chứ
 * đừng để lại: một địa chỉ không ai mở còn tệ hơn không có, vì khách viết vào đó rồi
 * chờ trong khi Zalo bên cạnh đang có người trực.
 *
 * Số điện thoại và email lấy từ `lib/contact.ts`; hai số dùng chung với
 * `BetaAnnouncementDialog`.
 */

export const revalidate = 86400;

interface Props {
  params: { locale: string };
}

const PATH = '/lien-he';

export function generateMetadata({ params }: Props): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return {
    title: t('contactPage.metaTitle'),
    description: t('contactPage.metaDescription'),
    alternates: alternatesFor(locale, PATH),
  };
}

export default function ContactPage({ params }: Props) {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return (
    <LegalPage
      locale={locale}
      t={t}
      path={PATH}
      title={t('contactPage.h1')}
      lead={t('contactPage.lead')}
    >
      {/* `wide` vì mục này chứa thẻ số điện thoại có hàng nút bên phải; đoạn văn
          thuần bên trong tự giữ `max-w-prose` của riêng nó. */}
      <LegalSection id="kenh-lien-he" title={t('contactPage.channelsTitle')} wide>
        <p className="max-w-prose">{t('contactPage.channelsBody')}</p>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {ADMIN_CONTACTS.map((phone) => (
            <div
              key={phone}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3.5"
            >
              {/* Số hiển thị là **text thật**, không phải nhãn trong nút: người dùng
                  máy tính không bấm `tel:` được và cần đọc để bấm tay sang điện
                  thoại — đó cũng là lý do nó nhóm ba chữ số. */}
              <span className="font-display text-body-l font-bold tracking-wide text-ink-900">
                {prettyPhone(phone)}
              </span>
              <div className="ml-auto flex gap-2">
                <a
                  href={telHref(phone)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-1.5 text-body-s font-semibold text-white transition hover:bg-brand-600"
                >
                  <PhoneIcon className="h-4 w-4" />
                  {t('contactPage.channelCall')}
                </a>
                {/* Zalo mở tab mới: site ngoài, thay trang đang mở bằng nó là đá
                    người đọc ra khỏi trang họ đang tra thông tin. */}
                <a
                  href={zaloHref(phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 px-3.5 py-1.5 text-body-s font-semibold text-brand-600 transition hover:bg-brand-50"
                >
                  <ZaloIcon className="h-4 w-4" />
                  {t('contactPage.channelZalo')}
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-2 max-w-prose text-body-s text-ink-600">
          {t('contactPage.channelsNote')}
        </p>
      </LegalSection>

      {/* Email là mục RIÊNG, đặt sau hai số Zalo — không phải thẻ thứ ba trong lưới
          bên trên. Hai lý do: nó không cùng tốc độ phản hồi (Zalo trong ngày làm
          việc, email trong 2 ngày), và nó cần một đoạn nói rõ *khi nào* nên dùng.
          Nhét chung một lưới sẽ đọc ra như ba kênh tương đương, khiến người đang cần
          gấp chọn đúng kênh chậm nhất. */}
      <LegalSection id="email" title={t('contactPage.channelEmailTitle')} wide>
        <p className="max-w-prose">{t('contactPage.channelEmailBody')}</p>

        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white px-4 py-3.5 sm:max-w-md">
          {/* Địa chỉ là text thật, cùng lý do với số điện thoại ở trên: người dùng
              máy tính không có trình gửi mail mặc định sẽ chép tay sang webmail.
              `break-all` vì địa chỉ không có chỗ ngắt tự nhiên và ở 360px nó tràn. */}
          <span className="break-all font-display text-body-l font-bold tracking-wide text-ink-900">
            {ADMIN_EMAIL}
          </span>
          <a
            href={mailtoHref(ADMIN_EMAIL)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-1.5 text-body-s font-semibold text-white transition hover:bg-brand-600"
          >
            <MailIcon className="h-4 w-4" />
            {t('contactPage.channelEmailCta')}
          </a>
        </div>
      </LegalSection>

      <LegalSection id="ban-can-gi" title={t('contactPage.routesTitle')} wide>
        <p className="max-w-prose">{t('contactPage.routesLead')}</p>

        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Route
            title={t('contactPage.routeBookTitle')}
            body={t('contactPage.routeBookBody')}
            cta={t('contactPage.routeBookCta')}
            href={localePath(locale, '/tim-kiem')}
          />
          <Route
            title={t('contactPage.routeReportTitle')}
            body={t('contactPage.routeReportBody')}
            cta={t('contactPage.routeReportCta')}
            href={localePath(locale, '/an-toan#bao-cao')}
          />
          {/* Dashboard chỉ có tiếng Việt (quyết định đã ghi trong rules), nhưng link
              tới nó vẫn `localePath`: `/dang-nhap` là trang công khai có cả hai bản,
              và người dùng bị đẩy sang locale khác giữa chừng sẽ mất bộ lọc ngôn ngữ
              họ đang đọc. Chuyển sang tiếng Việt xảy ra ở ranh giới dashboard. */}
          <Route
            title={t('contactPage.routeKtvTitle')}
            body={t('contactPage.routeKtvBody')}
            cta={t('contactPage.routeKtvCta')}
            href={localePath(locale, '/dang-nhap')}
          />
          <Route
            title={t('contactPage.routeDataTitle')}
            body={t('contactPage.routeDataBody')}
            cta={t('contactPage.routeDataCta')}
            // `#muc-5` là mục "Quyền của bạn" — neo đánh số theo quy ước của trang
            // đó. Trỏ thẳng vào mục thay vì đầu trang: người tới đây đã biết mình
            // cần gì, bắt họ quét lại chín mục là bỏ đi phần giá trị của cái link.
            href={localePath(locale, '/chinh-sach-bao-mat#muc-5')}
          />
        </div>
      </LegalSection>

      <LegalSection id="khan-cap" title={t('contactPage.urgentTitle')}>
        {/* Lặp lại khối khẩn cấp của `/an-toan`, có chủ ý: người đang hoảng mở trang
            tên là "Liên hệ", không mở trang tên là "An toàn". Dùng token `warning`
            chứ không `danger` — cùng lý do đã ghi ở `/an-toan`: sắc đỏ ở đó mang
            nghĩa "vi phạm", mượn nó cho nghĩa "gọi 113" làm nhoè cả hai. */}
        <div className="rounded-2xl border border-warning-bd bg-warning-bg p-5">
          <p className="text-body leading-7 text-ink-800">{t('contactPage.urgentBody')}</p>
        </div>
      </LegalSection>
    </LegalPage>
  );
}

/**
 * Một lối đi: mô tả việc, rồi link tới luồng xử lý việc đó.
 *
 * Link là **bắt buộc**, không phải tuỳ chọn — một thẻ mô tả việc mà không dẫn đi đâu
 * chỉ nói với người đọc rằng họ đang ở sai chỗ mà không chỉ chỗ đúng.
 */
function Route({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-ink-200 bg-white p-5">
      <h3 className="font-display text-h4 text-ink-900">{title}</h3>
      <p className="mt-1.5 text-body leading-7 text-ink-700">{body}</p>
      {/* `mt-auto` để hàng link thẳng hàng giữa các thẻ cạnh nhau dù phần mô tả dài
          ngắn khác nhau — thiếu nó thì lưới hai cột đọc ra như bị lệch. */}
      <p className="mt-auto pt-3">
        <Link
          href={href}
          className="text-body font-semibold text-brand-700 underline underline-offset-4 transition hover:text-brand-800"
        >
          {cta}
        </Link>
      </p>
    </div>
  );
}
