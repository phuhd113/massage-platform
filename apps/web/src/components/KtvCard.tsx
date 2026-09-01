import Link from 'next/link';
import { formatDistance, ktvPath } from '@/lib/site';
import type { SearchItem } from '@/lib/types';

export function KtvCard({ ktv }: { ktv: SearchItem }) {
  const distance = formatDistance(ktv.distanceM);

  return (
    <li className="rounded-lg border border-stone-200 bg-white p-4 transition hover:border-brand-500">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">
            <Link href={ktvPath(ktv.slug, ktv.id)} className="hover:text-brand-600">
              {ktv.fullName}
            </Link>
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            {ktv.yearsExperience} năm kinh nghiệm
            {distance && <> · cách bạn {distance}</>}
          </p>
        </div>

        <div className="shrink-0 text-right text-sm">
          {ktv.ratingCount > 0 ? (
            <>
              <div className="font-semibold text-stone-900">★ {ktv.ratingAvg.toFixed(1)}</div>
              <div className="text-stone-500">{ktv.ratingCount} đánh giá</div>
            </>
          ) : (
            <span className="text-stone-400">Chưa có đánh giá</span>
          )}
        </div>
      </div>

      {ktv.isOnline && (
        <span className="mt-3 inline-block rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
          Đang nhận khách
        </span>
      )}
    </li>
  );
}
