export type AreaLevel = 'PROVINCE' | 'DISTRICT' | 'WARD';

/**
 * Giới tính KTV. Khớp `Genders` ở backend — hai giá trị, không có "khác": xem ghi chú
 * ở đó về lý do một giá trị thứ ba sẽ không bao giờ khớp bộ lọc nào.
 *
 * `null` nghĩa là **chưa khai** (hồ sơ tạo trước 2026-09-08), không phải "không tiết
 * lộ" — đừng hiện chữ nào cho nó.
 */
export type Gender = 'MALE' | 'FEMALE';

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
  /** Null cho hồ sơ chưa khai — thẻ không hiện chip nào, không hiện "Chưa rõ". */
  gender: Gender | null;
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
  /** URL ảnh đại diện, null khi KTV chưa đặt. Thẻ hiện chữ cái đầu tên thay thế. */
  avatarUrl: string | null;
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
  /**
   * Bản tiếng Anh, null khi chưa được dịch.
   *
   * Backend trả cả hai ngôn ngữ trong một payload thay vì nhận tham số locale:
   * đường đọc cache theo URL, nên `?locale=` sẽ tạo hai cache key cho cùng một dữ
   * liệu và nhân đôi lượt gọi backend mỗi khi ISR revalidate. Chọn cột nào là việc
   * của `lib/service-i18n.ts`.
   */
  nameEn: string | null;
  descriptionEn: string | null;
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

export interface KtvPhoto {
  id: string;
  url: string;
  /** Chú thích do KTV nhập, đi vào thuộc tính alt. */
  caption: string | null;
}

