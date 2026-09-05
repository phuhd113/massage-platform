'use client';

import { useState } from 'react';
import { CheckIcon as DoneIcon } from '@/components/icons';
import { type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { formatVnd } from '@/lib/site';
import type { KtvServiceItem } from '@/lib/types';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5080/api/v1';

type Channel = 'CALL' | 'ZALO';

/**
 * Nút liên hệ — phần tương tác duy nhất của trang hồ sơ, nên là client component
 * nhỏ tách riêng thay vì biến cả trang thành client. Phần nội dung Google cần
 * (tên, giới thiệu, dịch vụ, đánh giá) vẫn nằm trong HTML đầu tiên.
 *
 * Số điện thoại chỉ có sau khi lượt liên hệ được ghi nhận: gọi thẳng từ trình
 * duyệt để backend thấy đúng IP khách, thay vì proxy qua Next và làm mọi lượt
 * bấm trông như đến từ cùng một máy chủ.
 */
export function ContactButtons({
  ktvId,
  ktvName,
  cheapestService = null,
  locale,
}: {
  ktvId: string;
  ktvName: string;
  /** Dịch vụ rẻ nhất, dùng làm mức "giá từ". Null khi KTV chưa khai bảng giá. */
  cheapestService?: { priceFrom: number; durationMin: number } | null;
  locale: Locale;
}) {
  const t = createTranslator(getDictionary(locale), locale);
  const [phone, setPhone] = useState<string | null>(null);
  const [pending, setPending] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function contact(channel: Channel) {
    setPending(channel);
    setError(null);

    try {
      const payload = JSON.stringify({
        ktvId,
        channel,
        sourceUrl: window.location.pathname,
      });

      // Thử đường có xác thực trước: nó gắn được `customer_user_id` vào lead, thứ
      // sau này dùng để phân biệt đánh giá của người từng liên hệ thật với đánh giá
      // của tài khoản vừa lập. Trả 401 nghĩa là khách chưa đăng nhập.
      let res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      // Khách ẩn danh — phần lớn khách — gọi thẳng backend, vì chỉ đường đó mới
      // mang đúng IP của họ và cơ chế gộp lead trùng 5 phút mới còn ý nghĩa.
      if (res.status === 401) {
        res = await fetch(`${API}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
      }

      if (res.status === 429) {
        setError(t('contact.errorRateLimited'));
        return;
      }
      if (!res.ok) {
        setError(t('contact.errorNoPhone'));
        return;
      }

      const data = (await res.json()) as { phone: string };
      setPhone(data.phone);

      window.location.href =
        channel === 'CALL' ? `tel:${data.phone}` : `https://zalo.me/${data.phone}`;
    } catch {
      setError(t('contact.errorNetwork'));
    } finally {
      setPending(null);
    }
  }

  // Chỉ tên riêng (từ cuối), không phải cả họ tên: "Gọi Trần Thị Hường" tràn hai
  // dòng trong khối liên hệ hẹp ở cột phải, và nút cao gấp đôi các nút khác.
  // Người Việt cũng gọi nhau bằng tên chứ không bằng họ.
  const firstName = ktvName.trim().split(/\s+/).at(-1) ?? ktvName;
  const callLabel = t('contact.callName', { name: firstName });

  return (
    <>
      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
        {/* Giá đứng đầu khối: đây là câu hỏi khách hỏi trước khi hỏi "gọi thế nào". */}
        {cheapestService && (
          <div className="mb-4 border-b border-ink-100 pb-4">
            <div className="text-caption text-ink-500">{t('contact.priceFrom')}</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="tabular text-h2 text-ink-900">
                {formatVnd(cheapestService.priceFrom, locale)}
              </span>
              <span className="text-body-s text-ink-500">
                / <span className="tabular">{cheapestService.durationMin}</span>{' '}
                {t('contact.minutes')}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => contact('CALL')}
            disabled={pending !== null}
            className="flex-1 rounded-full bg-brand-500 px-5 py-2.5 font-semibold text-white shadow-button transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            <PendingLabel
              pending={pending === 'CALL'}
              label={callLabel}
              fetchingLabel={t('contact.fetching')}
            />
          </button>

          <button
            type="button"
            onClick={() => contact('ZALO')}
            disabled={pending !== null}
            className="flex-1 rounded-full border border-brand-500 px-5 py-2.5 font-semibold text-brand-600 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            <PendingLabel
              pending={pending === 'ZALO'}
              label={t('contact.zalo')}
              fetchingLabel={t('contact.fetching')}
            />
          </button>
        </div>

        {/* Bằng chứng đứng cạnh nút, không ở cuối trang: nỗi lo lên cao nhất
            đúng lúc ngón tay chạm "Gọi ngay". */}
        <ul className="mt-3.5 space-y-1.5">
          {[t('contact.trust1'), t('contact.trust2'), t('contact.trust3')].map((line) => (
            <li key={line} className="flex gap-2 text-body-s text-ink-600">
              <CheckIcon />
              {line}
            </li>
          ))}
        </ul>

        {phone && (
          <p className="mt-3 text-body-s text-ink-700">
            {t('contact.phoneLabel')}{' '}
            <a href={`tel:${phone}`} className="tabular font-semibold text-brand-600">
              {phone}
            </a>
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-body-s text-danger-fg">
            {error}
          </p>
        )}
      </div>

      {/* Thanh dính đáy cho mobile. Hiện ngay khi tải xong chứ không chờ cuộn:
          khách vào từ Google thường quyết định trong màn hình đầu tiên.
          padding-bottom cộng safe-area — thiếu nó, nút nằm dưới thanh gạt home
          của iPhone và khách chạm trúng viền màn hình thay vì nút. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white px-4 pt-3 shadow-sticky [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        {/* Giá đứng ngay trên nút gọi: ở mobile khối "Giá từ" của cột phải đã cuộn
            mất từ lâu, nên nếu không nhắc lại ở đây thì khách bấm gọi mà không biết
            mình sắp hỏi giá bao nhiêu. "Trả sau" trả lời nốt câu hỏi đi kèm. */}
        {cheapestService && (
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <span className="text-body text-ink-600">
              {t('contact.priceFrom')}{' '}
              <strong className="tabular font-mono font-medium text-ink-900">
                {formatVnd(cheapestService.priceFrom, locale)}
              </strong>
            </span>
            <span className="text-caption text-ink-500">{t('contact.payLater')}</span>
          </div>
        )}

        <div className="flex gap-2">
        <button
          type="button"
          onClick={() => contact('CALL')}
          disabled={pending !== null}
          className="flex-[3] rounded-md bg-brand-500 px-4 py-3 font-medium text-white transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          <PendingLabel
            pending={pending === 'CALL'}
            label={t('contact.callNow')}
            fetchingLabel={t('contact.fetching')}
          />
        </button>

        <button
          type="button"
          onClick={() => contact('ZALO')}
          disabled={pending !== null}
          className="flex-[2] rounded-md border border-brand-500 px-4 py-3 font-medium text-brand-600 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          <PendingLabel
            pending={pending === 'ZALO'}
            label={t('contact.zaloShort')}
            fetchingLabel={t('contact.fetching')}
          />
        </button>
        </div>
      </div>
    </>
  );
}

/**
 * Giữ nguyên bề rộng nút khi đang chờ mạng.
 *
 * Nhãn vẫn nằm trong DOM nhưng ẩn đi, spinner chồng lên trên — nếu thay chuỗi
 * ("Gọi ngay" → "Đang lấy số…") thì nút co giãn ngay dưới ngón tay đang chạm,
 * và trên mobile việc đó đủ để trượt mất lượt bấm. Lượt bấm ở đây chính là đơn
 * vị đo doanh thu.
 */
function PendingLabel({
  pending,
  label,
  fetchingLabel,
}: {
  pending: boolean;
  label: string;
  /** Nhãn cho trình đọc màn hình khi đang chờ — hàm con không tự tra dictionary. */
  fetchingLabel: string;
}) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={pending ? 'invisible' : undefined}>{label}</span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <svg
            aria-hidden
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
          <span className="sr-only">{fetchingLabel}</span>
        </span>
      )}
    </span>
  );
}

/** Dấu tích cho các dòng cam kết cạnh nút liên hệ. */
function CheckIcon() {
  return <DoneIcon size={16} className="mt-1 h-3.5 w-3.5 shrink-0 text-success-fg" />;
}
