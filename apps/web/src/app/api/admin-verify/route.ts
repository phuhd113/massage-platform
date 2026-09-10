import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { LOCALES } from '@/i18n/config';
import { API_BASE, getSessionToken } from '@/lib/session';
import { ktvPath } from '@/lib/site';

/**
 * Quyết định duyệt của admin, rồi làm mất hiệu lực cache trang hồ sơ công khai.
 *
 * **Vì sao không dùng thẳng `/api/proxy`:** cùng cái bẫy mà `/api/reviews` và
 * `/api/ktv-media` đã ghi lại, và nó đã cắn lần thứ ba ở đúng đây. Trang hồ sơ là ISR
 * 600 giây, nên admin duyệt xong một chứng chỉ thì trang công khai vẫn phục vụ bản
 * dựng trước đó — không có chứng chỉ nào. Nhìn từ mọi phía đều như việc duyệt không
 * có tác dụng: admin thấy trạng thái đã đổi thành "Đã duyệt", KTV mở hồ sơ mình vẫn
 * không thấy gì. Đã đo được: xoá `.next/cache/fetch-cache` thì chứng chỉ hiện ra ngay.
 *
 * Vì sao nó nguy hiểm hơn hai lần trước: ở đó người vừa thao tác cũng là người xem
 * kết quả, nên họ ít nhất *biết* là có gì đó không ổn. Ở đây admin và KTV là hai
 * người khác nhau ngồi hai chỗ khác nhau, nên không ai ở vị trí nhìn thấy mâu thuẫn.
 *
 * `revalidatePath` chỉ gọi được từ server nên nó phải là một route handler.
 */

/**
 * Các đường duyệt được phép, khai tường minh.
 *
 * Đây là chuỗi đi thẳng vào URL của backend, nên không nhận đường dẫn tự do: một
 * tham số mở ở đây là để client tự chọn endpoint admin nào sẽ được gọi kèm token
 * admin thật.
 *
 * `profile` có mặt vì duyệt hồ sơ cũng đổi nội dung trang công khai — hồ sơ chuyển
 * sang VERIFIED là lần đầu trang đó tồn tại, và gỡ xuống thì nó phải biến mất.
 */
const TARGETS: Record<string, (id: string) => string> = {
  certification: (id) => `admin/certifications/${id}/verify`,
  photo: (id) => `admin/photos/${id}/verify`,
  profile: (id) => `admin/ktv/${id}/verify`,
  // Avatar định danh theo **ktvId**, không phải id của bản ghi ảnh: nó là cột trên
  // `ktv_profiles`, một hồ sơ nhiều nhất một ảnh đang chờ. Duyệt nó đổi tấm ảnh lớn nhất
  // trên trang công khai, nên nó bắt buộc phải đi qua đây chứ không phải `/api/proxy`.
  avatar: (id) => `admin/ktv/${id}/avatar/verify`,
  // Kiểm duyệt đánh giá đổi **hai** thứ trên trang công khai: nội dung đánh giá, và
  // `rating_avg`/`rating_count` được tính lại. Vế thứ hai là lý do nó bắt buộc phải
  // nằm ở đây — điểm sao hiện trên thẻ tìm kiếm lẫn structured data `AggregateRating`,
  // nên một bản dựng cũ khai điểm không còn đúng ra cho cả Google đọc.
  review: (id) => `admin/reviews/${id}/moderate`,
};

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Slug chỉ gồm chữ thường, số và gạch ngang — nó đi vào đường dẫn được xoá cache. */
const SLUG = /^[a-z0-9-]{1,120}$/;

export async function PATCH(request: Request) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Phiên đăng nhập đã hết hạn' }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = TARGETS[url.searchParams.get('target') ?? ''];
  const id = url.searchParams.get('id') ?? '';

  if (!target || !UUID.test(id)) {
    return NextResponse.json({ message: 'Thao tác không hợp lệ' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/${target(id)}`, {
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

  // Chỉ xoá cache khi backend đã nhận thật. Xoá sau một lượt hỏng là bỏ đi bản dựng
  // sẵn của một trang SEO mà không đổi lại được gì.
  //
  // Xoá cho **mọi ngôn ngữ**: bản `/en` là một đường dẫn riêng với cache riêng, nên
  // chỉ xoá bản tiếng Việt sẽ để trang tiếng Anh giữ nội dung cũ thêm 10 phút nữa —
  // một nửa số trang hỏng, và là nửa ít người mở nên lâu mới lộ.
  const ktvId = url.searchParams.get('ktvId');
  const ktvSlug = url.searchParams.get('ktvSlug');

  if (res.ok && ktvId && ktvSlug && UUID.test(ktvId) && SLUG.test(ktvSlug)) {
    for (const locale of LOCALES) {
      revalidatePath(ktvPath(locale, ktvSlug, ktvId));
    }
  }

  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
