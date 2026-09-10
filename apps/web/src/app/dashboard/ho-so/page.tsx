import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CertificationsSection } from '@/components/CertificationsSection';
import { CommitmentsSection } from '@/components/CommitmentsSection';
import { IdentityDocumentSection } from '@/components/IdentityDocumentSection';
import { ProfileChecklist } from '@/components/ProfileChecklist';
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

      {/* Checklist thay cho hai khối cũ vốn cùng trả lời "tôi còn thiếu gì?" nhưng ở
          hai nhánh loại trừ nhau: một danh sách 3 bước tĩnh khi chưa có hồ sơ, và một
          StatusBanner liệt kê phần thiếu khi đã có. Xem `ProfileChecklist` để biết vì
          sao nhóm bắt buộc phải khớp đúng `AdminService.DecideProfileAsync`. */}
      <ProfileChecklist profile={profile} serviceCount={myServices.length} />

      <section className="mt-8">
        <ProfileForm profile={profile} coverageLabels={coverageLabels} />
      </section>

      {profile && (
        <>
          {/* Ảnh đứng trước chứng chỉ: nó là thứ khách thấy đầu tiên trong kết quả
              tìm kiếm, nên cũng là việc đáng làm trước sau khi khai xong hồ sơ. */}
          {/* `id` là đích của link trong ProfileChecklist. `scroll-mt` để tiêu đề không
              dính sát mép trên sau khi nhảy tới. */}
          <section id="anh" className="mt-12 scroll-mt-6">
            <h2 className="text-h2 text-ink-900">Ảnh hồ sơ</h2>
            <p className="mt-1 text-sm text-ink-600">
              Hồ sơ có ảnh được khách bấm vào nhiều hơn hẳn hồ sơ chỉ có chữ cái đầu tên.
            </p>
            <div className="mt-4">
              <ProfileMediaSection profile={profile} />
            </div>
          </section>

          {/* CCCD và cam kết đứng trước chứng chỉ: đây là hai điều kiện **bắt buộc**
              để hồ sơ được duyệt (xem `AdminService.DecideProfileAsync`), còn chứng chỉ
              hành nghề thì không — nó tuỳ chọn ở giai đoạn hiện tại. Xếp sau sẽ khiến
              KTV làm xong phần tuỳ chọn trước rồi vẫn không hiểu vì sao chưa duyệt. */}
          <section id="cccd" className="mt-12 scroll-mt-6">
            <h2 className="text-h2 text-ink-900">Xác minh danh tính (CCCD)</h2>
            <p className="mt-1 text-sm text-ink-600">
              Bắt buộc. Khách mời kỹ thuật viên tới tận nhà, nên hồ sơ chỉ được duyệt khi danh tính
              đã được đối chiếu. Ảnh chỉ quản trị viên xem được, không bao giờ hiển thị công khai.
            </p>
            <div className="mt-4">
              <IdentityDocumentSection doc={profile.identityDocument} />
            </div>
          </section>

          <section id="cam-ket" className="mt-12 scroll-mt-6">
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

          <section id="chung-chi" className="mt-12 scroll-mt-6">
            <h2 className="text-h2 text-ink-900">Chứng chỉ hành nghề</h2>
            <p className="mt-1 text-sm text-ink-600">
              Không bắt buộc — hồ sơ vẫn được duyệt và hiển thị khi chưa có chứng chỉ nào. Nhưng
              chứng chỉ đã duyệt hiện thành huy hiệu ngay trên thẻ tìm kiếm và trang hồ sơ công
              khai, nên đây là thứ giúp bạn nổi bật khi khách so sánh nhiều hồ sơ cùng lúc. Chỉ
              chứng chỉ đã được duyệt mới hiển thị.
            </p>
            <div className="mt-4">
              <CertificationsSection certifications={profile.certifications} />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-h2 text-ink-900">Dịch vụ và bảng giá</h2>
            <p className="mt-1 text-sm text-ink-600">
              Giá hiển thị công khai là giá khởi điểm. Khách lọc theo dịch vụ, nên hồ sơ không khai
              dịch vụ nào sẽ không xuất hiện khi khách lọc. Sửa ở đây hay ở{' '}
              {/* Cùng một form, hai lối vào — nói ra để KTV biết trang riêng tồn tại,
                  và biết rằng hai nơi không phải hai bảng giá khác nhau. */}
              <Link
                href="/dashboard/dich-vu"
                className="font-medium text-brand-600 hover:underline"
              >
                trang Dịch vụ và giá
              </Link>{' '}
              đều được — cùng một bảng giá. Trang đó còn có công tắc bật/tắt nhận khách.
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
