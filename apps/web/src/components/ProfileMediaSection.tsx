'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { compressImage } from '@/lib/image-compress';
import { initialOf, isOptimizable, mediaUrl } from '@/lib/media';
import { ktvPath } from '@/lib/site';
import type { MyKtvPhoto, MyKtvProfile } from '@/lib/types';

const MAX_MB = 3;
const MAX_PHOTOS = 10;

/**
 * Phải kê cả `.heic`/`.heif`, dù backend không nhận chúng và `compressImage` luôn đổi
 * sang JPEG trước khi gửi.
 *
 * Lý do: `accept` là bộ lọc của **trình chọn file**, chạy trước khi code của ta thấy
 * file. Thiếu hai đuôi này thì trình chọn ảnh của iOS làm mờ toàn bộ ảnh chụp bằng
 * camera — KTV mở thư viện ra và không bấm được tấm nào, không có thông báo nào giải
 * thích. `image/*` cũng bắt được ca đó, và bắt luôn những đuôi lạ mà máy Android đặt ra.
 */
const ACCEPT = 'image/*,.jpg,.jpeg,.png,.webp,.heic,.heif';

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
   * Thao tác gần nhất, giữ lại **sau** khi nó chạy xong.
   *
   * Tách khỏi `pending` vì `pending` về null ngay khi request kết thúc — đúng lúc
   * thông báo cần hiện. Không có trường này thì `feedbackFor` không biết nên hiện
   * thông báo ở khối nào.
   */
  const [lastKey, setLastKey] = useState<string | null>(null);

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
    setLastKey(key);
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

  /**
   * Nén rồi kiểm cỡ. Trả về file gửi được, hoặc null khi vẫn quá lớn.
   *
   * `compressImage` đưa ảnh camera (2–5MB) xuống còn vài trăm KB, nên nhánh báo lỗi
   * dưới đây gần như không bao giờ chạy tới — nó còn ở đây cho ca ảnh không giải mã
   * được, lúc đó hàm nén trả lại file gốc nguyên vẹn.
   */
  async function prepare(file: File, key: string): Promise<File | null> {
    setPending(key);
    setLastKey(key);
    setError(null);
    setDone(null);

    const ready = await compressImage(file);
    if (ready.size <= MAX_MB * 1024 * 1024) return ready;

    setPending(null);
    setError(`Ảnh vượt quá ${MAX_MB}MB và không nén nhỏ lại được. Hãy chọn ảnh khác.`);
    return null;
  }

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset ngay để chọn lại đúng file vừa chọn vẫn kích hoạt onChange — nếu không,
    // KTV chọn nhầm rồi chọn lại cùng tấm ảnh sẽ thấy giao diện không phản ứng gì.
    e.target.value = '';
    if (!file) return;

    const ready = await prepare(file, 'avatar');
    if (!ready) return;

    const form = new FormData();
    form.append('file', ready);

    // Không tự đặt Content-Type: trình duyệt phải tự sinh nó kèm boundary multipart.
    //
    // Cố ý **không** truyền `path`: từ 2026-09-10 avatar phải qua duyệt, nên lượt gửi này
    // không đổi một pixel nào trên trang công khai — ảnh cũ vẫn đang hiển thị. Xoá cache
    // ISR ở đây là trả giá (dựng lại một trang SEO) mà không đổi lại được gì. Cache sẽ
    // được xoá ở đúng chỗ nó cần: khi admin duyệt, qua `/api/admin-verify`.
    await call(
      'avatar',
      '/api/ktv-media?target=avatar',
      { method: 'PUT', body: form },
      'Đã gửi ảnh đại diện. Ảnh hiển thị sau khi quản trị viên duyệt.',
    );
  }

  async function removeAvatar() {
    // Gỡ thì **có** truyền `path`, khác đường gửi: ảnh đang hiển thị công khai biến mất
    // thật, nên bản dựng sẵn của trang hồ sơ phải bị bỏ đi ngay.
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
    if (!file) return;

    const ready = await prepare(file, 'photo');
    if (!ready) return;

    const form = new FormData();
    form.append('file', ready);

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
  const pendingAvatar = mediaUrl(profile.pendingAvatarUrl);
  const busy = pending !== null;

  /**
   * Thông báo hiện **cạnh nút vừa bấm**, không gom lên đỉnh khối.
   *
   * Đây là lỗi đã cắn thật: bản cũ render error/done một lần ở trên cùng, phía trên cả
   * ô "Ảnh đại diện". Nhưng nút "Thêm ảnh" nằm cuối khối thứ hai, cách đó vài màn hình
   * cuộn trên điện thoại — nên KTV bấm chọn ảnh, ảnh bị chặn vì vượt 3MB, và **màn hình
   * không đổi một pixel nào** ở chỗ họ đang nhìn. Đọc đúng như nút bị hỏng.
   *
   * `feedbackFor` nhận key của thao tác để mỗi khối chỉ hiện thông báo của chính nó:
   * gỡ một ảnh gallery không nên làm hiện chữ dưới ô avatar.
   */
  function feedbackFor(...keys: string[]) {
    // Thông báo thuộc về thao tác vừa chạy xong, mà lúc đó `pending` đã về null — nên
    // dùng `lastKey` chứ không phải `pending` để biết nên hiện ở đâu.
    if (!lastKey || !keys.includes(lastKey)) return null;

    return (
      <>
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-danger-bg px-4 py-3 text-sm text-danger-fg">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="mt-3 rounded-md bg-success-bg px-4 py-3 text-sm text-success-fg">
            {done}
          </p>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
        <h3 className="text-h4 text-ink-900">Ảnh đại diện</h3>
        <p className="mt-1 text-sm text-ink-600">
          Đây là ảnh khách nhìn thấy đầu tiên trong kết quả tìm kiếm. Ảnh chân dung rõ mặt, ánh
          sáng tốt. Ảnh phải được quản trị viên duyệt trước khi hiển thị —{' '}
          <strong className="font-semibold">ảnh đang hiển thị vẫn giữ nguyên trong lúc chờ</strong>,
          nên đổi ảnh không bao giờ làm hồ sơ mất ảnh.
        </p>

        {/* Hai ô ảnh khi có bản chờ duyệt: KTV phải thấy được mình đang hiển thị cái gì và
            đang chờ duyệt cái gì. Một ô duy nhất thì hoặc giấu mất bản chờ (không biết đã
            gửi thành công chưa), hoặc thay bằng bản chờ (tưởng nó đã lên sàn). */}
        {pendingAvatar && (
          <div className="mt-4 flex flex-wrap items-start gap-5 rounded-lg border border-warning-bd bg-warning-bg px-4 py-3">
            <div>
              <Image
                src={pendingAvatar}
                alt="Ảnh đại diện đang chờ duyệt"
                width={72}
                height={72}
                sizes="72px"
                className="h-18 w-18 shrink-0 rounded-xl border border-ink-200 object-cover"
                unoptimized={!isOptimizable(pendingAvatar)}
              />
            </div>
            <p className="min-w-0 flex-1 text-sm text-warning-fg">
              <strong className="font-semibold">Ảnh mới đang chờ duyệt.</strong>{' '}
              {profile.avatarUrl
                ? 'Ảnh cũ vẫn đang hiển thị trên hồ sơ công khai cho tới khi ảnh này được duyệt.'
                : 'Hồ sơ chưa có ảnh nào hiển thị công khai — ảnh này sẽ lên sau khi được duyệt.'}
            </p>
          </div>
        )}

        {/* Ảnh bị từ chối: nói lý do ngay đây, không để KTV tự đoán vì sao ảnh biến mất
            khỏi hàng chờ. Chỉ hiện khi không còn bản nào đang chờ — gửi lại rồi thì lời chê
            đó nói về tấm ảnh đã bị thay. */}
        {!pendingAvatar && profile.avatarVerifyStatus === 'REJECTED' && (
          <p className="mt-4 rounded-lg border border-danger-bd bg-danger-bg px-4 py-3 text-sm text-danger-fg">
            <strong className="font-semibold">Ảnh đại diện bạn gửi bị từ chối</strong>
            {profile.avatarRejectionReason ? `: ${profile.avatarRejectionReason}` : ''}. Chọn ảnh
            khác và gửi lại.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          {avatar ? (
            <Image
              src={avatar}
              alt="Ảnh đại diện đang hiển thị công khai"
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
              {pending === 'avatar'
                ? 'Đang gửi…'
                : pendingAvatar
                  ? 'Gửi ảnh khác'
                  : avatar
                    ? 'Đổi ảnh'
                    : 'Chọn ảnh'}
              <input
                type="file"
                accept={ACCEPT}
                className="sr-only"
                disabled={busy}
                onChange={uploadAvatar}
              />
            </label>

            {/* Cũng hiện khi chỉ có bản chờ duyệt: gửi nhầm ảnh thì phải rút lại được
                ngay, không phải đợi admin từ chối hộ. Gỡ xoá cả hai bản. */}
            {(avatar || pendingAvatar) && (
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

        {feedbackFor('avatar')}
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
          <strong className="font-semibold text-ink-700">sau khi được duyệt</strong>. Ảnh chụp
          bằng điện thoại được tự động nén, không cần lo dung lượng.
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

        {/* Khối gallery hiện thông báo của cả lượt thêm lẫn mọi lượt xoá: `photo-<id>`
            khớp theo tiền tố nên không cần liệt kê từng ảnh. */}
        {feedbackFor('photo', ...profile.photos.map((p) => `photo-${p.id}`))}
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
