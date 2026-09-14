'use client';

import { useEffect, useState } from 'react';
import type { DistrictOption } from '@/lib/types';
import type { CoverageAreaLabel } from '@/components/CoverageAreaPicker';

/**
 * Khai khu vực nhận phục vụ bằng **bấm chọn**: thả xuống một tỉnh, rồi tick các
 * quận/huyện của tỉnh đó.
 *
 * Đây là đường **duy nhất** để thêm khu vực — ô gõ tìm theo tên đã được gỡ. KTV biết
 * trước mình nhận khu nào và hầu hết nằm trong cùng một tỉnh, nên việc gõ đúng chính
 * tả có dấu từng quận là bắt họ trả một cái giá không đổi lại được gì; danh sách của
 * đúng một tỉnh thì nhìn là thấy.
 *
 * **Vì sao `<select>` cho tỉnh mà không phải lưới nút.** 63 tỉnh dựng thành nút sẽ
 * chiếm nhiều màn hình dọc và đẩy nút Lưu ra khỏi tầm mắt — đúng vấn đề đã khiến lưới
 * 696 quận bị gỡ trước đây. Thẻ select gói chúng vào một dòng, và trên điện thoại nó
 * mở ra bánh xe chọn của hệ điều hành, thứ thao tác quen tay hơn bất kỳ danh sách tự
 * dựng nào.
 *
 * **Quận thì KHÔNG dùng select**, dù cùng là "chọn từ danh sách": select bội chọn là
 * một trong những control khó dùng nhất trên web (phải giữ Ctrl, bấm nhầm một cái là
 * mất sạch lựa chọn trước đó) và trên điện thoại nó biến thành một danh sách không nói
 * rõ mình đang ở chế độ nhiều lựa chọn. Ô tick thì trạng thái luôn hiện rõ và bấm nhầm
 * chỉ mất đúng một ô.
 *
 * Năm điều đi kèm:
 *
 * - **Quận đã chọn hiện là đã tick và khoá lại**, không biến mất khỏi danh sách. Biến
 *   mất thì KTV mở lại tỉnh và thấy một danh sách khuyết, không hiểu vì sao thiếu đúng
 *   những quận mình vừa thêm.
 * - **Chạm trần thì các ô chưa tick bị vô hiệu**, chứ không im lặng bỏ qua cú tick —
 *   im lặng đọc như ô tick bị hỏng.
 * - **Bản nháp tách khỏi danh sách đã lưu**: tick cả nhóm rồi thêm một lượt, và đổi
 *   tỉnh giữa chừng là bỏ hết phần đang tick dở.
 * - **Nhãn dựng từ chính dòng vừa tick** (tên quận + tên tỉnh đang mở), nên chip mới
 *   hiện đúng tên ngay mà không cần tải lại trang.
 * - **Danh sách tỉnh tải một lần khi mở form**; quận chỉ tải khi thật sự chọn một tỉnh.
 * - **Chạm trần số tỉnh thì chặn ngay lúc mở tỉnh đó**, thay cả danh sách quận bằng
 *   lời giải thích nêu đích danh hai tỉnh đang chiếm chỗ. Để KTV tick xong cả nhóm rồi
 *   mới báo là bắt họ làm một việc đằng nào cũng bị huỷ — và `<select>` vẫn cho *mở*
 *   mọi tỉnh vì đó là cách duy nhất họ đọc được câu giải thích cho đúng tỉnh mình định
 *   chọn.
 */
