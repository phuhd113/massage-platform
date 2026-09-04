import { NextResponse } from 'next/server';
import { API_BASE } from '@/lib/session';

/**
 * Tra ngược toạ độ GPS ra quận/huyện, để nút "Tìm quanh tôi" điền sẵn ô khu vực.
 *
 * Cùng lý do tồn tại như `/api/areas/suggest`: proxy dashboard trả 401 khi thiếu
 * cookie phiên, mà đây là đường của khách chưa đăng nhập; và trong docker compose thì
 * backend chỉ nghe trong mạng nội bộ.
 *
 * Khác `POST /leads` và beacon lượt xem — hai endpoint gọi thẳng backend qua CORS vì
 * cần IP thật của khách để gộp trùng. Ở đây không có gì để gộp, nên đi qua proxy là
 * lựa chọn rẻ hơn: không phải khai thêm origin, và tận dụng được cache bên dưới.
 */

/**
 * Làm tròn toạ độ trước khi gửi đi và trước khi đặt khoá cache.
 *
 * Hai chữ số thập phân ≈ 1,1km — dư sức để chọn đúng quận, trong khi mọi khách trong
 * cùng một ô lưới dùng chung một lượt gọi. Đây cũng là chuyện riêng tư: log của tầng
 * cache không cần biết ai đang đứng chính xác ở đâu, và toạ độ đầy đủ vẫn đi thẳng
 * tới `/search` như cũ nên độ chính xác của kết quả không đổi.
 */
const GRID = 2;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));

  // Chặn ở biên thay vì chuyển tiếp: toạ độ hỏng không bao giờ ra khu vực nào.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(null);
  }

  const target = new URLSearchParams({
    lat: lat.toFixed(GRID),
    lon: lon.toFixed(GRID),
  });

  try {
    const res = await fetch(`${API_BASE}/areas/resolve?${target}`, {
      headers: { Accept: 'application/json' },
      // Ranh giới hành chính không đổi trong ngày, và ô lưới 1km khiến hàng xóm dùng
      // chung một lượt. Một giờ là đủ dài để có ích mà vẫn ngắn hơn mọi lần seed lại.
      next: { revalidate: 3600 },
    });

    // 204 là câu trả lời hợp lệ: khách ở ngoài lãnh thổ hoặc GPS trôi ra biển.
    if (res.status === 204 || !res.ok) return NextResponse.json(null);

    const text = await res.text();
    return NextResponse.json(text ? JSON.parse(text) : null);
  } catch {
    // Không dò được khu vực thì ô để trống — kết quả tìm kiếm vẫn đúng vì nó lọc theo
    // toạ độ thật, không theo cái nhãn này. Đừng biến một tiện ích phụ thành lỗi trang.
    return NextResponse.json(null);
  }
}
