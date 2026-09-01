import type { PackageType, WalletTransaction } from './types';

export function packageLabel(type: PackageType | string) {
  switch (type) {
    case 'VIP_PIN':
      return 'VIP Pin';
    case 'FEATURED_BADGE':
      return 'Huy hiệu nổi bật';
    case 'INSTANT_BOOST':
      return 'Instant Boost';
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
