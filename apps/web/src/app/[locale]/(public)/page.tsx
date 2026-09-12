import Image from 'next/image';
import Link from 'next/link';

import verifyImage from '../../../../public/hero-massage-tan-noi-2.jpg';

import { HeroSearch } from '@/components/HeroSearch';
import { HomeHeroMedia } from '@/components/HomeHeroMedia';
import { HomeSloganBand, TRUST_KEYS, TRUST_TONE, TrustIcon } from '@/components/HomeSloganBand';
import { JsonLd } from '@/components/JsonLd';
import { Reveal } from '@/components/Reveal';
import { ServiceIcon } from '@/components/ServiceIcon';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { translateAreaName } from '@/i18n/area-name';
import { INTL_LOCALE, localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { serviceName, serviceDescription } from '@/lib/service-i18n';
import { SITE_NAME, absolute, areaPath, formatVnd } from '@/lib/site';

// Render theo request thay vì prerender lúc build: build không được phụ thuộc vào
// một API đang chạy, nếu không CI phải dựng cả stack chỉ để đóng gói frontend.
//
// Dữ liệu vẫn đi qua cache fetch (`next: { revalidate }` trong lib/api) nên API
// KHÔNG bị gọi lại mỗi request — `force-dynamic` bỏ prerender, nó không vô hiệu
// hoá cache của từng fetch. Đã đo ngày 2026-09-04 bằng pg_stat_user_tables: 10 lần
// tải trang này sinh đúng 0 lần chạm DB, và độ trễ ngang trang tĩnh thật.
//
// Vì vậy `ƒ (Dynamic)` trong bảng output của `next build` ở đây là đúng thiết kế.
// Đừng thêm generateStaticParams để đổi nó thành `○`: xem ghi chú trong
// .claude/rules/project-status.md.
export const dynamic = 'force-dynamic';

/** Ba bước duyệt hồ sơ — nội dung tĩnh, là chính sách chứ không phải dữ liệu. */
const VERIFICATION_STEP_KEYS = ['step1', 'step2', 'step3'] as const;

/**
 * Sắc nền xoay vòng cho các thẻ tỉnh. Bốn thẻ cùng `bg-white` đọc thành một bảng; xoay
 * sắc làm chúng đọc thành bốn nơi khác nhau.
 *
 * Chỉ dùng token đã có (`brand-50/100`, `info-bg`, `ink-50`) — không thêm họ màu nào.
 * Cố ý KHÔNG có champagne trong danh sách: nó là tín hiệu "vị trí trả phí", và một thẻ
 * khu vực nhuộm vàng sẽ đọc như một khu vực được mua chỗ.
 *
 * Độ dài 4 và index lấy **modulo**: `provinces` hiện `.slice(0, 4)`, nhưng nếu ai nâng
 * giới hạn đó lên thì chỗ này không được trả về `undefined` và ném class rỗng.
 */
const AREA_TINT = [
  'bg-gradient-to-br from-brand-50 to-white border-brand-200',
  'bg-gradient-to-br from-info-bg to-white border-info-bd',
  'bg-gradient-to-br from-brand-100 to-white border-brand-200',
  'bg-gradient-to-br from-ink-50 to-white border-ink-200',
] as const;

export default async function HomePage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  const siteName = SITE_NAME[locale];

  const [areas, services, stats] = await Promise.all([
    api.areaTree(),
    api.services(),
    api.siteStats(),
  ]);

  // Chỉ tỉnh **thật sự có KTV**, nhiều nhất lên trước. Lọc trước rồi mới cắt, không
  // phải cắt rồi hiện cả tỉnh rỗng: khối này mời khách bấm vào một khu vực, nên một
  // thẻ "0 KTV" vừa dẫn khách tới trang trống vừa nói ngược lại con số ở hero.
  const provinces = areas
    .filter((p) => p.ktvCount > 0)
    .sort((a, b) => b.ktvCount - a.ktvCount)
    .slice(0, 4);

  return (
    <>
      {/* Hero tràn ra ngoài padding của <main> bằng margin âm để dải nền chạy hết
          chiều rộng màn hình, trong khi nội dung vẫn thẳng hàng với phần còn lại
          của trang. */}
      <section className="relative isolate -mx-4 -mt-8 overflow-hidden border-b border-brand-200 bg-gradient-to-b from-brand-100 via-brand-50 to-white px-4 pb-14 pt-12 sm:-mt-10 sm:pb-14 sm:pt-16">
        {/*
          Lưới gradient trôi chậm. Thuần CSS: một `background-image` ba đốm radial,
          animate bằng `background-position` — không đụng layout, không đụng ảnh hero,
          nên không có cửa nào ảnh hưởng LCP hay CLS.

          `bg-[length:140%_140%]` là **bắt buộc**: `background-position` theo phần trăm
          chỉ dịch được background lớn hơn hộp của nó, mà radial-gradient mặc định đúng
          bằng hộp. Thiếu nó thì `animate-drift` chạy mà không đổi một pixel nào.

          Đặt ở lớp con chứ không trên chính `<section>`: section mang gradient dọc làm
          nền, lớp này là thứ animate — tách ra thì paint của section không bị invalidate
          theo mỗi khung.

          `sm:animate-drift` chứ không `animate-drift` trần: ở 390px cả lưới gần như
          không thấy được (đốm rộng 38rem trên màn 24rem), nên mobile chỉ nhận bản tĩnh
          và không trả một lượt composite vô hạn cho thứ không ai nhìn thấy.

          `-z-10` để nằm dưới chữ, `pointer-events-none` để không chắn ô tìm kiếm, và
          `isolate` trên section để `-z-10` không chui lên trên header dính.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-hero-mesh bg-[length:140%_140%] sm:animate-drift"
        />

        {/*
          Cột trái nới từ `1.15fr` lên `1.35fr` (2026-09-13) — **số đo, không phải cảm
          giác**. Lưới rộng 1128px với gap 56px, nên `1.15fr` cho cột trái đúng 573px
          trong khi vế hai của H1 tiếng Việt ("Nền tảng kết nối dịch vụ massage tận nơi.")
          cần 612px ở cỡ 32px: nó ngắt hai dòng ngay giữa một câu. `1.35fr` cho 616px,
          vừa đủ. Cột phải còn 456px, vẫn dư cho ảnh hero `object-cover`.

          Cách còn lại là rút cỡ chữ xuống 28px (vừa ở 537px), đã cân nhắc và bác: câu
          chữ mới ngắn hơn hẳn bản cũ nên hạ cỡ là bỏ đi đúng phần khoảng trống vừa được
          dọn ra. Nới cột không đụng tới thang chữ.

          **Bản EN vẫn ngắt hai dòng ở vế hai và đó là chấp nhận có chủ ý**: nó cần 731px
          ở cỡ 32px, tức không ratio nào trong lưới này đủ. Đừng "sửa" bằng cách hạ cỡ chữ
          chung cho cả hai bản — làm vậy là để bản phụ quyết định thang chữ của bản chính.
        */}
        <div className="mx-auto grid max-w-shell items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
          {/*
            Chuỗi entrance của cột trái, kết thúc ở ~900ms. Hero nằm TRÊN đường gấp nên
            cố ý **không** dùng `<Reveal>`: nó chạy ngay ở frame đầu bằng CSS thuần,
            không observer, không chờ JS.

            Chuỗi này không trì hoãn LCP, và đây là phép đo chứ không phải phỏng đoán:
            ảnh hero thắng LCP ở **cả** mobile (390px cho ảnh 100vw × 260px ≈ 101k px²,
            còn H1 `text-h2` ba dòng ≈ 38k px²), và `opacity` không bao giờ gỡ nội dung
            khỏi DOM hay a11y tree như `display:none`. Ai đổi bố cục hero phải đo lại
            đúng phép tính đó.
          */}
          <div>
            {/*
              H1 hai dòng: dòng đầu là khẩu hiệu mang tên miền, dòng sau nói sàn là cái gì.

              Vế sau nói ĐÚNG thứ sàn làm — **kết nối**, không phải "đặt lịch". Hệ thống
              không có thực thể lịch hẹn nào: khách bấm liên hệ, backend ghi lead rồi trả
              số điện thoại, và khách tự gọi. Cũng không nhắc "cơ sở, spa" vì chỉ có hồ sơ
              KTV cá nhân (`ktv_profiles.user_id` UNIQUE), không có thực thể doanh nghiệp.

              Mỗi vế là một `block` riêng ở **mọi** cỡ màn hình, không phải hai chuỗi
              chảy chung. Để chúng chảy chung thì ở desktop vế đầu tự ngắt giữa chừng
              (gãy giữa một từ), còn ở mobile hai vế dính liền nhau thành một câu không
              có nghĩa. Cả hai đều đã thấy trong trình duyệt thật.

              Cỡ 32px khai ở `xl:` chứ KHÔNG phải `lg:` — **đo ra chứ không chọn theo cảm
              giác**, và đây là chỗ dễ đảo ngược nhất trong khối này. Lưới hai cột bật ở
              `lg` (1024px), nhưng ở đúng 1024px cột trái mới rộng 538px, trong khi vế hai
              tiếng Việt cần 612px ở cỡ 32px: khai ở `lg:` thì màn hình 1024–1279px nhận cỡ
              lớn nhất trong cột hẹp nhất, tức ngắt hai dòng ngay giữa câu. Ở `xl` (1280px+)
              cột đạt 616px và vế đó vừa khít một dòng.

              Số đo đầy đủ ở cỡ 32px / cột 616px: vế một VI 443px, vế hai VI 612px, vế một
              EN 517px, vế hai EN 731px (ngắt hai dòng, chấp nhận có chủ ý — xem comment
              của lưới bên trên). Ai muốn phóng to lại phải đo lại bằng cùng phép tính đó
              trên **cả hai** bản dịch, hoặc rút ngắn chính câu chữ.

              Cũng vì vậy KHÔNG dùng `text-balance`: nó cân đều số chữ giữa các dòng, nên
              với H1 hai vế nó chủ động tạo ra bốn dòng cân nhau — đúng thứ cấu trúc này
              sinh ra để tránh.

              **Huy hiệu "{n} kỹ thuật viên đã đối chiếu danh tính" đứng trên H1 và đoạn mô
              tả dưới H1 đã bỏ** (2026-09-13, theo artboard), nên `mt-[18px]` cũ — vốn là
              khoảng cách tới huy hiệu — đã gỡ: H1 nay là phần tử đầu của cột.

              Không nội dung nào mất theo: lời hứa đối chiếu danh tính vẫn ở hàng chip
              `TRUST_KEYS` ngay dưới đây và ở ba thẻ của dải khẩu hiệu, còn `verifiedKtvCount`
              vẫn hiển thị ở `HomeSloganBand`. Đó cũng là lý do bỏ được mà không phải dựng
              lại lời khai ở chỗ khác — đừng thêm ngược lại vào hero vì "trang trông trống":
              chỗ trống đó là thứ đẩy ô tìm kiếm lên cao hơn trong màn hình đầu.
            */}
            <h1 className="text-h2 text-ink-900 sm:text-[28px] sm:leading-[36px] xl:text-[32px] xl:leading-[42px]">
              <span className="block animate-fade-up [animation-delay:60ms]">
                {t('home.heroTitleLine1')}
              </span>
              <span className="block animate-fade-up text-brand-600 [animation-delay:180ms]">
                {t('home.heroTitleLine2')}
              </span>
            </h1>

            {/*
              Ba lời hứa, bản rút gọn. `<ul>` chứ không ba `<span>`: đây là một danh
              sách, và khoảng cách giữa các mục là trang trí CSS — trình đọc màn hình
              không nên phải nghe thêm ký tự phân cách nào.

              Dùng chung `TRUST_KEYS` với dải khẩu hiệu bên dưới, nên hai chỗ không thể
              nói lệch nhau.
            */}
            <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-body-s font-medium text-ink-700">
              {TRUST_KEYS.map((key, i) => (
                <li
                  key={key}
                  className="inline-flex animate-fade-right items-center gap-1.5"
                  // `style` inline chứ không `[animation-delay:*]`: Tailwind JIT cần một
                  // chuỗi literal trong source, nó không thấy được biến vòng lặp.
                  // Nối tiếp vế hai của H1 (180ms), so le 90ms mỗi chip. Rút từ 380ms
                  // xuống khi đoạn mô tả dưới H1 bị bỏ: giữ nguyên là để lại một quãng
                  // trống 200ms giữa hai khối không còn gì đứng xen vào.
                  style={{ animationDelay: `${300 + i * 90}ms` }}
                >
                  {/* Mỗi lời hứa một màu riêng theo `TRUST_TONE` — dùng chung với ba thẻ
                      ở dải khẩu hiệu bên dưới, nên hai chỗ không thể nói lệch nhau. Ba
                      icon cùng `text-brand-500` như trước đọc thành một vệt xanh. */}
                  <TrustIcon k={key} className={`h-4 w-4 shrink-0 ${TRUST_TONE[key].icon}`} />
                  {t(`home.trust${key}Title`)}
                </li>
              ))}
            </ul>

            {/* 580ms: ngay sau chip cuối (300 + 2×90 = 480ms). Khối này là thứ khách
                mobile thật sự cần, nên khi đoạn mô tả dưới H1 bị bỏ thì nó rút theo
                (660ms → 580ms) thay vì đứng chờ đúng chỗ cũ. */}
            <div className="mt-7 animate-fade-up [animation-delay:580ms]">
              <HeroSearch services={services} locale={locale} />
            </div>
          </div>

          <HomeHeroMedia t={t} />
        </div>
      </section>

      <HomeSloganBand stats={stats} locale={locale} t={t} />

      {/*
        Section đảo nền — khối DUY NHẤT của trang chủ trên nền tối, và chọn đúng khối này
        chứ không khối khác vì ba lý do:

        (a) Nội dung ở đây là **chính sách**, không phải dữ liệu API: không có cổng
            `length > 0` nào có thể làm nó rỗng, nên không bao giờ có cảnh một tấm nền
            tối trống trơn. Khối khu vực (`provinces.length > 0`) và khối dịch vụ
            (danh sách từ API) đều rỗng được.
        (b) Nó là khối lập luận về niềm tin — nền nặng hơn đọc ra "đây là phần nghiêm
            túc", đúng việc khối này phải làm.
        (c) Nó nằm giữa trang, kẹp giữa hai khối sáng, nên cú đảo nền tạo đúng MỘT nhịp
            ngắt ở giữa thay vì làm trang trông vá.

        `-mx-4` như hero và dải khẩu hiệu: nền tràn hết chiều ngang, chữ vẫn thẳng hàng.
        `id` đi qua prop của `<Reveal>` chứ không dời xuống div con — footer trỏ tới neo
        này (`PublicShell`), và `scroll-mt-20` đo từ chính element mang `id`.
      */}
      <Reveal
        as="section"
        id="cach-duyet-ho-so"
        className="-mx-4 mt-14 scroll-mt-20 border-y border-brand-800 bg-brand-900 px-4 py-12 sm:py-14"
      >
        <div className="mx-auto max-w-shell">
          <h2 className="text-h2 text-white sm:text-[28px] sm:leading-[34px]">
            {t('home.verifyTitle')}
          </h2>
          {/* `text-brand-300` (#a8cdf1) trên `brand-900` (#06243f) ≈ 8.6:1. KHÔNG dùng
              `text-ink-600` ở đây: nó chỉ đạt ~2.0:1 trên nền này, tức không đọc được. */}
          <p className="mt-1.5 max-w-prose text-body-l text-brand-300">
            {t('home.verifySubtitle')}
          </p>
  
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-8">
            {/*
              Ảnh minh hoạ chính cái đang được nói tới ở đây: một KTV đã qua đối chiếu
              đang làm việc. Không `priority` — khối này nằm dưới màn hình đầu tiên, nên
              để Next lazy-load; thêm `priority` ở đây là tranh băng thông với ảnh hero,
              tức làm chậm đúng chỉ số LCP mà hero đang giữ.
            */}
            <div className="relative hidden h-full min-h-[280px] overflow-hidden rounded-xl border border-brand-800 bg-brand-950 shadow-card-inverted lg:block">
              {/*
                Ảnh này cũng KHÔNG có animation, và vì một lý do khác ảnh hero: nó
                lazy-load, nên nếu observer kích hoạt trước lúc ảnh decode xong thì cú fade
                hoàn tất trên một ô trống rồi ảnh vẫn pop vào ở opacity đầy — trả giá mà
                không đổi lại được hiệu ứng nào. Cú `fade-up` của `<Reveal>` bọc ngoài đã
                mang cả khối này vào.
              */}
              <Image
                src={verifyImage}
                alt={t('home.verifyImageAlt')}
                fill
                sizes="(max-width: 1024px) 0px, 45vw"
                className="object-cover"
              />
              {/* Lớp phủ mỏng màu brand để ảnh nằm trong cùng không khí với nền tối, thay
                  vì là một ô sáng dán lên. `mix-blend-multiply` chứ không giảm opacity của
                  ảnh: giảm opacity làm ảnh bạc và mất chi tiết bàn tay. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-brand-900/25 mix-blend-multiply"
              />
            </div>
  
            {/*
              <ol> chứ không phải <ul>: đây là quy trình có thứ tự, và số bước là nội
              dung thật chứ không phải trang trí — nên nó nằm trong markup, không phải
              trong ::before của CSS.
            */}
            {/* `rv-stagger` trên `<ol>`, tức trên một CON của `<Reveal>`: khối tiêu đề
                (h2 + p) nhận một lượt `fade-up` của cha, rồi ba thẻ cascade. Đó là đúng
                thứ bậc — tiêu đề xuất hiện trước thứ nó giới thiệu. */}
            <ol className="rv-stagger grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {VERIFICATION_STEP_KEYS.map((key, i) => (
                <li
                  key={key}
                  className="group rounded-xl border border-brand-800 bg-brand-950/60 p-5 transition duration-200 ease-out-soft hover:-translate-y-1 hover:border-brand-400 hover:bg-brand-950 hover:shadow-card-inverted"
                >
                  {/*
                    Số bước và tiêu đề trên **cùng một hàng — nhưng chỉ từ `lg`**, và đó
                    là số đo chứ không phải sở thích.

                    Lưới đổi hình ở `lg`: `sm:grid-cols-3` xếp ba thẻ cạnh nhau (ở 768px
                    mỗi thẻ chỉ còn 190px bên trong), còn `lg:grid-cols-1` xếp chúng dọc
                    nên thẻ rộng hẳn ra. Tiêu đề dài nhất — "Đối chiếu danh tính và ký cam
                    kết" — cần **306px** cho một dòng, tức ở 768px nó ngắt nhiều dòng dù
                    có hàng ngang hay không, và thêm 28px icon + gap chỉ biến 2 dòng thành
                    3. Vì vậy dưới `lg` giữ số nằm trên.

                    `shrink-0` để ô vuông 28px không bị tiêu đề bóp thành hình chữ nhật.
                    `items-center` chứ không `items-baseline`: căn một hình vuông theo
                    đường chân chữ đẩy nó lên cao hơn khối chữ và trông như bị lệch.
                  */}
                  <div className="lg:flex lg:items-center lg:gap-3">
                    <span
                      aria-hidden
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-400/15 font-mono text-caption font-medium text-brand-300 ring-1 ring-brand-400/30 transition duration-200 ease-out-soft group-hover:bg-brand-400/25 group-hover:text-white"
                    >
                      {i + 1}
                    </span>
                    <h3 className="mt-3.5 font-display text-h4 text-white lg:mt-0">
                      {t(`home.${key}Title`)}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-body leading-6 text-brand-300 lg:mt-2.5">
                    {t(`home.${key}Body`)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>

      {provinces.length > 0 && (
      <Reveal as="section" className="mt-14">
        <h2 className="text-h2 text-ink-900 sm:text-[28px] sm:leading-[34px]">{t('home.areasTitle')}</h2>
        <p className="mt-1.5 text-body-l text-ink-600">
          {t('home.areasSubtitle')}
        </p>

        {/* Lưới hai cột chỉ khi có từ hai tỉnh trở lên: một thẻ đơn độc trong lưới
            hai cột để lại đúng một nửa trống, đọc như phần còn lại tải hỏng. */}
        <div className={`rv-stagger mt-6 grid gap-4 ${provinces.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {provinces.map((province, i) => (
            <div
              key={province.id}
              className={`group rounded-xl border p-5 shadow-[0_1px_2px_rgba(13,27,42,.04)] transition duration-200 ease-out-soft hover:-translate-y-1 hover:border-brand-400 hover:shadow-card-hover ${AREA_TINT[i % AREA_TINT.length]}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-h3">
                  <Link
                    href={areaPath(locale, province.slug)}
                    className="text-ink-900 transition group-hover:text-brand-700 hover:text-brand-600"
                  >
                    {translateAreaName(province.name, locale)}
                  </Link>
                </h3>
                {/* Số đếm từ chữ mono xám thành badge thật: nó là con số bán hàng của
                    khối này (bao nhiêu KTV ở đây), và chữ xám nhạt đặt nó ngang hàng
                    với metadata. Trắng trên `brand-500` = 6.4:1, AA pass. */}
                <span className="tabular shrink-0 rounded-full bg-brand-500 px-2.5 py-1 font-mono text-caption font-semibold text-white shadow-[0_1px_2px_rgba(13,27,42,.12)]">
                  {province.ktvCount} {t('common.ktvUnit')}
                </span>
              </div>

              {/*
                Quận có KTV lên trước rồi mới cắt còn 6: cắt theo thứ tự tên sẽ đẩy
                những quận rỗng lên đầu và làm cả tỉnh trông như không có ai.
              */}
              <ul className="mt-3.5 flex flex-wrap gap-2">
                {[...province.children]
                  .sort((a, b) => b.ktvCount - a.ktvCount)
                  .slice(0, 6)
                  .map((d) => (
                    <li key={d.id}>
                      {/* `group/chip` CÓ TÊN vì thẻ tỉnh bao ngoài đã là `group`: dùng
                          `group-hover` không tên ở số đếm bên dưới thì nó đổi sang màu
                          nhạt khi hover **cả thẻ**, tức nhạt trên nền nhạt. */}
                      <Link
                        href={areaPath(locale, province.slug, d.slug)}
                        className="group/chip inline-block rounded-md border border-brand-200 bg-white/80 px-[11px] py-1.5 text-body text-ink-700 transition duration-200 ease-out-soft hover:-translate-y-px hover:border-brand-500 hover:bg-brand-500 hover:text-white hover:shadow-button"
                      >
                        {translateAreaName(d.name, locale)}
                        {/* Dấu · tách tên khỏi số: thiếu nó thì "Quận 4" cạnh số 6
                            đọc dính thành "Quận 4 6".
                            Phải đổi màu theo chip: `text-ink-500` trên nền `brand-500`
                            khi hover là xám trên xanh đậm, không đọc được. */}
                        {d.ktvCount > 0 && (
                          <span className="tabular ml-1.5 font-mono text-ink-500 transition group-hover/chip:text-brand-200">
                            · {d.ktvCount}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Reveal>
      )}

      <Reveal as="section" className="mt-14">
        <h2 className="text-h2 text-ink-900 sm:text-[28px] sm:leading-[34px]">{t('home.servicesTitle')}</h2>
        <p className="mt-1.5 text-body-l text-ink-600">
          {t('home.servicesSubtitle')}
        </p>

        {/* Thẻ dịch vụ giữ nền trắng dù cả trang đã nhuộm thêm màu: đây là khối cuối
            trước footer và nằm ngay sau section nền tối, nên nó là nhịp lặng cần thiết.
            Màu ở đây đến từ hover và từ pill giá, không từ nền. */}
        <ul className="rv-stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={localePath(locale, `/dich-vu/${s.slug}`)}
                className="group relative flex h-full gap-3.5 overflow-hidden rounded-xl border border-ink-200 bg-white p-[18px] transition duration-200 ease-out-soft hover:-translate-y-[5px] hover:border-brand-400 hover:shadow-card-hover"
              >
                {/* Lượt sáng chéo khi hover — chỉ `transform` trên một lớp `aria-hidden`,
                    và `overflow-hidden` của thẻ giữ nó trong khung.
                    KHÔNG dùng keyframe: một `transition` trên `translate` đi theo đúng
                    nhịp trỏ chuột vào/ra, còn keyframe thì chạy hết một vòng dù chuột đã
                    rời từ lâu. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-brand-100/70 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                />

                {/* Ô icon sáng LÊN khi hover chứ không đảo sang `brand-500`: mỗi
                    `ServiceIcon` mang một điểm champagne cố định (`ACCENT` #c2952f), và
                    nó chỉ còn ~1.9:1 trên nền brand-500 — dấu nhận diện của sản phẩm
                    biến mất đúng lúc khách đang trỏ vào. */}
                <span className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 transition duration-200 ease-out-soft group-hover:scale-110 group-hover:bg-brand-200 group-hover:text-brand-700">
                  <ServiceIcon slug={s.slug} className="h-[21px] w-[21px]" />
                </span>

                {/* `relative` để chữ nằm TRÊN lớp sáng: thiếu nó thì lượt sáng quét qua
                    phía trước chữ và làm nó mờ đi giữa lúc quét. */}
                <span className="relative min-w-0">
                  <span className="block font-display text-h4 text-ink-900 transition group-hover:text-brand-700">
                    {serviceName(s, locale)}
                  </span>
                  {serviceDescription(s, locale) && (
                    <span className="mt-1 line-clamp-2 block text-body leading-[22px] text-ink-600">
                      {serviceDescription(s, locale)}
                    </span>
                  )}
                  {/*
                    Chỉ hiện giá khi thật sự có KTV đang chào dịch vụ đó. Dịch vụ mới
                    thêm vào danh mục mà chưa ai nhận làm thì bỏ trắng dòng này —
                    "từ 0 ₫" đọc như miễn phí, sai lệch hơn hẳn so với không hiện gì.

                    Pill dùng `bg-brand-100`, KHÔNG `brand-50`: `brand-50` là #f7fbff và
                    thẻ này là #ffffff — đã đo trong trình duyệt, chênh nhau không thấy
                    được, nên pill đọc ra vẫn chỉ là dòng chữ mono cũ. `brand-100` là bậc
                    đầu tiên thật sự tách khỏi nền trắng.
                  */}
                  {s.priceFrom !== null && (
                    <span className="tabular mt-2 inline-block rounded-md bg-brand-100 px-2 py-0.5 font-mono text-caption font-medium text-brand-700 transition group-hover:bg-brand-200">
                      {t('common.from')} {formatVnd(s.priceFrom, locale)}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteName,
          url: absolute(localePath(locale, '/')),
          inLanguage: INTL_LOCALE[locale],
          // Chưa khai báo SearchAction: Phase 1 chỉ tìm theo toạ độ và khu vực, chưa
          // có ô tìm kiếm bằng từ khoá. Khai báo một hành động mà site không xử lý
          // được là structured data không khớp thực tế, và Google kiểm tra nó thật.
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: siteName,
          url: absolute(localePath(locale, '/')),
        }}
      />
    </>
  );
}
