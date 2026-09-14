'use client';

import { useState } from 'react';
import { ProvinceDistrictPicker } from '@/components/ProvinceDistrictPicker';

/**
 * Số tỉnh/thành tối đa mà khu vực nhận phục vụ được trải ra.
 *
 * **Phải khớp `KtvProfileService.MaxCoverageProvinces` ở backend** — nơi luật này thật
 * sự được thực thi. Bản ở đây chỉ để nói trước cho KTV ngay lúc họ định chọn, thay vì
 * để họ điền xong cả form rồi nhận lỗi lúc bấm Lưu; lệch nhau thì giao diện hoặc khoá
 * sớm một tỉnh hợp lệ, hoặc mời chọn một tỉnh mà backend sẽ từ chối.
 *
 * Cố ý **không** có luật "hai tỉnh phải giáp nhau": bảng khu vực chỉ có tâm tỉnh chứ
 * không có ranh giới, và đã đo được rằng không ngưỡng khoảng cách nào vừa cho hết cặp
 * liền kề thật vừa chặn hết cặp không liền kề — xem ghi chú dài ở backend.
 */
export const MAX_COVERAGE_PROVINCES = 2;

/** Nhãn của một khu vực đã chọn: tên quận cộng vế tỉnh để phân biệt các quận trùng tên. */
export interface CoverageAreaLabel {
  id: string;
  name: string;
  /** Vế cha đã dựng sẵn ("Thành phố Hồ Chí Minh"). Rỗng khi không tra được. */
  parentPath: string;
}

/**
 * Khu vực nhận phục vụ — chọn tỉnh rồi tick quận/huyện, đã chọn thì thành chip gỡ được.
 *
 * **Toàn bộ thao tác là bấm chọn, không còn ô nhập nào.** Trước 2026-09-14 đây là một
 * ô gõ tìm theo tên (`AreaSearchBox` + `/areas/suggest`); nó vẫn phục vụ khách đi tìm
 * massage ở trang chủ và `/tim-kiem`, nhưng ở đây thì không: KTV khai một lần lúc lập
 * hồ sơ, thường là vài quận trong cùng một tỉnh, và gõ đúng chính tả có dấu từng cái
 * là một cái giá không đổi lại được gì.
 *
 * Quyết định cũ ("để họ gõ tên ra, không bắt dò trong 63 tỉnh") **đã bị đảo có ý thức**,
 * nhưng ràng buộc sinh ra nó thì vẫn còn nguyên và cách làm mới phải tôn trọng: lý do
 * lưới 696 nút bị gỡ là **trang dài hàng chục màn hình, nút Lưu bật khỏi tầm mắt**.
 * Nay 63 tỉnh nằm gọn trong một `<select>` và quận chỉ hiện sau khi chọn tỉnh — nhiều
 * nhất ~30 dòng, trong một khối cuộn — nên trang lúc chưa chọn gì chỉ dài thêm một dòng.
 *
 * Bốn điều đi kèm:
 *
 * - **Chỉ nhận cấp DISTRICT.** Backend từ chối mọi cấp khác (`AssertAreasExistAsync`).
 *   Nay điều đó được bảo đảm bằng chính hình dạng giao diện — danh sách tick chỉ chứa
 *   quận/huyện — thay vì bằng một câu lọc trên thứ người dùng gõ ra.
 * - **Nhãn chỉ đến cho những khu vực đã chọn**, không phải cả cây hành chính. Trang
 *   trước đây serialize toàn bộ 759 khu vực xuống client (~140KB trong payload RSC)
 *   để tra tên cho vài cái chip. Cùng lý do, `/api/areas/provinces` cắt `children`
 *   trước khi trả về: chở cả cây qua một URL khác thì vẫn là chở cả cây.
 * - **Nhãn của khu vực vừa thêm lấy từ chính dòng đã tick.** Không có đường này thì
 *   chip mới hiện "Khu vực không rõ" cho tới khi tải lại trang.
 * - **Trần 30 khu vực do form đặt, không phải backend.** Chạm trần thì các ô chưa tick
 *   bị khoá kèm lời giải thích, thay vì im lặng bỏ qua cú chọn — im lặng đọc như ô tick
 *   bị hỏng.
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

  /**
   * Các tỉnh mà khu vực đã chọn đang trải ra — dùng để chặn tỉnh thứ ba.
   *
   * Suy từ `parentPath` của bảng nhãn chứ không hỏi lại backend: mọi khu vực đã chọn
   * đều có nhãn (đến từ `initialLabels` khi mở form, hoặc từ chính dòng vừa tick), và
   * `parentPath` của cấp quận luôn là đúng một tên tỉnh.
   *
   * Dùng **tên tỉnh** làm khoá vì đó là thứ duy nhất bảng nhãn mang theo. Đủ tin cậy
   * ở đây: hai tỉnh trùng tên thì không tồn tại — cái trùng nhau là tên **quận** giữa
   * các tỉnh, đúng thứ `parentPath` sinh ra để phân biệt. Backend vẫn chốt lại bằng
   * `parent_id` thật, nên nhãn hỏng cũng không lọt qua được.
   */
  const usedProvinces = new Set(
    selected
      .map((id) => labels.get(id)?.parentPath)
      .filter((p): p is string => Boolean(p)),
  );

  /**
   * Thêm nhiều khu vực một lượt (đường "chọn theo tỉnh").
   *
   * Cắt theo `max` tại đây chứ không tin phía gọi: ô tick đã chặn theo số còn lại,
   * nhưng trần là bất biến của chính component này — để nó phụ thuộc vào việc nơi
   * gọi tính đúng là đặt một quy tắc ở chỗ không ai nhìn thấy khi sửa.
   *
   * Lọc trùng vì cùng một quận có thể vừa nằm trong danh sách vừa được tick ở một
   * tỉnh mở lại: `selected` là mảng nên một id lặp sẽ thành hai chip giống hệt nhau,
   * và gỡ một cái vẫn còn cái kia.
   */
  function addMany(areas: CoverageAreaLabel[]) {
    const fresh = areas.filter((a) => !selected.includes(a.id)).slice(0, max - selected.length);
    if (fresh.length === 0) return;

    setLabels((prev) => {
      const next = new Map(prev);
      for (const a of fresh) next.set(a.id, a);
      return next;
    });
    onChange([...selected, ...fresh.map((a) => a.id)]);
  }

  function remove(id: string) {
    // Nhãn cố ý giữ lại: KTV gỡ nhầm rồi thêm lại ngay là chuyện thường, và bảng nhãn
    // này nhiều nhất cũng chỉ vài chục dòng.
    onChange(selected.filter((x) => x !== id));
  }

  return (
    <div>
      {full && (
        <p className="mb-3 rounded-md bg-ink-100 px-3 py-2.5 text-sm text-ink-600">
          Đã đủ {max} khu vực. Gỡ bớt một khu vực bên dưới nếu muốn đổi.
        </p>
      )}

      {/* Luôn hiện, kể cả khi đã chạm trần: lúc đó khối tự khoá các ô tick và nói rõ
          lý do, còn ẩn hẳn đi thì lối thêm khu vực biến mất khỏi trang mà không có gì
          giải thích — và nay nó là lối **duy nhất**. */}
      <ProvinceDistrictPicker
        selected={selected}
        onAdd={addMany}
        remaining={max - selected.length}
        usedProvinces={usedProvinces}
        maxProvinces={MAX_COVERAGE_PROVINCES}
      />

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
