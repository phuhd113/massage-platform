import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CancelCampaignButton } from '@/components/CancelCampaignButton';
import { api } from '@/lib/api';
import { campaignStatusLabel, packageLabel } from '@/lib/labels';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDate, formatVnd } from '@/lib/site';
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

  // Đang chạy lên đầu: chúng là thứ duy nhất còn tác động tới thứ hạng và còn thao
  // tác được (gia hạn, huỷ). Lịch sử vẫn giữ nguyên thứ tự mới nhất trước.
  const sorted = [...campaigns].sort((a, b) => {
    if (a.isRunning !== b.isRunning) return a.isRunning ? -1 : 1;
    return new Date(b.startAt).getTime() - new Date(a.startAt).getTime();
  });

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Chiến dịch của bạn</h1>

      {campaigns.length === 0 ? (
        <div className="mt-5 rounded-xl border border-ink-200 bg-white px-5 py-8 text-center">
          <p className="text-body-l text-ink-600">
            Chưa có chiến dịch nào. Hồ sơ vẫn hiển thị trong tìm kiếm, chỉ là xếp dưới những KTV
            đang mua gói trong cùng khu vực.
          </p>
          <Link
            href="/dashboard/goi"
            className="mt-4 inline-block rounded-md bg-brand-500 px-6 py-3 text-body-l font-semibold text-white transition hover:bg-brand-600"
          >
            Xem gói đẩy tin
          </Link>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3">
          {sorted.map((c) => (
            <CampaignRow key={c.id} campaign={c} areaLabel={areaName.get(c.areaId)} />
          ))}
        </ul>
      )}

      <p className="mt-7 max-w-prose text-body-l text-ink-600">
        Huỷ giữa chừng được hoàn tiền theo số ngày <strong>trọn vẹn</strong> còn lại; ngày đang
        dùng dở không hoàn. Tiền quay về ví chứ không về thẻ, và chỗ đã giữ trong khu vực được trả
        lại ngay cho người khác mua.
      </p>
    </>
  );
}

function CampaignRow({ campaign: c, areaLabel }: { campaign: Campaign; areaLabel?: string }) {
  const start = new Date(c.startAt);
  const end = new Date(c.endAt);

  const totalMs = end.getTime() - start.getTime();
  const usedMs = Date.now() - start.getTime();

  // Kẹp trong [0,1]: chiến dịch đặt trước có usedMs âm, chiến dịch quá hạn thì vượt
  // 1 — cả hai đều làm thanh tiến độ tràn ra ngoài khung nếu không chặn.
  const progress = totalMs > 0 ? Math.min(1, Math.max(0, usedMs / totalMs)) : 0;

  const totalDays = Math.max(1, Math.round(totalMs / 86_400_000));
  const usedDays = Math.min(totalDays, Math.max(0, Math.floor(usedMs / 86_400_000)));

  return (
    <li
      className={`rounded-xl border px-[18px] py-4 ${
        c.isRunning ? 'border-ink-200 bg-white' : 'border-ink-200 bg-brand-50'
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`font-display text-body-l font-bold ${
                c.isRunning ? 'text-ink-900' : 'text-ink-600'
              }`}
            >
              {packageLabel(c.packageType)}
            </span>
            <span className={`text-body-l ${c.isRunning ? 'text-ink-600' : 'text-ink-500'}`}>
              {areaLabel ?? 'Khu vực đã gỡ'}
            </span>

            {c.isRunning ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-2.5 py-0.5 text-body-s font-semibold text-success-fg">
                <span className="h-1.5 w-1.5 rounded-full bg-success-fg" />
                Đang chạy
              </span>
            ) : (
              <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-body-s font-semibold text-ink-600">
                {campaignStatusLabel(c.status)}
              </span>
            )}
          </div>

          <div className={`mt-1.5 text-body-l ${c.isRunning ? 'text-ink-600' : 'text-ink-500'}`}>
            {formatDate(start, 'vi')} – {formatDate(end, 'vi')}
            {c.isRunning && ` · +${c.boostPoints} điểm`} ·{' '}
            <span className="tabular font-mono">{formatVnd(c.pricePaid, 'vi')}</span>
            {c.refundedAmount > 0 && (
              <>
                {' · đã hoàn '}
                <span className="tabular font-mono text-success-fg">
                  {formatVnd(c.refundedAmount, 'vi')}
                </span>{' '}
                về ví
              </>
            )}
          </div>

          {c.isRunning && (
            <>
              <div
                className="mt-2.5 h-1.5 w-full max-w-[340px] overflow-hidden rounded-full bg-ink-100"
                role="presentation"
              >
                <span
                  className="block h-full rounded-full bg-brand-500"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              {/* Con số ngày đứng cạnh thanh tiến độ chứ không thay nó: thanh cho
                  thấy còn nhiều hay ít trong một cái liếc, con số mới dùng để quyết
                  định có huỷ hay không. */}
              <div className="tabular mt-1.5 text-caption text-ink-500">
                Đã dùng {usedDays} / {totalDays} ngày
              </div>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {c.status === 'ACTIVE' ? (
            <CancelCampaignButton campaignId={c.id} endAt={c.endAt} />
          ) : (
            <Link
              href="/dashboard/goi"
              className="rounded-md border border-ink-200 bg-white px-3.5 py-2.5 text-body-s font-semibold text-ink-700 transition hover:border-brand-500 hover:text-brand-600"
            >
              Mua lại
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
