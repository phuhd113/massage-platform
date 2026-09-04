import { ACCENT, iconStrokeWidth } from './icon-tokens';

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
 * Hình lấy từ bộ icon "Huyệt" (`design/Bo icon Huyet - standalone.html`).
 * Nguyên tắc chọn hình: mô tả **bộ phận cơ thể hoặc kỹ thuật**, không mô tả cảm
 * giác. Định vị là y học cổ truyền và phục hồi chức năng, nên tuyệt đối không
 * dùng hình thân người, nến, hay hoa.
 *
 * Mỗi icon dịch vụ mang **đúng một** điểm huyệt vàng đặt tại chỗ bàn tay tác
 * động — đó là dấu nhận diện của sản phẩm. Hai điểm trong một hình làm mất
 * trọng tâm và trông như lỗi vẽ, nên đừng thêm.
 */
const PATHS: Record<string, React.ReactNode> = {
  'massage-tri-lieu': (
    <>
      <path d="M8 12.5V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M11 10.5v-1a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6 6 6 0 0 1-6-6v-1a1.5 1.5 0 0 1 3 0" />
      <circle cx="11" cy="15.5" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'massage-co-vai-gay': (
    <>
      <path d="M12 3v6M9 5.5h6" />
      <path d="M5 12h14" />
      <path d="M7 12a5 5 0 0 0 10 0" />
      <path d="M12 17v4" />
      <circle cx="12" cy="12" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'bam-huyet': (
    <>
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" />
      <circle cx="12" cy="12" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'massage-thai': (
    <>
      <path d="M5 19 19 5" />
      <path d="M5 13.5V19h5.5" />
      <path d="M19 10.5V5h-5.5" />
      <circle cx="12" cy="12" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'giac-hoi': (
    <>
      <path d="M9 3.5h6l-1 5.5h-4L9 3.5z" />
      <path d="M10 9h4l1.5 8a3.5 3.5 0 0 1-7 0L10 9z" />
      <path d="M8.5 20.5h7" />
      <circle cx="12" cy="14" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'tri-lieu-cot-song': (
    <>
      <path d="M12 3v18" />
      <path d="M8.5 5h7M8.5 9h7M8.5 13h7M8.5 17h7" />
      <circle cx="12" cy="13" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'massage-chan': (
    <>
      <path d="M7.5 21v-9.5a4.5 4.5 0 0 1 9 0V13h.5a3 3 0 0 1 0 6h-1.5v2" />
      <path d="M7.5 15h8" />
      <circle cx="11" cy="11" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'massage-body': (
    <>
      <path d="M4 8.5h16" />
      <path d="M6 8.5V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2.5" />
      <path d="M5.5 8.5 6.5 20h11l1-11.5" />
      <circle cx="12" cy="14" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'massage-ba-bau': (
    <>
      <path d="M4.5 14.5C4.5 8.7 8 5 12 5s7.5 3.7 7.5 9.5" />
      <path d="M8 14.5c0-3.3 1.8-5.5 4-5.5s4 2.2 4 5.5" />
      <path d="M4 17.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1z" />
      <circle cx="12" cy="12" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
  'xong-hoi-thao-duoc': (
    <>
      <path d="M4.5 20.5V16a7.5 7.5 0 0 1 15 0v4.5" />
      <path d="M2.5 20.5h19" />
      <path d="M10 9.5c0-1.6 1.2-2.1 1.2-3.5M14 9.5c0-1.6-1.2-2.1-1.2-3.5" />
      <circle cx="12" cy="16.5" r="1.7" fill={ACCENT} stroke="none" />
    </>
  ),
};

/** Dịch vụ mới seed ở backend chưa có hình: khung tròn trung tính, không điểm huyệt. */
const FALLBACK = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </>
);

export function ServiceIcon({
  slug,
  className,
  size = 24,
}: {
  slug: string;
  className?: string;
  /** Dùng để suy ra độ dày nét — xem `iconStrokeWidth`. */
  size?: number;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={iconStrokeWidth(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[slug] ?? FALLBACK}
    </svg>
  );
}
