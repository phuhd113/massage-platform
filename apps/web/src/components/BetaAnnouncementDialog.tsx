'use client';

import { useEffect, useRef } from 'react';
import { CheckIcon, PhoneIcon, ZaloIcon } from '@/components/icons';

/**
 * Nội dung thông báo chương trình Beta, dùng chung cho **hai** chỗ mở nó:
 *
 * - `KtvAnnouncement` — tự bật một lần khi KTV vào dashboard.
 * - `KtvBetaAside` — nút bấm ở cột phải màn hình đăng ký KTV.
 *
 * Tách ra vì hai chỗ đó có **cách mở khác nhau nhưng nội dung phải giống hệt nhau**:
 * đây là lời hứa với KTV về chính sách thu phí, và hai bản trôi khỏi nhau nghĩa là
 * người đọc lúc đăng ký đồng ý với một bản, còn bản họ thấy sau khi vào dashboard lại
 * là bản khác. Chép câu chữ sang file thứ hai là cách chắc chắn để điều đó xảy ra — và
 * cũng làm `ANNOUNCEMENT_VERSION` mất nghĩa, vì nó chỉ canh được một bản.
 *
 * Component này **không** quản trạng thái mở/đóng và **không** đụng tới localStorage:
 * hai chỗ gọi có luật hiển thị khác nhau (một chỗ nhớ đã đọc, một chỗ mở lại bao nhiêu
 * lần cũng được), nên luật đó thuộc về chỗ gọi. Ở đây chỉ còn phần chung: khoá cuộn
 * nền, Esc để đóng, và câu chữ.
 *
 * Chỉ có tiếng Việt, cùng lý do với dashboard KTV: người đọc đều là KTV người Việt.
 */

/** Hai số của Ban quản trị, dùng chung cho cả link gọi lẫn link Zalo. */
const CONTACTS = ['0905131368', '0354888765'] as const;

/** Hiển thị `0905.131.368` — nhóm ba chữ số để đọc và đọc to qua điện thoại. */
function prettyPhone(raw: string) {
  return `${raw.slice(0, 4)}.${raw.slice(4, 7)}.${raw.slice(7)}`;
}

