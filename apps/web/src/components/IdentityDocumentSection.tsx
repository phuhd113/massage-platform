'use client';

import { useFormValidation } from '@/lib/use-form-validation';
import { viMessages } from '@/lib/validation-messages';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { formatDateTime } from '@/lib/site';
import type { MyIdentityDocument } from '@/lib/types';

const MAX_MB = 3;
const ACCEPT = '.jpg,.jpeg,.png,.webp';

/**
 * Ảnh CCCD hai mặt.
 *
 * Khác chứng chỉ ở ba điểm, và cả ba đều cố ý hiện ra trong giao diện:
 *
 * 1. **Bắt buộc.** Hồ sơ không duyệt được nếu thiếu, nên khối này nói thẳng điều đó
 *    thay vì để KTV nộp hồ sơ rồi chờ mãi không hiểu vì sao chưa được duyệt.
 * 2. **Một tấm thẻ, hai mặt.** Gửi cùng lúc cả hai — backend cũng lưu chung một hàng
 *    và duyệt cùng nhau, vì duyệt riêng từng mặt là để lọt việc ghép hai nửa của hai
 *    thẻ khác nhau.
 * 3. **Gửi lại là thay hẳn bản cũ** và đưa về chờ duyệt lại. Nói trước để KTV không
 *    tưởng mình đang bổ sung thêm ảnh.
 *
 * Không dùng `/api/ktv-media`: ảnh CCCD không bao giờ ra trang công khai nên không có
 * cache nào cần xoá — `revalidatePath` ở đây là bỏ bản dựng sẵn của một trang SEO mà
 * không đổi lại được gì.
 */
