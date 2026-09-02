import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Kết quả nạp tiền',
  robots: { index: false, follow: false },
};

/**
 * Trang cổng thanh toán trả trình duyệt về sau khi khách thanh toán xong.
 *
 * Cố ý **không** cộng tiền và không tin tham số trên URL: đường này đi qua máy
 * của người dùng nên sửa được. Tiền chỉ vào ví khi cổng gọi IPN thẳng vào server
 * và chữ ký được kiểm. Ở đây chỉ hiển thị, và luôn dẫn người dùng về ví để xem
 * số dư thật.
 */
export default function TopUpResultPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams.vnp_ResponseCode;
  const code = Array.isArray(raw) ? raw[0] : raw;
  const succeeded = code === '00';

  return (
    <div className="mx-auto max-w-md rounded-lg border border-ink-200 bg-white p-6 text-center shadow-card">
      <h1 className="text-h2 text-ink-900">
        {succeeded ? 'Đã thanh toán' : 'Giao dịch chưa hoàn tất'}
      </h1>

      <p className="mt-3 text-ink-600">
        {succeeded ? (
          <>
            Cổng thanh toán báo thành công. Tiền vào ví ngay khi hệ thống nhận được xác nhận từ
            cổng — thường trong vài giây. Mở ví để xem số dư thật.
          </>
        ) : (
          <>Giao dịch bị huỷ hoặc chưa hoàn tất, và chưa có khoản nào bị trừ. Bạn có thể thử lại.</>
        )}
      </p>

      <Link
        href="/dashboard/vi"
        className="mt-6 inline-block rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600"
      >
        Về ví
      </Link>
    </div>
  );
}
