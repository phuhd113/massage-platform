import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CancelCampaignButton } from '@/components/CancelCampaignButton';
import { api } from '@/lib/api';
import { campaignStatusLabel, packageLabel } from '@/lib/labels';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatVnd } from '@/lib/site';
import type { Campaign } from '@/lib/types';

export const metadata: Metadata = { title: 'Chiến dịch' };

export default async function CampaignsPage() {
  let campaigns: Campaign[];

  try {
    campaigns = await authFetch<Campaign[]>('/ktv/campaigns');
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  // Tra tên khu vực từ cây khu vực công khai: API campaign chỉ trả areaId, và
  // "Quận 7" dễ đọc hơn một chuỗi UUID.
  const areas = await api.areaTree();
  const areaName = new Map(
    areas.flatMap((p) => p.children.map((d) => [d.id, `${d.name}, ${p.name}`] as const)),
  );

  return (
    <>
      <h1 className="text-h1 text-ink-900">Chiến dịch</h1>

      {campaigns.length === 0 ? (
        <p className="mt-4 text-ink-600">Chưa có chiến dịch nào.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {campaigns.map((c) => (
            <li key={c.id} className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {packageLabel(c.packageType)}
                    <span className="ml-2 text-sm font-normal text-ink-500">
                      {areaName.get(c.areaId) ?? 'Khu vực đã gỡ'}
                    </span>
                  </h2>
                  <p className="mt-1 text-sm text-ink-600">
                    {new Date(c.startAt).toLocaleDateString('vi-VN')} –{' '}
                    {new Date(c.endAt).toLocaleDateString('vi-VN')} · +{c.boostPoints} điểm ·{' '}
                    {formatVnd(c.pricePaid)}
                  </p>
                  {c.refundedAmount > 0 && (
                    <p className="mt-1 text-sm text-brand-600">
                      Đã hoàn {formatVnd(c.refundedAmount)} về ví
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      c.isRunning
                        ? 'bg-brand-50 text-brand-700'
                        : 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    {c.isRunning ? 'Đang chạy' : campaignStatusLabel(c.status)}
                  </span>

                  {c.status === 'ACTIVE' && (
                    <CancelCampaignButton campaignId={c.id} endAt={c.endAt} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 max-w-2xl text-sm text-ink-600">
        Huỷ giữa chừng được hoàn tiền theo số ngày <strong>trọn vẹn</strong> còn lại; ngày đang dùng
        dở không hoàn. Tiền quay về ví chứ không về thẻ, và chỗ đã giữ trong khu vực được trả lại
        ngay cho người khác mua.
      </p>
    </>
  );
}
