import Link from 'next/link';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { packageLabel } from '@/lib/labels';
import { UnauthenticatedError, authFetch, authFetchOrNull } from '@/lib/session';
import { formatDate, formatVnd } from '@/lib/site';
import type { Campaign, KtvStats, MyKtvProfile, WalletBalance } from '@/lib/types';

export default async function DashboardPage() {
  let profile: MyKtvProfile | null;
  let wallet: WalletBalance;
  let campaigns: Campaign[];
  let stats: KtvStats | null;

  try {
    // Hồ sơ có thể chưa tồn tại (tài khoản mới), nên nó dùng biến thể trả null;
    // ví và campaign thì luôn có, kể cả khi rỗng. Số liệu cũng có thể null vì
    // endpoint đó đòi hồ sơ đã tạo.
    [profile, wallet, campaigns, stats] = await Promise.all([
      authFetchOrNull<MyKtvProfile>('/ktv/profile/me'),
      authFetch<WalletBalance>('/wallet/balance'),
      authFetch<Campaign[]>('/ktv/campaigns'),
      authFetchOrNull<KtvStats>('/ktv/profile/stats'),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  const running = campaigns.filter((c) => c.isRunning);

  const areas = await api.areaTree();
  const areaName = new Map(
    areas.flatMap((p) => p.children.map((d) => [d.id, d.name] as const)),
  );

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Tổng quan</h1>

      <ProfileStatus profile={profile} />

      {/*
        Ba ô đầu xếp đúng thứ tự phễu: hiện ra → xem hồ sơ → bấm liên hệ. Đọc từ trái
        sang phải là thấy được mình đang rơi khách ở bậc nào, và mỗi ô mang sẵn tỉ lệ
        chuyển xuống bậc kế tiếp ngay trong dòng phụ.

        Khung "7 ngày" nói một lần ở đây thay vì lặp trong từng nhãn: năm cột hẹp hơn
        bốn, và "Lượt bấm liên hệ · 7 ngày" xuống hai dòng làm cả hàng lệch nhau.
      */}
      <div className="mt-5 flex items-baseline gap-2">
        <h2 className="font-display text-h4 text-ink-900">Hiệu quả 7 ngày</h2>
        <span className="text-caption text-ink-500">so với 7 ngày liền trước</span>
      </div>

      {/*
        Ba ô phễu tách khỏi hai ô trạng thái tài khoản: gộp chung một hàng thì tiêu đề
        "Hiệu quả 7 ngày" nói sai về số dư ví và số chiến dịch — hai thứ đó là trạng
        thái hiện tại, không phải số liệu của một khoảng thời gian.
      */}
      <div className="mt-2.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Lượt hiển thị"
          value={stats ? stats.impressions.toLocaleString('vi-VN') : '—'}
          hint={changeHint(stats?.impressionsChangePct)}
          hintTone={
            stats?.impressionsChangePct != null && stats.impressionsChangePct > 0 ? 'up' : 'muted'
          }
        />
        <Stat
          label="Lượt xem hồ sơ"
          value={stats ? stats.profileViews.toLocaleString('vi-VN') : '—'}
          hint={
            // Ưu tiên tỉ lệ bấm vào hơn phần trăm thay đổi: nó nối ô này với ô bên
            // trái thành một phễu đọc được, còn mức tăng giảm thì ô "Lượt hiển thị"
            // đã nói rồi.
            pctLabel(stats?.clickRatePct, 'từ lượt hiển thị')
            ?? changeHint(stats?.profileViewsChangePct)
          }
          hintTone={
            stats?.clickRatePct == null
              && stats?.profileViewsChangePct != null
              && stats.profileViewsChangePct > 0
              ? 'up'
              : 'muted'
          }
        />
        <Stat
          label="Lượt bấm liên hệ"
          value={stats ? stats.leads.toLocaleString('vi-VN') : '—'}
          hint={pctLabel(stats?.leadRatePct, 'người xem bấm gọi')}
        />
      </div>

      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
        <Stat
          label="Số dư dùng được"
          value={formatVnd(wallet.available)}
          hint={wallet.held > 0 ? `${formatVnd(wallet.held)} đang giữ` : undefined}
          hintTone={wallet.held > 0 ? 'info' : 'muted'}
        />
        <Stat
          label="Chiến dịch đang chạy"
          value={String(running.length)}
          hint={
            running.length > 0
              ? running
                  .map((c) => areaName.get(c.areaId))
                  .filter(Boolean)
                  .join(', ') || undefined
              : undefined
          }
        />
      </div>

      <div className="mt-6 grid items-start gap-[18px] gap-y-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-xl border border-ink-200 bg-white p-[18px]">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-h3 text-ink-900">Chiến dịch đang chạy</h2>
            <Link
              href="/dashboard/chien-dich"
              className="shrink-0 text-body-s font-semibold text-brand-500 transition hover:text-brand-600"
            >
              Tất cả chiến dịch →
            </Link>
          </div>

          {running.length === 0 ? (
            <div className="mt-3.5">
              <p className="text-body-l text-ink-600">
                Chưa có chiến dịch nào đang chạy. Hồ sơ vẫn hiển thị trong tìm kiếm, chỉ là xếp
                dưới những KTV đang mua gói trong cùng khu vực.
              </p>
              <Link
                href="/dashboard/goi"
                className="mt-3.5 inline-block rounded-md bg-brand-500 px-5 py-2.5 text-body-l font-semibold text-white transition hover:bg-brand-600"
              >
                Xem gói đẩy tin
              </Link>
            </div>
          ) : (
            <ul className="mt-3.5 grid gap-2.5">
              {running.map((c) => {
                // VIP Pin dùng nền champagne để tách khỏi các gói thấp hơn — cùng
                // quy ước màu với thẻ KTV trả phí ở trang tìm kiếm.
                const vip = c.packageType === 'VIP_PIN';
                return (
                  <li
                    key={c.id}
                    className={`flex flex-wrap items-center gap-3.5 rounded-lg border px-4 py-3.5 ${
                      vip ? 'border-champagne-200 bg-champagne-50' : 'border-ink-200 bg-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-display text-body-l font-bold text-ink-900">
                        {packageLabel(c.packageType)}
                        {areaName.has(c.areaId) && ` · ${areaName.get(c.areaId)}`}
                      </div>
                      <div className="mt-0.5 text-body text-ink-600">
                        {daysLeftLabel(c.endAt)} · hết hạn{' '}
                        {formatDate(c.endAt)}
                      </div>
                    </div>
                    <div className="ml-auto shrink-0 text-right">
                      <div className="tabular font-mono text-body text-ink-900">
                        {formatVnd(c.pricePaid)}
                      </div>
                      <div
                        className={`text-caption ${vip ? 'text-champagne-600' : 'text-ink-600'}`}
                      >
                        +{c.boostPoints} điểm
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <TodoPanel profile={profile} wallet={wallet} runningCount={running.length} />
      </div>
    </>
  );
}

/**
 * Nhãn so sánh với tuần trước.
 *
 * Trả về undefined khi backend không tính được phần trăm (tuần trước bằng 0) — mọi
 * cách viết ở đó đều là số bịa, và "+100%" trên một hồ sơ mới toanh là kiểu sai
 * nghe rất thuyết phục.
 */
function changeHint(pct: number | null | undefined): string | undefined {
  if (pct == null) return undefined;
  return `${pct > 0 ? '+' : ''}${pct}% so với tuần trước`;
}

/** Phần trăm theo kiểu Việt Nam: dấu phẩy thập phân. */
function pctLabel(pct: number | null | undefined, suffix: string): string | undefined {
  if (pct == null) return undefined;
  return `${pct.toString().replace('.', ',')}% ${suffix}`;
}

function daysLeftLabel(endAt: string): string {
  const ms = new Date(endAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return 'Hết hôm nay';
  return `Còn ${days} ngày`;
}

function Stat({
  label,
  value,
  hint,
  hintTone = 'muted',
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'muted' | 'up' | 'info';
}) {
  const toneClass =
    hintTone === 'up' ? 'text-success-fg' : hintTone === 'info' ? 'text-info-fg' : 'text-ink-600';

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <div className="text-body text-ink-600">{label}</div>
      <div className="tabular mt-1.5 whitespace-nowrap font-mono text-[22px] font-medium leading-7 text-ink-900">
        {value}
      </div>
      {/* Chỗ cho dòng phụ luôn được giữ, kể cả khi rỗng: bốn ô nằm cạnh nhau, ô nào
          thiếu dòng này sẽ thấp hơn hẳn và cả hàng trông như vỡ. */}
      <div className={`mt-1 min-h-[17px] text-caption ${toneClass}`}>{hint ?? ''}</div>
    </div>
  );
}

/**
 * Việc nên làm — gợi ý dựa trên trạng thái thật của tài khoản.
 *
 * Cố ý **không** phải danh sách tĩnh: một bảng lời khuyên giống hệt nhau ở mọi tài
 * khoản sẽ bị bỏ qua sau lần thứ hai. Mỗi mục ở đây chỉ hiện khi nó thật sự đang
 * đúng với người đang đăng nhập, và biến mất khi họ làm xong.
 */
function TodoPanel({
  profile,
  wallet,
  runningCount,
}: {
  profile: MyKtvProfile | null;
  wallet: WalletBalance;
  runningCount: number;
}) {
  const todos: { text: string; tone: 'warn' | 'info' | 'idle' }[] = [];

  if (profile && profile.certifications.length === 0)
    todos.push({
      text: 'Chưa có chứng chỉ nào. Hồ sơ cần ít nhất một chứng chỉ đã duyệt để hiển thị.',
      tone: 'warn',
    });

  if (profile && !profile.bio)
    todos.push({
      text: 'Viết vài dòng giới thiệu — khách đọc phần này trước khi quyết định gọi.',
      tone: 'info',
    });

  if (profile && !profile.isOnline)
    todos.push({
      text: 'Bật trạng thái "đang nhận khách" vào giờ bạn rảnh để lên đầu danh sách.',
      tone: 'idle',
    });

  if (profile?.verificationStatus === 'VERIFIED' && runningCount === 0 && wallet.available > 0)
    todos.push({
      text: 'Ví còn số dư nhưng chưa có gói nào đang chạy — số dư không tự đẩy hồ sơ lên.',
      tone: 'info',
    });

  if (todos.length === 0) return null;

  const dot = { warn: 'bg-champagne-500', info: 'bg-brand-500', idle: 'bg-ink-300' };

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-[18px]">
      <h2 className="font-display text-h3 text-ink-900">Việc nên làm</h2>
      <ul className="mt-3.5 grid gap-3">
        {todos.map((t) => (
          <li key={t.text} className="flex gap-2.5 text-body-l leading-[22px] text-ink-700">
            <span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${dot[t.tone]}`} />
            {t.text}
          </li>
        ))}
      </ul>
    </section>
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
      <p className="mt-[18px] rounded-xl border border-warning-bd bg-warning-bg px-[18px] py-3.5 text-body-l text-warning-fg">
        Tài khoản chưa có hồ sơ kỹ thuật viên. Hồ sơ phải được tạo và duyệt trước khi hiển thị
        trong tìm kiếm và trước khi mua được gói đẩy tin.{' '}
        <Link href="/dashboard/ho-so" className="font-semibold underline">
          Tạo hồ sơ ngay
        </Link>
        .
      </p>
    );
  }

  if (profile.verificationStatus === 'VERIFIED') {
    const verified = profile.certifications.filter((c) => c.verifyStatus === 'VERIFIED').length;

    return (
      <div className="mt-[18px] flex flex-wrap items-center gap-3.5 rounded-xl border border-success-bd bg-success-bg px-[18px] py-3.5">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white text-success-fg">
          <svg
            aria-hidden
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>

        <div className="min-w-0">
          <div className="font-display text-body-l font-bold text-success-fg">
            Hồ sơ đã được duyệt và đang hiển thị trong tìm kiếm
          </div>
          <div className="mt-0.5 text-body-l text-ink-700">
            {verified} chứng chỉ đã đối chiếu
            {profile.ratingCount > 0 && (
              <>
                {' · ★ '}
                {profile.ratingAvg.toFixed(1).replace('.', ',')} từ {profile.ratingCount} đánh giá
              </>
            )}
          </div>
        </div>

        <Link
          href={`/ktv/${profile.slug}-${profile.id}`}
          className="ml-auto shrink-0 text-body-l font-semibold text-brand-500 transition hover:text-brand-600"
        >
          Xem hồ sơ công khai →
        </Link>
      </div>
    );
  }

  return (
    <p className="mt-[18px] rounded-xl border border-warning-bd bg-warning-bg px-[18px] py-3.5 text-body-l text-warning-fg">
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
