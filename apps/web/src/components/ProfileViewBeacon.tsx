'use client';

import { useEffect, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5080/api/v1';

/**
 * Báo một lượt xem hồ sơ về backend.
 *
 * **Vì sao phải chạy ở trình duyệt** thay vì đếm ngay trong endpoint đọc hồ sơ:
 * trang hồ sơ được cache 600 giây (PROFILE_REVALIDATE), nên nếu đếm ở server thì
 * cả trăm lượt xem trong 10 phút chỉ sinh đúng một request tới API. Con số thu
 * được vẫn trông hợp lý — chỉ là không liên quan gì tới traffic thật, tức là kiểu
 * sai khó phát hiện nhất.
 *
 * Không render gì. Lỗi mạng bị nuốt có chủ ý: đây là thống kê, không phải chức
 * năng khách đang dùng — hiện một thông báo lỗi vì không đếm được lượt xem thì
 * phiền khách vì một việc không phải của họ.
 */
export function ProfileViewBeacon({ ktvId }: { ktvId: string }) {
  // StrictMode ở dev chạy effect hai lần; trong production thì điều hướng
  // client-side quay lại cùng trang cũng vậy. Backend có gộp theo cửa sổ 30 phút
  // nên không sai số, nhưng vẫn không có lý do gửi request thừa.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    fetch(`${API}/ktv/${ktvId}/views`, {
      method: 'POST',
      // keepalive để request vẫn đi tiếp khi khách bấm sang trang khác ngay lập
      // tức — đó chính là nhóm lượt xem dễ mất nhất.
      keepalive: true,
    }).catch(() => {});
  }, [ktvId]);

  return null;
}
