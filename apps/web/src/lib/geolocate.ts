/**
 * Xin vị trí GPS của khách — một chỗ duy nhất cho cả bốn nút gọi tới nó.
 *
 * Gom vào đây vì bốn nơi gọi (`HeroSearch`, `LocationNavButton`, `SearchFilters`,
 * `ProfileForm`) từng có bốn bản `getCurrentPosition` chép tay, và chúng đã trôi
 * khỏi nhau đúng ở chỗ tốn kém nhất: chỉ `ProfileForm` khai `enableHighAccuracy`,
 * nên ba nút của khách chạy được trên máy tính nhưng hỏng trên điện thoại.
 *
 * Vì sao `enableHighAccuracy: true` là bắt buộc chứ không phải tinh chỉnh:
 * để `false` (mặc định) thì trình duyệt di động chỉ hỏi nguồn định vị theo
 * Wi-Fi/mạng di động và **không bao giờ bật GPS**. Cơ sở dữ liệu Wi-Fi của Google
 * thưa ở Việt Nam ngoài vài quận trung tâm, nên nguồn đó trả `POSITION_UNAVAILABLE`
 * trong khi GPS của chính máy đó vẫn hoạt động bình thường. Trên laptop lỗi này
 * không tái hiện được — máy tính định vị bằng IP nên luôn trả về một toạ độ.
 *
 * `timeout` 30 giây, không phải 10: lần định vị đầu tiên của một máy chưa dùng GPS
 * gần đây (cold start) cần 20–30 giây để bắt đủ vệ tinh. 10 giây cắt ngang gần như
 * mọi lần bấm đầu tiên ngoài trời, và khách đọc được đúng câu "chưa lấy được vị trí"
 * dù máy họ hoàn toàn bình thường.
 *
 * `maximumAge` 5 phút: nếu máy vừa định vị xong cho một app khác thì dùng lại kết
 * quả đó, trả lời tức thì thay vì bắt bật lại GPS. Trong 5 phút khách không đi đủ
 * xa để đổi quận, mà đây chỉ là điểm bắt đầu cho một vòng tìm kiếm theo bán kính.
 */
const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 30_000,
  maximumAge: 300_000,
};

/**
 * Loại lỗi định vị, tách theo **việc khách phải làm tiếp**, không theo mã của chuẩn.
 *
 * `TIMEOUT` và `UNAVAILABLE` gộp làm một (`unavailable`) vì cách xử lý giống hệt
 * nhau: thử lại, hoặc ra chỗ thoáng. Tách chúng chỉ để trung thành với spec sẽ đẻ
 * thêm một câu chữ mà không đổi được hành động nào.
 *
 * Ngược lại `denied` **phải** đứng riêng: thử lại bao nhiêu lần cũng vô ích vì trình
 * duyệt đã nhớ lựa chọn và không hỏi lại nữa. Khách phải vào phần cài đặt quyền —
 * mà nếu ta hiện chung một câu "chưa lấy được vị trí" thì họ không có cách nào biết
 * điều đó. Đây chính là chỗ bản cũ hỏng: nó nhận callback `() => {}` không tham số,
 * vứt luôn đối tượng lỗi, nên ba nguyên nhân khác nhau ra cùng một câu.
 */
export type GeoErrorKind = 'unsupported' | 'denied' | 'unavailable';

export interface GeoLabels {
  unsupported: string;
  denied: string;
  unavailable: string;
}

/** Chọn câu thông báo theo loại lỗi. Gom ở đây để bốn nơi gọi không tự map lệch nhau. */
export function geoErrorMessage(kind: GeoErrorKind, labels: GeoLabels): string {
  return labels[kind];
}

/**
 * Bọc `getCurrentPosition` thành Promise, luôn `resolve` — không bao giờ `reject`.
 *
 * Không lấy được vị trí là một **kết quả bình thường** ở đây (khách từ chối quyền,
 * đang ở trong hầm, mở từ webview của Zalo), không phải sự cố. Trả lỗi qua kênh
 * exception sẽ buộc mọi nơi gọi phải bọc try/catch, và chỗ nào quên thì thành một
 * unhandled rejection trong console của khách thật.
 */
export function getPosition(): Promise<
  { ok: true; coords: GeolocationCoordinates } | { ok: false; kind: GeoErrorKind }
> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, kind: 'unsupported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, coords: pos.coords }),
      (err) =>
        resolve({
          ok: false,
          // So bằng hằng số của chính đối tượng lỗi chứ không phải số 1: Safari cũ
          // từng phát ra mã khác cho cùng tình huống, và hằng số thì luôn khớp với
          // implementation đang chạy.
          kind: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
        }),
      GEO_OPTIONS,
    );
  });
}
