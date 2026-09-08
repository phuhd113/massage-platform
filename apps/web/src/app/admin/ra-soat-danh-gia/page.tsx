import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ModerateReviewForm } from '@/components/ModerateReviewForm';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDateTime, ktvPath } from '@/lib/site';
import type { AdminReviewForModeration, AdminReviewList } from '@/lib/types';

export const metadata: Metadata = { title: 'Rà soát đánh giá' };

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  PUBLISHED: 'Đang hiển thị',
  REJECTED: 'Đã gỡ',
};

/**
 * Hàng đợi rà soát đánh giá.
 *
 * `GET /admin/reviews` được thêm 2026-09-04 làm đường **tìm ra** đánh giá đáng gỡ —
 * trước đó chỉ có `PATCH .../moderate`, nên kiểm duyệt chỉ chạy khi có người báo cáo.
 * Nhưng endpoint đó không có trang nào gọi tới, nên trên thực tế nó chưa từng được
 * dùng: cùng hình dạng với `GET /admin/identity-documents` đã ghi trong
 * `project-status.md`.
 *
 * Thứ tự do backend quyết định: chưa gắn lead → tài khoản viết càng mới càng lên
 * trước → mới nhất. Tài khoản lập xong đánh giá ngay là hình dạng của việc bơm sao.
 *
 * `hasLead` là **dấu hiệu để xếp thứ tự đọc, không phải bằng chứng**. Khách bấm gọi
 * lúc chưa đăng nhập thì lead ẩn danh và không bao giờ khớp được, nên phần lớn đánh
 * giá thật cũng nằm trong nhóm "chưa gắn lead". Đừng đọc bộ lọc này như một danh sách
 * đánh giá giả.
 */
export default async function ModerateReviewsPage({
  searchParams,
}: {
  searchParams: { unverified?: string };
}) {
  const unverifiedOnly = searchParams.unverified === '1';

  let list: AdminReviewList;

  try {
    list = await authFetch<AdminReviewList>(
      `/admin/reviews?unverifiedOnly=${unverifiedOnly}&limit=100`,
    );
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/ra-soat-danh-gia');
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Rà soát đánh giá</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Đánh giá được đăng ngay khi gửi, nên đây là đường duy nhất để xử lý nội dung vi phạm — và
        nó tính lại điểm sao của KTV. Xếp theo dấu hiệu đáng ngờ: chưa gắn được lượt liên hệ nào
        lên trước, trong đó tài khoản vừa lập xong đã viết ngay lên đầu.
      </p>

      {/*
        Cảnh báo này nằm ngay cạnh bộ lọc chứ không ở cuối trang, vì nó là thứ dễ đọc
        sai nhất trên màn hình: "chưa gắn lead" trông như một danh sách đánh giá giả,
        trong khi phần lớn đánh giá thật cũng rơi vào đó.
      */}
      <p className="mt-3 max-w-prose rounded-md bg-ink-50 px-3.5 py-2.5 text-body text-ink-600">
        <strong className="text-ink-900">Chưa gắn lượt liên hệ không có nghĩa là giả.</strong> Khách
        bấm gọi lúc chưa đăng nhập thì lượt đó ẩn danh và không bao giờ khớp được, nên hầu hết đánh
        giá thật cũng nằm trong nhóm này. Chiều ngược lại mới đáng tin.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {[
          { value: false, label: 'Tất cả' },
          { value: true, label: 'Chưa gắn lượt liên hệ' },
        ].map((f) => (
          <Link
            key={String(f.value)}
            href={f.value ? '/admin/ra-soat-danh-gia?unverified=1' : '/admin/ra-soat-danh-gia'}
            aria-current={f.value === unverifiedOnly ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-body font-semibold transition ${
              f.value === unverifiedOnly
                ? 'bg-brand-500 text-white shadow-button'
                : 'border border-ink-200 bg-white text-ink-700 hover:border-brand-500 hover:text-brand-600'
            }`}
          >
            {f.label}
            {f.value === unverifiedOnly && (
              <span className="tabular ml-1.5 font-mono">{list.total}</span>
            )}
          </Link>
        ))}
      </div>

      {list.items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-ink-200 bg-white px-5 py-8 text-center">
          <p className="text-body-l text-ink-600">Chưa có đánh giá nào ở nhóm này.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {list.items.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </ul>
      )}

      {list.total > list.items.length && (
        <p className="mt-4 text-body text-ink-500">
          Đang hiện {list.items.length} trên {list.total} đánh giá.
        </p>
      )}
    </>
  );
}

function ReviewCard({ review }: { review: AdminReviewForModeration }) {
  // Dưới 1 giờ là tín hiệu mạnh nhất trong nhóm này: tài khoản lập xong viết ngay.
  const freshAccount = review.authorAccountAgeHours < 1;

  return (
    <li className="rounded-xl border border-ink-200 bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={ktvPath('vi', review.ktvSlug, review.ktvId)}
          target="_blank"
          className="font-display text-body-l font-bold text-ink-900 underline-offset-2 hover:underline"
        >
          {review.ktvFullName}
        </Link>

        <span className="tabular font-mono text-body-l font-bold text-ink-900">
          {review.rating}★
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-s">
        <span
          className={`rounded-md px-2 py-0.5 font-semibold ${
            review.status === 'PUBLISHED'
              ? 'bg-ink-100 text-ink-700'
              : 'bg-danger-bg text-danger-fg'
          }`}
        >
          {STATUS_LABELS[review.status] ?? review.status}
        </span>

        <span className={review.hasLead ? 'text-ink-500' : 'text-danger-fg'}>
          {review.hasLead ? 'Đã có lượt liên hệ' : 'Chưa gắn lượt liên hệ'}
        </span>

        <span className={freshAccount ? 'font-semibold text-danger-fg' : 'text-ink-500'}>
          · viết {formatAccountAge(review.authorAccountAgeHours)} sau khi lập tài khoản
        </span>
      </div>

      {review.comment ? (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-ink-50 px-3 py-2 text-body text-ink-700">
          {review.comment}
        </p>
      ) : (
        <p className="mt-2 text-body italic text-ink-500">Chấm sao, không viết nhận xét.</p>
      )}

      <div className="mt-2 text-body-s text-ink-500">
        {formatDateTime(review.createdAt, 'vi')}
      </div>

      <ModerateReviewForm
        reviewId={review.id}
        ktvId={review.ktvId}
        ktvSlug={review.ktvSlug}
        status={review.status}
      />
    </li>
  );
}

/**
 * Khoảng cách giữa lúc lập tài khoản và lúc viết, đọc được ở mọi độ lớn.
 *
 * Backend trả về **giờ** dạng số thực, và "0.03 giờ" thì không ai đọc ra là hai phút —
 * mà đúng những con số nhỏ nhất mới là thứ đáng chú ý nhất trên màn hình này.
 */
function formatAccountAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} phút`;
  if (hours < 48) return `${Math.round(hours)} giờ`;
  return `${Math.round(hours / 24)} ngày`;
}
