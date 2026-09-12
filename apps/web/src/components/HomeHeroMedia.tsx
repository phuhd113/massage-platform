import Image from 'next/image';

import heroImage from '../../public/hero-massage-tan-noi.jpg';

import { CertifiedIcon } from '@/components/icons';

import type { Translator } from '@/i18n/t';

/**
 * Cột phải của hero: ảnh lớn + một thẻ minh hoạ giao diện nổi lên trên.
 *
 * Ảnh là **file tĩnh trong `public/`**, không phải ảnh từ R2 như avatar/gallery KTV:
 * đây là ảnh biên tập của sàn, không do ai tải lên và không đổi theo dữ liệu, nên cho
 * nó đi qua `MediaUrls` + `remotePatterns` là bắt trang chủ phụ thuộc vào việc storage
 * có cấu hình đúng hay không. Import tĩnh cũng cho Next biết sẵn kích thước thật, tức
 * không cần khai `width`/`height` bằng tay và không có ca nào lệch tỉ lệ.
 *
 * `priority` vì đây là **LCP element** của trang chủ — khối lớn nhất trên màn hình đầu
 * tiên của trang có nhiều traffic nhất. Không có nó, Next lazy-load và ảnh chỉ bắt đầu
 * tải sau khi hydrate xong, đẩy LCP thêm cả trăm ms ở chính chỉ số xếp hạng. Đây vẫn
 * phải là ảnh **duy nhất** trên trang mang cờ này.
 *
 * Khối giữ chiều cao cố định ở mỗi breakpoint và ảnh `object-cover`: hero đổi chiều
 * cao sau khi ảnh tải là điểm trừ CLS, cũng ở đúng trang đó.
 *
 * **Ba con số cũ đã bỏ** (`<dl>` KTV đã duyệt / điểm trung bình / 0 ₫ phí đặt lịch).
 * Hai lý do: (a) ô "0 ₫ phí đặt lịch" nói tới một tính năng sàn KHÔNG có — không có
 * lịch để đặt thì cũng không có phí đặt lịch để miễn, và cả đợt này sinh ra để dọn
 * đúng lời khai đó; (b) hai con số còn lại không mất, `verifiedKtvCount` vẫn ở huy
 * hiệu ngay trên H1 và cả hai chuyển xuống `HomeSloganBand` — nơi chúng đứng cạnh
 * đúng lời hứa mà chúng chứng minh, nên đọc mạnh hơn hẳn khi đứng rời.
 */
