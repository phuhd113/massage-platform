import { PublicShell } from '@/components/PublicShell';
import { normalizeLocale } from '@/i18n/config';

/**
 * Nhóm route công khai — mọi trang khách nhìn thấy.
 *
 * Tồn tại để tách khỏi /dashboard: bảng điều khiển có khung riêng (sidebar) và
 * không dùng header/footer của trang bán hàng. Route group `(public)` không đi vào
 * URL, nên đường dẫn của mọi trang giữ nguyên như trước.
 */
export default function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return <PublicShell locale={normalizeLocale(params.locale)}>{children}</PublicShell>;
}
