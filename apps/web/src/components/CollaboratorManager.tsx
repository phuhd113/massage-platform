'use client';

import { useFormValidation } from '@/lib/use-form-validation';
import { viMessages } from '@/lib/validation-messages';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminCollaborator } from '@/lib/types';

/**
 * Thêm cộng tác viên và bật/tắt mã.
 *
 * <b>Không có nút xoá.</b> Backend khai `ON DELETE RESTRICT` nên xoá một CTV đang có hồ
 * sơ giới thiệu sẽ thất bại — và đó là hành vi đúng: xoá họ là xoá cơ sở tính hoa hồng
 * của những lượt giới thiệu hợp lệ. Ngừng hợp tác thì tắt mã, lịch sử vẫn nguyên.
 */
export function CollaboratorManager({ items }: { items: AdminCollaborator[] }) {
  const router = useRouter();
  // Thông báo validate tiếng Việt — dashboard/admin cố ý chỉ có một ngôn ngữ.
  const formRef = useFormValidation(viMessages());
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setPending('create');
    setError(null);
    setDone(null);

    try {
      const res = await fetch('/api/proxy/collaborators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fullName, phone: phone || null }),
      });
      const data = (await res.json().catch(() => null)) as
        | { title?: string; errors?: Record<string, string[]> }
        | null;

      if (!res.ok) {
        const fieldErrors = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
        setError(fieldErrors || data?.title || 'Không thêm được cộng tác viên.');
        return;
      }

      setDone(`Đã thêm mã ${code.trim().toUpperCase()}.`);
      setCode('');
      setFullName('');
      setPhone('');
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(null);
    }
  }

  async function toggle(c: AdminCollaborator) {
    setPending(c.id);
    setError(null);
    setDone(null);

    try {
      const res = await fetch(`/api/proxy/collaborators/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: c.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { title?: string } | null;
        setError(data?.title ?? 'Không đổi được trạng thái.');
        return;
      }

      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} onSubmit={create} className="rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="text-h4 font-semibold text-ink-900">Thêm cộng tác viên</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-body">
            <span className="text-ink-700">Mã giới thiệu *</span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={32}
              placeholder="AN-01"
              className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 font-mono uppercase tracking-wide focus:border-brand-500 focus:outline-none"
            />
            <span className="mt-1 block text-caption text-ink-500">
              Chữ không dấu, số và gạch ngang. Đã tạo thì không đổi được.
            </span>
          </label>

          <label className="block text-body">
            <span className="text-ink-700">Họ tên *</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 focus:border-brand-500 focus:outline-none"
            />
          </label>

          <label className="block text-body">
            <span className="text-ink-700">Số điện thoại</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={15}
              className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 font-mono focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={pending === 'create' || code.trim().length < 3 || fullName.trim().length < 2}
          className="mt-4 rounded-md bg-brand-500 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {pending === 'create' ? 'Đang thêm…' : 'Thêm cộng tác viên'}
        </button>

        {done && <p className="mt-3 text-body text-brand-700">{done}</p>}
        {error && (
          <p role="alert" className="mt-3 text-body text-danger-fg">
            {error}
          </p>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white px-5 py-8 text-center">
          <p className="text-body-l text-ink-600">Chưa có cộng tác viên nào.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full min-w-[640px] text-body">
            <thead className="border-b border-ink-200 text-left text-body-s text-ink-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Mã</th>
                <th className="px-4 py-3 font-semibold">Họ tên</th>
                <th className="px-4 py-3 font-semibold">Điện thoại</th>
                <th className="px-4 py-3 text-right font-semibold">Đã mời</th>
                <th className="px-4 py-3 text-right font-semibold">Đã duyệt</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-3 font-mono font-semibold text-ink-900">{c.code}</td>
                  <td className="px-4 py-3 text-ink-800">{c.fullName}</td>
                  <td className="px-4 py-3 font-mono text-ink-600">{c.phone ?? '—'}</td>
                  <td className="tabular px-4 py-3 text-right font-mono text-ink-700">
                    {c.referredCount}
                  </td>
                  {/* Con số đáng dùng để tính hoa hồng: hồ sơ tạo ra rồi không bao giờ
                      qua duyệt thì chưa mang lại gì cho sàn. */}
                  <td className="tabular px-4 py-3 text-right font-mono font-semibold text-ink-900">
                    {c.verifiedCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${
                        c.status === 'ACTIVE'
                          ? 'bg-success-bg text-success-fg'
                          : 'bg-ink-100 text-ink-600'
                      }`}
                    >
                      {c.status === 'ACTIVE' ? 'Đang dùng' : 'Đã tắt'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void toggle(c)}
                      disabled={pending === c.id}
                      className="rounded-md border border-ink-300 px-3 py-1.5 text-body-s text-ink-700 transition hover:border-ink-400 disabled:opacity-60"
                    >
                      {pending === c.id ? '…' : c.status === 'ACTIVE' ? 'Tắt mã' : 'Bật lại'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-body text-ink-500">
        Tắt mã chỉ chặn dùng cho hồ sơ mới — các hồ sơ đã giới thiệu vẫn giữ nguyên liên kết, vì
        đó là lịch sử đã xảy ra và là cơ sở tính hoa hồng.
      </p>
    </div>
  );
}
