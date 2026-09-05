import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BuyPackageForm } from '@/components/BuyPackageForm';
import { packageLabel } from '@/lib/labels';
import { UnauthenticatedError, authFetch, authFetchOrNull } from '@/lib/session';
import { formatVnd } from '@/lib/site';
import type { MyKtvProfile, PromotionPackage, WalletBalance } from '@/lib/types';

export const metadata: Metadata = { title: 'Mua gói đẩy tin' };

/** Dải điểm tối đa của BaseScore — hằng số của công thức xếp hạng, không phải dữ liệu. */
const MAX_BASE_SCORE = 100;

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

  const canBuy = profile?.verificationStatus === 'VERIFIED';

  // Bảng điểm dựng từ chính dữ liệu gói đang bán, không gõ tay: đây là bảng KTV
  // dùng để so hạng trước khi trả tiền, nên nó phải luôn khớp với công thức đang
  // chạy — kể cả sau một lần đổi điểm boost như Badge 50 → 150 hồi tháng 9.
  //
  // Gộp theo **hạng** chứ không theo gói: cùng một hạng có nhiều gói khác thời hạn
  // (VIP Pin 7 ngày và 30 ngày đều +500 điểm), liệt kê theo gói sẽ hiện "VIP Pin
  // 500 điểm" hai lần và đọc như dữ liệu lỗi. Điểm boost là thuộc tính của hạng.
  const tiers = [...new Map(packages.map((p) => [p.type, p])).values()]
    .sort((a, b) => b.boostPoints - a.boostPoints)
    .map((p) => ({ label: packageLabel(p.type), points: p.boostPoints }));

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Mua gói đẩy tin</h1>
      <p className="mt-2 text-body-l text-ink-600">
        Chọn khu vực trước — số chỗ trống và giá phụ thuộc khu vực. Số dư dùng được{' '}
        <strong className="tabular font-mono font-medium text-ink-900">
          {formatVnd(wallet.available, 'vi')}
        </strong>
        .
      </p>

      {!canBuy && (
        <p className="mt-4 rounded-xl border border-warning-bd bg-warning-bg px-[18px] py-3.5 text-body-l text-warning-fg">
          {profile
            ? 'Hồ sơ chưa được duyệt nên chưa mua được gói. Gói chỉ có tác dụng khi hồ sơ đã hiển thị trong tìm kiếm.'
            : 'Tài khoản chưa có hồ sơ kỹ thuật viên nên chưa mua được gói.'}
        </p>
      )}

      <section className="mt-5">
        <BuyPackageForm packages={packages} disabled={!canBuy} />
      </section>

      <section className="mt-8 rounded-xl border border-ink-200 bg-white p-5">
        <h2 className="font-display text-h3 text-ink-900">Cách tính thứ hạng</h2>

        <div className="mt-3.5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="text-body-l leading-6 text-ink-700">
            <p>
              Thứ hạng = điểm gói + điểm hồ sơ. Điểm hồ sơ nằm trong khoảng 0–{MAX_BASE_SCORE},
              tính từ đánh giá, khoảng cách tới khách, tỉ lệ phản hồi và mức độ hoạt động gần đây.
            </p>
            <p className="mt-2.5">
              Điểm của mọi gói đều lớn hơn toàn bộ dải điểm hồ sơ, nên{' '}
              <strong>mua gói nào cũng đảm bảo</strong> bạn đứng trên các KTV không mua gói trong
              khu vực đã chọn. Khác nhau là thứ tự giữa những người cùng mua. Mua nhiều gói cùng
              lúc không cộng dồn — hệ thống lấy gói cao nhất.
            </p>
          </div>

          <dl className="grid gap-2 rounded-lg border border-ink-100 bg-brand-50 p-4 text-body">
            {tiers.map((t) => (
              <div key={t.label} className="flex items-center justify-between gap-3">
                <dt className="text-ink-700">{t.label}</dt>
                <dd className="tabular font-mono text-ink-900">{t.points} điểm</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 border-t border-ink-200 pt-2">
              <dt className="text-ink-600">Điểm hồ sơ tối đa</dt>
              <dd className="tabular font-mono text-ink-600">{MAX_BASE_SCORE} điểm</dd>
            </div>
          </dl>
        </div>
      </section>
    </>
  );
}
