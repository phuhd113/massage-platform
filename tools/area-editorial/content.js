// Nội dung biên tập cho các khu vực trọng điểm của MasGo.
//
// Mỗi đoạn phải nói về đặc điểm THẬT và RIÊNG của khu vực đó — địa danh, hình thái dân
// cư, thói quen đặt lịch, lưu ý di chuyển. Chép chung một khuôn rồi thay tên là đúng
// định nghĩa doorway page mà ngưỡng `editorial_note` sinh ra để chặn, và Google phạt cả
// tên miền chứ không riêng trang đó.
//
// Cố ý KHÔNG hứa điều sàn không giữ được: không nói "mọi KTV đều có chứng chỉ" (chứng
// chỉ là tuỳ chọn), không cam kết thời gian có mặt, không nêu giá cụ thể (giá do KTV tự
// khai và đổi được). Câu khẳng định duy nhất về việc duyệt là đối chiếu danh tính — thứ
// kiểm được ở `AdminService.DecideProfileAsync`.
//
// **Định danh bằng cặp slug, KHÔNG bằng UUID.** UUID chỉ đúng trong đúng một database:
// bản đầu của file này ghi id của production, và chạy thử trên dev thì cả tám khu vực
// trả 404. Slug thì giống nhau ở mọi môi trường vì `seed-areas` sinh chúng từ cùng bộ
// dữ liệu. `province` phải đi kèm slug quận và chỉ null khi chính nó là tỉnh — slug quận
// đứng một mình không định danh được gì, cả nước có 10 tỉnh cùng chứa "Huyện Châu Thành".