export function ProvinceDistrictPicker({
  selected,
  onAdd,
  remaining,
  usedProvinces,
  maxProvinces,
}: {
  selected: string[];
  /** Thêm nhiều khu vực một lượt — nơi gọi lo việc gộp vào danh sách và bảng nhãn. */
  onAdd: (areas: CoverageAreaLabel[]) => void;
  /** Số khu vực còn thêm được. 0 thì mọi ô chưa tick bị khoá. */
  remaining: number;
  /** Tên các tỉnh mà khu vực đã chọn đang trải ra. */
  usedProvinces: Set<string>;
  /** Trần số tỉnh — xem `MAX_COVERAGE_PROVINCES`. */
  maxProvinces: number;
}) {
  const [provinces, setProvinces] = useState<DistrictOption[]>([]);
  const [provinceSlug, setProvinceSlug] = useState('');
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(false);
  // Các quận vừa tick trong lượt mở này, chưa bấm "Thêm". Tách khỏi `selected` để KTV
  // tick cả nhóm rồi thêm một lượt.
  const [draft, setDraft] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/areas/provinces', { signal: ctrl.signal })
      .then((r) => r.json() as Promise<DistrictOption[]>)
      .then(setProvinces)
      .catch(() => {
        /* Rỗng thì ô thả xuống tự nói lên điều đó. */
      });
    return () => ctrl.abort();
  }, []);

  const province = provinces.find((p) => p.slug === provinceSlug) ?? null;

  useEffect(() => {
    if (!provinceSlug) {
      setDistricts([]);
      return;
    }

    // AbortController vì KTV có thể đổi tỉnh trước khi lượt gọi trước kịp về: phản hồi
    // cũ về sau sẽ vẽ danh sách quận của tỉnh họ vừa rời khỏi, dưới cái tên tỉnh mới.
    const ctrl = new AbortController();
    setLoading(true);
    setDraft(new Set());

    fetch(`/api/areas/districts?province=${encodeURIComponent(provinceSlug)}`, {
      signal: ctrl.signal,
    })
      .then((r) => r.json() as Promise<DistrictOption[]>)
      .then(setDistricts)
      .catch(() => {
        /* Huỷ vì đổi tỉnh, hoặc mạng lỗi. Danh sách rỗng đã tự nói lên điều đó. */
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [provinceSlug]);

  const full = remaining <= 0;

  // Đã dùng hết quota tỉnh, và tỉnh đang mở KHÔNG nằm trong số đã dùng → mọi quận ở
  // đây đều là tỉnh thứ ba. Chặn ngay ở tầng này thay vì lúc bấm "Thêm": để KTV tick
  // xong cả nhóm rồi mới báo là bắt họ làm một việc đằng nào cũng bị huỷ.
  const provinceBlocked =
    province !== null &&
    !usedProvinces.has(province.name) &&
    usedProvinces.size >= maxProvinces;

  function toggle(id: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      // Chặn ở đây chứ không lúc bấm "Thêm": tick được rồi mới báo vượt trần nghĩa là
      // KTV phải tự đoán bỏ bớt cái nào.
      else if (next.size < remaining) next.add(id);
      return next;
    });
  }

  function commit() {
    if (!province || draft.size === 0) return;

    onAdd(
      districts
        .filter((d) => draft.has(d.id))
        .map((d) => ({ id: d.id, name: d.name, parentPath: province.name })),
    );
    setDraft(new Set());
  }

  // Quận đã nằm trong hồ sơ thì không tick lại được; đếm riêng để nút "Chọn tất cả"
  // biết còn gì để chọn.
  const selectable = districts.filter((d) => !selected.includes(d.id));
  const allDrafted = selectable.length > 0 && selectable.every((d) => draft.has(d.id));

  function toggleAll() {
    // "Bỏ chọn tất cả" luôn làm được, kể cả khi đang chạm trần — nếu không thì KTV
    // tick đầy rồi không còn cách nào gỡ ngoài việc đổi tỉnh.
    if (allDrafted) {
      setDraft(new Set());
      return;
    }
    setDraft(new Set(selectable.slice(0, remaining).map((d) => d.id)));
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
      <label className="mb-1.5 block text-sm font-medium text-ink-700" htmlFor="coverage-province">
        Chọn tỉnh/thành phố
      </label>

      <select
        id="coverage-province"
        value={provinceSlug}
        onChange={(e) => setProvinceSlug(e.target.value)}
        className="w-full rounded-md border border-ink-200 bg-white px-3 py-2.5 text-body text-ink-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        <option value="">— Chọn tỉnh/thành phố —</option>
        {provinces.map((p) => (
          <option key={p.id} value={p.slug}>
            {p.name}
          </option>
        ))}
      </select>

      {province && (
        <div className="mt-3">
          {provinceBlocked ? (
            // Nêu đích danh những tỉnh đang chiếm chỗ: một câu "đã đủ 2 tỉnh" trần
            // bắt KTV tự cuộn xuống đọc hết chip mới biết phải gỡ cái nào.
            <div className="rounded-md border border-warning-bd bg-warning-bg px-3 py-2.5 text-sm text-warning-fg">
              <p>
                Mỗi hồ sơ chỉ nhận khách ở tối đa <strong>{maxProvinces} tỉnh/thành</strong>,
                và bạn đã chọn {[...usedProvinces].join(' và ')}.
              </p>
              <p className="mt-1">
                Muốn nhận khách ở {province.name}, hãy gỡ hết khu vực của một tỉnh bên dưới
                trước.
              </p>
            </div>
          ) : loading ? (
            <p className="text-sm text-ink-500">Đang tải danh sách quận/huyện…</p>
          ) : districts.length === 0 ? (
            <p className="text-sm text-ink-500">
              Không tải được danh sách quận/huyện của {province.name}. Thử chọn lại tỉnh.
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-600">
                  {province.name} · {districts.length} quận/huyện
                </span>
                {selectable.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="rounded text-sm font-medium text-brand-600 transition hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                  >
                    {allDrafted ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                )}
              </div>

              {/* Cuộn trong khối thay vì để danh sách đẩy dài trang: một tỉnh có thể
                  tới ~30 quận, và nút "Thêm" bên dưới phải luôn nằm trong tầm mắt —
                  đúng vấn đề đã khiến lưới 696 nút bị gỡ. */}
              <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
                {districts.map((d) => {
                  const already = selected.includes(d.id);
                  const checked = already || draft.has(d.id);
                  // Chạm trần chỉ khoá những ô CHƯA tick: ô đang tick vẫn phải bỏ được.
                  const disabled =
                    already ||
                    (full && !draft.has(d.id)) ||
                    (!draft.has(d.id) && draft.size >= remaining);

                  return (
                    <li key={d.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition ${
                          disabled && !already
                            ? 'cursor-not-allowed text-ink-400'
                            : 'text-ink-800 hover:bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggle(d.id)}
                          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                        />
                        <span>{d.name}</span>
                        {already && <span className="text-xs text-ink-400">(đã chọn)</span>}
                      </label>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={commit}
                disabled={draft.size === 0}
                className="mt-2.5 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500"
              >
                {draft.size === 0
                  ? 'Chọn quận/huyện để thêm'
                  : `Thêm ${draft.size} khu vực đã chọn`}
              </button>

              {full && (
                <p className="mt-2 text-sm text-ink-500">
                  Đã đủ số khu vực tối đa. Gỡ bớt bên dưới nếu muốn đổi.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
