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
        <span className="text-ink-700">Khu vực muốn đẩy tin</span>
        <select
          value={areaId}
          onChange={(e) => setAreaId(e.target.value)}
          className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
            <li
              key={pkg.id}
              className="flex flex-col rounded-lg border border-champagne-200 bg-gradient-to-b from-champagne-50 via-white to-white p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-h4 text-ink-900">{pkg.name}</h3>
                  <p className="mt-0.5 text-body-s text-ink-500">
                    {packageLabel(pkg.type)} · {pkg.durationDays} ngày · +{pkg.boostPoints} điểm
                  </p>
                </div>
                <div className="tabular shrink-0 text-right font-display font-semibold text-ink-900">
                  {formatVnd(pkg.price)}
                </div>
              </div>

              {/* Lời hứa bán hàng đọc thẳng từ cờ backend tính, không hardcode
                  theo tên gói: nếu ai đó hạ boostPoints xuống dưới dải BaseScore
                  thì mô tả ở đây tự đổi theo, thay vì bán một lời hứa hệ thống
                  không còn giữ được. */}
              <p className="mt-3 text-body-s">
                {pkg.guaranteesTopPlacement ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-champagne-200 bg-champagne-50 px-2 py-0.5 font-semibold text-champagne-600">
                    <svg
                      aria-hidden
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m2 8 4 12h12l4-12-5 4-5-6-5 6-5-4z" />
                      <path d="M2 20h20" />
                    </svg>
                    Đảm bảo đứng trên KTV không mua gói
                  </span>
                ) : (
                  // Nói thẳng giới hạn thay vì để KTV tự phát hiện sau khi trả tiền.
                  <span className="text-ink-600">
                    Tăng khả năng hiển thị, không đảm bảo vị trí đầu trang
                  </span>
                )}
              </p>

              {areaId && (
                <p className="mt-2 text-body-s">
                  {soldOut ? (
                    <span className="font-medium text-danger-fg">Đã hết chỗ ở khu vực này</span>
                  ) : (
                    <span className="text-ink-600">
                      Còn{' '}
                      <strong className="tabular text-ink-900">
                        {pkg.freeSlots}/{pkg.maxSlotsPerArea}
                      </strong>{' '}
                      chỗ
                    </span>
                  )}
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
        <p className="mt-4 rounded-md border border-success-bd bg-success-bg px-4 py-3 text-body-s text-success-fg">
          {done}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger-bd bg-danger-bg px-4 py-3 text-body-s text-danger-fg"
        >
          {error}
        </p>
      )}
    </div>
  );
}
