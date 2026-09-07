'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { NearMeIcon } from '@/components/icons';
import { type Locale } from '@/i18n/config';
import { areaScopeParams, resolveArea } from '@/lib/area-search';
import { type SavedArea, loadSavedArea, saveArea } from '@/lib/saved-area';

/**
 * Mục vị trí trên header.
 *
 * Mặc định hiện lời mời "Chọn vị trí"; bấm thì mới xin GPS, dò ra tên quận rồi đi
 * thẳng tới `/tim-kiem` quanh toạ độ đó — cùng hành vi với nút "Tìm quanh tôi" ở
 * trang chủ, nên khách gặp cùng một thứ ở hai chỗ.
 *
 * **Không tự định vị khi tải trang**, đúng chính sách đã ghi ở `HeroSearch`: xin
 * quyền GPS ngay khi khách vừa vào là cách nhanh nhất để bị từ chối vĩnh viễn ở cấp
 * trình duyệt — và một khi bị chặn thì nút "Tìm quanh tôi" ở trang chủ chết theo.
 * Header nằm trên **mọi** trang công khai nên nó là chỗ sai lầm đó tốn kém nhất.
 *
 * Lần dò trước được nhớ lại (xem `lib/saved-area`), nên khách quay lại thấy ngay tên
 * quận của mình mà không phải bấm lại. Lần bấm sau đó vẫn xin GPS thật: nhãn đã lưu
 * chỉ là chỗ dựa để hiện chữ, không phải bản sao vị trí dùng để tìm kiếm.
 */
export function LocationNavButton({
  locale,
  labels,
  className,
}: {
  locale: Locale;
  /** Chuỗi đã dịch — client component không tự tra dictionary. */
  labels: { choose: string; locating: string; failed: string; unsupported: string };
  className: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [saved, setSaved] = useState<SavedArea | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Đọc trong effect chứ không phải lúc khởi tạo state: server không có
  // localStorage, nên đọc ở lần render đầu sẽ cho hai kết quả khác nhau giữa server
  // và client và React báo hydration mismatch.
  useEffect(() => setSaved(loadSavedArea()), []);

  function locate() {
    if (!navigator.geolocation) {
      setError(labels.unsupported);
      return;
    }

    setLocating(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        // Điều hướng ngay với toạ độ thật, không chờ dò tên quận: kết quả tìm kiếm
        // lọc theo toạ độ chứ không theo cái nhãn, nên bắt khách đợi thêm một vòng
        // gọi mạng chỉ để biết chữ hiển thị là đổi thời gian chờ lấy không gì cả.
        const q = new URLSearchParams();
        q.set('lat', latitude.toFixed(6));
        q.set('lon', longitude.toFixed(6));

        setLocating(false);
        startTransition(() => router.push(`/tim-kiem?${q.toString()}`));

        // Dò tên quận chạy song song, chỉ để nhớ nhãn cho lần sau. Hỏng thì thôi —
        // khách vẫn đang xem đúng kết quả cần xem.
        void resolveArea({ latitude, longitude }).then((area) => {
          if (!area) return;
          const { areaSlug, provinceSlug } = areaScopeParams(area);
          const next = { name: area.name, areaSlug, provinceSlug: provinceSlug ?? null };
          saveArea(next);
          setSaved(next);
        });
      },
      () => {
        setLocating(false);
        setError(labels.failed);
      },
      { timeout: 10_000 },
    );
  }

  const busy = pending || locating;

  return (
    <button
      type="button"
      onClick={locate}
      disabled={busy}
      className={className}
      // Lỗi hiện thành title chứ không thành một dòng chữ đỏ: header là thanh một
      // hàng trên mọi trang, chèn thêm chữ vào đó sẽ đẩy bố cục của trang bên dưới.
      title={error ?? undefined}
      aria-label={saved ? `${labels.choose}: ${saved.name}` : labels.choose}
    >
      <NearMeIcon size={15} className="h-[15px] w-[15px] shrink-0" />
      <span className="truncate">
        {locating ? labels.locating : (saved?.name ?? labels.choose)}
      </span>
    </button>
  );
}
