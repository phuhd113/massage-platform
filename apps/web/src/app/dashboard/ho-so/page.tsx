import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CertificationsSection } from '@/components/CertificationsSection';
import { ProfileForm } from '@/components/ProfileForm';
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

  const [areas, catalog] = await Promise.all([api.areaTree(), api.services()]);

  // Bảng giá chỉ tồn tại khi đã có hồ sơ — backend trả 404 nếu chưa.
  const myServices = profile
    ? ((await authFetchOrNull<KtvServiceItem[]>('/ktv/profile/services')) ?? [])
    : [];

  return (
    <>
      <h1 className="text-2xl font-semibold">Hồ sơ kỹ thuật viên</h1>

      {profile ? (
        <StatusBanner profile={profile} />
      ) : (
        <p className="mt-4 rounded-md bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Tạo hồ sơ để bắt đầu. Sau khi gửi, quản trị viên sẽ duyệt trước khi hồ sơ hiển thị trong
          kết quả tìm kiếm.
        </p>
      )}

      <section className="mt-8">
        <ProfileForm profile={profile} areas={areas} />
      </section>

      {profile && (
        <>
          <section className="mt-12">
            <h2 className="text-lg font-semibold">Chứng chỉ hành nghề</h2>
            <p className="mt-1 text-sm text-stone-600">
              Chỉ chứng chỉ đã được duyệt mới hiển thị trên trang hồ sơ công khai. Đây cũng là hàng
              rào chất lượng của nền tảng, nên khâu duyệt không bỏ qua được.
            </p>
            <div className="mt-4">
              <CertificationsSection certifications={profile.certifications} />
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-lg font-semibold">Dịch vụ và bảng giá</h2>
            <p className="mt-1 text-sm text-stone-600">
              Giá hiển thị công khai là giá khởi điểm. Khách lọc theo dịch vụ, nên hồ sơ không khai
              dịch vụ nào sẽ không xuất hiện khi khách lọc.
            </p>
            <div className="mt-4">
              <ServicePricingForm catalog={catalog} mine={myServices} />
            </div>
          </section>
        </>
      )}
    </>
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

  return (
    <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {profile.verificationStatus === 'PENDING' ? (
        <>Hồ sơ đang chờ duyệt. Trong lúc chờ, hồ sơ chưa hiện trong tìm kiếm.</>
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
