import { ACCENT, iconStrokeWidth } from './icon-tokens';

/**
 * Icon giao diện của bộ "Huyệt" (nguồn: `design/Bo icon Huyet - standalone.html`).
 *
 * Vẽ inline, không dùng `lucide-react` — lý do đầy đủ ở `ServiceIcon.tsx`.
 *
 * Khác nhóm dịch vụ, icon giao diện **trung tính một màu**: nút, bộ lọc, điều
 * hướng và huy hiệu tin cậy không được cạnh tranh với nội dung. Ngoại lệ duy
 * nhất là `NearMeIcon`, nơi điểm vàng chính là tâm ống ngắm. Đừng thêm điểm
 * vàng vào icon giao diện thứ hai.
 *
 * Màu lấy theo `currentColor`, nên đổi màu bằng class `text-*` ở chỗ gọi.
 */
export type IconProps = {
  className?: string;
  /** Dùng để suy ra độ dày nét — xem `iconStrokeWidth`. */
  size?: number;
};

function Icon({ className, size = 24, children }: IconProps & { children: React.ReactNode }) {
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
      {children}
    </svg>
  );
}

// Tìm kiếm
export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </Icon>
  );
}

// Bộ lọc
export function FilterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M7 12h10M10 17h4" />
    </Icon>
  );
}

// Khu vực
export function AreaIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21c4-3.4 7-6.6 7-10.2A7 7 0 0 0 12 3.8a7 7 0 0 0-7 7C5 14.4 8 17.6 12 21z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </Icon>
  );
}

// Gần tôi
export function NearMeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="1.7" fill={ACCENT} stroke="none" />
    </Icon>
  );
}

// Gói dịch vụ
export function PackageIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6.5 12 12l8-5.5" />
      <path d="M12 12v9" />
      <path d="M4 6.5 12 3l8 3.5v11L12 21l-8-3.5v-11z" />
    </Icon>
  );
}

// Ví
export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 8.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9z" />
      <path d="M3.5 11h17" />
      <path d="M16.5 15h1.5" />
    </Icon>
  );
}

// Nạp tiền
export function TopUpIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 4h5a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-5" />
      <path d="M6.5 4v16" />
      <path d="M4 8h6M4 12h6" />
      <path d="M17.5 13.5 20 20" />
    </Icon>
  );
}

// Lượt xem
export function ViewsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20V13M9.5 20V8M15 20v-5M20.5 20V4" />
    </Icon>
  );
}

// Lượt bấm
export function ClicksIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3.5 5 17l3.5-3.2 2.2 5.3 2.6-1.1-2.2-5.2 4.9-.4L5 3.5z" />
    </Icon>
  );
}

// Zalo
export function ZaloIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 4.5h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5l-4 3v-3H7a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" />
      <path d="M9 9h6M9 12.5h4" />
    </Icon>
  );
}

// Gọi
export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 3.5 10 8.5l-2 1.8a11 11 0 0 0 5.7 5.7l1.8-2 5 2.5-1 3.5a15.5 15.5 0 0 1-13-13l3.5-1z" />
    </Icon>
  );
}

// Giờ nhận khách
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

// Lịch chiến dịch
export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-11z" />
      <path d="M4.5 9.5h15M8.5 3v3M15.5 3v3" />
    </Icon>
  );
}

// Chứng chỉ đã duyệt
export function CertifiedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 4.5 6.5v5.2c0 4.3 3 8.1 7.5 9.3 4.5-1.2 7.5-5 7.5-9.3V6.5L12 3.5z" />
      <path d="M8.8 12.2 11.2 14.6 15.5 10" />
    </Icon>
  );
}

// Định danh KTV
export function VerifiedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 6.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11z" />
      <circle cx="9" cy="10.5" r="2.2" />
      <path d="M5.5 16.5a3.8 3.8 0 0 1 7 0M14.5 9.5h3.5M14.5 13h2.5" />
    </Icon>
  );
}

// Đánh giá
export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 14.6 9l6 .8-4.3 4.2 1 6-5.3-2.9-5.3 2.9 1-6L3.4 9.8 9.4 9 12 3.5z" />
    </Icon>
  );
}

// Lưu KTV
export function BookmarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.5h12v17l-6-3.6-6 3.6v-17z" />
    </Icon>
  );
}

// Hoàn tất
export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12.5 9 17.5 20 6.5" />
    </Icon>
  );
}

/**
 * Dấu nhận diện của sàn.
 *
 * Dùng đúng ngữ pháp của bộ icon: đốt sống cổ, vòm vai, điểm huyệt vàng ở tâm —
 * cùng hình với `massage-co-vai-gay`, nên logo và icon dịch vụ đọc ra là một họ.
 *
 * Khác mọi icon còn lại, đây **không** theo `currentColor`: nền xanh và nét trắng
 * là màu cố định của thương hiệu. Đặt nó lên nền xanh khác sẽ mất tương phản, nên
 * để nguyên khung bo tròn thay vì bỏ nền đi.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <rect x="1" y="1" width="46" height="46" rx="13" fill="#0e5aa7" />
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M24 10v10M18 14h12" />
        <path d="M13 24h22" />
        <path d="M16 24a8 8 0 0 0 16 0" />
      </g>
      <circle cx="24" cy="24" r="3.4" fill="#e3b04b" />
    </svg>
  );
}