export interface PublicKtvProfile {
  id: string;
  fullName: string;
  slug: string;
  /** Null cho hồ sơ tạo trước 2026-09-08 chưa khai lại — không hiện chữ nào. */
  gender: Gender | null;
  yearsExperience: number;
  lat: number;
  lon: number;
  serviceRadiusKm: number;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  createdAt: string;
  /** URL ảnh đại diện, null khi KTV chưa đặt. */
  avatarUrl: string | null;
  /** Chỉ ảnh **đã duyệt** — ảnh chờ duyệt không bao giờ ra trang công khai. */
  photos: KtvPhoto[];
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

/**
 * Đánh giá do chính người đang đăng nhập viết.
 *
 * Khác `ReviewItem` ở hai chỗ, cả hai đều có lý do: kèm tên và slug KTV để dựng
 * link `/ktv/{slug}-{id}` mà không phải gọi thêm một lượt cho mỗi dòng, và có
 * `rejectionReason` vì người viết phải biết vì sao đánh giá của mình bị gỡ.
 */
export interface MyReview {
  id: string;
  ktvId: string;
  ktvFullName: string;
  ktvSlug: string;
  rating: number;
  comment: string | null;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
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
  /**
   * Null cho hồ sơ tạo trước 2026-09-08. Form sửa dùng chính giá trị null này để
   * bắt KTV khai lần đầu — nó không phải một trạng thái hợp lệ để giữ mãi.
   */
  gender: Gender | null;
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
  /** URL ảnh đại diện, null khi chưa đặt. */
  avatarUrl: string | null;
  /** **Mọi** trạng thái, khác trang công khai — chính chủ phải thấy ảnh đang chờ duyệt
   *  hoặc bị từ chối kèm lý do; nếu không nó chỉ lặng lẽ không xuất hiện. */
  photos: MyKtvPhoto[];
  certifications: MyCertification[];
  /** CCCD — null khi chưa gửi. Hồ sơ không duyệt được cho tới khi có và được xác minh. */
  identityDocument: MyIdentityDocument | null;
  /** Phiên bản cam kết đã chấp nhận. 0 nghĩa là chưa chấp nhận bản nào. */
  commitmentVersion: number;
  committedAt: string | null;
  /** Server tự so với bản đang hiệu lực — frontend không giữ con số đó. */
  commitmentsUpToDate: boolean;
  coverageAreas: { id: string; name: string; slug: string; level: AreaLevel }[] | null;
}

/**
 * Cộng tác viên nhìn từ trang quản trị.
 *
 * Hai con số đếm trả lời hai câu khác nhau: `referredCount` là "đã mời được bao nhiêu",
 * `verifiedCount` là "bao nhiêu người thật sự lên sàn" — và chỉ con số thứ hai đáng dùng
 * để tính hoa hồng.
 */
export interface AdminCollaborator {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  status: 'ACTIVE' | 'DISABLED';
  note: string | null;
  createdAt: string;
  referredCount: number;
  verifiedCount: number;
}

/**
 * Bản cam kết KTV, lấy từ backend.
 *
 * Nội dung **không** viết cứng ở frontend: đây là tài liệu pháp lý và cái cần chứng
 * minh khi tranh chấp là "đã đồng ý với đúng những dòng này". `version` đi kèm để lượt
 * xác nhận gắn được vào đúng bản người dùng vừa đọc.
 */
export interface KtvCommitments {
  version: number;
  items: string[];
}

/**
 * Ảnh CCCD của chính chủ.
 *
 * Hai mặt, **một** trạng thái duyệt: chúng là một tấm thẻ nên được duyệt cùng nhau.
 * URL là loại ký hạn ngắn (15 phút) — không bao giờ được đưa vào trang cache.
 */
export interface MyIdentityDocument {
  id: string;
  frontUrl: string;
  backUrl: string;
  verifyStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  submittedAt: string;
  verifiedAt: string | null;
}

export interface MyKtvPhoto {
  id: string;
  url: string;
  caption: string | null;
  sortOrder: number;
  verifyStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
}

/**
 * Chứng chỉ nhìn từ phía admin.
 *
 * Ít trường hơn `MyCertification`: hàng đợi duyệt chỉ cần biết tên, file để mở
 * xem, và trạng thái hiện tại — không cần tổ chức cấp hay ngày cấp, vốn nằm
 * trong chính file mà admin đang mở.
 */
export interface AdminCertification {
  id: string;
  name: string;
  fileUrl: string;
  verifyStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}

/** Hồ sơ KTV trong hàng đợi duyệt của admin. */
export interface AdminKtvProfile {
  id: string;
  fullName: string;
  slug: string;
  baseAddress: string | null;
  serviceRadiusKm: number;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
  certifications: AdminCertification[];
  /** Null khi KTV chưa gửi — hồ sơ đó **không duyệt được**. */
  identityDocument: AdminIdentityDocument | null;
  committedAt: string | null;
  /** Điều kiện bắt buộc thứ hai để duyệt được hồ sơ. */
  commitmentsUpToDate: boolean;
  /** Cộng tác viên đã mời KTV này. Null khi hồ sơ tự đến qua SEO — đó là đa số. */
  referredBy: { code: string; name: string; referredAt: string | null } | null;
}

/**
 * CCCD nhìn từ phía admin.
 *
 * Không có `id`: đường duyệt đi theo `ktvId` vì một hồ sơ có nhiều nhất một CCCD, nên
 * một định danh thứ hai chỉ thêm thứ để mang theo.
 */
export interface AdminIdentityDocument {
  frontUrl: string;
  backUrl: string;
  verifyStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  submittedAt: string;
}

export interface AdminKtvList {
  items: AdminKtvProfile[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Ảnh hồ sơ trong hàng đợi duyệt.
 *
 * Mang theo tên và slug KTV vì hàng đợi này xếp theo **ảnh**, không theo hồ sơ: một
 * hồ sơ đã duyệt vẫn thêm ảnh mới, nên ảnh ở đây không nhất thiết đi kèm một hồ sơ
 * đang chờ duyệt nào.
 */
export interface AdminKtvPhoto {
  id: string;
  ktvId: string;
  ktvName: string;
  ktvSlug: string;
  url: string;
  caption: string | null;
  verifyStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
}

export interface AdminKtvPhotoList {
  items: AdminKtvPhoto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Chứng chỉ trong hàng đợi duyệt riêng — khác `AdminCertification`, vốn là bản rút
 * gọn lồng trong một hồ sơ đang chờ duyệt.
 *
 * Mang theo tên và slug KTV vì cùng lý do với ảnh: hàng đợi này xếp theo **chứng
 * chỉ**, không theo hồ sơ. Một hồ sơ đã duyệt vẫn tải chứng chỉ mới lên bất cứ lúc
 * nào, nên chứng chỉ ở đây không nhất thiết thuộc về một hồ sơ đang chờ duyệt nào.
 *
 * Có cả nơi cấp và ngày cấp, khác bản lồng trong hồ sơ: ở đây admin **chỉ** thấy
 * chứng chỉ chứ không thấy phần hồ sơ xung quanh, nên hai trường đó là thứ đối chiếu
 * được với nội dung trên file.
 */
export interface AdminKtvCertification {
  id: string;
  ktvId: string;
  ktvName: string;
  ktvSlug: string;
  name: string;
  issuingOrg: string | null;
  issuedAt: string | null;
  fileUrl: string;
  verifyStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  createdAt: string;
}

export interface AdminKtvCertificationList {
  items: AdminKtvCertification[];
  total: number;
  page: number;
  limit: number;
}

/**
 * CCCD trong hàng đợi duyệt riêng — khác `AdminIdentityDocument`, vốn là bản lồng
 * trong một hồ sơ đang chờ duyệt và vì thế không cần nhắc lại KTV là ai.
 *
 * Có `id` (bản lồng thì không) vì hàng đợi cần khoá React ổn định, nhưng đường duyệt
 * vẫn đi theo `ktvId`: một hồ sơ có nhiều nhất một CCCD, và endpoint duyệt đã khai
 * theo `ktvId` từ đầu.
 *
 * `ktvVerificationStatus` là trạng thái của **hồ sơ**, không phải của CCCD. Nó có mặt
 * ở đây vì đó chính là thông tin admin cần để biết việc duyệt CCCD này còn mở ra bước
 * nào phía sau: hồ sơ đang PENDING thì duyệt xong CCCD là hồ sơ đủ điều kiện lên sóng,
 * còn hồ sơ đã VERIFIED thì đây chỉ là một lượt thay thẻ.
 */
export interface AdminKtvIdentityDocument {
  id: string;
  ktvId: string;
  ktvName: string;
  ktvSlug: string;
  ktvVerificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  frontUrl: string;
  backUrl: string;
  verifyStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  rejectionReason: string | null;
  submittedAt: string;
}

export interface AdminKtvIdentityDocumentList {
  items: AdminKtvIdentityDocument[];
  total: number;
  page: number;
  limit: number;
}

/** Lý do báo cáo — danh sách đóng, khớp `ProfileReportReasons` ở backend. */
export type ReportReason =
  | 'PROSTITUTION'
  | 'INAPPROPRIATE_CONTENT'
  | 'FALSE_INFORMATION'
  | 'IMPERSONATION'
  | 'MISCONDUCT'
  | 'OTHER';

export type ReportStatus = 'PENDING' | 'ACTION_TAKEN' | 'DISMISSED';

export interface AdminReport {
  id: string;
  ktvId: string;
  ktvFullName: string;
  ktvSlug: string;
  ktvVerificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  reporterUserId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

/**
 * `pendingReportCount` là số báo cáo **còn chờ** của cùng hồ sơ đó, kể cả dòng này —
 * và nó cố ý không đổi theo tab đang mở: khi admin xem danh sách đã xử lý, con số này
 * vẫn trả lời "hồ sơ đó hiện còn bao nhiêu việc chưa làm".
 */
export interface AdminReportQueueItem {
  report: AdminReport;
  pendingReportCount: number;
}

export interface AdminReportList {
  items: AdminReportQueueItem[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Một đánh giá nhìn từ hàng đợi rà soát.
 *
 * `hasLead` là **dấu hiệu, không phải bằng chứng**: khách bấm gọi lúc chưa đăng nhập
 * thì lead ẩn danh và không bao giờ khớp, nên rất nhiều đánh giá thật cũng có `false`.
 * Chiều ngược lại mới đáng tin. Đừng dựng luật tự động gỡ dựa trên cột này.
 */
export interface AdminReviewForModeration {
  id: string;
  ktvId: string;
  ktvFullName: string;
  ktvSlug: string;
  authorUserId: string;
  rating: number;
  comment: string | null;
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED';
  hasLead: boolean;
  /** Tài khoản được tạo bao lâu trước khi viết đánh giá này. Càng nhỏ càng đáng ngờ. */
  authorAccountAgeHours: number;
  createdAt: string;
}

export interface AdminReviewList {
  items: AdminReviewForModeration[];
  total: number;
  page: number;
  limit: number;
}

/** Doanh thu ròng của một khu vực với một loại gói. Có thể **âm** khi hoàn nhiều hơn bán. */
export interface AdminRevenueRow {
  areaId: string;
  areaName: string;
  packageType: string;
  netRevenue: number;
  transactions: number;
}

/** Ngày theo **giờ Việt Nam**. Chỉ có ngày phát sinh giao dịch — ngày trống không có dòng. */
export interface AdminRevenueDay {
  date: string;
  netRevenue: number;
}

export interface AdminRevenueReport {
  from: string;
  to: string;
  total: number;
  items: AdminRevenueRow[];
  daily: AdminRevenueDay[];
}
