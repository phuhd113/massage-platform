'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { initialOf, isOptimizable, mediaUrl } from '@/lib/media';
import { ktvPath } from '@/lib/site';
import type { MyKtvPhoto, MyKtvProfile } from '@/lib/types';

const MAX_MB = 3;
const MAX_PHOTOS = 10;
const ACCEPT = '.jpg,.jpeg,.png,.webp';

/**
 * Ảnh đại diện và bộ sưu tập ảnh hồ sơ.
 *
 * Hai luồng khác nhau và cố ý trông khác nhau: ảnh đại diện hiện **ngay** trên trang
 * công khai, còn ảnh bộ sưu tập vào hàng chờ duyệt. Gộp chúng vào một khối trông
 * giống nhau sẽ khiến KTV tưởng ảnh bộ sưu tập cũng đã lên sóng.
 *
 * Đi qua `/api/ktv-media` chứ không phải `/api/proxy`: trang hồ sơ công khai là ISR
 * 600 giây, nên đổi ảnh đại diện xong mà không `revalidatePath` thì chính KTV mở
 * trang mình vẫn thấy ảnh cũ và tưởng lượt tải lên đã hỏng.
 */
export function ProfileMediaSection({ profile }: { profile: MyKtvProfile }) {
  const router = useRouter();
  const publicPath = ktvPath('vi', profile.slug, profile.id);

  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  /**
   * Một chỗ duy nhất gọi API ảnh, để mọi thao tác cùng cách báo lỗi và cùng nhớ
   * `router.refresh()`. Trả về true khi thành công.
   */
  async function call(
    key: string,
    url: string,
    init: RequestInit,
    successMessage: string,
  ): Promise<boolean> {
    setPending(key);
    setError(null);
    setDone(null);

    try {
      const res = await fetch(url, init);
      const data = (await res.json().catch(() => null)) as
        | { title?: string; message?: string; errors?: string[] }
        | null;

      if (!res.ok) {
        setError(
          data?.errors?.join(' ') || data?.title || data?.message || 'Không thực hiện được.',
        );
        return false;
      }

      setDone(successMessage);
      router.refresh();
      return true;
    } catch {
      setError('Không kết nối được máy chủ.');
      return false;
    } finally {
      setPending(null);
    }
  }

  /** Kiểm cỡ file ở client cho phản hồi tức thì. Backend vẫn kiểm lại — đây là tiện lợi, không phải ràng buộc. */
  function tooBig(file: File): boolean {
    if (file.size <= MAX_MB * 1024 * 1024) return false;
    setError(`Ảnh vượt quá ${MAX_MB}MB. Hãy chọn ảnh nhỏ hơn hoặc giảm chất lượng khi xuất.`);
    setDone(null);
    return true;
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset ngay để chọn lại đúng file vừa chọn vẫn kích hoạt onChange — nếu không,
    // KTV chọn nhầm rồi chọn lại cùng tấm ảnh sẽ thấy giao diện không phản ứng gì.
    e.target.value = '';
    if (!file || tooBig(file)) return;

    const form = new FormData();
    form.append('file', file);

    // Không tự đặt Content-Type: trình duyệt phải tự sinh nó kèm boundary multipart.
    await call(
      'avatar',
      `/api/ktv-media?target=avatar&path=${encodeURIComponent(publicPath)}`,
      { method: 'PUT', body: form },
      'Đã cập nhật ảnh đại diện. Ảnh hiển thị công khai ngay.',
    );
  }

  async function removeAvatar() {
    await call(
      'avatar',
      `/api/ktv-media?target=avatar&path=${encodeURIComponent(publicPath)}`,
      { method: 'DELETE' },
      'Đã gỡ ảnh đại diện.',
    );
  }

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || tooBig(file)) return;

    const form = new FormData();
    form.append('file', file);

    // Không kèm `path`: ảnh vào hàng chờ duyệt nên trang công khai chưa đổi gì, và
    // xoá bản dựng sẵn của một trang SEO ở đây là trả giá mà không được gì.
    await call(
      'photo',
      '/api/ktv-media?target=photos',
      { method: 'POST', body: form },
      'Đã gửi ảnh. Ảnh hiển thị công khai sau khi được duyệt.',
    );
  }

  async function removePhoto(photo: MyKtvPhoto) {
    // Chỉ ảnh đã duyệt mới đang nằm trên trang công khai, nên chỉ nó mới cần xoá cache.
    const path =
      photo.verifyStatus === 'VERIFIED' ? `&path=${encodeURIComponent(publicPath)}` : '';

    await call(
      `photo-${photo.id}`,
      `/api/ktv-media?target=photos&photoId=${photo.id}${path}`,
      { method: 'DELETE' },
      'Đã xoá ảnh.',
    );
  }

  const avatar = mediaUrl(profile.avatarUrl);
  const busy = pending !== null;

  return (
    <div className="space-y-6">
      {error && (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="rounded-md bg-success-bg px-4 py-3 text-sm text-success-fg">
          {done}
        </p>
      )}

      <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
        <h3 className="text-h4 text-ink-900">Ảnh đại diện</h3>
        <p className="mt-1 text-sm text-ink-600">
          Đây là ảnh khách nhìn thấy đầu tiên trong kết quả tìm kiếm. Ảnh chân dung rõ mặt, ánh
          sáng tốt. Hiển thị công khai ngay sau khi tải lên.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {avatar ? (
            <Image
              src={avatar}
              alt="Ảnh đại diện hiện tại"
              width={96}
              height={96}
              sizes="96px"
              className="h-24 w-24 shrink-0 rounded-xl border border-ink-200 object-cover"
              unoptimized={!isOptimizable(avatar)}
            />
          ) : (
            <span
              aria-hidden
              className="flex h-24 w-24 shrink-0 select-none items-center justify-center rounded-xl border border-ink-200 bg-brand-50 text-4xl font-bold text-brand-400"
            >
              {initialOf(profile.fullName)}
            </span>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`cursor-pointer rounded-full border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 transition hover:border-ink-400 hover:bg-ink-50 ${
                busy ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              {pending === 'avatar' ? 'Đang tải lên…' : avatar ? 'Đổi ảnh' : 'Chọn ảnh'}
              <input
                type="file"
                accept={ACCEPT}
                className="sr-only"
                disabled={busy}
                onChange={uploadAvatar}
              />
            </label>

            {avatar && (
              <button
                type="button"
                disabled={busy}
                onClick={removeAvatar}
                className="rounded-full px-4 py-2 text-sm font-semibold text-ink-500 transition hover:text-danger-fg disabled:opacity-50"
              >
                Gỡ ảnh
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-h4 text-ink-900">Hình ảnh hồ sơ</h3>
          <span className="tabular text-sm text-ink-500">
            {profile.photos.length}/{MAX_PHOTOS} ảnh
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-600">
          Ảnh không gian làm việc, dụng cụ, hoặc chứng nhận. Ảnh hiển thị công khai{' '}
          <strong className="font-semibold text-ink-700">sau khi được duyệt</strong>, tối đa{' '}
          {MAX_MB}MB mỗi ảnh.
        </p>

        {profile.photos.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {profile.photos.map((p) => (
              <PhotoTile
                key={p.id}
                photo={p}
                busy={busy}
                pending={pending === `photo-${p.id}`}
                onRemove={() => removePhoto(p)}
              />
            ))}
          </ul>
        )}

        {profile.photos.length < MAX_PHOTOS && (
          <label
            className={`mt-4 inline-block cursor-pointer rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-button transition hover:bg-brand-600 ${
              busy ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {pending === 'photo' ? 'Đang tải lên…' : 'Thêm ảnh'}
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={uploadPhoto}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * Một ô ảnh trong bộ sưu tập, kèm trạng thái duyệt.
 *
 * Trạng thái hiện ngay trên ảnh chứ không gom thành một dòng chú thích chung: KTV
 * có thể có ảnh đã duyệt và ảnh bị từ chối cùng lúc, và một dòng chung sẽ không nói
 * được tấm nào là tấm nào.
 */
function PhotoTile({
  photo,
  busy,
  pending,
  onRemove,
}: {
  photo: MyKtvPhoto;
  busy: boolean;
  pending: boolean;
  onRemove: () => void;
}) {
  const src = mediaUrl(photo.url);

  return (
    <li className="overflow-hidden rounded-xl border border-ink-200 bg-ink-50">
      {src && (
        <Image
          src={src}
          alt={photo.caption ?? 'Ảnh hồ sơ'}
          width={300}
          height={225}
          sizes="(min-width: 640px) 200px, 45vw"
          className="aspect-[4/3] w-full object-cover"
          unoptimized={!isOptimizable(src)}
        />
      )}

      <div className="space-y-1.5 px-3 py-2">
        <PhotoStatus photo={photo} />

        <button
          type="button"
          disabled={busy}
          onClick={onRemove}
          className="text-sm font-medium text-ink-500 transition hover:text-danger-fg disabled:opacity-50"
        >
          {pending ? 'Đang xoá…' : 'Xoá'}
        </button>
      </div>
    </li>
  );
}

function PhotoStatus({ photo }: { photo: MyKtvPhoto }) {
  if (photo.verifyStatus === 'VERIFIED') {
    return <p className="text-caption font-medium text-success-fg">Đang hiển thị công khai</p>;
  }

  if (photo.verifyStatus === 'PENDING') {
    return <p className="text-caption font-medium text-warning-fg">Chờ duyệt</p>;
  }

  return (
    <p className="text-caption font-medium text-danger-fg">
      Bị từ chối{photo.rejectionReason ? `: ${photo.rejectionReason}` : ''}
    </p>
  );
}
