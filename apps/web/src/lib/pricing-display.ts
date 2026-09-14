/**
 * Có hiện những con số giá do **sàn tự tính gộp** trên trang công khai hay không.
 *
 * **Đang tắt vì số lượng KTV còn nhỏ trong giai đoạn đầu.** Một con số gộp dựng từ vài
 * hồ sơ không mô tả được mặt bằng giá của cả khu vực hay cả dịch vụ — nó chỉ là giá của
 * một hai người, trình bày như thể là giá thị trường. Khách đọc "từ 500.000 ₫" ở trang
 * chủ rồi mở hồ sơ thấy một mức khác sẽ đọc đó là sàn nói sai, chứ không đọc là mẫu nhỏ.
 * Rủi ro đó nghiêng hẳn về một phía: giá là thứ khách quyết định dựa vào.
 *
 * **Ranh giới của cờ này: chỉ số GỘP, không phải mọi con số giá.** Bảng giá trên trang
 * hồ sơ KTV, giá trên thẻ KTV ở kết quả tìm kiếm và ở nút liên hệ đều **giữ nguyên** —
 * đó là con số do chính KTV công bố cho chính dịch vụ của mình, luôn đúng theo nghĩa
 * đen bất kể sàn có bao nhiêu hồ sơ, và là thứ khách cần để quyết định có gọi hay không.
 * Chúng cũng nằm trong `Offer` của JSON-LD trên trang hồ sơ, tức là thứ Google đọc để
 * dựng rich result. Đừng mở rộng cờ này sang chúng.
 *
 * **Tắt bằng một hằng số chứ không xoá code**, vì đây là trạng thái tạm: khi số hồ sơ
 * đủ để con số gộp có nghĩa thì bật lại là sửa đúng một dòng. Xoá đi thì luật "chỉ hiện
 * khi có dữ liệu thật" (`priceFrom !== null`, và ca một mức giá duy nhất ở
 * `buildStatCards`) phải dựng lại từ đầu, và bản dựng lại sẽ thiếu đúng những ca đó.
 *
 * Hai chỗ dùng nằm cách xa nhau — section dịch vụ ở trang chủ và ô "Giá phổ biến" ở
 * trang khu vực — nên cờ đặt ở đây chứ không khai riêng mỗi nơi: hai hằng số song song
 * là hai chỗ để chúng lặng lẽ trôi khỏi nhau, và lúc đó trang chủ giấu giá trong khi
 * ~700 trang khu vực vẫn khoe.
 *
 * Cùng hình dạng với `SHOW_TRUST_PROOF` trong `HomeSloganBand.tsx`, và cùng một lý do
 * nghiệp vụ: số liệu nhỏ trưng ra sớm thì chứng minh điều ngược lại với điều nó định nói.
 */
export const SHOW_AGGREGATE_PRICE = false;
