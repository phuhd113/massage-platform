import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KtvSearchFilters } from '@/components/KtvSearchFilters';
import { VerifyProfileForm } from '@/components/VerifyProfileForm';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { formatDate, formatVnd, ktvPath } from '@/lib/site';
import type { AdminKtvRow, AdminKtvRowList } from '@/lib/types';

export const metadata: Metadata = { title: 'Quản lý KTV' };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Chờ duyệt', className: 'bg-ink-100 text-ink-700' },
  VERIFIED: { label: 'Đã duyệt', className: 'bg-brand-100 text-brand-600' },
  REJECTED: { label: 'Đã từ chối', className: 'bg-danger-bg text-danger-fg' },
};

const GENDER_LABELS: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ' };

/** Danh sách trắng: các giá trị này đi thẳng vào query string gửi sang backend. */
const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'];
const GENDERS = ['MALE', 'FEMALE'];

/**
 * Trang tra cứu và quản lý KTV.
 *
 * **Khác `/admin/duyet-ktv`, và cố ý tách làm hai.** Trang duyệt là một *hàng đợi*: một
 * trạng thái mỗi lần, cũ nhất lên đầu, kèm CCCD và chứng chỉ để đối chiếu — nó trả lời
 * "còn hồ sơ nào phải xem". Trang này trả lời câu ngược lại: "người tên X, hoặc số
 * 09xx, là ai và đang thế nào" — câu hỏi phát sinh khi KTV gọi điện tới, và nó luôn bắt
 * đầu bằng một cái tên chứ không bằng một trạng thái duyệt. Gộp hai thứ vào một màn
 * hình sẽ phải chọn một thứ tự mặc định, và thứ tự nào cũng làm hỏng nửa còn lại.
 *
 * Vì vậy trang này trả **mọi trạng thái** — hồ sơ đã bị từ chối chính là hồ sơ hay bị
 * hỏi tới nhất, mà nó không nằm trong bất kỳ hàng đợi nào.
 */
