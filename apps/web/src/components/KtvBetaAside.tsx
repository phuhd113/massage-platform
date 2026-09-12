'use client';

import { useCallback, useState } from 'react';
import { BetaAnnouncementDialog } from '@/components/BetaAnnouncementDialog';
import { CheckIcon } from '@/components/icons';

/**
 * Cột phải của màn hình đăng ký KTV: tóm tắt chương trình Beta + nút mở thông báo
 * đầy đủ.
 *
 * **Cố ý KHÔNG tự bật popup ở đây**, khác hẳn dashboard. Người mở `/dang-ky-ktv` đang
 * muốn làm đúng một việc — tạo tài khoản — và một hộp thoại chồng lên ô nhập ngay khi
 * trang vừa mở là đặt lời chào trước việc họ tới để làm. Ở dashboard thì ngược lại:
 * KTV đã vào được rồi, không có thao tác nào đang dở.
 *
 * Hệ quả kỹ thuật đi kèm, và là lý do chính chọn cách này: nút bấm **không đụng tới
 * `markAnnouncementSeen`**. Cờ đó được đốt ngay lúc popup mở, nên tự bật ở đây sẽ tiêu
 * mất lượt hiện duy nhất ở dashboard — KTV xem lướt lúc đang điền form rồi không bao
 * giờ được mời đọc lại. Nay hai đường độc lập: mở ở đây bao nhiêu lần cũng được, và
 * dashboard vẫn giữ nguyên lượt tự hiện của nó.
 *
 * Chỉ tiếng Việt, cùng lý do với chính thông báo: người đọc đều là KTV người Việt.
 * Cột này ẩn ở mobile (`lg:flex` ở chỗ gọi) nên nội dung Beta **không** phải đường
 * duy nhất KTV biết tới chương trình — dashboard vẫn tự hiện đầy đủ trên mọi cỡ màn.
 */

/**
 * Quyền lợi rút gọn từ thông báo. Câu đầy đủ nằm trong hộp thoại.
 *
 * Danh sách này phải là **tập con** của các quyền lợi trong `BetaAnnouncementDialog`,
 * không bao giờ hứa thêm thứ hộp thoại không nói: người đọc ở đây đang quyết định có
 * tạo tài khoản hay không, còn hộp thoại là bản đầy đủ họ xem sau đó. Gỡ một lời hứa
 * thì phải gỡ ở **cả hai** — bỏ mình chỗ này chỉ giấu nó khỏi màn đăng ký, trong khi
 * hộp thoại vẫn hứa nguyên văn.
 */
const HIGHLIGHTS = [
  'Miễn phí 100% phí duy trì hồ sơ trong suốt giai đoạn thử nghiệm.',
  'Tặng gói đẩy hạng và ghim đầu trang cho KTV tham gia sớm.',
] as const;

export function KtvBetaAside() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* Champagne dành riêng cho đặc quyền — cùng token với khối quyền lợi KTV tham
          gia sớm trong chính hộp thoại, để hai nơi đọc như một chương trình chứ không
          phải hai thứ khác nhau. */}
      <div className="rounded-2xl border border-champagne-200 bg-champagne-50 p-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-champagne-100 px-3 py-1 text-label font-semibold uppercase tracking-wide text-champagne-600">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-champagne-600" />
          Đang chạy thử nghiệm
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold leading-8 tracking-[-0.02em] text-ink-900">
          Đặc quyền cho kỹ thuật viên tiên phong
        </h2>
        <p className="mt-2 text-body text-ink-600">
          Masgo.vn đang trong giai đoạn chạy thử nghiệm. KTV đăng ký lúc này nhận trọn quyền lợi
          dành cho nhóm tham gia sớm.
        </p>

        <ul className="mt-4 grid gap-3">
          {HIGHLIGHTS.map((line) => (
            <li key={line} className="flex gap-2.5 text-body-l leading-[25px] text-ink-700">
              <CheckIcon size={16} className="mt-1 h-[17px] w-[17px] shrink-0 text-success-fg" />
              {line}
            </li>
          ))}
        </ul>

        {/* Nút mở, không phải link: nội dung nằm ngay đây và mở ra một hộp thoại, nên
            điều hướng sang trang khác sẽ bắt người đang điền form quay lại và gõ lại
            từ đầu. */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 w-full rounded-full border border-champagne-200 bg-white px-5 py-2.5 text-body-l font-semibold text-champagne-600 transition hover:bg-champagne-100"
        >
          Xem chi tiết chương trình
        </button>

        {/* Nói trước rằng có phần thu phí ở bên trong. Mời đọc một hộp toàn quyền lợi
            rồi để họ gặp lộ trình thu phí ở giữa là đúng kiểu "đã giấu" mà chính
            thông báo được viết để tránh. */}
        <p className="mt-2.5 text-center text-body-s text-ink-500">
          Gồm cả lộ trình thu phí khi nền tảng hoạt động chính thức.
        </p>
      </div>

      <BetaAnnouncementDialog open={open} onClose={close} />
    </>
  );
}
