import { CertifiedIcon, ChoiceIcon, PriceTagIcon } from '@/components/icons';
import { INTL_LOCALE, type Locale } from '@/i18n/config';

import type { Translator } from '@/i18n/t';
import type { SiteStats } from '@/lib/types';

/**
 * Ba lời hứa của sàn, khai đúng một lần.
 *
 * Chúng xuất hiện ở **hai chỗ**: hàng chip ngắn dưới mô tả hero, và ba cột đầy đủ ở
 * dải khẩu hiệu ngay dưới. Một mảng dùng chung chứ không hai danh sách song song —
 * hai bản sao là hai chỗ để chúng lặng lẽ trôi khỏi nhau, và lúc đó trang tự mâu
 * thuẫn với chính nó cách nhau đúng một màn hình.
 */
export const TRUST_KEYS = ['Verified', 'Price', 'Choice'] as const;
export type TrustKey = (typeof TRUST_KEYS)[number];

/** Ánh xạ lời hứa → icon. Tách ra để hai chỗ dùng không tự chọn icon riêng. */
export function TrustIcon({ k, className }: { k: TrustKey; className?: string }) {
  if (k === 'Verified') return <CertifiedIcon size={20} className={className} />;
  if (k === 'Price') return <PriceTagIcon size={20} className={className} />;
  return <ChoiceIcon size={20} className={className} />;
}

/**
 * Dải khẩu hiệu ngay dưới hero: câu định vị bên trái, ba lời hứa bên phải.
 *
 * **Khẩu hiệu dùng `font-display`, KHÔNG tải font script.** Bản thiết kế vẽ nó bằng
 * một kiểu chữ viết tay, nhưng thêm bộ chữ thứ tư chỉ để phục vụ một dòng là +30–60KB
 * phải tải, một vòng `@font-face` nữa phải giải quyết, và — vì khối này nằm ngay dưới
 * đường gấp — một nguồn CLS mới trên đúng trang đang được đo LCP. Ba bộ chữ hiện có
 * đều đã kèm subset tiếng Việt; bộ thứ tư mà thiếu subset đó thì chính chữ "Cần" rơi
 * về font hệ thống, tức hỏng ngay ở từ đầu tiên của khẩu hiệu.
 *
 * Sức nặng thị giác vì vậy lấy từ **thứ đã có sẵn**: thang chữ (`display` 48px/800),
 * thang màu brand, và nhịp hai phách hỏi–đáp. Khẩu hiệu tách làm hai key
 * (`sloganAsk` / `sloganAnswer`) chứ không `split('?')`: dấu chấm hỏi là quy ước của
 * riêng vi/en, bản dịch khác không chắc có nó và lúc đó vế trả lời rỗng.
 *
 * Vế trả lời tô bằng `bg-clip-text` + `text-transparent`. Luôn khai `text-brand-600`
 * cùng lúc: trình duyệt không hỗ trợ `background-clip: text` sẽ bỏ qua hai lớp kia và
 * rơi về màu nền — thiếu nó thì chữ trong suốt là chữ **vô hình**, hỏng im lặng và chỉ
 * hỏng ở đúng nhóm trình duyệt không ai thử.
 *
 * Không có animation: khối nằm ngay dưới đường gấp trên trang đang đo LCP, và một
 * chuyển động ở đây chỉ đổi lấy nhiễu chứ không thêm thông tin nào.
 *
 * Hai con số của `siteStats` về đây sau khi khối `<dl>` ở hero bị gỡ, và mỗi con số
 * chỉ gắn vào đúng lời hứa mà nó thật sự chứng minh — số hồ sơ đã đối chiếu chứng cho
 * "hồ sơ xác thực", điểm trung bình chứng cho "chủ động lựa chọn". "Giá cả minh bạch"
 * cố ý không có số: sàn không thu phí nào để mà khoe một con số ở đó.
 */
export function HomeSloganBand({
  stats,
  locale,
  t,
}: {
  stats: SiteStats;
  locale: Locale;
  t: Translator;
}) {
  const intl = INTL_LOCALE[locale];

  /*
    Giữ nguyên nguyên tắc của `buildHomeStats` cũ: ô chưa có dữ liệu thật thì bỏ hẳn,
    không hiện "—" hay số 0. Ở đây lý do mạnh hơn hẳn — "0 hồ sơ đã đối chiếu chứng
    chỉ" đặt ngay dưới câu "Hồ sơ xác thực" là tự phản bác chính mình.

    Cả hai con số đều đi qua `INTL_LOCALE`: bản EN phải ra "4.6", không phải "4,6" —
    con số sai quy ước dấu phân cách vẫn trông như một con số hợp lệ nên không ai báo lỗi.
  */
  const proof: Partial<Record<TrustKey, string>> = {};

  if (stats.verifiedKtvCount > 0) {
    proof.Verified = t('home.trustProofVerified', {
      n: stats.verifiedKtvCount.toLocaleString(intl),
    });
  }

  if (stats.ratingAvg !== null) {
    proof.Choice = t('home.trustProofRating', {
      value: stats.ratingAvg.toLocaleString(intl, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    });
  }

  return (
    /* `-mx-4` giống hero: hai dải liền nhau cùng tràn hết chiều ngang màn hình,
       trong khi nội dung vẫn thẳng hàng với phần còn lại của trang. */
    <section className="-mx-4 border-b border-ink-200 bg-white px-4 py-10 sm:py-12">
      <div className="mx-auto grid max-w-shell items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:gap-14">
        <p className="text-balance font-display">
          <span className="block text-h3 font-semibold text-ink-700 sm:text-h2">
            {t('home.sloganAsk')}
          </span>
          {/* `inline-block` để nét nhấn bên dưới bám đúng bề rộng chữ chứ không bề
              rộng cả dòng, và `pb-1` chừa chỗ cho nó khỏi chạm chân chữ. */}
          <span className="relative mt-1 inline-block pb-1">
            <span className="relative z-10 bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-h1 font-extrabold text-brand-600 text-transparent sm:text-display">
              {t('home.sloganAnswer')}
            </span>
            {/* Nét nhấn champagne — ngoại lệ có chủ ý với luật "champagne chỉ dùng cho
                vị trí trả phí": nó không gắn với hồ sơ hay gói nào nên không làm loãng
                tín hiệu "đây là chỗ được mua". `aria-hidden` vì nó thuần trang trí. */}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-champagne-400/60"
            />
          </span>
        </p>

        <ul className="grid gap-6 sm:grid-cols-3">
          {TRUST_KEYS.map((key) => (
            <li key={key}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                <TrustIcon k={key} className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-h4 text-ink-900">
                {t(`home.trust${key}Title`)}
              </h3>
              <p className="mt-1 text-body leading-6 text-ink-600">{t(`home.trust${key}Body`)}</p>
              {proof[key] && (
                <p className="tabular mt-1.5 font-mono text-caption text-ink-500">{proof[key]}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
