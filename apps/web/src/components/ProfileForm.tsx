'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFormValidation } from '@/lib/use-form-validation';
import { viMessages } from '@/lib/validation-messages';
import { CoverageAreaPicker, type CoverageAreaLabel } from '@/components/CoverageAreaPicker';
import { AreaIcon, CheckIcon, NearMeIcon } from '@/components/icons';
import { geoErrorMessage, getPosition } from '@/lib/geolocate';
import type { Gender, MyKtvProfile } from '@/lib/types';

const MAX_AREAS = 30;

/**
 * Một bước của form, đánh số và có trạng thái "xong".
 *
 * Form này dài hơn một màn hình và mỗi khối hỏi một thứ khác hẳn nhau (danh tính,
 * toạ độ, phạm vi làm việc). Bốn `<fieldset>` viền xám giống hệt nhau thì KTV không
 * biết mình đang ở đâu trong việc, cũng không biết còn bao nhiêu — nên dừng giữa
 * chừng ở khối toạ độ, đúng chỗ khó nhất. Số thứ tự và dấu tick trả lời cả hai câu
 * đó mà không cần chia form thành nhiều trang: chia trang ở đây sẽ mất khả năng sửa
 * một ô ở bước 1 sau khi đã đọc tới bước 3.
 *
 * `done` cố ý là **prop chứ không tự suy**: điều kiện "xong" của mỗi bước là quy tắc
 * nghiệp vụ (toạ độ hợp lệ, giới tính đã khai), không phải "ô này có chữ".
 */
