'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatVnd } from '@/lib/site';
import type { KtvServiceItem, ServiceItem } from '@/lib/types';

const MAX_SERVICES = 20;

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
  const [rows, setRows] = useState<Row[]>(
    mine.map((m) => ({ serviceId: m.serviceId, priceFrom: m.priceFrom, durationMin: m.durationMin })),
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
          : [...prev, { serviceId, priceFrom: 300_000, durationMin: 60 }],
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
      const res = await fetch('/api/proxy/ktv/profile/services', {
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
                <div className="mt-3 flex flex-wrap gap-4 pl-7">
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
                    <span className="mt-1 block text-xs text-ink-500">
                      {formatVnd(row.priceFrom)}
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
