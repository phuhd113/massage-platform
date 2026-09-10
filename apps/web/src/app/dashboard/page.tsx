import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AreaIcon,
  CalendarIcon,
  CertifiedIcon,
  CheckIcon,
  ClockIcon,
  StarIcon,
  VerifiedIcon,
} from '@/components/icons';
import { OnlineChip } from '@/components/OnlineToggle';
import { api } from '@/lib/api';
import { packageLabel, transactionLabel } from '@/lib/labels';
import { requireKtvProfile } from '@/lib/require-profile';
import { UnauthenticatedError, authFetch, authFetchOrNull } from '@/lib/session';
import { formatDate, formatDateTime, formatVnd } from '@/lib/site';
import type {
  Campaign,
  KtvServiceItem,
  KtvStats,
  MyKtvProfile,
  WalletBalance,
  WalletTransaction,
  WalletTransactionList,
} from '@/lib/types';

export default async function DashboardPage() {
  let wallet: WalletBalance;
  let campaigns: Campaign[];
  let stats: KtvStats | null;

  // Chưa tạo hồ sơ thì trang này không có gì để hiện — đưa thẳng về trang hồ sơ.
  // `requireKtvProfile` tự redirect, nên phía dưới `profile` chắc chắn khác null.
  const profile = await requireKtvProfile();

  try {
    [wallet, campaigns, stats] = await Promise.all([
      authFetch<WalletBalance>('/wallet/balance'),
      authFetch<Campaign[]>('/ktv/campaigns'),
      authFetchOrNull<KtvStats>('/ktv/profile/stats'),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  const running = campaigns.filter((c) => c.isRunning);

  // Bảng giá và sổ ví chỉ tra sau khi biết hồ sơ có tồn tại hay không: cả hai
  // endpoint đều đòi hồ sơ đã tạo, và tài khoản mới chưa có gì để hiển thị ở đó.
  // Sổ lấy 5 dòng — đây là bản tóm tắt, trang Ví mới là nơi đọc đủ.
  const [myServices, ledger] = await Promise.all([
    (await authFetchOrNull<KtvServiceItem[]>('/ktv/profile/services')) ?? [],
    authFetch<WalletTransactionList>('/wallet/transactions?page=1&size=5'),
  ]);

  const areas = await api.areaTree();
  const areaName = new Map(
    areas.flatMap((p) => p.children.map((d) => [d.id, d.name] as const)),
  );

  return (
    <>
      <h1 className="text-h1 text-ink-900 sm:text-[30px] sm:leading-9">Tổng quan</h1>

      <ProfileStatus profile={profile} />

      <ProfileCard profile={profile} services={myServices} />

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
          value={formatVnd(wallet.available, 'vi')}
          hint={wallet.held > 0 ? `${formatVnd(wallet.held, 'vi')} đang giữ` : undefined}
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
                        {formatDate(c.endAt, 'vi')}
                      </div>
                    </div>
                    <div className="ml-auto shrink-0 text-right">
                      <div className="tabular font-mono text-body text-ink-900">
                        {formatVnd(c.pricePaid, 'vi')}
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

        <div className="grid gap-[18px]">
          <TodoPanel profile={profile} wallet={wallet} runningCount={running.length} />
          <RecentLedger items={ledger.items} />
        </div>
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

/**
 * Thông tin hồ sơ đang được khách nhìn thấy.
 *
 * Đây là bản **chỉ đọc** của những gì `/dashboard/ho-so` cho sửa, và cố ý không
 * lặp lại form: KTV mở tổng quan để biết mình đang trông thế nào trong mắt khách,
 * chưa chắc để sửa. Mỗi trường ở đây đều là thứ ảnh hưởng trực tiếp tới việc có
 * được hiện ra hay không (bán kính, khu vực phủ), hoặc tới việc khách có bấm hay
 * không (kinh nghiệm, đánh giá, chứng chỉ, bảng giá) — không phải một bản đổ toàn
 * bộ trường trong DB.
 */
function ProfileCard({
  profile,
  services,
}: {
  profile: MyKtvProfile;
  services: KtvServiceItem[];
}) {
  const verifiedCerts = profile.certifications.filter((c) => c.verifyStatus === 'VERIFIED');
  const pendingCerts = profile.certifications.filter((c) => c.verifyStatus === 'PENDING');
  const coverage = profile.coverageAreas ?? [];

  // Giá khởi điểm thấp nhất — con số khách so sánh đầu tiên giữa các hồ sơ.
  const priceFrom = services.length > 0 ? Math.min(...services.map((s) => s.priceFrom)) : null;

  return (
    <section className="mt-3.5 rounded-xl border border-ink-200 bg-white p-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-h3 text-ink-900">{profile.fullName}</h2>
            {/* Trạng thái nhận khách nằm cạnh tên vì nó là thứ duy nhất trong thẻ
                này KTV đổi nhiều lần trong ngày, và nó tác động thẳng lên thứ hạng.
                Chính vì vậy nó là một cái nút chứ không phải một cái nhãn: chỗ hiển
                thị trạng thái và chỗ đổi trạng thái mà tách nhau thì KTV phải đi tìm
                công tắc ở một trang khác cho việc họ làm nhiều lần nhất. */}
            <OnlineChip isOnline={profile.isOnline} />
          </div>
        </div>

        <Link
          href="/dashboard/ho-so"
          className="shrink-0 rounded-md border border-ink-200 px-4 py-2 text-body-s font-semibold text-ink-700 transition hover:border-ink-300 hover:text-ink-900"
        >
          Sửa hồ sơ
        </Link>
      </div>

      <dl className="mt-4 grid gap-x-4 gap-y-3.5 border-t border-ink-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field icon={<VerifiedIcon size={18} className="h-[14px] w-[14px]" />} label="Kinh nghiệm">
          {profile.yearsExperience > 0 ? `${profile.yearsExperience} năm` : 'Chưa khai'}
        </Field>

        <Field icon={<StarIcon size={18} className="h-[14px] w-[14px]" />} label="Đánh giá">
          {profile.ratingCount > 0 ? (
            <>
              {profile.ratingAvg.toFixed(1).replace('.', ',')}
              <span className="text-ink-600"> · {profile.ratingCount} lượt</span>
            </>
          ) : (
            'Chưa có đánh giá'
          )}
        </Field>

        <Field icon={<CertifiedIcon size={18} className="h-[14px] w-[14px]" />} label="Chứng chỉ">
          {verifiedCerts.length > 0 ? `${verifiedCerts.length} đã duyệt` : 'Chưa có'}
          {pendingCerts.length > 0 && (
            <span className="text-ink-600"> · {pendingCerts.length} chờ duyệt</span>
          )}
        </Field>

        <Field icon={<CalendarIcon size={18} className="h-[14px] w-[14px]" />} label="Tham gia từ">
          {formatDate(profile.createdAt, 'vi')}
        </Field>

        <Field icon={<AreaIcon size={18} className="h-[14px] w-[14px]" />} label="Bán kính phục vụ">
          {profile.serviceRadiusKm} km
          {/* Địa chỉ gốc chỉ hiện ở đây, không bao giờ ra hồ sơ công khai — nhắc
              lại điều đó ngay tại chỗ để không ai "sửa" cho nhất quán. */}
          {profile.baseAddress && (
            <span className="block text-caption font-normal text-ink-500">
              từ {profile.baseAddress} (chỉ mình bạn thấy)
            </span>
          )}
        </Field>

        <Field icon={<ClockIcon size={18} className="h-[14px] w-[14px]" />} label="Giá khởi điểm">
          {priceFrom != null ? (
            <>
              {formatVnd(priceFrom, 'vi')}
              <span className="text-ink-600"> · {services.length} dịch vụ</span>
            </>
          ) : (
            <Link href="/dashboard/ho-so" className="text-brand-500 hover:text-brand-600">
              Chưa khai giá →
            </Link>
          )}
        </Field>

        <div className="sm:col-span-2">
          <dt className="flex items-center gap-1.5 text-caption text-ink-500">
            <span className="text-ink-400">
              <AreaIcon size={18} className="h-[14px] w-[14px]" />
            </span>
            Khu vực nhận khách
          </dt>
          <dd className="mt-1.5">
            {coverage.length === 0 ? (
              <Link href="/dashboard/ho-so" className="text-body-l text-brand-500 hover:text-brand-600">
                Chưa chọn khu vực nào →
              </Link>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {coverage.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-full bg-ink-100 px-2.5 py-1 text-caption text-ink-700"
                  >
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      {services.length > 0 && (
        <div className="mt-4 border-t border-ink-100 pt-4">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-h4 text-ink-900">Dịch vụ và bảng giá</h3>
            <Link
              href="/dashboard/ho-so"
              className="shrink-0 text-body-s font-semibold text-brand-500 transition hover:text-brand-600"
            >
              Sửa bảng giá →
            </Link>
          </div>
          <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
            {services.map((s) => (
              <li
                key={s.serviceId}
                className="flex items-baseline justify-between gap-3 rounded-lg bg-ink-50 px-3.5 py-2.5"
              >
                <span className="min-w-0 truncate text-body-l text-ink-800">
                  {s.name}
                  <span className="text-ink-500"> · {s.durationMin} phút</span>
                </span>
                <span className="tabular shrink-0 font-mono text-body text-ink-900">
                  {formatVnd(s.priceFrom, 'vi')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-caption text-ink-500">
        <span className="text-ink-400">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-body-l font-semibold text-ink-900">{children}</dd>
    </div>
  );
}

/**
 * Năm bút toán gần nhất.
 *
 * Chỉ là bản tóm tắt để KTV thấy tiền vừa đi đâu mà không phải rời trang; sổ đầy
 * đủ vẫn ở `/dashboard/vi`. Không hiển thị `balanceAfter` ở đây vì số dư hiện tại
 * đã nằm ngay trên cùng trang — hai con số cùng nói về số dư ở hai thời điểm khác
 * nhau, đặt cạnh nhau, là cách chắc chắn để bị đọc nhầm.
 */
function RecentLedger({ items }: { items: WalletTransaction[] }) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-ink-200 bg-white p-[18px]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-h3 text-ink-900">Ví gần đây</h2>
        <Link
          href="/dashboard/vi"
          className="shrink-0 text-body-s font-semibold text-brand-500 transition hover:text-brand-600"
        >
          Sổ đầy đủ →
        </Link>
      </div>
      <ul className="mt-3.5 grid gap-2.5">
        {items.map((t) => (
          <li key={t.id} className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-body-l text-ink-800">{transactionLabel(t.type)}</div>
              <div className="text-caption text-ink-500">{formatDateTime(t.createdAt, 'vi')}</div>
            </div>
            <span
              className={`tabular shrink-0 font-mono text-body ${
                t.amount > 0 ? 'text-success-fg' : 'text-ink-900'
              }`}
            >
              {t.amount > 0 ? '+' : '−'}
              {formatVnd(Math.abs(t.amount), 'vi')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
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

  /* Cố ý KHÔNG có mục nhắc chứng chỉ: nó tuỳ chọn ở giai đoạn này, mà một lời khuyên
     tuỳ chọn thì không bao giờ "xong" nên sẽ nằm đây vĩnh viễn và làm nhờn cả panel.
     Phần khuyến khích tải chứng chỉ nằm ở /dashboard/ho-so, đúng chỗ KTV làm việc đó. */

  if (profile && !profile.isOnline)
    todos.push({
      // Nói rõ công tắc nằm ngay trên cùng trang này. Trước đây câu này khuyên một
      // việc mà giao diện không có chỗ nào làm được — mục todo chỉ nên chứa việc làm
      // xong thì biến mất, và một việc không có nút bấm thì không bao giờ xong.
      text: 'Bật "đang nhận khách" ở thẻ hồ sơ phía trên vào giờ bạn rảnh để lên đầu danh sách.',
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
/**
 * Nhận `MyKtvProfile` chứ không phải `| null`: từ 2026-09-07, `requireKtvProfile`
 * đưa tài khoản chưa có hồ sơ về thẳng `/dashboard/ho-so`, nên trang này không bao
 * giờ render với hồ sơ rỗng. Nhánh "chưa có hồ sơ" cũ đã bỏ — giữ lại là để một
 * thông báo không bao giờ hiện được nằm lẫn trong code còn sống.
 */
function ProfileStatus({ profile }: { profile: MyKtvProfile }) {
  if (profile.verificationStatus === 'VERIFIED') {

    return (
      <div className="mt-[18px] flex flex-wrap items-center gap-3.5 rounded-xl border border-success-bd bg-success-bg px-[18px] py-3.5">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-white text-success-fg">
          <CheckIcon size={20} className="h-[18px] w-[18px]" />
        </span>

        <div className="min-w-0">
          <div className="font-display text-body-l font-bold text-success-fg">
            Hồ sơ đã được duyệt và đang hiển thị trong tìm kiếm
          </div>
          <div className="mt-0.5 text-body-l text-ink-700">
            Khách đang thấy hồ sơ này khi tìm trong khu vực bạn phục vụ.
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
