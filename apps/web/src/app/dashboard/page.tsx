import Link from 'next/link';
import { redirect } from 'next/navigation';
import { packageLabel } from '@/lib/labels';
import { UnauthenticatedError, authFetch, authFetchOrNull } from '@/lib/session';
import { formatVnd } from '@/lib/site';
import type { Campaign, MyKtvProfile, WalletBalance } from '@/lib/types';

export default async function DashboardPage() {
  let profile: MyKtvProfile | null;
  let wallet: WalletBalance;
  let campaigns: Campaign[];

  try {
    // Hồ sơ có thể chưa tồn tại (tài khoản mới), nên nó dùng biến thể trả null;
    // ví và campaign thì luôn có, kể cả khi rỗng.
    [profile, wallet, campaigns] = await Promise.all([
      authFetchOrNull<MyKtvProfile>('/ktv/profile/me'),
      authFetch<WalletBalance>('/wallet/balance'),
      authFetch<Campaign[]>('/ktv/campaigns'),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  const running = campaigns.filter((c) => c.isRunning);

  return (
    <>
      <h1 className="text-2xl font-semibold">Tổng quan</h1>

      <ProfileStatus profile={profile} />

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Số dư khả dụng" value={formatVnd(wallet.available)} />
        <Stat
          label="Đang giữ"
          value={formatVnd(wallet.held)}
          hint={wallet.held > 0 ? 'Tiền giữ cho lần mua chưa chốt' : undefined}
        />
        <Stat label="Chiến dịch đang chạy" value={String(running.length)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/dashboard/vi"
          className="rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600"
        >
          Nạp tiền
        </Link>
        <Link
          href="/dashboard/goi"
          className="rounded-md border border-brand-500 px-5 py-2.5 font-medium text-brand-600 hover:bg-brand-50"
        >
          Mua gói đẩy tin
        </Link>
      </div>

      {running.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Đang chạy</h2>
          <ul className="mt-3 space-y-2">
            {running.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-4 py-3"
              >
                <div>
                  <div className="font-medium">{packageLabel(c.packageType)}</div>
                  <div className="text-sm text-stone-500">
                    Hết hạn {new Date(c.endAt).toLocaleDateString('vi-VN')} · +{c.boostPoints} điểm
                  </div>
                </div>
                <Link href="/dashboard/chien-dich" className="text-sm text-brand-600 hover:underline">
                  Chi tiết
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
}

/**
 * Trạng thái hồ sơ đứng ngay đầu trang vì nó là điều kiện của mọi thứ còn lại:
 * hồ sơ chưa duyệt thì không xuất hiện trong tìm kiếm và không mua được gói. Nếu
 * không nói rõ ở đây, KTV sẽ nạp tiền rồi mới phát hiện không mua được.
 */
function ProfileStatus({ profile }: { profile: MyKtvProfile | null }) {
  if (!profile) {
    return (
      <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Tài khoản chưa có hồ sơ kỹ thuật viên. Hồ sơ phải được tạo và duyệt trước khi hiển thị
        trong tìm kiếm và trước khi mua được gói đẩy tin.
      </p>
    );
  }

  if (profile.verificationStatus === 'VERIFIED') {
    return (
      <p className="mt-4 text-sm text-stone-600">
        Hồ sơ <strong>{profile.fullName}</strong> đã được duyệt
        {profile.ratingCount > 0 && <> · ★ {profile.ratingAvg.toFixed(1)} ({profile.ratingCount} đánh giá)</>}
      </p>
    );
  }

  return (
    <p className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {profile.verificationStatus === 'PENDING' ? (
        <>Hồ sơ đang chờ duyệt. Trong lúc chờ, hồ sơ chưa hiện trong tìm kiếm và chưa mua được gói.</>
      ) : (
        <>
          Hồ sơ bị từ chối{profile.rejectionReason ? `: ${profile.rejectionReason}` : ''}. Bổ sung
          thông tin rồi gửi lại để được duyệt.
        </>
      )}
    </p>
  );
}
