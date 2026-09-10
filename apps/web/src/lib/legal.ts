import type { Locale } from '@/i18n/config';

/**
 * Danh tính pháp lý của bên vận hành, khai **đúng một lần** ở đây.
 *
 * Ba trang pháp lý (`/an-toan`, `/dieu-khoan`, `/chinh-sach-bao-mat`) đều phải nêu
 * cùng một pháp nhân, cùng một địa chỉ, cùng một đầu mối liên hệ. Rải chúng vào ba
 * file JSX — hay tệ hơn, vào i18n nơi mỗi ngôn ngữ giữ một bản — là dựng ba nguồn sự
 * thật cho thứ **phải** giống nhau tuyệt đối: một trang khai sai địa chỉ so với hai
 * trang kia thì cả ba mất giá trị chứng minh, mà không có gì báo đỏ.
 *
 * Cố ý KHÔNG nằm trong `i18n/*.ts` dù nó là chuỗi hiển thị: tên doanh nghiệp, MST và
 * địa chỉ đăng ký không dịch. Để chúng trong dictionary là mời một bản dịch "cho
 * thuận tai" đi vào đúng chỗ cần nguyên văn theo giấy phép.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  PHẢI ĐIỀN TRƯỚC KHI ĐƯA BA TRANG PHÁP LÝ LÊN PRODUCTION.                │
 * │                                                                          │
 * │  Các giá trị dưới đây là chỗ giữ chỗ. Nghị định 13/2023/NĐ-CP buộc nêu   │
 * │  rõ Bên Kiểm soát dữ liệu và đầu mối tiếp nhận yêu cầu của chủ thể dữ    │
 * │  liệu; một trang chính sách khai sai pháp nhân còn tệ hơn không có, vì   │
 * │  nó là lời khai chủ động chứ không phải sự thiếu sót.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export const LEGAL_ENTITY = {
  /** Tên đầy đủ theo giấy chứng nhận đăng ký doanh nghiệp. */
  name: '[TÊN ĐƠN VỊ VẬN HÀNH — CHƯA ĐIỀN]',
  /** Địa chỉ trụ sở đăng ký. */
  address: '[ĐỊA CHỈ TRỤ SỞ — CHƯA ĐIỀN]',
  /** Mã số doanh nghiệp / mã số thuế. */
  taxCode: '[MÃ SỐ DOANH NGHIỆP — CHƯA ĐIỀN]',
  /**
   * Đầu mối tiếp nhận yêu cầu về dữ liệu cá nhân (truy cập, chỉnh sửa, xoá, rút
   * đồng ý). Bắt buộc theo Nghị định 13/2023 và phải là hộp thư có người đọc thật —
   * một địa chỉ không ai mở biến quyền của chủ thể dữ liệu thành hình thức.
   */
  privacyEmail: '[EMAIL PHỤ TRÁCH DỮ LIỆU — CHƯA ĐIỀN]',
  /** Đầu mối hỗ trợ chung, dùng ở trang an toàn và điều khoản. */
  supportEmail: '[EMAIL HỖ TRỢ — CHƯA ĐIỀN]',
} as const;

/** True khi còn ít nhất một trường chưa điền — dùng để hiện cảnh báo lúc dev. */
export const LEGAL_ENTITY_INCOMPLETE = Object.values(LEGAL_ENTITY).some((v) =>
  v.includes('CHƯA ĐIỀN'),
);

/**
 * Ngày ba văn bản pháp lý có hiệu lực, dạng ISO.
 *
 * **Tăng ngày này mỗi khi nghĩa vụ đổi**, cùng nguyên tắc với
 * `KtvCommitments.CurrentVersion` ở backend: người đọc phải biết mình đang xem bản
 * nào. Khác ở chỗ bản cam kết KTV cần bằng chứng phía server (ai đồng ý bản nào, lúc
 * nào) còn ba trang này chỉ công bố — nên một ngày hiệu lực là đủ, không cần cột DB.
 *
 * Sửa lỗi chính tả thì giữ nguyên, đúng như quy ước của `CurrentVersion`.
 */
export const LEGAL_EFFECTIVE_DATE = '2026-09-10';

/** Ngày hiệu lực đã định dạng theo ngôn ngữ trang, ghim múi giờ Việt Nam. */
export const legalEffectiveDate = (locale: Locale) =>
  new Date(LEGAL_EFFECTIVE_DATE).toLocaleDateString(
    locale === 'vi' ? 'vi-VN' : 'en-GB',
    { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' },
  );
