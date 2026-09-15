'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bấm vào ảnh để xem bản to. Dùng cho ảnh **do KTV tải lên** — ảnh đại diện và
 * ảnh trong mục "Hình ảnh" ở trang hồ sơ công khai.
 *
 * Bốn quyết định đừng vô tình đảo ngược:
 *
 * - **Ảnh thật vẫn do server render, component này chỉ BỌC chúng.** Trang hồ sơ là
 *   ISR và sống nhờ SEO: `<Image>` nằm trong `children` nên chúng có đủ trong HTML
 *   thô (kèm `schemaImages` của JSON-LD), và JS chỉ gắn thêm lớp mở to. Dựng lại
 *   danh sách ảnh bằng JS ở client là đưa nội dung ảnh của trang ra sau một điều
 *   kiện JS — cùng luật đã ghi cho `Reveal` ở trang chủ.
 * - **KHÔNG áp cho avatar trong `KtvCard`.** Ô ảnh ở thẻ kết quả tìm kiếm là một
 *   `<Link>` sang hồ sơ; chặn nó để mở ảnh là đổi một cú điều hướng có ý nghĩa lấy
 *   một tấm ảnh 64px phóng to. Cũng không áp cho ảnh hero và ảnh biên tập trang
 *   chủ: ảnh hero là LCP element (xem ghi chú "hero không bao giờ có animation"),
 *   và cả hai đều là ảnh minh hoạ không có chi tiết nào để xem kỹ.
 * - **Ảnh trong hộp thoại dùng `<img>` thô, không `next/image`.** Kích thước hiển
 *   thị phụ thuộc viewport và tỉ lệ ảnh gốc nên không khai trước được `width`/
 *   `height`; và bản đang xem là bản **đã tải sẵn** cho lưới bên dưới — trình duyệt
 *   lấy lại từ cache nên mở gần như tức thì. `unoptimized` không liên quan ở đây:
 *   `src` đã là URL cuối mà `next/image` sinh ra cho lưới.
 * - **Phím điều hướng chỉ có khi có nhiều hơn một ảnh.** Một mũi tên không đi tới
 *   đâu đọc như nút hỏng.
 */

export type LightboxItem = {
  /** URL ảnh để hiển thị bản to. */
  src: string;
  alt: string;
  /** Chú thích của KTV, luôn tiếng Việt — xem `VietnameseNote`. */
  caption?: string | null;
};

