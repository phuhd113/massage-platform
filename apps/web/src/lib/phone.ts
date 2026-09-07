/**
 * Chuẩn hoá số điện thoại Việt Nam về đúng dạng backend nhận: `0xxxxxxxxx`.
 *
 * Tồn tại vì một lỗi thật đã gặp: ô nhập hiển thị "+84" như một nhãn tĩnh bên trái
 * nhưng **không** gửi nó đi, còn placeholder lại gợi ý "901 234 567". Người dùng làm
 * đúng như được gợi ý, và chuỗi gửi lên là "901 234 567" — có dấu cách, thiếu số 0
 * đầu. Regex của backend (`^(0|\+84)(3|5|7|8|9)\d{8}$`) từ chối, FluentValidation trả
 * 400, và form map 400 thành "Sai quá nhiều lần nên tài khoản tạm khoá" — một câu
 * hoàn toàn không liên quan tới việc vừa xảy ra.
 *
 * Chuẩn hoá ở **đường gửi**, không phải lúc gõ: sửa giá trị dưới tay người đang gõ
 * làm nhảy con trỏ và chặn cả những bước gõ dở dang hợp lệ.
 *
 * Không tự ý thêm "0" cho chuỗi 9 chữ số bắt đầu bằng đầu số hợp lệ: `0` đứng đầu là
 * một phần của số, không phải thứ suy ra được — đoán ở đây là âm thầm gửi đi một số
 * khác số người dùng định nhập. Việc bỏ nhãn "+84" khỏi giao diện mới là cách sửa
 * gốc; hàm này chỉ dọn những biến thể *không đổi nghĩa* của cùng một số.
 */
export function normalizePhone(raw: string): string {
  // Bỏ mọi ký tự phân cách người dùng gõ hoặc trình duyệt tự điền: dấu cách, chấm,
  // gạch nối, ngoặc. Chúng không mang thông tin nhưng đủ để regex backend từ chối.
  const cleaned = raw.replace(/[\s.\-()]/g, '');

  // "+84..." và "84..." là cùng một số với "0..." — quy về một dạng để một người
  // không tạo được hai tài khoản, đúng như `AuthService.NormalizePhone` phía backend.
  if (cleaned.startsWith('+84')) return '0' + cleaned.slice(3);
  if (cleaned.startsWith('84') && cleaned.length === 11) return '0' + cleaned.slice(2);

  return cleaned;
}

/**
 * Số di động VN hợp lệ, khớp đúng `PhoneRules.VnPhonePattern` của backend.
 *
 * Dùng cho `pattern` của input để trình duyệt chặn ngay tại chỗ, kèm câu giải thích
 * bằng ngôn ngữ của trang (xem `use-form-validation.ts`) — thay vì để người dùng
 * gửi đi rồi nhận một lỗi HTTP đã bị map sai.
 */
export const VN_PHONE_PATTERN = '0[35789][0-9]{8}';