function Step({
  index,
  title,
  description,
  done,
  optional,
  children,
}: {
  index: number;
  title: string;
  description: React.ReactNode;
  done?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ink-200 bg-white shadow-card">
      <header className="flex items-start gap-3 border-b border-ink-100 px-5 py-4">
        <span
          aria-hidden
          className={[
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-body-s font-semibold transition',
            done
              ? 'bg-success-bg text-success-fg ring-1 ring-success-bd'
              : 'bg-brand-50 text-brand-600 ring-1 ring-brand-200',
          ].join(' ')}
        >
          {done ? <CheckIcon size={16} className="h-4 w-4" /> : index}
        </span>

        <div className="min-w-0">
          <h2 className="text-h4 text-ink-900">
            {title}
            {optional && (
              <span className="ml-2 align-middle text-caption font-normal text-ink-500">
                không bắt buộc
              </span>
            )}
          </h2>
          <p className="mt-1 text-body-s text-ink-600">{description}</p>
        </div>
      </header>

      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

const FIELD =
  'mt-1.5 w-full rounded-md border border-ink-200 bg-white px-3 py-2.5 text-body text-ink-900 transition placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function ProfileForm({
  profile,
  coverageLabels,
}: {
  profile: MyKtvProfile | null;
  /**
   * Tên các khu vực KTV đang chọn, tra sẵn ở server.
   *
   * Cố ý **không** nhận cả cây hành chính: form chỉ cần đọc tên cho vài cái chip, mà
   * cây có 759 khu vực và đi thẳng vào payload RSC gửi xuống trình duyệt (~140KB cho
   * một trang form). Khu vực thêm mới lấy tên từ chính gợi ý đã dùng để thêm nó.
   */
  coverageLabels: CoverageAreaLabel[];
}) {
  const router = useRouter();
  // Thông báo validate tiếng Việt — dashboard/admin cố ý chỉ có một ngôn ngữ.
  const formRef = useFormValidation(viMessages());

  const [fullName, setFullName] = useState(profile?.fullName ?? '');

  /**
   * `''` là "chưa chọn", không phải một giá trị gửi được — nút lưu bị khoá khi nó
   * còn rỗng, và nó bắt đầu rỗng cho cả hồ sơ mới lẫn hồ sơ cũ chưa khai.
   *
   * Cố ý **không** đặt sẵn 'FEMALE' dù đa số KTV là nữ: một ô đã chọn sẵn là ô người
   * ta bấm qua mà không đọc, và ở đây chọn sai nghĩa là hồ sơ nằm nguyên trong kết
   * quả lọc của nhóm khách không tìm mình.
   */
  const [gender, setGender] = useState<Gender | ''>(profile?.gender ?? '');
  const [years, setYears] = useState(profile?.yearsExperience ?? 0);
  const [address, setAddress] = useState(profile?.baseAddress ?? '');
  const [radius, setRadius] = useState(profile?.serviceRadiusKm ?? 5);

  // Chỉ dùng khi TẠO hồ sơ. Hồ sơ đã tồn tại thì mã đã chốt và backend không nhận
  // trường này ở đường sửa — xem `CreateKtvProfileDto`.
  const [referralCode, setReferralCode] = useState('');

  // GeoJSON là [lon, lat] — đảo thứ tự ở đây là lỗi im lặng đưa KTV sang nửa kia
  // bán cầu mà form vẫn trông bình thường.
  const [lat, setLat] = useState<number | ''>(profile?.basePoint.coordinates[1] ?? '');
  const [lon, setLon] = useState<number | ''>(profile?.basePoint.coordinates[0] ?? '');

  const [selectedAreas, setSelectedAreas] = useState<string[]>(
    profile?.coverageAreas?.map((a) => a.id) ?? [],
  );

  const [locating, setLocating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Dashboard KTV cố ý chỉ có tiếng Việt (xem project-status), nên chuỗi ghi thẳng
  // ở đây thay vì đi qua i18n — khác ba nút của khách.
  async function useMyLocation() {
    setLocating(true);
    setError(null);

    const result = await getPosition();
    setLocating(false);

    if (!result.ok) {
      setError(
        geoErrorMessage(result.kind, {
          unsupported: 'Trình duyệt không hỗ trợ định vị. Nhập toạ độ thủ công bên dưới.',
          denied:
            'Bạn đã chặn quyền vị trí cho trang này. Bật lại trong cài đặt trình duyệt, hoặc nhập toạ độ thủ công bên dưới.',
          unavailable: 'Chưa lấy được vị trí. Nhập toạ độ thủ công bên dưới.',
        }),
      );
      return;
    }

    setLat(Number(result.coords.latitude.toFixed(6)));
    setLon(Number(result.coords.longitude.toFixed(6)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setDone(null);

    const payload = {
      fullName,
      gender,
      yearsExperience: years,
      lat: Number(lat),
      lon: Number(lon),
      baseAddress: address || null,
      serviceRadiusKm: radius,
      coverageAreaIds: selectedAreas,
      // Chỉ gửi khi tạo mới. Gửi kèm ở đường PATCH thì backend bỏ qua, nhưng để nó
      // trong payload sẽ khiến người đọc code sau này tưởng mã sửa được.
      ...(profile ? {} : { referralCode: referralCode.trim() || null }),
    };

    try {
      const res = await fetch('/api/proxy/ktv/profile', {
        method: profile ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as
        | { title?: string; errors?: Record<string, string[]> }
        | null;

      if (!res.ok) {
        // FluentValidation trả lỗi theo từng trường; gộp lại để KTV biết sửa chỗ
        // nào thay vì chỉ thấy "dữ liệu không hợp lệ".
        const fieldErrors = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
        setError(fieldErrors || data?.title || 'Không lưu được hồ sơ.');
        return;
      }

      setDone(
        profile
          ? 'Đã lưu. Hồ sơ chuyển về trạng thái chờ duyệt lại.'
          : 'Đã tạo hồ sơ. Hồ sơ sẽ hiển thị sau khi được duyệt.',
      );
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  const nameValid = fullName.trim().length >= 2;
  const coordsValid =
    lat !== '' && lon !== '' && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
  const basicsDone = nameValid && gender !== '';

  /**
   * Những gì còn thiếu, gọi đúng tên trường chứ không phải "dữ liệu không hợp lệ".
   * Nút submit vẫn bị khoá như trước, nhưng một nút mờ không kèm lý do là ngõ cụt:
   * KTV không biết phải cuộn lên đâu để sửa, và ba trường bắt buộc nằm ở hai khối
   * khác nhau của một form dài hơn màn hình.
   */
  const missing = [
    nameValid ? null : 'họ tên',
    gender ? null : 'giới tính',
    coordsValid ? null : 'vị trí xuất phát',
  ].filter(Boolean) as string[];

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      <Step
        index={1}
        title="Thông tin cơ bản"
        description="Tên và giới tính hiện trên thẻ của bạn trong kết quả tìm kiếm."
        done={basicsDone}
      >
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Họ tên chiếm hai cột: nó là trường dài nhất, và ba ô đều nhau sẽ cắt tên
              đầy đủ của phần lớn KTV. */}
          <label className="block text-body-s sm:col-span-2">
            <span className="font-medium text-ink-700">Họ tên hiển thị *</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="VD: Nguyễn Thị Lan"
              className={FIELD}
            />
          </label>

          <label className="block text-body-s">
            <span className="font-medium text-ink-700">Số năm kinh nghiệm</span>
            <input
              type="number"
              min={0}
              max={60}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className={`${FIELD} tabular-nums`}
            />
          </label>
        </div>

        {/*
          Hai nút radio thay cho `<select>`: chỉ có đúng hai giá trị (cố ý không có
          "khác" — xem project-status), nên một danh sách xổ xuống bắt người dùng bấm
          hai lần để thấy một lựa chọn họ đã biết sẵn. Radio thật chứ không phải
          `<button>`: giữ nguyên điều hướng bàn phím, `required` của trình duyệt, và
          câu lỗi tiếng Việt đi qua `useFormValidation` — cùng lý do với chú thích cũ
          về `value=""` trên `<select>`, chỉ khác là ở radio thì "chưa chọn" là trạng
          thái không có input nào được check, nên không cần option rỗng.
        */}
        <fieldset className="mt-5">
          <legend className="text-body-s font-medium text-ink-700">Giới tính *</legend>

          <div className="mt-1.5 flex flex-wrap gap-3">
            {(
              [
                { value: 'FEMALE', label: 'Nữ' },
                { value: 'MALE', label: 'Nam' },
              ] as const
            ).map((opt) => {
              const active = gender === opt.value;
              return (
                <label
                  key={opt.value}
                  className={[
                    'flex min-w-[120px] cursor-pointer items-center gap-2.5 rounded-md border px-4 py-2.5 text-body transition',
                    active
                      ? 'border-brand-500 bg-brand-50 font-medium text-brand-700 ring-2 ring-brand-500/20'
                      : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-25',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="gender"
                    required
                    value={opt.value}
                    checked={active}
                    onChange={() => setGender(opt.value)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>

          <p className="mt-2 text-caption text-ink-600">
            Khách lọc theo giới tính rất nhiều. Hồ sơ chưa khai sẽ{' '}
            <strong className="font-semibold text-ink-700">không xuất hiện</strong> khi khách dùng
            bộ lọc này.
          </p>
        </fieldset>
      </Step>

      <Step
        index={2}
        title="Vị trí xuất phát"
        description={
          <>
            Dùng để tính khoảng cách tới khách. Trang công khai chỉ hiện toạ độ đã làm tròn khoảng
            100m và <strong className="font-semibold text-ink-700">không</strong> hiện địa chỉ, nên
            chỗ ở của bạn không lộ ra.
          </>
        }
        done={coordsValid}
      >
        {/* Nút định vị đứng trước hai ô toạ độ vì nó là đường đi đúng của gần như mọi
            KTV — hai ô số ở dưới là lối thoát khi định vị bị chặn, không phải cách
            làm mặc định. */}
        <div className="flex flex-col gap-3 rounded-md bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-s text-brand-700">
            Cách nhanh nhất: bấm nút bên cạnh khi bạn đang ở nơi mình thường xuất phát.
          </p>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-body-s font-medium text-white shadow-button transition hover:bg-brand-600 disabled:opacity-60"
          >
            <NearMeIcon size={18} className="h-[18px] w-[18px]" />
            {locating ? 'Đang định vị…' : 'Dùng vị trí hiện tại'}
          </button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block text-body-s">
            <span className="font-medium text-ink-700">Vĩ độ (lat) *</span>
            <input
              type="number"
              step="any"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="10.7295"
              className={`${FIELD} tabular-nums`}
            />
          </label>
          <label className="block text-body-s">
            <span className="font-medium text-ink-700">Kinh độ (lon) *</span>
            <input
              type="number"
              step="any"
              required
              value={lon}
              onChange={(e) => setLon(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="106.7215"
              className={`${FIELD} tabular-nums`}
            />
          </label>
        </div>

        <label className="mt-5 block text-body-s">
          <span className="font-medium text-ink-700">Địa chỉ</span>
          <span className="ml-2 text-caption font-normal text-ink-500">
            chỉ dùng nội bộ, không hiện công khai
          </span>
          <input
            maxLength={255}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Số nhà, đường, phường"
            className={FIELD}
          />
        </label>

        <div className="mt-6 rounded-md border border-ink-200 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor="radius" className="text-body-s font-medium text-ink-700">
              Bán kính nhận khách
            </label>
            {/* Con số tách khỏi nhãn và to hẳn lên: đây là giá trị thay đổi khi kéo,
                nhét vào giữa câu nhãn thì mắt phải đi tìm nó lại sau mỗi lần kéo. */}
            <span className="text-h4 tabular-nums text-brand-600">{radius} km</span>
          </div>

          <input
            id="radius"
            type="range"
            min={1}
            max={50}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-3 w-full accent-brand-500"
          />
          <div className="mt-1 flex justify-between text-caption tabular-nums text-ink-500">
            <span>1 km</span>
            <span>50 km</span>
          </div>

          <p className="mt-3 text-caption text-ink-600">
            Khách ở xa hơn bán kính này sẽ không thấy bạn, kể cả khi họ tìm với bán kính rộng — để
            không ai gọi trúng người không nhận đi khu đó.
          </p>
        </div>
      </Step>

      <Step
        index={3}
        title="Khu vực nhận phục vụ"
        description="Quyết định bạn xuất hiện ở trang khu vực nào, và là khu vực bạn mua được gói đẩy tin."
        done={selectedAreas.length > 0}
      >
        <div className="mb-3 flex items-center gap-2 text-body-s text-ink-600">
          <AreaIcon size={18} className="h-[18px] w-[18px] text-ink-500" />
          <span className="tabular-nums">
            Đã chọn {selectedAreas.length}/{MAX_AREAS} khu vực
          </span>
        </div>

        <CoverageAreaPicker
          initialLabels={coverageLabels}
          selected={selectedAreas}
          onChange={setSelectedAreas}
          max={MAX_AREAS}
        />
      </Step>

      {/*
        Chỉ hiện khi TẠO hồ sơ: mã chốt lúc tạo và không sửa được, nên hiện một ô nhập
        đã khoá ở trang sửa chỉ tạo ra câu hỏi "vì sao tôi không đổi được".

        Đặt cuối form vì đa số KTV tự tìm tới qua SEO và không có mã nào — để nó lên đầu
        là bắt phần lớn người dùng dừng lại ở một ô không liên quan tới họ.
      */}
      {!profile && (
        <Step
          index={4}
          title="Mã giới thiệu"
          optional
          description="Nếu có cộng tác viên mời bạn tham gia, nhập mã họ đưa. Không có thì để trống — hồ sơ vẫn được duyệt bình thường."
        >
          <label className="block text-body-s">
            <span className="sr-only">Mã giới thiệu</span>
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              maxLength={32}
              placeholder="VD: AN-01"
              // uppercase chỉ là hiển thị; backend vẫn tự chuẩn hoá, nên dán mã chữ
              // thường từ tin nhắn vẫn khớp.
              className={`${FIELD} max-w-[240px] font-mono uppercase tracking-wide`}
            />
          </label>

          <p className="mt-2 text-caption text-ink-500">
            Mã sai sẽ được báo ngay khi bấm tạo hồ sơ. Sau khi tạo, mã không đổi được.
          </p>
        </Step>
      )}

      {done && (
        <p className="rounded-md border border-success-bd bg-success-bg px-4 py-3 text-body-s text-success-fg">
          {done}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger-bd bg-danger-bg px-4 py-3 text-body-s text-danger-fg"
        >
          {error}
        </p>
      )}

      {/*
        Thanh hành động dính đáy: form cao hơn một màn hình ở mọi kích thước, nên nút
        gửi đặt ở cuối trang nằm ngoài tầm mắt suốt lúc điền. Nền mờ + viền trên để nó
        không đọc như một khối nội dung nữa của form.

        `pb-*` ở trang bọc là bắt buộc — xem quy ước "mọi thanh dính đáy phải đi kèm
        pb-* tương ứng" trong project-status; trang này đã có ở `dashboard/ho-so`.
      */}
      <div className="sticky bottom-0 -mx-4 border-t border-ink-200 bg-white/95 px-4 py-3 shadow-sticky backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="submit"
            disabled={pending || missing.length > 0}
            className="rounded-md bg-brand-500 px-6 py-2.5 text-body font-medium text-white shadow-button transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {pending ? 'Đang lưu…' : profile ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
          </button>

          {missing.length > 0 ? (
            <span className="text-body-s text-ink-600">
              Còn thiếu: <strong className="font-medium text-ink-700">{missing.join(', ')}</strong>.
            </span>
          ) : (
            profile && (
              <span className="text-body-s text-ink-600">
                Sửa hồ sơ đã duyệt sẽ đưa nó về chờ duyệt lại — hồ sơ tạm ẩn khỏi tìm kiếm trong
                lúc đó.
              </span>
            )
          )}
        </div>
      </div>
    </form>
  );
}
