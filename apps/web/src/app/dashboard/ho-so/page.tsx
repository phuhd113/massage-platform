import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CertificationsSection } from '@/components/CertificationsSection';
import { CommitmentsSection } from '@/components/CommitmentsSection';
import { IdentityDocumentSection } from '@/components/IdentityDocumentSection';
import { ProfileForm } from '@/components/ProfileForm';
import { ProfileMediaSection } from '@/components/ProfileMediaSection';
import { ServicePricingForm } from '@/components/ServicePricingForm';
import { api } from '@/lib/api';
import { UnauthenticatedError, authFetch, authFetchOrNull } from '@/lib/session';
import type { KtvServiceItem, MyKtvProfile, ServiceItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Hồ sơ' };

export default async function ProfilePage() {
  let profile: MyKtvProfile | null;

  try {
    profile = await authFetchOrNull<MyKtvProfile>('/ktv/profile/me');
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  const [areas, catalog, commitments] = await Promise.all([
    api.areaTree(),
    api.services(),
    api.ktvCommitments(),
  ]);

  // Tên của riêng những khu vực KTV đang chọn. Cây khu vực ở lại server: nó có 759
  // dòng và trước đây đi nguyên vào payload RSC chỉ để tra tên cho vài cái chip.
  const coverageLabels = (() => {
    const ids = new Set(profile?.coverageAreas?.map((a) => a.id) ?? []);
    if (ids.size === 0) return [];

    return areas.flatMap((p) =>
      p.children
        .filter((d) => ids.has(d.id))
        .map((d) => ({ id: d.id, name: d.name, parentPath: p.name })),
    );
  })();

  // Bảng giá chỉ tồn tại khi đã có hồ sơ — backend trả 404 nếu chưa.
  const myServices = profile
    ? ((await authFetchOrNull<KtvServiceItem[]>('/ktv/profile/services')) ?? [])
    : [];

  return (
    /* `pb-24` cho thanh hành động dính đáy của `ProfileForm` — thiếu là nó che mất
       khối cuối trang. Xem quy ước ở project-status. */
    <div className="pb-24">
      <h1 className="text-h1 text-ink-900">Hồ sơ kỹ thuật viên</h1>

      {profile ? (
        <StatusBanner profile={profile} />
      ) : (
        /* Nói rõ vì sao các mục khác đang khoá: KTV bị đưa về đây từ một trang khác
           mà không được giải thích sẽ tưởng mình bấm nhầm, rồi bấm lại đúng mục đó.
           Ba bước liệt kê ra vì đây là màn hình đầu tiên của một quy trình dài hơn
           chính cái form: hồ sơ xong vẫn chưa hiện, còn CCCD và cam kết nữa — và cả
           hai khối đó nằm ngoài màn hình đầu tiên, chỉ xuất hiện sau khi tạo xong. */
        <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
          <p className="text-body text-brand-700">
            Tạo hồ sơ để bắt đầu — ví, gói đẩy tin và chiến dịch chỉ mở sau bước này.
          </p>
          <ol className="mt-3 grid gap-2 text-body-s text-brand-700 sm:grid-cols-3">
            {[
              'Khai hồ sơ ở form bên dưới',
              'Gửi ảnh CCCD và ký cam kết',
              'Quản trị viên duyệt, hồ sơ lên tìm kiếm',
            ].map((label, i) => (
              <li key={label} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-caption font-semibold text-white"
                >
                  {i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>
        </div>
      )}

      <section className="mt-8">
        <ProfileForm profile={profile} coverageLabels={coverageLabels} />
      </section>

      {profile && (
        <>
          {/* Ảnh đứng trước chứng chỉ: nó là thứ khách thấy đầu tiên trong kết quả
              tìm kiếm, nên cũng là việc đáng làm trước sau khi khai xong hồ sơ. */}
          <section className="mt-12">
            <h2 className="text-h2 text-ink-900">Ảnh hồ sơ</h2>
            <p className="mt-1 text-sm text-ink-600">
              Hồ sơ có ảnh được khách bấm vào nhiều hơn hẳn hồ sơ chỉ có chữ cái đầu tên.
            </p>
            <div className="mt-4">
              <ProfileMediaSection profile={profile} />
            </div>
          </section>

          {/* CCCD và cam kết đứng trước chứng chỉ: đây là hai điều kiện **bắt buộc**
              để hồ sơ được duyệt, còn chứng chỉ hành nghề thì không. Xếp sau sẽ khiến
              KTV làm xong phần tuỳ chọn trước rồi vẫn không hiểu vì sao chưa duyệt. */}
          <section className="mt-12">
            <h2 className="text-h2 text-ink-900">Xác minh danh tính (CCCD)</h2>
            <p className="mt-1 text-sm text-ink-600">
              Bắt buộc. Khách mời kỹ thuật viên tới tận nhà, nên hồ sơ chỉ được duyệt khi danh tính
              đã được đối chiếu. Ảnh chỉ quản trị viên xem được, không bao giờ hiển thị công khai.
            </p>
            <div className="mt-4">
              <IdentityDocumentSection doc={profile.identityDocument} />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-h2 text-ink-900">Cam kết của kỹ thuật viên</h2>
            <p className="mt-1 text-sm text-ink-600">
              Bắt buộc. Đây là những nghĩa vụ bạn nhận khi hoạt động trên nền tảng.
            </p>
            <div className="mt-4">
              <CommitmentsSection
                items={commitments.items}
                version={commitments.version}
                accepted={profile.commitmentsUpToDate}
                committedAt={profile.committedAt}
              />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-h2 text-ink-900">Chứng chỉ hành nghề</h2>
            <p className="mt-1 text-sm text-ink-600">
              Chỉ chứng chỉ đã được duyệt mới hiển thị trên trang hồ sơ công khai. Đây cũng là hàng
              rào chất lượng của nền tảng, nên khâu duyệt không bỏ qua được.
            </p>
            <div className="mt-4">
              <CertificationsSection certifications={profile.certifications} />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-h2 text-ink-900">Dịch vụ và bảng giá</h2>
            <p className="mt-1 text-sm text-ink-600">
              Giá hiển thị công khai là giá khởi điểm. Khách lọc theo dịch vụ, nên hồ sơ không khai
              dịch vụ nào sẽ không xuất hiện khi khách lọc.
            </p>
            <div className="mt-4">
              <ServicePricingForm catalog={catalog} mine={myServices} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatusBanner({ profile }: { profile: MyKtvProfile }) {
  if (profile.verificationStatus === 'VERIFIED') {
    return (
      <p className="mt-4 rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700">
        Hồ sơ đã được duyệt và đang hiển thị công khai tại{' '}
        <code className="text-xs">/ktv/{profile.slug}-{profile.id}</code>.
        {' '}Lưu ý: sửa hồ sơ sẽ đưa nó về trạng thái chờ duyệt lại.
      </p>
    );
  }

  // Hai điều kiện backend bắt buộc trước khi duyệt được. Nói ra ở đây vì nếu không,
  // hồ sơ nằm "chờ duyệt" vô thời hạn mà KTV không biết còn thiếu gì — và phần thiếu
  // nằm ở hai khối phía dưới, ngoài màn hình đầu tiên.
  const missing = [
    profile.identityDocument?.verifyStatus === 'VERIFIED' ? null : 'ảnh CCCD đã xác minh',
    profile.commitmentsUpToDate ? null : 'bản cam kết kỹ thuật viên',
  ].filter(Boolean);

  return (
    <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-warning-fg">
      {profile.verificationStatus === 'PENDING' ? (
        <>
          Hồ sơ đang chờ duyệt. Trong lúc chờ, hồ sơ chưa hiện trong tìm kiếm.
          {missing.length > 0 && <> Còn thiếu: {missing.join(' và ')}.</>}
        </>
      ) : (
        <>
          Hồ sơ bị từ chối
          {profile.rejectionReason ? `: ${profile.rejectionReason}` : ''}. Sửa lại rồi lưu để gửi
          duyệt lần nữa.
        </>
      )}
    </p>
  );
}