export function BetaAnnouncementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();

    // Khoá cuộn nền: nội dung dài nên hộp thoại tự cuộn, mà không khoá thì cuộn hết
    // hộp là cuộn tiếp trang bên dưới — trên điện thoại đọc như hộp thoại bị trôi đi.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ktv-announcement-title"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-card focus:outline-none sm:max-h-[88vh] sm:rounded-2xl"
      >
        {/* Đầu hộp thoại dính trên: nội dung dài nên nút đóng phải luôn trong tầm
            với, không bắt cuộn xuống đáy mới thoát được. */}
        <div className="flex items-start gap-3 bg-brand-500 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-label uppercase text-brand-200">Thông báo từ Ban quản trị</p>
            <h2 id="ktv-announcement-title" className="mt-1 text-h4 text-white sm:text-h3">
              Chương trình trải nghiệm đặc quyền dành cho kỹ thuật viên tiên phong
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="-mr-1.5 -mt-1 shrink-0 rounded-full p-2 text-brand-200 transition hover:bg-brand-600 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-body-l text-ink-700">Kính gửi Quý Kỹ thuật viên đối tác,</p>

          <p className="mt-3 text-body text-ink-600">
            Masgo.vn là nền tảng trực tuyến kết nối khách hàng có nhu cầu massage thư giãn, chăm
            sóc cơ thể tận nơi với các kỹ thuật viên chuyên nghiệp theo từng khu vực địa lý.
          </p>

          <p className="mt-3 text-body text-ink-600">
            Hiện tại, Masgo.vn đang trong{' '}
            <strong className="font-semibold text-ink-800">giai đoạn chạy thử nghiệm</strong>{' '}
            nhằm hoàn thiện hệ thống kết nối và mang lại lượng khách hàng ổn định nhất cho KTV. Ban
            quản trị trân trọng gửi đến bạn chương trình đồng hành trải nghiệm:
          </p>

          <ul className="mt-4 space-y-3">
            <Benefit title="Miễn phí 100% phí duy trì hồ sơ">
              KTV được mở tài khoản, đăng tải thông tin dịch vụ, bằng cấp và hiển thị nhận khách hoàn
              toàn miễn phí trong suốt thời gian chạy thử nghiệm.
            </Benefit>
            <Benefit title="Tặng gói đẩy hạng và ghim đầu trang">
              Hồ sơ của các KTV tham gia sớm sẽ được ưu tiên hiển thị ở những vị trí đẹp nhất trong
              khu vực hoạt động để đón những lượt khách đầu tiên.
            </Benefit>
          </ul>

          {/* Phần lộ trình thu phí tách hẳn thành khối riêng, không trộn vào danh sách
              quyền lợi phía trên: đây là thông tin bất lợi cho người đọc, và gói nó
              lẫn giữa các gạch đầu dòng "miễn phí" là cách chắc chắn để sau này bị
              nói là đã giấu. */}
          <section className="mt-6 rounded-xl border border-ink-200 bg-ink-25 p-4">
            <h3 className="text-body-l font-semibold text-ink-900">
              Lộ trình vận hành khi nền tảng đi vào hoạt động chính thức
            </h3>
            <p className="mt-1.5 text-body-s text-ink-600">
              Sau giai đoạn thử nghiệm — khi lượng khách hàng truy cập và tìm kiếm trên sàn đã ổn
              định — Masgo.vn sẽ áp dụng chính sách vận hành tiêu chuẩn:
            </p>
            <ul className="mt-3 space-y-2.5">
              <li className="text-body text-ink-700">
                <strong className="font-semibold text-ink-900">Phí duy trì hồ sơ mỗi ngày</strong> —
                một khoản phí nhỏ theo ngày để giữ hồ sơ của bạn luôn hoạt động và xuất hiện trên hệ
                thống tìm kiếm khu vực, tương tự phí treo biển hay duy trì tin đăng.
              </li>
              <li className="text-body text-ink-700">
                <strong className="font-semibold text-ink-900">Gói đẩy hạng theo nhu cầu</strong> —
                dành cho KTV muốn tăng tốc doanh thu, ghim vị trí đầu trang tại Quận/Huyện của mình.
              </li>
            </ul>
          </section>

          {/* Champagne dành riêng cho vị trí trả phí / đặc quyền mua được — xem ghi
              chú token trong tailwind.config.ts. Quyền lợi của nhóm tham gia sớm đúng
              là loại đó. */}
          <section className="mt-4 rounded-xl border border-champagne-200 bg-champagne-50 p-4">
            <h3 className="text-body-l font-semibold text-champagne-600">
              Quyền lợi dành riêng cho KTV tham gia sớm
            </h3>
            <p className="mt-1.5 text-body text-ink-700">
              Toàn bộ KTV đăng ký, hoàn thiện hồ sơ và gửi phản hồi trải nghiệm trong giai đoạn này
              sẽ được{' '}
              <strong className="font-semibold text-ink-900">tặng thêm ngày duy trì miễn phí</strong>{' '}
              và nhận{' '}
              <strong className="font-semibold text-ink-900">
                chính sách trợ giá phí duy trì trọn đời
              </strong>{' '}
              khi hệ thống chính thức áp dụng thu phí.
            </p>
          </section>

          <section className="mt-6">
            <h3 className="text-body-l font-semibold text-ink-900">Liên hệ Ban quản trị</h3>
            <p className="mt-1.5 text-body-s text-ink-600">
              Mọi ý kiến đóng góp tính năng hoặc hỗ trợ kích hoạt hồ sơ, vui lòng nhắn tin trực tiếp
              qua số điện thoại hoặc Zalo:
            </p>
            <div className="mt-3 space-y-2">
              {CONTACTS.map((phone) => (
                <div
                  key={phone}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2"
                >
                  <span className="font-display text-body-l font-bold tracking-wide text-ink-900">
                    {prettyPhone(phone)}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <a
                      href={`tel:${phone}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3.5 py-1.5 text-body-s font-semibold text-white transition hover:bg-brand-600"
                    >
                      <PhoneIcon className="h-4 w-4" />
                      Gọi
                    </a>
                    {/* Zalo mở tab mới: đây là site ngoài, thay trang đang mở bằng nó
                        là đá KTV ra khỏi chỗ họ đang làm việc — và ở màn hình đăng ký
                        thì còn là bỏ dở form họ đang điền dở. */}
                    <a
                      href={`https://zalo.me/${phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-500 px-3.5 py-1.5 text-body-s font-semibold text-brand-600 transition hover:bg-brand-50"
                    >
                      <ZaloIcon className="h-4 w-4" />
                      Zalo
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="mt-6 text-body text-ink-700">Trân trọng cảm ơn sự đồng hành của bạn!</p>
          <p className="mt-1 text-body font-semibold text-ink-900">Ban Quản Trị Masgo.vn</p>
        </div>

        {/* Chân dính đáy, cùng lý do với đầu dính trên. `pb-[max(...)]` chừa chỗ cho
            thanh cử chỉ ở iPhone — không có thì nút nằm đúng dưới vạch home. */}
        <div className="border-t border-ink-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-brand-500 px-5 py-3 text-body-l font-semibold text-white shadow-button transition hover:bg-brand-600"
          >
            Tôi đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}

function Benefit({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
        <CheckIcon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <strong className="block text-body font-semibold text-ink-900">{title}</strong>
        <span className="mt-0.5 block text-body text-ink-600">{children}</span>
      </span>
    </li>
  );
}