module.exports = [
  {
    slug: 'thanh-pho-da-nang', province: null,
    name: 'Thành phố Đà Nẵng',
    note: `Đà Nẵng trải dọc hai bờ sông Hàn, với vùng ven biển phía đông và khu trung tâm hành chính phía tây tạo ra hai nhịp sinh hoạt khá khác nhau. Nhu cầu massage trị liệu tận nơi ở đây đến từ ba nhóm rõ rệt: khách lưu trú dài ngày quanh Mỹ Khê và Sơn Trà, dân văn phòng khu Hải Châu tìm dịch vụ cổ vai gáy sau giờ làm, và người lớn tuổi trong các khu dân cư cũ cần bấm huyệt hay xoa bóp trị liệu định kỳ. Thành phố gọn và hạ tầng đường tốt nên kỹ thuật viên di chuyển giữa các quận trung tâm thường không mất nhiều thời gian; riêng các tuyến ra bán đảo Sơn Trà hoặc lên hướng Hoà Vang thì nên đặt lịch sớm hơn. Hồ sơ kỹ thuật viên hiển thị trên trang này đều đã qua bước đối chiếu danh tính trước khi được đăng.`,
  },
  {
    slug: 'quan-hai-chau', province: 'thanh-pho-da-nang',
    name: 'Quận Hải Châu',
    note: `Hải Châu là quận trung tâm của Đà Nẵng, nơi tập trung phần lớn văn phòng, ngân hàng và khách sạn nội đô quanh trục Trần Phú, Bạch Đằng và Nguyễn Văn Linh. Đặc điểm đó định hình nhu cầu ở đây: phần lớn lịch hẹn rơi vào khung sau 18 giờ trong tuần, và dịch vụ được hỏi nhiều nhất là massage cổ vai gáy cùng trị liệu cột sống — hệ quả của nhiều giờ ngồi bàn làm việc. Khu vực này có mật độ chung cư và nhà phố cao, đường sá thuận tiện, nên kỹ thuật viên thường đến đúng giờ hơn so với các quận vùng ven. Nếu bạn ở các toà nhà có lễ tân hoặc thang máy kiểm soát thẻ, hãy báo trước số căn hộ khi đặt lịch để tránh chờ ở sảnh.`,
  },
  {
    slug: 'quan-son-tra', province: 'thanh-pho-da-nang',
    name: 'Quận Sơn Trà',
    note: `Quận Sơn Trà nằm phía đông Đà Nẵng, trải từ chân cầu Sông Hàn ra bán đảo. Khu vực tập trung nhiều khách sạn ven biển Mỹ Khê và khu dân cư dọc đường Ngô Quyền, Phạm Văn Đồng, nên nhu cầu massage trị liệu tận nơi thường rơi vào buổi tối và cuối tuần. Khách lưu trú dài ngày ở đây hay chọn massage thư giãn hoặc xông hơi thảo dược sau một ngày đi biển, trong khi dân cư tại chỗ thiên về bấm huyệt và trị liệu cổ vai gáy. Kỹ thuật viên di chuyển trong nội quận khá thuận tiện; nếu bạn ở khu vực gần chùa Linh Ứng hay phường Thọ Quang thì nên đặt lịch sớm hơn một chút, vì quãng đường xa hơn phần còn lại của quận.`,
  },
  {
    slug: 'quan-ngu-hanh-son', province: 'thanh-pho-da-nang',
    name: 'Quận Ngũ Hành Sơn',
    note: `Ngũ Hành Sơn nằm ở phía đông nam Đà Nẵng, giáp biển Non Nước và kéo dài về hướng Hội An. Đây là khu vực có tỉ lệ khu nghỉ dưỡng, biệt thự cho thuê và căn hộ dịch vụ cao nhất thành phố, nên phần lớn lịch hẹn đến từ khách lưu trú theo tuần hoặc theo tháng thay vì khách vãng lai. Nhu cầu phổ biến là massage thư giãn toàn thân và massage chân sau những ngày di chuyển nhiều. Quận trải dài theo trục Lê Văn Hiến và Trường Sa, khoảng cách giữa hai đầu khá lớn, nên khi đặt lịch bạn nên ghi rõ tên khu nghỉ dưỡng hoặc điểm mốc gần nhất để kỹ thuật viên ước lượng đúng thời gian di chuyển.`,
  },
  {
    slug: 'quan-thanh-khe', province: 'thanh-pho-da-nang',
    name: 'Quận Thanh Khê',
    note: `Thanh Khê nằm phía tây bắc trung tâm Đà Nẵng, là quận có mật độ dân cư cao với nhiều khu nhà ở lâu năm quanh ga Đà Nẵng, chợ Tân Chính và trục Điện Biên Phủ. Khác với các quận ven biển vốn phục vụ nhiều khách lưu trú, nhu cầu ở đây chủ yếu đến từ cư dân tại chỗ: bấm huyệt, xoa bóp trị liệu cho người lớn tuổi, và massage cổ vai gáy cho người đi làm. Lịch hẹn phân bố đều hơn trong ngày, không dồn hẳn vào buổi tối như khu trung tâm. Nhiều tuyến đường trong quận là hẻm nhỏ, nên việc ghi rõ số nhà và tên hẻm khi đặt lịch giúp kỹ thuật viên tìm đến nhanh hơn đáng kể.`,
  },
  {
    slug: 'quan-cam-le', province: 'thanh-pho-da-nang',
    name: 'Quận Cẩm Lệ',
    note: `Cẩm Lệ là quận phía tây nam Đà Nẵng, nằm giữa trung tâm thành phố và huyện Hoà Vang, với nhiều khu dân cư mới hình thành dọc trục Cách Mạng Tháng Tám và quanh khu vực cầu Cẩm Lệ. Đây là địa bàn có nhiều hộ gia đình trẻ và người lao động, nên nhu cầu thiên về massage trị liệu giá hợp lý, bấm huyệt và xoa bóp giảm đau lưng, vai gáy hơn là các gói thư giãn cao cấp. Quận giáp ranh với Hải Châu và Thanh Khê nên kỹ thuật viên ở khu trung tâm vẫn nhận lịch tới đây thuận tiện; các khu vực giáp Hoà Vang thì nên đặt trước để chủ động thời gian đi lại.`,
  },
  {
    slug: 'thanh-pho-hoi-an', province: 'tinh-quang-nam',
    name: 'Thành phố Hội An',
    note: `Hội An có cấu trúc rất riêng so với các đô thị khác ở miền Trung: khu phố cổ hạn chế xe cơ giới theo khung giờ, trong khi phần lớn homestay, khách sạn và biệt thự cho thuê lại nằm rải rác ở Cẩm Châu, Cẩm An và dọc đường ra biển An Bàng, Cửa Đại. Điều đó ảnh hưởng trực tiếp tới việc đặt lịch massage tận nơi: nếu chỗ ở của bạn nằm trong khu phố đi bộ, kỹ thuật viên có thể phải gửi xe bên ngoài và đi bộ vào, nên hãy báo trước địa chỉ cụ thể. Nhu cầu ở đây chủ yếu là massage thư giãn và massage chân cho khách du lịch sau những buổi đi bộ dài trong phố cổ, tập trung vào buổi chiều tối.`,
  },
  {
    slug: 'huyen-duy-xuyen', province: 'tinh-quang-nam',
    name: 'Huyện Duy Xuyên',
    note: `Duy Xuyên nằm ở phía nam Quảng Nam, trải từ vùng ven biển Duy Hải, Duy Nghĩa cho tới khu vực Trà Kiệu và thánh địa Mỹ Sơn ở phía tây. Đây là địa bàn rộng và chủ yếu là nông thôn, nên khoảng cách giữa các xã đáng kể hơn nhiều so với một quận nội thành — đặt lịch trước nửa ngày sẽ giúp kỹ thuật viên sắp xếp được lộ trình hợp lý. Nhu cầu tại đây nghiêng hẳn về trị liệu thực tế: xoa bóp giảm đau lưng, vai gáy và bấm huyệt cho người lao động chân tay và người lớn tuổi, thay vì các gói thư giãn dành cho khách du lịch. Khu vực gần cầu Cửa Đại có thêm nhóm khách lưu trú theo mùa.`,
  },
];
