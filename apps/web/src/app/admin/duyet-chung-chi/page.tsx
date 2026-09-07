import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VerifyCertificationForm } from '@/components/VerifyCertificationForm';
import { mediaUrl } from '@/lib/media';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDate, formatDateTime, ktvPath } from '@/lib/site';
import type { AdminKtvCertification, AdminKtvCertificationList } from '@/lib/types';

export const metadata: Metadata = { title: 'Duyệt chứng chỉ' };

const STATUSES = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'VERIFIED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
] as const;

type Status = (typeof STATUSES)[number]['value'];

/**
 * Hàng đợi duyệt chứng chỉ hành nghề.
 *
 * Tách khỏi trang duyệt hồ sơ, và đây là lỗi đã gặp thật chứ không phải đề phòng:
 * chứng chỉ trước đây chỉ hiện lồng trong `/admin/duyet-ktv`, vốn lọc theo trạng thái
 * **hồ sơ**. KTV đã được duyệt tải chứng chỉ mới lên thì nó nằm dưới tab "Đã duyệt" —
 * nơi admin không có lý do gì để mở — nên không bao giờ được xem tới, trong khi KTV
 * nhận đúng câu "đã gửi, chờ duyệt" rồi chờ vô hạn.
 *
 * Cùng hình dạng với `/admin/duyet-anh` vì cùng một nguyên nhân: hai hàng đợi lấp đầy
 * theo nhịp khác hẳn hàng đợi hồ sơ — hồ sơ duyệt một lần rồi thôi, còn chứng chỉ và
 * ảnh thì thêm mới bất cứ lúc nào sau đó.
 */
export default async function VerifyCertificationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  // Giá trị lạ rơi về PENDING thay vì để backend trả 400: tham số này đến từ thanh
  // địa chỉ, và một màn hình lỗi cho một chữ gõ sai trong URL là phản ứng quá tay.
  const status: Status =
    STATUSES.find((s) => s.value === searchParams.status)?.value ?? 'PENDING';

  let list: AdminKtvCertificationList;

  try {
    list = await authFetch<AdminKtvCertificationList>(
      `/admin/certifications?status=${status}&limit=100`,
    );
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/duyet-chung-chi');
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Duyệt chứng chỉ</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Chứng chỉ chỉ hiển thị trên hồ sơ công khai sau khi được duyệt. Cũ nhất lên đầu. Mở file để
        đối chiếu tên chứng chỉ và nơi cấp với nội dung KTV đã khai.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/duyet-chung-chi?status=${s.value}`}
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
              ? 'Không còn chứng chỉ nào chờ duyệt.'
              : 'Chưa có chứng chỉ nào ở trạng thái này.'}
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.items.map((c) => (
            <CertificationCard key={c.id} cert={c} />
          ))}
        </ul>
      )}

      {list.total > list.items.length && (
        <p className="mt-4 text-body text-ink-500">
          Đang hiện {list.items.length} trên {list.total} chứng chỉ.
        </p>
      )}
    </>
  );
}

function CertificationCard({ cert }: { cert: AdminKtvCertification }) {
  return (
    <li className="rounded-xl border border-ink-200 bg-white px-4 py-3.5">
      <Link
        href={ktvPath('vi', cert.ktvSlug, cert.ktvId)}
        target="_blank"
        className="font-display text-body-l font-bold text-ink-900 underline-offset-2 hover:underline"
      >
        {cert.ktvName}
      </Link>

      <div className="mt-1.5 text-body font-semibold text-ink-900">{cert.name}</div>
      <div className="mt-0.5 text-body text-ink-500">
        {cert.issuingOrg ?? 'Chưa ghi nơi cấp'}
        {cert.issuedAt && ` · cấp ${formatDate(cert.issuedAt, 'vi')}`}
      </div>
      <div className="mt-0.5 text-body text-ink-500">
        Tải lên {formatDateTime(cert.createdAt, 'vi')}
      </div>

      {/*
        Link mở tab mới chứ không nhúng ảnh: file có thể là PDF, và URL ký chỉ sống 15
        phút nên một tấm ảnh nhúng sẵn sẽ thành ô vỡ khi admin để trang mở lâu.

        `rel="noreferrer"` là bắt buộc chứ không phải thói quen: URL chứng chỉ là URL
        ký, gửi nó đi trong header Referer là trao quyền mở giấy tờ cho bên thứ ba.
      */}
      <a
        href={mediaUrl(cert.fileUrl) ?? '#'}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-body font-semibold text-brand-600 underline underline-offset-2"
      >
        Mở file chứng chỉ
      </a>

      {cert.rejectionReason && (
        <div className="mt-2 rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg">
          Lý do từ chối: {cert.rejectionReason}
        </div>
      )}

      {/* Chứng chỉ đã xử lý vẫn cho đổi quyết định: một cái bị từ chối nhầm mà không có
          đường sửa sẽ buộc KTV phải tải lên lại từ đầu. */}
      <VerifyCertificationForm
        certificationId={cert.id}
        ktvId={cert.ktvId}
        ktvSlug={cert.ktvSlug}
      />
    </li>
  );
}