export function IdentityDocumentSection({ doc }: { doc: MyIdentityDocument | null }) {
  const router = useRouter();
  // Thông báo validate tiếng Việt — dashboard/admin cố ý chỉ có một ngôn ngữ.
  const formRef = useFormValidation(viMessages());
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!front || !back) return;

    // Kiểm ở client cho phản hồi tức thì; backend vẫn kiểm lại — đây là tiện lợi,
    // không phải ràng buộc.
    const tooBig = [front, back].find((f) => f.size > MAX_MB * 1024 * 1024);
    if (tooBig) {
      setError(`Ảnh vượt quá ${MAX_MB}MB. Chụp lại hoặc giảm chất lượng khi xuất.`);
      return;
    }

    setPending(true);
    setError(null);
    setDone(null);

    const form = new FormData();
    form.append('front', front);
    form.append('back', back);

    try {
      // Không tự đặt Content-Type: boundary của multipart do trình duyệt sinh.
      const res = await fetch('/api/proxy/ktv/profile/identity', { method: 'PUT', body: form });
      const data = (await res.json().catch(() => null)) as
        | { title?: string; message?: string; errors?: string[] }
        | null;

      if (!res.ok) {
        setError(
          data?.errors?.join(' ') || data?.title || data?.message || 'Không gửi được ảnh CCCD.',
        );
        return;
      }

      setDone('Đã gửi ảnh CCCD. Quản trị viên sẽ đối chiếu trước khi hồ sơ được duyệt.');
      setFront(null);
      setBack(null);
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
      {doc ? (
        <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-medium">CCCD đã gửi</div>
              <div className="text-sm text-ink-500">Gửi lúc {formatDateTime(doc.submittedAt, 'vi')}</div>
              {doc.verifyStatus === 'REJECTED' && doc.rejectionReason && (
                <div className="mt-1 text-sm text-danger-fg">Lý do: {doc.rejectionReason}</div>
              )}
            </div>
            <StatusPill status={doc.verifyStatus} />
          </div>

          {/*
            Link mở tab mới, không nhúng thẻ ảnh: URL ký chỉ sống 15 phút, nên một
            tấm ảnh nhúng sẵn sẽ thành ô vỡ khi KTV để trang mở lâu — trông như hệ
            thống đã làm mất giấy tờ của họ.
          */}
          <div className="mt-4 flex gap-4 text-sm">
            <a
              href={mediaUrl(doc.frontUrl) ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              Xem mặt trước
            </a>
            <a
              href={mediaUrl(doc.backUrl) ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline"
            >
              Xem mặt sau
            </a>
          </div>
        </div>
      ) : (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-warning-fg">
          Chưa có ảnh CCCD. Hồ sơ <strong>chưa được duyệt</strong> cho tới khi bạn gửi và quản trị
          viên đối chiếu xong.
        </p>
      )}

      <form ref={formRef} onSubmit={submit} className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
        <h3 className="font-medium">{doc ? 'Gửi lại ảnh CCCD' : 'Gửi ảnh CCCD'}</h3>
        <p className="mt-1 text-sm text-ink-600">
          Chụp rõ cả bốn góc, không loá, chữ đọc được. Ảnh chỉ quản trị viên xem được để đối chiếu
          danh tính, không bao giờ hiển thị trên hồ sơ công khai.
          {doc && ' Gửi lại sẽ thay ảnh cũ và hồ sơ quay về trạng thái chờ duyệt.'}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-ink-700">Mặt trước *</span>
            <input
              type="file"
              required
              accept={ACCEPT}
              onChange={(e) => setFront(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm"
            />
            <FilePreview file={front} label="Xem trước mặt trước" />
          </label>

          <label className="block text-sm">
            <span className="text-ink-700">Mặt sau *</span>
            <input
              type="file"
              required
              accept={ACCEPT}
              onChange={(e) => setBack(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink-100 file:px-3 file:py-2 file:text-sm"
            />
            <FilePreview file={back} label="Xem trước mặt sau" />
          </label>
        </div>

        <p className="mt-2 text-xs text-ink-500">JPG, PNG hoặc WEBP, mỗi ảnh tối đa {MAX_MB}MB.</p>

        <button
          type="submit"
          disabled={pending || !front || !back}
          className="mt-4 rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Đang tải lên…' : 'Gửi duyệt'}
        </button>

        {done && <p className="mt-3 text-sm text-brand-700">{done}</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger-fg">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

/**
 * Ảnh vừa chọn, hiện ngay trước khi gửi.
 *
 * Lý do nó đáng có ở đúng chỗ này: KTV chụp CCCD bằng điện thoại rồi chọn từ thư viện
 * hàng trăm tấm giống nhau, và mặt trước/mặt sau của cùng một thẻ nằm cạnh nhau. Chọn
 * nhầm — hai lần mặt trước, hoặc ảnh của người khác — là lỗi thao tác không có gì báo
 * cho tới khi admin từ chối vài giờ sau. Một khung ảnh nhỏ biến vòng phản hồi đó từ
 * hàng giờ thành tức thì.
 *
 * `URL.createObjectURL` chứ không phải `FileReader`: nó đồng bộ, không đọc cả file vào
 * bộ nhớ, và ảnh CCCD tới 3MB. Đổi lại là **phải tự thu hồi** — object URL sống tới
 * hết vòng đời trang, nên KTV chọn lại ảnh mười lần sẽ giữ mười file trong bộ nhớ nếu
 * không revoke. Thu hồi trong hàm dọn của `useEffect` chứ không ngay sau khi gán src:
 * revoke sớm thì trình duyệt chưa kịp đọc và ảnh không bao giờ hiện.
 *
 * Ảnh nằm **trong** `<label>` bọc ô file, nên phải chặn `onClick` lan lên: không chặn
 * thì bấm vào ảnh để nhìn kỹ lại mở hộp chọn file và xoá mất lựa chọn vừa rồi.
 */
function FilePreview({ file, label }: { file: File | null; label: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url || !file) return null;

  return (
    <span className="mt-2 block" onClick={(e) => e.preventDefault()}>
      {/*
        `img` thường, không `next/image`: đây là blob: URL của file trên máy KTV, thứ
        trình tối ưu ảnh của Next không fetch được — nó sẽ trả 400 và ảnh không hiện.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        className="h-32 w-full rounded-md border border-ink-200 bg-ink-50 object-contain"
      />
      <span className="mt-1 block truncate text-xs text-ink-500" title={file.name}>
        {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
      </span>
    </span>
  );
}

function StatusPill({ status }: { status: MyIdentityDocument['verifyStatus'] }) {
  const style =
    status === 'VERIFIED'
      ? 'bg-brand-50 text-brand-700'
      : status === 'REJECTED'
        ? 'bg-red-50 text-danger-fg'
        : 'bg-amber-50 text-warning-fg';

  const label =
    status === 'VERIFIED' ? 'Đã xác minh' : status === 'REJECTED' ? 'Bị từ chối' : 'Chờ duyệt';

  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${style}`}>{label}</span>;
}
