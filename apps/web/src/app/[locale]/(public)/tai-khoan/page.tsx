import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChangePasswordForm } from '@/components/ChangePasswordForm';
import { messagesFor } from '@/lib/validation-messages';
import { LogoutButton } from '@/components/LogoutButton';
import { UnauthenticatedError, authFetch, getSessionRole } from '@/lib/session';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator, type Translator } from '@/i18n/t';
import { formatDate, ktvPath } from '@/lib/site';
import type { MyReview } from '@/lib/types';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  return {
    title: t('myAccount.metaTitle'),
    // Trang riêng của từng người, không có gì để xếp hạng.
    robots: { index: false, follow: false },
  };
}

// Dữ liệu riêng của từng người: không được cache dùng chung, và không được dựng
// sẵn lúc build.
export const dynamic = 'force-dynamic';

/**
 * Trang tài khoản của khách.
 *
 * Nằm trong `(public)` chứ không phải `/dashboard`: khách không có sidebar riêng và
 * vẫn đang ở trong luồng duyệt site — họ vào đây từ header rồi quay ra tìm tiếp.
 * Dashboard là màn làm việc của KTV, có bộ điều hướng của chính nó.
 *
 * Chỉ hiển thị đánh giá. Lịch sử liên hệ cố ý **chưa** đưa vào: bảng `leads` ghi cả
 * lượt bấm của khách chưa đăng nhập, nên phần lớn lịch sử của một người sẽ không có
 * trong đó — một danh sách khuyết quá nửa còn khó hiểu hơn là không có.
 */
export default async function AccountPage({ params }: { params: { locale: string } }) {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  // KTV có bảng điều khiển riêng đầy đủ hơn hẳn; đưa họ về đó thay vì hiện một
  // trang nghèo nàn hơn cùng nội dung.
  if (getSessionRole() === 'KTV') redirect('/dashboard');

  let reviews: MyReview[];
  let me: { hasPassword: boolean };
  try {
    // Hai lời gọi song song: chúng độc lập, và xếp tuần tự chỉ để cộng thêm một
    // vòng đi backend vào thời gian chờ của trang.
    [reviews, me] = await Promise.all([
      authFetch<MyReview[]>('/me/reviews'),
      authFetch<{ hasPassword: boolean }>('/auth/me'),
    ]);
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap?next=/tai-khoan');
    throw err;
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h1 className="text-display text-ink-900">{t('myAccount.h1')}</h1>
          <p className="mt-2 text-body-l text-ink-600">{t('myAccount.lead')}</p>
        </div>
        <LogoutButton
          labels={{ logout: t('myAccount.logout'), loggingOut: t('myAccount.loggingOut') }}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-h2 text-ink-900">
          {t('myAccount.reviewsTitle')}
          {reviews.length > 0 && (
            <span className="ml-2 text-body-l font-normal text-ink-500">
              <span className="tabular">{reviews.length}</span>
            </span>
          )}
        </h2>

        {reviews.length === 0 ? (
          <div className="mt-3 rounded-xl border border-ink-200 bg-white px-4 py-5 text-center">
            <p className="text-body text-ink-600">{t('myAccount.emptyTitle')}</p>
            <p className="mt-1 text-body-s text-ink-500">{t('myAccount.emptyBody')}</p>
            <Link
              href={localePath(locale, '/tim-kiem')}
              className="mt-4 inline-block rounded-full bg-brand-500 px-5 py-2.5 text-body font-semibold text-white shadow-button transition hover:bg-brand-600"
            >
              {t('myAccount.emptyCta')}
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {reviews.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-ink-200 bg-white px-4 py-3.5 shadow-card"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <Link
                    href={ktvPath(locale, r.ktvSlug, r.ktvId)}
                    className="text-h4 text-ink-900 transition hover:text-brand-600"
                  >
                    {r.ktvFullName}
                  </Link>
                  <time className="text-caption text-ink-400" dateTime={r.createdAt}>
                    {formatDate(r.createdAt, locale)}
                  </time>
                </div>

                <div className="mt-1.5 text-body-s">
                  <span className="text-champagne-500" aria-hidden>
                    {'★'.repeat(r.rating)}
                  </span>
                  <span className="text-ink-300" aria-hidden>
                    {'★'.repeat(5 - r.rating)}
                  </span>
                  <span className="sr-only">{t('ktvProfile.starsSr', { rating: r.rating })}</span>
                </div>

                {r.comment && (
                  <p lang="vi" className="mt-1.5 max-w-prose text-body text-ink-700">
                    {r.comment}
                  </p>
                )}

                <ReviewStatusNote status={r.status} rejectionReason={r.rejectionReason} t={t} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Đặt dưới danh sách đánh giá: đổi mật khẩu là việc hiếm, còn xem đánh giá
          của mình là lý do người ta mở trang này. */}
      <section className="mt-8">
        <h2 className="text-h2 text-ink-900">
          {me.hasPassword ? t('myAccount.passwordTitle') : t('myAccount.passwordTitleSet')}
        </h2>
        <ChangePasswordForm
          hasPassword={me.hasPassword}
          validation={messagesFor(locale)}
          labels={{
            title: t('myAccount.passwordTitle'),
            intro: me.hasPassword
              ? t('myAccount.passwordIntro')
              : t('myAccount.passwordIntroSet'),
            currentLabel: t('myAccount.passwordCurrent'),
            newLabel: t('myAccount.passwordNew'),
            confirmLabel: t('myAccount.passwordConfirm'),
            hint: t('myAccount.passwordHint', { length: 8 }),
            submit: me.hasPassword
              ? t('myAccount.passwordSubmit')
              : t('myAccount.passwordSubmitSet'),
            submitting: t('myAccount.passwordSubmitting'),
            success: t('myAccount.passwordSuccess'),
            errorMismatch: t('myAccount.passwordErrorMismatch'),
            errorShort: t('myAccount.passwordErrorShort', { length: 8 }),
            errorWrongCurrent: t('myAccount.passwordErrorWrongCurrent'),
            errorGeneric: t('myAccount.passwordErrorGeneric'),
          }}
        />
      </section>
    </div>
  );
}

/**
 * Ghi chú trạng thái cho đánh giá không ở trạng thái bình thường.
 *
 * Đánh giá đã đăng thì không nói gì — nhãn "đang hiển thị" trên mọi dòng chỉ là
 * nhiễu. Nhưng đánh giá bị gỡ **phải** nói, kèm lý do: nếu không, người viết chỉ
 * thấy nó biến mất khỏi trang hồ sơ, viết lại, rồi nhận lỗi "bạn đã đánh giá rồi".
 */
function ReviewStatusNote({
  status,
  rejectionReason,
  t,
}: {
  status: string;
  rejectionReason: string | null;
  t: Translator;
}) {
  if (status === 'PUBLISHED') return null;

  if (status === 'REJECTED') {
    return (
      <p className="mt-2.5 rounded-md border border-danger-bd bg-danger-bg px-3 py-2 text-body-s text-danger-fg">
        {t('myAccount.statusRejected')}
        {rejectionReason && <>{t('myAccount.statusRejectedReason', { reason: rejectionReason })}</>}
      </p>
    );
  }

  return (
    <p className="mt-2.5 rounded-md border border-warning-bd bg-warning-bg px-3 py-2 text-body-s text-warning-fg">
      {t('myAccount.statusPending')}
    </p>
  );
}
