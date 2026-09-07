import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VerifyPhotoForm } from '@/components/VerifyPhotoForm';
import { isOptimizable, mediaUrl } from '@/lib/media';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDateTime, ktvPath } from '@/lib/site';
import type { AdminKtvPhoto, AdminKtvPhotoList } from '@/lib/types';

export const metadata: Metadata = { title: 'Duyệt ảnh hồ sơ' };

const STATUSES = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'VERIFIED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
] as const;

type Status = (typeof STATUSES)[number]['value'];

/**
 * Hàng đợi duyệt ảnh hồ sơ.
 *
 * Tách khỏi trang duyệt hồ sơ chứ không nhét chung, vì hai hàng đợi lấp đầy theo hai
 * nhịp khác hẳn nhau: hồ sơ được duyệt một lần rồi thôi, còn ảnh thì một hồ sơ đã
 * duyệt vẫn thêm mới bất cứ lúc nào. Trộn chung sẽ khiến ảnh của hồ sơ đã duyệt
 * không xuất hiện ở đâu cả — và ảnh không ai xem trên trang công khai của ngành này
 * là rủi ro cho toàn bộ tên miền, không riêng một hồ sơ.
 */
export default async function VerifyPhotosPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  // Giá trị lạ rơi về PENDING thay vì để backend trả 400: tham số này đến từ thanh
  // địa chỉ, và một màn hình lỗi cho một chữ gõ sai trong URL là phản ứng quá tay.
  const status: Status =
    STATUSES.find((s) => s.value === searchParams.status)?.value ?? 'PENDING';

  let list: AdminKtvPhotoList;

  try {
    list = await authFetch<AdminKtvPhotoList>(`/admin/photos?status=${status}&limit=100`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/duyet-anh');
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Duyệt ảnh hồ sơ</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Ảnh chỉ hiển thị trên trang hồ sơ công khai sau khi được duyệt. Cũ nhất lên đầu. Từ chối
        ảnh không phù hợp — trang công khai là thứ công cụ tìm kiếm đọc, và một tấm ảnh sai chỗ
        ảnh hưởng tới thứ hạng của cả tên miền.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/duyet-anh?status=${s.value}`}
            aria-current={s.value === status ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-body font-semibold transition ${
              s.value === status
                ? 'bg-brand-500 text-white shadow-button'
                : 'border border-ink-200 bg-white text-ink-700 hover:border-brand-500 hover:text-brand-600'
            }`}
          >
            {s.label}
            {s.value === status && <span className="tabular ml-1.5 font-mono">{list.total}</span>}
          </Link>
        ))}
      </div>

      {list.items.length === 0 ? (
        <div className="mt-5 rounded-xl border border-ink-200 bg-white px-5 py-8 text-center">
          <p className="text-body-l text-ink-600">
            {status === 'PENDING'
              ? 'Không còn ảnh nào chờ duyệt.'
              : 'Chưa có ảnh nào ở trạng thái này.'}
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.items.map((p) => (
            <PhotoCard key={p.id} photo={p} />
          ))}
        </ul>
      )}

      {list.total > list.items.length && (
        <p className="mt-4 text-body text-ink-500">
          Đang hiện {list.items.length} trên {list.total} ảnh.
        </p>
      )}
    </>
  );
}

function PhotoCard({ photo }: { photo: AdminKtvPhoto }) {
  const src = mediaUrl(photo.url);

  return (
    <li className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      {src && (
        <a href={src} target="_blank" rel="noreferrer" className="block">
          <Image
            src={src}
            alt={photo.caption ?? `Ảnh hồ sơ của ${photo.ktvName}`}
            width={600}
            height={450}
            sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
            // Khung cố định 4:3, cắt phần thừa. Ảnh gốc mở được bằng cách bấm vào —
            // duyệt bằng bản đã cắt là bỏ sót đúng phần rìa mà người ta hay giấu thứ
            // không nên có.
            className="aspect-[4/3] w-full bg-ink-50 object-cover"
            unoptimized={!isOptimizable(src)}
          />
        </a>
      )}

      <div className="px-4 py-3">
        <Link
          href={ktvPath('vi', photo.ktvSlug, photo.ktvId)}
          target="_blank"
          className="font-display text-body-l font-bold text-ink-900 underline-offset-2 hover:underline"
        >
          {photo.ktvName}
        </Link>

        <div className="mt-0.5 text-body text-ink-500">Tải lên {formatDateTime(photo.createdAt, 'vi')}</div>

        {photo.caption && <p className="mt-1.5 text-body text-ink-700">{photo.caption}</p>}

        {photo.rejectionReason && (
          <div className="mt-2 rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg">
            Lý do từ chối: {photo.rejectionReason}
          </div>
        )}

        {/* Ảnh đã xử lý vẫn cho đổi quyết định: một tấm bị từ chối nhầm mà không có
            đường sửa sẽ buộc KTV tải lên lại, và lượt tải lại đó tính vào hạn mức. */}
        <VerifyPhotoForm photoId={photo.id} />
      </div>
    </li>
  );
}
