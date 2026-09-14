/**
 * Kênh liên hệ của Ban quản trị, khai **đúng một lần** ở đây.
 *
 * Hai số này trước đây nằm hardcode trong `BetaAnnouncementDialog` — nơi duy nhất
 * hiển thị chúng. Trang `/lien-he` là chỗ **thứ hai**, và đó chính là lúc phải tách
 * ra: hai bản chép tay sẽ trôi khỏi nhau, và bản lệch chỉ lộ ra khi có người gọi vào
 * một số đã ngừng dùng rồi kết luận là sàn không có ai trực. Khác với `LEGAL_ENTITY`,
 * đây không phải lời khai pháp lý mà là đường dây thật đang có người nghe — nên nó
 * không có trạng thái "chưa điền".
 *
 * Cố ý KHÔNG nằm trong `i18n/*.ts`: số điện thoại không dịch, và để chúng trong
 * dictionary là mời một bản "cho thuận tai" (đổi cách nhóm chữ số, thêm +84) đi vào
 * đúng chỗ phải bấm gọi được nguyên văn.
 *
 * Đổi số thì đổi ở đây, và **cả hai** chỗ hiển thị tự theo.
 */

/**
 * Hai số của Ban quản trị, dùng chung cho cả link gọi (`tel:`) lẫn link Zalo.
 *
 * Lưu dạng `0xxxxxxxxx` chứ không `84xxxxxxxxx`: đó là dạng người Việt đọc và lưu
 * danh bạ, `tel:` lẫn `zalo.me` đều nhận, và hệ thống cũng lưu số người dùng ở dạng
 * này (xem `ToZaloPhone` ở backend — chỗ **duy nhất** cần dạng 84 là API của Zalo).
 */
export const ADMIN_CONTACTS = ['0935454106', '0354888765'] as const;

/**
 * Hiển thị `0935.454.106` — nhóm ba chữ số để mắt bắt được và để đọc to qua điện
 * thoại. Dấu chấm chứ không dấu cách: dấu cách cho phép trình duyệt ngắt dòng giữa
 * một số điện thoại, và nửa số nằm ở dòng sau đọc như hai số khác nhau.
 */
export function prettyPhone(raw: string) {
  return `${raw.slice(0, 4)}.${raw.slice(4, 7)}.${raw.slice(7)}`;
}

/** Link gọi. Giữ nguyên dạng `0xxxxxxxxx` — máy Việt Nam quay số nội địa đúng. */
export const telHref = (raw: string) => `tel:${raw}`;

/** Link mở cửa sổ chat Zalo với số đó. */
export const zaloHref = (raw: string) => `https://zalo.me/${raw}`;

/**
 * Hộp thư của Ban quản trị. Hộp thư **thật, có người đọc** — không phải một địa chỉ
 * trang trí trên trang liên hệ.
 *
 * Đây là điều kiện để nó được đăng: một địa chỉ email không ai mở thì tệ hơn hẳn không
 * có, vì khách viết vào đó rồi chờ, trong khi hai số Zalo bên cạnh đang có người trực.
 * Cùng lý do đã ghi ở `/lien-he` về việc **cố ý không làm form liên hệ**. Trước khi
 * đổi địa chỉ này, kiểm hộp thư mới nhận được thư thật đã.
 *
 * Hiển thị ở **hai** chỗ: mục riêng trên `/lien-he`, và một dòng dưới blurb ở footer
 * (`PublicShell`) — footer nằm trong HTML của mọi trang công khai nên đó là chỗ duy
 * nhất địa chỉ này tới được tay người đang đứng ở một trang hồ sơ. Hộp thư ngừng được
 * đọc thì gỡ khỏi **cả hai**, và vì cả hai cùng đọc hằng số này nên đó là một lần sửa.
 *
 * Tách khỏi <see cref="ADMIN_CONTACTS"/> vì nó không phải một kênh song song với hai số
 * kia: Zalo là kênh nhanh, email là kênh cho việc cần văn bản (yêu cầu dữ liệu cá nhân,
 * khiếu nại có kèm ảnh chụp màn hình) và cho người không nói tiếng Việt — viết thì dịch
 * được, gọi thì không.
 *
 * KHÔNG dùng địa chỉ này làm người gửi cho email thông báo tự động
 * (`Notifications:FromEmail`): trộn thư máy vào hộp thư khách hàng viết tới là cách
 * chắc chắn để một thư thật trôi mất giữa hàng chục thông báo hồ sơ chờ duyệt.
 */
export const ADMIN_EMAIL = 'lienhe@masgo.vn';

/**
 * Link soạn thư. Không nhồi sẵn `?subject=` — tiêu đề do người viết đặt mới nói đúng
 * việc họ cần, còn một tiêu đề dựng sẵn thì hoặc bị xoá, hoặc để nguyên và làm mọi thư
 * trông giống nhau trong hộp thư.
 */
export const mailtoHref = (email: string) => `mailto:${email}`;
