'use client';

import { useEffect, useRef, useState } from 'react';
import { type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5080/api/v1';

/**
 * Danh sách phải khớp `ProfileReportReasons` ở backend — validator từ chối giá trị
 * lạ, nên lệch một chuỗi ở đây là nút báo cáo trả 400 cho đúng lý do đó mà thôi.
 *
 * Thứ tự cố ý: loại nghiêm trọng nhất đứng đầu. Đây là danh sách người đang bực
 * bội đọc lướt, và loại cần xử lý trước tất cả là loại phải nằm ở nơi mắt chạm
 * vào trước tiên.
 */
const REASONS = [
  { value: 'PROSTITUTION', key: 'report.reasonProstitution' },
  { value: 'INAPPROPRIATE_CONTENT', key: 'report.reasonInappropriate' },
  { value: 'FALSE_INFORMATION', key: 'report.reasonFalseInfo' },
  { value: 'IMPERSONATION', key: 'report.reasonImpersonation' },
  { value: 'MISCONDUCT', key: 'report.reasonMisconduct' },
  { value: 'OTHER', key: 'report.reasonOther' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

/**
 * Nút báo cáo hồ sơ vi phạm.
 *
 * **Vì sao trang hồ sơ cần nó ngay từ bây giờ**: mô hình "massage tận nơi" bị lợi
 * dụng làm vỏ bọc cho dịch vụ trá hình khá thường xuyên, và rủi ro đó chạm đúng hai
 * trụ cột của dự án — pháp lý, và kênh acquisition chính. Google hạ hạng mạnh tên
 * miền bị phân loại là nội dung người lớn, mà với sản phẩm sống bằng traffic organic
 * thì đó không phải sự cố sửa được bằng bản vá. Không có đường để khách báo cáo thì
 * nền tảng chỉ biết chuyện đó khi đã quá muộn.
 *
 * Đặt cuối trang chứ không cạnh nút gọi, và là nút chữ nhỏ chứ không phải nút màu:
 * đây là lối thoát hiểm cho thiểu số, còn hành động chính của trang vẫn là liên hệ.
 *
 * Gọi thẳng backend như `ContactButtons` — backend cần đúng IP khách để gộp báo cáo
 * trùng; qua proxy Next thì mọi người báo cáo chung một IP và cửa sổ gộp 24 giờ sẽ
 * nuốt mất báo cáo của tất cả những người sau người đầu tiên.
 */
export function ReportProfileButton({ ktvId, locale }: { ktvId: string; locale: Locale }) {
  const t = createTranslator(getDictionary(locale), locale);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>('PROSTITUTION');
  const [detail, setDetail] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  // Esc để đóng, và trả tiêu điểm về đúng nút vừa mở — người dùng bàn phím bị bỏ
  // lại ở đầu trang sau khi đóng một hộp thoại thì phải Tab lại từ đầu.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();

    // Chụp lại nút mở ngay lúc này thay vì đọc `openerRef.current` trong cleanup:
    // tới lúc cleanup chạy, ref có thể đã trỏ sang node khác hoặc null.
    const opener = openerRef.current;

    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open]);

  async function submit() {
    // Backend bắt buộc mô tả khi chọn "Lý do khác" — chặn ở đây luôn để khách không
    // phải chờ một vòng mạng mới biết còn thiếu gì.
    if (reason === 'OTHER' && detail.trim().length === 0) {
      setError(t('report.errorNeedDetail'));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const res = await fetch(`${API}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ktvId,
          reason,
          detail: detail.trim() === '' ? null : detail.trim(),
        }),
      });

      if (res.status === 429) {
        setError(t('report.errorRateLimited'));
        return;
      }
      if (!res.ok) {
        setError(t('report.errorGeneric'));
        return;
      }

      // Cả báo cáo mới lẫn báo cáo bị gộp đều hiện cùng một lời cảm ơn. Nói với
      // khách rằng "bạn đã báo cáo hồ sơ này rồi" không giúp họ làm gì thêm, mà lại
      // tiết lộ đúng thứ một người muốn dò cửa sổ gộp cần biết.
      setDone(true);
      setOpen(false);
    } catch {
      setError(t('report.errorNetwork'));
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="mt-6 text-body-s text-ink-500">
        {t('report.thanks')}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <button
        ref={openerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="text-body-s text-ink-500 underline underline-offset-4 transition hover:text-ink-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {t('report.trigger')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-card focus:outline-none"
          >
            <h2 id="report-title" className="text-h3 text-ink-900">
              {t('report.dialogTitle')}
            </h2>
            <p className="mt-1.5 text-body-s text-ink-500">
              {t('report.dialogIntro')}
            </p>

            <fieldset className="mt-4">
              <legend className="text-body-s font-medium text-ink-700">{t('report.reasonLegend')}</legend>
              <div className="mt-2 space-y-1.5">
                {REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-2.5 text-body text-ink-700">
                    <input
                      type="radio"
                      name="report-reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="h-4 w-4 accent-brand-500"
                    />
                    {t(r.key)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-4 block">
              <span className="text-body-s font-medium text-ink-700">
                {t('report.detailLabel')} {reason === 'OTHER' ? '' : t('report.detailOptional')}
              </span>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t('report.detailPlaceholder')}
                className="mt-1.5 w-full rounded-md border border-ink-200 px-3 py-2 text-body text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
              />
            </label>

            {error && (
              <p role="alert" className="mt-3 text-body-s text-danger-fg">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-4 py-2 text-body font-medium text-ink-600 transition hover:bg-ink-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="rounded-full bg-brand-500 px-4 py-2 text-body font-semibold text-white shadow-button transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
              >
                {pending ? t('report.submitting') : t('report.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
