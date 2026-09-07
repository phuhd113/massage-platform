import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TopUpForm } from '@/components/TopUpForm';
import { api } from '@/lib/api';
import { packageLabel, transactionLabel } from '@/lib/labels';
import { requireKtvProfile } from '@/lib/require-profile';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDateTime, formatVnd } from '@/lib/site';
import type { Campaign, WalletBalance, WalletTransactionList } from '@/lib/types';

export const metadata: Metadata = { title: 'Ví' };

export default async function WalletPage() {
  // Chưa tạo hồ sơ thì ví chưa dùng được vào việc gì — mua gói đòi hồ sơ đã duyệt.
  await requireKtvProfile();

  let wallet: WalletBalance;
  let ledger: WalletTransactionList;
  let campaigns: Campaign[];

  try {
    [wallet, ledger, campaigns] = await Promise.all([
      authFetch<WalletBalance>('/wallet/balance'),
      authFetch<WalletTransactionList>('/wallet/transactions?page=1&size=50'),
      authFetch<Campaign[]>('/ktv/campaigns'),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  // Bút toán chỉ mang campaignId, nên phải tra ngược ra gói và khu vực. Không có
  // vế này thì sổ chỉ ghi "Mua gói đẩy tin −1.500.000 ₫" ba lần giống hệt nhau và
  // KTV không đối chiếu được dòng nào với chiến dịch nào.
  const areas = await api.areaTree();
  const areaName = new Map(areas.flatMap((p) => p.children.map((d) => [d.id, d.name] as const)));
  const campaignById = new Map(campaigns.map((c) => [c.id, c] as const));

  function context(campaignId: string | null): string | null {
    if (!campaignId) return null;
    const c = campaignById.get(campaignId);
    if (!c) return null;
    const area = areaName.get(c.areaId);
    return area ? `${packageLabel(c.packageType)}, ${area}` : packageLabel(c.packageType);
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Ví</h1>

      {/* "Dùng được" đứng đầu, to nhất và là ô duy nhất tô nền đặc vì nó trả lời
          đúng câu hỏi KTV đang hỏi: mua được gói nào bây giờ. Nếu tổng số dư nổi
          bật hơn, KTV nhìn thấy 1.750.000₫ rồi bị từ chối mua gói 1.500.000₫ —
          trải nghiệm đó đọc như lỗi hệ thống và thành ticket, dù ví hoạt động
          hoàn toàn đúng. */}
      <div className="mt-5 grid gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl bg-brand-500 p-5 text-white">
          <div className="text-label uppercase text-brand-200">Dùng được ngay</div>
          <div className="tabular mt-2 font-mono text-[34px] font-medium leading-10">
            {formatVnd(wallet.available, 'vi')}
          </div>
          <div className="mt-1.5 text-body-l leading-[21px] text-brand-100">
            Đây là số bạn mua được gói ngay bây giờ.
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-5">
          <div className="text-label uppercase text-ink-500">Tổng số dư</div>
          <div className="tabular mt-2 font-mono text-2xl font-medium text-ink-900">
            {formatVnd(wallet.balance, 'vi')}
          </div>
          <div className="mt-1.5 text-body-l leading-[21px] text-ink-600">
            Tổng sở hữu, đã gồm cả phần đang giữ.
          </div>
        </div>

        {/* Xanh dương, không phải đỏ: tiền bị giữ chưa mất. Tô đỏ khiến KTV
            tưởng đã bị trừ; tô xanh lá thì không nói được là chưa tiêu được. */}
        <div className="rounded-xl border border-info-bd bg-info-bg p-5">
          <div className="text-label uppercase text-info-fg">Đang giữ</div>
          <div className="tabular mt-2 font-mono text-2xl font-medium text-info-fg">
            {formatVnd(wallet.held, 'vi')}
          </div>
          <div className="mt-1.5 text-body-l leading-[21px] text-ink-700">
            Giữ cho lần mua chưa chốt. Tự hoàn lại nếu không giành được slot.
          </div>
        </div>
      </div>

      <section className="mt-6">
        <TopUpForm />
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-h3 text-ink-900">Sổ giao dịch</h2>
          {ledger.total > 0 && (
            <span className="text-body text-ink-600">
              Hiển thị {ledger.items.length} trên {ledger.total} giao dịch
            </span>
          )}
        </div>

        {ledger.items.length === 0 ? (
          <p className="mt-3.5 rounded-xl border border-ink-200 bg-white px-5 py-8 text-center text-body-l text-ink-600">
            Chưa có giao dịch nào. Nạp tiền để bắt đầu mua gói đẩy tin.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-body text-ink-600">
              Cột số dư sau cho biết ví còn bao nhiêu ngay sau từng giao dịch, để đối chiếu được
              tới đúng dòng khi thấy lệch.
            </p>

            <div className="mt-3.5 overflow-x-auto rounded-xl border border-ink-200 bg-white">
              <table className="w-full text-body-l">
                <thead>
                  <tr className="border-b border-ink-200 bg-brand-50 text-left text-ink-600">
                    <th className="px-[18px] py-2.5 text-label uppercase">Thời gian</th>
                    <th className="px-[18px] py-2.5 text-label uppercase">Nội dung</th>
                    <th className="px-[18px] py-2.5 text-right text-label uppercase">Số tiền</th>
                    <th className="px-[18px] py-2.5 text-right text-label uppercase">Số dư sau</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.items.map((t) => {
                    const detail = context(t.campaignId);
                    return (
                      <tr key={t.id} className="border-b border-ink-100 last:border-0">
                        <td className="whitespace-nowrap px-[18px] py-3.5 text-ink-600">
                          {formatDateTime(t.createdAt, 'vi')}
                        </td>
                        <td className="px-[18px] py-3.5 text-ink-900">
                          {transactionLabel(t.type)}
                          {detail && <span className="text-ink-500"> · {detail}</span>}
                        </td>
                        {/* Màu trạng thái, không phải màu thương hiệu: tiền vào/ra
                            là thông tin cần đọc lướt được, và brand-600 đang mang
                            nghĩa "link/hành động" ở khắp nơi khác. */}
                        <td
                          className={`tabular whitespace-nowrap px-[18px] py-3.5 text-right font-mono ${
                            t.amount < 0 ? 'text-danger-fg' : 'text-success-fg'
                          }`}
                        >
                          {t.amount > 0 ? '+' : ''}
                          {formatVnd(t.amount, 'vi')}
                        </td>
                        <td className="tabular whitespace-nowrap px-[18px] py-3.5 text-right font-mono text-ink-600">
                          {formatVnd(t.balanceAfter, 'vi')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}
