/**
 * Khung chờ cho trang tìm kiếm.
 *
 * Trang này là `force-dynamic` (kết quả phụ thuộc toạ độ khách nên không ISR
 * được), nên có một khoảng chờ thật trước khi HTML về. Không có file này thì
 * khách nhìn màn hình trắng.
 *
 * Chiều cao mỗi ô phải khớp thẻ KTV thật. Lệch chiều cao thì khi dữ liệu về,
 * layout nhảy — và CLS là chỉ số xếp hạng của Google, không chỉ là mỹ quan.
 */
export default function SearchLoading() {
  return (
    <>
      <h1 className="text-h2">Tìm kỹ thuật viên</h1>

      <div className="mt-6 h-24 animate-skeleton rounded-lg border border-ink-200 bg-white" />

      <div className="mt-8">
        <div className="h-5 w-28 animate-skeleton rounded bg-ink-100" />

        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* 6 ô: đủ phủ màn hình đầu ở cả một cột lẫn hai cột. */}
          {Array.from({ length: 6 }, (_, i) => (
            <li
              key={i}
              className="h-[132px] animate-skeleton rounded-lg border border-ink-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="h-5 w-2/3 rounded bg-ink-100" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-ink-100" />
                </div>
                <div className="h-9 w-16 shrink-0 rounded bg-ink-100" />
              </div>
              <div className="mt-3 flex gap-1.5">
                <div className="h-5 w-24 rounded-full bg-ink-100" />
                <div className="h-5 w-20 rounded-full bg-ink-100" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
