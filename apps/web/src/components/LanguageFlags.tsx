'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LOCALES, type Locale, localePath, stripLocale } from '@/i18n/config';

/**
 * Đổi ngôn ngữ bằng **cờ, hiện cả hai cùng lúc** trên header.
 *
 * Khác `LanguageSwitcher` (một link chữ ở footer, chỉ hiện ngôn ngữ *kia*): ở đây
 * mọi ngôn ngữ đều nhìn thấy được ngay, nên khách không phải suy ra rằng bấm vào
 * "English" thì trang sẽ đổi. Đó là lý do dạng cờ đáng chiếm chỗ trên thanh header
 * còn dạng chữ thì không.
 *
 * Vẫn là `<Link>` thật chứ không phải nút gọi `router.push`, cùng lý do đã ghi ở
 * `LanguageSwitcher`: khách mở tab mới được và Google lần theo được để tìm bản dịch.
 *
 * **Chỉ khai đúng những ngôn ngữ site thật sự có** (`LOCALES` = vi, en). Vẽ thêm cờ
 * Hàn/Trung/Nhật cho đẹp hàng là hứa một bản dịch không tồn tại: khách bấm vào sẽ
 * nhận lại đúng trang tiếng Việt và không có gì giải thích vì sao — hỏng im lặng.
 * Thêm ngôn ngữ thật thì thêm vào `FLAGS` **và** `LOCALES`, không chỉ ở đây.
 */

/** Cờ vẽ inline SVG, không dùng emoji: Windows không có glyph cờ quốc gia nên
 *  🇻🇳 hiện thành hai chữ "VN" trên Chrome/Edge — đúng nhóm máy chiếm phần lớn
 *  traffic desktop ở Việt Nam. Cũng là quy ước icon của dự án (xem `icons.tsx`). */
const FLAGS: Record<Locale, { label: string; flag: React.ReactNode }> = {
  vi: {
    label: 'Tiếng Việt',
    flag: (
      <>
        <rect width="24" height="16" fill="#DA251D" />
        <path
          fill="#FF0"
          d="m12 3.4 1.94 5.97h6.28l-5.08 3.69 1.94 5.97L12 15.34l-5.08 3.69 1.94-5.97-5.08-3.69h6.28z"
          transform="translate(0 -1.6) scale(1 .84)"
        />
      </>
    ),
  },
  en: {
    label: 'English',
    flag: (
      <>
        <rect width="24" height="16" fill="#012169" />
        <path d="M0 0l24 16M24 0L0 16" stroke="#FFF" strokeWidth="3.2" />
        <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.9" />
        <path d="M12 0v16M0 8h24" stroke="#FFF" strokeWidth="5.3" />
        <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="3.2" />
      </>
    ),
  },
};

export function LanguageFlags({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();

  // `usePathname` trả về đường dẫn **sau** rewrite của middleware, nên bản tiếng
  // Việt đã mang sẵn tiền tố `/vi`. Cắt ra để dựng lại cho ngôn ngữ kia.
  const { path } = stripLocale(pathname);
  const query = searchParams?.toString();

  return (
    <div
      // `group`/`aria-label` ở cấp bao ngoài: trình đọc màn hình cần biết cụm hai
      // link này là một bộ chọn ngôn ngữ, không phải hai link rời tới cùng trang.
      aria-label={label}
      role="group"
      className="ml-0.5 flex shrink-0 items-center gap-0.5 rounded-md bg-ink-100 p-0.5 sm:ml-1"
    >
      {LOCALES.map((target) => {
        const { label: name, flag } = FLAGS[target];
        const active = target === locale;
        const href = localePath(target, path) + (query ? `?${query}` : '');

        return (
          <Link
            key={target}
            href={href}
            hrefLang={target}
            lang={target}
            // Ngôn ngữ đang xem vẫn là link (bấm vào chỉ tải lại chính trang đó),
            // nhưng `aria-current` nói cho trình đọc màn hình biết đâu là bản đang mở
            // — thứ mà phần nhìn diễn đạt bằng nền trắng và viền.
            aria-current={active ? 'true' : undefined}
            aria-label={name}
            title={name}
            // Cờ **đang mở** ẩn dưới `sm`, nên mobile chỉ còn đúng lá cờ của ngôn
            // ngữ kia — tức chỉ còn *hành động*, bỏ phần *trạng thái*. Ở mobile
            // trạng thái đã có chỗ nói khác: cả trang đang là ngôn ngữ đó. Đo ở
            // 360px: giữ cả hai làm header tràn 62px kể cả sau khi đã thu nút vị trí
            // và đệm nút KTV — cắt tiếp vài px nữa là hỏng cả ba mục.
            //
            // Ẩn bằng CSS chứ **không** render có điều kiện: `useMediaQuery` ở đây
            // nghĩa là server và client vẽ hai thứ khác nhau ở lần render đầu — đúng
            // bẫy hydration đã ghi ở `lib/saved-area.ts`. Cả hai link vẫn nằm trong
            // HTML nên Google vẫn lần theo được sang bản dịch ở mọi cỡ màn hình.
            className={
              active
                ? 'hidden rounded bg-white p-1 shadow-sm ring-1 ring-ink-200 transition sm:block'
                : // Rõ nét ở mobile, làm mờ từ `sm`. Mờ chỉ có nghĩa khi nó đứng
                  // **cạnh** cờ đang mở để nói "cái kia mới là bản đang xem"; một lá
                  // cờ đơn độc mà mờ thì đọc như một nút đã bị vô hiệu hoá.
                  'rounded p-1 transition hover:opacity-100 sm:opacity-55'
            }
          >
            <svg
              viewBox="0 0 24 16"
              aria-hidden
              // Bo góc + viền mảnh: cờ Anh có nền trắng ở rìa nên nếu không có viền
              // nó chảy vào nền sáng của header và mất hẳn hình dạng chữ nhật.
              className="h-3.5 w-[1.3125rem] rounded-[2px] ring-1 ring-black/10"
            >
              {flag}
            </svg>
          </Link>
        );
      })}
    </div>
  );
}
