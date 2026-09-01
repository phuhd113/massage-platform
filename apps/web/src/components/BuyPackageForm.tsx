'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { packageLabel } from '@/lib/labels';
import { formatVnd } from '@/lib/site';
import type { AreaNode, PromotionPackage } from '@/lib/types';

export function BuyPackageForm({
  packages,
  areas,
  disabled,
}: {
  packages: PromotionPackage[];
  areas: AreaNode[];
  disabled: boolean;
}) {
  const router = useRouter();
  const districts = areas.flatMap((p) => p.children.map((d) => ({ ...d, province: p.name })));

  const [areaId, setAreaId] = useState('');
  const [withSlots, setWithSlots] = useState<PromotionPackage[]>(packages);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Số slot còn trống phụ thuộc khu vực, nên phải hỏi lại backend mỗi lần đổi
  // khu vực — đây là con số quyết định KTV có bấm mua hay không.
  useEffect(() => {
    if (!areaId) {
      setWithSlots(packages);
      return;
    }

    let cancelled = false;
    fetch(`/api/proxy/promotions/packages?areaId=${areaId}`)
      .then((r) => (r.ok ? (r.json() as Promise<PromotionPackage[]>) : Promise.reject()))
      .then((data) => { if (!cancelled) setWithSlots(data); })
      .catch(() => { if (!cancelled) setWithSlots(packages); });

    return () => { cancelled = true; };
  }, [areaId, packages]);

  async function buy(pkg: PromotionPackage) {
    setBuying(pkg.id);
    setError(null);
    setDone(null);

    try {
      const res = await fetch('/api/proxy/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Sinh một lần cho đúng lần bấm này. Bấm hai lần liên tiếp vẫn ra hai
          // khoá khác nhau (hai ý định mua khác nhau), nhưng một lần bấm bị retry
          // do mạng thì backend nhận lại đúng khoá cũ và không trừ tiền lần nữa.
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ packageId: pkg.id, areaId }),
      });

      const data = (await res.json().catch(() => null)) as
        | { campaignId?: string; title?: string; alreadyProcessed?: boolean }
        | null;

      if (res.status === 409) {
        setError(data?.title ?? 'Khu vực này đã hết chỗ cho gói vừa chọn. Thử khu vực khác.');
        return;
      }
      if (!res.ok) {
        setError(data?.title ?? 'Không mua được gói. Vui lòng thử lại.');
        return;
      }

      setDone(`Đã kích hoạt ${packageLabel(pkg.type)}.`);
      // Số dư và danh sách chiến dịch đổi ngay sau khi mua.
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setBuying(null);
    }
  }

  return (
    <div>
      <label className="block max-w-sm text-sm">
        <span className="text-stone-700">Khu vực muốn đẩy tin</span>
        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
        >
          <option value="">— Chọn quận/huyện —</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} — {d.province}
            </option>
          ))}
        </select>
      </label>

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {withSlots.map((pkg) => {
          const soldOut = pkg.freeSlots === 0;
          return (
            <li key={pkg.id} className="flex flex-col rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{pkg.name}</h3>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {packageLabel(pkg.type)} · {pkg.durationDays} ngày · +{pkg.boostPoints} điểm
                  </p>
                </div>
                <div className="shrink-0 text-right font-semibold tabular-nums">
                  {formatVnd(pkg.price)}
                </div>
              </div>

              <p className="mt-3 text-sm">
                {pkg.guaranteesTopPlacement ? (
                  <span className="text-brand-700">Đảm bảo đứng trên KTV không mua gói</span>
                ) : (
                  // Nói thẳng giới hạn thay vì để KTV tự phát hiện sau khi trả tiền.
                  <span className="text-stone-600">
                    Tăng khả năng hiển thị, không đảm bảo vị trí đầu trang
                  </span>
                )}
              </p>

              {areaId && (
                <p className="mt-2 text-sm text-stone-500">
                  {soldOut
                    ? 'Đã hết chỗ ở khu vực này'
                    : `Còn ${pkg.freeSlots}/${pkg.maxSlotsPerArea} chỗ`}
                </p>
              )}

              <button
                type="button"
                onClick={() => buy(pkg)}
                disabled={disabled || !areaId || soldOut || buying !== null}
                className="mt-4 rounded-md bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {buying === pkg.id ? 'Đang xử lý…' : !areaId ? 'Chọn khu vực trước' : 'Mua'}
              </button>
            </li>
          );
        })}
      </ul>

      {done && (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700">{done}</p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
