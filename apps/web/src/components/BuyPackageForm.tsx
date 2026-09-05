'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AreaSearchBox } from '@/components/AreaSearchBox';
import { packageLabel } from '@/lib/labels';
import { formatVnd } from '@/lib/site';
import type { AreaSuggestion, PromotionPackage } from '@/lib/types';

/**
 * Đặc điểm bán hàng của từng hạng gói.
 *
 * Chỉ mô tả những gì hệ thống **thật sự làm**: khung thẻ champagne và ghim nổi trên
 * bản đồ là hành vi có thật của VIP Pin, chip "Tài trợ" là hành vi có thật của mọi
 * gói. Lời hứa về thứ hạng thì không nằm ở đây — nó đọc từ cờ `guaranteesTopPlacement`
 * do backend tính, để mô tả không bao giờ hứa quá công thức đang chạy.
 */
const FEATURES: Record<string, { text: string; has: boolean }[]> = {
  VIP_PIN: [
    { text: 'Khung thẻ vàng + ghim nổi trên bản đồ', has: true },
    { text: 'Đứng trên mọi gói thấp hơn', has: true },
  ],
  INSTANT_BOOST: [
    { text: 'Chip "Tài trợ" trên thẻ', has: true },
    { text: 'Không có khung thẻ vàng', has: false },
  ],
  FEATURED_BADGE: [
    { text: 'Chip "Tài trợ" trên thẻ', has: true },
    { text: 'Không có khung thẻ vàng', has: false },
  ],
};

