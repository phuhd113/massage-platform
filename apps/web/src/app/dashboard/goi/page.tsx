import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BuyPackageForm } from '@/components/BuyPackageForm';
import { api } from '@/lib/api';
import { UnauthenticatedError, authFetch, authFetchOrNull } from '@/lib/session';
import { formatVnd } from '@/lib/site';
import type { MyKtvProfile, PromotionPackage, WalletBalance } from '@/lib/types';

export const metadata: Metadata = { title: 'Mua gói đẩy tin' };

export default async function PackagesPage() {
  let wallet: WalletBalance;
  let profile: MyKtvProfile | null;
  let packages: PromotionPackage[];

  try {
    [wallet, profile, packages] = await Promise.all([
      authFetch<WalletBalance>('/wallet/balance'),
      authFetchOrNull<MyKtvProfile>('/ktv/profile/me'),
      authFetch<PromotionPackage[]>('/promotions/packages'),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  const areas = await api.areaTree();
  const canBuy = profile?.verificationStatus === 'VERIFIED';

  return (
    <>
      <h1 className="text-2xl font-semibold">Mua gói đẩy tin</h1>
      <p className="mt-2 text-stone-600">
        Số dư dùng được: <strong className="tabular-nums">{formatVnd(wallet.available)}</strong>
      </p>

      {!canBuy && (
        <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {profile
            ? 'Hồ sơ chưa được duyệt nên chưa mua được gói. Gói chỉ có tác dụng khi hồ sơ đã hiển thị trong tìm kiếm.'
            : 'Tài khoản chưa có hồ sơ kỹ thuật viên nên chưa mua được gói.'}
        </p>
      )}

      <section className="mt-8">
        <BuyPackageForm packages={packages} areas={areas} disabled={!canBuy} />
      </section>

      <section className="mt-10 max-w-2xl text-sm text-stone-600">
        <h2 className="text-lg font-semibold text-stone-900">Cách tính thứ hạng</h2>
        <p className="mt-2">
          Thứ hạng = điểm gói + điểm hồ sơ. Điểm hồ sơ nằm trong khoảng 0–100, tính từ đánh giá,
          khoảng cách tới khách, tỉ lệ phản hồi và mức độ hoạt động gần đây.
        </p>
        <p className="mt-2">
          VIP Pin cộng 500 và Instant Boost cộng 300 — đều lớn hơn toàn bộ dải điểm hồ sơ, nên hai
          gói này đảm bảo bạn đứng trên mọi KTV không mua gói trong khu vực đã chọn. Huy hiệu nổi
          bật cộng 50, nhỏ hơn dải đó, nên nó tăng khả năng hiển thị nhưng{' '}
          <strong>không đảm bảo vị trí đầu trang</strong>.
        </p>
        <p className="mt-2">
          Mua nhiều gói cùng lúc không cộng dồn điểm — hệ thống lấy gói cao nhất.
        </p>
      </section>
    </>
  );
}
