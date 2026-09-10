'use client';

import { useCallback, useEffect, useState } from 'react';
import { BetaAnnouncementDialog } from '@/components/BetaAnnouncementDialog';
import { hasSeenAnnouncement, markAnnouncementSeen } from '@/lib/ktv-announcement';

/**
 * Thông báo chương trình Beta, tự hiện một lần cho mỗi KTV khi vào dashboard.
 *
 * Chỉ còn phần **luật hiển thị**; câu chữ nằm ở `BetaAnnouncementDialog`, dùng chung
 * với nút mở ở màn hình đăng ký KTV (`KtvBetaAside`). Xem ghi chú ở file đó về lý do
 * hai chỗ không được có hai bản nội dung.
 *
 * **Đọc localStorage trong `useEffect`, không phải lúc khởi tạo state.** Server không
 * có localStorage nên đọc ở lần render đầu cho hai kết quả khác nhau giữa server và
 * client → hydration mismatch. Cùng cái bẫy đã ghi ở `lib/saved-area.ts`. Hệ quả có
 * chủ ý: lần render đầu **không** có popup, nó xuất hiện ngay sau đó — đúng thứ tự
 * mong muốn, vì nội dung dashboard hiện trước rồi thông báo chồng lên chứ không chặn
 * bằng một màn hình trắng.
 *
 * Ghi nhận đã đọc **ngay lúc mở**, không đợi lúc đóng: KTV đóng tab giữa chừng vẫn là
 * đã thấy, và hiện lại ở lần đăng nhập sau đọc như lỗi lặp.
 */
export function KtvAnnouncement() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenAnnouncement()) return;
    markAnnouncementSeen();
    setOpen(true);
  }, []);

  // Bọc trong `useCallback` vì hộp thoại nhận nó vào deps của effect khoá cuộn nền:
  // hàm mới mỗi lần render sẽ gỡ rồi gắn lại listener ở mọi lượt render của trang.
  const close = useCallback(() => setOpen(false), []);

  return <BetaAnnouncementDialog open={open} onClose={close} />;
}
