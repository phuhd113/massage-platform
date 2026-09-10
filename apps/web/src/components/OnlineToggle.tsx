'use client';

import { useOnlineToggle } from '@/lib/use-online-toggle';

/**
 * Hai hình dạng của cùng một công tắc "đang nhận khách", dùng chung
 * `useOnlineToggle` — xem hook đó để biết vì sao nó không cập nhật lạc quan và vì sao
 * nó đi qua `/api/ktv-profile` chứ không phải `/api/proxy`.
 *
 * `OnlineChip` cho thẻ hồ sơ ở `/dashboard`: giữ nguyên hình dạng cái nhãn vốn đã nằm
 * đó, chỉ khác là bấm được. `OnlineToggle` cho `/dashboard/dich-vu`: có chỗ để giải
 * thích hậu quả của từng trạng thái.
 */

/** Chip trạng thái bấm được, cho thẻ hồ sơ ở trang tổng quan. */
export function OnlineChip({ isOnline }: { isOnline: boolean }) {
  const { on, pending, error, toggle } = useOnlineToggle(isOnline);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={toggle}
        disabled={pending}
        title={on ? 'Bấm để tắt nhận khách' : 'Bấm để bật nhận khách'}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold transition disabled:opacity-60 ${
          on
            ? 'bg-success-bg text-success-fg hover:brightness-95'
            : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
        }`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-success-fg' : 'bg-ink-400'}`}
        />
        {pending ? 'Đang lưu…' : on ? 'Đang nhận khách' : 'Đang tắt nhận khách'}
      </button>

      {error && (
        <span role="alert" className="text-caption text-danger-fg">
          {error}
        </span>
      )}
    </span>
  );
}

/** Công tắc đầy đủ, cho trang Dịch vụ và giá. */
export function OnlineToggle({
  isOnline,
  className = '',
}: {
  isOnline: boolean;
  className?: string;
}) {
  const { on, pending, error, toggle } = useOnlineToggle(isOnline);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* `role="switch"` + `aria-checked` chứ không phải một <button> trần: trình đọc
            màn hình phải đọc được đây là công tắc đang bật hay tắt, không chỉ đọc nhãn. */}
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={pending}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
            on ? 'bg-success-fg' : 'bg-ink-300'
          }`}
        >
          <span className="sr-only">{on ? 'Tắt nhận khách' : 'Bật nhận khách'}</span>
          <span
            aria-hidden
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              on ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>

        <span className="text-body font-medium text-ink-900">
          {pending ? 'Đang lưu…' : on ? 'Đang nhận khách' : 'Đang tắt nhận khách'}
        </span>
      </div>

      <p className="mt-2 max-w-xl text-body-s text-ink-600">
        {on
          ? 'Hồ sơ của bạn đang hiện trong kết quả tìm kiếm và khách có thể gọi bất cứ lúc nào.'
          : 'Khách vẫn xem được hồ sơ của bạn, nhưng bộ lọc “đang nhận khách” sẽ bỏ qua bạn. Bật lại khi bạn rảnh.'}
      </p>

      {/* Nói rõ công tắc này không đụng tới việc duyệt hồ sơ: KTV đã học được rằng sửa
          hồ sơ là phải chờ duyệt lại, nên không có dòng này họ sẽ ngại bấm. */}
      <p className="mt-1 text-caption text-ink-500">
        Bật/tắt bao nhiêu lần cũng được — thao tác này không làm hồ sơ phải duyệt lại.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-body-s text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
