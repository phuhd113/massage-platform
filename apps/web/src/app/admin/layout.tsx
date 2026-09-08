import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminNav } from '@/components/AdminNav';
import { LogoMark } from '@/components/icons';
import { LogoutButton } from '@/components/LogoutButton';
import { fontVariables } from '@/lib/fonts';
import { getSessionRole, getSessionToken } from '@/lib/session';

export const metadata: Metadata = {
  title: { default: 'Quản trị', template: '%s | Quản trị' },
  // Như dashboard: robots.txt chỉ ngăn crawl chứ không ngăn index nếu có trang
  // khác trỏ tới. Thẻ noindex mới thật sự giữ khu quản trị ra ngoài kết quả.
  robots: { index: false, follow: false },
};

// Hàng đợi duyệt đổi sau mỗi thao tác và chỉ một nhóm rất nhỏ người xem —
// cache ở đây chỉ tạo ra cảnh admin duyệt xong vẫn thấy hồ sơ nằm nguyên chỗ cũ.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!getSessionToken()) redirect('/dang-nhap?next=/admin/duyet-ktv');

  // Phân biệt "chưa đăng nhập" với "đã đăng nhập nhưng không phải admin", đúng lý
  // do dashboard phải phân biệt: đá tài khoản thường về trang đăng nhập thì họ
  // đăng nhập lại thành công rồi bị đá tiếp, thành vòng lặp không lối thoát.
  //
  // Đây chỉ là điều hướng. `getSessionRole` đọc payload JWT **không kiểm chữ ký**,
  // nên nó không cấp quyền gì: mọi lời gọi `/admin/*` bên dưới vẫn do backend kiểm
  // với `[Authorize(Roles = ADMIN)]` trên chữ ký thật.
  if (getSessionRole() !== 'ADMIN') {
    return (
      <Shell>
        <NotAdminNotice />
      </Shell>
    );
  }

  return (
    <Shell>
    <div className="grid min-h-screen bg-brand-50 lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-ink-200 bg-white px-4 py-5 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2.5 px-2 pb-5">
          <LogoMark className="h-7 w-7 shrink-0" />
          <span className="font-display text-body-l font-bold text-ink-900">Quản trị</span>
        </div>

        <AdminNav />

        <div className="mt-6 border-t border-ink-100 px-3 pt-4">
          <Link href="/" className="block text-body text-ink-600 transition hover:text-brand-600">
            Về trang chủ
          </Link>
          <div className="mt-2.5">
            <LogoutButton labels={{ logout: 'Đăng xuất', loggingOut: 'Đang thoát…' }} />
          </div>
        </div>
      </aside>

      {/*
        `min-w-0` là bắt buộc, không phải trang trí: grid item mặc định có
        `min-width: auto`, nghĩa là nó **nở ra theo nội dung rộng nhất bên trong**
        thay vì ép nội dung đó cuộn. Thiếu nó thì một bảng `min-w-[540px]` nằm trong
        `overflow-x-auto` vẫn kéo cả cột chính rộng ra, và **cả trang** cuộn ngang ở
        390px — đúng thứ mà `overflow-x-auto` sinh ra để tránh. Đã đo: trang 574px
        trên viewport 375px, trong khi khung cuộn của bảng lại không hề cuộn.
      */}
      <main className="min-w-0 px-4 py-7 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-[1000px]">{children}</div>
      </main>
    </div>
    </Shell>
  );
}

/**
 * `<html>`/`<body>` cho cây `/admin` — cùng lý do với `/dashboard`, xem ghi chú
 * đầy đủ ở `app/dashboard/layout.tsx`. Tóm tắt: root layout cố ý không render
 * `<html>` (để `lang` theo được locale mà không giết ISR), `[locale]/layout.tsx`
 * làm việc đó, và `/admin` nằm ngoài `[locale]` nên phải tự lo. Thiếu thì trang
 * trắng hoàn toàn trong trình duyệt trong khi `curl` vẫn thấy 200 kèm nội dung.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}

/** Màn hình cho tài khoản thường lỡ mở `/admin`. */
function NotAdminNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-5 py-12">
      <div className="w-full max-w-[440px] rounded-xl border border-ink-200 bg-white p-6 shadow-card">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-7 w-7 shrink-0" />
          <span className="font-display text-body-l font-bold text-ink-900">Quản trị</span>
        </div>

        <h1 className="mt-5 text-h2 text-ink-900">Khu vực này dành cho quản trị viên</h1>
        <p className="mt-2 text-body-l leading-[25px] text-ink-600">
          Tài khoản của bạn không có quyền duyệt hồ sơ. Nếu bạn là kỹ thuật viên, mọi thao tác với
          hồ sơ của mình nằm ở bảng điều khiển.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link
            href="/"
            className="rounded-full bg-brand-500 px-5 py-2.5 text-body font-semibold text-white shadow-button transition hover:bg-brand-600"
          >
            Về trang chủ
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-brand-500 px-5 py-2.5 text-body font-semibold text-brand-600 transition hover:bg-brand-50"
          >
            Bảng điều khiển
          </Link>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-1.5 border-t border-ink-100 pt-4 text-body-s text-ink-500">
          <span>Đang dùng nhầm tài khoản?</span>
          <LogoutButton labels={{ logout: 'Đăng xuất', loggingOut: 'Đang thoát…' }} />
        </div>
      </div>
    </div>
  );
}
