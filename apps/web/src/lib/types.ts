export type AreaLevel = 'PROVINCE' | 'DISTRICT' | 'WARD';

export interface AreaNode {
  id: string;
  name: string;
  slug: string;
  level: AreaLevel;
  ktvCount: number;
  /** Backend quyết định ngưỡng index, frontend không tự so sánh với con số riêng. */
  indexable: boolean;
  children: AreaNode[];
}

export interface AreaDetail extends Omit<AreaNode, 'children'> {
  parent: AreaNode | null;
  children: AreaNode[];
  siblings: AreaNode[];
  stats: AreaStats;
}

/**
 * Số liệu tóm tắt của một khu vực — nội dung riêng cho phần đầu trang landing.
 *
 * Mọi trường đều nullable: khu vực chưa có KTV nào khai giá hay chưa ai đánh giá
 * là trạng thái bình thường, không phải lỗi. Trang phải đọc được khi cả ba đều rỗng.
 */
export interface AreaStats {
  priceFromMin: number | null;
  priceFromMax: number | null;
  ratingAvg: number | null;
  ratingCount: number;
  topServiceName: string | null;
}

/**
 * Một dòng gợi ý trong ô tìm khu vực.
 *
 * Luôn mang đủ vế cha, và đó là điểm khác biệt so với việc lọc trên cây khu vực ở
 * client: slug quận chỉ duy nhất **trong phạm vi tỉnh** — cả nước có 10 tỉnh cùng
 * chứa "Huyện Châu Thành" — nên một slug trần không dựng được URL đúng.
 */
export interface AreaSuggestion {
  id: string;
  name: string;
  slug: string;
  level: AreaLevel;
  /** Null khi chính nó là tỉnh. */
  provinceSlug: string | null;
  /** Chỉ có khi `level` là WARD. */
  districtSlug: string | null;
  /** Đường dẫn cha đã dựng sẵn để hiển thị ("Quận 1, TP. Hồ Chí Minh"). */
  parentPath: string;
  ktvCount: number;
  indexable: boolean;
}

export interface SearchItem {
  id: string;
  fullName: string;
  slug: string;
  yearsExperience: number;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  /** Null khi tìm theo khu vực (không có toạ độ khách). */
  distanceM: number | null;
  boostPoints: number;
  baseScore: number;
  score: number;
  lat: number;
  lon: number;
  /** Giới thiệu ngắn; thẻ tự cắt bớt khi dài. */
  bio: string | null;
  /** Chỉ đếm chứng chỉ đã duyệt — hồ sơ chờ xét không được tính. */
  verifiedCertCount: number;
  /** Tối đa 2 dịch vụ, giá thấp trước. Rỗng khi KTV chưa khai. */
  services: SearchItemService[];
}

export interface SearchItemService {
  name: string;
  durationMin: number;
  /** Giá khởi điểm KTV công bố, không phải giá chốt. */
  priceFrom: number;
}

export interface SearchResponse {
  items: SearchItem[];
  page: number;
  size: number;
  total: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  /** Giá thấp nhất đang có trên sàn. null khi chưa KTV nào khai giá cho dịch vụ này. */
  priceFrom: number | null;
}

/**
 * Số liệu toàn sàn cho đầu trang chủ.
 *
 * ratingAvg null khi chưa có đánh giá nào — sàn mới mở là trạng thái bình thường,
 * không phải lỗi.
 */
