'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useFormValidation } from '@/lib/use-form-validation';
import { viMessages } from '@/lib/validation-messages';
import { CoverageAreaPicker, type CoverageAreaLabel } from '@/components/CoverageAreaPicker';
import type { MyKtvProfile } from '@/lib/types';

const MAX_AREAS = 30;

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

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị. Nhập toạ độ thủ công bên dưới.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLon(Number(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('Chưa lấy được vị trí. Nhập toạ độ thủ công bên dưới.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setDone(null);

    const payload = {
      fullName,
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

  const coordsValid = lat !== '' && lon !== '' && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-6 rounded-lg border border-ink-200 bg-white p-5 shadow-card">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-ink-700">Họ tên hiển thị *</span>
          <input
            required
            minLength={2}
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="block text-sm">
          <span className="text-ink-700">Số năm kinh nghiệm</span>
          <input
            type="number"
            min={0}
            max={60}
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
      </div>

      <fieldset className="rounded-md border border-ink-200 p-4">
        <legend className="px-1 text-sm font-medium text-ink-700">Vị trí xuất phát</legend>

        <p className="text-sm text-ink-600">
          Dùng để tính khoảng cách tới khách. Trang công khai chỉ hiện toạ độ đã làm tròn khoảng
          100m và <strong>không</strong> hiện địa chỉ, nên chỗ ở của bạn không lộ ra.
        </p>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="mt-3 rounded-md border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-60"
        >
          {locating ? 'Đang định vị…' : 'Dùng vị trí hiện tại'}
        </button>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-ink-700">Vĩ độ (lat) *</span>
            <input
              type="number"
              step="any"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="10.7295"
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 tabular-nums"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink-700">Kinh độ (lon) *</span>
            <input
              type="number"
              step="any"
              required
              value={lon}
              onChange={(e) => setLon(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="106.7215"
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 tabular-nums"
            />
          </label>
        </div>

        <label className="mt-4 block text-sm">
          <span className="text-ink-700">Địa chỉ (chỉ dùng nội bộ)</span>
          <input
            maxLength={255}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        <label className="mt-4 block text-sm">
          <span className="text-ink-700">Bán kính nhận khách: {radius}km</span>
          <input
            type="range"
            min={1}
            max={50}
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="mt-1 w-full max-w-sm"
          />
          <span className="mt-1 block text-xs text-ink-500">
            Khách ở xa hơn bán kính này sẽ không thấy bạn, kể cả khi họ tìm với bán kính rộng — để
            không ai gọi trúng người không nhận đi khu đó.
          </span>
        </label>
      </fieldset>

      <fieldset className="rounded-md border border-ink-200 p-4">
        <legend className="px-1 text-sm font-medium text-ink-700">
          Khu vực nhận phục vụ ({selectedAreas.length}/{MAX_AREAS})
        </legend>
        <p className="text-sm text-ink-600">
          Quyết định bạn xuất hiện ở trang khu vực nào, và là khu vực bạn mua được gói đẩy tin.
        </p>

        <div className="mt-3">
          <CoverageAreaPicker
            initialLabels={coverageLabels}
            selected={selectedAreas}
            onChange={setSelectedAreas}
            max={MAX_AREAS}
          />
        </div>
      </fieldset>

      {/*
        Chỉ hiện khi TẠO hồ sơ: mã chốt lúc tạo và không sửa được, nên hiện một ô nhập
        đã khoá ở trang sửa chỉ tạo ra câu hỏi "vì sao tôi không đổi được".

        Đặt cuối form vì đa số KTV tự tìm tới qua SEO và không có mã nào — để nó lên đầu
        là bắt phần lớn người dùng dừng lại ở một ô không liên quan tới họ.
      */}
      {!profile && (
        <fieldset className="rounded-md border border-ink-200 p-4">
          <legend className="px-1 text-sm font-medium text-ink-700">
            Mã giới thiệu (không bắt buộc)
          </legend>
          <p className="text-sm text-ink-600">
            Nếu có cộng tác viên mời bạn tham gia, nhập mã họ đưa. Không có thì để trống — hồ sơ
            vẫn được duyệt bình thường.
          </p>

          <label className="mt-3 block text-sm">
            <span className="sr-only">Mã giới thiệu</span>
            <input
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              maxLength={32}
              placeholder="VD: AN-01"
              // uppercase chỉ là hiển thị; backend vẫn tự chuẩn hoá, nên dán mã chữ
              // thường từ tin nhắn vẫn khớp.
              className="w-full max-w-[240px] rounded-md border border-ink-200 bg-white px-3 py-2 font-mono uppercase tracking-wide transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <p className="mt-2 text-xs text-ink-500">
            Mã sai sẽ được báo ngay khi bấm tạo hồ sơ. Sau khi tạo, mã không đổi được.
          </p>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending || !coordsValid || fullName.trim().length < 2}
          className="rounded-md bg-brand-500 px-6 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Đang lưu…' : profile ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
        </button>

        {profile && (
          <span className="text-sm text-ink-500">
            Sửa hồ sơ đã duyệt sẽ đưa nó về chờ duyệt lại — hồ sơ tạm ẩn khỏi tìm kiếm trong lúc đó.
          </span>
        )}
      </div>

      {done && (
        <p className="rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700">{done}</p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-danger-fg">
          {error}
        </p>
      )}
    </form>
  );
}
