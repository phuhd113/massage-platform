'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { MyCertification } from '@/lib/types';

const MAX_MB = 5;
const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf';

export function CertificationsSection({
  certifications,
}: {
  certifications: MyCertification[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [issuingOrg, setIssuingOrg] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    // Chặn ở client trước cho phản hồi tức thì; backend vẫn kiểm lại vì kiểm tra
    // phía client không phải là ràng buộc, chỉ là tiện lợi.
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`File vượt quá ${MAX_MB}MB.`);
      return;
    }

    setPending(true);
    setError(null);
    setDone(null);

    const form = new FormData();
    form.append('Name', name);
    if (issuingOrg) form.append('IssuingOrg', issuingOrg);
    if (issuedAt) form.append('IssuedAt', issuedAt);
    form.append('file', file);

    try {
      // Không tự đặt Content-Type: trình duyệt phải tự sinh nó kèm boundary của
      // multipart, đặt tay sẽ mất boundary và backend không tách được file.
      const res = await fetch('/api/proxy/ktv/certifications', { method: 'POST', body: form });

      const data = (await res.json().catch(() => null)) as
        | { title?: string; errors?: string[] }
        | null;

      if (!res.ok) {
        setError(data?.errors?.join(' ') || data?.title || 'Không tải lên được chứng chỉ.');
        return;
      }

      setDone('Đã gửi chứng chỉ. Chứng chỉ hiển thị công khai sau khi được duyệt.');
      setName('');
      setIssuingOrg('');
      setIssuedAt('');
      setFile(null);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {certifications.length > 0 && (
        <ul className="space-y-2">
          {certifications.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-ink-200 bg-white px-4 py-3 shadow-card"
            >
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-ink-500">
                  {c.issuingOrg ?? 'Chưa ghi nơi cấp'}
                  {c.issuedAt && ` · ${new Date(c.issuedAt).toLocaleDateString('vi-VN')}`}
                </div>
                {c.verifyStatus === 'REJECTED' && c.rejectionReason && (
                  <div className="mt-1 text-sm text-red-700">Lý do: {c.rejectionReason}</div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <a
                  href={c.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-brand-600 hover:underline"
                >
                  Xem file
                </a>
                <StatusPill status={c.verifyStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
        <h3 className="font-medium">Thêm chứng chỉ</h3>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-ink-700">Tên chứng chỉ *</span>
            <input
              required
              minLength={2}
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chứng chỉ xoa bóp bấm huyệt"
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink-700">Nơi cấp</span>
            <input
              maxLength={150}
              value={issuingOrg}
              onChange={(e) => setIssuingOrg(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink-700">Ngày cấp</span>
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <label className="block text-sm">
            <span className="text-ink-700">Ảnh hoặc PDF *</span>
            <input
              type="file"
              required
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm"
            />
            <span className="mt-1 block text-xs text-ink-500">
              JPG, PNG, WEBP hoặc PDF, tối đa {MAX_MB}MB.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={pending || !file || name.trim().length < 2}
          className="mt-4 rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Đang tải lên…' : 'Gửi duyệt'}
        </button>

        {done && <p className="mt-3 text-sm text-brand-700">{done}</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

function StatusPill({ status }: { status: MyCertification['verifyStatus'] }) {
  const style =
    status === 'VERIFIED'
      ? 'bg-brand-50 text-brand-700'
      : status === 'REJECTED'
        ? 'bg-red-50 text-red-700'
        : 'bg-amber-50 text-amber-800';

  const label =
    status === 'VERIFIED' ? 'Đã duyệt' : status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt';

  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${style}`}>{label}</span>;
}
