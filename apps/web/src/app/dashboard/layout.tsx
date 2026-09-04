import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { LogoMark } from '@/components/icons';
import { LogoutButton } from '@/components/LogoutButton';
import { UnauthenticatedError, authFetch, getSessionToken } from '@/lib/session';
import { formatVndShort } from '@/lib/site';
import type { Campaign, WalletBalance } from '@/lib/types';

export const metadata: Metadata = {
  title: { default: 'Bảng điều khiển', template: '%s | Bảng điều khiển' },
  // Ngoài robots.txt còn đặt thẻ ở đây: robots.txt chỉ ngăn crawl, không ngăn
  // index nếu có trang khác trỏ tới. Thẻ noindex mới thật sự giữ dashboard ra
  // ngoài kết quả tìm kiếm.
  robots: { index: false, follow: false },
};

// Số dư và campaign là dữ liệu riêng của từng người, không được cache dùng chung.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Chặn ngay ở layout thay vì ở từng trang: thiếu một chỗ là lộ dữ liệu ở chỗ đó.
  if (!getSessionToken()) redirect('/dang-nhap');

  // Số dư và số chiến dịch hiện ngay trên thanh điều hướng, nên phải lấy ở layout.
  // Lỗi ở đây **không** được làm hỏng cả trang con: nếu API ví chập chờn thì KTV vẫn
  // phải vào được trang hồ sơ. Thiếu số thì nhãn trống, không phải màn hình lỗi.
  let wallet: WalletBalance | null = null;
  let campaigns: Campaign[] = [];

  try {
    [wallet, campaigns] = await Promise.all([
      authFetch<WalletBalance>('/wallet/balance'),
      authFetch<Campaign[]>('/ktv/campaigns'),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    // Các lỗi khác nuốt có chủ ý — xem ghi chú ngay trên.
  }

  const running = campaigns.filter((c) => c.isRunning).length;

  return (
    // Sidebar cố định 248px như artboard. Ở mobile đổi thành một khối xếp trên nội
    // dung: 248px chiếm gần hết bề ngang điện thoại, giữ nguyên là không còn chỗ cho
    // chính thứ khách vào đây để xem.
    <div className="grid min-h-screen bg-brand-50 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-ink-200 bg-white px-4 py-5 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <LogoMark className="h-7 w-7 shrink-0" />
          <span className="font-display text-body-l font-bold text-ink-900">Bảng điều khiển</span>
        </div>

        <DashboardNav
          balanceLabel={wallet ? formatVndShort(wallet.available) : ''}
          runningCount={running}
        />

        <div className="mt-6 border-t border-ink-100 px-3 pt-4">
          {/* Link về trang công khai: KTV thường muốn kiểm tra hồ sơ mình đang trông
              thế nào với khách, và không có đường nào khác từ trong dashboard. */}
          <Link
            href="/"
            className="block text-body text-ink-600 transition hover:text-brand-600"
          >
            Về trang chủ
          </Link>
          <div className="mt-2.5">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <main className="px-4 py-7 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-[1000px]">{children}</div>
      </main>
    </div>
  );
}
