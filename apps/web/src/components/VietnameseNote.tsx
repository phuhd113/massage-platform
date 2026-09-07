/**
 * Nhãn nhỏ báo phần nội dung bên dưới do người dùng viết bằng tiếng Việt.
 *
 * Nội dung đánh giá, tên chứng chỉ và chú thích ảnh đều là chữ người
 * thật gõ vào, và không có bản dịch. Không dịch máy chúng: Google coi nội dung dịch
 * máy hàng loạt là spam và hình phạt rơi lên **cả tên miền** — đúng loại rủi ro mà
 * ngành này vốn đã nhạy cảm sẵn.
 *
 * Nên thay vì giấu, ta nói thẳng. Phần chữ đó được bọc `lang="vi"` tại chính element
 * chứa nó, để trình đọc màn hình phát âm đúng và để Google hiểu đây là trang song
 * ngữ có chủ đích chứ không phải một bản dịch làm dở.
 *
 * Trả `null` ở bản tiếng Việt: với người đọc tiếng Việt thì đây là ngôn ngữ mặc
 * định của cả trang, dán nhãn chỉ thành nhiễu.
 */
export function VietnameseNote({ label }: { label: string }) {
  if (!label) return null;

  return (
    <span className="ml-2 align-middle rounded-full border border-ink-200 bg-ink-50 px-2 py-0.5 text-caption font-normal text-ink-500">
      {label}
    </span>
  );
}
