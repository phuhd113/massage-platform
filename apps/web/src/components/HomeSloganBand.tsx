import { Fragment } from 'react';

import { CertifiedIcon, ChoiceIcon, PriceTagIcon } from '@/components/icons';
import { Reveal } from '@/components/Reveal';
import { INTL_LOCALE, type Locale } from '@/i18n/config';

import type { Translator } from '@/i18n/t';
import type { SiteStats } from '@/lib/types';

/**
 * Ba lời hứa của sàn, khai đúng một lần.
 *
 * Chúng xuất hiện ở **hai chỗ**: hàng chip ngắn dưới mô tả hero, và ba cột đầy đủ ở
 * dải khẩu hiệu ngay dưới. Một mảng dùng chung chứ không hai danh sách song song —
 * hai bản sao là hai chỗ để chúng lặng lẽ trôi khỏi nhau, và lúc đó trang tự mâu
 * thuẫn với chính nó cách nhau đúng một màn hình.
 */
export const TRUST_KEYS = ['Verified', 'Price', 'Choice'] as const;
export type TrustKey = (typeof TRUST_KEYS)[number];

/**
 * Ánh xạ lời hứa → màu. Dùng CHUNG cho hàng chip ở hero và ba thẻ ở dải này, cùng lý
 * do như `TRUST_KEYS`: hai chỗ không được nói lệch nhau.
 *
 * Chọn token theo **nghĩa**, không theo thẩm mỹ:
 * - `Verified` → `success-*`, đúng token đang dùng cho huy hiệu xác thực trên H1 và chip
 *   trong thẻ hồ sơ mẫu. Ba chỗ cùng một màu cho cùng một khái niệm.
 * - `Price` → `brand-*`. KHÔNG dùng `champagne`/`warning` (cùng hệ vàng): champagne là
 *   tín hiệu "vị trí trả phí", và "giá cả minh bạch" là đúng thứ không được trông như
 *   một mục trả tiền.
 * - `Choice` → `info-*`, sắc lam lệch khỏi brand nên tách được khỏi hai ô kia mà không
 *   cần thêm họ màu nào.
 */
export const TRUST_TONE: Record<TrustKey, { tile: string; icon: string }> = {
  Verified: { tile: 'bg-success-bg border-success-bd', icon: 'text-success-fg' },
  Price: { tile: 'bg-brand-100 border-brand-200', icon: 'text-brand-600' },
  Choice: { tile: 'bg-info-bg border-info-bd', icon: 'text-info-fg' },
};

/** Ánh xạ lời hứa → icon. Tách ra để hai chỗ dùng không tự chọn icon riêng. */
export function TrustIcon({ k, className }: { k: TrustKey; className?: string }) {
  if (k === 'Verified') return <CertifiedIcon size={20} className={className} />;
  if (k === 'Price') return <PriceTagIcon size={20} className={className} />;
  return <ChoiceIcon size={20} className={className} />;
}

/**
 * Tên miền ở cỡ chữ lớn, với dấu chấm được siết lại hai bên.
 *
 * Font display đặt "." giữa một ô ký tự rộng: đã đo ở 60px, dấu chấm chiếm **23,2px**
 * trong khi mực thật chỉ ~8px. Hệ quả là "MasGo.vn" đọc ra thành "MasGo . vn" — ba mảnh
 * rời thay vì một tên miền. `letter-spacing` không chữa được vì nó chỉ thêm khoảng
 * **giữa** các ký tự, không thu hẹp chính ô đó; chỉ margin âm đặt lên riêng dấu chấm mới
 * làm được.
 *
 * **Đây KHÔNG phải là ngoại lệ với luật "không cắt chuỗi bằng JS"** đã ghi ở `vi.ts` và
 * ở jsdoc dưới. Luật đó cấm cắt chuỗi để **chia vai trò hiển thị** — vế nào vào cỡ chữ
 * nào, vế nào vào key nào — vì ranh giới đó là quy ước của riêng vi/en. Ở đây thì ngược
 * lại: mọi mảnh đều giữ đúng vai trò cũ, cùng cỡ chữ, cùng màu, cùng thứ tự; thứ duy
 * nhất thay đổi là khoảng trắng quanh một glyph. Chuỗi đọc ra không đổi một ký tự nào,
 * nên trình đọc màn hình và phép copy vẫn cho đúng "MasGo.vn".
 *
 * Và nó an toàn với bản dịch theo cách `split(' ')` không bao giờ an toàn: chuỗi không
 * có dấu chấm thì `split('.')` trả về đúng một phần tử, hàm render nguyên văn, không có
 * nhánh nào hỏng. Tên miền cũng là thứ **không dịch** (xem ghi chú `logoTagline`), nên
 * dấu chấm ở đây là dấu phân cách kỹ thuật chứ không phải dấu câu của một ngôn ngữ.
 */
