'use client';

import Link from 'next/link';
import { showsVipFrame, tierBadgeLabel, tierFromBoost } from '@/lib/promotion-tier';
import { formatDistance, ktvPath } from '@/lib/site';
import type { SearchItem } from '@/lib/types';

/**
 * Thẻ KTV rút gọn cho danh sách cạnh bản đồ toàn màn hình.
 *
 * Tách khỏi `KtvCard` chứ không thêm prop vào nó: `KtvCard` là **server
 * component** và nằm trong HTML đầu tiên — đó là thứ Google đọc ở trang khu vực.
 * Thêm `onMouseEnter` vào nó sẽ kéo cả thẻ thành client component và mất luôn
 * lợi thế đó. Thẻ này chỉ sống trong lớp phủ bản đồ, nơi SEO không tính.
 *
 * Cùng quy ước tín hiệu trả phí với `KtvCard`: chỉ hạng cao nhất mới được đổi cả
 * khung thẻ, hai hạng còn lại chỉ nhận chip.
 */
export function MapKtvCard({
  ktv,
  active,
  onHover,
}: {
  ktv: SearchItem;
  active: boolean;
  onHover: (id: string | null) => void;
}) {
  const distance = formatDistance(ktv.distanceM);
  const tier = tierFromBoost(ktv.boostPoints);
  const isVip = showsVipFrame(tier);

  const base = isVip
    ? 'border-champagne-200 bg-gradient-to-b from-champagne-50 via-white to-white'
    : 'border-ink-200 bg-white';

  return (
    <li
      onMouseEnter={() => onHover(ktv.id)}
      onMouseLeave={() => onHover(null)}
      className={`rounded-lg border p-3 transition ${base} ${
        active ? 'border-brand-500 shadow-card-hover' : 'shadow-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-body font-semibold text-ink-900">
            <Link
              href={ktvPath(ktv.slug, ktv.id)}
              // Vị trí trả phí phải khai báo với công cụ tìm kiếm, kể cả trong lớp
              // phủ — link vẫn là link thật và vẫn được crawl nếu lọt ra ngoài.
              rel={isVip ? 'sponsored' : undefined}
              className="hover:text-brand-600"
            >
              {ktv.fullName}
            </Link>
          </h3>
          <p className="mt-0.5 text-caption text-ink-600">
            {ktv.yearsExperience} năm kinh nghiệm
            {distance && <> · cách bạn {distance}</>}
          </p>
        </div>

        <div className="shrink-0 text-right text-caption">
          {ktv.ratingCount > 0 ? (
            <>
              <div className="font-semibold text-ink-900">★ {ktv.ratingAvg.toFixed(1)}</div>
              <div className="text-ink-500">{ktv.ratingCount}</div>
            </>
          ) : (
            <span className="text-ink-400">Chưa có</span>
          )}
        </div>
      </div>

      {(tier || ktv.isOnline) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tier && (
            <span className="rounded-full border border-champagne-200 bg-champagne-50 px-2 py-0.5 text-caption font-semibold text-champagne-600">
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
