'use client';

import { useState } from 'react';
import { AreaSearchBox } from '@/components/AreaSearchBox';
import type { AreaSuggestion } from '@/lib/types';

/** Nhãn của một khu vực đã chọn: tên quận cộng vế tỉnh để phân biệt các quận trùng tên. */
export interface CoverageAreaLabel {
  id: string;
  name: string;
  /** Vế cha đã dựng sẵn ("Thành phố Hồ Chí Minh"). Rỗng khi không tra được. */
  parentPath: string;
}

/**
 * Ô chọn khu vực nhận phục vụ — gõ để tìm, chọn xong thành chip gỡ được.
 *
 * Thay cho lưới 696 nút quận/huyện dựng sẵn, cùng lý do đã thay thẻ `<select>` phẳng
 * ở trang chủ và `/tim-kiem`: danh sách đầy đủ của cả nước không phải thứ người ta
 * *đọc*, nó chỉ làm trang dài hàng chục màn hình và đẩy nút Lưu ra khỏi tầm mắt. KTV
 * biết sẵn mình nhận khu nào — việc của form là để họ gõ tên ra, không phải bắt họ
 * dò trong 63 tỉnh.
 *
 * Bốn điều đi kèm:
 *
 * - **Chỉ nhận cấp DISTRICT.** Backend từ chối mọi cấp khác (`AssertAreasExistAsync`),
 *   nên tỉnh và phường bị lọc ngay ở đây — để lọt xuống thì lỗi chỉ hiện ra lúc bấm
 *   Lưu, sau khi KTV đã điền xong cả form.
 * - **Nhãn chỉ đến cho những khu vực đã chọn**, không phải cả cây hành chính. Trang
 *   trước đây serialize toàn bộ 759 khu vực xuống client (~140KB trong payload RSC)
 *   để tra tên cho vài cái chip — thay lưới nút mà vẫn gửi cây thì mới sửa được nửa
 *   vấn đề.
 * - **Nhãn của khu vực vừa thêm lấy từ chính gợi ý** đã dùng để thêm nó. Không có
 *   đường này thì chip mới hiện "Khu vực không rõ" cho tới khi tải lại trang.
 * - **Trần 30 khu vực do form đặt, không phải backend.** Chạm trần thì ô nhập biến
 *   mất thay vì im lặng bỏ qua cú chọn — im lặng đọc như ô tìm kiếm bị hỏng.
 */
export function CoverageAreaPicker({
  initialLabels,
  selected,
  onChange,
  max,
}: {
  initialLabels: CoverageAreaLabel[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max: number;
}) {
  const [labels, setLabels] = useState<Map<string, CoverageAreaLabel>>(
    () => new Map(initialLabels.map((a) => [a.id, a])),
  );

  const full = selected.length >= max;

  function add(s: AreaSuggestion) {
    // Gợi ý trả cả tỉnh và phường. Phường quy về quận cha thì tiện cho khách đi tìm
    // massage, nhưng ở đây KTV đang khai phạm vi làm việc của chính mình — đoán hộ
    // một quận từ tên phường họ gõ là ghi vào hồ sơ một điều họ không nói.
    if (s.level !== 'DISTRICT') return;
    if (selected.includes(s.id) || full) return;

    setLabels((prev) =>
      new Map(prev).set(s.id, { id: s.id, name: s.name, parentPath: s.parentPath }),
    );
    onChange([...selected, s.id]);
  }

  function remove(id: string) {
    // Nhãn cố ý giữ lại: KTV gỡ nhầm rồi thêm lại ngay là chuyện thường, và bảng nhãn
    // này nhiều nhất cũng chỉ vài chục dòng.
    onChange(selected.filter((x) => x !== id));
  }

  return (
    <div>
      {full ? (
        <p className="rounded-md bg-ink-100 px-3 py-2.5 text-sm text-ink-600">
          Đã đủ {max} khu vực. Gỡ bớt một khu vực bên dưới nếu muốn đổi.
        </p>
      ) : (
        <AreaSearchBox
            labels={{
              clear: 'Xoá khu vực đang chọn',
              suggestions: 'Gợi ý khu vực',
              ktvCount: (n) => (n > 0 ? `${n} KTV` : 'Chưa có KTV'),
            }}
          onSelect={add}
          placeholder="Gõ tên quận/huyện để thêm…"
          // Ô luôn trở về rỗng sau mỗi lần chọn: đây là ô *thêm vào danh sách*, không
          // phải ô giữ một lựa chọn. Giữ lại chữ vừa chọn thì KTV phải tự xoá trước
          // khi gõ khu vực thứ hai, và chip bên dưới mới là nơi nói họ đã chọn những gì.
          key={selected.join(',')}
        />
      )}

      {selected.length === 0 ? (
        <p className="mt-2.5 text-sm text-ink-500">
          Chưa chọn khu vực nào. Hồ sơ chưa xuất hiện ở trang khu vực nào, và chưa mua được gói
          đẩy tin.
        </p>
      ) : (
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {selected.map((id) => {
            const a = labels.get(id);
            return (
              <li
                key={id}
                className="flex items-center gap-1.5 rounded-full border border-brand-500 bg-brand-50 py-1 pl-3 pr-1.5 text-sm text-brand-700"
              >
                <span>
                  {a?.name ?? 'Khu vực không rõ'}
                  {a?.parentPath && <span className="text-brand-400"> · {a.parentPath}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={`Gỡ ${a?.name ?? 'khu vực'}`}
                  className="rounded-full p-1 text-brand-500 transition hover:bg-brand-100 hover:text-brand-700"
                >
                  <svg
                    aria-hidden
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
