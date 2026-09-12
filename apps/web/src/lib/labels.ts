import type { PackageType, WalletTransaction } from './types';

/**
 * Tên hạng gói **đọc ra hiểu ngay bằng tiếng Việt**, không giữ tên mã tiếng Anh.
 *
 * Trước đây là "VIP Pin" và "Instant Boost" — tên nội bộ lọt ra mặt KTV. Người đọc
 * bảng giá là kỹ thuật viên người Việt đang quyết định trả tiền, mà "Pin" đọc ra là
 * *cục pin* chứ không phải *ghim*, còn "Instant Boost" không nói được nó bán theo
 * **giờ**: đúng cái lỗi đã ghi trong quy ước — gói theo giờ mà hiển thị như gói theo
 * ngày là bán sai thứ khách trả tiền.
 *
 * Tên mã (`VIP_PIN`, `INSTANT_BOOST`, ...) **giữ nguyên** ở DB, API và URL: chúng nằm
 * trong khoá `UNIQUE (area_id, package_type, window_start, slot_index)` và trong mọi
 * campaign đã bán. Chỉ lớp chữ hiển thị đổi, và chỉ đổi ở đúng một chỗ này.
 */
export function packageLabel(type: PackageType | string) {
  switch (type) {
    case 'VIP_PIN':
      return 'Ghim đầu trang';
    case 'FEATURED_BADGE':
      return 'Huy hiệu nổi bật';
    case 'INSTANT_BOOST':
      return 'Đẩy hạng theo giờ';
    default:
      return type;
  }
}

/**
 * Nhãn cho từng loại bút toán, viết theo góc nhìn của KTV chứ không theo tên kỹ
 * thuật trong DB: người đọc sổ muốn biết "tiền đi đâu", không muốn tra CAPTURE
 * nghĩa là gì.
 */
export function transactionLabel(type: WalletTransaction['type']) {
  switch (type) {
    case 'TOPUP':
      return 'Nạp tiền';
    case 'CAPTURE':
      return 'Mua gói đẩy tin';
    case 'REFUND':
      return 'Hoàn tiền huỷ gói';
    case 'ADJUST':
      return 'Điều chỉnh';
    default:
      return type;
  }
}

export function campaignStatusLabel(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'Đang chạy';
    case 'EXPIRED':
      return 'Đã hết hạn';
    case 'CANCELLED':
      return 'Đã huỷ';
    default:
      return status;
  }
}
