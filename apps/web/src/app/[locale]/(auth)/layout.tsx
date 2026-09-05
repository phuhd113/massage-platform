/**
 * Nhóm route đăng nhập — không có header/footer.
 *
 * Màn đăng nhập trong thiết kế chiếm trọn màn hình và chia hai cột. Thêm khung trang
 * công khai lên trên là mời người đang muốn đăng nhập đi chỗ khác, ngay tại bước họ
 * đã quyết định xong. Nhóm `(auth)` không đi vào URL nên `/dang-nhap` giữ nguyên.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
