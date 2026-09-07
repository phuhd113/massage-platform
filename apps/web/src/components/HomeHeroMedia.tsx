import Image from 'next/image';

import heroImage from '../../public/hero-massage-tan-noi.jpg';

import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { formatVnd } from '@/lib/site';

import type { Translator } from '@/i18n/t';
import type { SiteStats } from '@/lib/types';

/**
 * Cột phải của hero: ô ảnh lớn + ba con số.
 *
 * Ảnh là **file tĩnh trong `public/`**, không phải ảnh từ R2 như avatar/gallery KTV:
 * đây là ảnh biên tập của sàn, không do ai tải lên và không đổi theo dữ liệu, nên cho
 * nó đi qua `MediaUrls` + `remotePatterns` là bắt trang chủ phụ thuộc vào việc storage
 * có cấu hình đúng hay không. Import tĩnh cũng cho Next biết sẵn kích thước thật, tức
 * không cần khai `width`/`height` bằng tay và không có ca nào lệch tỉ lệ.
 *
 * `priority` vì đây là **LCP element** của trang chủ — khối lớn nhất trên màn hình đầu
 * tiên của trang có nhiều traffic nhất. Không có nó, Next lazy-load và ảnh chỉ bắt đầu
 * tải sau khi hydrate xong, đẩy LCP thêm cả trăm ms ở chính chỉ số xếp hạng.
 *
 * Khối giữ chiều cao cố định 300px và ảnh `object-cover`: hero đổi chiều cao sau khi
 * ảnh tải là điểm trừ CLS, cũng ở đúng trang đó.
 *
 * Nhận `locale` + `t` chứ không nhận từng chuỗi qua prop: khối này có bốn chỗ hiển thị
 * chữ (alt + ba nhãn) và ba chỗ định dạng số. Truyền lẻ từng cái là bốn cơ hội để một
 * cái bị quên — và chuỗi tiếng Việt lọt sang trang EN là loại lỗi không lộ ra khi nhìn
 * bằng mắt, vì trang vẫn render bình thường.
 */
export function HomeHeroMedia({
  stats,
  locale,
  t,
}: {
  stats: SiteStats;
  locale: Locale;
  t: Translator;
}) {
  const cards = buildHomeStats(stats, locale, t);

  return (
    <div className="grid gap-3">
      <div className="relative h-[300px] overflow-hidden rounded-2xl border border-ink-200 bg-brand-50">
        <Image
          src={heroImage}
          alt={t('home.heroImageAlt')}
          fill
          // Cột phải của hero: nửa màn hình ở desktop, tràn chiều ngang ở mobile.
          // Thiếu `sizes` thì `fill` mặc định `100vw` và máy để bàn tải bản rộng
          // gấp đôi mức cần cho một khối chưa tới 600px.
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover"
        />
      </div>

      {cards.length > 0 && (
        <dl className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-ink-200 bg-white p-3.5">
              <dd className="tabular font-mono text-[22px] font-medium leading-7 text-ink-900">
                {c.value}
              </dd>
              <dt className="mt-0.5 text-caption leading-[18px] text-ink-600">{c.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Ba con số dưới ảnh hero.
 *
 * Cùng nguyên tắc với `buildStatCards` của trang khu vực: ô nào chưa có dữ liệu
 * thật thì bỏ hẳn chứ không hiện "—" hay số 0. Riêng ở đây lý do mạnh hơn — đây là
 * lời khai về quy mô của sàn đặt ngay dưới H1, nên "0 KTV" hoặc một ô gạch ngang
 * không chỉ thừa mà còn phản tác dụng với đúng thứ hero đang cố chứng minh.
 *
 * Ô "0 ₫ phí đặt lịch" thì luôn hiện: nó là chính sách, không phải số đo, nên
 * không phụ thuộc vào việc sàn đã có bao nhiêu hồ sơ.
 *
 * **Cả nhãn lẫn con số đều theo locale**, và vế con số là chỗ dễ bỏ sót hơn: bản cũ
 * ghim `toLocaleString('vi-VN')` và `.replace('.', ',')` cho điểm trung bình, nên
 * trang EN hiện "4,6" — đọc thành bốn nghìn sáu chứ không phải bốn phẩy sáu. Đúng
 * cùng bài học với `{min}`/`{max}` của `use-form-validation`: một con số sai quy ước
 * dấu phân cách vẫn trông như một con số hợp lệ, nên không ai báo lỗi.
 */
function buildHomeStats(
  stats: SiteStats,
  locale: Locale,
  t: Translator,
): { label: string; value: string }[] {
  const cards: { label: string; value: string }[] = [];
  const intl = INTL_LOCALE[locale];

  if (stats.verifiedKtvCount > 0) {
    cards.push({
      label: t('home.heroStatVerified'),
      value: stats.verifiedKtvCount.toLocaleString(intl),
    });
  }

  if (stats.ratingAvg !== null) {
    cards.push({
      label: t('home.heroStatRating'),
      // `minimumFractionDigits` để 4.0 vẫn ra "4,0" chứ không rút thành "4": cột này
      // đứng cạnh hai con số khác, một ô lệch số chữ số thập phân đọc như lỗi hiển thị.
      value: stats.ratingAvg.toLocaleString(intl, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    });
  }

  cards.push({ label: t('home.heroStatFee'), value: formatVnd(0, locale) });

  return cards;
}
