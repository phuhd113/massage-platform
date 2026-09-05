/**
 * Bản tiếng Việt — **nguồn sự thật về hình dạng** của dictionary.
 *
 * `en.ts` khai kiểu `Dictionary` suy ra từ file này, nên thiếu một key là build đỏ.
 * Đó là toàn bộ cơ chế "translation coverage" ở đây: không cần script kiểm tra
 * riêng, không cần test đếm key.
 *
 * Quy ước:
 * - Nội suy dùng `{ten}`, và chuỗi có số nhiều **bắt buộc** nhận biến tên `count`.
 * - Key có số nhiều phải khai dạng `{ one, other }` **ở cả bản tiếng Việt**, dù hai
 *   nhánh giống hệt nhau. Tiếng Việt không phân biệt số nhiều, nhưng hình dạng phải
 *   khớp thì TypeScript mới ép được bản tiếng Anh khai đủ hai nhánh.
 */
export const vi = {
  common: {
    siteName: 'Massage tại nhà',
    home: 'Trang chủ',
    ktvUnit: 'KTV',
    from: 'từ',
    loading: 'Đang tải…',
    retry: 'Thử lại',
    close: 'Đóng',
    cancel: 'Huỷ',
  },

  shell: {
    navFindKtv: 'Tìm KTV',
    navHcm: 'TP.HCM',
    navHanoi: 'Hà Nội',
    navHowWeVerify: 'Cách chúng tôi duyệt hồ sơ',
    navForKtv: 'Dành cho KTV',
    footerBlurb:
      '{siteName} — nền tảng kết nối khách với kỹ thuật viên massage trị liệu tại nhà. Mọi hồ sơ hiển thị đều đã qua duyệt chứng chỉ hành nghề.',
    languageLabel: 'Ngôn ngữ',
    switchToEnglish: 'English',
    switchToVietnamese: 'Tiếng Việt',
  },

  home: {
    metaTitle: '{siteName} — KTV trị liệu có chứng chỉ',
    metaDescription:
      'Tìm kỹ thuật viên massage trị liệu tại nhà theo khu vực, xem chứng chỉ hành nghề và đánh giá thật trước khi liên hệ.',
    verifiedBadge: {
      one: '{count} kỹ thuật viên đã đối chiếu chứng chỉ hành nghề',
      other: '{count} kỹ thuật viên đã đối chiếu chứng chỉ hành nghề',
    },
    heroTitle: 'Massage trị liệu tại nhà, người thật có chứng chỉ thật',
    heroSubtitle:
      'Xem ảnh, chứng chỉ hành nghề và khoảng cách của từng kỹ thuật viên trước khi gọi. Không mất phí đặt lịch, thanh toán sau buổi trị liệu.',

    verifyTitle: 'Chứng chỉ được duyệt thế nào',
    verifySubtitle: 'Ba bước trước khi một hồ sơ được phép xuất hiện trong kết quả tìm kiếm.',
    step1Title: 'KTV tải bản gốc chứng chỉ',
    step1Body:
      'Chứng chỉ xoa bóp bấm huyệt hoặc kỹ thuật viên phục hồi chức năng, kèm ảnh chân dung.',
    step2Title: 'Đối chiếu với tổ chức cấp',
    step2Body:
      'Chúng tôi kiểm tra tên, số chứng chỉ và đơn vị cấp trước khi đánh dấu đã duyệt.',
    step3Title: 'Hồ sơ mở cho khách xem',
    step3Body: 'Bạn thấy đúng chứng chỉ nào đã duyệt, do ai cấp, và đánh giá của khách trước.',

    areasTitle: 'Tìm theo khu vực',
    areasSubtitle: 'Chọn quận/huyện để xem kỹ thuật viên nhận khách ở đó.',
    servicesTitle: 'Dịch vụ',
    servicesSubtitle: 'Mỗi kỹ thuật viên tự công bố bảng giá cho từng dịch vụ trên hồ sơ.',
  },
} as const;
