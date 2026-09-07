import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VerifyIdentityForm } from '@/components/VerifyIdentityForm';
import { mediaUrl } from '@/lib/media';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDateTime, ktvPath } from '@/lib/site';
import type { AdminKtvIdentityDocument, AdminKtvIdentityDocumentList } from '@/lib/types';

export const metadata: Metadata = { title: 'Duyệt CCCD' };

const STATUSES = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'VERIFIED', label: 'Đã xác minh' },
  { value: 'REJECTED', label: 'Đã từ chối' },
] as const;

type Status = (typeof STATUSES)[number]['value'];

/**
 * Hàng đợi duyệt CCCD.
 *
 * Backend đã có `GET /admin/identity-documents` từ đợt bắt buộc CCCD, nhưng **không
 * trang nào gọi tới** — endpoint tồn tại mà không có đường vào giao diện, nên trên
 * thực tế CCCD chỉ xem được khi nó tình cờ nằm trong một hồ sơ đang chờ duyệt.
 *
 * Vì sao điều đó là lỗ thật chứ không chỉ là bất tiện: gửi lại CCCD **không** làm đổi
 * trạng thái hồ sơ. KTV bị từ chối rồi chụp lại và gửi lần hai thì hồ sơ vẫn nằm
 * nguyên chỗ cũ trong danh sách lọc theo trạng thái **hồ sơ** — nếu hồ sơ đó đã
 * VERIFIED (một lượt thay thẻ), lần gửi lại không xuất hiện ở bất kỳ đâu, và đúng
 * trường hợp đó là trường hợp cần nhìn lại nhất: đó chính là cái lỗ mà việc bắt buộc
 * CCCD sinh ra để bịt.
 *
 * Cùng hình dạng với `/admin/duyet-anh` và `/admin/duyet-chung-chi` — ba hàng đợi này
 * lấp đầy theo nhịp khác hẳn hàng đợi hồ sơ, vốn duyệt một lần rồi thôi.
 */
export default async function VerifyIdentityDocumentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  // Giá trị lạ rơi về PENDING thay vì để backend trả 400: tham số này đến từ thanh
  // địa chỉ, và một màn hình lỗi cho một chữ gõ sai trong URL là phản ứng quá tay.
  const status: Status =
    STATUSES.find((s) => s.value === searchParams.status)?.value ?? 'PENDING';

  let list: AdminKtvIdentityDocumentList;

  try {
    list = await authFetch<AdminKtvIdentityDocumentList>(
      `/admin/identity-documents?status=${status}&limit=100`,
    );
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/duyet-cccd');
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Duyệt CCCD</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Hồ sơ không được duyệt cho tới khi CCCD được xác minh. Gửi sớm nhất lên đầu. Mở cả hai mặt
        và đối chiếu chúng là <strong>cùng một thẻ</strong> — duyệt riêng từng mặt là để lọt việc
        ghép hai nửa của hai thẻ khác nhau.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/duyet-cccd?status=${s.value}`}
            aria-current={s.value === status ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-body font-semibold transition ${
              s.value === status
                ? 'bg-brand-500 text-white shadow-button'
                : 'border border-ink-200 bg-white text-ink-700 hover:border-brand-500 hover:text-brand-600'
            }`}
          >
            {s.label}
            {s.value === status && <span className="tabular ml-1.5 font-mono">{list.total}</span>}
          </Link>
        ))}
      </div>

      {list.items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-ink-200 bg-white px-5 py-8 text-center">
          <p className="text-body-l text-ink-600">
            {status === 'PENDING'
              ? 'Không còn CCCD nào chờ duyệt.'
              : 'Chưa có CCCD nào ở trạng thái này.'}
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {list.items.map((d) => (
            <IdentityCard key={d.id} doc={d} />
          ))}
        </ul>
      )}

      {list.total > list.items.length && (
        <p className="mt-4 text-body text-ink-500">
          Đang hiện {list.items.length} trên {list.total} hồ sơ.
        </p>
      )}
    </>
  );
}

function IdentityCard({ doc }: { doc: AdminKtvIdentityDocument }) {
  return (
    <li className="rounded-xl border border-ink-200 bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={ktvPath('vi', doc.ktvSlug, doc.ktvId)}
          target="_blank"
          className="font-display text-body-l font-bold text-ink-900 underline-offset-2 hover:underline"
        >
          {doc.ktvName}
        </Link>

        {/* Trạng thái **hồ sơ**, không phải của CCCD — nó nói cho admin biết việc duyệt
            này còn mở ra bước nào phía sau. Hồ sơ đã duyệt mà CCCD lại đang chờ nghĩa
            là một lượt thay thẻ, và đó là trường hợp cần nhìn kỹ nhất. */}
        <span className="rounded-full bg-ink-100 px-2.5 py-1 text-caption font-medium text-ink-600">
          Hồ sơ: {profileStatusLabel(doc.ktvVerificationStatus)}
        </span>
      </div>

      <div className="mt-0.5 text-body text-ink-500">
        Gửi lúc {formatDateTime(doc.submittedAt, 'vi')}
      </div>

      {/*
        Link mở tab mới chứ không nhúng thẻ ảnh: URL ký chỉ sống 15 phút, nên ảnh nhúng
        sẵn sẽ thành ô vỡ khi admin để trang mở lâu — trông như hệ thống làm mất giấy tờ.

        `rel="noreferrer"` là bắt buộc chứ không phải thói quen: đây là URL ký mở được
        ảnh giấy tờ tuỳ thân, gửi nó trong header Referer là trao quyền đó cho bên thứ ba.
      */}
      <div className="mt-2 flex flex-wrap gap-4">
        <a
          href={mediaUrl(doc.frontUrl) ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="text-body font-semibold text-brand-600 underline underline-offset-2"
        >
          Mở mặt trước
        </a>
        <a
          href={mediaUrl(doc.backUrl) ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="text-body font-semibold text-brand-600 underline underline-offset-2"
        >
          Mở mặt sau
        </a>
      </div>

      {doc.rejectionReason && (
        <div className="mt-2 rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg">
          Lý do từ chối: {doc.rejectionReason}
        </div>
      )}

      <VerifyIdentityForm ktvId={doc.ktvId} currentStatus={doc.verifyStatus} />
    </li>
  );
}

function profileStatusLabel(status: AdminKtvIdentityDocument['ktvVerificationStatus']) {
  return status === 'VERIFIED' ? 'đã duyệt' : status === 'REJECTED' ? 'đã từ chối' : 'chờ duyệt';
}
