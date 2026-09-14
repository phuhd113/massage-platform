'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminAreaEditorial } from '@/lib/types';
import { AREA_PATH_PREFIX } from '@/lib/site';

/**
 * Viết nội dung biên tập cho trang khu vực.
 *
 * <b>Vì sao màn hình này tồn tại:</b> `editorial_note` là một trong hai điều kiện để
 * trang khu vực được index, nhưng trước đợt này cột đó chỉ được **đọc** — không có
 * đường nhập nào ngoài UPDATE bằng SQL tay. Đo trên production ngày 2026-09-14: 0/759
 * khu vực có nội dung, nên không trang khu vực nào index được kể cả khi đủ KTV.
 *
 * <b>Trạng thái mở theo từng dòng, không phải một form chung.</b> Danh sách có tới 759
 * khu vực; một ô soạn thảo duy nhất ở đầu trang buộc người viết cuộn lên cuộn xuống để
 * đối chiếu mình đang viết cho khu vực nào — và viết nhầm khu vực là lỗi chỉ lộ ra khi
 * có người đọc trang công khai.
 */
export function AreaEditorialManager({
  items,
  minKtv,
  minNoteLength,
}: {
  items: AdminAreaEditorial[];
  minKtv: number;
  minNoteLength: number;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function open(area: AdminAreaEditorial) {
    setOpenId(area.id);
    // Đọc lại từ dữ liệu server mỗi lần mở, không giữ bản nháp riêng giữa các lần —
    // cùng lý do với popup lọc ở /tim-kiem: một bản sao trong state sẽ lệch khỏi danh
    // sách bên dưới ngay khi có ai đó sửa ở tab khác.
    setDraft(area.editorialNote ?? '');
    setError(null);
    setDone(null);
  }

  async function save(area: AdminAreaEditorial) {
    setPending(true);
    setError(null);
    setDone(null);

    try {
      // `/api/admin-area`, KHÔNG phải `/api/proxy`: trang khu vực là ISR và nội dung này
      // còn đổi cả sitemap. Xem comment đầu file route đó.
      const res = await fetch(`/api/admin-area?id=${area.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editorialNote: draft.trim() || null }),
      });

      const data = (await res.json().catch(() => null)) as
        | { title?: string; message?: string; indexable?: boolean }
        | null;

      if (!res.ok) {
        setError(data?.message || data?.title || 'Không lưu được nội dung.');
        return;
      }

      setDone(
        data?.indexable
          ? `Đã lưu. Trang ${area.name} nay đủ điều kiện để Google index.`
          : `Đã lưu nội dung cho ${area.name}.`,
      );
      setOpenId(null);
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  // Thông báo thành công đặt **trên** danh sách và nằm ngoài nhánh rỗng. Lưu xong thì
  // `router.refresh()` chạy lại server component, và ở bộ lọc "chưa có nội dung" thì
  // khu vực vừa viết **rời khỏi danh sách** — nếu thông báo nằm dưới danh sách hoặc
  // trong nhánh có dữ liệu, người viết bấm Lưu xong chỉ thấy màn hình trống không kèm
  // xác nhận nào, đọc đúng như thao tác đã hỏng. Thấy được khi kiểm bằng mắt, không
  // suy ra được từ code.
  const banner = done ? (
    <p className="mb-3 rounded-md border border-success-bd bg-success-bg px-4 py-3 text-body-s text-success-fg">
      {done}
    </p>
  ) : null;

  if (items.length === 0) {
    return (
      <div>
        {banner}
        <p className="rounded-lg border border-ink-200 bg-white px-4 py-8 text-center text-body-l text-ink-600">
          Không có khu vực nào khớp.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {banner}
      {items.map((area) => {
        const isOpen = openId === area.id;
        const hasNote = Boolean(area.editorialNote?.trim());
        const enoughKtv = area.ktvCount >= minKtv;

        // Đường dẫn công khai để mở xem trang thật. Tỉnh thì chính slug của nó là vế
        // tỉnh; quận thì vế tỉnh nằm ở cha — đây đúng chỗ cặp slug từng bị gửi thiếu vế.
        const publicPath = area.parentSlug
          ? `${AREA_PATH_PREFIX}/${area.parentSlug}/${area.slug}`
          : `${AREA_PATH_PREFIX}/${area.slug}`;

        return (
          <article key={area.id} className="rounded-lg border border-ink-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-body-l font-semibold text-ink-900">
                  {area.name}
                  {area.parentName && (
                    <span className="font-normal text-ink-500"> · {area.parentName}</span>
                  )}
                </h2>

                {/* Hai vế hiển thị RIÊNG, không gộp thành một chữ "chưa index": người
                    viết cần biết mình đang thiếu vế nào. Thiếu KTV thì viết bao nhiêu
                    chữ cũng không đổi được trạng thái. */}
                <p className="mt-1 text-body-s text-ink-600">
                  <span className={enoughKtv ? 'text-ink-700' : 'text-warning-fg'}>
                    {area.ktvCount} KTV đã duyệt
                    {!enoughKtv && ` (cần ${minKtv})`}
                  </span>
                  {' · '}
                  <span className={hasNote ? 'text-ink-700' : 'text-warning-fg'}>
                    {hasNote ? 'đã có nội dung' : 'chưa có nội dung'}
                  </span>
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-body-s font-medium ${
                    area.indexable ? 'border border-success-bd bg-success-bg text-success-fg' : 'bg-ink-100 text-ink-600'
                  }`}
                >
                  {area.indexable ? 'Được index' : 'noindex'}
                </span>

                <a
                  href={publicPath}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md px-2.5 py-1 text-body-s text-brand-600 hover:bg-brand-50"
                >
                  Xem trang
                </a>

                {!isOpen && (
                  <button
                    type="button"
                    onClick={() => open(area)}
                    className="rounded-md bg-brand-500 px-3 py-1.5 text-body-s font-medium text-white hover:bg-brand-600"
                  >
                    {hasNote ? 'Sửa' : 'Viết'}
                  </button>
                )}
              </div>
            </div>

            {!isOpen && hasNote && (
              <p className="mt-3 line-clamp-2 text-body-s text-ink-600">{area.editorialNote}</p>
            )}

            {isOpen && (
              <div className="mt-4">
                <label
                  htmlFor={`note-${area.id}`}
                  className="block text-body-s font-medium text-ink-800"
                >
                  Nội dung riêng cho trang {area.name}
                </label>
                <p className="mt-1 text-body-s text-ink-600">
                  Viết về đặc điểm thật của khu vực — khu dân cư, nhu cầu, lưu ý khi di
                  chuyển. Tối thiểu {minNoteLength} ký tự. Đây là thứ phân biệt trang này
                  với hàng trăm trang khu vực cùng mẫu; chép chung một đoạn cho nhiều khu
                  vực thì Google vẫn xếp là nội dung trùng lặp.
                </p>

                <textarea
                  id={`note-${area.id}`}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded-md border border-ink-300 px-3 py-2 text-body-l text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  placeholder={`Ví dụ: ${area.name} là khu vực...`}
                />

                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  {/* Đếm ký tự hiện ngay cạnh ô nhập chứ không để người viết tự đoán —
                      backend từ chối dưới ngưỡng, và một lượt gửi hỏng sau khi đã viết
                      xong là cách chắc chắn để người ta bỏ dở. */}
                  <span
                    className={`text-body-s ${
                      draft.trim().length === 0 || draft.trim().length >= minNoteLength
                        ? 'text-ink-500'
                        : 'text-warning-fg'
                    }`}
                  >
                    {draft.trim().length} / {minNoteLength} ký tự
                    {draft.trim().length === 0 && ' — để trống là gỡ nội dung khỏi trang'}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => save(area)}
                    disabled={pending}
                    className="rounded-md bg-brand-500 px-4 py-2 text-body-s font-medium text-white hover:bg-brand-600 disabled:opacity-60"
                  >
                    {pending ? 'Đang lưu…' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(null)}
                    disabled={pending}
                    className="rounded-md border border-ink-300 px-4 py-2 text-body-s text-ink-700 hover:bg-ink-50 disabled:opacity-60"
                  >
                    Huỷ
                  </button>
                </div>

                {/* Thông báo đặt ngay dưới nút vừa bấm, không phải một chỗ chung ở đầu
                    trang — đúng bài học từ ProfileMediaSection, nơi lỗi hiện cách nút
                    vài màn hình cuộn nên đọc ra như nút bị hỏng. */}
                {error && <p className="mt-2 text-body-s text-danger-fg">{error}</p>}
              </div>
            )}
          </article>
        );
      })}

    </div>
  );
}
