import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { KtvAnnouncement } from '@/components/KtvAnnouncement';
import { SiteLogo } from '@/components/SiteLogo';
import { LogoutButton } from '@/components/LogoutButton';
import { fontVariables } from '@/lib/fonts';
import {
  UnauthenticatedError,
  authFetch,
  authFetchOrNull,
  getSessionRole,
  getSessionToken,
} from '@/lib/session';
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
  if (!getSessionToken()) redirect('/dang-nhap?next=/dashboard');

  // Tài khoản khách đăng nhập rồi vẫn không có dashboard — nhưng phải nói ra chứ
  // không đá về trang đăng nhập. Đá về thì họ đăng nhập lại thành công rồi bị đá
  // tiếp, thành vòng lặp không lối thoát; và với người vừa đăng nhập đúng thì màn
  // hình đăng nhập hiện lần nữa đọc như "sai mật khẩu" chứ không như "nhầm cửa".
  //
  // Đây chỉ là điều hướng. Dữ liệu vẫn được backend bảo vệ ở từng lời gọi API bên
  // dưới — `getSessionRole` đọc JWT không kiểm chữ ký nên tự nó không cấp quyền gì.
  if (getSessionRole() === 'CUSTOMER') {
    return (
      <Shell>
        <CustomerNotice />
      </Shell>
    );
  }

  // Số dư và số chiến dịch hiện ngay trên thanh điều hướng, nên phải lấy ở layout.
  // Lỗi ở đây **không** được làm hỏng cả trang con: nếu API ví chập chờn thì KTV vẫn
  // phải vào được trang hồ sơ. Thiếu số thì nhãn trống, không phải màn hình lỗi.
  let wallet: WalletBalance | null = null;
  let campaigns: Campaign[] = [];
  let hasProfile = true;

  try {
    let profile: unknown;
    [wallet, campaigns, profile] = await Promise.all([
      authFetch<WalletBalance>('/wallet/balance'),
      authFetch<Campaign[]>('/ktv/campaigns'),
      // 404 → null khi tài khoản chưa tạo hồ sơ.
      authFetchOrNull<unknown>('/ktv/profile/me'),
    ]);
    hasProfile = profile !== null;
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    // Các lỗi khác nuốt có chủ ý — xem ghi chú ngay trên. `hasProfile` giữ `true`:
    // API hỏng thì cho đi tiếp, chứ không nhốt KTV đã có hồ sơ vào trang tạo hồ sơ.
  }

  const running = campaigns.filter((c) => c.isRunning).length;

  return (
    <Shell>
    {/* Sidebar cố định 248px như artboard. Ở mobile đổi thành một khối xếp trên nội
        dung: 248px chiếm gần hết bề ngang điện thoại, giữ nguyên là không còn chỗ cho
        chính thứ khách vào đây để xem. */}
    <div className="grid min-h-screen bg-brand-50 lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Ở mobile thanh này dính đỉnh: khi menu gập lại nó chỉ cao một hàng, mà đó
          cũng là chỗ duy nhất còn nói cho KTV biết mình đang ở trang nào. Desktop
          bỏ `sticky` vì sidebar vốn đã đứng yên cạnh nội dung. */}
      <aside className="sticky top-0 z-30 border-b border-ink-200 bg-white px-4 py-3 lg:static lg:border-b-0 lg:border-r lg:py-5">
        {/* Chỉ còn là dòng tiêu đề riêng ở desktop. Ở mobile logo lùi về làm dấu
            nhận diện nhỏ cạnh nút menu — một hàng chữ "Bảng điều khiển" chiếm trọn
            bề ngang điện thoại chỉ để nhắc lại thứ KTV vừa chủ động mở. */}
        {/* Xếp DỌC, không phải cùng hàng: bản logo ngang tỉ lệ ~5.64:1 rộng ~136px ở
            `h-6`, mà sidebar chỉ 248px trừ padding — đặt nhãn cạnh nó thì "Bảng điều
            khiển" bị ép xuống ba dòng ("Bảng / điều / khiển"). Đã thấy trong trình
            duyệt thật trước khi đổi. */}
        <div className="hidden px-2 pb-5 lg:block">
          <SiteLogo alt="MasGo" className="h-6 w-auto" />
          <span className="mt-2 block font-display text-body-l font-bold text-ink-900">
            Bảng điều khiển
          </span>
        </div>

        {/* `items-start`, không phải `items-center`: khi menu mở ra, nav cao lên vài
            trăm px và logo canh giữa sẽ trôi xuống lơ lửng giữa danh sách. Nó phải
            đứng yên ngang hàng với nút menu — đó là hàng duy nhất tồn tại khi gập. */}
        <div className="flex items-start gap-2 lg:block">
          <SiteLogo alt="MasGo" className="mt-2.5 h-6 w-auto shrink-0 lg:hidden" />

          <div className="min-w-0 flex-1 lg:flex-none">
            <DashboardNav
              balanceLabel={wallet ? formatVndShort(wallet.available, 'vi') : ''}
              runningCount={running}
              hasProfile={hasProfile}
            />
          </div>
        </div>

        {/* `hidden lg:block` — ở mobile hai lối này nằm trong nhóm gập cùng menu
            (xem `DashboardNav`), nên bản ngoài chỉ dành cho desktop. Để cả hai cùng
            hiện là "Đăng xuất" xuất hiện hai lần trên cùng màn hình. */}
        <div className="mt-6 hidden border-t border-ink-100 px-3 pt-4 lg:block">
          {/* Link về trang công khai: KTV thường muốn kiểm tra hồ sơ mình đang trông
              thế nào với khách, và không có đường nào khác từ trong dashboard. */}
          <Link
            href="/"
            className="block text-body text-ink-600 transition hover:text-brand-600"
          >
            Về trang chủ
          </Link>
          <div className="mt-2.5">
            <LogoutButton labels={{ logout: 'Đăng xuất', loggingOut: 'Đang thoát…' }} />
          </div>
        </div>
      </aside>

      <main className="px-4 py-7 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-[1000px]">{children}</div>
      </main>
    </div>

    {/* Đặt ở layout chứ không ở từng page: KTV vào dashboard qua nhiều đường (trang
        tổng quan, link sâu tới /dashboard/goi, quay lại từ trang công khai), gắn ở
        một page là bỏ sót đúng những lối vào khác.

        Nằm **sau** nhánh CUSTOMER phía trên nên tài khoản khách không bao giờ thấy —
        thông báo này nói về phí duy trì hồ sơ KTV, hiện cho khách là vô nghĩa.

        Tự nó quyết định có hiện hay không (đọc localStorage trong effect), nên ở đây
        không có điều kiện nào — thêm một điều kiện phía server là dựng nguồn sự thật
        thứ hai cho cùng một câu hỏi. */}
    <KtvAnnouncement />
    </Shell>
  );
}

