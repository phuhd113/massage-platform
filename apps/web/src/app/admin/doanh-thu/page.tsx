import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { packageLabel } from '@/lib/labels';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDate, formatVnd } from '@/lib/site';
import type { AdminRevenueDay, AdminRevenueReport } from '@/lib/types';

export const metadata: Metadata = { title: 'Doanh thu' };

const RANGES = [
  { days: 7, label: '7 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '90 ngày' },
] as const;

const DAY_MS = 86_400_000;

/**
 * Báo cáo doanh thu theo khu vực, loại gói và ngày.
 *
 * Con số lấy từ **sổ cái ví** (bút toán CAPTURE và REFUND), không từ bảng campaign:
 * sổ cái là nơi tiền thật sự đổi chủ, còn campaign chỉ mô tả thứ đã bán. Nếu hai
 * nguồn lệch nhau thì con số đúng là con số ở sổ — và chính sự lệch đó là thứ job
 * `wallet:reconcile` tồn tại để phát hiện.
 *
 * Doanh thu ròng có thể **âm** ở một khu vực khi hoàn nhiều hơn bán trong kỳ. Đó là
 * con số đúng và trang hiển thị nguyên trạng: kẹp về 0 sẽ giấu đi đúng cái bất thường
 * đáng nhìn nhất.
 */
export default async function RevenuePage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  // Giá trị lạ rơi về 30 ngày thay vì để backend trả 400 — tham số này đến từ thanh
  // địa chỉ, và một màn hình lỗi cho một chữ gõ sai là phản ứng quá tay.
  const days = RANGES.find((r) => String(r.days) === searchParams.days)?.days ?? 30;

  const from = new Date(Date.now() - days * DAY_MS).toISOString();

  let report: AdminRevenueReport;

  try {
    report = await authFetch<AdminRevenueReport>(
      `/admin/revenue?from=${encodeURIComponent(from)}`,
    );
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/doanh-thu');
    throw err;
  }

  const transactions = report.items.reduce((sum, r) => sum + r.transactions, 0);

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Doanh thu</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Tính từ sổ cái ví — bút toán trừ tiền mua gói, đã trừ hoàn tiền khi KTV huỷ chiến dịch.
        Một khu vực có thể ra số âm nếu trong kỳ hoàn nhiều hơn bán.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <Link
            key={r.days}
            href={`/admin/doanh-thu?days=${r.days}`}
            aria-current={r.days === days ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-body font-semibold transition ${
              r.days === days
                ? 'bg-brand-500 text-white shadow-button'
                : 'border border-ink-200 bg-white text-ink-700 hover:border-brand-500 hover:text-brand-600'
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Doanh thu ròng" value={formatVnd(report.total, 'vi')} emphasis />
        <StatCard label="Số giao dịch" value={String(transactions)} />
        <StatCard
          label="Trung bình mỗi giao dịch"
          value={transactions > 0 ? formatVnd(Math.round(report.total / transactions), 'vi') : '—'}
        />
      </div>

      <DailyChart daily={report.daily} days={days} />

      <h2 className="mt-8 text-h2 text-ink-900">Theo khu vực và gói</h2>

      {report.items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-ink-200 bg-white px-5 py-8 text-center">
          <p className="text-body-l text-ink-600">Chưa có giao dịch nào trong kỳ này.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full min-w-[540px] border-collapse text-body">
            <thead>
              <tr className="border-b border-ink-200 text-left text-body-s text-ink-500">
                <th className="px-4 py-2.5 font-semibold">Khu vực</th>
                <th className="px-4 py-2.5 font-semibold">Gói</th>
                <th className="px-4 py-2.5 text-right font-semibold">Giao dịch</th>
                <th className="px-4 py-2.5 text-right font-semibold">Doanh thu ròng</th>
              </tr>
            </thead>
            <tbody>
              {report.items.map((row) => (
                <tr
                  key={`${row.areaId}-${row.packageType}`}
                  className="border-b border-ink-100 last:border-b-0"
                >
                  <td className="px-4 py-2.5 text-ink-900">{row.areaName}</td>
                  <td className="px-4 py-2.5 text-ink-700">{packageLabel(row.packageType)}</td>
                  <td className="tabular px-4 py-2.5 text-right font-mono text-ink-700">
                    {row.transactions}
                  </td>
                  <td
                    className={`tabular px-4 py-2.5 text-right font-mono font-semibold ${
                      row.netRevenue < 0 ? 'text-danger-fg' : 'text-ink-900'
                    }`}
                  >
                    {formatVnd(row.netRevenue, 'vi')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white px-4 py-3.5">
      <div className="text-body-s text-ink-500">{label}</div>
      <div
        className={`tabular mt-1 font-mono font-bold text-ink-900 ${
          emphasis ? 'text-[24px] leading-8' : 'text-body-l'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * Cột doanh thu theo ngày, vẽ bằng div chứ không kéo thư viện biểu đồ.
 *
 * Lý do giống mục icon inline SVG: một thư viện chart cho đúng một khối trên đúng một
 * trang sau đăng nhập là vài chục KB JS cho một hình có mười cột.
 *
 * Backend **chỉ trả ngày có phát sinh giao dịch**, nên phải tự điền 0 cho ngày trống:
 * vẽ thẳng mảng thưa sẽ cho ra một trục thời gian co giãn tuỳ ý, nơi hai cột cạnh
 * nhau có thể cách nhau hai tuần mà nhìn không ra.
 */
function DailyChart({ daily, days }: { daily: AdminRevenueDay[]; days: number }) {
  if (daily.length === 0) return null;

  const byDate = new Map(daily.map((d) => [d.date, d.netRevenue]));

  // Dựng trục từ ngày hiện tại lùi lại, theo **giờ Việt Nam** để khớp với cách
  // backend gom nhóm — lệch múi giờ ở đây sẽ đẩy cột cuối cùng ra ngoài trục.
  const axis: AdminRevenueDay[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    axis.push({ date: key, netRevenue: byDate.get(key) ?? 0 });
  }

  // Thang đo theo giá trị tuyệt đối lớn nhất: ngày hoàn tiền ròng là cột âm, và nó
  // phải nằm trong khung chứ không tràn ra ngoài.
  const peak = Math.max(...axis.map((d) => Math.abs(d.netRevenue)), 1);

  return (
    <section className="mt-6 rounded-xl border border-ink-200 bg-white px-4 py-4">
      <h2 className="text-body-l font-bold text-ink-900">Theo ngày</h2>

      <div className="mt-3 flex h-[120px] items-end gap-px" role="img" aria-label="Biểu đồ doanh thu theo ngày">
        {axis.map((d) => {
          const negative = d.netRevenue < 0;
          const height = (Math.abs(d.netRevenue) / peak) * 100;

          return (
            <div
              key={d.date}
              className="group relative flex-1 rounded-t-sm transition"
              // Ngày 0 đồng vẫn phải **nhìn thấy được**, không chỉ tồn tại trong DOM.
              // Bản đầu để 1.5% — đúng 1,8px trên khung 120px, tức một đường mờ không
              // ai nhận ra là một ngày; biểu đồ đọc thành một cột trôi lơ lửng không
              // có đường nền. 6% cho ra ~7px: đủ thành một hàng răng cưa liền mạch
              // nói "ngày này không bán được gì", vẫn thấp hơn hẳn cột có doanh thu
              // thật nên không đọc nhầm thành một khoản tiền nhỏ.
              style={{ height: `${Math.max(height, d.netRevenue === 0 ? 6 : 8)}%` }}
            >
              <div
                className={`h-full w-full rounded-t-sm ${
                  negative
                    ? 'bg-danger-fg/60'
                    : d.netRevenue === 0
                      ? 'bg-ink-200'
                      : 'bg-brand-500'
                }`}
              />
              {/* Tooltip thuần CSS: trang này chỉ có admin xem, và một thư viện
                  tooltip cho một khối là cái giá không đáng trả. */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-caption text-white group-hover:block">
                {formatDate(d.date, 'vi')} · {formatVnd(d.netRevenue, 'vi')}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between text-caption text-ink-500">
        <span>{formatDate(axis[0].date, 'vi')}</span>
        <span>{formatDate(axis[axis.length - 1].date, 'vi')}</span>
      </div>
    </section>
  );
}
