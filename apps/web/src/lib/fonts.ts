import { IBM_Plex_Mono, Plus_Jakarta_Sans, Source_Sans_3 } from 'next/font/google';

/**
 * Ba biến font dùng chung cho **mọi** cây route có `<html>` riêng: `[locale]`
 * (trang công khai), `/dashboard` và `/admin`.
 *
 * Tách khỏi `[locale]/layout.tsx` vì dashboard và admin nằm **ngoài** `[locale]`
 * (cố ý — cả hai chỉ có tiếng Việt) nên chúng phải tự render `<html>`/`<body>`,
 * và do đó phải tự gắn biến font. Khai lại ở mỗi layout thì `next/font` tạo ra
 * nhiều instance của cùng bộ chữ: mỗi cây route tải một bản `@font-face` riêng
 * với tên biến sinh khác nhau, và bản nào lệch weight/subset sẽ chỉ lộ ra ở đúng
 * khu vực đó.
 *
 * `subsets` phải có 'vietnamese' — thiếu nó, font chỉ tải glyph latin và mọi chữ
 * có dấu rơi về font hệ thống, khiến "Trần Thị Hường" render bằng hai typeface
 * trong cùng một dòng. Rất khó thấy khi review nhanh, nhưng khách Việt thấy ngay.
 *
 * Giữ nguyên subset tiếng Việt cho **cả bản tiếng Anh**: tên KTV, phần giới thiệu
 * và nội dung đánh giá vẫn là tiếng Việt trên trang tiếng Anh.
 *
 * Tiêu đề cần cả 800: thang chữ của thiết kế dùng weight đó cho hero và h1 trang
 * hồ sơ. Thiếu weight thật thì trình duyệt tự làm đậm giả, nét bị bè và lệch hẳn
 * so với bản thiết kế.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

// Chỉ dùng cho số (tiền, id giao dịch) nên không cần subset tiếng Việt.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

/** Chuỗi class gắn lên `<html>` để ba biến `--font-*` có giá trị. */
export const fontVariables = `${jakarta.variable} ${sourceSans.variable} ${plexMono.variable}`;
