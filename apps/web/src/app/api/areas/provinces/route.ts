import { NextResponse } from 'next/server';
import { API_BASE } from '@/lib/session';
import type { AreaNode, DistrictOption } from '@/lib/types';

/**
 * Danh sách 63 tỉnh/thành cho ô thả xuống ở khối khai khu vực nhận phục vụ.
 *
 * **Cắt `children` trước khi trả về, và đó là lý do route này tồn tại.** Backend
 * `GET /areas` trả cây đầy đủ — đo được **124 KB**, vì mỗi tỉnh chở theo toàn bộ
 * quận trực thuộc. Ô thả xuống chỉ cần tên và slug của tỉnh; chuyển tiếp nguyên cây
 * là chở lại đúng khối dữ liệu đã bị gỡ khỏi trang hồ sơ trước đây vì quá nặng, chỉ
 * khác là lần này đi qua một URL khác. Sau khi cắt còn ~4 KB.
 *
 * Quận của tỉnh được chọn tải riêng qua `/api/areas/districts` — một tỉnh mỗi lần,
 * chỉ khi KTV thật sự mở nó.
 */

/**
 * **Bắt buộc.** Route này không đọc tham số nào, nên Next coi nó là tĩnh và *chạy nó
 * lúc build* rồi đóng băng kết quả vào image. Lúc build thì backend không chạy (CI cố
 * ý không dựng cả stack để đóng gói frontend — xem ghi chú `ƒ (Dynamic)` trong
 * CLAUDE.md), nên `catch` bên dưới trả `[]` và **mảng rỗng đó thành câu trả lời vĩnh
 * viễn**: ô thả xuống trống ở mọi lượt tải, trong khi backend vẫn khoẻ và route vẫn
 * trả HTTP 200.
 *
 * Đã cắn đúng ca này khi làm — dấu vết là file `.next/server/app/api/areas/provinces.body`
 * chứa sẵn `[]`. `/api/areas/districts` không dính vì nó đọc query string nên luôn động.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/areas`, {
      headers: { Accept: 'application/json' },
      // Danh mục 63 tỉnh gần như bất biến, và ở đây ta bỏ luôn `ktvCount` — thứ duy
      // nhất trong payload có thể đổi trong ngày. Cache dài như `/areas/districts`.
      next: { revalidate: 3600 },
    });

    if (!res.ok) return NextResponse.json([], { status: 200 });

    const data = (await res.json()) as AreaNode[];

    return NextResponse.json(
      data.map((p): DistrictOption => ({ id: p.id, name: p.name, slug: p.slug })),
    );
  } catch {
    // Trả rỗng thay vì lỗi: ô thả xuống rỗng đã tự nói lên vấn đề, và khối này không
    // được phép làm hỏng cả form hồ sơ.
    return NextResponse.json([], { status: 200 });
  }
}