function BrandDomain({ value }: { value: string }) {
  const parts = value.split('.');

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            /* `-mx-[0.12em]` cắt bớt đúng phần ô thừa hai bên dấu chấm. Dùng `em` chứ
               không `px`: cỡ chữ đổi giữa mobile (48px) và desktop (60px), nên một giá
               trị px sẽ siết đúng ở một cỡ và sai ở cỡ kia. */
            <span className="-mx-[0.12em] inline-block">.</span>
          )}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Nét gạch chân vẽ tay dưới tên miền trong khẩu hiệu — thuần trang trí, `aria-hidden`.
 *
 * **Đây là cách "thay chữ bằng hình ảnh" mà KHÔNG bỏ chữ đi.** Yêu cầu ban đầu là thay
 * cả khối chữ bằng một file ảnh; ba lý do khiến nó không được làm như vậy, và cả ba là
 * ràng buộc của riêng khối này:
 *
 * 1. Khẩu hiệu nằm trong HTML thô của trang chủ. Thành `<img>` thì Google chỉ còn đọc
 *    được `alt`, trên đúng trang của kênh acquisition chính.
 * 2. Khối này song ngữ. Ảnh nghĩa là hai file phải tự giữ cho khớp nhau mãi mãi — cùng
 *    hình dạng lỗi mà `TRUST_KEYS` ở trên sinh ra để chặn.
 * 3. Nó nằm ngay dưới đường gấp trên trang đang đo LCP; một ảnh chữ ở đây phải tải thêm
 *    bytes và tranh LCP với chính ảnh hero.
 *
 * SVG inline giải quyết cả ba: 0 request, 0 byte ảnh, chữ vẫn là chữ thật và tự dịch.
 * Cùng chính sách với luật "icon vẽ inline SVG" của dự án.
 *
 * **`preserveAspectRatio="none"` là bắt buộc, không phải tuỳ chọn.** Nét này chạy hết bề
 * rộng `sloganBrand`, vốn đổi theo cỡ chữ ở `sm:` — và sẽ đổi theo bản dịch nếu tên miền
 * có ngày được viết khác. Giữ tỉ lệ thì nét chỉ vừa đúng một bề rộng và hụt hoặc thừa ở
 * mọi bề rộng còn lại. Cái giá là nét bị kéo giãn, nên mỗi `path` khai
 * `vectorEffect="non-scaling-stroke"`: thiếu nó thì độ dày nét co giãn theo hộp và bản
 * mobile ra nét mảnh hơn hẳn bản desktop.
 *
 * Nét dùng `champagne-400/60`, giữ nguyên màu của vạch gạch chân mà nó thay thế: đây
 * vẫn là **cùng một ngoại lệ đã cân nhắc** với luật "champagne chỉ dành cho vị trí trả
 * phí", không phải một ngoại lệ thứ hai. Và vì cùng lý do đó nó **không animate** —
 * xem ghi chú ở chỗ dùng.
 */
function SloganMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 40"
      preserveAspectRatio="none"
      fill="none"
      className="pointer-events-none absolute inset-x-0 top-full h-[0.3em] w-full -translate-y-[0.2em] text-champagne-400/60"
    >
      {/*
        Gạch chân vẽ tay, KHÔNG phải vòng khoanh quanh chữ.

        Bản đầu vẽ một vòng ellipse bao quanh tên miền. Đã chụp ở 1440 và 390 và bác
        bằng mắt: `preserveAspectRatio="none"` kéo vòng đó dẹt theo hộp chữ, nên hai
        cạnh dài của nó **cắt ngang thân chữ** thay vì ôm lấy — đúng chỗ nó làm chính
        tên thương hiệu khó đọc hơn. Số đo không bắt được ca này (hộp vẫn ôm đúng bề
        rộng chữ, 290,6px ở 1440); chỉ ảnh chụp mới cho thấy.

        Gạch chân giữ được cử chỉ vẽ tay mà không bao giờ chồng lên chữ, vì nó nằm
        hẳn dưới đường chân chữ (`top-full`). Đây cũng là lý do khối `viewBox` dẹt
        hẳn (300×40): ít chiều cao thì `preserveAspectRatio="none"` ít bóp méo nét.
      */}
      {/*
        Biên độ cong trong `viewBox` phải **phóng đại**, vì hộp 40 đơn vị cao bị nén
        xuống 0,42em: mọi độ lệch dọc co lại theo đúng tỉ lệ đó. Bản đầu vẽ nét lệch
        4–6 đơn vị và sau khi nén nó ra một đường **thẳng tắp** — đọc ra là
        `border-bottom`, đúng thứ nét vẽ tay sinh ra để tránh. Đã chụp và bác. Nét nay
        lệch ~20 đơn vị, tức vẫn thấy được sau khi nén.
      */}
      <path
        d="M6 30C58 8 132 4 198 12c32 4 64 10 96 20"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Nét thứ hai mảnh hơn, lệch và ngắn hơn — hai lượt bút chứ không một đường
          kẻ. Một nét đơn đều tăm tắp đọc ra là `border-bottom`, không ra vết bút. */}
      <path
        d="M30 38C92 20 160 18 232 30"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity=".55"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Dải khẩu hiệu ngay dưới hero: câu định vị bên trái, ba lời hứa bên phải.
 *
 * **Khẩu hiệu dùng `font-display`, KHÔNG tải font script.** Bản thiết kế vẽ nó bằng
 * một kiểu chữ viết tay, nhưng thêm bộ chữ thứ tư chỉ để phục vụ một dòng là +30–60KB
 * phải tải, một vòng `@font-face` nữa phải giải quyết, và — vì khối này nằm ngay dưới
 * đường gấp — một nguồn CLS mới trên đúng trang đang được đo LCP. Ba bộ chữ hiện có
 * đều đã kèm subset tiếng Việt; bộ thứ tư mà thiếu subset đó thì chính chữ "Cần" rơi
 * về font hệ thống, tức hỏng ngay ở từ đầu tiên của khẩu hiệu.
 *
 * Sức nặng thị giác vì vậy lấy từ **thứ đã có sẵn**: thang chữ (`display-l` 60px/800),
 * thang màu brand, và nhịp hai phách dẫn–đáp. Khẩu hiệu tách làm **ba** key
 * (`sloganAsk` / `sloganVerb` / `sloganBrand`) chứ không cắt chuỗi bằng JS, và dấu câu
 * nối hai vế nằm **trong** chuỗi chứ không dựng cứng ở JSX: cả dấu nối lẫn dấu cách đều
 * là quy ước của riêng vi/en, bản dịch khác không chắc có chúng — và lúc đó `split` ném
 * nửa câu vào sai cỡ chữ. Xem ghi chú ở `vi.ts`.
 *
 * Vế trả lời tô bằng `bg-clip-text` + `text-transparent`. Luôn khai `text-brand-600`
 * cùng lúc: trình duyệt không hỗ trợ `background-clip: text` sẽ bỏ qua hai lớp kia và
 * rơi về màu nền — thiếu nó thì chữ trong suốt là chữ **vô hình**, hỏng im lặng và chỉ
 * hỏng ở đúng nhóm trình duyệt không ai thử.
 *
 * **Đổi quyết định (2026-09-12): khối này CÓ chuyển động.** Bản trước ghi "không có
 * animation: khối nằm ngay dưới đường gấp trên trang đang đo LCP, và một chuyển động ở
 * đây chỉ đổi lấy nhiễu chứ không thêm thông tin nào". Lý do đó vẫn đúng về LCP — nên
 * cách làm mới **tôn trọng nó thay vì bỏ nó**: ảnh hero (LCP element) không bị chạm tới,
 * và ở đây chỉ có (a) một lượt `fade-up` do IntersectionObserver kích hoạt, chỉ
 * `opacity` + `transform`, và (b) `background-position` chạy trên chính chữ gradient đã
 * có. Không thuộc tính nào gây layout, nên không thêm CLS và không có việc gì để trì
 * hoãn LCP.
 *
 * Phần đánh đổi được chấp nhận có ý thức: dải này nay động nhẹ ngay dưới đường gấp. Đổi
 * lại trang chủ đọc ra là một sản phẩm sống chứ không phải một tài liệu tĩnh, và
 * `prefers-reduced-motion` tắt sạch cả hai vế (khối @media trong globals.css + chặn ở JS
 * trong `Reveal.tsx`). Ai muốn quay lại trạng thái tĩnh thì bỏ `<Reveal>` và class
 * `animate-pan` — nhưng **đừng** bỏ `text-brand-600` kèm `bg-clip-text` ở dưới, đó là
 * chuyện khác và bỏ nó là làm chữ vô hình.
 *
 * Hai con số của `siteStats` về đây sau khi khối `<dl>` ở hero bị gỡ, và mỗi con số
 * chỉ gắn vào đúng lời hứa mà nó thật sự chứng minh — số hồ sơ đã đối chiếu chứng cho
 * "hồ sơ xác thực", điểm trung bình chứng cho "chủ động lựa chọn". "Giá cả minh bạch"
 * cố ý không có số: sàn không thu phí nào để mà khoe một con số ở đó.
 */
