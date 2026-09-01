import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Không tìm thấy trang</h1>
      <p className="mt-3 text-stone-600">
        Trang bạn tìm không tồn tại hoặc hồ sơ đã ngừng hiển thị.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
