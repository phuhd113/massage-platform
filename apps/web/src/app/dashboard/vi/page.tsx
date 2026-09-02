import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { TopUpForm } from '@/components/TopUpForm';
import { transactionLabel } from '@/lib/labels';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatVnd } from '@/lib/site';
import type { WalletBalance, WalletTransactionList } from '@/lib/types';

export const metadata: Metadata = { title: 'Ví' };

export default async function WalletPage() {
  let wallet: WalletBalance;
  let ledger: WalletTransactionList;

  try {
    [wallet, ledger] = await Promise.all([
      authFetch<WalletBalance>('/wallet/balance'),
      authFetch<WalletTransactionList>('/wallet/transactions?page=1&size=50'),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900">Ví</h1>

      {/* "Dùng được" đứng đầu và to nhất vì nó trả lời đúng câu hỏi KTV đang
          hỏi: mua được gói nào bây giờ. Nếu tổng số dư nổi bật hơn, KTV nhìn
          thấy 1.750.000₫ rồi bị từ chối mua gói 1.500.000₫ — trải nghiệm đó đọc
          như lỗi hệ thống và thành ticket, dù ví hoạt động hoàn toàn đúng. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-brand-300 bg-brand-50 p-4 shadow-card">
          <div className="text-label uppercase text-brand-700">Dùng được</div>
          <div className="tabular mt-1 font-display text-2xl font-bold text-brand-700">
            {formatVnd(wallet.available)}
          </div>
          <div className="mt-1 text-caption text-ink-600">
            Số mua được gói ngay bây giờ.
          </div>
        </div>

        <div className="rounded-lg border border-ink-200 bg-white p-4 shadow-card">
          <div className="text-label uppercase text-ink-500">Tổng số dư</div>
          <div className="tabular mt-1 font-display text-xl font-semibold text-ink-900">
            {formatVnd(wallet.balance)}
          </div>
          <div className="mt-1 text-caption text-ink-600">
            Tổng sở hữu, đã gồm cả phần đang giữ.
          </div>
        </div>

        {/* Xanh dương, không phải đỏ: tiền bị giữ chưa mất. Tô đỏ khiến KTV
            tưởng đã bị trừ; tô xanh lá thì không nói được là chưa tiêu được. */}
        <div className="rounded-lg border border-info-bd bg-info-bg p-4 shadow-card">
          <div className="text-label uppercase text-info-fg">Đang giữ</div>
          <div className="tabular mt-1 font-display text-xl font-semibold text-info-fg">
            {formatVnd(wallet.held)}
          </div>
          <div className="mt-1 text-caption text-ink-600">
            Giữ cho lần mua chưa chốt. Tự hoàn lại nếu không giành được slot.
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-h2 text-ink-900">Nạp tiền</h2>
        <div className="mt-3">
          <TopUpForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-h2 text-ink-900">Sổ giao dịch</h2>
        <p className="mt-1 text-sm text-ink-500">
          Cột số dư sau cho biết ví còn bao nhiêu ngay sau từng giao dịch, để đối chiếu được tới
          đúng dòng khi thấy lệch.
        </p>

        {ledger.items.length === 0 ? (
          <p className="mt-4 text-ink-600">Chưa có giao dịch nào.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-ink-200 bg-white shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-ink-500">
                  <th className="px-4 py-2 font-medium">Thời gian</th>
                  <th className="px-4 py-2 font-medium">Nội dung</th>
                  <th className="px-4 py-2 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-2 text-right font-medium">Số dư sau</th>
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((t) => (
                  <tr key={t.id} className="border-b border-ink-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-ink-600">
                      {new Date(t.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-2">{transactionLabel(t.type)}</td>
                    {/* Màu trạng thái, không phải màu thương hiệu: tiền vào/ra
                        là thông tin cần đọc lướt được, và brand-600 đang mang
                        nghĩa "link/hành động" ở khắp nơi khác. */}
                    <td
                      className={`tabular whitespace-nowrap px-4 py-2 text-right ${
                        t.amount < 0 ? 'text-danger-fg' : 'text-success-fg'
                      }`}
                    >
                      {t.amount > 0 ? '+' : ''}
                      {formatVnd(t.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-ink-600">
                      {formatVnd(t.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ledger.total > ledger.items.length && (
          <p className="mt-3 text-sm text-ink-500">
            Hiển thị {ledger.items.length} trên tổng {ledger.total} giao dịch.
          </p>
        )}
      </section>
    </>
  );
}
