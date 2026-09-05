import Image from 'next/image';
import Link from 'next/link';
import { AreaIcon, CertifiedIcon } from '@/components/icons';
import { initialOf, isOptimizable, mediaUrl } from '@/lib/media';
import { showsVipFrame, tierBadgeLabel, tierFromBoost } from '@/lib/promotion-tier';
import { type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { formatDistance, formatRating, formatVnd, ktvPath } from '@/lib/site';
import type { SearchItem } from '@/lib/types';

/**
 * Thẻ KTV trong danh sách kết quả.
 *
 * Đây là chỗ hàng hoá của sàn được giao: KTV trả phí để đứng trên, và cũng để
 * *nhìn ra được* là đang đứng trên. Trước đây thẻ render giống hệt nhau bất kể
 * `boostPoints`, nên gói VIP chỉ giao được một nửa thứ đã bán.
 *
 * Ranh giới quan trọng: cả thẻ là server component. Chỉ nút liên hệ (ở trang hồ
 * sơ) mới là client — nhờ vậy tên, đánh giá và khoảng cách nằm trong HTML đầu
 * tiên, tức thứ Google đọc được.
 */
export function KtvCard({ ktv, locale }: { ktv: SearchItem; locale: Locale }) {
  const t = createTranslator(getDictionary(locale), locale);
  const distance = formatDistance(ktv.distanceM);
  const tier = tierFromBoost(ktv.boostPoints);
  const isVip = showsVipFrame(tier);
  const href = ktvPath(locale, ktv.slug, ktv.id);

  return (
    <li
      className={`overflow-hidden rounded-xl border bg-white transition ${
        isVip
          ? // Khung champagne cho hạng cao nhất. Thẻ VIP KHÔNG to hơn và không ẩn
            // bớt thông tin của thẻ thường: KTV mua sự chú ý trước, không mua
            // quyền cản khách so sánh.
            'border-champagne-200 shadow-vip'
          : 'border-ink-200 shadow-card hover:border-brand-300 hover:shadow-card-hover'
      }`}
    >
      {/*
        Băng khai báo quảng cáo nằm TRÊN NÓC thẻ, không phải chip lẫn trong nội
        dung: vị trí trả phí phải đọc được trước cả tên KTV, nếu không khách đã
        đọc xong hồ sơ rồi mới biết đây là quảng cáo.
      */}
      {tier && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-champagne-100 bg-champagne-50 px-4 py-2">
          <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-champagne-600">
            <TierIcon vip={isVip} />
            {tierBadgeLabel(tier, t)}
          </span>
          <span className="text-caption text-champagne-600">
            {t('ktvCard.sponsoredTitle')}
          </span>
        </div>
      )}

      <div className="flex gap-4 p-4">
        <Avatar
          name={ktv.fullName}
          href={href}
          sponsored={tier !== null}
          avatarUrl={ktv.avatarUrl}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 text-h3 text-ink-900">
              <Link
                href={href}
                // Vị trí trả phí phải khai báo với công cụ tìm kiếm. Bỏ qua thuộc
                // tính này là rủi ro thật với chính thứ hạng organic của cả site.
                //
                // Điều kiện là `tier` chứ KHÔNG phải `isVip`: `isVip` chỉ đúng với
                // hạng cao nhất, nên Instant Boost và Featured Badge — vẫn là chỗ
                // KTV trả tiền để đứng — từng thoát ra ngoài như link organic.
                rel={tier ? 'sponsored' : undefined}
                className="transition hover:text-brand-600"
              >
                {ktv.fullName}
              </Link>
            </h3>

            <div className="shrink-0 text-right">
              {ktv.ratingCount > 0 ? (
                <>
                  <div className="tabular text-h4 text-ink-900">
                    <span aria-hidden>★</span> {formatRating(ktv.ratingAvg, locale)}
                  </div>
                  <div className="text-caption text-ink-500">
                    {t('ktvCard.reviews', { count: ktv.ratingCount })}
                  </div>
                </>
              ) : (
                // Hồ sơ mới hiện "chưa có đánh giá" chứ không hiện ★0,0 — điểm 0
                // đọc như bị chê, trong khi thực tế là chưa ai đánh giá.
                <>
                  <div className="text-body-s text-ink-500">{t('ktvCard.newProfile')}</div>
                  <div className="text-caption text-ink-400">{t('ktvCard.noReviews')}</div>
                </>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/*
              Chứng chỉ đứng đầu hàng chip: đây là hồ sơ của người sẽ tới tận nhà
              khách, nên bằng chứng đã đối chiếu là thứ đáng đọc trước. Chỉ hiện
              khi > 0 — "0 chứng chỉ" đọc như một lời tố cáo, trong khi thực tế
              thường là hồ sơ mới chưa nộp.
            */}
            {ktv.verifiedCertCount > 0 && (
              <Chip tone="success">
                <ShieldCheckIcon />
                {ktv.verifiedCertCount} chứng chỉ đã duyệt
              </Chip>
            )}

            {distance && (
              <Chip tone="neutral">
                <PinIcon />
                cách bạn <span className="tabular">{distance}</span>
              </Chip>
            )}

            {ktv.isOnline && (
              <Chip tone="success">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success-fg" />
                Đang nhận khách
              </Chip>
            )}
          </div>

          {/*
            Bio cắt còn 2 dòng bằng CSS chứ không cắt chuỗi ở JS: cắt theo số ký tự
            sẽ chặt giữa từ tiếng Việt và làm hỏng dấu, còn line-clamp cắt theo đúng
            chỗ dòng thật sự tràn ở từng bề rộng màn hình.
          */}
          {ktv.bio && (
            <p className="mt-2.5 line-clamp-2 text-body text-ink-600">
              {ktv.yearsExperience} năm kinh nghiệm · {ktv.bio}
            </p>
          )}

          {/*
            Hàng giá và hai nút hành động ngăn bằng một đường kẻ: phần trên là "người
            này là ai", phần dưới là "làm gì tiếp" — hai câu hỏi khác nhau.
          */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3">
            {ktv.services.length > 0 ? (
              <ul className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-body-s text-ink-600">
                {ktv.services.map((s, i) => (
                  <li key={s.name}>
                    {i > 0 && (
                      <span aria-hidden className="mr-2 text-ink-300">
                        ·
                      </span>
                    )}
                    {s.name} {t('ktvCard.minutes', { n: s.durationMin })}{' '}
                    {/*
                      Giá đậm hơn tên dịch vụ vì đó là thứ khách quét mắt để so sánh
                      giữa các thẻ. `tabular` giữ chữ số thẳng cột khi nhiều thẻ xếp
                      chồng nhau.
                    */}
                    <strong className="tabular font-semibold text-ink-900">
                      {formatVnd(s.priceFrom, locale)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-body-s text-ink-400">{t('ktvCard.noPrices')}</span>
            )}

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={href}
                rel={tier ? 'sponsored' : undefined}
                className="rounded-full border border-ink-300 px-4 py-2 text-body-s font-semibold text-ink-700 transition hover:border-ink-400 hover:bg-ink-50"
              >
                {t('ktvCard.viewProfile')}
              </Link>
              {/*
                "Gọi" dẫn sang trang hồ sơ chứ không phải `tel:` — số điện thoại chỉ
                được trả về trong response của POST /leads, để mọi lượt liên hệ đều
                được đếm (Phase 2 tính phí dựa trên con số đó) và để chặn quét số
                hàng loạt. Đặt tel: ở đây sẽ vừa lộ số vừa làm hỏng số liệu.
              */}
              <Link
                href={href}
                rel={tier ? 'sponsored' : undefined}
                className="rounded-full bg-brand-500 px-5 py-2 text-body-s font-semibold text-white shadow-button transition hover:bg-brand-600"
              >
                {t('ktvCard.call')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Ô ảnh chân dung.
 *
 * Backend chưa có trường ảnh cho KTV (`ktv_profiles` không có cột avatar, và luồng
 * upload duy nhất đang có là chứng chỉ), nên đây là placeholder giữ đúng bố cục và
 * kích thước của artboard: chữ cái đầu trên nền brand nhạt. Khi có avatar thật thì
 * thay ruột component này, mọi thứ quanh nó không phải đổi.
 *
 * Chữ cái lấy từ tên riêng (từ cuối) vì người Việt gọi nhau bằng tên, không phải họ.
 */
/**
 * Ảnh đại diện, hoặc chữ cái đầu tên khi KTV chưa đặt ảnh.
 *
 * `aria-hidden` + `tabIndex={-1}` giữ nguyên: tên KTV ngay bên cạnh đã là link tới
 * cùng chỗ, nên với trình đọc màn hình đây là link trùng lặp. Vì vậy ảnh mang
 * `alt=""` — mô tả nó sẽ đọc lại đúng cái tên vừa đọc xong.
 */
function Avatar({
  name,
  href,
  sponsored,
  avatarUrl,
}: {
  name: string;
  href: string;
  sponsored: boolean;
  avatarUrl: string | null;
}) {
  const src = mediaUrl(avatarUrl);

  return (
    <Link
      href={href}
      rel={sponsored ? 'sponsored' : undefined}
      aria-hidden
      tabIndex={-1}
      className="hidden h-[132px] w-[132px] shrink-0 select-none items-center justify-center overflow-hidden rounded-lg border border-ink-200 bg-brand-50 text-4xl font-bold text-brand-400 transition hover:border-brand-300 sm:flex"
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={132}
          height={132}
          // Kích thước cố định trong bố cục nên khai đúng 132px: để Next tự đoán
          // sẽ tải bản rộng theo viewport, tức vài trăm KB thừa cho mỗi thẻ trên
          // một trang có tới 20 thẻ.
          sizes="132px"
          className="h-full w-full object-cover"
          unoptimized={!isOptimizable(src)}
        />
      ) : (
        initialOf(name)
      )}
    </Link>
  );
}

/** Chip thông tin nhỏ dưới tên KTV. */
function Chip({ tone, children }: { tone: 'success' | 'neutral'; children: React.ReactNode }) {
  const toneClass =
    tone === 'success'
      ? 'border-success-bd bg-success-bg text-success-fg'
      : 'border-ink-200 bg-ink-50 text-ink-600';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}

/** Vương miện cho hạng cao nhất, tia sét cho các hạng đẩy tin còn lại. */
function TierIcon({ vip }: { vip: boolean }) {
  return (
    <svg
      aria-hidden
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {vip ? (
        <>
          <path d="m2 8 4 12h12l4-12-5 4-5-6-5 6-5-4z" />
          <path d="M2 20h20" />
        </>
      ) : (
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      )}
    </svg>
  );
}

/** Khiên có dấu tích — chứng chỉ đã được đối chiếu với tổ chức cấp. */
function ShieldCheckIcon() {
  return <CertifiedIcon size={16} className="h-3 w-3" />;
}

function PinIcon() {
  return <AreaIcon size={16} className="h-3 w-3" />;
}
