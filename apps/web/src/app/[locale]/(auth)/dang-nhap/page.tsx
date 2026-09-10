import type { Metadata } from 'next';
import { PasswordAuthForm } from '@/components/PasswordAuthForm';
import { normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { getSessionRole, redirectIfAuthenticated, safeNext } from '@/lib/session';
import { AlreadySignedIn } from '@/components/AlreadySignedIn';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  return {
    title: t('login.metaTitleCustomer'),
    // Trang chức năng, không phải nội dung để xếp hạng.
    robots: { index: false, follow: false },
  };
}

/**
 * Cửa đăng nhập, dùng chung cho cả khách lẫn KTV.
 *
 * Không phân biệt vai trò ở đây: đăng nhập thì vai trò đã nằm sẵn trên tài khoản, và
 * form điều hướng theo vai trò **thật** trả về từ server. Chỉ việc *đăng ký* mới cần
 * biết người mới vào là ai, và đó là hai trang riêng (`/dang-ky`, `/dang-ky-ktv`).
 *
 * `?next=` để quay lại đúng trang khách đang đứng — người bấm đăng nhập từ một hồ sơ
 * KTV gần như luôn đang định viết đánh giá cho chính hồ sơ đó.
 */
export default function LoginPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string };
}) {
  const next = safeNext(searchParams.next);
  const locale = normalizeLocale(params.locale);

  /*
    KTV còn phiên bấm nút header lại gặp đúng form họ vừa điền xong — đọc như phiên đã
    mất, trong khi nó còn nguyên. Nên KTV vẫn đá thẳng về `/dashboard`.

    Nhưng KHÁCH đã đăng nhập thì không: `redirectIfAuthenticated` đưa họ về `/`, tức
    **đúng trang họ vừa bấm nút**, nên cú bấm trông như không có gì xảy ra. Đây là lỗi
    thật đã đo được (307 → `/`), và nó tệ hơn hẳn từ khi nút header đổi thành lời mời
    rõ ràng "Trở thành KTV MasGo": người bấm đang muốn mở hồ sơ KTV, thứ họ nhận được
    là im lặng. Vai trò chốt lúc tạo tài khoản nên câu trả lời đúng là một màn hình nói
    thẳng điều đó, kèm lối ra.
  */
  const role = getSessionRole();
  if (role === 'KTV') redirectIfAuthenticated(next);
  if (role !== null) return <AlreadySignedIn locale={locale} />;

  return (
    <PasswordAuthForm
      mode="login"
      /* Bật tab: đây là cửa duy nhất phục vụ cả hai thao tác. */
      showTabs
      /*
        Vai trò cho tab Đăng ký, suy từ **lối vào** chứ không hỏi người dùng — cùng dấu
        hiệu mà `registerHref` đã dùng: có `?next=` nghĩa là khách được mời từ một hồ
        sơ (ReviewForm), không có nghĩa là KTV bấm nút header. Bắt 95% người mở màn hình
        này (là khách) trả lời "bạn là ai" là dựng rào cho đa số để phục vụ thiểu số.
      */
      role={next ? 'CUSTOMER' : 'KTV'}
      locale={locale}
      redirectTo={next}
    />
  );
}
