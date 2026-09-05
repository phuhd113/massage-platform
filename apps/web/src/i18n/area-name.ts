import { DEFAULT_LOCALE, type Locale } from './config';

/**
 * Dịch **tiền tố loại đơn vị hành chính** trong tên khu vực: "Quận 7" → "District 7".
 *
 * Chỉ dịch tiền tố, giữ nguyên phần tên riêng. Địa danh là danh từ riêng — "Bình
 * Thạnh" không có bản dịch, và ép nó có một bản là tạo ra tên không ai tra được
 * trên bản đồ hay hỏi được tài xế.
 *
 * **Chỉ dùng ở đường hiển thị.** Ô gợi ý khu vực khớp theo `name_ascii` do trigger
 * `trg_area_name_ascii` trong DB dựng từ `name` tiếng Việt; đổi chuỗi đem đi khớp ở
 * client sẽ làm ô gợi ý trả rỗng trong khi mọi thứ khác trông vẫn bình thường.
 */

/**
 * Tiền tố xếp theo **độ dài giảm dần**: "Thị xã" phải được thử trước "Thị trấn"
 * không quan trọng, nhưng cả hai phải được thử trước bất kỳ tiền tố một chữ nào —
 * khớp "Thị" trần sẽ nuốt mất phần phân biệt hai loại đơn vị khác hẳn nhau.
 */
const PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ['Thành phố', 'City'],
  ['Thị trấn', 'Township'],
  ['Thị xã', 'Town'],
  ['Phường', 'Ward'],
  ['Huyện', 'District'],
  ['Quận', 'District'],
  ['Tỉnh', 'Province'],
  ['Xã', 'Commune'],
];

/**
 * So khớp **không phân biệt hoa thường**.
 *
 * Không phải phòng xa: dữ liệu GADM đã seed có 2 dòng ghi "Thành Phố" (hoa chữ P)
 * bên cạnh 90 dòng "Thành phố". Khớp phân biệt hoa thường sẽ bỏ sót đúng hai dòng
 * đó và để lại tiếng Việt lẫn giữa trang tiếng Anh — sai quá nhỏ để ai đó tình cờ
 * nhìn thấy, và chỉ ở hai khu vực trong số hàng trăm.
 */
export function translateAreaName(name: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return name;

  for (const [vi, en] of PREFIXES) {
    const prefix = `${vi} `;
    if (name.length > prefix.length && name.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()) {
      return `${en} ${name.slice(prefix.length)}`;
    }
  }

  // Không khớp tiền tố nào thì trả nguyên tên tiếng Việt. Im lặng và đúng: phần lớn
  // ca này là tên đã không mang tiền tố loại đơn vị.
  return name;
}

