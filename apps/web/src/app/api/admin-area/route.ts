import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { LOCALES } from '@/i18n/config';
import { API_BASE, getSessionToken } from '@/lib/session';
import { areaPath } from '@/lib/site';

/**
 * Ghi nội dung biên tập cho khu vực, rồi làm mất hiệu lực cache của trang công khai.
 *
 * **Vì sao không dùng thẳng `/api/proxy`:** đây là lần thứ **năm** của cái bẫy
 * `revalidatePath` — sau `/api/reviews`, `/api/ktv-media`, `/api/admin-verify` và
 * `/api/ktv-profile`. Trang khu vực là ISR, nên viết xong nội dung mà không xoá cache
 * thì trang vẫn phục vụ bản dựng trước đó: admin thấy "đã lưu", còn trang công khai
 * vẫn trống và vẫn mang `noindex`.
 *
 * **Lần này nặng hơn bốn lần trước ở một điểm:** nội dung biên tập là vế thứ hai của
 * điều kiện index, nên nó đổi cả `sitemap.xml` chứ không chỉ nội dung một trang. Thẻ
 * robots và sitemap **phải nói cùng một điều** — một trang khai `index` trong HTML mà
 * vắng mặt trong sitemap (hoặc ngược lại) là site tự mâu thuẫn với chính mình trước
 * Googlebot. Vì vậy route này xoá cache **ba** thứ, không phải một.
 *
 * `revalidatePath` chỉ gọi được từ server nên nó phải là một route handler.
 */

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export async function PATCH(request: Request) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Phiên đăng nhập đã hết hạn' }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? '';

  if (!UUID.test(id)) {
    return NextResponse.json({ message: 'Thao tác không hợp lệ' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/admin/areas/${id}/editorial`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: await request.text(),
    cache: 'no-store',
  });

  const text = await res.text();

  if (res.ok) {
    // Slug lấy từ **response của backend**, không từ tham số client gửi lên. Cùng lý do
    // đã ghi ở `/api/ktv-profile`: để phía gọi tự dựng đường dẫn là mở đúng chỗ mà
    // `ProfileMediaSection` từng ghim `'vi'` rồi bỏ quên bản `/en`. Ở đây còn một vế
    // nữa — cặp slug tỉnh/quận phải đi cùng nhau, và backend là bên duy nhất biết chắc
    // khu vực này là tỉnh hay quận.
    try {
      const data = JSON.parse(text) as { provinceSlug?: string; districtSlug?: string | null };

      if (data.provinceSlug) {
        for (const locale of LOCALES) {
          // Trang của chính khu vực vừa sửa.
          revalidatePath(areaPath(locale, data.provinceSlug, data.districtSlug ?? undefined));

          // Trang tỉnh cha khi vừa sửa một quận: nó liệt kê các quận con kèm trạng thái,
          // nên nội dung mới của quận đổi cả trang cha. Bỏ qua bước này để lại một danh
          // sách nói rằng quận đó vẫn chưa có gì.
          if (data.districtSlug) {
            revalidatePath(areaPath(locale, data.provinceSlug));
          }
        }
      }
    } catch {
      // Body không phải JSON hợp lệ thì bỏ qua phần xoá cache, **không** làm hỏng lời
      // gọi: backend đã ghi thành công rồi. Cache tự hết hạn sau chu kỳ ISR.
    }

    // Sitemap khai đúng những trang được index, mà cờ đó vừa có thể đổi. Không dùng
    // LOCALES ở đây: `sitemap.xml` là một route duy nhất chứa cả hai ngôn ngữ.
    revalidatePath('/sitemap.xml');
  }

  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
