import { CheckIcon } from '@/components/icons';
import { formatDate } from '@/lib/site';
import type { MyKtvProfile } from '@/lib/types';

/**
 * Checklist tiến độ hồ sơ KTV — trả lời đúng một câu hỏi: **tôi còn thiếu gì?**
 *
 * Thay hai khối cũ trên `/dashboard/ho-so` vốn cùng trả lời câu đó nhưng tách rời:
 * một danh sách 3 bước tĩnh chỉ hiện khi CHƯA có hồ sơ, và một `StatusBanner` liệt kê
 * phần còn thiếu chỉ hiện khi ĐÃ có. Hai khối cùng nói về một quy trình thì phải tự
 * giữ cho khớp nhau mãi mãi, và bản lệch chỉ lộ ra với KTV đang ở đúng trạng thái đó.
 *
 * **Hai nhóm cố ý tách bạch, không trộn.** Nhóm bắt buộc là **đúng những điều kiện
 * `AdminService.DecideProfileAsync` thật sự kiểm** — không hơn một mục nào. Nhóm khuyến
 * nghị là việc quyết định có khách hay không, nhưng không chặn duyệt. Trộn hai nhóm là
 * cách chắc chắn để KTV làm xong mấy việc tuỳ chọn rồi vẫn không hiểu vì sao chưa được
 * duyệt — đúng dạng lỗi mà dòng "hồ sơ cần ít nhất một chứng chỉ đã duyệt để hiển thị"
 * (sai, đã gỡ 2026-09-09) từng gây ra.
 *
 * Vì vậy: **thêm một mục vào nhóm bắt buộc mà backend không kiểm là nói dối người dùng
 * theo hướng tốn kém nhất** — họ làm một việc thừa và tin rằng mình đang bị chặn vì nó.
 * Ngược lại, gỡ một điều kiện thật ra khỏi nhóm này thì hồ sơ nằm chờ vô thời hạn mà
 * màn hình báo "đã xong".
 */

type StepState = 'done' | 'pending' | 'todo' | 'problem';

interface Step {
  label: string;
  /** Câu mô tả việc cần làm, hoặc xác nhận đã xong. Luôn nói ở ngôi người đọc. */
  detail: string;
  state: StepState;
  /** Neo tới đúng section thực hiện việc đó. Bỏ trống khi việc nằm ngay form bên dưới. */
  href?: string;
}

/** Nhãn + màu theo trạng thái. `problem` tách khỏi `todo` vì nó cần hành động khác. */
const STATE_STYLE: Record<StepState, { badge: string; dot: string; text: string }> = {
  done: {
    badge: 'bg-success-bg text-success-fg',
    dot: 'bg-success-fg text-white',
    text: 'Đã xong',
  },
  pending: {
    badge: 'bg-warning-bg text-warning-fg',
    dot: 'bg-warning-fg text-white',
    text: 'Chờ duyệt',
  },
  todo: {
    badge: 'bg-ink-100 text-ink-600',
    dot: 'bg-ink-200 text-ink-600',
    text: 'Chưa làm',
  },
  problem: {
    badge: 'bg-danger-bg text-danger-fg',
    dot: 'bg-danger-fg text-white',
    text: 'Cần sửa',
  },
};

/**
 * @param serviceCount Số dịch vụ đã khai giá. Truyền vào thay vì tự gọi API: trang hồ
 *   sơ đã lấy danh sách này cho `ServicePricingForm` bên dưới, nên hỏi lại backend lần
 *   thứ hai là bắt nó trả lời hai lần cho cùng một câu hỏi trong cùng một lượt render.
 */
