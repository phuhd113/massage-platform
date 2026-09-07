import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { VerifyIdentityForm } from '@/components/VerifyIdentityForm';
import { VerifyProfileForm } from '@/components/VerifyProfileForm';
import { UnauthenticatedError, authFetch } from '@/lib/session';
import { mediaUrl } from '@/lib/media';
import { formatDateTime, ktvPath } from '@/lib/site';
import type { AdminKtvList, AdminKtvProfile } from '@/lib/types';

export const metadata: Metadata = { title: 'Duyệt hồ sơ KTV' };

const STATUSES = [
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'VERIFIED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
] as const;

type Status = (typeof STATUSES)[number]['value'];

export default async function VerifyKtvPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  // Giá trị lạ rơi về PENDING thay vì để backend trả 400: tham số này đến từ thanh
  // địa chỉ, và một màn hình lỗi cho một chữ gõ sai trong URL là phản ứng quá tay.
  const status: Status =
    STATUSES.find((s) => s.value === searchParams.status)?.value ?? 'PENDING';

  let list: AdminKtvList;

  try {
    list = await authFetch<AdminKtvList>(`/admin/ktv?status=${status}&limit=100`);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/admin/duyet-ktv');
    throw err;
  }

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Duyệt hồ sơ KTV</h1>
      <p className="mt-2 max-w-prose text-body-l text-ink-600">
        Hồ sơ chỉ xuất hiện trong tìm kiếm sau khi được duyệt. Cũ nhất lên đầu — người đăng ký
        trước là người đã chờ lâu nhất.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/admin/duyet-ktv?status=${s.value}`}
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
              ? 'Không còn hồ sơ nào chờ duyệt.'
              : 'Chưa có hồ sơ nào ở trạng thái này.'}
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3">
          {list.items.map((p) => (
            <ProfileRow key={p.id} profile={p} />
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

function ProfileRow({ profile: p }: { profile: AdminKtvProfile }) {
  return (
    <li className="rounded-xl border border-ink-200 bg-white px-[18px] py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-display text-body-l font-bold text-ink-900">{p.fullName}</span>
            <StatusPill status={p.verificationStatus} />
          </div>

          <div className="mt-1.5 text-body-l text-ink-600">
            Đăng ký {formatDateTime(p.createdAt, 'vi')} · bán kính {p.serviceRadiusKm}km
          </div>

          {/* Chỉ hiện khi có: đa số hồ sơ tự đến qua SEO, và một dòng "không có người
              giới thiệu" lặp trên mọi hàng chỉ làm loãng danh sách. */}
          {p.referredBy && (
            <div className="mt-1.5 text-body text-ink-600">
              Giới thiệu bởi{' '}
              <span className="font-semibold text-ink-800">{p.referredBy.name}</span>{' '}
              <span className="font-mono text-body-s text-ink-500">({p.referredBy.code})</span>
            </div>
          )}


          {/* Địa chỉ nhà **không** nằm trên hồ sơ công khai, nhưng admin cần nó để
              đối chiếu với chứng chỉ — đây chính là thông tin đang được duyệt. */}
          {p.baseAddress && (
            <div className="mt-1.5 text-body text-ink-500">Địa chỉ: {p.baseAddress}</div>
          )}

          {p.rejectionReason && (
            <div className="mt-2 rounded-md bg-danger-bg px-3 py-2 text-body text-danger-fg">
              Lý do từ chối: {p.rejectionReason}
            </div>
          )}

          {/* CCCD đứng trước chứng chỉ: đây là điều kiện **bắt buộc** để duyệt được
              hồ sơ, còn chứng chỉ hành nghề thì không. Backend chặn lượt duyệt khi
              thiếu, nên hiện nó ở đây để admin biết trước thay vì nhận lỗi sau khi bấm. */}
          <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-semibold text-ink-800">CCCD</span>
              {p.identityDocument ? (
                <StatusPill status={p.identityDocument.verifyStatus} small />
              ) : (
                <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-caption font-semibold text-danger-fg">
                  Chưa gửi
                </span>
              )}
            </div>

            {p.identityDocument ? (
              <>
                <div className="mt-1.5 flex flex-wrap gap-4 text-body">
                  {/* noreferrer bắt buộc: đây là URL ký mở được ảnh giấy tờ tuỳ thân,
                      và Referer sẽ trao nó cho bên thứ ba. */}
                  <a
                    href={mediaUrl(p.identityDocument.frontUrl) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand-600 underline underline-offset-2"
                  >
                    Mặt trước
                  </a>
                  <a
                    href={mediaUrl(p.identityDocument.backUrl) ?? '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand-600 underline underline-offset-2"
                  >
                    Mặt sau
                  </a>
                  <span className="text-ink-500">
                    Gửi {formatDateTime(p.identityDocument.submittedAt, 'vi')}
                  </span>
                </div>

                <VerifyIdentityForm
                  ktvId={p.id}
                  currentStatus={p.identityDocument.verifyStatus}
                />
              </>
            ) : (
              <p className="mt-1.5 text-body text-ink-600">
                Hồ sơ chưa duyệt được cho tới khi KTV gửi ảnh CCCD.
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-200 pt-2.5">
              <span className="text-body font-semibold text-ink-800">Cam kết KTV</span>
              {p.commitmentsUpToDate ? (
                <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-caption font-semibold text-success-fg">
                  Đã cam kết
                </span>
              ) : (
                <span className="rounded-full bg-danger-bg px-2.5 py-0.5 text-caption font-semibold text-danger-fg">
                  Chưa cam kết
                </span>
              )}
              {p.committedAt && p.commitmentsUpToDate && (
                <span className="text-body text-ink-500">{formatDateTime(p.committedAt, 'vi')}</span>
              )}
            </div>
          </div>

          <div className="mt-3">
            {p.certifications.length === 0 ? (
              <p className="text-body text-ink-500">Chưa tải lên chứng chỉ nào.</p>
            ) : (
              <ul className="grid gap-1.5">
                {p.certifications.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 text-body">
                    <a
                      href={mediaUrl(c.fileUrl) ?? '#'}
                      target="_blank"
                      // noreferrer là bắt buộc chứ không phải thói quen: URL chứng
                      // chỉ là URL ký, và gửi nó đi trong header Referer là trao
                      // quyền mở giấy tờ tuỳ thân cho bên thứ ba.
                      rel="noreferrer"
                      className="font-semibold text-brand-600 underline underline-offset-2"
                    >
                      {c.name}
                    </a>
                    <StatusPill status={c.verifyStatus} small />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Hồ sơ chưa duyệt chưa có trang công khai, nên chỉ hiện link khi mở được
              — một link 404 ở màn duyệt đọc như hệ thống hỏng. */}
          {p.verificationStatus === 'VERIFIED' && (
            <Link
              href={ktvPath('vi', p.slug, p.id)}
              target="_blank"
              className="mt-3 inline-block text-body text-ink-600 underline underline-offset-2 hover:text-brand-600"
            >
              Xem hồ sơ công khai
            </Link>
          )}
        </div>

        <VerifyProfileForm ktvId={p.id} ktvSlug={p.slug} currentStatus={p.verificationStatus} />
      </div>
    </li>
  );
}

function StatusPill({ status, small }: { status: string; small?: boolean }) {
  const tone =
    status === 'VERIFIED'
      ? 'bg-success-bg text-success-fg'
      : status === 'REJECTED'
        ? 'bg-danger-bg text-danger-fg'
        : 'bg-ink-100 text-ink-600';

  const label =
    status === 'VERIFIED' ? 'Đã duyệt' : status === 'REJECTED' ? 'Đã từ chối' : 'Chờ duyệt';

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 font-semibold ${tone} ${
        small ? 'text-caption' : 'text-body-s'
      }`}
    >
      {label}
    </span>
  );
}
