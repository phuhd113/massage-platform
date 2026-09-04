import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';

/**
 * not-found.tsx phải nằm ở root nên nó render với root layout — vốn không còn
 * header/footer sau khi tách nhóm (public). Tự bọc PublicShell ở đây: trang 404 là
 * chỗ khách cần đường quay lại nhất, bỏ điều hướng ở đúng đó là ngõ cụt.
 */
export default function NotFound() {
  return (
    <PublicShell>
      <div className="py-16 text-center">
        <h1 className="text-h1 text-ink-900">Không tìm thấy trang</h1>
        <p className="mt-3 text-ink-600">
          Trang bạn tìm không tồn tại hoặc hồ sơ đã ngừng hiển thị.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600"
        >
          Về trang chủ
        </Link>
      </div>
    </PublicShell>
  );
}
