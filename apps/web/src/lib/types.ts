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
