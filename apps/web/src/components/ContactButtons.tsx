'use client';

import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5080/api/v1';

type Channel = 'CALL' | 'ZALO';

/**
 * Nút liên hệ — phần tương tác duy nhất của trang hồ sơ, nên là client component
 * nhỏ tách riêng thay vì biến cả trang thành client. Phần nội dung Google cần
 * (tên, giới thiệu, dịch vụ, đánh giá) vẫn nằm trong HTML đầu tiên.
 *
 * Số điện thoại chỉ có sau khi lượt liên hệ được ghi nhận: gọi thẳng từ trình
 * duyệt để backend thấy đúng IP khách, thay vì proxy qua Next và làm mọi lượt
 * bấm trông như đến từ cùng một máy chủ.
 */
export function ContactButtons({ ktvId, ktvName }: { ktvId: string; ktvName: string }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [pending, setPending] = useState<Channel | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function contact(channel: Channel) {
    setPending(channel);
    setError(null);

    try {
      const res = await fetch(`${API}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ktvId,
          channel,
          sourceUrl: window.location.pathname,
        }),
      });

      if (res.status === 429) {
        setError('Bạn đã bấm liên hệ quá nhiều lần. Thử lại sau ít phút.');
        return;
      }
      if (!res.ok) {
        setError('Chưa lấy được số điện thoại. Vui lòng thử lại.');
        return;
      }

      const data = (await res.json()) as { phone: string };
      setPhone(data.phone);

      window.location.href =
        channel === 'CALL' ? `tel:${data.phone}` : `https://zalo.me/${data.phone}`;
    } catch {
      setError('Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => contact('CALL')}
          disabled={pending !== null}
          className="rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          {pending === 'CALL' ? 'Đang lấy số…' : `Gọi ${ktvName}`}
        </button>

        <button
          type="button"
          onClick={() => contact('ZALO')}
          disabled={pending !== null}
          className="rounded-md border border-brand-500 px-5 py-2.5 font-medium text-brand-600 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          {pending === 'ZALO' ? 'Đang lấy số…' : 'Nhắn Zalo'}
        </button>
      </div>

      {phone && (
        <p className="mt-3 text-sm text-stone-700">
          Số điện thoại: <a href={`tel:${phone}`} className="font-semibold text-brand-600">{phone}</a>
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