export function BuyPackageForm({
  packages,
  disabled,
}: {
  packages: PromotionPackage[];
  disabled: boolean;
}) {
  const router = useRouter();

  const [area, setArea] = useState<AreaSuggestion | null>(null);
  const [withSlots, setWithSlots] = useState<PromotionPackage[]>(packages);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Slot được cấp phát theo **quận/huyện** (backend từ chối mức khác). Ô gợi ý trả
  // về cả tỉnh lẫn phường, nên phải chặn ngay ở đây: để backend từ chối thì KTV đã
  // chọn xong gói và bấm mua rồi mới biết mình chọn sai mức khu vực.
  const wrongLevel = area !== null && area.level !== 'DISTRICT';
  const areaId = area && !wrongLevel ? area.id : '';

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
      .then((data) => {
        if (!cancelled) setWithSlots(data);
      })
      .catch(() => {
        if (!cancelled) setWithSlots(packages);
      });

    return () => {
      cancelled = true;
    };
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

      setDone(`Đã kích hoạt ${packageLabel(pkg.type)}${area ? ` ở ${area.name}` : ''}.`);
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
      {/*
        Ô gợi ý thay cho <select> 696 quận/huyện — cùng component với trang tìm kiếm.
        Ở đây nó còn quan trọng hơn: KTV mua gói cho đúng quận mình nhận khách, chọn
        nhầm là mất tiền thật vào một khu vực họ không phục vụ.
      */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-white px-[18px] py-3.5">
        <span className="shrink-0 text-body-l font-semibold text-ink-900">
          Khu vực muốn đẩy tin
        </span>
        <div className="min-w-[240px] max-w-sm flex-1">
          <AreaSearchBox
            labels={{
              clear: 'Xoá khu vực đang chọn',
              suggestions: 'Gợi ý khu vực',
              ktvCount: (n) => (n > 0 ? `${n} KTV` : 'Chưa có KTV'),
            }}
            onSelect={setArea}
            onClear={() => setArea(null)}
            placeholder="Chọn quận/huyện…"
          />
        </div>
        {wrongLevel ? (
          <span className="ml-auto shrink-0 text-body font-semibold text-warning-fg">
            Chọn một quận/huyện — gói bán theo quận, không theo{' '}
            {area.level === 'PROVINCE' ? 'tỉnh/thành' : 'phường/xã'}.
          </span>
        ) : (
          area && (
            <span className="ml-auto shrink-0 text-body text-ink-600">
              Đang có <strong className="tabular text-ink-900">{area.ktvCount}</strong> KTV trong
              khu vực này
            </span>
          )
        )}
      </div>

      <ul className="mt-[18px] grid gap-4 lg:grid-cols-3">
        {withSlots.map((pkg) => {
          const soldOut = pkg.freeSlots === 0;
          const vip = pkg.type === 'VIP_PIN';
          const features = FEATURES[pkg.type] ?? [];

          return (
            <li
              key={pkg.id}
              className={`flex flex-col overflow-hidden rounded-2xl border ${
                vip ? 'border-2 border-champagne-400 bg-white' : 'border-ink-200 bg-white'
              }`}
            >
              <div
                className={`border-b px-[18px] py-3.5 ${
                  vip ? 'border-champagne-100 bg-champagne-50' : 'border-ink-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2.5">
                  <span className="font-display text-h4 font-bold text-ink-900">{pkg.name}</span>
                  {vip && (
                    <span className="shrink-0 rounded-full bg-champagne-600 px-2.5 py-0.5 text-caption font-semibold text-white">
                      Hạng cao nhất
                    </span>
                  )}
                </div>
                <div className="tabular mt-2 whitespace-nowrap font-mono text-[22px] font-medium text-ink-900">
                  {formatVnd(pkg.price, 'vi')}
                </div>
                <div className="mt-0.5 text-body text-ink-600">
                  {durationLabel(pkg)} · +{pkg.boostPoints} điểm
                </div>
                {pkg.durationHours !== null && pkg.startsAt !== null && (
                  // Gói theo giờ chạy đúng một khung cố định, không phải "3 giờ kể
                  // từ lúc bấm mua". Không nói ra thì KTV mua lúc 22h tưởng mình
                  // vừa mua khung 22h–1h.
                  <div className="mt-1 text-caption text-ink-500">
                    Khung {formatSlotWindow(pkg.startsAt)}
                  </div>
                )}
              </div>

              <div className="flex-1 px-[18px] py-4">
                <ul className="grid gap-2.5">
                  {/* Lời hứa bán hàng đọc thẳng từ cờ backend tính, không hardcode
                      theo tên gói: nếu ai đó hạ boostPoints xuống dưới dải BaseScore
                      thì mô tả ở đây tự đổi theo, thay vì bán một lời hứa hệ thống
                      không còn giữ được. */}
                  <Feature
                    has={pkg.guaranteesTopPlacement}
                    text={
                      pkg.guaranteesTopPlacement
                        ? 'Đảm bảo đứng trên KTV không mua gói'
                        : 'Không đảm bảo vị trí đầu trang'
                    }
                  />
                  {features.map((f) => (
                    <Feature key={f.text} has={f.has} text={f.text} />
                  ))}
                </ul>

                {area && !wrongLevel && (
                  <div
                    className={`mt-3.5 rounded-md px-3 py-2.5 text-body ${
                      soldOut
                        ? 'border border-danger-bd bg-danger-bg font-semibold text-danger-fg'
                        : vip
                          ? 'bg-champagne-50 text-champagne-600'
                          : 'bg-brand-50 text-ink-600'
                    }`}
                  >
                    {soldOut ? (
                      <>Đã hết chỗ ở {area.name}</>
                    ) : (
                      <>
                        Còn{' '}
                        <strong className="tabular font-mono font-medium text-ink-900">
                          {pkg.freeSlots}/{pkg.maxSlotsPerArea}
                        </strong>{' '}
                        chỗ ở {area.name}
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="px-[18px] pb-[18px]">
                <button
                  type="button"
                  onClick={() => buy(pkg)}
                  disabled={disabled || !areaId || soldOut || buying !== null}
                  className={`w-full rounded-md py-3 text-body-l font-semibold transition disabled:cursor-not-allowed ${
                    vip
                      ? 'bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50'
                      : 'border border-brand-500 bg-white text-brand-500 hover:bg-brand-50 disabled:opacity-50'
                  }`}
                >
                  {buying === pkg.id
                    ? 'Đang xử lý…'
                    : soldOut
                      ? 'Hết chỗ'
                      : !areaId
                        ? 'Chọn khu vực trước'
                        : `Mua · ${formatVnd(pkg.price, 'vi')}`}
                </button>

                {vip && (
                  <p className="mt-2 text-center text-caption text-ink-500">
                    Trừ từ số dư, huỷ giữa kỳ được hoàn theo ngày trọn vẹn
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {done && (
        <p className="mt-4 rounded-md border border-success-bd bg-success-bg px-4 py-3 text-body-l text-success-fg">
          {done}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger-bd bg-danger-bg px-4 py-3 text-body-l text-danger-fg"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Khung giờ của gói theo giờ, luôn ghim về **giờ Việt Nam**.
 *
 * Bắt buộc khai timeZone chứ không để mặc định: server render ở UTC còn trình duyệt
 * render ở giờ máy khách, nên bỏ trống sẽ vừa gây hydration mismatch vừa hiện sai
 * giờ cho bất kỳ ai không ở múi giờ của server. Campaign vốn đã cắt theo giờ Việt
 * Nam ở backend, nên đây là múi giờ đúng chứ không phải một lựa chọn tuỳ tiện.
 */
function formatSlotWindow(startsAt: string): string {
  return new Date(startsAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

/**
 * Thời lượng gói, viết theo **đúng đơn vị gói được bán**.
 *
 * Gói theo giờ (Instant Boost) khai durationHours và durationDays=1; hiển thị "1 ngày"
 * ở đó là mô tả sai thứ khách trả tiền — cùng loại lỗi mà CHECK chk_package_duration_unit
 * chặn ở tầng DB, và cũng là lý do hoàn tiền phải tính theo đúng đơn vị này.
 */
function durationLabel(pkg: PromotionPackage): string {
  if (pkg.durationHours !== null) return `${pkg.durationHours} giờ`;
  return `${pkg.durationDays} ngày`;
}

function Feature({ has, text }: { has: boolean; text: string }) {
  return (
    <li
      className={`flex gap-2.5 text-body-l leading-[22px] ${has ? 'text-ink-700' : 'text-ink-500'}`}
    >
      <svg
        aria-hidden
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`mt-1 shrink-0 ${has ? 'text-success-fg' : 'text-ink-300'}`}
      >
        {has ? <path d="m5 13 4 4L19 7" /> : <path d="M18 6 6 18M6 6l12 12" />}
      </svg>
      {text}
    </li>
  );
}
