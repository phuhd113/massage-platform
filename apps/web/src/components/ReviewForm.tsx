'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const MAX_COMMENT = 2000;

type Session = { authenticated: boolean; role: string | null };

/**
 * Ô viết đánh giá trên trang hồ sơ KTV.
 *
 * **Vì sao phải hỏi trạng thái đăng nhập ở client** thay vì render sẵn ở server:
 * trang hồ sơ dùng ISR 600 giây, tức một bản HTML phục vụ mọi người xem. Nướng
 * "đã đăng nhập hay chưa" vào đó là hoặc phát phiên của người này cho người khác,
 * hoặc phải bỏ cache trên chính những trang sống nhờ SEO. Vì vậy khối này bắt đầu
 * ở trạng thái chưa biết, và chỉ hiện ra sau khi hỏi `/api/auth/session`.
 *
 * Không có gì trong đây là dữ liệu nhạy cảm, nên việc nó xuất hiện muộn hơn phần
 * còn lại của trang không sao — và nó nằm dưới danh sách đánh giá, tức ngoài màn
 * hình đầu tiên của gần như mọi khách.
 */
export function ReviewForm({ ktvId, ktvName }: { ktvId: string; ktvName: string }) {
  const router = useRouter();
  const pathname = usePathname();

  const [session, setSession] = useState<Session | null>(null);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    fetch('/api/auth/session')
      .then((r) => r.json() as Promise<Session>)
      .then((s) => {
        if (alive) setSession(s);
      })
      // Hỏi hỏng thì coi như chưa đăng nhập: lời mời đăng nhập vẫn dẫn tới đúng
      // chỗ, còn hiện ô nhập cho người chưa đăng nhập sẽ để họ gõ xong mới báo lỗi.
      .catch(() => {
        if (alive) setSession({ authenticated: false, role: null });
      });

    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (rating === 0) {
      setError('Chọn số sao trước khi gửi.');
      return;
    }

    setPending(true);
    setError(null);

    try {
      // Qua server chứ không gọi thẳng backend: endpoint này cần đăng nhập, mà token
      // nằm trong cookie httpOnly nên JavaScript của trang không đọc được. Khác
      // `/leads` và `/reports` — hai chỗ đó công khai và cần đúng IP của khách.
      //
      // Route riêng thay vì `/api/proxy` vì nó còn phải gọi `revalidatePath`: xem
      // ghi chú trong route đó.
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ktvId,
          path: pathname,
          rating,
          comment: comment.trim() === '' ? null : comment.trim(),
        }),
      });

      if (res.status === 401) {
        setSession({ authenticated: false, role: null });
        setError('Phiên đăng nhập đã hết hạn. Đăng nhập lại để gửi đánh giá.');
        return;
      }
      if (res.status === 409) {
        setError('Bạn đã đánh giá kỹ thuật viên này rồi.');
        return;
      }
      if (res.status === 429) {
        setError('Bạn đã gửi khá nhiều đánh giá. Thử lại sau ít phút.');
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { title?: string } | null;
        setError(data?.title ?? 'Chưa gửi được đánh giá. Vui lòng thử lại.');
        return;
      }

      setDone(true);

      // Route ở trên đã `revalidatePath` cho đúng trang này, nên refresh lúc này
      // dựng lại từ dữ liệu mới. Thiếu một trong hai thì đánh giá vừa viết không
      // hiện ra: refresh mà không revalidate chỉ chạy lại server component trong
      // khi fetch bên dưới vẫn trả bản cache 600 giây.
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
    } finally {
      setPending(false);
    }
  }

  // Chưa biết trạng thái phiên: chưa vẽ gì. Vẽ tạm lời mời đăng nhập rồi đổi thành
  // ô nhập là một cú nhảy bố cục ngay dưới mắt người đang đọc đánh giá.
  if (session === null) return null;

  if (done) {
    return (
      <div
        role="status"
        className="mt-5 rounded-xl border border-success-bd bg-success-bg px-4 py-3.5 text-body text-success-fg"
      >
        Cảm ơn bạn đã đánh giá {ktvName}. Nhận xét của bạn đã hiển thị công khai.{' '}
        {/* Đường tới nơi xem lại — và là chỗ duy nhất người viết biết được nếu sau
            này đánh giá bị gỡ, vì trên trang hồ sơ nó chỉ đơn giản biến mất. */}
        <Link href="/tai-khoan" className="font-semibold underline underline-offset-4">
          Xem đánh giá đã viết
        </Link>
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <div className="mt-5 rounded-xl border border-ink-200 bg-white px-4 py-3.5">
        <p className="text-body text-ink-600">
          Bạn đã dùng dịch vụ của {ktvName}?{' '}
          <Link
            // Quay lại đúng trang này sau khi đăng nhập — người bấm từ đây đang định
            // viết đánh giá cho chính hồ sơ này, đưa họ về trang chủ là bắt tìm lại.
            href={`/dang-nhap?next=${encodeURIComponent(pathname)}`}
            className="font-semibold text-brand-600 underline underline-offset-4 transition hover:text-brand-700"
          >
            Đăng nhập
          </Link>{' '}
          để viết đánh giá. Không cần đăng nhập để tìm hoặc gọi.
        </p>
      </div>
    );
  }

  // KTV cũng có thể là khách của KTV khác, nên không chặn theo vai trò ở đây.
  // Backend mới là nơi biết chắc: nó từ chối người tự đánh giá hồ sơ của chính mình.
  return (
    <form onSubmit={submit} className="mt-5 rounded-xl border border-ink-200 bg-white p-4 shadow-card">
      <h3 className="text-h4 text-ink-900">Viết đánh giá</h3>
      <p className="mt-1 text-body-s text-ink-500">
        Đánh giá hiển thị công khai ngay và mỗi tài khoản chỉ đánh giá một kỹ thuật viên một lần.
      </p>

      <StarPicker
        value={rating}
        hovered={hovered}
        onSelect={setRating}
        onHover={setHovered}
        disabled={pending}
      />

      <label className="mt-4 block">
        <span className="text-body-s font-medium text-ink-700">Nhận xét (không bắt buộc)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={MAX_COMMENT}
          disabled={pending}
          placeholder="Kỹ thuật viên tới đúng giờ chứ? Tay nghề thế nào?"
          className="mt-1.5 w-full rounded-md border border-ink-200 px-3 py-2 text-body text-ink-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 disabled:opacity-60"
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 text-body-s text-danger-fg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-full bg-brand-500 px-5 py-2.5 text-body font-semibold text-white shadow-button transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
      >
        {pending ? 'Đang gửi…' : 'Gửi đánh giá'}
      </button>
    </form>
  );
}

