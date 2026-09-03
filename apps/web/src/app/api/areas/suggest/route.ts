import { NextResponse } from 'next/server';
import { API_BASE } from '@/lib/session';

/**
 * Gợi ý khu vực cho ô tìm địa chỉ — đường công khai, không cần đăng nhập.
 *
 * Không dùng lại `/api/proxy/[...path]`: proxy đó trả 401 khi thiếu cookie phiên,
 * vì nó sinh ra cho dashboard KTV. Khách đi tìm massage thì chưa đăng nhập, nên
 * dùng chung sẽ hỏng đúng ở nhóm người dùng đông nhất.
 *
 * Cũng không gọi thẳng backend từ trình duyệt: trong docker compose, API chỉ nghe
 * trong mạng nội bộ và `API_BASE_URL` trỏ vào hostname của container.
 */

/** Trần cứng ở tầng này, độc lập với trần của backend. */
const MAX_LIMIT = 20;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim();

  // Chặn ngay ở biên thay vì chuyển tiếp: từ khoá rỗng không bao giờ ra kết quả
  // nào, nên gửi tiếp chỉ tốn một vòng gọi cho mỗi phím khách xoá.
  if (q.length < 2) return NextResponse.json([]);

  const target = new URLSearchParams({ q });

  const limit = Number(params.get('limit'));
  if (Number.isInteger(limit) && limit > 0) {
    target.set('limit', String(Math.min(limit, MAX_LIMIT)));
  }

  try {
    const res = await fetch(`${API_BASE}/areas/suggest?${target}`, {
      headers: { Accept: 'application/json' },
      // Cùng một từ khoá được gõ lại rất nhiều (ai cũng tìm "quan 1"), và danh mục
      // hành chính gần như không đổi — nên cache được. Ngắn thôi: số KTV nằm trong
      // kết quả và nó thay đổi khi có hồ sơ mới được duyệt.
      next: { revalidate: 60 },
    });

    if (!res.ok) return NextResponse.json([], { status: 200 });

    return NextResponse.json(await res.json());
  } catch {
    // Ô gợi ý hỏng không được làm hỏng cả trang tìm kiếm: khách vẫn còn nút "Tìm
    // quanh tôi" và các link khu vực tĩnh. Trả rỗng để ô chỉ đơn giản là không gợi ý.
    return NextResponse.json([], { status: 200 });
  }
}
