'use client';

import { useEffect, useRef } from 'react';

/**
 * Bọc một khối nội dung để nó trôi lên khi khách cuộn tới.
 *
 * **Nguyên tắc số một: nội dung KHÔNG bao giờ ẩn trong HTML thô.** HTML server trả về
 * là khối đã hiện đủ; chỉ khi JS chạy được, effect mới gắn `data-reveal="pending"` — và
 * chính attribute đó (không phải một class tĩnh trong JSX) mới là thứ đặt `opacity:0`.
 * Nghĩa là JS lỗi, JS bị chặn, hay renderer của Googlebot bỏ giữa đường → khách vẫn
 * thấy trọn nội dung. Làm ngược lại (ẩn sẵn rồi JS mới hiện) là đặt toàn bộ nội dung
 * SEO của trang chủ sau một điều kiện JS để đổi lấy đúng vài trăm ms chuyển động, trên
 * chính trang mà SEO là kênh acquisition. Có assertion canh đúng điều này:
 * `curl | grep -c 'data-reveal'` trên HTML thô phải bằng 0.
 *
 * Đây là client component **duy nhất** được thêm cho đợt làm sinh động trang chủ, và nó
 * cố ý không biết gì về `children`: mọi section vẫn là server component, RSC payload của
 * chúng đi qua đây nguyên vẹn. Vì vậy H1, danh sách khu vực và danh sách dịch vụ vẫn
 * nằm trong HTML đầu tiên.
 *
 * Một `IntersectionObserver` dùng chung cho cả trang chứ không mỗi khối một cái: cùng
 * ngưỡng cho mọi khối, và không N observer cho N section.
 *
 * `prefers-reduced-motion` được kiểm bằng JS ở đây, không chỉ dựa vào khối `@media`
 * trong globals.css: khối CSS đó rút thời lượng về 0.01ms, nhưng nếu ta vẫn vào trạng
 * thái `pending` thì vẫn có một khung `opacity:0`. Chặn ở JS thì không có gì để nháy.
 * Cùng cách kiểm với `SearchMap.tsx`.
 */

/** Các khối còn đang chờ, dùng chung cho cả observer và `scroll` fallback. */
const watched = new Set<HTMLElement>();

let observer: IntersectionObserver | null = null;
let scrollBound = false;

/** Mở một khối ra và thôi theo dõi nó. Gọi được nhiều lần, chỉ tác dụng lần đầu. */
function reveal(el: HTMLElement) {
  if (!watched.has(el)) return;
  watched.delete(el);
  el.dataset.reveal = 'in';
  observer?.unobserve(el);
  // Chỉ chạy một lượt. Animation lặp lại mỗi lần cuộn qua là dấu hiệu số một của một
  // trang gây khó chịu, không phải của một trang sinh động.
}

/**
 * Mở mọi khối đã vào màn hình HOẶC đã cuộn vượt lên trên nó.
 *
 * Vế "đã vượt lên trên" là **bắt buộc**, và đây là một bug đã đo được hai lần chứ không
 * phải phòng xa: `IntersectionObserver` chỉ phát entry khi trạng thái giao nhau **đổi**.
 * Một cú nhảy tức thời xuống đáy trang (bấm End, kéo thanh cuộn, `scrollTo` từ một
 * link neo) đưa khối từ "dưới màn hình" sang "trên màn hình" trong cùng một khung —
 * `isIntersecting` là false ở cả hai đầu, nên **không có entry nào được phát** và khối
 * nằm lại `opacity:0` vĩnh viễn cho tới khi tải lại trang. Với section "Tìm theo khu
 * vực" và section duyệt hồ sơ, đó là hai khối nội dung SEO biến mất hẳn.
 */
function sweep() {
  for (const el of [...watched]) {
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) reveal(el);
  }
}

function getObserver(): IntersectionObserver {
  if (observer) return observer;

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) reveal(entry.target as HTMLElement);
      }
    },
    {
      // `threshold: 0` và KHÔNG `rootMargin` âm. Bản đầu dùng
      // `rootMargin: '0px 0px -12% 0px'` để chuyển động kết thúc đúng lúc mắt tới, nhưng
      // vùng bị thu lại đó làm ca "cuộn vượt qua trong một khung" ở trên xảy ra dễ hơn.
      // Đổi lấy sự chắc chắn: một khối mở sớm hơn 12% màn hình là điều không ai thấy,
      // còn một khối không bao giờ mở thì ai cũng thấy.
      threshold: 0,
    },
  );

  return observer;
}

/**
 * `scroll` listener dùng chung, là lưới an toàn cho đúng ca observer không phát entry.
 *
 * `passive` + tự tháo khi không còn khối nào chờ: nó chỉ sống trong vài giây đầu của
 * lượt xem, không phải một listener thường trú trên mọi lượt cuộn của trang.
 */
function bindScroll() {
  if (scrollBound) return;
  scrollBound = true;

  const onScroll = () => {
    sweep();
    if (watched.size === 0) {
      window.removeEventListener('scroll', onScroll);
      scrollBound = false;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}

export function Reveal({
  children,
  delay = 0,
  className,
  id,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  /** Độ trễ (ms) để xếp so le nhiều khối cạnh nhau. */
  delay?: number;
  className?: string;
  /** Cần cho neo `#cach-duyet-ho-so`: footer trỏ tới nó, và `scroll-mt-*` đo từ
   *  chính element mang `id` — dời neo xuống div con là đổi hình học đó. */
  id?: string;
  as?: 'div' | 'section' | 'li' | 'span';
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Khối đã nằm trong (hoặc đã vượt qua) màn hình ngay lúc JS chạy — hydrate muộn,
    // hoặc khách mở một link có `#neo` — thì KHÔNG vào `pending`: không còn gì để "trôi
    // vào", và ẩn nó đi rồi chờ observer là tự tạo lại đúng cái bug `sweep()` đang chữa.
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.dataset.reveal = 'pending';
    watched.add(el);
    getObserver().observe(el);
    bindScroll();

    return () => {
      watched.delete(el);
      observer?.unobserve(el);
    };
  }, []);

  return (
    <Tag
      ref={ref as never}
      id={id}
      // `--rv-d` là biến CSS tĩnh nằm sẵn trong HTML server — không phải state, nên
      // không có cửa nào cho hydration mismatch. globals.css đọc nó qua
      // `var(--rv-d, 0ms)`.
      style={delay ? ({ '--rv-d': `${delay}ms` } as React.CSSProperties) : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
