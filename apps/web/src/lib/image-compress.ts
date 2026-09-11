/**
 * Nén ảnh ở trình duyệt trước khi gửi lên.
 *
 * **Vì sao tồn tại:** KTV gần như luôn tải ảnh từ điện thoại, và camera hiện tại cho ra
 * 2–5MB mỗi tấm — tức vượt hạn mức 3MB của `UploadOptions.MaxImageSizeMb` ở phần lớn
 * lượt chụp. Trước khi có file này, lượt gửi đó bị chặn ngay ở client và KTV không có
 * cách nào tự sửa ngoài việc đi tìm một app nén ảnh.
 *
 * Đồng thời nó gỡ luôn cái bẫy HEIC: ảnh chụp bằng iPhone mặc định là `.heic`, thứ
 * `UploadService.ImageTypes` ở backend không nhận và cũng không nên nhận — Chrome và
 * Firefox trên desktop **không** hiển thị được HEIC, nên một ảnh hồ sơ HEIC sẽ vỡ trên
 * trang công khai với phần lớn khách. Canvas giải mã được nó trên iOS (Safari hỗ trợ
 * HEIC native) và xuất ra JPEG, nên thứ rời khỏi máy KTV luôn là định dạng mọi trình
 * duyệt đọc được.
 *
 * **Đây là tiện lợi, không phải ràng buộc.** Backend vẫn kiểm lại cỡ file và vẫn kiểm
 * đuôi ↔ MIME phải khớp nhau (xem `UploadService.SaveAsync`). Đừng nới lỏng vế đó ở
 * server vì đã có file này: người dùng gửi thẳng vào API không đi qua trình duyệt.
 */

/** Cạnh dài tối đa sau khi nén. */
const MAX_EDGE = 1600;

/**
 * Chất lượng JPEG. 0.82 là chỗ mà tăng thêm gần như không thấy khác bằng mắt ở kích
 * thước ảnh thật sự được hiển thị (avatar 96px, gallery 300px, card tìm kiếm ~400px)
 * nhưng dung lượng thì tăng rõ.
 */
const QUALITY = 0.82;

/**
 * Định dạng mà `canvas.toBlob` chắc chắn xuất được ở mọi trình duyệt.
 *
 * Cố ý **không** dùng WebP dù nó nhỏ hơn: Safari chỉ xuất được WebP từ bản 14 trở đi và
 * âm thầm rơi về PNG khi không hỗ trợ — mà PNG của một tấm ảnh chụp còn **nặng hơn**
 * bản JPEG gốc, tức là "nén" xong lại vượt hạn mức. Ảnh đi lên R2 dù sao cũng được
 * `next/image` chuyển sang AVIF/WebP ở đường đọc (xem mục `sharp` trong CLAUDE.md), nên
 * định dạng lưu trữ không phải chỗ cần tối ưu.
 */
const OUTPUT_MIME = 'image/jpeg';
const OUTPUT_EXT = '.jpg';

/** File không phải ảnh (PDF chứng chỉ) đi thẳng, không đụng tới. */
function isImage(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Đổi đuôi file sang `.jpg` sau khi nén.
 *
 * Bắt buộc, không phải chi tiết thẩm mỹ: backend kiểm **đuôi phải khớp MIME**, nên một
 * blob `image/jpeg` mang tên `IMG_1234.HEIC` bị từ chối với đúng câu "Chỉ chấp nhận file
 * JPG, JPEG, PNG, WEBP" — lỗi đọc như thể việc nén đã không xảy ra.
 */
function toJpegName(name: string): string {
  const base = name.replace(/\.[^./\\]*$/, '') || 'anh';
  return `${base}${OUTPUT_EXT}`;
}

/**
 * Đọc file thành ảnh giải mã được.
 *
 * `createImageBitmap` trước vì nó giải mã off-thread nên không làm khựng giao diện, và
 * nó là đường **duy nhất** đọc được HEIC trên một số bản iOS. `<img>` + object URL là
 * bản dự phòng cho trình duyệt cũ.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Rơi xuống đường <img>. Một số trình duyệt ném ở đây với định dạng lạ.
    }
  }

  const url = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = url;
    });
  } finally {
    // Thu hồi ngay: ảnh đã được giải mã vào bộ nhớ, không cần URL nữa. Giữ lại là rò
    // rỉ một file mỗi lượt chọn ảnh.
    URL.revokeObjectURL(url);
  }
}

/**
 * Nén ảnh về JPEG ≤ `MAX_EDGE` px cạnh dài.
 *
 * **Không bao giờ ném lỗi.** Ảnh không giải mã được, canvas bị chặn (một số chế độ
 * chống fingerprint), hay `toBlob` trả null — mọi ca đều trả lại **file gốc** để lượt
 * gửi vẫn đi tiếp và backend là bên quyết định. Ném ở đây nghĩa là một trình duyệt lạ
 * mất hẳn khả năng tải ảnh lên, đổi một tối ưu lấy một tính năng hỏng.
 *
 * Cũng trả file gốc khi bản nén **không nhỏ hơn**: ảnh đã tối ưu sẵn hoặc ảnh nhỏ thì
 * vòng qua canvas chỉ làm nó to ra.
 */
export async function compressImage(file: File): Promise<File> {
  if (!isImage(file)) return file;

  try {
    const source = await decode(file);
    const width = source.width;
    const height = source.height;

    if (!width || !height) return file;

    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // Nền trắng trước khi vẽ: PNG trong suốt chuyển sang JPEG mà không có nền sẽ ra
    // nền **đen**, thứ trông như ảnh hỏng chứ không như một lựa chọn.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    // ImageBitmap giữ bộ nhớ tới khi bị đóng; trình duyệt không tự dọn sớm.
    if ('close' in source) source.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, OUTPUT_MIME, QUALITY),
    );

    if (!blob || blob.size >= file.size) return file;

    return new File([blob], toJpegName(file.name), {
      type: OUTPUT_MIME,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
