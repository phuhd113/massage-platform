'use client';

import { useEffect, useRef, useState } from 'react';
import { FilterIcon, StarIcon } from '@/components/icons';
import type { Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/t';
import type { Gender } from '@/lib/types';

/**
 * Bộ lọc nâng cao của trang tìm kiếm, dạng hộp thoại.
 *
 * Vì sao là hộp thoại chứ không phải thêm ô vào hàng lọc: hàng đó đã kín ở 390px
 * (xem ghi chú bố cục mobile trong `SearchFilters`), và bốn ô nữa sẽ đẩy kết quả —
 * thứ khách vào để xem — xuống dưới màn hình đầu tiên. Đổi lại là một cái giá thật:
 * bộ lọc nằm trong popup là bộ lọc khách không nhìn thấy, nên nút mở **phải** mang
 * số bộ lọc đang bật, và popup **phải** mở sẵn với đúng những gì đang áp dụng.
 */
export interface SearchFilterValues {
  gender: Gender | '';
  /** `''` = không lọc. Chuỗi chứ không number: nó đi thẳng vào query string. */
  minYears: string;
  minRating: string;
  onlineOnly: boolean;
}

/** Số bộ lọc đang bật — dùng cho nhãn nút, nên phải đếm đúng thứ khách coi là "một bộ lọc". */
export function countActiveFilters(v: SearchFilterValues): number {
  return (v.gender ? 1 : 0) + (v.minYears ? 1 : 0) + (v.minRating ? 1 : 0) + (v.onlineOnly ? 1 : 0);
}

const EXPERIENCE_STEPS = [1, 3, 5, 10] as const;
const RATING_STEPS = [3, 4, 4.5] as const;

export function SearchFilterDialog({
  value,
  onApply,
  t,
  locale,
  disabled = false,
}: {
  value: SearchFilterValues;
  /**
   * Gọi một lần khi khách bấm "Xem kết quả", với toàn bộ giá trị.
   *
   * Cố ý **không** áp dụng ngay mỗi lần bấm một ô: mỗi lượt áp dụng là một lần điều
   * hướng và một lượt gọi API, nên chọn bốn tiêu chí sẽ là bốn lần danh sách nhảy
   * dưới tay khách trong khi họ còn chưa chọn xong.
   */
  onApply: (next: SearchFilterValues) => void;
  t: Translator;
  locale: Locale;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  /**
   * Bản nháp, tách khỏi `value` đang áp dụng.
   *
   * Đóng popup mà không bấm "Xem kết quả" phải bỏ hết thay đổi — nếu nháp ghi thẳng
   * vào URL thì nút Đóng trở thành một nút áp dụng thứ hai, và bấm ra ngoài (thao tác
   * ai cũng hiểu là "thôi bỏ") sẽ lặng lẽ đổi kết quả.
   */
  const [draft, setDraft] = useState(value);

  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const activeCount = countActiveFilters(value);

  useEffect(() => {
    if (!open) return;

    // Nạp lại từ giá trị đang áp dụng mỗi lần mở: khách đóng bằng Escape ở lượt trước
    // thì bản nháp cũ vẫn còn trong state, và mở lại sẽ thấy những ô mình tưởng đã bỏ.
    setDraft(value);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    // Chụp lại nút mở ngay lúc này thay vì đọc `openerRef.current` trong cleanup:
    // React cảnh báo đúng ở đây về nguyên tắc, dù nút này không remount.
    const opener = openerRef.current;

    return () => {
      document.removeEventListener('keydown', onKey);
      // Trả lại giá trị cũ chứ không gán '': trang có thể đang bị khoá cuộn bởi thứ
      // khác, và ghi đè bằng chuỗi rỗng sẽ mở khoá thay cho nó.
      document.body.style.overflow = prev;
      // Trả focus về nút mở. Không có dòng này thì đóng popup bằng Escape đặt focus
      // trở lại <body>, và người dùng bàn phím phải Tab lại từ đầu trang.
      opener?.focus();
    };
    // `value` cố ý không nằm trong deps: thêm vào sẽ khiến mỗi lần áp dụng xong (URL
    // đổi → value đổi) chạy lại cả effect, tức khoá cuộn và focus bị đặt lại giữa
    // lúc popup đang đóng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function apply() {
    setOpen(false);
    onApply(draft);
  }

  function reset() {
    setDraft({ gender: '', minYears: '', minRating: '', onlineOnly: false });
  }

  // Số thập phân của ngưỡng sao phải theo locale: "4,5 sao" ở trang vi, "4.5" ở trang
  // en. Ghim 'vi-VN' ở đây là cùng lỗi với ô số liệu trang chủ từng mắc.
  const numberLocale = locale === 'vi' ? 'vi-VN' : 'en-US';

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-haspopup="dialog"
        className={`inline-flex shrink-0 items-center gap-1.5 self-end whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition disabled:opacity-60 ${
          activeCount > 0
            ? 'border-brand-500 bg-brand-50 text-brand-700'
            : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50'
        }`}
      >
        <FilterIcon size={16} className="h-4 w-4 shrink-0" />
        {activeCount > 0
          ? t('filters.moreFiltersActive', { count: activeCount })
          : t('filters.moreFilters')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 sm:items-center sm:p-5"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {/* Dính đáy ở mobile (bottom sheet), giữa màn hình ở desktop — cùng hình
              dạng với các hộp thoại khác của sàn. */}
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="search-filter-title"
            tabIndex={-1}
            className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-card focus:outline-none sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-ink-200 px-5 py-4">
              <h2 id="search-filter-title" className="text-h4 text-ink-900">
                {t('filters.filterDialogTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('filters.filterDialogClose')}
                className="-mr-1.5 -mt-1 shrink-0 rounded-full p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <fieldset>
                <legend className="text-body-s font-medium text-ink-700">
                  {t('filters.genderLabel')}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ChoiceChip
                    selected={draft.gender === ''}
                    onClick={() => setDraft({ ...draft, gender: '' })}
                  >
                    {t('filters.genderAny')}
                  </ChoiceChip>
                  <ChoiceChip
                    selected={draft.gender === 'FEMALE'}
                    onClick={() => setDraft({ ...draft, gender: 'FEMALE' })}
                  >
                    {t('filters.genderFemale')}
                  </ChoiceChip>
                  <ChoiceChip
                    selected={draft.gender === 'MALE'}
                    onClick={() => setDraft({ ...draft, gender: 'MALE' })}
                  >
                    {t('filters.genderMale')}
                  </ChoiceChip>
                </div>
                {/* Chỉ hiện khi bộ lọc đang bật: đây là lời giải thích cho một hệ quả,
                    và một cảnh báo hiện cả lúc không có gì xảy ra sẽ bị đọc lướt qua
                    đúng vào lúc nó có nghĩa. */}
                {draft.gender && (
                  <p className="mt-2 text-xs text-ink-500">{t('filters.genderNote')}</p>
                )}
              </fieldset>

              <fieldset className="mt-5">
                <legend className="text-body-s font-medium text-ink-700">
                  {t('filters.experienceLabel')}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ChoiceChip
                    selected={draft.minYears === ''}
                    onClick={() => setDraft({ ...draft, minYears: '' })}
                  >
                    {t('filters.experienceAny')}
                  </ChoiceChip>
                  {EXPERIENCE_STEPS.map((y) => (
                    <ChoiceChip
                      key={y}
                      selected={draft.minYears === String(y)}
                      onClick={() => setDraft({ ...draft, minYears: String(y) })}
                    >
                      {t('filters.experienceYears', { count: y })}
                    </ChoiceChip>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mt-5">
                <legend className="text-body-s font-medium text-ink-700">
                  {t('filters.ratingLabel')}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ChoiceChip
                    selected={draft.minRating === ''}
                    onClick={() => setDraft({ ...draft, minRating: '' })}
                  >
                    {t('filters.ratingAny')}
                  </ChoiceChip>
                  {RATING_STEPS.map((r) => (
                    <ChoiceChip
                      key={r}
                      selected={draft.minRating === String(r)}
                      onClick={() => setDraft({ ...draft, minRating: String(r) })}
                    >
                      <StarIcon size={14} className="h-3.5 w-3.5 shrink-0" />
                      {t('filters.ratingStars', { count: r.toLocaleString(numberLocale) })}
                    </ChoiceChip>
                  ))}
                </div>
                {draft.minRating && (
                  <p className="mt-2 text-xs text-ink-500">{t('filters.ratingNote')}</p>
                )}
              </fieldset>

              <fieldset className="mt-5">
                <legend className="text-body-s font-medium text-ink-700">
                  {t('filters.statusLabel')}
                </legend>
                <div className="mt-2">
                  <ChoiceChip
                    selected={draft.onlineOnly}
                    onClick={() => setDraft({ ...draft, onlineOnly: !draft.onlineOnly })}
                  >
                    <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    {t('filters.onlineOnly')}
                  </ChoiceChip>
                </div>
              </fieldset>
            </div>

            {/* Chân hộp thoại dính đáy: danh sách tiêu chí dài hơn màn hình điện thoại,
                nên nút áp dụng nằm trong luồng cuộn sẽ bắt cuộn xuống đáy mới bấm được. */}
            <div className="flex items-center justify-between gap-3 border-t border-ink-200 px-5 py-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-full px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100"
              >
                {t('filters.filterReset')}
              </button>
              <button
                type="button"
                onClick={apply}
                className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white shadow-button transition hover:bg-brand-600"
              >
                {t('filters.filterApply')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Chip chọn một-trong-nhiều. `aria-pressed` chứ không phải radio thật: các nhóm này
 * không submit ở đâu cả, và một `<input type=radio>` ẩn kèm nhãn tạo ra hai phần tử
 * phải giữ đồng bộ cho mỗi lựa chọn.
 */
function ChoiceChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
        selected
          ? 'border-brand-500 bg-brand-500 text-white'
          : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50'
      }`}
    >
      {children}
    </button>
  );
}
