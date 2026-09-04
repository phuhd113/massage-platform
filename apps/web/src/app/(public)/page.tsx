import Link from 'next/link';
import { HeroSearch } from '@/components/HeroSearch';
import { HomeHeroMedia } from '@/components/HomeHeroMedia';
import { JsonLd } from '@/components/JsonLd';
import { ServiceIcon } from '@/components/ServiceIcon';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { SITE_NAME, absolute, areaPath, formatVnd } from '@/lib/site';

// Render theo request thay vì prerender lúc build: build không được phụ thuộc vào
// một API đang chạy, nếu không CI phải dựng cả stack chỉ để đóng gói frontend.
// Dữ liệu vẫn đi qua cache fetch (revalidate trong lib/api) nên API không bị gọi
// lại mỗi request.
export const dynamic = 'force-dynamic';

/** Ba bước duyệt hồ sơ — nội dung tĩnh, là chính sách chứ không phải dữ liệu. */
const VERIFICATION_STEPS = [
  {
    title: 'KTV tải bản gốc chứng chỉ',
    body: 'Chứng chỉ xoa bóp bấm huyệt hoặc kỹ thuật viên phục hồi chức năng, kèm ảnh chân dung.',
  },
  {
    title: 'Đối chiếu với tổ chức cấp',
    body: 'Chúng tôi kiểm tra tên, số chứng chỉ và đơn vị cấp trước khi đánh dấu đã duyệt.',
  },
  {
    title: 'Hồ sơ mở cho khách xem',
    body: 'Bạn thấy đúng chứng chỉ nào đã duyệt, do ai cấp, và đánh giá của khách trước.',
  },
] as const;