export function HomeSloganBand({
  stats,
  locale,
  t,
}: {
  stats: SiteStats;
  locale: Locale;
  t: Translator;
}) {
  const intl = INTL_LOCALE[locale];

  /*
    Giữ nguyên nguyên tắc của `buildHomeStats` cũ: ô chưa có dữ liệu thật thì bỏ hẳn,
    không hiện "—" hay số 0. Ở đây lý do mạnh hơn hẳn — "0 hồ sơ đã đối chiếu chứng
    chỉ" đặt ngay dưới câu "Hồ sơ xác thực" là tự phản bác chính mình.

    Cả hai con số đều đi qua `INTL_LOCALE`: bản EN phải ra "4.6", không phải "4,6" —
    con số sai quy ước dấu phân cách vẫn trông như một con số hợp lệ nên không ai báo lỗi.
  */
  const proof: Partial<Record<TrustKey, string>> = {};

  if (stats.verifiedKtvCount > 0) {
    proof.Verified = t('home.trustProofVerified', {
      n: stats.verifiedKtvCount.toLocaleString(intl),
    });
  }

  if (stats.ratingAvg !== null) {
    proof.Choice = t('home.trustProofRating', {
      value: stats.ratingAvg.toLocaleString(intl, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    });
  }

  return (
    /* `-mx-4` giống hero: hai dải liền nhau cùng tràn hết chiều ngang màn hình,
       trong khi nội dung vẫn thẳng hàng với phần còn lại của trang.

       Nền chuyển từ trắng phẳng sang gradient xuống `brand-50`, nối liền với đáy
       hero (vốn kết ở trắng) nên hai dải đọc thành một mạch thay vì hai tấm dán. */
    <Reveal
      as="section"
      className="-mx-4 border-b border-ink-200 bg-gradient-to-b from-white to-brand-50 px-4 py-10 sm:py-12"
    >
      <div className="mx-auto grid max-w-shell items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)] lg:gap-14">
        <p className="text-balance font-display">
          <span className="block text-h3 font-semibold text-ink-700 sm:text-h2">
            {t('home.sloganAsk')}
          </span>
          {/*
            Vế trả lời có HAI cỡ chữ, không một: động từ nhỏ, tên miền lớn.

            Đây là thứ trước đây một `sloganAnswer` duy nhất không diễn đạt được. Trọng
            âm của câu nằm ở **tên sàn**, không ở động từ — "Bật" chỉ là lời dẫn, còn
            masgo.vn là thứ cần đọng lại. Cho cả hai cùng cỡ `display` thì động từ chiếm
            đúng phần sức nặng thị giác mà nó không cần đến, và trên bố cục hai cột hẹp
            này nó còn đẩy tên miền xuống dòng thứ hai.

            `items-baseline` chứ không `items-center`: hai cỡ chữ khác nhau phải đứng
            chung một đường chân chữ, đúng như khi chúng nằm trong cùng một dòng văn.
            Căn giữa sẽ nâng động từ nhỏ lên lơ lửng giữa thân chữ của tên miền.

            `flex-wrap` để bản dịch có động từ dài (hoặc màn hình rất hẹp) xuống dòng
            thay vì tràn ra khỏi cột.
          */}
          <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-h3 font-semibold text-ink-700 sm:text-h2">
              {t('home.sloganVerb')}
            </span>

            {/* Nét khoanh bám đúng bề rộng tên miền chứ không bề rộng cả dòng — đã đo:
                hộp này rộng đúng bằng chữ (290,6px ở 1440, 234,3px ở 390), nét thừa đều
                12px mỗi bên. Bề rộng co theo chữ vì đây là **flex item**, không phải vì
                một class `inline-block` (flex item luôn bị blockify, nên class đó không
                có tác dụng ở đây — đừng thêm lại vì tưởng nó đang giữ bố cục).

                Nét nằm ở lớp dưới (`SloganMark` không có `z-10`) nên nó chạy **sau** chữ
                chứ không đè lên, đúng như vết bút khoanh vào chữ đã in. */}
            <span className="relative">
              {/* `bg-[length:200%_100%]` là **điều kiện** để `animate-pan` thấy được:
                  `background-position` theo phần trăm chỉ dịch được một background rộng
                  hơn hộp của nó. Bỏ nó thì class `animate-pan` vẫn chạy mà không đổi một
                  pixel nào — hỏng im lặng. */}
              {/*
                `tracking-[-0.045em]` siết hơn mặc định của `display-l` (-0.03em) — ở cỡ
                60px khoảng cách mặc định trông rời rạc, đúng như ghi chú thang chữ trong
                `tailwind.config.ts` đã nói.

                Nhưng nó **không** đủ cho dấu chấm, và đó là hai việc khác nhau. Đã đo
                từng ký tự ở 60px: "." chiếm **23,2px** — gần bằng chữ "s" (29,2px) —
                trong khi phần mực thật chỉ khoảng 8px. Font display đặt dấu chấm giữa
                một ô rộng, và `letter-spacing` chỉ thêm khoảng **giữa** các ký tự chứ
                không thu hẹp được chính ô đó. Nên "MasGo.vn" đọc ra thành "MasGo . vn":
                ba mảnh rời thay vì một tên miền.

                Vì vậy dấu chấm tách thành `<span>` riêng với margin âm hai bên. Đây là
                lý do `sloganBrand` KHÔNG render thẳng bằng `{t(...)}` nữa — xem ghi chú
                ở `BrandDomain`. Cả hai lỗi chỉ thấy được qua ảnh chụp; typecheck, lint
                và số đo bề rộng hộp đều xanh với bản sai.
              */}
              <span className="relative z-10 animate-pan bg-brand-pan bg-[length:200%_100%] bg-clip-text text-display font-extrabold tracking-[-0.045em] text-brand-600 text-transparent sm:text-display-l">
                <BrandDomain value={t('home.sloganBrand')} />
              </span>
              {/* Nét khoanh champagne — ngoại lệ có chủ ý với luật "champagne chỉ dùng
                  cho vị trí trả phí": nó không gắn với hồ sơ hay gói nào nên không làm
                  loãng tín hiệu "đây là chỗ được mua". `aria-hidden` vì thuần trang trí.

                  Trước 2026-09-12 đây là một vạch gạch chân phẳng 3px. Đổi sang nét vẽ
                  tay là cách đáp ứng yêu cầu "thay chữ bằng hình ảnh" mà **không** bỏ
                  chữ đi — xem jsdoc của `SloganMark` cho ba lý do.

                  **Cố ý KHÔNG animate**, và luật này không đổi theo hình dạng của nét:
                  một nét vàng đang chuyển động là đúng thứ tín hiệu "vị trí trả phí" mà
                  luật trên đang bảo vệ. Đợt thêm chuyển động cho trang chủ không nới
                  ngoại lệ này ra thành hai. */}
              <SloganMark />
            </span>
          </span>
        </p>

        {/*
          Ba lời hứa là **thẻ có viền — nhưng chỉ từ `sm:` trở lên**. Ở desktop ba khối
          chữ cùng màu cạnh nhau đọc thành một đoạn văn ba cột, nên đóng khung là thứ
          làm chúng đọc thành ba lời hứa riêng.

          Ở mobile thì ngược lại: ba mục đã xếp dọc nên chúng vốn tách nhau rõ, và khung
          chỉ thêm chiều cao. **Đã đo ở 390px**: bản đóng khung ở mọi cỡ đẩy dải này từ
          683px lên 769px (+86px) — gần một phần mười màn hình điện thoại trả cho một
          đường viền không phân biệt thêm điều gì. Nên `border`/`bg`/`p-4` đều gate `sm:`,
          và ở mobile chỉ còn ô icon màu (`TRUST_TONE`) làm việc phân biệt.

          `rv-stagger` để ba mục cascade theo `[data-reveal='in']` của `<Reveal>` bọc
          ngoài — xem luật nth-child trong globals.css.
        */}
        <ul className="rv-stagger grid gap-6 sm:grid-cols-3">
          {TRUST_KEYS.map((key) => (
            <li
              key={key}
              className="group rounded-xl transition duration-200 ease-out-soft sm:border sm:border-ink-200 sm:bg-white/70 sm:p-4 sm:shadow-[0_1px_2px_rgba(13,27,42,.04)] sm:backdrop-blur-[2px] sm:hover:-translate-y-1 sm:hover:border-brand-300 sm:hover:shadow-card-hover"
            >
              {/* `backdrop-blur` cũng gate ở `sm:`: ở mobile không có khung nào để làm
                  mờ phía sau, mà vẫn tốn một lượt composite. */}
              {/*
                Icon nằm TRÊN tiêu đề ở đây, khác ba thẻ bước của section tối (nơi số và
                tiêu đề cùng một hàng). Hai khối cố ý khác nhau, và lý do là số đo chứ
                không phải sở thích:

                cột thẻ ở dải này chỉ rộng **181px** (lưới `0.9fr / 1.6fr`, ba thẻ chia
                nửa phải), còn tiêu đề dài nhất — "Chủ động lựa chọn" — cần **175px** cho
                một dòng. Đặt icon 40px cùng hàng chỉ để lại 129px, nên cả ba tiêu đề
                ngắt thành hai dòng ("Hồ sơ / xác thực"). Nới cột phải ra đủ rộng thì cột
                trái còn 221px, mà chính khẩu hiệu "Bật MasGo" cần **244px** — tức khẩu
                hiệu bị ngắt thay. Trong bố cục hai cột này, "icon cùng hàng" và "khẩu
                hiệu một dòng" không thể cùng có.

                Muốn đổi thì phải đổi bố cục dải (khẩu hiệu lên một hàng riêng, ba thẻ
                chiếm hết 1128px), không phải chỉ đổi hàng của icon.
              */}
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg border transition duration-200 ease-out-soft group-hover:scale-[1.08] ${TRUST_TONE[key].tile} ${TRUST_TONE[key].icon}`}
              >
                <TrustIcon k={key} className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-display text-h4 text-ink-900">
                {t(`home.trust${key}Title`)}
              </h3>
              <p className="mt-1 text-body leading-6 text-ink-600">{t(`home.trust${key}Body`)}</p>
              {proof[key] && (
                <p className="tabular mt-1.5 font-mono text-caption text-ink-500">{proof[key]}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Reveal>
  );
}
