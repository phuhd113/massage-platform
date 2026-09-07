import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const SESSION_COOKIE = 'massage_session';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:5080/api/v1';

/**
 * Token nằm trong cookie httpOnly, không phải localStorage.
 *
 * Đây là khu vực chạm tiền: một lỗ XSS ở bất kỳ đâu trong site cũng đọc được
 * localStorage, và token đọc được nghĩa là nạp tiền, mua gói, huỷ campaign thay
 * người khác. Cookie httpOnly thì JavaScript của trang không chạm tới được, nên
 * trình duyệt giữ token mà không có đoạn mã nào của ta cầm nó.
 *
 * Đổi lại, mọi lời gọi API có xác thực phải đi qua server: server component đọc
 * cookie trực tiếp, còn thao tác từ client đi qua route handler proxy.
 */
export function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Vai trò trong token của phiên hiện tại, hoặc null khi chưa đăng nhập.
 *
 * **Chỉ dùng để điều hướng, không bao giờ để cấp quyền.** Hàm này đọc phần payload
 * của JWT mà *không* kiểm chữ ký — người dùng sửa được cookie thì đổi được chuỗi
 * này. Quyền thật do backend quyết định ở mỗi lời gọi API, nơi chữ ký được kiểm.
 *
 * Việc nó giải quyết: dashboard cần phân biệt "chưa đăng nhập" (→ mời đăng nhập)
 * với "đã đăng nhập nhưng là tài khoản khách" (→ nói rõ tài khoản này không có
 * dashboard). Không phân biệt được thì tài khoản khách bị đá về trang đăng nhập,
 * đăng nhập lại thành công, rồi lại bị đá về — một vòng lặp không lối thoát mà
 * người dùng không hiểu vì sao.
 */
export function getSessionRole(): string | null {
  const token = getSessionToken();
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    // JWT dùng base64url; Buffer nhận thẳng 'base64url' từ Node 16.
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;

    // Token hết hạn coi như chưa đăng nhập. Không phải để bảo mật — chữ ký vẫn không
    // được kiểm ở đây, và backend mới là nơi quyết định — mà để tránh một vòng lặp
    // chuyển hướng: `redirectIfAuthenticated` đá người dùng sang `/dashboard`, trang
    // đó gọi API bằng token đã chết, nhận 401 và đá ngược về `/dang-nhap`, nơi hàm
    // này lại thấy "đã đăng nhập". Cookie và JWT hiện cùng sống 7 ngày nên hai mốc
    // trùng nhau, nhưng chúng được đặt ở hai nơi khác nhau và sẽ có lúc lệch.
    if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) return null;

    // .NET phát claim vai trò dưới URI dài của WS-Federation, không phải 'role'.
    const raw =
      claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? claims.role;

    return typeof raw === 'string' ? raw : null;
  } catch {
    // Cookie hỏng hoặc không phải JWT — coi như chưa đăng nhập và để luồng gọi
    // API phía sau trả 401 như bình thường.
    return null;
  }
}

export class UnauthenticatedError extends Error {}

/**
 * Gọi API backend kèm token của phiên hiện tại. Chỉ dùng được ở phía server.
 *
 * `no-store` cho mọi thứ ở đây: số dư ví và danh sách campaign là dữ liệu riêng
 * của từng người và đổi ngay sau mỗi thao tác — cache dù chỉ vài giây cũng khiến
 * KTV mua gói xong vẫn thấy số dư cũ và tưởng giao dịch hỏng.
 */
export async function authFetch<T>(path: string): Promise<T> {
  const token = getSessionToken();
  if (!token) throw new UnauthenticatedError();

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 403) throw new UnauthenticatedError();
  if (!res.ok) throw new Error(`API ${path} trả về ${res.status}`);

  return (await res.json()) as T;
}

/** Như <c>authFetch</c> nhưng trả null khi backend báo 404 thay vì ném lỗi. */
export async function authFetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await authFetch<T>(path);
  } catch (err) {
    if (err instanceof UnauthenticatedError) throw err;
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }
}

export const API_BASE = BASE;

/**
 * Lọc `?next=` để chỉ nhận đường dẫn nội bộ.
 *
 * Tham số này đến từ thanh địa chỉ, nên nhận nguyên trạng là mở một open redirect
 * ngay trên trang đăng nhập thật: kẻ tấn công gửi link
 * `/dang-nhap?next=https://trang-gia.example`, khách đăng nhập thật trên site của ta
 * rồi bị đẩy sang trang giả đã dựng sẵn màn hình "phiên hết hạn, đăng nhập lại".
 * Chặn cả `//host` vì trình duyệt hiểu nó là URL tuyệt đối.
 *
 * Nằm ở đây chứ không phải trong từng page: nay có ba trang đăng nhập/đăng ký cùng
 * cần nó, và một bản chép tay ở trang thứ hai là đúng cách một trong các bản lệch đi
 * rồi mở lại lỗ hổng ở nửa không ai kiểm.
 */
export function safeNext(next: string | undefined): string | undefined {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return undefined;
  return next;
}

/**
 * Đưa người **đã đăng nhập** ra khỏi màn hình đăng nhập / đăng ký.
 *
 * Vì sao cần: header trỏ "Dành cho KTV" thẳng vào `/dang-nhap`, nên KTV đã có phiên
 * bấm nút đó lại thấy đúng cái form họ vừa điền xong — đọc như phiên đăng nhập đã
 * mất, trong khi nó còn nguyên. Ba trang này vẽ form vô điều kiện, không hề hỏi xem
 * người đang xem là ai.
 *
 * Đi theo **vai trò**, cùng quy tắc mà `PasswordAuthForm` dùng sau khi đăng nhập
 * thành công: KTV về `/dashboard`, khách về `next` hoặc trang chủ. Hai chỗ lệch nhau
 * thì cùng một cú bấm cho ra hai kết quả khác nhau tuỳ việc phiên có sẵn hay vừa tạo.
 *
 * `getSessionRole` đọc payload JWT **không kiểm chữ ký**, nên nó chỉ được dùng để
 * điều hướng — đúng như việc ở đây. Cookie giả mạo chỉ đổi được đích đến của một lần
 * chuyển trang; mọi trang đích vẫn tự gọi API và nhận 401 nếu token không hợp lệ.
 *
 * Dùng ở cả ba trang `(auth)`. `/dang-ky-ktv` gọi nó **không kèm** `next` vì trang đó
 * cố ý không nhận tham số ấy.
 */
export function redirectIfAuthenticated(next?: string): void {
  const role = getSessionRole();
  if (role === null) return;

  redirect(role === 'KTV' ? '/dashboard' : (next ?? '/'));
}
