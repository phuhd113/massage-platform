'use client';

import { useCallback, useRef } from 'react';

/**
 * Thay thông báo validate của trình duyệt bằng chuỗi của ta.
 *
 * Vì sao cần: bong bóng như "Please lengthen this text to 8 characters or more"
 * do **trình duyệt** sinh ra, theo ngôn ngữ **trình duyệt** — không theo `lang` của
 * trang và không có cách nào cấu hình. Một khách Việt dùng Chrome tiếng Anh sẽ đọc
 * tiếng Anh giữa một trang tiếng Việt, và `PasswordAuthForm` là ví dụ rõ nhất: ngay
 * dưới ô mật khẩu đã có dòng "Ít nhất 8 ký tự" đã dịch, nhưng `minLength` chặn trước
 * nên chuỗi đã dịch ấy không bao giờ được hiện.
 *
 * **Dịch theo `ValidityState`, không đọc `validationMessage`.** Chuỗi của trình duyệt
 * đổi theo trình duyệt lẫn phiên bản; bắt nó bằng regex là dựng một bảng tra phải
 * theo kịp Chrome, Firefox và Safari mãi mãi. `ValidityState` là API chuẩn, ổn định,
 * và nói đúng *loại* lỗi.
 *
 * **Không dùng `noValidate`.** Bỏ hẳn validation trình duyệt là mất luôn những thứ
 * nó làm tốt: chặn submit, tự cuộn tới và focus vào ô sai đầu tiên, và hoạt động
 * ngay cả khi JS của trang hỏng ở chỗ khác. Ta chỉ đổi *câu chữ*, giữ nguyên cơ chế.
 *
 * Cách dùng — gắn ref vào thẻ `<form>`, không phải từng input:
 *
 * ```tsx
 * const formRef = useFormValidation(messages);
 * return <form ref={formRef} onSubmit={submit}>…</form>;
 * ```
 */

/** Chuỗi cho từng loại lỗi. Thiếu key nào thì loại đó rơi về câu chung. */
export interface ValidationMessages {
  /** Bỏ trống ô bắt buộc. */
  required: string;
  /** Ngắn hơn `minLength` — nhận `{min}` và `{current}`. */
  tooShort: string;
  /** Dài hơn `maxLength` — nhận `{max}`. */
  tooLong: string;
  /** Nhỏ hơn `min` — nhận `{min}`. */
  rangeUnderflow: string;
  /** Lớn hơn `max` — nhận `{max}`. */
  rangeOverflow: string;
  /** Không khớp `step`. */
  stepMismatch: string;
  /** Không khớp `pattern`. */
  patternMismatch: string;
  /** Sai định dạng của `type` (email, url, number…). */
  typeMismatch: string;
  /** Câu chung, dùng khi không rơi vào nhánh nào ở trên. */
  invalid: string;
  /** Locale định dạng số trong `{min}`/`{max}` — ví dụ `'vi-VN'`. */
  numberLocale: string;
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/**
 * Ngưỡng số đọc được bằng mắt: `50000000` → `50.000.000` (vi) hoặc `50,000,000` (en).
 *
 * Ô nạp tiền khai `min=10000 max=50000000`, và một câu "giá trị không được vượt quá
 * 50000000" bắt người đọc tự đếm chữ số để biết là năm mươi triệu hay năm trăm triệu
 * — ngay trong màn hình họ đang định chuyển tiền. Không thêm "₫": thuộc tính `min`
 * không nói nó là tiền, nên gắn đơn vị vào đây sẽ sai ở ô "số năm kinh nghiệm".
 *
 * Dấu phân cách theo `numberLocale` của bộ chuỗi, không ghim `vi-VN`: cùng câu ấy
 * hiện trên trang tiếng Anh, nơi `50.000.000` đọc thành "năm mươi phẩy không".
 */
function readable(raw: string, numberLocale: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? n.toLocaleString(numberLocale) : raw;
}

/** Chọn câu theo *loại* lỗi mà trình duyệt báo. */
function messageFor(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, m: ValidationMessages): string {
  const v = el.validity;

  // Thứ tự có ý nghĩa: một ô để trống vừa `valueMissing` vừa có thể `tooShort`,
  // và "vui lòng nhập" hữu ích hơn "cần ít nhất 8 ký tự, bạn đang có 0".
  if (v.valueMissing) return m.required;

  if (v.tooShort && 'minLength' in el) {
    return fill(m.tooShort, { min: el.minLength, current: el.value.length });
  }
  if (v.tooLong && 'maxLength' in el) {
    return fill(m.tooLong, { max: el.maxLength });
  }
  if (v.rangeUnderflow && 'min' in el) return fill(m.rangeUnderflow, { min: readable(el.min, m.numberLocale) });
  if (v.rangeOverflow && 'max' in el) return fill(m.rangeOverflow, { max: readable(el.max, m.numberLocale) });
  if (v.stepMismatch) return m.stepMismatch;
  if (v.patternMismatch) return m.patternMismatch;
  if (v.typeMismatch) return m.typeMismatch;

  return m.invalid;
}

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isField(el: EventTarget | null): el is Field {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

/**
 * Trả về ref để gắn vào `<form>`.
 *
 * Nghe sự kiện ở tầng form thay vì đặt `onInvalid` lên từng input: `invalid` nổi bọt
 * lên (bubble) nên một chỗ nghe là đủ cho mọi ô, kể cả ô được thêm vào sau — form
 * nào cũng chỉ cần một dòng, và ô mới không thể quên mất phần dịch.
 */
export function useFormValidation(messages: ValidationMessages) {
  // Giữ trong ref để thay đổi ngôn ngữ không phải gỡ và gắn lại listener.
  const latest = useRef(messages);
  latest.current = messages;

  const cleanup = useRef<(() => void) | null>(null);

  return useCallback((form: HTMLFormElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!form) return;

    // `invalid` không bubble theo mặc định của DOM, nhưng **có** capture — nên bắt ở
    // pha capture là nghe được mọi ô con mà không cần gắn lên từng thẻ.
    const onInvalid = (e: Event) => {
      if (!isField(e.target)) return;
      e.target.setCustomValidity(messageFor(e.target, latest.current));
    };

    // Xoá câu lỗi cũ trước mỗi lượt kiểm, nếu không `setCustomValidity` để lại chuỗi
    // khác rỗng và ô đó bị coi là **vĩnh viễn không hợp lệ** — sửa đúng rồi vẫn không
    // submit được. Đây là cái bẫy kinh điển của API này.
    const clear = (e: Event) => {
      if (!isField(e.target)) return;
      e.target.setCustomValidity('');
    };

    form.addEventListener('invalid', onInvalid, true);
    form.addEventListener('input', clear, true);
    form.addEventListener('change', clear, true);

    cleanup.current = () => {
      form.removeEventListener('invalid', onInvalid, true);
      form.removeEventListener('input', clear, true);
      form.removeEventListener('change', clear, true);
    };
  }, []);
}
