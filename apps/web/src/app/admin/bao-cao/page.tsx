import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ResolveReportForm } from '@/components/ResolveReportForm';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDateTime, ktvPath } from '@/lib/site';
import type { AdminReportList, AdminReportQueueItem, ReportReason } from '@/lib/types';

export const metadata: Metadata = { title: 'Báo cáo vi phạm' };

const STATUSES = [
  { value: 'PENDING', label: 'Chờ xử lý' },
  { value: 'ACTION_TAKEN', label: 'Đã xử lý' },
  { value: 'DISMISSED', label: 'Đã bỏ qua' },
] as const;

type Status = (typeof STATUSES)[number]['value'];

/**
 * Nhãn tiếng Việt cho từng lý do.
 *
 * `severe` quyết định màu thẻ. Chỉ hai loại được đánh dấu, và đó là chủ ý: tô đỏ mọi
 * thứ thì không còn gì nổi bật, mà hai loại này là hai loại chạm thẳng vào rủi ro
 * pháp lý và rủi ro bị Google phân loại là nội dung người lớn — mất SEO ở đây là mất
 * gần như toàn bộ khách.
 */
const REASONS: Record<ReportReason, { label: string; severe: boolean }> = {
  PROSTITUTION: { label: 'Dịch vụ trá hình', severe: true },
  INAPPROPRIATE_CONTENT: { label: 'Nội dung phản cảm', severe: true },
  FALSE_INFORMATION: { label: 'Thông tin sai sự thật', severe: false },
  IMPERSONATION: { label: 'Mạo danh', severe: false },
  MISCONDUCT: { label: 'Hành vi không đúng mực', severe: false },
  OTHER: { label: 'Khác', severe: false },
};

const KTV_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Hồ sơ chờ duyệt',
  VERIFIED: 'Hồ sơ đang hiển thị',
  REJECTED: 'Hồ sơ đã bị từ chối',
};

/**
 * Hàng đợi xử lý báo cáo vi phạm.
 *
 * Trang này là **lần thứ tư** của cùng một lỗi đã ghi trong `project-status.md`:
 * `GET /admin/reports` và `PATCH /admin/reports/{id}/resolve` có từ 2026-09-04, nhưng
 * không trang nào gọi tới. Một endpoint không có đường vào giao diện thì không tồn
 * tại đối với người dùng, mà cũng không có gì báo đỏ — nó vẫn trả 200 với curl. Hệ
 * quả ở đây nặng hơn ba lần trước: khách bấm báo cáo và nhận đúng câu "đã ghi nhận",
 * còn thực tế không có ai ở phía bên kia để đọc.
 *
 * Xếp theo **số báo cáo còn chờ của hồ sơ**, không theo thời gian — thứ tự do backend
 * quyết định, trang chỉ hiển thị lại. Một hồ sơ bị hai mươi người báo cáo khác hẳn về
 * mức độ so với hai mươi hồ sơ mỗi cái một báo cáo, mà danh sách phẳng theo thời gian
 * thì hai trường hợp trông giống hệt nhau.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  // Giá trị lạ rơi về PENDING thay vì để backend trả 400: tham số này đến từ thanh
  // địa chỉ, và một màn hình lỗi cho một chữ gõ sai trong URL là phản ứng quá tay.
  const status: Status =
    STATUSES.find((s) => s.value === searchParams.status)?.value ?? 'PENDING';

  let list: AdminReportList;

  try {
    list = await authFetch<AdminReportList>(`/admin/reports?status=${status}&limit=100`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/bao-cao');
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Báo cáo vi phạm</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Hồ sơ bị nhiều người báo cáo xếp lên đầu. Báo cáo <strong>không</strong> tự ẩn hồ sơ — nếu
        cần gỡ, mở hồ sơ ở trang duyệt và đổi trạng thái ở đó, rồi quay lại chốt dòng này.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/bao-cao?status=${s.value}`}
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
              ? 'Không còn báo cáo nào chờ xử lý.'
              : 'Chưa có báo cáo nào ở trạng thái này.'}
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {list.items.map((item) => (
            <ReportCard key={item.report.id} item={item} />
          ))}
        </ul>
      )}

      {list.total > list.items.length && (
        <p className="mt-4 text-body text-ink-500">
          Đang hiện {list.items.length} trên {list.total} báo cáo.
        </p>
      )}
    </>
  );
}

function ReportCard({ item }: { item: AdminReportQueueItem }) {
  const { report, pendingReportCount } = item;
  const reason = REASONS[report.reason] ?? { label: report.reason, severe: false };

  return (
    <li
      className={`rounded-xl border bg-white px-4 py-3.5 ${
        reason.severe ? 'border-danger-fg/40' : 'border-ink-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={ktvPath('vi', report.ktvSlug, report.ktvId)}
          target="_blank"
          className="font-display text-body-l font-bold text-ink-900 underline-offset-2 hover:underline"
        >
          {report.ktvFullName}
        </Link>

        {/* Con số này cố ý không đổi theo tab đang mở — nó trả lời "hồ sơ đó hiện
            còn bao nhiêu việc chưa làm", kể cả khi đang xem danh sách đã xử lý.
            Ẩn khi chỉ có một: "1 báo cáo chờ" trên một thẻ báo cáo là dòng chữ
            không thêm thông tin nào. */}
        {pendingReportCount > 1 && (
          <span className="rounded-full bg-danger-bg px-2.5 py-1 text-caption font-semibold text-danger-fg">
            {pendingReportCount} báo cáo chờ
          </span>
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`rounded-md px-2 py-0.5 text-body-s font-semibold ${
            reason.severe ? 'bg-danger-bg text-danger-fg' : 'bg-ink-100 text-ink-700'
          }`}
        >
          {reason.label}
        </span>
        <span className="text-body-s text-ink-500">
          {KTV_STATUS_LABELS[report.ktvVerificationStatus] ?? report.ktvVerificationStatus}
        </span>
      </div>

      {report.detail && (
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-ink-50 px-3 py-2 text-body text-ink-700">
          {report.detail}
        </p>
      )}

      <div className="mt-2 text-body-s text-ink-500">
        {formatDateTime(report.createdAt, 'vi')} ·{' '}
        {report.reporterUserId ? 'người đã đăng nhập' : 'khách ẩn danh'}
      </div>

      {report.status === 'PENDING' ? (
        <>
          {/*
            Đường sang trang duyệt hồ sơ. Cố ý là một link chứ không phải nút gỡ tại
            chỗ: việc gỡ hồ sơ đi qua đúng một đường duy nhất, nơi đã ghi sẵn ai
            quyết định và vì sao.
          */}
          <Link
            href="/admin/duyet-ktv"
            className="mt-2 inline-block text-body font-semibold text-brand-600 underline underline-offset-2"
          >
            Mở trang duyệt hồ sơ
          </Link>

          <ResolveReportForm reportId={report.id} />
        </>
      ) : (
        <div className="mt-3 border-t border-ink-100 pt-2.5 text-body-s text-ink-500">
          {report.status === 'ACTION_TAKEN' ? 'Đã xử lý' : 'Đã bỏ qua'}
          {report.reviewedAt && ` · ${formatDateTime(report.reviewedAt, 'vi')}`}
          {report.resolutionNote && (
            <p className="mt-1 text-body text-ink-700">{report.resolutionNote}</p>
          )}
        </div>
      )}
    </li>
  );
}
