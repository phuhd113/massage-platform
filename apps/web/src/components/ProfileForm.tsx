'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AreaNode, MyKtvProfile } from '@/lib/types';

const MAX_AREAS = 30;

export function ProfileForm({
  profile,
  areas,
}: {
  profile: MyKtvProfile | null;
  areas: AreaNode[];
}) {
  const router = useRouter();
  const districts = areas.flatMap((p) => p.children.map((d) => ({ ...d, province: p.name })));

  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [years, setYears] = useState(profile?.yearsExperience ?? 0);
  const [address, setAddress] = useState(profile?.baseAddress ?? '');
  const [radius, setRadius] = useState(profile?.serviceRadiusKm ?? 5);

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

  function toggleArea(id: string) {
    setSelectedAreas((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_AREAS
          ? prev
          : [...prev, id],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setDone(null);

    const payload = {
      fullName,
      bio: bio || null,
      yearsExperience: years,
      lat: Number(lat),
      lon: Number(lon),
      baseAddress: address || null,
      serviceRadiusKm: radius,
      coverageAreaIds: selectedAreas,
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
    <form onSubmit={submit} className="space-y-6 rounded-lg border border-ink-200 bg-white p-5 shadow-card">
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

      <label className="block text-sm">
        <span className="text-ink-700">Giới thiệu</span>
        <textarea
          rows={4}
          maxLength={2000}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Kinh nghiệm, phương pháp trị liệu, đối tượng khách phù hợp…"
          className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <span className="mt-1 block text-xs text-ink-500">
          Nội dung này hiển thị công khai và được kiểm duyệt trước khi đăng. {bio.length}/2000
        </span>
      </label>

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

        <div className="mt-3 space-y-4">
          {areas.map((province) => (
            <div key={province.id}>
              <div className="text-sm font-medium text-ink-700">{province.name}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {province.children.map((d) => {
                  const on = selectedAreas.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleArea(d.id)}
                      aria-pressed={on}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        on
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-ink-300 text-ink-700 hover:border-brand-500'
                      }`}
                    >
                      {d.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {districts.length === 0 && (
          <p className="mt-2 text-sm text-ink-500">
            Chưa có danh mục khu vực. Chạy lệnh seed-areas trước.
          </p>
        )}
      </fieldset>

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
        <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
