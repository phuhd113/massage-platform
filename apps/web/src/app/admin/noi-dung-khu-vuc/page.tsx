import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AreaEditorialManager } from '@/components/AreaEditorialManager';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import type { AdminAreaEditorialList } from '@/lib/types';

export const metadata: Metadata = { title: 'Nội dung khu vực' };

/**
 * Biên tập nội dung riêng cho ~760 trang khu vực.
 *
 * Trang này là bước còn thiếu của điều kiện index: `AreaService.IsIndexable` đòi **hai**
 * vế — đủ KTV đã duyệt **và** có `editorial_note` — nhưng vế thứ hai chưa bao giờ có
 * đường nhập liệu. Đo trên production ngày 2026-09-14: 0/759 khu vực có nội dung, nên
 * không trang khu vực nào vào được sitemap, kể cả khu vực đủ KTV.
 */
export default async function AreaEditorialPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; onlyReady?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const onlyReady = params.onlyReady === '1';

  const query = new URLSearchParams({ limit: '100' });
  if (q) query.set('q', q);
  if (onlyReady) query.set('onlyReady', 'true');

  let list: AdminAreaEditorialList;

  try {
    list = await authFetch<AdminAreaEditorialList>(`/admin/areas?${query}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/noi-dung-khu-vuc');
    throw err;
  }

  const indexableCount = list.items.filter((a) => a.indexable).length;

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Nội dung khu vực</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Trang khu vực chỉ được Google index khi có <strong>đủ {list.minKtv} KTV đã duyệt</strong> và{' '}
        <strong>nội dung biên tập riêng</strong>. Thiếu một trong hai thì trang mang thẻ{' '}
        <code className="rounded bg-ink-100 px-1 py-0.5 text-body-s">noindex</code> và không vào
        sitemap — cả nước có ~760 trang khu vực sinh từ cùng một mẫu, nên trang không có nội dung
        riêng là doorway page và Google phạt cả tên miền chứ không riêng trang đó.
      </p>

      {/* Bộ lọc là link thật, không phải state client: nó phải chia sẻ lại được và phải
          sống qua nút Back — cùng nguyên tắc với bộ lọc ở /tim-kiem. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {/* Không gắn số vào chip này: `total` là tổng của kết quả **đã lọc**, nên khi
            bộ lọc đang bật thì chip "Tất cả" sẽ mang con số của bộ lọc kia — đọc ra là
            cả nước chỉ có 1 khu vực. Con số thật nằm ở dòng đếm bên dưới, nơi nó luôn
            mô tả đúng danh sách đang hiện. */}
        <Link
          href="/admin/noi-dung-khu-vuc"
          className={`rounded-full px-3.5 py-1.5 text-body-s font-medium ${
            !onlyReady ? 'bg-brand-500 text-white' : 'border border-ink-300 text-ink-700 hover:bg-ink-50'
          }`}
        >
          Tất cả
        </Link>
        <Link
          href="/admin/noi-dung-khu-vuc?onlyReady=1"
          className={`rounded-full px-3.5 py-1.5 text-body-s font-medium ${
            onlyReady ? 'bg-brand-500 text-white' : 'border border-ink-300 text-ink-700 hover:bg-ink-50'
          }`}
        >
          Đủ KTV, chưa có nội dung
        </Link>

        <form action="/admin/noi-dung-khu-vuc" className="flex items-center gap-2">
          {onlyReady && <input type="hidden" name="onlyReady" value="1" />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Tìm theo tên khu vực"
            className="rounded-md border border-ink-300 px-3 py-1.5 text-body-s text-ink-900 focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md border border-ink-300 px-3 py-1.5 text-body-s text-ink-700 hover:bg-ink-50"
          >
            Tìm
          </button>
        </form>
      </div>

      <p className="mt-4 text-body-s text-ink-600">
        Đang hiện {list.items.length} / {list.total} khu vực · {indexableCount} trang đủ điều kiện
        index.
      </p>

      <div className="mt-4">
        <AreaEditorialManager
          items={list.items}
          minKtv={list.minKtv}
          minNoteLength={list.minNoteLength}
        />
      </div>
    </>
  );
}
