/**
 * Icon cho từng dịch vụ, tra theo `ServiceItem.slug`.
 *
 * Vẽ inline thay vì import `lucide-react`: đây là server component nằm trên
 * trang public, kéo cả thư viện icon vào bundle chỉ để dùng 10 hình là đánh đổi
 * sai — LCP của trang khu vực là chỉ số xếp hạng.
 *
 * Slug lạ (dịch vụ mới seed sau) rơi về icon mặc định thay vì vỡ layout, nên
 * thêm dịch vụ ở backend không bao giờ làm hỏng frontend.
 *
 * Nguyên tắc chọn hình: mô tả **bộ phận cơ thể hoặc kỹ thuật**, không mô tả cảm
 * giác. Định vị là y học cổ truyền và phục hồi chức năng, nên tuyệt đối không
 * dùng hình thân người, nến, hay hoa.
 */
const PATHS: Record<string, React.ReactNode> = {
  // Trị liệu chung — bàn tay tác động
  'massage-tri-lieu': (
    <>
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-1a1.5 1.5 0 0 1 3 0" />
    </>
  ),
  // Cổ vai gáy — đốt sống cổ
  'massage-co-vai-gay': (
    <>
      <path d="M12 3v5M9 5.5h6" />
      <path d="M5 12h14" />
      <path d="M7 12a5 5 0 0 0 5 5 5 5 0 0 0 5-5" />
      <path d="M12 17v4" />
    </>
  ),
  // Bấm huyệt — điểm huyệt chính xác
  'bam-huyet': (
    <>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </>
  ),
  // Massage Thái — kéo giãn
  'massage-thai': (
    <>
      <path d="M4 20 20 4" />
      <path d="M4 12v8h8" />
      <path d="M20 12V4h-8" />
    </>
  ),
  // Toàn thân
  'massage-body': (
    <>
      <path d="M12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9 9 9 0 0 0-9 9 9 9 0 0 0 9 9z" />
      <path d="M8 12a4 4 0 0 1 8 0M8 12a4 4 0 0 0 8 0" />
    </>
  ),
  // Chân — bàn chân
  'massage-chan': (
    <>
      <path d="M7 21V10a4 4 0 0 1 8 0v3h1a3 3 0 0 1 0 6h-1v2" />
      <path d="M7 14h8" />
    </>
  ),
  // Bà bầu — nhẹ, trung tính, không có hình thân người
  'massage-ba-bau': (
    <>
      <path d="M12 21c4.5-3 8-6.5 8-11a8 8 0 0 0-16 0c0 4.5 3.5 8 8 11z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  // Cột sống
  'tri-lieu-cot-song': (
    <>
      <path d="M12 2v20" />
      <path d="M8 5h8M8 9h8M8 13h8M8 17h8" />
    </>
  ),
  // Giác hơi — cốc giác
  'giac-hoi': (
    <>
      <path d="M6 4h12l-1.5 11a4.5 4.5 0 0 1-9 0L6 4z" />
      <path d="M9 20h6" />
    </>
  ),
  // Xông hơi thảo dược — hơi nóng bốc lên
  'xong-hoi-thao-duoc': (
    <>
      <path d="M4 20v-5a8 8 0 0 1 16 0v5" />
      <path d="M2 20h20" />
      <path d="M9 8c0-1.5 1-2 1.5-3M14 8c0-1.5-1-2-1.5-3" />
    </>
  ),
};

const FALLBACK = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </>
);

export function ServiceIcon({ slug, className }: { slug: string; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[slug] ?? FALLBACK}
    </svg>
  );
}
