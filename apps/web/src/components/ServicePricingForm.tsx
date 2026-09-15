'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatVnd } from '@/lib/site';
import type { KtvServiceItem, ServiceItem } from '@/lib/types';

const MAX_SERVICES = 20;

/** Mức giá dùng cho dòng vừa tick. Xem ghi chú ở `toggle`. */
const DEFAULT_PRICE = 300_000;
const DEFAULT_DURATION = 60;

interface Row {
  serviceId: string;
  priceFrom: number;
  durationMin: number;
}

export function ServicePricingForm({
  catalog,
  mine,
}: {
  catalog: ServiceItem[];
  mine: KtvServiceItem[];
}) {
  const router = useRouter();
  const catalogIds = new Set(catalog.map((s) => s.id));
  const [rows, setRows] = useState<Row[]>(
    // Lọc theo `catalog` (chỉ dịch vụ đang bán): một dịch vụ KTV từng khai giá rồi
    // bị ngừng bán (`Service.IsActive = false`) không còn checkbox nào trong danh
    // sách bên dưới để hiện/bỏ tick nó — giữ nguyên trong `rows` sẽ âm thầm gửi lại
    // dòng đó mỗi lần bấm Lưu mà KTV không thấy và không chủ động giữ.
    mine
      .filter((m) => catalogIds.has(m.serviceId))
      .map((m) => ({ serviceId: m.serviceId, priceFrom: m.priceFrom, durationMin: m.durationMin })),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const byId = new Map(rows.map((r) => [r.serviceId, r]));

  function toggle(serviceId: string) {
    setRows((prev) =>
      prev.some((r) => r.serviceId === serviceId)
        ? prev.filter((r) => r.serviceId !== serviceId)
        : prev.length >= MAX_SERVICES
          ? prev
          : [...prev, { serviceId, priceFrom: DEFAULT_PRICE, durationMin: DEFAULT_DURATION }],
    );
  }

  function update(serviceId: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.serviceId === serviceId ? { ...r, ...patch } : r)));
  }

  async function save() {
    setPending(true);
    setError(null);
    setDone(null);

    try {
      // PUT thay toàn bộ danh sách, không phải thêm/xoá từng dòng: bảng chỉ có vài
      // dòng mỗi KTV nên client không cần tự tính diff.
      //
      // Đi qua `/api/ktv-profile`, **không** `/api/proxy`: bảng giá nằm trên trang hồ
      // sơ công khai (ISR 600 giây), nên thiếu bước xoá cache thì KTV sửa giá xong mở
      // trang của mình vẫn thấy giá cũ và tưởng lượt lưu vừa rồi hỏng. Tệ hơn: khách
      // gọi tới theo mức giá đã hết hiệu lực rồi tranh cãi ngay ở cửa nhà.
      const res = await fetch('/api/ktv-profile?target=services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows }),
      });

      const data = (await res.json().catch(() => null)) as
        | { title?: string; errors?: Record<string, string[]> }
        | null;

      if (!res.ok) {
        const fieldErrors = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
        setError(fieldErrors || data?.title || 'Không lưu được bảng giá.');
        return;
      }

      setDone('Đã lưu bảng giá.');
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-5">
      {/* Ba câu hỏi KTV hay hiểu sai, trả lời trước khi họ chạm vào ô nhập. Đặt ở đây
          chứ không ở page: form này render ở **hai** nơi (trang dịch vụ và section cũ
          trong trang hồ sơ), nên hướng dẫn để ngoài form sẽ chỉ có ở một trong hai. */}
      <div className="mb-5 rounded-md bg-ink-50 px-4 py-3 text-sm text-ink-700">
        <p className="font-medium text-ink-900">Cách khai bảng giá</p>
        <ul className="mt-2 space-y-1.5">
          <li>
            <strong>Giá từ</strong> là mức <em>thấp nhất</em> bạn nhận làm dịch vụ đó — khách hiểu
            là &quot;từ mức này trở lên&quot;. Khai giá cao nhất sẽ khiến bạn bị lọc ra khỏi kết
            quả của khách đang tìm theo tầm giá.
          </li>
          <li>
            <strong>Thời lượng</strong> là buổi tiêu chuẩn ứng với mức giá trên. Cùng một dịch vụ
            làm 60 phút và 90 phút thì khai theo buổi ngắn nhất.
          </li>
          <li>
            Giá đã bao gồm việc bạn <strong>tới tận nơi khách</strong>. Nếu có phụ phí đi xa, nói
            rõ khi khách gọi — đừng cộng sẵn vào đây, vì con số này là thứ khách dùng để so sánh.
          </li>
        </ul>
        <p className="mt-2.5 text-ink-600">
          Chỉ tick những dịch vụ bạn thật sự làm được. Khách lọc theo dịch vụ, nên tick thừa nghĩa
          là nhận cuộc gọi cho việc mình không làm.
        </p>
      </div>

      <ul className="space-y-3">
        {catalog.map((service) => {
          const row = byId.get(service.id);
          const on = row !== undefined;

          return (
            <li key={service.id} className="rounded-md border border-ink-200 p-3">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(service.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{service.name}</span>
                  {service.description && (
                    <span className="mt-0.5 block text-sm text-ink-500">{service.description}</span>
                  )}
                </span>
              </label>

              {on && row && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-3 pl-7">
                  <label className="block text-sm">
                    <span className="text-ink-700">Giá từ (VND)</span>
                    <input
                      type="number"
                      min={0}
                      max={50_000_000}
                      step={10_000}
                      value={row.priceFrom}
                      onChange={(e) =>
                        update(service.id, { priceFrom: Math.trunc(Number(e.target.value)) })
                      }
                      className="mt-1 w-40 rounded-md border border-ink-200 bg-white px-3 py-1.5 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 tabular-nums"
                    />
                    {/* Đọc lại con số thành chữ tiền: ô number không có dấu phân cách
                        nên "3000000" và "300000" nhìn gần như nhau — sai một số 0 ở đây
                        là khai giá gấp mười, và không có gì khác trên màn hình bắt được. */}
                    <span className="mt-1 block text-xs text-ink-500">
                      Khách thấy: <strong>từ {formatVnd(row.priceFrom, 'vi')}</strong>
                    </span>
                  </label>

                  <label className="block text-sm">
                    <span className="text-ink-700">Thời lượng (phút)</span>
                    <input
                      type="number"
                      min={15}
                      max={300}
                      step={15}
                      value={row.durationMin}
                      onChange={(e) =>
                        update(service.id, { durationMin: Math.trunc(Number(e.target.value)) })
                      }
                      className="mt-1 w-32 rounded-md border border-ink-200 bg-white px-3 py-1.5 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 tabular-nums"
                    />
                    <span className="mt-1 block text-xs text-ink-500">15–300 phút</span>
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-brand-500 px-6 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Đang lưu…' : 'Lưu bảng giá'}
        </button>
        <span className="text-sm text-ink-500">
          Đã chọn {rows.length}/{MAX_SERVICES} dịch vụ
        </span>
      </div>

      {done && <p className="mt-3 text-sm text-brand-700">{done}</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
