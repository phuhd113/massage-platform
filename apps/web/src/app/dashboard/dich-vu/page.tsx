import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OnlineToggle } from '@/components/OnlineToggle';
import { ServicePricingForm } from '@/components/ServicePricingForm';
import { api } from '@/lib/api';
import { requireKtvProfile } from '@/lib/require-profile';
import { UnauthenticatedError, authFetchOrNull } from '@/lib/session';
import type { KtvServiceItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Dịch vụ và giá' };

/**
 * Nơi KTV quản lý thứ mình bán: dịch vụ nào, giá bao nhiêu, và hiện có nhận khách không.
 *
 * Tách khỏi `/dashboard/ho-so` vì hai việc có nhịp hoàn toàn khác nhau. Hồ sơ là thứ
 * khai một lần rồi hầu như không đụng lại — và mỗi lần đụng là một lần chờ duyệt lại.
 * Bảng giá và trạng thái nhận khách thì đổi theo tuần, theo ngày, và không đụng gì tới
 * việc duyệt. Chôn chúng dưới cuối một trang dài toàn CCCD với cam kết là bắt KTV cuộn
 * qua đúng những phần họ không định sửa để tới phần họ mở trang vì nó.
 *
 * Section cũ trong `/dashboard/ho-so` **vẫn giữ** làm lối tắt, và cả hai nơi render
 * cùng một `ServicePricingForm` — không chép form. Hai bản sao sẽ trôi khỏi nhau, và
 * bản lệch chỉ lộ ra với KTV nào tình cờ dùng đúng lối vào ít được sửa hơn.
 */
export default async function ServicesPage() {
  const profile = await requireKtvProfile();

  let catalog: Awaited<ReturnType<typeof api.services>>;
  let mine: KtvServiceItem[];

  try {
    [catalog, mine] = await Promise.all([
      api.services(),
      authFetchOrNull<KtvServiceItem[]>('/ktv/profile/services').then((r) => r ?? []),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  return (
    <div className="pb-12">
      <h1 className="text-h1 text-ink-900">Dịch vụ và giá</h1>
      <p className="mt-2 max-w-2xl text-body text-ink-600">
        Những gì bạn khai ở đây là thứ khách nhìn thấy trước khi quyết định gọi. Sửa xong là
        hiện ngay trên hồ sơ công khai — không phải chờ duyệt lại.
      </p>

      {/* Công tắc đứng đầu trang: nó là thứ đổi thường xuyên nhất trong ba thứ ở đây,
          và là thứ có hậu quả tức thì nhất (khách gọi hay không gọi). */}
      <section className="mt-8">
        <h2 className="text-h2 text-ink-900">Trạng thái nhận khách</h2>
        <div className="mt-4 rounded-lg border border-ink-200 bg-white p-5">
          <OnlineToggle isOnline={profile.isOnline} />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 text-ink-900">Bảng giá dịch vụ</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-600">
          Giá hiển thị công khai là giá khởi điểm. Khách lọc theo dịch vụ, nên hồ sơ không khai
          dịch vụ nào sẽ không xuất hiện khi khách lọc.
        </p>
        <div className="mt-4">
          <ServicePricingForm catalog={catalog} mine={mine} />
        </div>
      </section>

      {/* Trang này cố ý không sửa được hồ sơ: gộp vào là kéo theo cả luật duyệt lại,
          đúng thứ vừa tách ra khỏi đây. Một link là đủ. */}
      <p className="mt-10 text-body-s text-ink-600">
        Đổi tên, khu vực hay bán kính nhận khách ở{' '}
        <Link href="/dashboard/ho-so" className="font-medium text-brand-600 hover:underline">
          trang hồ sơ
        </Link>
        . Lưu ý những thay đổi đó sẽ đưa hồ sơ về chờ duyệt lại.
      </p>
    </div>
  );
}
