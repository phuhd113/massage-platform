'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Logic bật/tắt "đang nhận khách", dùng chung cho hai chỗ hiển thị nó: chip trên thẻ
 * hồ sơ ở `/dashboard` và công tắc đầy đủ ở `/dashboard/dich-vu`.
 *
 * Tách ra hook thay vì chép: hai chỗ khác nhau về hình dạng chứ không khác gì về hành
 * vi, và bản chép thứ hai là nơi lần sau người ta quên sửa — ví dụ quên đổi `/api/proxy`
 * thành `/api/ktv-profile`, tức mất luôn bước xoá cache ISR ở đúng một trong hai lối vào.
 *
 * Cố ý **không** cập nhật lạc quan: đây là trạng thái quyết định việc có bị gọi lúc
 * đang bận hay không. Một cái nút nhảy sang "đang tắt" rồi âm thầm bật lại khi request
 * hỏng là kiểu sai tệ nhất ở đây — KTV rời màn hình với niềm tin là mình đã tắt.
 */
export function useOnlineToggle(initial: boolean) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (pending) return;

    const next = !on;

    setPending(true);
    setError(null);

    try {
      // `/api/ktv-profile`, **không** `/api/proxy`: trạng thái này nằm trên thẻ tìm
      // kiếm và trang hồ sơ công khai (ISR 600 giây), nên thiếu bước xoá cache thì
      // khách vẫn thấy "đang nhận khách" sau khi KTV đã tắt.
      const res = await fetch('/api/ktv-profile?target=online', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOnline: next }),
      });

      if (!res.ok) {
        setError(
          res.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi thử lần nữa.'
            : 'Không đổi được trạng thái. Thử lại sau ít phút.',
        );
        return;
      }

      // Tin vào trạng thái backend trả về, không tin vào thứ vừa gửi đi.
      const data = (await res.json().catch(() => null)) as { isOnline?: boolean } | null;
      setOn(data?.isOnline ?? next);

      // Trang tổng quan hiển thị trạng thái này ở nhiều chỗ (chip, và gợi ý trong
      // TodoPanel) — làm mới để chúng không nói hai điều khác nhau cùng lúc.
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  return { on, pending, error, toggle };
}
