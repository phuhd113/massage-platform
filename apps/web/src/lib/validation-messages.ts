// Cố ý KHÔNG có `'use client'`: đây chỉ là tra chuỗi, không hook và không chạm DOM.
// Server component (`tai-khoan/page.tsx`) gọi nó để truyền chuỗi đã dịch xuống
// `ChangePasswordForm`, còn client component thì gọi trực tiếp. Đánh dấu client sẽ
// chặn đường thứ nhất và kéo cả dictionary vào bundle mà không được gì.
import { INTL_LOCALE, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { type ValidationMessages } from '@/lib/use-form-validation';

/**
 * Dựng bộ chuỗi validate cho `useFormValidation`.
 *
 * Hai hàm chứ không một, vì site có hai loại trang:
 *
 * - Trang khách (`(public)`, `(auth)`) có cả tiếng Việt lẫn tiếng Anh → `messagesFor(locale)`.
 * - Dashboard KTV và trang admin **cố ý chỉ có tiếng Việt** (xem `project-status.md`:
 *   cả hai nhóm người dùng đều là người Việt, dịch ~420 chuỗi ở đó là công lớn mà gần
 *   như không ai đọc) → `viMessages()`, không cần locale.
 *
 * Cả hai cùng đọc một nguồn `i18n/*.ts`, nên sửa câu chữ một lần là đổi khắp nơi.
 */

function pick(t: ReturnType<typeof createTranslator>, locale: Locale): ValidationMessages {
  return {
    numberLocale: INTL_LOCALE[locale],
    required: t('validation.required'),
    tooShort: t('validation.tooShort'),
    tooLong: t('validation.tooLong'),
    rangeUnderflow: t('validation.rangeUnderflow'),
    rangeOverflow: t('validation.rangeOverflow'),
    stepMismatch: t('validation.stepMismatch'),
    patternMismatch: t('validation.patternMismatch'),
    typeMismatch: t('validation.typeMismatch'),
    invalid: t('validation.invalid'),
  };
}

/**
 * Chuỗi validate theo ngôn ngữ trang — dùng cho mọi form của khách.
 *
 * Lấy `{min}`/`{current}` nguyên dạng, chưa nội suy: hook mới biết con số thật lúc
 * trình duyệt báo lỗi.
 */
export function messagesFor(locale: Locale): ValidationMessages {
  return pick(createTranslator(getDictionary(locale), locale), locale);
}

/** Bản tiếng Việt cố định — cho dashboard KTV và trang admin. */
export function viMessages(): ValidationMessages {
  return pick(createTranslator(getDictionary('vi'), 'vi'), 'vi');
}
