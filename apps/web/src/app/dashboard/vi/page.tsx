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
      <h1 className="text-2xl font-semibold">Ví</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="text-sm text-stone-500">Tổng số dư</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{formatVnd(wallet.balance)}</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="text-sm text-stone-500">Đang giữ</div>
          <div className="mt-1 text-xl font-semibold tabular-nums">{formatVnd(wallet.held)}</div>
          <div className="mt-1 text-xs text-stone-500">
            Nằm trong tổng số dư, chưa bị trừ — giữ cho lần mua chưa chốt.
          </div>
        </div>
        <div className="rounded-lg border border-brand-500 bg-brand-50 p-4">
          <div className="text-sm text-brand-700">Dùng được</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-brand-700">
            {formatVnd(wallet.available)}
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Nạp tiền</h2>
        <div className="mt-3">
          <TopUpForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Sổ giao dịch</h2>
        <p className="mt-1 text-sm text-stone-500">
          Cột số dư sau cho biết ví còn bao nhiêu ngay sau từng giao dịch, để đối chiếu được tới
          đúng dòng khi thấy lệch.
        </p>

        {ledger.items.length === 0 ? (
          <p className="mt-4 text-stone-600">Chưa có giao dịch nào.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-stone-500">
                  <th className="px-4 py-2 font-medium">Thời gian</th>
                  <th className="px-4 py-2 font-medium">Nội dung</th>
                  <th className="px-4 py-2 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-2 text-right font-medium">Số dư sau</th>
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((t) => (
                  <tr key={t.id} className="border-b border-stone-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-stone-600">
                      {new Date(t.createdAt).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-2">{transactionLabel(t.type)}</td>
                    <td
                      className={`whitespace-nowrap px-4 py-2 text-right tabular-nums ${
                        t.amount < 0 ? 'text-stone-900' : 'text-brand-600'
                      }`}
                    >
                      {t.amount > 0 ? '+' : ''}
                      {formatVnd(t.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-stone-600">
                      {formatVnd(t.balanceAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ledger.total > ledger.items.length && (
          <p className="mt-3 text-sm text-stone-500">
            Hiển thị {ledger.items.length} trên tổng {ledger.total} giao dịch.
          </p>
        )}
      </section>
    </>
  );
}