export default async function AdminKtvPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; gender?: string; page?: string };
}) {
  // Lọc sạch tham số ở server trước khi gọi API, đúng như `/tim-kiem` làm: query string
  // do người dùng sửa được, và để một chữ gõ sai trong URL làm cả trang trả lỗi là đánh
  // đổi tệ. Backend vẫn trả 400 cho giá trị lạ — đây là lớp thứ hai, không phải lớp duy nhất.
  const status = searchParams.status && STATUSES.includes(searchParams.status)
    ? searchParams.status
    : undefined;
  const gender = searchParams.gender && GENDERS.includes(searchParams.gender)
    ? searchParams.gender
    : undefined;
  const q = searchParams.q?.trim() || undefined;

  const pageNum = Number(searchParams.page);
  const page = Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;

  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (status) params.set('status', status);
  if (gender) params.set('gender', gender);
  if (q) params.set('q', q);

  let list: AdminKtvRowList;

  try {
    list = await authFetch<AdminKtvRowList>(`/admin/ktv/search?${params}`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/ktv');
    throw err;
  }

  const totalPages = Math.max(1, Math.ceil(list.total / list.limit));

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Quản lý KTV</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Tra cứu mọi hồ sơ ở mọi trạng thái. Tìm được bằng tên có dấu, tên không dấu hoặc số điện
        thoại. Hàng đợi duyệt nằm riêng ở{' '}
        <Link
          href="/admin/duyet-ktv"
          className="font-semibold text-brand-600 underline underline-offset-2"
        >
          Duyệt hồ sơ KTV
        </Link>
        .
      </p>

      <KtvSearchFilters />

      <p className="mt-4 text-body text-ink-500">
        {list.total === 0
          ? 'Không tìm thấy hồ sơ nào.'
          : `${list.total} hồ sơ${totalPages > 1 ? ` · trang ${page}/${totalPages}` : ''}`}
      </p>

      {list.items.length > 0 && (
        <ul className="mt-3 grid gap-4">
          {list.items.map((k) => (
            <KtvCard key={k.id} ktv={k} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} params={params} />
      )}
    </>
  );
}

function KtvCard({ ktv }: { ktv: AdminKtvRow }) {
  const status = STATUS_LABELS[ktv.verificationStatus] ?? {
    label: ktv.verificationStatus,
    className: 'bg-ink-100 text-ink-700',
  };

  return (
    <li className="rounded-xl border border-ink-200 bg-white px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={ktvPath('vi', ktv.slug, ktv.id)}
            target="_blank"
            className="font-display text-body-l font-bold text-ink-900 underline-offset-2 hover:underline"
          >
            {ktv.fullName}
          </Link>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-s">
            <span className={`rounded-md px-2 py-0.5 font-semibold ${status.className}`}>
              {status.label}
            </span>
            {/*
              Số điện thoại là lý do chính trang này tồn tại: admin nghe máy rồi tra.
              `tel:` để bấm gọi lại được ngay từ máy tính có phần mềm gọi.
            */}
            <a
              href={`tel:${ktv.phone}`}
              className="tabular font-mono font-semibold text-brand-600 underline underline-offset-2"
            >
              {ktv.phone}
            </a>
            {ktv.gender && <span className="text-ink-500">{GENDER_LABELS[ktv.gender]}</span>}
            <span className="text-ink-500">{ktv.yearsExperience} năm KN</span>
            <span className="text-ink-500">Tạo {formatDate(ktv.createdAt, 'vi')}</span>
          </div>

          {ktv.baseAddress && (
            <div className="mt-1 truncate text-body-s text-ink-500">{ktv.baseAddress}</div>
          )}
        </div>

        {/* Cảnh báo điều kiện duyệt còn thiếu. Chỉ hiện với hồ sơ **chưa** duyệt: ở hồ
            sơ đã VERIFIED thì hai điều kiện này đã được kiểm lúc duyệt, nhắc lại chỉ
            thành nhiễu. Backend vẫn là nơi ép buộc, đây chỉ là nói trước. */}
        {ktv.verificationStatus !== 'VERIFIED' && (
          <div className="flex flex-wrap gap-1.5">
            {ktv.identityStatus !== 'VERIFIED' && (
              <span className="rounded-md bg-danger-bg px-2 py-0.5 text-body-s font-semibold text-danger-fg">
                {ktv.hasIdentityDoc ? 'CCCD chưa duyệt' : 'Chưa gửi CCCD'}
              </span>
            )}
            {!ktv.commitmentsUpToDate && (
              <span className="rounded-md bg-danger-bg px-2 py-0.5 text-body-s font-semibold text-danger-fg">
                Chưa ký cam kết
              </span>
            )}
          </div>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-ink-100 pt-3 sm:grid-cols-5">
        <Stat
          label="Đánh giá"
          value={
            ktv.ratingCount > 0
              ? `${ktv.ratingAvg.toFixed(1)}★ (${ktv.ratingCount})`
              : 'chưa có'
          }
        />
        <Stat label="Lượt liên hệ" value={String(ktv.leadCount)} />
        <Stat label="Đánh giá hiển thị" value={String(ktv.reviewCount)} />
        <Stat
          label="Gói đang chạy"
          value={String(ktv.activeCampaigns)}
          highlight={ktv.activeCampaigns > 0}
        />
        {/*
          null là "chưa từng có ví", 0 đồng là "đã nạp và tiêu hết" — hai câu trả lời
          khác nhau cho câu hỏi "người này đã bao giờ trả tiền chưa", nên không dùng
          `?? 0` ở đây.
        */}
        <Stat
          label="Số dư ví"
          value={ktv.walletBalance === null ? 'chưa có ví' : formatVnd(ktv.walletBalance, 'vi')}
        />
      </dl>

      {ktv.rejectionReason && (
        <div className="mt-2 rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg">
          Lý do từ chối: {ktv.rejectionReason}
        </div>
      )}

      {/* Dùng lại đúng component của trang duyệt, không viết bản thứ hai: nó đã đi qua
          `/api/admin-verify` để xoá cache trang công khai — chuyển sang VERIFIED là lần
          đầu trang đó tồn tại, và gỡ xuống thì nó phải biến mất. */}
      <VerifyProfileForm
        ktvId={ktv.id}
        ktvSlug={ktv.slug}
        currentStatus={ktv.verificationStatus}
      />
    </li>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  // Chữ và số dùng hai kiểu chữ khác nhau. Ô số liệu ở đây có ca rỗng là **chữ**
  // ("chưa có ví", "chưa có"), mà font mono cho chữ đọc ra như một dòng code lọt vào
  // giữa bảng số. Mono chỉ đúng cho con số: nó giữ các chữ số thẳng cột giữa các thẻ.
  const laSo = /\d/.test(value);

  return (
    <div>
      <dt className="text-caption text-ink-500">{label}</dt>
      <dd
        className={`text-body font-semibold ${laSo ? 'tabular font-mono' : 'text-ink-500'} ${
          highlight ? 'text-brand-600' : laSo ? 'text-ink-900' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Phân trang kiểu prev/next.
 *
 * Không dựng dãy số trang: danh sách này gần như luôn được thu hẹp bằng ô tìm chứ không
 * bằng cách lật tới trang 47, nên một dãy số dài là công dựng thêm cho thao tác gần như
 * không ai làm.
 */
function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: URLSearchParams;
}) {
  const href = (p: number) => {
    const sp = new URLSearchParams(params);
    sp.set('page', String(p));
    sp.delete('limit');
    return `/admin/ktv?${sp}`;
  };

  return (
    <div className="mt-5 flex items-center gap-2">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="rounded-full border border-ink-200 bg-white px-4 py-2 text-body font-semibold text-ink-700 transition hover:border-brand-500 hover:text-brand-600"
        >
          Trang trước
        </Link>
      ) : null}

      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="rounded-full border border-ink-200 bg-white px-4 py-2 text-body font-semibold text-ink-700 transition hover:border-brand-500 hover:text-brand-600"
        >
          Trang sau
        </Link>
      ) : null}
    </div>
  );
}
