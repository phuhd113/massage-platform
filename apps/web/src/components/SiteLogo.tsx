import Image from 'next/image';

import logoSrc from '../../public/masgo-logo.webp';
import markSrc from '../../public/masgo-mark.webp';

/**
 * Logo MasGo dạng ảnh, hai biến thể.
 *
 * **Cố ý KHÔNG dùng bản logo có tagline "CẦN MASSAGE? BẬT MASGO.VN".** Trong bộ
 * logo gốc, chữ "CẦN MASSAGE?" là chữ **trắng**: nó đọc tốt trên nền đen của
 * artboard, nhưng header của site là `bg-white/85` nên trên đó nó gần như tàng
 * hình — chỉ còn lại viền xám mờ. Đã dựng thử trên nền trắng thật trước khi chốt.
 * Tagline vẫn có mặt ở header dưới dạng **text thật** (`shell.logoTagline`), nên
 * không mất thông tin, và text thật thì đọc được bởi cả Google lẫn trình đọc màn
 * hình — thứ mà chữ nằm trong ảnh không bao giờ làm được.
 *
 * Import tĩnh chứ không phải chuỗi đường dẫn: Next đọc sẵn kích thước thật từ file
 * nên không có ca nào lệch tỉ lệ, và cùng lý do đã ghi cho ảnh hero — ảnh biên tập
 * của sàn là file tĩnh trong `public/`, không đi qua R2 và `MediaUrls`.
 *
 * `priority` để mặc định **tắt**: logo header nằm trong màn hình đầu nhưng nhẹ,
 * trong khi LCP element của trang chủ là ảnh hero. Bật ở đây là tranh băng thông
 * với chính ảnh đang giữ LCP — đúng lỗi đã ghi lại khi thay ảnh hero.
 */

/**
 * Logo ngang đầy đủ: phần hình + chữ "MasGo". Tỉ lệ ~5.64:1.
 *
 * `width`/`height` khai theo kích thước **hiển thị thật** (181x32 ở header) chứ
 * không để Next suy từ file gốc 1941x344 — nó là thứ quyết định tỉ lệ ô giữ chỗ,
 * nên khai sai là một lần layout shift ngay trên header dính.
 *
 * Thuộc tính `src` dự phòng vẫn trỏ `w=3840` và đó là **hành vi cố định của Next**
 * khi có `sizes`: nó luôn lấy phần tử cuối của `srcSet` làm fallback. Chỉ trình
 * duyệt không hiểu `srcSet` mới dùng tới nó (IE11 và tương đương), nên đã cân nhắc
 * và giữ nguyên. Cách duy nhất bỏ được là bỏ `sizes`, nhưng khi đó Next phát
 * `srcSet` theo `deviceSizes` (bắt đầu từ 640px) thay vì `imageSizes` nhỏ — đổi
 * một ca gần như tuyệt chủng lấy ảnh to hơn cho **mọi** trình duyệt hiện đại.
 *
 * `loading="eager"`: logo nằm trong màn hình đầu ở **mọi** trang công khai, nên
 * `lazy` (mặc định của Next) làm nó hiện muộn một nhịp ngay chỗ mắt nhìn đầu tiên.
 * Vẫn **không** đặt `priority` mặc định — xem ghi chú trên.
 */
export function SiteLogo({
  className,
  alt,
  priority = false,
}: {
  className?: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={181}
      height={32}
      className={className}
      priority={priority}
      loading={priority ? undefined : 'eager'}
      sizes="181px"
    />
  );
}

/**
 * Chỉ phần hình (hai người + sóng), nền trong suốt. Tỉ lệ ~1.31:1.
 *
 * Dành cho header ở mobile: ở 360px thanh header còn phải chứa nút vị trí (rộng
 * tới 9rem) và nút "Dành cho KTV", nên logo ngang 181px sẽ bóp cả hai. Bản này
 * rộng 52px ở chiều cao 40px (`h-10`).
 *
 * Cao hơn bản ngang một nấc là cố ý: tỉ lệ 1.31:1 cộng nét sóng mảnh khiến nó ở
 * 32px chỉ rộng 42px và nhạt gần như chìm vào nền trắng. Đã dựng thử ở 32/36/40px
 * trước khi chốt.
 *
 * `alt` mặc định là chuỗi rỗng vì ở `PublicShell` nó luôn đi kèm bản ngang trong
 * cùng một `<Link>`: một bản ẩn bằng CSS ở mỗi breakpoint, nhưng **cả hai đều nằm
 * trong DOM**, nên để cả hai cùng mang alt là bắt trình đọc màn hình đọc tên sàn hai
 * lần cho một liên kết.
 *
 * Nhưng ở dashboard, admin và ba màn đăng nhập nó đứng **một mình**, và ở đó `alt=""`
 * nghĩa là logo vô hình với trình đọc màn hình — nên những chỗ đó truyền `alt` thật.
 * Để mặc định là rỗng thay vì bắt buộc: chỗ dùng nhiều nhất (`PublicShell`) là chỗ
 * phải rỗng, và một prop bắt buộc ở đó sẽ mời người ta điền đại cho qua.
 */
export function SiteLogoMark({ className, alt = '' }: { className?: string; alt?: string }) {
  return (
    <Image
      src={markSrc}
      alt={alt}
      width={52}
      height={40}
      className={className}
      loading="eager"
      sizes="52px"
    />
  );
}