/**
 * `<html>`/`<body>` cho cây `/dashboard`.
 *
 * **Bắt buộc, và đây là lỗi đã cắn**: root layout cố ý trả `children` trần để
 * `lang` theo được ngôn ngữ trang mà không giết ISR (xem `app/layout.tsx`), nên
 * `<html>` do `[locale]/layout.tsx` render. Nhưng `/dashboard` nằm **ngoài**
 * `[locale]` — cố ý, vì nó chỉ có tiếng Việt — nên cây route này không có `<html>`
 * ở bất kỳ đâu. Next chèn một khung rỗng thay thế, HTML server trả về **không có
 * thẻ `<html>`**, React hydrate lệch (lỗi #418) rồi xoá sạch DOM: trang trắng
 * hoàn toàn, không phải màn hình lỗi.
 *
 * Vì sao khó thấy: build vẫn xanh, `curl` vẫn trả HTTP 200 với ~36KB nội dung
 * thật, và chỉ trình duyệt mới trắng. Kiểm bằng `curl ... | grep '<html'` — có
 * thẻ và có `lang` thì đúng.
 *
 * `lang="vi"` ghi cứng: dashboard không có bản tiếng Anh.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}

/**
 * Màn hình cho tài khoản khách lỡ mở `/dashboard`.
 *
 * Cho hai lối ra thay vì một: người vào nhầm chỉ muốn quay về trang chủ, còn người
 * thật sự định làm kỹ thuật viên thì cần biết phải đi đâu. Không tự đăng xuất giúp
 * họ — mất phiên là mất luôn quyền viết đánh giá mà họ vừa đăng nhập để làm.
 */
function CustomerNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-5 py-12">
      <div className="w-full max-w-[440px] rounded-xl border border-ink-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2.5">
          <SiteLogo alt="MasGo" className="h-6 w-auto shrink-0" />
          <span className="font-display text-body-l font-bold text-ink-900">Bảng điều khiển</span>
        </div>

        <h1 className="mt-5 text-h2 text-ink-900">Tài khoản này là tài khoản khách</h1>
        <p className="mt-2 text-body-l leading-[25px] text-ink-600">
          Bảng điều khiển dành cho kỹ thuật viên nhận khách. Tài khoản khách dùng để viết đánh giá —
          bạn không cần đăng nhập để tìm và gọi kỹ thuật viên.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/"
            className="rounded-full bg-brand-500 px-5 py-2.5 text-body font-semibold text-white shadow-button transition hover:bg-brand-600"
          >
            Về trang chủ
          </Link>
          <Link
            href="/dang-ky-ktv"
            className="rounded-full border border-brand-500 px-5 py-2.5 text-body font-semibold text-brand-600 transition hover:bg-brand-50"
          >
            Tôi là kỹ thuật viên
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-1.5 border-t border-ink-100 pt-4 text-body-s text-ink-500">
          <span>Đang dùng nhầm số điện thoại?</span>
          <LogoutButton labels={{ logout: 'Đăng xuất', loggingOut: 'Đang thoát…' }} />
        </div>
      </div>
    </div>
  );
}
