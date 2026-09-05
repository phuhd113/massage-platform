import { DEFAULT_LOCALE, type Locale } from './config';

/**
 * Dịch **tiền tố loại đơn vị hành chính** trong tên khu vực sang tiếng Anh:
 * "Quận 7" → "District 7", "Thành phố Hồ Chí Minh" → "Ho Chi Minh City".
 *
 * Chỉ đụng vào phần loại đơn vị; phần tên riêng giữ nguyên. Địa danh là danh từ
 * riêng — "Bình Thạnh" không có bản dịch, và ép nó có một bản là tạo ra cái tên
 * không tra được trên bản đồ hay hỏi được tài xế.
 *
 * **Chỉ dùng ở đường hiển thị.** Ô gợi ý khu vực khớp theo `name_ascii` do trigger
 * `trg_area_name_ascii` trong DB dựng từ `name` tiếng Việt; đổi chuỗi đem đi khớp
 * ở client sẽ làm ô gợi ý trả rỗng trong khi mọi thứ khác trông vẫn bình thường.
 */

/**
 * Tên tiếng Anh đã quen dùng của các thành phố trực thuộc trung ương.
 *
 * Không thể suy ra bằng luật: người nói tiếng Anh viết "Ho Chi Minh City" chứ
 * không phải "City Hồ Chí Minh", và cũng không giữ dấu. Đây đồng thời là những
 * từ khoá tìm kiếm có lượng truy vấn cao nhất bằng tiếng Anh, nên sai ở đây là
 * mất đúng nhóm khách mà bản dịch sinh ra để phục vụ.
 */
const EXONYMS: Record<string, string> = {
  'thành phố hồ chí minh': 'Ho Chi Minh City',
  'thành phố hà nội': 'Hanoi',
  'thành phố đà nẵng': 'Da Nang',
  'thành phố hải phòng': 'Hai Phong',
  'thành phố cần thơ': 'Can Tho',
  'thành phố huế': 'Hue',
};

/**
 * Tiền tố loại đơn vị và cách đặt trong tiếng Anh.
 *
 * `suffix: true` nghĩa là tiếng Anh viết loại đơn vị **sau** tên ("Cần Thơ City"),
 * `false` là viết trước ("District 7"). Hai kiểu này không quy về một được: cả
 * "City Cần Thơ" lẫn "7 District" đều sai.
 *
 * Xếp theo **độ dài giảm dần** — "Thị trấn" và "Thị xã" phải được thử trước bất
 * kỳ tiền tố một chữ nào, vì khớp "Thị" trần sẽ nuốt mất phần phân biệt hai loại
 * đơn vị khác hẳn nhau.
 */
const PREFIXES: ReadonlyArray<{ vi: string; en: string; suffix: boolean }> = [
  { vi: 'Thành phố', en: 'City', suffix: true },
  { vi: 'Thị trấn', en: 'Township', suffix: false },
  { vi: 'Thị xã', en: 'Town', suffix: true },
  { vi: 'Phường', en: 'Ward', suffix: false },
  { vi: 'Huyện', en: 'District', suffix: false },
  { vi: 'Quận', en: 'District', suffix: false },
  { vi: 'Tỉnh', en: 'Province', suffix: true },
  { vi: 'Xã', en: 'Commune', suffix: false },
];

export function translateAreaName(name: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return name;

  const lower = name.toLowerCase().trim();
  const exonym = EXONYMS[lower];
  if (exonym) return exonym;

  for (const { vi, en, suffix } of PREFIXES) {
    const prefix = `${vi} `;
    // So khớp **không phân biệt hoa thường**: dữ liệu GADM đã seed có 2 dòng ghi
    // "Thành Phố" (hoa chữ P) bên cạnh 90 dòng "Thành phố". Khớp phân biệt hoa
    // thường sẽ bỏ sót đúng hai dòng đó và để tiếng Việt lẫn giữa trang tiếng
    // Anh — sai quá nhỏ để ai đó tình cờ nhìn thấy.
    if (
      name.length > prefix.length &&
      name.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()
    ) {
      const rest = name.slice(prefix.length);
      return suffix ? `${rest} ${en}` : `${en} ${rest}`;
    }
  }

  // Không khớp tiền tố nào thì trả nguyên tên tiếng Việt. Im lặng và đúng: phần
  // lớn ca này là tên vốn đã không mang tiền tố loại đơn vị.
  return name;
}
