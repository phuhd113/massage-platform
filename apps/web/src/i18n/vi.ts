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

    heroAreaLabel: 'Khu vực',
    heroAreaPlaceholder: 'Quận, huyện…',
    heroServiceLabel: 'Dịch vụ',
    heroServiceAll: 'Tất cả dịch vụ',
    heroSubmit: 'Tìm KTV',
    heroGeoUnsupported: 'Trình duyệt không hỗ trợ định vị. Bạn có thể chọn quận/huyện.',
  },

  notFound: {
    title: 'Không tìm thấy trang',
    body: 'Trang bạn tìm không tồn tại hoặc hồ sơ đã ngừng hiển thị.',
    backHome: 'Về trang chủ',
  },

  account: {
    login: 'Đăng nhập',
    myAccount: 'Tài khoản',
  },

  login: {
    metaTitleCustomer: 'Đăng nhập',
    metaTitleKtv: 'Đăng ký kỹ thuật viên',
    headingCustomer: 'Đăng nhập hoặc tạo tài khoản',
    headingKtv: 'Đăng nhập cho kỹ thuật viên',
    intro:
      'Nhập số điện thoại, chúng tôi gửi mã {length} chữ số qua SMS. Chưa có tài khoản thì hệ thống tự tạo. Không cần mật khẩu.',

    phoneLabel: 'Số điện thoại',
    sendCode: 'Gửi mã xác thực',
    sending: 'Đang gửi…',

    step2: 'Bước 2 · nhập mã',
    codeInputLabel: 'Mã xác thực {length} chữ số',
    changePhone: 'Đổi số điện thoại',
    resend: 'Gửi lại mã',
    resendIn: 'Gửi lại mã sau',
    submit: 'Đăng nhập',
    verifying: 'Đang kiểm tra…',
    stubNotice: 'Chế độ thử nghiệm: mã là {code}. Ở production, mã chỉ gửi qua SMS.',

    errorSendFailed: 'Không gửi được mã. Kiểm tra lại số điện thoại.',
    errorBadCode: 'Mã OTP không đúng hoặc đã hết hạn.',
    errorNetwork: 'Không kết nối được máy chủ.',

    crossLinkKtvQuestion: 'Bạn là khách đang tìm kỹ thuật viên?',
    crossLinkKtvAction: 'Đăng nhập tại đây',
    crossLinkCustomerQuestion: 'Bạn là kỹ thuật viên muốn nhận khách?',
    crossLinkCustomerAction: 'Tạo hồ sơ miễn phí',

    asideImageAlt: 'Ảnh KTV đang làm việc',
    asideTitleKtv: 'Hồ sơ đã duyệt được khách gọi nhiều hơn',
    asideTitleCustomer: 'Tài khoản để đánh giá và theo dõi',
    asideKtv1: 'Tải chứng chỉ một lần, chúng tôi đối chiếu và mở hồ sơ.',
    asideKtv2: 'Bạn tự đặt giá và khu vực nhận khách.',
    asideKtv3: 'Khách gọi trực tiếp, sàn không giữ tiền của bạn.',
    asideCustomer1: 'Viết đánh giá cho kỹ thuật viên bạn đã dùng.',
    asideCustomer2: 'Tìm kiếm và gọi không cần tài khoản — đăng nhập chỉ để đánh giá.',
    asideCustomer3: 'Chúng tôi không thu phí đặt lịch của khách.',
  },

  breadcrumbs: {
    label: 'Đường dẫn',
  },

  areaStats: {
    priceRange: 'Giá phổ biến',
    avgRating: 'Đánh giá trung bình',
    topService: 'Dịch vụ phổ biến nhất',
  },

  areaProvince: {
    metaTitle: 'Massage tại nhà {name}',
    metaDescription:
      '{count} kỹ thuật viên massage trị liệu nhận đến tận nhà tại {name}. Chứng chỉ hành nghề đã duyệt, có bảng giá và đánh giá thật của khách.',
    ogTitle: 'Massage tại nhà {name}',
    h1: 'Massage trị liệu tại nhà {name}',
    lead: {
      one: '{count} kỹ thuật viên đang nhận khách tại {name}. Chọn quận/huyện của bạn để xem những người ở gần nhất.',
      other: '{count} kỹ thuật viên đang nhận khách tại {name}. Chọn quận/huyện của bạn để xem những người ở gần nhất.',
    },
    pickDistrict: 'Chọn quận/huyện',
    featured: 'Kỹ thuật viên nổi bật tại {name}',
  },

  ktvCard: {
    sponsored: 'Tài trợ',
    sponsoredTitle: 'Vị trí quảng cáo — KTV trả phí để hiện ở đây',
    newProfile: 'Hồ sơ mới',
    noReviews: 'chưa có đánh giá',
    noPrices: 'Chưa khai báo bảng giá',
    minutes: '{n} phút',
    viewProfile: 'Xem hồ sơ',
    call: 'Gọi',
    reviews: {
      one: '{count} đánh giá',
      other: '{count} đánh giá',
    },
  },

  areaDistrict: {
    metaTitle: 'Massage tại nhà {name}',
    metaDescription:
      '{count} kỹ thuật viên massage trị liệu nhận khách tại {name}, {province}. Xem chứng chỉ, bảng giá và đánh giá thật trước khi gọi.',
    ogTitle: 'Massage tại nhà {name}',
    h1: 'Massage trị liệu tại nhà {name}',

    leadPre: 'Hiện có ',
    leadPost: {
      one: ' kỹ thuật viên nhận đến tận nhà tại {name}{province}. Mọi hồ sơ đều đã được duyệt chứng chỉ hành nghề trước khi hiển thị.',
      other: ' kỹ thuật viên nhận đến tận nhà tại {name}{province}. Mọi hồ sơ đều đã được duyệt chứng chỉ hành nghề trước khi hiển thị.',
    },
    leadEmpty:
      'Chưa có kỹ thuật viên nào nhận khu vực {name}. Bạn có thể xem các quận lân cận bên dưới — nhiều KTV nhận đi trong bán kính 10km.',
    thinNotice:
      'Khu vực này còn ít kỹ thuật viên. Thử mở rộng sang quận lân cận để có nhiều lựa chọn hơn.',

    listTitle: 'Kỹ thuật viên tại {name}',
    listEmpty: 'Chưa có hồ sơ nào trong khu vực này.',
    nearby: 'Khu vực lân cận',

    howToTitle: 'Chọn kỹ thuật viên ở {name} thế nào',
    howTo1:
      'Ưu tiên hồ sơ có chứng chỉ hành nghề đã duyệt — chứng chỉ hiển thị công khai ngay trên trang hồ sơ.',
    howTo2:
      'Đọc đánh giá thật của khách trước đó. Hồ sơ mới có ít đánh giá không đồng nghĩa với kém, nhưng nên hỏi kỹ hơn về kinh nghiệm.',
    howTo3:
      'Trao đổi rõ dịch vụ, thời lượng và giá trước khi hẹn giờ. Bảng giá trên hồ sơ là giá khởi điểm.',
    howTo4:
      'Nếu KTV ở xa {name}, hãy xác nhận lại phí di chuyển — bán kính nhận khách của mỗi người khác nhau.',

    jsonLdItemList: 'Kỹ thuật viên massage tại nhà {name}',
  },

  servicePage: {
    metaTitle: '{name} tại nhà',
    metaDescriptionFallback:
      'Tìm kỹ thuật viên {nameLower} nhận đến tận nhà, có chứng chỉ hành nghề.',
    h1: '{name} tại nhà',
    byArea: 'Tìm {nameLower} theo khu vực',
  },

  ktvProfile: {
    metaTitle: '{name} — KTV massage tại nhà',
    metaDescription:
      '{name}, {years} năm kinh nghiệm massage trị liệu tại nhà{area}. Chứng chỉ hành nghề đã duyệt, bảng giá công khai, đánh giá thật từ khách.',
    metaAreaPrefix: ' khu vực {area}',

    avatarAlt: 'Ảnh đại diện của {name}',
    certCount: {
      one: '{count} chứng chỉ đã duyệt',
      other: '{count} chứng chỉ đã duyệt',
    },
    online: 'Đang nhận khách',
    radius: 'nhận đi trong',
    reviewCountInline: {
      one: '· {count} đánh giá ·',
      other: '· {count} đánh giá ·',
    },
    newProfileInline: 'Hồ sơ mới · chưa có đánh giá ·',
    experience: {
      one: '{count} năm kinh nghiệm',
      other: '{count} năm kinh nghiệm',
    },

    certsTitle: 'Chứng chỉ hành nghề đã duyệt',
    certChecked: 'Đã đối chiếu',
    bioTitle: 'Giới thiệu',
    photosTitle: 'Hình ảnh',
    areasTitle: 'Khu vực nhận khách',
    priceFrom: 'giá từ',
    minutes: 'phút',

    reviewsTitle: 'Đánh giá của khách',
    ratingFrom: {
      one: 'từ {count} đánh giá',
      other: 'từ {count} đánh giá',
    },
    starsSr: '{rating} trên 5 sao',
    noReviews: 'Chưa có đánh giá nào.',

    /**
     * Nhãn cho nội dung do người dùng viết, chỉ hiện ở bản tiếng Anh.
     *
     * Bản tiếng Việt để rỗng: với người đọc tiếng Việt thì đó là ngôn ngữ mặc định
     * của cả trang, nói ra thành thừa.
     */
    writtenInVietnamese: '',
  },

  search: {
    metaTitle: 'Tìm kỹ thuật viên massage tại nhà',
    metaDescription:
      'Tìm kỹ thuật viên massage trị liệu nhận đến tận nhà theo vị trí hiện tại hoặc theo quận/huyện.',

    headingArea: {
      one: '{count} kỹ thuật viên tại {area}',
      other: '{count} kỹ thuật viên tại {area}',
    },
    headingNearby: {
      one: '{count} kỹ thuật viên quanh bạn',
      other: '{count} kỹ thuật viên quanh bạn',
    },
    headingPlain: {
      one: '{count} kỹ thuật viên',
      other: '{count} kỹ thuật viên',
    },
    headingIdle: 'Tìm kỹ thuật viên',

    sortLabel: 'Sắp xếp:',
    sortBest: 'Phù hợp nhất',
    empty: 'Chưa có KTV nào khớp. Thử tăng bán kính hoặc bỏ bớt bộ lọc dịch vụ.',
    errorLoad: 'Không tải được kết quả. Vui lòng thử lại.',
    promptPre: 'Bấm ',
    promptAction: 'Tìm quanh tôi',
    promptPost: ' để tìm theo vị trí hiện tại, hoặc chọn quận/huyện.',
  },

  myAccount: {
    metaTitle: 'Tài khoản của tôi',
    h1: 'Tài khoản của tôi',
    lead: 'Đánh giá bạn đã viết. Tìm và gọi kỹ thuật viên không cần đăng nhập.',
    reviewsTitle: 'Đánh giá đã viết',
    emptyTitle: 'Bạn chưa viết đánh giá nào.',
    emptyBody: 'Sau khi dùng dịch vụ, mở hồ sơ kỹ thuật viên đó để chấm điểm.',
    emptyCta: 'Tìm kỹ thuật viên',
    statusRejected: 'Đánh giá này đã bị gỡ và không còn hiển thị công khai.',
    statusRejectedReason: ' Lý do: {reason}',
    statusPending: 'Đánh giá đang chờ kiểm duyệt, chưa hiển thị công khai.',
    logout: 'Đăng xuất',
    loggingOut: 'Đang thoát…',
  },

  contact: {
    priceFrom: 'Giá từ',
    minutes: 'phút',
    callName: 'Gọi {name}',
    callNow: 'Gọi ngay',
    zalo: 'Nhắn Zalo',
    zaloShort: 'Zalo',
    fetching: 'Đang lấy số…',
    payLater: 'Trả sau buổi trị liệu',
    phoneLabel: 'Số điện thoại:',
    trust1: 'Số điện thoại hiện ngay khi bấm gọi',
    trust2: 'Thanh toán trực tiếp sau buổi trị liệu',
    trust3: 'Nền tảng không thu phí đặt lịch',
    errorRateLimited: 'Bạn đã bấm liên hệ quá nhiều lần. Thử lại sau ít phút.',
    errorNoPhone: 'Chưa lấy được số điện thoại. Vui lòng thử lại.',
    errorNetwork: 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
  },

  map: {
    yourLocation: 'Vị trí của bạn',
    viewMap: 'Xem bản đồ',
    viewList: 'Xem danh sách',
    mapLabel: 'Bản đồ vị trí kỹ thuật viên',
    distanceAway: 'cách bạn {distance}',
    noRating: 'Chưa có',
    clusterCount: '{count} tin',
    popupNoReviews: 'Chưa có đánh giá',
    popupRating: '★ {rating} · {count} đánh giá',
    searchHere: 'Tìm KTV trên toàn bản đồ',
    searching: 'Đang tìm…',
    expand: 'Mở rộng',
    closeMap: 'Đóng bản đồ',
    clampedHint: 'Bản đồ rộng hơn bán kính tìm tối đa — chỉ quét trong {km}km quanh tâm.',
    zoomHint: 'Phóng to bản đồ để xem thêm kỹ thuật viên khác',
    countInList: { one: '{count} kỹ thuật viên', other: '{count} kỹ thuật viên' },
  },

  reviewForm: {
    title: 'Viết đánh giá',
    subtitle:
      'Đánh giá hiển thị công khai ngay và mỗi tài khoản chỉ đánh giá một kỹ thuật viên một lần.',
    ratingLegend: 'Chấm điểm',
    starSr: '{star} sao',
    commentLabel: 'Nhận xét (không bắt buộc)',
    commentPlaceholder: 'Kỹ thuật viên tới đúng giờ chứ? Tay nghề thế nào?',
    submit: 'Gửi đánh giá',
    submitting: 'Đang gửi…',

    thanks: 'Cảm ơn bạn đã đánh giá {name}. Nhận xét của bạn đã hiển thị công khai.',
    viewMine: 'Xem đánh giá đã viết',

    loginQuestion: 'Bạn đã dùng dịch vụ của {name}?',
    loginAction: 'Đăng nhập',
    loginRest: 'để viết đánh giá. Không cần đăng nhập để tìm hoặc gọi.',

    errorNoRating: 'Chọn số sao trước khi gửi.',
    errorExpired: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để gửi đánh giá.',
    errorDuplicate: 'Bạn đã đánh giá kỹ thuật viên này rồi.',
    errorRateLimited: 'Bạn đã gửi khá nhiều đánh giá. Thử lại sau ít phút.',
    errorGeneric: 'Chưa gửi được đánh giá. Vui lòng thử lại.',
    errorNetwork: 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
  },

  report: {
    trigger: 'Báo cáo hồ sơ này',
    dialogTitle: 'Báo cáo hồ sơ',
    dialogIntro:
      'Báo cáo được gửi tới đội kiểm duyệt và không hiển thị công khai. Hồ sơ không bị ẩn ngay — chúng tôi xem xét trước khi xử lý.',
    reasonLegend: 'Lý do',
    reasonProstitution: 'Dấu hiệu dịch vụ trá hình',
    reasonInappropriate: 'Ảnh hoặc mô tả phản cảm',
    reasonFalseInfo: 'Thông tin sai sự thật',
    reasonImpersonation: 'Mạo danh người khác',
    reasonMisconduct: 'Thái độ không chuyên nghiệp',
    reasonOther: 'Lý do khác',
    detailLabel: 'Mô tả',
    detailOptional: '(không bắt buộc)',
    detailPlaceholder: 'Bạn thấy gì trên hồ sơ này?',
    submit: 'Gửi báo cáo',
    submitting: 'Đang gửi…',
    thanks: 'Cảm ơn bạn. Báo cáo đã được gửi tới đội kiểm duyệt.',
    errorNeedDetail: 'Chọn "Lý do khác" thì cần mô tả cụ thể giúp chúng tôi.',
    errorRateLimited: 'Bạn đã gửi khá nhiều báo cáo. Vui lòng thử lại sau ít phút.',
    errorGeneric: 'Chưa gửi được báo cáo. Vui lòng thử lại.',
    errorNetwork: 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.',
  },

  filters: {
    nearMe: 'Tìm quanh tôi',
    locating: 'Đang định vị…',
    areaLabel: 'Khu vực',
    areaPlaceholder: 'Nhập quận, huyện hoặc phường…',
    serviceLabel: 'Dịch vụ',
    serviceAll: 'Tất cả',
    radiusLabel: 'Bán kính',
    onlineOnly: 'Đang nhận khách',
    verifiedOnly: 'Chỉ hồ sơ đã duyệt',
    viewGroupLabel: 'Cách hiển thị kết quả',
    viewList: 'Danh sách',
    viewMap: 'Bản đồ',
    geoUnsupported: 'Trình duyệt không hỗ trợ định vị.',
    geoFailed: 'Chưa lấy được vị trí. Bạn có thể chọn quận/huyện bên dưới.',
    areaClear: 'Xoá khu vực đang chọn',
    areaSuggestions: 'Gợi ý khu vực',
    areaKtvCount: { one: '{count} KTV', other: '{count} KTV' },
    areaNoKtv: 'Chưa có KTV',
  },
} as const;