export function PhotoLightbox({
  items,
  children,
  labels,
  className,
}: {
  items: LightboxItem[];
  /**
   * Các ô ảnh do server render. Thứ tự phải khớp `items`: ô thứ n mở ảnh thứ n.
   * Mỗi phần tử được bọc trong một `<button>` nên bản thân children không cần
   * biết gì về lightbox.
   */
  children: React.ReactNode[];
  labels: { open: string; close: string; prev: string; next: string; counter: string };
  className?: string;
}) {
  // `null` = đang đóng. Dùng chỉ số chứ không phải cờ boolean + state thứ hai:
  // một nguồn sự thật thì không có trạng thái "mở nhưng không biết ảnh nào".
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Trả focus về đúng ô vừa bấm khi đóng — không có nó, người dùng bàn phím rơi
  // về đầu trang và phải Tab lại từ đầu qua cả khối chứng chỉ.
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setIndex(null);
    openerRef.current?.focus();
  }, []);

  const count = items.length;

  useEffect(() => {
    if (index === null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (count < 2) return;
      if (e.key === 'ArrowRight') setIndex((i) => (i === null ? i : (i + 1) % count));
      if (e.key === 'ArrowLeft') setIndex((i) => (i === null ? i : (i - 1 + count) % count));
    };

    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();

    // Khoá cuộn nền, cùng lý do đã ghi ở `BetaAnnouncementDialog`: không khoá thì
    // cuộn trên nền tối trôi trang bên dưới, đọc như hộp thoại bị tuột đi.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, count, close]);

  const current = index === null ? null : items[index];

  return (
    <>
      <div className={className}>
        {children.map((child, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              openerRef.current = e.currentTarget;
              setIndex(i);
            }}
            // `group` để ô ảnh bên trong phản hồi hover; `cursor-zoom-in` là tín
            // hiệu duy nhất cho biết ô này bấm được — ảnh không có gì khác gợi ý.
            className="group block w-full cursor-zoom-in overflow-hidden rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            aria-label={labels.open}
          >
            {child}
          </button>
        ))}
      </div>

      {current && (
        <div
          // Nền gần như đục (`/95`), không phải `/90`: đã nhìn bằng mắt ở 1440px —
          // ở `/90` chữ của trang bên dưới (tên dịch vụ, bảng giá) vẫn đọc rõ và
          // cạnh tranh sự chú ý với chính tấm ảnh vừa mở. Số đo không bắt được ca
          // này; chỉ ảnh chụp mới thấy.
          className="fixed inset-0 z-50 flex flex-col bg-ink-900/95 p-3 sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={current.alt}
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col focus:outline-none"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 pb-3">
              {count > 1 ? (
                <p className="tabular text-body-s text-white/70">
                  {labels.counter
                    .replace('{current}', String((index ?? 0) + 1))
                    .replace('{total}', String(count))}
                </p>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={close}
                aria-label={labels.close}
                className="-mr-1 rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/*
              `relative` để hai mũi tên định vị tuyệt đối ở mobile. Đây là lỗi đã thấy
              bằng mắt ở 390px: khi ba thứ cùng nằm trong một hàng flex, ảnh chiếm gần
              trọn bề ngang nên hai mũi tên bị đẩy **ra ngoài màn hình** (đo được
              `left:-32` và `right:422` trên viewport 390) — chỉ còn thấy nửa hình tròn.
              Số đo "mũi tên không đè ảnh" vẫn đạt ở bản sai, nên chỉ ảnh chụp mới thấy.
              Từ `sm:` màn đủ rộng thì trả chúng về hàng flex như cũ.
            */}
            <div
              className="relative flex min-h-0 flex-1 items-center justify-center gap-2 sm:gap-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              {count > 1 && (
                <ArrowButton
                  label={labels.prev}
                  onClick={() => setIndex((i) => (i === null ? i : (i - 1 + count) % count))}
                  direction="prev"
                />
              )}

              {/* eslint-disable-next-line @next/next/no-img-element -- kích thước phụ
                  thuộc viewport và tỉ lệ ảnh gốc nên không khai trước được; xem ghi
                  chú ở đầu file. */}
              <img
                src={current.src}
                alt={current.alt}
                // `w-auto h-auto` + hai trần: ảnh nhỏ hơn khung **không** bị kéo giãn
                // lên cho đầy. Ảnh KTV được nén ở client về cạnh dài 1600px, nhưng hồ
                // sơ cũ còn những tấm nhỏ hơn hẳn (đã gặp bản 618×495) — phóng một tấm
                // như vậy lên full màn hình cho ra ảnh vỡ nét, tức "xem to" lại nhìn
                // tệ hơn chính ô thumbnail khách vừa bấm.
                className="max-h-full w-auto max-w-full rounded-xl object-contain"
              />

              {count > 1 && (
                <ArrowButton
                  label={labels.next}
                  onClick={() => setIndex((i) => (i === null ? i : (i + 1) % count))}
                  direction="next"
                />
              )}
            </div>

            {current.caption && (
              <p
                lang="vi"
                className="shrink-0 pt-3 text-center text-body-s text-white/80"
              >
                {current.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ArrowButton({
  label,
  onClick,
  direction,
}: {
  label: string;
  onClick: () => void;
  direction: 'prev' | 'next';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // Ở mobile: nổi đè lên ảnh, ghim sát mép trong khung (`absolute`), nền đậm hơn
      // để còn đọc được trên ảnh sáng. Từ `sm:` trả về hàng flex đứng cạnh ảnh.
      className={`absolute z-10 shrink-0 rounded-full bg-ink-900/60 p-2 text-white/90 backdrop-blur-sm transition hover:bg-ink-900/80 hover:text-white sm:static sm:bg-white/10 sm:p-3 sm:backdrop-blur-none sm:hover:bg-white/20 ${
        direction === 'prev' ? 'left-1' : 'right-1'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 sm:h-6 sm:w-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d={direction === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
      </svg>
    </button>
  );
}