export interface SiteStats {
  verifiedKtvCount: number;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface KtvServiceItem {
  serviceId: string;
  name: string;
  slug: string;
  priceFrom: number;
  durationMin: number;
}

export interface PublicKtvProfile {
  id: string;
  fullName: string;
  slug: string;
  bio: string | null;
  yearsExperience: number;
  lat: number;
  lon: number;
  serviceRadiusKm: number;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  createdAt: string;
  certifications: {
    id: string;
    name: string;
    issuingOrg: string | null;
    issuedAt: string | null;
  }[];
  coverageAreas: { id: string; name: string; slug: string; level: AreaLevel; provinceSlug: string | null }[];
  services: KtvServiceItem[];
}

export interface ReviewItem {
  id: string;
  ktvId: string;
  rating: number;
  comment: string | null;
  status: string;
  createdAt: string;
}

export interface ReviewList {
  items: ReviewItem[];
  page: number;
  size: number;
  total: number;
}

export interface Sitemap {
  ktv: { path: string; lastModified: string }[];
  areas: { path: string; province: string; district: string | null; ktvCount: number }[];
  services: { path: string }[];
  minKtvForIndex: number;
}

/**
 * Số liệu 7 ngày cho dashboard KTV.
 *
 * Hai trường phần trăm nullable và phải được xử lý: tuần đầu của mọi KTV đều chưa
 * có tuần trước để so, và hồ sơ chưa ai xem thì không có mẫu số cho tỉ lệ liên hệ.
 */
export interface KtvStats {
  profileViews: number;
  /** null khi tuần trước bằng 0 — không có phần trăm nào đúng ở đó. */
  profileViewsChangePct: number | null;
  leads: number;
  /** null khi chưa có lượt xem nào. */
  leadRatePct: number | null;
  /**
   * Số lần hồ sơ xuất hiện trong kết quả tìm kiếm. Bậc đầu của phễu và là thứ gói
   * đẩy tin trực tiếp mua — thiếu nó thì KTV chỉ thấy "ít khách" mà không biết mình
   * không được hiện ra, hay được hiện ra mà không ai bấm.
   */
  impressions: number;
  /** null khi tuần trước bằng 0. */
  impressionsChangePct: number | null;
  /** Trong số lần hiện ra, bao nhiêu phần trăm dẫn tới mở hồ sơ. null khi chưa hiện ra lần nào. */
  clickRatePct: number | null;
}

export interface WalletBalance {
  balance: number;
  /** Đang bị giữ cho lần mua chưa chốt — nằm trong `balance`, không cộng thêm. */
  held: number;
  available: number;
}

export interface WalletTransaction {
  id: string;
  type: 'TOPUP' | 'CAPTURE' | 'REFUND' | 'ADJUST';
  /** Có dấu: dương là tiền vào, âm là tiền ra. */
  amount: number;
  balanceAfter: number;
  campaignId: string | null;
  createdAt: string;
}

export interface WalletTransactionList {
  items: WalletTransaction[];
  page: number;
  size: number;
  total: number;
}

export type PackageType = 'VIP_PIN' | 'FEATURED_BADGE' | 'INSTANT_BOOST';

export interface PromotionPackage {
  id: string;
  code: string;
  name: string;
  type: PackageType;
  price: number;
  durationDays: number;
  /**
   * Chỉ có ở gói bán theo **khung giờ** (Instant Boost); gói theo ngày để null.
   * Phải hiển thị theo đúng đơn vị của gói: một gói 3 giờ mà ghi "1 ngày" là bán
   * sai thứ khách trả tiền — DB ép bất biến này bằng CHECK chk_package_duration_unit.
   */
  durationHours: number | null;
  /** Khung giờ gói bắt đầu chạy. Chỉ có nghĩa với gói theo giờ. */
  startsAt: string | null;
  maxSlotsPerArea: number;
  boostPoints: number;
  /**
   * Gói này có thật sự đảm bảo đứng trên KTV miễn phí hay không. Backend tính,
   * frontend hiển thị nguyên trạng — bán kèm một lời hứa hệ thống không giữ được
   * là cách mất niềm tin nhanh nhất.
   */
  guaranteesTopPlacement: boolean;
  /** Null khi không truyền areaId. */
  freeSlots: number | null;
}

export interface Campaign {
  id: string;
  areaId: string;
  packageType: PackageType;
  boostPoints: number;
  pricePaid: number;
  startAt: string;
  endAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  refundedAmount: number;
  isRunning: boolean;
}


export interface MyCertification {
  id: string;
  name: string;
  issuingOrg: string | null;
  issuedAt: string | null;
  fileUrl: string;
  verifyStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
}

/**
 * Hồ sơ nhìn từ phía chủ tài khoản.
 *
 * Khác bản công khai ở ba chỗ: có lý do bị từ chối (ghi chú giữa admin và KTV),
 * có mọi chứng chỉ kể cả chưa duyệt, và toạ độ **không** làm tròn — form sửa cần
 * đúng điểm đã lưu, nếu không mỗi lần bấm lưu vị trí lại dịch đi một chút.
 */
export interface MyKtvProfile {
  id: string;
  fullName: string;
  slug: string;
  bio: string | null;
  yearsExperience: number;
  basePoint: { type: 'Point'; coordinates: [number, number] };
  baseAddress: string | null;
  serviceRadiusKm: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  createdAt: string;
  certifications: MyCertification[];
  coverageAreas: { id: string; name: string; slug: string; level: AreaLevel }[] | null;
}
