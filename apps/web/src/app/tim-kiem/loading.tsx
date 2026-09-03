/**
 * Khung chờ cho trang tìm kiếm.
 *
 * Trang này là `force-dynamic` (kết quả phụ thuộc toạ độ khách nên không ISR
 * được), nên có một khoảng chờ thật trước khi HTML về. Không có file này thì
 * khách nhìn màn hình trắng.
 *
 * Hình dạng phải khớp thẻ KTV thật: một cột, ô ảnh 132px bên trái, nội dung bên
 * phải. Lệch chiều cao thì khi dữ liệu về, layout nhảy — và CLS là chỉ số xếp hạng
 * của Google, không chỉ là mỹ quan.
 */
export default function SearchLoading() {
  return (
    <>
      <div className="h-14 animate-skeleton rounded-xl border border-ink-200 bg-white" />

      <div className="mt-7 h-8 w-72 animate-skeleton rounded bg-ink-100" />

      <ul className="mt-4 grid gap-3">
        {/* 5 ô: đủ phủ màn hình đầu khi thẻ xếp một cột. */}
        {Array.from({ length: 5 }, (_, i) => (
          <li
            key={i}
            className="animate-skeleton rounded-xl border border-ink-200 bg-white p-4"
          >
            <div className="flex gap-4">
              {/* Ô ảnh chỉ hiện từ breakpoint sm, giống thẻ thật. */}
              <div className="hidden h-[132px] w-[132px] shrink-0 rounded-lg bg-ink-100 sm:block" />

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-6 w-48 rounded bg-ink-100" />
                  <div className="h-9 w-16 shrink-0 rounded bg-ink-100" />
                </div>

                <div className="mt-2.5 flex gap-1.5">
                  <div className="h-6 w-32 rounded-full bg-ink-100" />
                  <div className="h-6 w-24 rounded-full bg-ink-100" />
                </div>

                <div className="mt-3 h-4 w-full rounded bg-ink-100" />
                <div className="mt-1.5 h-4 w-2/3 rounded bg-ink-100" />

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
                  <div className="h-4 w-56 rounded bg-ink-100" />
                  <div className="flex gap-2">
                    <div className="h-9 w-24 rounded-full bg-ink-100" />
                    <div className="h-9 w-16 rounded-full bg-ink-100" />
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
