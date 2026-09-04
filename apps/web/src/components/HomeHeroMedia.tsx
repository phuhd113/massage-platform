import type { SiteStats } from '@/lib/types';

/**
 * Cột phải của hero: ô ảnh lớn + ba con số.
 *
 * Ô ảnh là **placeholder**, không phải `<img>` rỗng: backend chưa có cột ảnh nào
 * cho trang chủ, và một thẻ ảnh trỏ vào đâu đó chưa tồn tại sẽ vừa hiện icon vỡ
 * vừa tính là một request 404 mỗi lượt tải trang.
 *
 * Khối này giữ đúng chiều cao cố định (300px) kể cả khi chưa có ảnh — đó là lý do
 * nó tồn tại thay vì render rỗng: hero là phần trên màn hình đầu tiên, một khối
 * đổi chiều cao sau khi tải là điểm trừ CLS ở chính trang có nhiều traffic nhất.
 */
export function HomeHeroMedia({ stats }: { stats: SiteStats }) {
  const cards = buildHomeStats(stats);

  return (
    <div className="grid gap-3">
      <div
        className="relative flex h-[300px] items-center justify-center overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-brand-50 to-brand-100"
        aria-hidden
      >
        <span className="flex flex-col items-center gap-2 px-6 text-center text-body-s text-brand-600">
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-70"
          >
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <circle cx="8.5" cy="9.5" r="1.75" />
            <path d="m3.5 17 4.5-4.5 3.5 3.5 3-3 6 6" />
          </svg>
          Ảnh KTV đang trị liệu tại nhà khách
        </span>
      </div>

      {cards.length > 0 && (
        <dl className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cards.length}, 1fr)` }}>
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-ink-200 bg-white p-3.5">
              <dd className="tabular font-mono text-[22px] font-medium leading-7 text-ink-900">
                {c.value}
              </dd>
              <dt className="mt-0.5 text-caption leading-[18px] text-ink-600">{c.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Ba con số dưới ảnh hero.
 *
 * Cùng nguyên tắc với `buildStatCards` của trang khu vực: ô nào chưa có dữ liệu
 * thật thì bỏ hẳn chứ không hiện "—" hay số 0. Riêng ở đây lý do mạnh hơn — đây là
 * lời khai về quy mô của sàn đặt ngay dưới H1, nên "0 KTV" hoặc một ô gạch ngang
 * không chỉ thừa mà còn phản tác dụng với đúng thứ hero đang cố chứng minh.
 *
 * Ô "0 ₫ phí đặt lịch" thì luôn hiện: nó là chính sách, không phải số đo, nên
 * không phụ thuộc vào việc sàn đã có bao nhiêu hồ sơ.
 */
function buildHomeStats(stats: SiteStats): { label: string; value: string }[] {
  const cards: { label: string; value: string }[] = [];

  if (stats.verifiedKtvCount > 0) {
    cards.push({
      label: 'KTV có chứng chỉ đã duyệt',
      value: stats.verifiedKtvCount.toLocaleString('vi-VN'),
    });
  }

  if (stats.ratingAvg !== null) {
    cards.push({
      label: 'Điểm trung bình từ khách',
      // Dấu phẩy thập phân theo cách viết số tiếng Việt.
      value: stats.ratingAvg.toFixed(1).replace('.', ','),
    });
  }

  cards.push({ label: 'Phí đặt lịch, trả sau buổi làm', value: '0 ₫' });

  return cards;
}