/**
 * Năm sao chọn điểm.
 *
 * Là `<input type="radio">` thật nằm trong suốt trên mỗi ngôi sao, không phải
 * `<div onClick>`: nhóm radio cho sẵn điều hướng bằng phím mũi tên, đọc được bằng
 * trình đọc màn hình, và gửi kèm form mà không cần viết thêm gì. Ngôi sao vẽ ra chỉ
 * là lớp hiển thị bên dưới.
 */
function StarPicker({
  value,
  hovered,
  onSelect,
  onHover,
  disabled,
}: {
  value: number;
  hovered: number;
  onSelect: (v: number) => void;
  onHover: (v: number) => void;
  disabled: boolean;
}) {
  // Rê chuột thì xem trước tới ngôi sao đang rê; không rê thì hiện điểm đã chọn.
  const shown = hovered || value;

  return (
    <fieldset className="mt-3.5" onMouseLeave={() => onHover(0)}>
      <legend className="text-body-s font-medium text-ink-700">Chấm điểm</legend>

      <div className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={star}
            onMouseEnter={() => onHover(star)}
            className={`relative block ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <input
              type="radio"
              name="rating"
              value={star}
              checked={value === star}
              onChange={() => onSelect(star)}
              disabled={disabled}
              className="absolute inset-0 h-full w-full opacity-0"
            />
            <span className="sr-only">{star} sao</span>
            <span
              aria-hidden
              className={`block text-[28px] leading-none transition ${
                star <= shown ? 'text-champagne-500' : 'text-ink-300'
              }`}
            >
              ★
            </span>
          </label>
        ))}

        {value > 0 && (
          <span className="ml-2 text-body-s text-ink-500">
            <span className="tabular font-medium text-ink-700">{value}</span>/5
          </span>
        )}
      </div>
    </fieldset>
  );
}
