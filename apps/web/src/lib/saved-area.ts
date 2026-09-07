/**
 * Nhớ khu vực khách đã dò được, để lần sau mở site là thấy ngay tên quận của mình.
 *
 * **Cố ý KHÔNG lưu toạ độ.** Chỉ lưu tên và slug — đủ để hiện nhãn và dựng URL tìm
 * theo khu vực. Toạ độ là vị trí nhà của khách: nó nằm mãi trên máy cho tới khi có
 * người xoá, kể cả máy dùng chung, và đổi lại được đúng một thứ là bỏ qua một lần
 * bấm. Khi khách bấm dò thì GPS cho toạ độ thật ngay lúc đó, chính xác hơn hẳn một
 * bản sao cũ.
 *
 * Đây là chỗ **duy nhất** trong codebase dùng localStorage. Mọi trạng thái khác đi
 * qua URL (bộ lọc tìm kiếm) hoặc cookie httpOnly (phiên đăng nhập) — xem
 * `lib/session.ts`. Cái ở đây không phải trạng thái, chỉ là một tiện ích cho mắt:
 * mất nó thì header quay về "Chọn vị trí", không hỏng gì.
 */

const KEY = 'masgo_area';

export interface SavedArea {
  /** Tên hiển thị, ví dụ "Quận 7". */
  name: string;
  /** Slug để dựng URL — quận khi có `provinceSlug`, tỉnh khi không. */
  areaSlug: string;
  /**
   * Bắt buộc đi kèm khi `areaSlug` là slug quận: đứng một mình nó là slug **tỉnh**,
   * và mười "Huyện Châu Thành" trở thành một kết quả tuỳ ý. Xem `lib/area-search.ts`.
   */
  provinceSlug: string | null;
}

/**
 * Đọc khu vực đã lưu. Trả `null` khi chưa có, khi trình duyệt chặn storage, hoặc
 * khi dữ liệu không đúng hình dạng.
 *
 * Kiểm từng trường thay vì tin vào `JSON.parse`: nội dung này người dùng sửa được
 * bằng devtools, và một `areaSlug` là số sẽ đi thẳng vào URL tìm kiếm.
 */
export function loadSavedArea(): SavedArea | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SavedArea>;
    if (typeof parsed?.name !== 'string' || typeof parsed?.areaSlug !== 'string') return null;
    if (!parsed.name || !parsed.areaSlug) return null;

    return {
      name: parsed.name,
      areaSlug: parsed.areaSlug,
      provinceSlug: typeof parsed.provinceSlug === 'string' ? parsed.provinceSlug : null,
    };
  } catch {
    // Chế độ riêng tư, storage bị chặn, JSON hỏng — mọi nhánh đều là "chưa lưu gì".
    return null;
  }
}

/** Ghi đè khu vực đã lưu. Nuốt lỗi: không lưu được thì chỉ mất một tiện ích. */
export function saveArea(area: SavedArea): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(area));
  } catch {
    // Hết quota hoặc storage bị chặn. Không có gì để làm và không có gì để báo.
  }
}

/** Quên khu vực đã lưu. */
export function clearSavedArea(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // như trên
  }
}
