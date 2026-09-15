import type { StaticImageData } from 'next/image';

import serviceBamHuyet from '../../public/services/service-bam-huyet.jpg';
import serviceCaoGio from '../../public/services/service-cao-gio.jpg';
import serviceGiacHoi from '../../public/services/service-giac-hoi.jpg';
import serviceMassageBaBau from '../../public/services/service-massage-ba-bau.jpg';
import serviceMassageBody from '../../public/services/service-massage-body.jpg';
import serviceMassageChan from '../../public/services/service-massage-chan.jpg';
import serviceMassageCoVaiGay from '../../public/services/service-massage-co-vai-gay.jpg';
import serviceMassageThai from '../../public/services/service-massage-thai.jpg';
import serviceMassageTriLieu from '../../public/services/service-massage-tri-lieu.jpg';
import serviceTriLieuCotSong from '../../public/services/service-tri-lieu-cot-song.jpg';

/**
 * Ảnh minh hoạ trang /dich-vu/{slug}, khoá theo slug dịch vụ.
 *
 * File tĩnh trong `public/services/`, cùng lý do đã ghi ở `HomeHeroMedia`: đây là
 * ảnh biên tập của sàn, không do ai tải lên và không đổi theo dữ liệu, nên không
 * đi qua `MediaUrls`/R2 như avatar/gallery KTV. Import tĩnh cho Next biết sẵn
 * kích thước thật, không cần khai `width`/`height` tay.
 *
 * Next.js yêu cầu đường dẫn `import` là hằng số tại thời điểm build — không thể
 * dựng đường dẫn động từ `slug` lúc chạy — nên map này là cách duy nhất nối ảnh
 * với slug mà vẫn giữ import tĩnh.
 *
 * Cố ý KHÔNG có mục cho "xong-hoi-thao-duoc": dịch vụ đó ngừng bán 2026-09-15
 * (`ServiceSeeder.DiscontinuedSlugs`) nên không còn trang công khai nào đọc
 * tới key này — giữ lại ảnh chết trong bundle là phí dung lượng không ai dùng.
 *
 * Slug không có trong map (dịch vụ mới thêm ở `ServiceSeeder` mà chưa có ảnh)
 * nhận `undefined`: trang dịch vụ phải xử lý nhánh không ảnh, không phải mọi
 * dịch vụ trong danh mục đều có ảnh minh hoạ ngay từ ngày đầu.
 */
export const SERVICE_IMAGES: Record<string, StaticImageData> = {
  'massage-tri-lieu': serviceMassageTriLieu,
  'massage-co-vai-gay': serviceMassageCoVaiGay,
  'bam-huyet': serviceBamHuyet,
  'massage-thai': serviceMassageThai,
  'massage-body': serviceMassageBody,
  'massage-chan': serviceMassageChan,
  'massage-ba-bau': serviceMassageBaBau,
  'tri-lieu-cot-song': serviceTriLieuCotSong,
  'giac-hoi': serviceGiacHoi,
  'cao-gio': serviceCaoGio,
};
