import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VerifyAvatarForm } from '@/components/VerifyAvatarForm';
import { isOptimizable, mediaUrl } from '@/lib/media';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDateTime, ktvPath } from '@/lib/site';
import type { AdminKtvAvatar, AdminKtvAvatarList } from '@/lib/types';

export const metadata: Metadata = { title: 'Duyệt ảnh đại diện' };

const STATUSES = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'VERIFIED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
] as const;

type Status = (typeof STATUSES)[number]['value'];

/**
 * Hàng đợi duyệt ảnh đại diện.
 *
 * Hàng đợi **riêng**, tách khỏi `/admin/duyet-anh` (ảnh gallery): avatar là tấm ảnh lớn
 * nhất trên trang hồ sơ và là thứ duy nhất hiện trên mọi thẻ tìm kiếm, nên trộn nó vào
 * danh sách ảnh phòng ốc sẽ khiến đúng tấm đáng xem kỹ nhất trôi lẫn giữa hàng chục tấm
 * khác. Nó cũng nằm ở cột trên `ktv_profiles` chứ không phải hàng trong `ktv_photos`.
 *
 * Trước 2026-09-10 avatar không qua duyệt. Lỗ hổng: hồ sơ **đã VERIFIED** đổi avatar bất
 * cứ lúc nào mà không lượt nào lọt vào mắt ai — đúng cái lỗ mà việc duyệt ảnh gallery đã
 * bịt từ đầu, chỉ khác là nó nằm ở tấm ảnh dễ thấy nhất.
 */
export default async function VerifyAvatarsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  // Giá trị lạ rơi về PENDING thay vì để backend trả 400: tham số này đến từ thanh địa
  // chỉ, và một màn hình lỗi cho một chữ gõ sai trong URL là phản ứng quá tay.
  const status: Status =
    STATUSES.find((s) => s.value === searchParams.status)?.value ?? 'PENDING';

  let list: AdminKtvAvatarList;

  try {
    list = await authFetch<AdminKtvAvatarList>(`/admin/avatars?status=${status}&limit=100`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect('/dang-nhap?next=/admin/duyet-anh-dai-dien');
    }
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Duyệt ảnh đại diện</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Ảnh đại diện là tấm ảnh khách nhìn thấy đầu tiên trên mọi thẻ tìm kiếm. Ảnh mới chỉ thay
        ảnh cũ sau khi được duyệt — trong lúc chờ, hồ sơ vẫn hiển thị ảnh đang có, nên từ chối
        một tấm không phù hợp không làm hồ sơ mất ảnh.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/duyet-anh-dai-dien?status=${s.value}`}
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
              ? 'Không còn ảnh đại diện nào chờ duyệt.'
              : 'Chưa có ảnh đại diện nào ở trạng thái này.'}
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.items.map((a) => (
            <AvatarCard key={a.ktvId} avatar={a} showActions={status === 'PENDING'} />
          ))}
        </ul>
      )}

      {list.total > list.items.length && (
        <p className="mt-4 text-body text-ink-500">
          Đang hiện {list.items.length} trên {list.total} hồ sơ.
        </p>
      )}
    </>
  );
}

function AvatarCard({ avatar, showActions }: { avatar: AdminKtvAvatar; showActions: boolean }) {
  const pending = mediaUrl(avatar.pendingUrl);
  const current = mediaUrl(avatar.currentUrl);

  return (
    <li className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      {/* Hai ô cạnh nhau: quyết định ở đây là "có nên thay tấm bên phải bằng tấm bên
          trái không", nên nhìn riêng tấm mới là thiếu đúng vế so sánh. */}
      <div className="grid grid-cols-2 gap-px bg-ink-100">
        <AvatarPane src={pending} label="Ảnh mới" name={avatar.ktvName} highlight />
        <AvatarPane src={current} label="Đang hiển thị" name={avatar.ktvName} />
      </div>

      <div className="px-4 py-3">
        <Link
          href={ktvPath('vi', avatar.ktvSlug, avatar.ktvId)}
          target="_blank"
          className="font-display text-body-l font-bold text-ink-900 underline-offset-2 hover:underline"
        >
          {avatar.ktvName}
        </Link>

        <div className="mt-0.5 text-body text-ink-500">
          {avatar.avatarSubmittedAt
            ? `Gửi ${formatDateTime(avatar.avatarSubmittedAt, 'vi')}`
            : 'Chưa rõ thời điểm gửi'}
          {/* Trạng thái hồ sơ đi kèm vì nó đổi ý nghĩa của quyết định: với hồ sơ chưa
              duyệt, avatar sẽ được duyệt kèm lúc duyệt hồ sơ, nên tấm ở đây thường là
              lượt đổi ảnh của một hồ sơ đã hoạt động. */}
          {avatar.profileStatus !== 'VERIFIED' && (
            <span className="ml-1.5 rounded-full bg-ink-100 px-2 py-0.5 text-caption font-semibold text-ink-600">
              hồ sơ chưa duyệt
            </span>
          )}
        </div>

        {avatar.avatarRejectionReason && (
          <div className="mt-2 rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg">
            Lý do từ chối: {avatar.avatarRejectionReason}
          </div>
        )}

        {/* Chỉ tab "chờ duyệt" có nút: hai tab kia là lịch sử, và ảnh đang chờ đã được
            nhả sau quyết định nên không còn gì để duyệt lại. Khác ảnh gallery, nơi mỗi
            hàng là một ảnh vẫn còn tồn tại và đổi quyết định được. */}
        {showActions && <VerifyAvatarForm ktvId={avatar.ktvId} ktvSlug={avatar.ktvSlug} />}
      </div>
    </li>
  );
}

function AvatarPane({
  src,
  label,
  name,
  highlight = false,
}: {
  src: string | null;
  label: string;
  name: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white">
      <div className={`px-2 py-1 text-caption font-semibold ${highlight ? 'bg-warning-bg text-warning-fg' : 'bg-ink-50 text-ink-600'}`}>
        {label}
      </div>
      {src ? (
        <a href={src} target="_blank" rel="noreferrer" className="block">
          <Image
            src={src}
            alt={`${label} của ${name}`}
            width={400}
            height={400}
            sizes="(min-width: 1280px) 17vw, (min-width: 640px) 25vw, 50vw"
            // Ảnh gốc mở được bằng cách bấm vào — duyệt bằng bản đã cắt là bỏ sót đúng
            // phần rìa mà người ta hay giấu thứ không nên có.
            className="aspect-square w-full bg-ink-50 object-cover"
            unoptimized={!isOptimizable(src)}
          />
        </a>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-ink-50 text-body-s text-ink-500">
          Không có
        </div>
      )}
    </div>
  );
}