export function ProfileChecklist({
  profile,
  serviceCount,
}: {
  profile: MyKtvProfile | null;
  serviceCount: number;
}) {
  const required = requiredSteps(profile);
  const recommended = recommendedSteps(profile, serviceCount);

  // Đếm theo **mục đã xong**, không tính mục đang chờ duyệt là xong: KTV gửi CCCD rồi
  // thấy "3/3" sẽ tưởng mình đã hết việc và không quay lại, trong khi CCCD bị từ chối
  // là chuyện có thật và cần họ gửi lại.
  const doneCount = required.filter((s) => s.state === 'done').length;
  const allRequiredDone = doneCount === required.length;

  return (
    <section
      aria-labelledby="checklist-heading"
      className="mt-4 rounded-xl border border-ink-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="checklist-heading" className="font-display text-h3 text-ink-900">
          Tiến độ hồ sơ
        </h2>
        <span className="text-body-s text-ink-600">
          {doneCount}/{required.length} bước bắt buộc
        </span>
      </div>

      <LiveStatus profile={profile} />

      <StatusLine profile={profile} allRequiredDone={allRequiredDone} />

      {/* Thanh tiến độ đọc được bằng mắt trong một nhịp, nhưng con số ở trên mới là
          thứ trình đọc màn hình đọc — thanh này `aria-hidden`, không nhân đôi thông tin. */}
      <div aria-hidden className="mt-4 flex gap-1.5">
        {required.map((step, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              step.state === 'done'
                ? 'bg-success-fg'
                : step.state === 'pending'
                  ? 'bg-warning-fg'
                  : step.state === 'problem'
                    ? 'bg-danger-fg'
                    : 'bg-ink-200'
            }`}
          />
        ))}
      </div>

      <h3 className="mt-6 text-body-s font-semibold uppercase tracking-wide text-ink-500">
        Bắt buộc để được duyệt
      </h3>
      <StepList steps={required} />

      <h3 className="mt-6 text-body-s font-semibold uppercase tracking-wide text-ink-500">
        Nên làm để có khách
      </h3>
      {/* Nhóm này hiện đủ mục **kể cả khi chưa có hồ sơ**, dù lúc đó chưa làm được mục
          nào. Gộp lại thành một dòng "sẽ xuất hiện sau" là giấu con đường phía trước với
          đúng người cần thấy nó nhất — người đang cân nhắc có nên bắt đầu hay không. */}
      <p className="mt-1 text-body-s text-ink-600">
        Không ảnh hưởng tới việc duyệt — hồ sơ vẫn lên sàn khi những mục này còn trống.
        {!profile && ' Các mục này mở ra sau khi bạn tạo hồ sơ ở form bên dưới.'}
      </p>
      <StepList steps={recommended} />
    </section>
  );
}

/**
 * Một dòng trả lời câu hỏi KTV mở trang này để hỏi: **hồ sơ của tôi đã hiển thị trên
 * website chưa?**
 *
 * Điều kiện là <b>đúng một thứ</b>: <c>verification_status = 'VERIFIED'</c>. Đó là mệnh
 * đề duy nhất mà cả <c>SearchService</c> lẫn đường đọc hồ sơ công khai lọc theo —
 * <c>is_online</c> chỉ là bộ lọc tuỳ chọn của khách, không quyết định hồ sơ có tồn tại
 * trên sàn hay không. Thêm bất kỳ điều kiện nào khác vào dòng này (có ảnh, có dịch vụ,
 * có chứng chỉ) là nói với KTV rằng họ chưa lên sàn trong khi khách đang thấy họ.
 *
 * Tách khỏi <see cref="StatusLine"/> dù cùng đọc một trường: dòng này trả lời "tôi có
 * đang được nhìn thấy không", còn dòng kia trả lời "tôi còn phải làm gì". Người vào
 * kiểm tra nhanh chỉ cần vế đầu, và nó phải đọc được trong một nhịp mà không phải đọc
 * hết một đoạn văn.
 */
function LiveStatus({ profile }: { profile: MyKtvProfile | null }) {
  const live = profile?.verificationStatus === 'VERIFIED';

  return (
    <p
      className={`mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3.5 py-2.5 text-body font-medium ${
        live ? 'bg-success-bg text-success-fg' : 'bg-ink-100 text-ink-700'
      }`}
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 rounded-full ${live ? 'bg-success-fg' : 'bg-ink-400'}`}
      />
      {live ? 'Hồ sơ đang hiển thị trên website' : 'Hồ sơ chưa hiển thị trên website'}
      <span className="font-normal text-ink-600">
        {live
          ? '— khách tìm kiếm thấy được bạn.'
          : profile
            ? '— khách tìm kiếm chưa thấy bạn.'
            : '— chưa có hồ sơ nào để hiển thị.'}
      </span>
    </p>
  );
}

/**
 * Câu tóm tắt trạng thái, đặt ngay dưới tiêu đề.
 *
 * Đây là chỗ giữ lại toàn bộ thông tin của `StatusBanner` cũ — lý do từ chối, và lời
 * cảnh báo "sửa hồ sơ sẽ phải duyệt lại". Bỏ vế thứ hai là để KTV sửa một chữ trong
 * tên rồi mất hiển thị vài giờ mà không hiểu vì sao.
 */
function StatusLine({
  profile,
  allRequiredDone,
}: {
  profile: MyKtvProfile | null;
  allRequiredDone: boolean;
}) {
  if (!profile) {
    return (
      <p className="mt-2 text-body text-ink-700">
        Bắt đầu bằng form bên dưới. Ví, gói đẩy tin và chiến dịch chỉ mở sau khi hồ sơ tồn tại.
      </p>
    );
  }

  if (profile.verificationStatus === 'VERIFIED') {
    return (
      <p className="mt-2 text-body text-ink-700">
        Hồ sơ đã được duyệt và đang hiển thị công khai tại{' '}
        <code className="text-body-s">
          /ktv/{profile.slug}-{profile.id}
        </code>
        . Lưu ý: sửa thông tin hồ sơ sẽ đưa nó về chờ duyệt lại.
      </p>
    );
  }

  if (profile.verificationStatus === 'REJECTED') {
    return (
      <p className="mt-2 text-body text-ink-700">
        Hồ sơ bị từ chối
        {profile.rejectionReason ? `: ${profile.rejectionReason}` : ''}. Sửa lại theo ghi chú rồi
        lưu để gửi duyệt lần nữa.
      </p>
    );
  }

  return (
    <p className="mt-2 text-body text-ink-700">
      {allRequiredDone
        ? 'Bạn đã làm xong phần của mình. Hồ sơ đang chờ quản trị viên duyệt — trong lúc chờ, hồ sơ chưa hiện trong tìm kiếm.'
        : 'Hồ sơ chưa hiện trong tìm kiếm. Làm nốt những mục còn thiếu bên dưới rồi chờ quản trị viên duyệt.'}
    </p>
  );
}

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-3 grid gap-2.5">
      {steps.map((step) => {
        const style = STATE_STYLE[step.state];

        return (
          <li
            key={step.label}
            className="flex gap-3 rounded-lg border border-ink-100 bg-ink-25 px-3.5 py-3"
          >
            <span
              aria-hidden
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${style.dot}`}
            >
              {step.state === 'done' && <CheckIcon size={12} className="h-3 w-3" />}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-body font-medium text-ink-900">{step.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-caption font-semibold ${style.badge}`}
                >
                  {style.text}
                </span>
              </span>

              <span className="mt-1 block text-body-s text-ink-600">{step.detail}</span>

              {/* Link chỉ hiện khi còn việc phải làm: một đường dẫn "đi tới" cạnh mục
                  đã xong là mời người ta bấm vào chỗ không còn gì để làm. */}
              {step.href && step.state !== 'done' && (
                <a
                  href={step.href}
                  className="mt-1.5 inline-block text-body-s font-medium text-brand-600 hover:underline"
                >
                  Tới mục này →
                </a>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Ba điều kiện bắt buộc — khớp **đúng** với `AdminService.DecideProfileAsync`.
 *
 * Bước 1 (hồ sơ tồn tại) không phải một `if` trong hàm đó nhưng là tiền đề của cả hai
 * điều kiện còn lại: không có hồ sơ thì không có gì để duyệt.
 */
function requiredSteps(profile: MyKtvProfile | null): Step[] {
  const doc = profile?.identityDocument ?? null;

  return [
    {
      label: 'Khai thông tin hồ sơ',
      detail: profile
        ? `Đã khai tên, giới tính, kinh nghiệm, địa chỉ gốc và bán kính ${profile.serviceRadiusKm} km.`
        : 'Tên, giới tính, số năm kinh nghiệm, địa chỉ gốc và bán kính nhận khách. Điền ở form ngay bên dưới.',
      state: profile ? 'done' : 'todo',
    },
    {
      label: 'Gửi ảnh CCCD và được xác minh',
      detail: identityDetail(doc),
      state: !doc
        ? 'todo'
        : doc.verifyStatus === 'VERIFIED'
          ? 'done'
          : doc.verifyStatus === 'REJECTED'
            ? 'problem'
            : 'pending',
      // Chỉ gắn neo khi hồ sơ đã tồn tại: section CCCD nằm trong nhánh `{profile && ...}`
      // của trang, nên trước đó `#cccd` là một link không đi tới đâu cả.
      href: profile ? '#cccd' : undefined,
    },
    {
      label: 'Ký bản cam kết kỹ thuật viên',
      detail: !profile
        ? 'Xác nhận các nghĩa vụ khi hoạt động trên nền tảng. Mục này xuất hiện sau khi tạo hồ sơ.'
        : profile.commitmentsUpToDate
          ? `Đã ký${profile.committedAt ? ` ngày ${formatDate(profile.committedAt, 'vi')}` : ''}.`
          : profile.commitmentVersion > 0
            ? 'Bản cam kết đã được cập nhật kể từ lần bạn ký. Đọc và xác nhận lại bản mới.'
            : 'Đọc và xác nhận các nghĩa vụ khi hoạt động trên nền tảng.',
      // Cam kết là việc KTV tự làm, xong là xong — không có trạng thái chờ ai duyệt.
      state: profile?.commitmentsUpToDate ? 'done' : 'todo',
      href: profile ? '#cam-ket' : undefined,
    },
  ];
}

/** Câu mô tả CCCD theo từng trạng thái — bốn ca, không gộp. */
function identityDetail(doc: MyKtvProfile['identityDocument']): string {
  if (!doc) {
    return 'Ảnh hai mặt CCCD. Chỉ quản trị viên xem được, không bao giờ hiển thị công khai.';
  }

  if (doc.verifyStatus === 'VERIFIED') {
    return `Danh tính đã được đối chiếu${doc.verifiedAt ? ` ngày ${formatDate(doc.verifiedAt, 'vi')}` : ''}.`;
  }

  if (doc.verifyStatus === 'REJECTED') {
    return doc.rejectionReason
      ? `Bị từ chối: ${doc.rejectionReason}. Chụp lại và gửi ảnh mới.`
      : 'Ảnh bị từ chối. Chụp lại rõ nét cả hai mặt và gửi lại.';
  }

  return `Đã gửi ngày ${formatDate(doc.submittedAt, 'vi')}, đang chờ quản trị viên đối chiếu. Bạn không cần làm gì thêm ở bước này.`;
}

/**
 * Việc không chặn duyệt nhưng quyết định có khách hay không.
 *
 * Cố ý **không** có mục nào đòi hỏi hành động của admin ngoài chứng chỉ — và chứng chỉ
 * nằm đây chứ không ở nhóm trên vì nó tuỳ chọn (xem `AdminService.DecideProfileAsync`:
 * không có điều kiện nào về chứng chỉ).
 */
function recommendedSteps(profile: MyKtvProfile | null, serviceCount: number): Step[] {
  const areas = profile?.coverageAreas?.length ?? 0;
  const photos = profile?.photos ?? [];
  const verifiedPhotos = photos.filter((p) => p.verifyStatus === 'VERIFIED').length;
  const pendingPhotos = photos.filter((p) => p.verifyStatus === 'PENDING').length;
  const certs = profile?.certifications ?? [];
  const verifiedCerts = certs.filter((c) => c.verifyStatus === 'VERIFIED').length;
  const pendingCerts = certs.filter((c) => c.verifyStatus === 'PENDING').length;
  const rejectedCerts = certs.filter((c) => c.verifyStatus === 'REJECTED').length;

  return [
    {
      label: 'Đặt ảnh đại diện',
      detail: avatarDetail(profile),
      // Đã có ảnh công khai thì mục này XONG, kể cả khi đang có bản mới chờ duyệt —
      // trạng thái mô tả "hồ sơ đã có ảnh hay chưa", không phải "có gì đang chờ". Đảo
      // lại thì mỗi lần đổi ảnh là một mục vừa xong lại quay về chưa xong.
      state: profile?.avatarUrl
        ? 'done'
        : profile?.pendingAvatarUrl
          ? 'pending'
          : profile?.avatarVerifyStatus === 'REJECTED'
            ? 'problem'
            : 'todo',
      href: profile ? '#anh' : undefined,
    },
    {
      label: 'Thêm ảnh không gian làm việc',
      detail: !profile
        ? 'Ảnh phòng, giường, dụng cụ hoặc bằng cấp. Khác ảnh đại diện, nhóm ảnh này phải qua duyệt trước khi hiển thị.'
        : verifiedPhotos > 0
          ? `${verifiedPhotos} ảnh đã duyệt và đang hiển thị trên hồ sơ công khai${
              pendingPhotos > 0 ? `, ${pendingPhotos} ảnh đang chờ duyệt` : ''
            }.`
          : pendingPhotos > 0
            ? `${pendingPhotos} ảnh đang chờ duyệt. Ảnh chỉ hiển thị sau khi được duyệt, khác ảnh đại diện.`
            : 'Ảnh phòng, giường, dụng cụ hoặc bằng cấp — thứ trả lời câu hỏi "chỗ này có chuyên nghiệp không". Nhóm ảnh này phải qua duyệt trước khi hiển thị.',
      state: verifiedPhotos > 0 ? 'done' : pendingPhotos > 0 ? 'pending' : 'todo',
      href: profile ? '#anh' : undefined,
    },
    {
      label: 'Khai bảng giá dịch vụ',
      detail:
        serviceCount > 0
          ? `Đã khai ${serviceCount} dịch vụ. Giá hiển thị công khai là giá khởi điểm — khách hiểu là giá có thể tăng theo thời lượng hoặc yêu cầu thêm.`
          : 'Chọn những dịch vụ bạn làm, kèm giá khởi điểm và thời lượng. Khách lọc kết quả theo dịch vụ, nên hồ sơ chưa khai dịch vụ nào sẽ không xuất hiện ở mọi lượt lọc đó.',
      state: serviceCount > 0 ? 'done' : 'todo',
      href: '/dashboard/dich-vu',
    },
    {
      label: 'Chọn khu vực nhận khách',
      detail:
        areas > 0
          ? `Đang nhận khách ở ${areas} khu vực. Sửa danh sách này ở form hồ sơ bên dưới.`
          : 'Chọn các quận/huyện bạn sẵn sàng tới. Khách tìm theo tên quận sẽ không thấy bạn cho tới khi quận đó có trong danh sách — khác với bán kính, vốn chỉ áp dụng khi khách tìm bằng GPS.',
      state: areas > 0 ? 'done' : 'todo',
    },
    {
      label: 'Tải chứng chỉ hành nghề',
      detail: certificationDetail(verifiedCerts, pendingCerts, rejectedCerts),
      state:
        verifiedCerts > 0
          ? 'done'
          : pendingCerts > 0
            ? 'pending'
            : rejectedCerts > 0
              ? 'problem'
              : 'todo',
      href: profile ? '#chung-chi' : undefined,
    },
  ];
}

/**
 * Câu mô tả ảnh đại diện. Năm ca, vì từ 2026-09-10 avatar phải qua duyệt và có thể vừa
 * có ảnh đang hiển thị vừa có ảnh đang chờ cùng lúc.
 *
 * Ca quan trọng nhất là ca thứ hai: đã có ảnh công khai **và** đang chờ duyệt bản mới.
 * Câu chữ ở đó phải nói rõ ảnh cũ vẫn trên sàn — nếu không, KTV đọc "đang chờ duyệt" sẽ
 * tưởng hồ sơ mình đang không có ảnh và gỡ đi làm lại.
 */
function avatarDetail(profile: MyKtvProfile | null): string {
  if (!profile) {
    return 'Ảnh chân dung rõ mặt, ánh sáng tốt. Đây là thứ khách nhìn thấy đầu tiên trong kết quả tìm kiếm. Ảnh phải được quản trị viên duyệt trước khi hiển thị.';
  }

  if (profile.avatarUrl && profile.pendingAvatarUrl) {
    return 'Đang hiển thị ảnh cũ trên hồ sơ công khai, và bạn có một ảnh mới đang chờ duyệt. Ảnh mới sẽ tự thay ảnh cũ khi được duyệt.';
  }

  if (profile.avatarUrl) {
    return 'Đã có ảnh đại diện đang hiển thị công khai.';
  }

  if (profile.pendingAvatarUrl) {
    return 'Ảnh đang chờ quản trị viên duyệt. Hồ sơ tạm hiển thị chữ cái đầu tên cho tới khi ảnh được duyệt.';
  }

  if (profile.avatarVerifyStatus === 'REJECTED') {
    return profile.avatarRejectionReason
      ? `Ảnh bị từ chối: ${profile.avatarRejectionReason}. Chọn ảnh khác và gửi lại.`
      : 'Ảnh bạn gửi bị từ chối. Chọn ảnh khác và gửi lại.';
  }

  return 'Ảnh chân dung rõ mặt, ánh sáng tốt. Đây là thứ khách nhìn thấy đầu tiên trong kết quả tìm kiếm. Ảnh phải được quản trị viên duyệt trước khi hiển thị.';
}

/**
 * Câu mô tả chứng chỉ. Bốn ca, và **không** ca nào được nói rằng chứng chỉ là điều
 * kiện để hồ sơ hiển thị — nó tuỳ chọn (xem `AdminService.DecideProfileAsync`). Dòng
 * cũ ở section chứng chỉ từng nói sai đúng điều đó và đọc như lý do khiến hồ sơ mãi
 * không lên sàn.
 */
function certificationDetail(verified: number, pending: number, rejected: number): string {
  if (verified > 0) {
    return `${verified} chứng chỉ đã duyệt, đang hiện thành huy hiệu trên thẻ tìm kiếm và hồ sơ công khai${
      pending > 0 ? `. Còn ${pending} chứng chỉ đang chờ duyệt` : ''
    }.`;
  }

  if (pending > 0) {
    return `${pending} chứng chỉ đang chờ quản trị viên duyệt. Chỉ chứng chỉ đã duyệt mới hiển thị công khai — hồ sơ của bạn không bị ảnh hưởng trong lúc chờ.`;
  }

  if (rejected > 0) {
    return 'Chứng chỉ bạn gửi bị từ chối — xem lý do ở mục chứng chỉ bên dưới. Có thể tải lên bản khác, hoặc bỏ qua: chứng chỉ không bắt buộc.';
  }

  return 'Không bắt buộc — hồ sơ vẫn được duyệt và hiển thị khi chưa có chứng chỉ nào. Nhưng huy hiệu chứng chỉ hiện ngay trên thẻ tìm kiếm, nên đây là thứ giúp bạn nổi bật khi khách so sánh nhiều hồ sơ cùng lúc.';
}
