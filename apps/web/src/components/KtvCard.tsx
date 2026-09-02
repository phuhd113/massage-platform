import Link from 'next/link';
import { showsVipFrame, tierBadgeLabel, tierFromBoost } from '@/lib/promotion-tier';
import { formatDistance, ktvPath } from '@/lib/site';
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
export function KtvCard({ ktv }: { ktv: SearchItem }) {
  const distance = formatDistance(ktv.distanceM);
  const tier = tierFromBoost(ktv.boostPoints);
  const isVip = showsVipFrame(tier);

  return (
    <li
      className={
        isVip
          ? // Khung champagne + rail gradient bên trái. Thẻ VIP KHÔNG to hơn và
            // không ẩn bớt thông tin của thẻ thường: KTV mua sự chú ý trước,
            // không mua quyền cản khách so sánh.
            'relative overflow-hidden rounded-lg border border-champagne-200 bg-gradient-to-b from-champagne-50 via-white to-white p-4 shadow-vip transition before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-gradient-to-b before:from-champagne-400 before:to-champagne-600'
          : 'rounded-lg border border-ink-200 bg-white p-4 shadow-card transition hover:border-brand-500 hover:shadow-card-hover'
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-h4">
            <Link
              href={ktvPath(ktv.slug, ktv.id)}
              // Vị trí trả phí phải khai báo với công cụ tìm kiếm. Bỏ qua thuộc
              // tính này là rủi ro thật với chính thứ hạng organic của cả site.
              rel={isVip ? 'sponsored' : undefined}
              className="hover:text-brand-600"
            >
              {ktv.fullName}
            </Link>
          </h3>
          <p className="mt-1 text-body-s text-ink-600">
            {ktv.yearsExperience} năm kinh nghiệm
            {distance && <> · cách bạn {distance}</>}
          </p>
        </div>

        <div className="shrink-0 text-right text-body-s">
          {ktv.ratingCount > 0 ? (
            <>
              <div className="tabular font-semibold text-ink-900">★ {ktv.ratingAvg.toFixed(1)}</div>
              <div className="text-ink-500">{ktv.ratingCount} đánh giá</div>
            </>
          ) : (
            // Hồ sơ mới hiện "chưa có đánh giá" chứ không hiện ★0,0 — điểm 0
            // đọc như bị chê, trong khi thực tế là chưa ai đánh giá.
            <span className="text-ink-400">Chưa có đánh giá</span>
          )}
        </div>
      </div>

      {(tier || ktv.isOnline) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tier && (
            <span className="inline-flex items-center gap-1 rounded-full border border-champagne-200 bg-champagne-50 px-2 py-0.5 text-caption font-semibold text-champagne-600">
              <TierIcon vip={isVip} />
              {tierBadgeLabel(tier)}
            </span>
          )}

          {ktv.isOnline && (
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-caption font-medium text-brand-700">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success-fg" />
              Đang nhận khách
            </span>
          )}
        </div>
      )}
    </li>
  );
}

/** Vương miện cho hạng cao nhất, tia sét cho các hạng đẩy tin còn lại. */
function TierIcon({ vip }: { vip: boolean }) {
  return (
    <svg
      aria-hidden
      width="11"
      height="11"
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
