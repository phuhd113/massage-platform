import { NextResponse } from 'next/server';
import { API_BASE } from '@/lib/session';
import type { AreaDetail, DistrictOption } from '@/lib/types';

/**
 * Danh sách quận/huyện của một tỉnh — cho chế độ "chọn cả tỉnh rồi tick nhiều quận"
 * ở ô khai khu vực nhận phục vụ.
 *
 * Không dùng lại `/api/proxy/[...path]`: cùng lý do đã ghi ở `/api/areas/suggest` —
 * proxy đó sinh ra cho dashboard và trả 401 khi thiếu cookie phiên. Ở đây thì ngược
 * lại: route này *được* gọi từ dashboard KTV (đã đăng nhập), nhưng dữ liệu hành chính
 * là công khai và không phụ thuộc người gọi, nên đi qua proxy có phiên chỉ thêm một
 * ràng buộc không mua được gì.
 *
 * **Chỉ trả `id`/`name`/`slug` của các quận.** Backend `GET /areas/{tinh}` trả kèm
 * `stats` (giá thấp nhất, rating trung bình — gộp từ mọi quận trực thuộc) và cả
 * `siblings`; ô chọn khu vực không đọc trường nào trong số đó. Chuyển tiếp nguyên
 * payload là chở vài KB thừa mỗi lần KTV mở một tỉnh, cho một ô tick.
 */

export async function GET(request: Request) {
  const slug = (new URL(request.url).searchParams.get('province') ?? '').trim();

  // Chặn ở biên thay vì chuyển tiếp: chuỗi rỗng sẽ khớp route `GET /areas/` của
  // backend (tức cây toàn quốc, ~759 khu vực) chứ không trả 404 như trực giác —
  // một lỗi đọc ra là "ô tick tự nhiên chậm" chứ không như một tham số thiếu.
  if (!slug) return NextResponse.json([], { status: 200 });

  try {
    const res = await fetch(`${API_BASE}/areas/${encodeURIComponent(slug)}`, {
      headers: { Accept: 'application/json' },
      // Danh mục hành chính gần như không đổi, và một tỉnh được mở đi mở lại nhiều
      // lần trong cùng một lượt điền form. Cache dài hơn `/areas/suggest` (60s) vì
      // ở đây ta chỉ lấy id/tên/slug — không chở `ktvCount`, thứ đổi khi có hồ sơ
      // mới được duyệt và là lý do ô gợi ý phải để cache ngắn.
      next: { revalidate: 3600 },
    });

    if (!res.ok) return NextResponse.json([], { status: 200 });

    const data = (await res.json()) as AreaDetail;

    return NextResponse.json(
      (data.children ?? []).map(
        (d): DistrictOption => ({ id: d.id, name: d.name, slug: d.slug }),
      ),
    );
  } catch {
    // Hỏng thì trả rỗng chứ không lỗi: ô gõ tìm theo tên vẫn là đường chính và vẫn
    // chạy, nên một sự cố ở đây chỉ làm mất lối tắt chứ không chặn KTV khai hồ sơ.
    return NextResponse.json([], { status: 200 });
  }
}