export function HomeHeroMedia({ t }: { t: Translator }) {
  return (
    <div className="relative">
      <div className="relative h-[260px] overflow-hidden rounded-2xl border border-ink-200 bg-brand-50 shadow-card sm:h-[360px]">
        {/*
          **KHÔNG có `animate-*` nào trên `<Image>`, và đó là một ràng buộc chứ không
          phải một chỗ chưa làm.** Trình duyệt đo LCP ở thời điểm ảnh đạt opacity CUỐI,
          nên một cú fade dù chỉ 300ms cũng dịch đúng chỉ số xếp hạng của trang có nhiều
          traffic nhất. Cũng không ken-burns: `scale` chạy vô hạn trên một ảnh `fill`
          buộc trình duyệt vẽ lại một lớp 100vw liên tục, thứ thấy được ngay trên máy 3G.

          Đợt làm sinh động trang chủ (2026-09-12) vì vậy đặt **toàn bộ** chuyển động của
          hero ra QUANH ảnh: lưới gradient trôi phía sau chữ ở cột trái, và thẻ hồ sơ mẫu
          bên dưới. Ảnh đứng yên.
        */}
        <Image
          src={heroImage}
          alt={t('home.heroImageAlt')}
          fill
          // Cột phải của hero: nửa màn hình ở desktop, tràn chiều ngang ở mobile.
          // Thiếu `sizes` thì `fill` mặc định `100vw` và máy để bàn tải bản rộng
          // gấp đôi mức cần cho một khối chưa tới 600px.
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="object-cover"
        />

        {/* Lớp phủ tối dần từ dưới lên: thẻ trắng đặt trên một tấm ảnh sáng ở chỗ
            nào cũng có thể mất viền. Chỉ có ở breakpoint hiện thẻ. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 hidden h-2/3 bg-gradient-to-t from-ink-900/45 to-transparent sm:block"
        />
      </div>

      <HeroProfileCardMock t={t} />
    </div>
  );
}

/**
 * Thẻ minh hoạ hình dạng của một hồ sơ KTV.
 *
 * **Cố ý KHÔNG mang tên người, con số hay link.** Bản thiết kế vẽ thẻ này với một cái
 * tên cụ thể và "4,9 · 128 đánh giá", nhưng dựng lại đúng như vậy là đặt một hồ sơ bịa
 * ngay dưới H1 của chính trang đang khoe "hồ sơ xác thực" — người đọc không có cách
 * nào biết đó là minh hoạ, nên nó đọc ra là một lời khai về một KTV có thật. Cùng loại
 * lỗi với việc backfill `commitment_version` cho hồ sơ cũ: dựng bằng chứng giả cho
 * chính mình, và ở đây nó rơi vào đúng thứ sàn đang bán.
 *
 * Thay vào đó thẻ chỉ giữ **hình dạng**: ô ảnh đại diện, chip "Đã xác thực", các thanh
 * giữ chỗ cho tên và chip dịch vụ. Nó nói "đây là thứ bạn sẽ thấy" chứ không nói "đây
 * là người này". Phần mang thông tin thật là dòng chú thích bên dưới — chữ dịch được,
 * nói rõ một hồ sơ chứa những gì.
 *
 * Muốn thẻ mang dữ liệu thật thì đường đúng là gọi `/search`, và khi đó phải xử lý
 * việc kết quả đầu gần như luôn là hồ sơ **đang trả phí** (`/search` xếp theo
 * `boost_points` trước): hoặc lọc bỏ chúng, hoặc thêm băng khai báo + `rel="sponsored"`
 * như `KtvCard`. Đừng chỉ thay chỗ này bằng `items[0]`.
 *
 * Thanh giữ chỗ cố ý **không** `animate-pulse`: đó là ngôn ngữ của skeleton loading, và
 * một khối "đang tải" vĩnh viễn trên trang chủ đọc như trang hỏng. Đợt thêm chuyển động
 * cho trang chủ (2026-09-12) không đổi điều này: thẻ vào bằng `card-rise` một lượt rồi
 * lửng lơ — chuyển động của một thẻ **đã tải xong**, không phải của một thẻ đang tải.
 *
 * `hidden sm:block` — ẩn hẳn ở mobile. Ở 360px khối này chỉ đẩy ô tìm kiếm (thứ khách
 * mobile thật sự cần) xuống dưới màn hình đầu, mà nó không mang thông tin nào không có
 * ở chỗ khác. `display:none` cũng nghĩa là nó không tốn gì cho LCP mobile.
 *
 * `absolute` trong `relative` → đóng góp layout bằng 0, tức không thêm CLS. Đó là lý do
 * thẻ chồng lên ảnh thay vì xếp dưới: xếp dưới thì cột phải cao thêm ~120px và nút tìm
 * kiếm rơi khỏi màn hình đầu ở laptop 768px.
 */
function HeroProfileCardMock({ t }: { t: Translator }) {
  return (
    <div
      // Cả khối là một hình minh hoạ: trình đọc màn hình nhận đúng một mô tả gọn thay
      // vì lê thê qua từng thanh giữ chỗ vô nghĩa.
      role="img"
      aria-label={t('home.heroCardAria')}
      // Không bấm được, nên không ai bấm hụt vào một thẻ không dẫn đi đâu.
      //
      // `card-rise` vào sau H1 và mô tả (520ms): thẻ này là minh hoạ cho lời hứa vừa
      // đọc, nên nó phải xuất hiện SAU câu nó minh hoạ.
      className="pointer-events-none absolute inset-x-4 bottom-4 hidden animate-card-rise [animation-delay:520ms] sm:block"
    >
      {/*
        Lửng lơ ±5px, 5.5s. Đặt ở lớp TRONG chứ không trùng với lớp ngoài đang chạy
        `card-rise`: hai animation cùng ghi `transform` trên một node thì cái khai sau
        thắng, và cú vào biến mất hoàn toàn — hỏng im lặng vì thẻ vẫn hiện, chỉ là hiện
        ngay từ đầu. Delay 1.1s để nó bắt đầu sau khi `card-rise` đã kết thúc.

        Dòng chú thích nằm TRONG lớp này cùng thẻ, không ở ngoài: nó giải thích chính
        thẻ đó, nên hai thứ phải lửng lơ cùng nhau. Để chú thích đứng yên thì khoảng
        cách giữa nó và thẻ nhấp nháy 5px liên tục — chuyển động duy nhất trên trang mà
        mắt thật sự bắt được.
      */}
      <div className="animate-float-slow [animation-delay:1.1s]">
        <div className="max-w-[19rem] rounded-xl border border-ink-200 bg-white/95 p-3.5 shadow-card backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 shrink-0 rounded-lg border border-ink-200 bg-brand-100" />

            <div className="min-w-0 flex-1">
              {/* Chip xác thực dùng token `success-*` như huy hiệu trên H1 — KHÔNG dùng
                  `champagne-*`, thứ chỉ dành cho vị trí trả phí.
                  `pop` sau khi thẻ đã vào (820ms): dấu tích là thứ đáng được nhấn, và
                  nhấn nó lúc thẻ còn đang bay là nhấn vào chỗ mắt chưa kịp tới. */}
              <span className="inline-flex animate-pop items-center gap-1 rounded-full border border-success-bd bg-success-bg px-2 py-0.5 text-caption font-semibold text-success-fg [animation-delay:820ms]">
                <CertifiedIcon size={12} className="h-3 w-3" />
                {t('home.heroCardVerified')}
              </span>

              <span className="mt-2 block h-2.5 w-28 rounded-full bg-ink-300" />
              <span className="mt-1.5 block h-2 w-20 rounded-full bg-ink-200" />
            </div>
          </div>

          <div className="mt-3 flex gap-1.5">
            <span className="h-5 w-20 rounded-md bg-ink-100" />
            <span className="h-5 w-16 rounded-md bg-ink-100" />
            <span className="h-5 w-12 rounded-md bg-ink-100" />
          </div>
        </div>

        <p className="mt-2.5 max-w-[19rem] text-caption font-medium text-white drop-shadow-[0_1px_3px_rgba(13,27,42,0.65)]">
          {t('home.heroCardCaption')}
        </p>
      </div>
    </div>
  );
}