export default async function HomePage() {
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
      <section className="-mx-4 -mt-8 border-b border-ink-200 bg-gradient-to-b from-brand-50 to-white px-4 pb-14 pt-12 sm:-mt-10 sm:pb-14 sm:pt-16">
        <div className="mx-auto grid max-w-shell items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            {stats.verifiedKtvCount > 0 && (
              <span className="inline-flex items-center gap-[7px] rounded-full border border-success-bd bg-success-bg px-3 py-[5px] text-caption font-semibold text-success-fg">
                <svg
                  aria-hidden
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="m9 12 2 2 4-4" />
                  <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
                </svg>
                {stats.verifiedKtvCount.toLocaleString('vi-VN')} kỹ thuật viên đã đối chiếu chứng
                chỉ hành nghề
              </span>
            )}

            {/*
              "người thật có chứng chỉ thật" là lời hứa cụ thể kiểm chứng được ngay
              trên site, không phải khẩu hiệu: mọi hồ sơ trong kết quả đều đã qua
              bước đối chiếu mô tả ở khối ngay bên dưới.
            */}
            <h1 className="mt-[18px] max-w-[15ch] text-balance text-h1 text-ink-900 sm:text-display lg:text-display-l">
              Massage trị liệu tại nhà, người thật có chứng chỉ thật
            </h1>

            <p className="mt-5 max-w-[52ch] text-body-l text-ink-700 sm:text-[18px] sm:leading-[30px]">
              Xem ảnh, chứng chỉ hành nghề và khoảng cách của từng kỹ thuật viên trước khi gọi.
              Không mất phí đặt lịch, thanh toán sau buổi trị liệu.
            </p>

            <div className="mt-7">
              <HeroSearch services={services} />
            </div>
          </div>

          <HomeHeroMedia stats={stats} />
        </div>
      </section>

      <section id="cach-duyet-ho-so" className="mt-14 scroll-mt-20">
        <h2 className="text-h2 text-ink-900 sm:text-[28px] sm:leading-[34px]">
          Chứng chỉ được duyệt thế nào
        </h2>
        <p className="mt-1.5 text-body-l text-ink-600">
          Ba bước trước khi một hồ sơ được phép xuất hiện trong kết quả tìm kiếm.
        </p>

        {/*
          <ol> chứ không phải <ul>: đây là quy trình có thứ tự, và số bước là nội
          dung thật chứ không phải trang trí — nên nó nằm trong markup, không phải
          trong ::before của CSS.
        */}
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {VERIFICATION_STEPS.map((step, i) => (
            <li key={step.title} className="rounded-xl border border-ink-200 bg-white p-5">
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-100 font-mono text-caption font-medium text-brand-600"
              >
                {i + 1}
              </span>
              <h3 className="mt-3.5 font-display text-h4 text-ink-900">{step.title}</h3>
              <p className="mt-1.5 text-body leading-6 text-ink-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {provinces.length > 0 && (
      <section className="mt-14">
        <h2 className="text-h2 text-ink-900 sm:text-[28px] sm:leading-[34px]">Tìm theo khu vực</h2>
        <p className="mt-1.5 text-body-l text-ink-600">
          Chọn quận/huyện để xem kỹ thuật viên nhận khách ở đó.
        </p>

        {/* Lưới hai cột chỉ khi có từ hai tỉnh trở lên: một thẻ đơn độc trong lưới
            hai cột để lại đúng một nửa trống, đọc như phần còn lại tải hỏng. */}
        <div className={`mt-6 grid gap-4 ${provinces.length > 1 ? 'sm:grid-cols-2' : ''}`}>
          {provinces.map((province) => (
            <div key={province.id} className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display text-h3">
                  <Link
                    href={areaPath(province.slug)}
                    className="text-ink-900 transition hover:text-brand-600"
                  >
                    {province.name}
                  </Link>
                </h3>
                <span className="tabular shrink-0 font-mono text-caption text-ink-600">
                  {province.ktvCount} KTV
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
                      <Link
                        href={areaPath(province.slug, d.slug)}
                        className="inline-block rounded-md border border-ink-200 bg-brand-50 px-[11px] py-1.5 text-body text-ink-700 transition hover:border-brand-500 hover:text-brand-700"
                      >
                        {d.name}
                        {/* Dấu · tách tên khỏi số: thiếu nó thì "Quận 4" cạnh số 6
                            đọc dính thành "Quận 4 6". */}
                        {d.ktvCount > 0 && (
                          <span className="tabular ml-1.5 font-mono text-ink-500">
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
      </section>
      )}

      <section className="mt-14">
        <h2 className="text-h2 text-ink-900 sm:text-[28px] sm:leading-[34px]">Dịch vụ</h2>
        <p className="mt-1.5 text-body-l text-ink-600">
          Mỗi kỹ thuật viên tự công bố bảng giá cho từng dịch vụ trên hồ sơ.
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dich-vu/${s.slug}`}
                className="group flex h-full gap-3.5 rounded-xl border border-ink-200 bg-white p-[18px] transition hover:-translate-y-[3px] hover:border-brand-300 hover:shadow-card-hover"
              >
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
                  <ServiceIcon slug={s.slug} className="h-[21px] w-[21px]" />
                </span>

                <span className="min-w-0">
                  <span className="block font-display text-h4 text-ink-900 transition group-hover:text-brand-700">
                    {s.name}
                  </span>
                  {s.description && (
                    <span className="mt-1 line-clamp-2 block text-body leading-[22px] text-ink-600">
                      {s.description}
                    </span>
                  )}
                  {/*
                    Chỉ hiện giá khi thật sự có KTV đang chào dịch vụ đó. Dịch vụ mới
                    thêm vào danh mục mà chưa ai nhận làm thì bỏ trắng dòng này —
                    "từ 0 ₫" đọc như miễn phí, sai lệch hơn hẳn so với không hiện gì.
                  */}
                  {s.priceFrom !== null && (
                    <span className="tabular mt-2 block font-mono text-caption text-ink-700">
                      từ {formatVnd(s.priceFrom)}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: absolute('/'),
          inLanguage: 'vi-VN',
          // Chưa khai báo SearchAction: Phase 1 chỉ tìm theo toạ độ và khu vực, chưa
          // có ô tìm kiếm bằng từ khoá. Khai báo một hành động mà site không xử lý
          // được là structured data không khớp thực tế, và Google kiểm tra nó thật.
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: SITE_NAME,
          url: absolute('/'),
        }}
      />
    </>
  );
}
