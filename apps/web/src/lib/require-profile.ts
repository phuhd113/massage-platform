import { redirect } from 'next/navigation';
import { UnauthenticatedError, authFetchOrNull } from '@/lib/session';
import type { MyKtvProfile } from '@/lib/types';

/** Đường dẫn trang hồ sơ — nơi KTV chưa có hồ sơ bị đưa về. */
export const PROFILE_PATH = '/dashboard/ho-so';

/**
 * Bắt buộc có hồ sơ KTV trước khi vào các trang dashboard khác.
 *
 * Chưa tạo hồ sơ thì mọi trang còn lại đều rỗng hoặc vô nghĩa: ví chưa dùng được vào
 * việc gì (mua gói đòi hồ sơ đã duyệt), không có chiến dịch nào, tổng quan không có
 * số liệu. Đưa thẳng về trang hồ sơ thay vì để KTV tự đoán phải bắt đầu từ đâu.
 *
 * **Điều kiện là "đã tạo hồ sơ", không phải "đã được duyệt".** Duyệt phụ thuộc admin
 * xem CCCD bằng mắt; lấy VERIFIED làm điều kiện là nhốt KTV đã làm xong phần việc của
 * mình ở ngoài dashboard nhiều giờ, và nhốt vĩnh viễn người bị từ chối — trong khi
 * việc họ cần làm lúc đó (sửa hồ sơ, gửi lại CCCD) nằm ở đúng trang này.
 *
 * **Trả về hồ sơ luôn** thay vì chỉ `void`: trang gọi nó gần như luôn cần chính dữ
 * liệu đó, và tách làm hai lời gọi là bắt backend trả lời hai lần cho cùng câu hỏi.
 *
 * Chỉ dùng cho **trang dashboard khác trang hồ sơ**. Bản thân `/dashboard/ho-so` phải
 * nhận `null` bình thường — đó là nơi hồ sơ được tạo, chặn ở đó là một vòng lặp kín.
 */
export async function requireKtvProfile(): Promise<MyKtvProfile> {
  let profile: MyKtvProfile | null;

  try {
    profile = await authFetchOrNull<MyKtvProfile>('/ktv/profile/me');
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect('/dang-nhap');
    throw err;
  }

  if (!profile) redirect(PROFILE_PATH);
  return profile;
}
