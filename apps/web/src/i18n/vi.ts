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
    home: 'Trang chủ',
    ktvUnit: 'KTV',
    from: 'từ',
    loading: 'Đang tải…',
    retry: 'Thử lại',
    close: 'Đóng',
    cancel: 'Huỷ',
  },

  /**
   * Thông báo validate của form.
   *
   * Thay chuỗi mặc định của trình duyệt, vốn theo ngôn ngữ **trình duyệt** chứ không
   * theo ngôn ngữ trang — xem `lib/use-form-validation.ts`. Viết như người nói với
   * người: nói cần làm gì, không đọc lại tên thuộc tính HTML.
   */
  validation: {
    required: 'Vui lòng điền vào ô này.',
    tooShort: 'Cần ít nhất {min} ký tự — bạn đang nhập {current}.',
    tooLong: 'Tối đa {max} ký tự.',
    rangeUnderflow: 'Giá trị phải từ {min} trở lên.',
    rangeOverflow: 'Giá trị không được vượt quá {max}.',
    stepMismatch: 'Giá trị này không hợp lệ.',
    patternMismatch: 'Định dạng chưa đúng.',
    typeMismatch: 'Định dạng chưa đúng.',
    invalid: 'Giá trị chưa hợp lệ.',
  },

  shell: {
    /* Dòng định vị nhỏ dưới tên sàn ở header. Lưu dạng câu thường, CSS lo `uppercase`
       — giống mọi chuỗi khác trong file, để bản dịch không phải mang theo kiểu chữ. */
    logoTagline: 'Massage tận nơi',
    navHome: 'Trang chủ',
    navLocation: 'Chọn vị trí',
    navFindKtv: 'Tìm KTV',
    navHcm: 'TP.HCM',
    navHanoi: 'Hà Nội',
    navHowWeVerify: 'Cách chúng tôi duyệt hồ sơ',
    /* Hai biến thể vì header ở 360px đã chật: nav chứa nút vị trí (rộng tới 9rem)
       ngay cạnh nút này và cả hai đều `whitespace-nowrap`. Bản ngắn hiện dưới `sm`,
       bản đủ từ `sm` trở lên. Hai key riêng chứ KHÔNG cắt chuỗi bằng JS — cắt theo
       số ký tự sẽ gãy giữa từ ở bản EN và ở mọi bản dịch thêm sau. */
    navForKtv: 'Trở thành KTV MasGo',
    navForKtvShort: 'Trở thành KTV',
    /* Lời hứa ở đây phải là thứ kiểm được ở `AdminService.DecideProfileAsync` — nơi
       duy nhất quyết định hồ sơ nào được hiển thị. Điều kiện thật là CCCD đã đối chiếu
       và bản cam kết đã ký; chứng chỉ hành nghề tuỳ chọn, nên không hứa thay nó được. */
    footerBlurb:
      '{siteName} — nền tảng kết nối khách với kỹ thuật viên massage thư giãn, chăm sóc cơ thể tận nơi. Mọi hồ sơ hiển thị đều đã được đối chiếu danh tính.',
    languageLabel: 'Ngôn ngữ',
    switchToEnglish: 'English',
    switchToVietnamese: 'Tiếng Việt',
  },

  home: {
    metaTitle: '{siteName} — massage thư giãn tận nơi, hồ sơ đã xác thực',
    metaDescription:
      'Tìm kỹ thuật viên massage thư giãn tận nơi theo khu vực, xem bảng giá và đánh giá thật trước khi đặt lịch.',
    /* Con số truyền vào là `verifiedKtvCount` — số hồ sơ đã **duyệt**, không phải số
       hồ sơ có chứng chỉ. Câu chữ phải nói đúng thứ con số đang đếm. */
    verifiedBadge: {
      one: '{count} kỹ thuật viên đã đối chiếu danh tính',
      other: '{count} kỹ thuật viên đã đối chiếu danh tính',
    },
    /*
      H1 tách làm hai dòng: dòng đầu mang tên sàn, dòng sau nói việc khách đang định
      làm. Vế đầu nói ĐÚNG thứ sàn làm — **kết nối**, không phải "đặt lịch": hệ thống
      không có thực thể lịch hẹn nào, khách bấm gọi rồi tự gọi cho KTV. Cũng không
      nhắc "cơ sở, spa" vì chỉ có hồ sơ KTV cá nhân, mỗi tài khoản đúng một hồ sơ.
    */
    heroTitleLine1: 'MasGo — sàn kết nối massage tận nơi',
    heroTitleLine2: 'Tìm đúng dịch vụ, chọn đúng người',
    heroSubtitle:
      'Thư giãn ngay tại nhà bạn. Xem hồ sơ, bảng giá và đánh giá thật của kỹ thuật viên gần bạn trước khi đặt lịch.',
    heroImageAlt:
      'Kỹ thuật viên mặc đồng phục đang massage thư giãn vùng lưng cho khách trên giường massage tại nhà',
    /* Thẻ minh hoạ giao diện nổi trên ảnh hero. Chú thích mới là phần mang thông tin
       thật của khối — bản thân thẻ chỉ có hình dạng, không tên người, không con số. */
    heroCardCaption: 'Mỗi hồ sơ hiện đủ dịch vụ, giá, đánh giá và chứng chỉ nếu có',
    heroCardAria: 'Minh hoạ một thẻ hồ sơ kỹ thuật viên',
    heroCardVerified: 'Đã xác thực',

    /*
      Ba bước này phải mô tả đúng quy trình duyệt thật trong `DecideProfileAsync`:
      CCCD đã xác minh + cam kết đã ký, và chỉ hai thứ đó. Bản trước mô tả một quy
      trình đối chiếu chứng chỉ với đơn vị cấp — việc sàn không làm, và chứng chỉ
      cũng không phải điều kiện để hồ sơ xuất hiện.
    */
    verifyTitle: 'Hồ sơ được duyệt thế nào',
    verifySubtitle: 'Ba bước trước khi một hồ sơ được phép xuất hiện trong kết quả tìm kiếm.',
    step1Title: 'KTV gửi ảnh CCCD',
    step1Body:
      'Ảnh hai mặt căn cước công dân. Chỉ quản trị viên xem được, không bao giờ hiển thị công khai.',
    step2Title: 'Đối chiếu danh tính và ký cam kết',
    step2Body:
      'Chúng tôi kiểm tra ảnh giấy tờ, và kỹ thuật viên ký bản cam kết nghề nghiệp của nền tảng.',
    step3Title: 'Hồ sơ mở cho khách xem',
    step3Body:
      'Bạn thấy bảng giá, kinh nghiệm, đánh giá của khách trước, và chứng chỉ hành nghề nếu KTV có.',
    verifyImageAlt:
      'Kỹ thuật viên đã qua đối chiếu danh tính đang massage tay cho khách tại nhà',

    areasTitle: 'Tìm theo khu vực',
    areasSubtitle: 'Chọn quận/huyện để xem kỹ thuật viên nhận khách ở đó.',
    servicesTitle: 'Dịch vụ',
    servicesSubtitle: 'Mỗi kỹ thuật viên tự công bố bảng giá cho từng dịch vụ trên hồ sơ.',

    /*
      Ba lời hứa của sàn. Dùng ở HAI chỗ — hàng chip dưới mô tả hero và ba cột của dải
      khẩu hiệu — nên tên key bám đúng `TRUST_KEYS` trong HomeSloganBand.tsx.

      Hai dòng `trustProof*` nhận biến `{n}` / `{value}` chứ KHÔNG phải `{count}`:
      trong dự án này `count` là dấu hiệu của key số nhiều dạng `{ one, other }`, mà
      giá trị truyền vào đây đã là chuỗi định dạng sẵn theo locale. Đặt tên `count` là
      mời người sau "sửa" nó thành key số nhiều và làm sống lại đúng lỗi số thô.
    */
    trustVerifiedTitle: 'Hồ sơ xác thực',
    trustVerifiedBody:
      'An toàn, đáng tin cậy — mọi hồ sơ đều được đối chiếu căn cước trước khi hiển thị.',
    trustPriceTitle: 'Giá cả minh bạch',
    trustPriceBody: 'Không phát sinh — mỗi kỹ thuật viên công bố bảng giá ngay trên hồ sơ.',
    trustChoiceTitle: 'Chủ động lựa chọn',
    trustChoiceBody:
      'Đúng nhu cầu của bạn — xem ảnh, đánh giá và kinh nghiệm rồi tự quyết định.',
    trustProofVerified: '{n} hồ sơ đã đối chiếu danh tính',
    trustProofRating: '{value}/5 điểm trung bình từ khách',

    /* Tách hai vế để đặt được nhịp hai phách: vế hỏi nhẹ, vế trả lời nặng và mang
       gradient. KHÔNG ghép lại rồi `split('?')` — dấu chấm hỏi là quy ước của riêng
       tiếng Việt/Anh, bản dịch khác không chắc có nó, và lúc đó vế trả lời rỗng. */
    sloganAsk: 'Cần massage?',
    sloganAnswer: 'Bật MasGo',

    heroAreaLabel: 'Khu vực',
    heroAreaPlaceholder: 'Quận, huyện…',
    heroServiceLabel: 'Dịch vụ',
    heroServiceAll: 'Tất cả dịch vụ',
    heroSubmit: 'Tìm trên MasGo',
    heroGeoUnsupported: 'Trình duyệt không hỗ trợ định vị. Bạn có thể chọn quận/huyện.',
    heroGeoPromise: 'Chỉ hỏi vị trí khi bạn bấm — không tự xin quyền.',
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
    metaTitleRegister: 'Tạo tài khoản',
    headingCustomer: 'Đăng nhập hoặc tạo tài khoản',
    headingKtv: 'Đăng nhập cho kỹ thuật viên',
    intro:
      'Nhập số điện thoại, chúng tôi gửi mã {length} chữ số qua Zalo. Chưa có tài khoản thì hệ thống tự tạo. Không cần mật khẩu.',

    // Đăng nhập bằng mật khẩu (đường đang dùng). Các key OTP ở trên giữ nguyên cho
    // LoginForm, sẽ bật lại khi có giấy phép kinh doanh để dùng Zalo ZNS.
    headingLogin: 'Đăng nhập',
    headingRegisterCustomer: 'Tạo tài khoản',
    headingRegisterKtv: 'Đăng ký làm kỹ thuật viên',
    introLogin: 'Nhập số điện thoại và mật khẩu của bạn.',
    introRegister: 'Chỉ cần số điện thoại và mật khẩu. Không mất phí.',
    passwordLabel: 'Mật khẩu',
    passwordHint: 'Ít nhất {length} ký tự.',
    passwordConfirmLabel: 'Nhập lại mật khẩu',
    /* Nhãn hai tab trên `/dang-nhap`. Ngắn và là danh từ hành động, không phải câu —
       chúng nằm cạnh nhau trong một hàng hẹp và được đọc lướt chứ không đọc kỹ. */
    tabLogin: 'Đăng nhập',
    tabRegister: 'Đăng ký',
    tabAriaLabel: 'Chọn đăng nhập hoặc đăng ký',

    /* Màn hình cho người ĐÃ đăng nhập bấm vào lối vào KTV. Trước đây trang lặng lẽ
       đá họ về trang chủ, nên cú bấm trông như không có gì xảy ra. */
    alreadyTitle: 'Bạn đang đăng nhập bằng tài khoản khách',
    alreadyBody:
      'Tài khoản khách không mở được hồ sơ kỹ thuật viên. Vai trò được chốt lúc tạo tài khoản và không đổi được, nên bạn cần đăng xuất rồi đăng ký một tài khoản kỹ thuật viên mới.',
    alreadyLogout: 'Đăng xuất và đăng ký làm KTV',
    alreadyHome: 'Về trang chủ',
    submitLogin: 'Đăng nhập',
    submitRegister: 'Tạo tài khoản',
    submitting: 'Đang xử lý…',
    noAccountQuestion: 'Chưa có tài khoản?',
    noAccountAction: 'Tạo tài khoản mới',
    hasAccountQuestion: 'Đã có tài khoản?',
    hasAccountAction: 'Đăng nhập',
    errorWrongCredentials: 'Số điện thoại hoặc mật khẩu không đúng.',
    errorPhoneTaken: 'Số điện thoại này đã có tài khoản. Vui lòng đăng nhập.',
    errorLocked: 'Sai quá nhiều lần nên tài khoản tạm khoá. Vui lòng thử lại sau ít phút.',
    // Backend trả 400 khi số điện thoại sai định dạng. Câu này phải nói rõ ô nào
    // sai: trước đây 400 bị map thành errorLocked, nên người gõ nhầm một chữ số
    // được bảo là tài khoản đang bị khoá và ngồi chờ 15 phút một cách vô ích.
    errorInvalidPhone: 'Số điện thoại chưa đúng định dạng. Ví dụ: 0901234567.',
    errorPasswordMismatch: 'Hai lần nhập mật khẩu không giống nhau.',
    errorPasswordShort: 'Mật khẩu phải có ít nhất {length} ký tự.',

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
    stubNotice: 'Chế độ thử nghiệm: mã là {code}. Ở production, mã chỉ gửi qua Zalo.',

    errorSendFailed: 'Không gửi được mã. Kiểm tra lại số điện thoại.',
    errorProviderDown: 'Hệ thống gửi mã đang gặp sự cố. Vui lòng thử lại sau ít phút.',
    errorTooManyRequests: 'Bạn đã xin mã quá nhiều lần. Vui lòng chờ một lát rồi thử lại.',
    errorBadCode: 'Mã OTP không đúng hoặc đã hết hạn.',
    errorNetwork: 'Không kết nối được máy chủ.',

    crossLinkKtvQuestion: 'Bạn là khách đang tìm kỹ thuật viên?',
    crossLinkKtvAction: 'Đăng nhập tại đây',
    crossLinkCustomerQuestion: 'Bạn là kỹ thuật viên muốn nhận khách?',
    crossLinkCustomerAction: 'Tạo hồ sơ miễn phí',

    asideImageAlt: 'Ảnh KTV đang làm việc',
    asideTitleKtv: 'Hồ sơ đã duyệt được khách gọi nhiều hơn',
    asideTitleCustomer: 'Tài khoản để đánh giá và theo dõi',
    asideKtv1: 'Gửi ảnh CCCD một lần, chúng tôi đối chiếu và mở hồ sơ.',
    asideKtv2: 'Bạn tự đặt giá và khu vực nhận khách.',
    asideKtv3: 'Khách gọi trực tiếp, sàn không giữ tiền của bạn.',
    asideCustomer1: 'Viết đánh giá cho kỹ thuật viên bạn đã dùng.',
    asideCustomer2: 'Tìm kiếm và đặt lịch không cần tài khoản — đăng nhập chỉ để đánh giá.',
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
    metaTitle: 'Massage tận nơi {name}',
    metaDescription:
      '{count} kỹ thuật viên massage trị liệu nhận đến tận nhà tại {name}. Danh tính đã đối chiếu, có bảng giá và đánh giá thật của khách.',
    ogTitle: 'Massage tận nơi {name}',
    h1: 'Massage trị liệu tận nơi {name}',
    lead: {
      one: '{count} kỹ thuật viên đang nhận khách tại {name}. Chọn quận/huyện của bạn để xem những người ở gần nhất.',
      other: '{count} kỹ thuật viên đang nhận khách tại {name}. Chọn quận/huyện của bạn để xem những người ở gần nhất.',
    },
    pickDistrict: 'Chọn quận/huyện',
    featured: 'Kỹ thuật viên nổi bật tại {name}',
  },

  /**
   * Nhãn giới tính, dùng chung cho thẻ tìm kiếm và trang hồ sơ.
   *
   * Đặt ở cấp gốc chứ không nhét vào `ktvCard`: hai nơi hiển thị cùng một dữ liệu phải
   * đọc cùng một chuỗi, nếu không sẽ có ngày thẻ ghi "Nữ" còn hồ sơ ghi "KTV nữ".
   * Không có key cho trường hợp null — hồ sơ chưa khai thì không hiện gì cả.
   */
  gender: {
    FEMALE: 'Nữ',
    MALE: 'Nam',
  },

  ktvCard: {
    sponsored: 'Tài trợ',
    sponsoredTitle: 'Vị trí quảng cáo — KTV trả phí để hiện ở đây',
    newProfile: 'Hồ sơ mới',
    noReviews: 'chưa có đánh giá',
    noPrices: 'Chưa khai báo bảng giá',
    minutes: '{n} phút',
    viewProfile: 'Xem hồ sơ',
    call: 'Đặt lịch',
    reviews: {
      one: '{count} đánh giá',
      other: '{count} đánh giá',
    },
  },

  areaDistrict: {
    metaTitle: 'Massage tận nơi {name}',
    metaDescription:
      '{count} kỹ thuật viên massage trị liệu nhận khách tại {name}, {province}. Xem chứng chỉ, bảng giá và đánh giá thật trước khi gọi.',
    ogTitle: 'Massage tận nơi {name}',
    h1: 'Massage trị liệu tận nơi {name}',

    leadPre: 'Hiện có ',
    leadPost: {
      one: ' kỹ thuật viên nhận đến tận nhà tại {name}{province}. Mọi hồ sơ đều đã được đối chiếu danh tính trước khi hiển thị.',
      other: ' kỹ thuật viên nhận đến tận nhà tại {name}{province}. Mọi hồ sơ đều đã được đối chiếu danh tính trước khi hiển thị.',
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

    jsonLdItemList: 'Kỹ thuật viên massage tận nơi {name}',
  },

  servicePage: {
    metaTitle: '{name} tận nơi',
    metaDescriptionFallback:
      'Tìm kỹ thuật viên {nameLower} nhận đến tận nhà, danh tính đã đối chiếu.',
    h1: '{name} tận nơi',
    byArea: 'Tìm {nameLower} theo khu vực',
  },

  ktvProfile: {
    metaTitle: '{name} — KTV massage tận nơi',
    metaDescription:
      '{name}, {years} năm kinh nghiệm massage trị liệu tận nơi{area}. Danh tính đã đối chiếu, bảng giá công khai, đánh giá thật từ khách.',
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

  /**
   * Ba trang pháp lý: /an-toan, /dieu-khoan, /chinh-sach-bao-mat.
   *
   * Danh tính pháp nhân **không** nằm ở đây mà ở `lib/legal.ts` — tên doanh nghiệp,
   * MST và địa chỉ đăng ký không dịch, và để chúng trong dictionary là mời một bản
   * "cho thuận tai" đi vào đúng chỗ cần nguyên văn theo giấy phép.
   *
   * Mỗi đoạn văn là một key riêng thay vì một mảng: bộ dịch ở `t.ts` chỉ trả chuỗi,
   * và một mảng trong dictionary sẽ không được TypeScript ép bản EN khai đủ phần tử —
   * bản dịch thiếu một đoạn giữa văn bản pháp lý là kiểu sai không ai nhìn ra.
   */
  legal: {
    effectiveDate: 'Có hiệu lực từ {date}',
    tocTitle: 'Nội dung trang',
    entityHeading: 'Đơn vị vận hành',
    entityName: 'Đơn vị vận hành',
    entityAddress: 'Địa chỉ',
    entityTaxCode: 'Mã số doanh nghiệp',
    entityPrivacyEmail: 'Liên hệ về dữ liệu cá nhân',
    entitySupportEmail: 'Hỗ trợ chung',
    relatedTitle: 'Trang liên quan',
    navSafety: 'An toàn và quy tắc cộng đồng',
    navTerms: 'Điều khoản sử dụng',
    navPrivacy: 'Chính sách bảo vệ dữ liệu cá nhân',
    /* Chỉ hiện khi lib/legal.ts còn placeholder, và chỉ ngoài production. Câu chữ
       nói với người phát triển chứ không với khách — nhưng vẫn phải có bản EN vì
       nó nằm trong dictionary, và người dev có thể đang mở bản /en. */
    placeholderWarning:
      'Cảnh báo dành cho người phát triển: thông tin pháp nhân trong lib/legal.ts chưa được điền. Không đưa trang này lên production khi cảnh báo còn hiện.',
  },

  safety: {
    metaTitle: 'An toàn và quy tắc cộng đồng',
    metaDescription:
      'Cách MasGo đối chiếu danh tính kỹ thuật viên, những dịch vụ bị cấm tuyệt đối trên nền tảng, và cách báo cáo một hồ sơ vi phạm.',
    h1: 'An toàn và quy tắc cộng đồng',
    lead: 'MasGo là nền tảng kết nối dịch vụ massage trị liệu và chăm sóc cơ thể tận nơi. Trang này nói rõ chúng tôi kiểm tra điều gì trước khi một hồ sơ được hiển thị, những gì bị cấm tuyệt đối, và bạn làm gì khi gặp một hồ sơ sai.',

    scopeTitle: 'Phạm vi dịch vụ trên nền tảng',
    scopeBody:
      'MasGo chỉ dành cho dịch vụ massage, xoa bóp, thư giãn và chăm sóc cơ thể trong phạm vi pháp luật Việt Nam cho phép. Đây là nền tảng trị liệu, không phải nền tảng dịch vụ người lớn.',
    scopeProhibitedTitle: 'Bị cấm tuyệt đối',
    /* Bốn dòng này là bản rút gọn cho khách của các dòng trong KtvCommitments ở
       backend. Chúng phải giữ đúng nghĩa vụ đã ghi ở đó — nếu bản cam kết đổi thì
       đọc lại cả bốn dòng này. Đây chính là dạng lỗi "câu chữ UI trôi khỏi luật
       backend mà không có gì báo đỏ". */
    scopeProhibited1:
      'Mại dâm, kích dục, môi giới mại dâm hoặc dịch vụ tình dục dưới mọi hình thức.',
    scopeProhibited2:
      'Hình ảnh khiêu dâm, gợi dục, hoặc ảnh của người khác dùng làm ảnh hồ sơ.',
    scopeProhibited3: 'Thông tin sai sự thật về danh tính, kinh nghiệm hoặc chứng chỉ.',
    scopeProhibited4: 'Mọi hoạt động bị pháp luật Việt Nam cấm.',
    scopeEnforcement:
      'Hồ sơ vi phạm bị gỡ khỏi kết quả tìm kiếm, không hoàn lại chi phí gói đẩy tin đang chạy, và tài khoản có thể bị khoá vĩnh viễn.',

    verifyTitle: 'Chúng tôi kiểm tra gì trước khi hồ sơ hiển thị',
    /* Hai điều kiện dưới đây phải khớp ĐÚNG AdminService.DecideProfileAsync. Thêm
       một điều kiện backend không kiểm là hứa với khách thứ sàn không giữ — đúng
       lỗi đã phải đi sửa hàng loạt câu chữ ngày 2026-09-09. */
    verifyLead:
      'Một hồ sơ chỉ xuất hiện trong kết quả tìm kiếm sau khi quản trị viên duyệt thủ công. Có đúng hai điều kiện bắt buộc, và cả hai đều được hệ thống chặn ở khâu duyệt:',
    verifyStep1Title: 'Đối chiếu giấy tờ tuỳ thân',
    verifyStep1Body:
      'Kỹ thuật viên phải gửi ảnh hai mặt căn cước công dân và được quản trị viên đối chiếu với thông tin khai trong hồ sơ. Hồ sơ chưa có căn cước đã xác minh thì hệ thống từ chối duyệt.',
    verifyStep2Title: 'Ký cam kết nội dung và pháp lý',
    verifyStep2Body:
      'Kỹ thuật viên phải chấp nhận bản cam kết đang có hiệu lực, trong đó có điều khoản không cung cấp dịch vụ mại dâm hay kích dục dưới bất kỳ hình thức nào. Chúng tôi lưu lại phiên bản cam kết, thời điểm và địa chỉ IP lúc ký.',
    verifyPhotoTitle: 'Ảnh cũng phải qua duyệt',
    verifyPhotoBody:
      'Ảnh đại diện và ảnh trong thư viện của kỹ thuật viên đều được duyệt riêng trước khi hiển thị công khai, kể cả với hồ sơ đã được duyệt từ trước.',
    /* Nói rõ chứng chỉ là tuỳ chọn. Không nói ra thì khách tự hiểu là bắt buộc —
       và đó chính là lời hứa sai đã phải gỡ khỏi footer và ~700 meta description
       ngày 2026-09-09. */
    verifyCertTitle: 'Về chứng chỉ hành nghề',
    verifyCertBody:
      'Chứng chỉ hành nghề là thông tin tuỳ chọn, không phải điều kiện để hồ sơ được duyệt. Khi kỹ thuật viên có gửi, chứng chỉ được quản trị viên duyệt riêng và hiển thị trên hồ sơ. Bạn có thể xem trước khi liên hệ và ưu tiên hồ sơ đã có chứng chỉ.',
    verifyLimitTitle: 'Điều chúng tôi không thể đảm bảo',
    /* Khối này bắt buộc phải có. Một trang an toàn chỉ liệt kê thứ mình làm được
       sẽ đọc như bảo lãnh cho từng cuộc hẹn — thứ sàn không thể bảo lãnh, và là
       chỗ tranh chấp sẽ rơi vào. */
    verifyLimitBody:
      'MasGo đối chiếu danh tính và duyệt nội dung hồ sơ. Chúng tôi không giám sát buổi trị liệu, không phải bên cung cấp dịch vụ, và không thể bảo đảm chất lượng hay hành vi của từng cá nhân trong từng cuộc hẹn. Hãy đọc đánh giá, xem kỹ hồ sơ và tin vào cảm nhận của bạn.',

    customerTitle: 'Lời khuyên an toàn cho khách',
    customerTip1Title: 'Thống nhất rõ trước khi hẹn',
    customerTip1Body:
      'Trao đổi rõ dịch vụ, thời lượng và giá trước khi chốt lịch. Bảng giá hiển thị trên hồ sơ là giá do kỹ thuật viên tự công bố.',
    customerTip2Title: 'Kiểm tra khi gặp mặt',
    customerTip2Body:
      'Người đến làm phải là người trong hồ sơ bạn đã chọn. Nếu không khớp, bạn có quyền từ chối buổi hẹn và báo cáo hồ sơ đó.',
    customerTip3Title: 'Nói không với mọi đề nghị ngoài phạm vi',
    customerTip3Body:
      'Nếu bị gợi ý dịch vụ ngoài phạm vi massage trị liệu, hãy dừng buổi hẹn và báo cáo. Đây là vi phạm nghiêm trọng và chúng tôi xử lý ở mức khoá tài khoản.',
    customerTip4Title: 'Viết đánh giá sau khi dùng dịch vụ',
    customerTip4Body:
      'Đánh giá của bạn là thứ giúp khách sau chọn đúng người. Chúng tôi rà soát và gỡ những đánh giá có dấu hiệu giả mạo.',

    ktvTitle: 'An toàn cho kỹ thuật viên',
    ktvBody:
      'Bạn có quyền từ chối hoặc dừng buổi hẹn khi khách đề nghị dịch vụ ngoài phạm vi, khi địa điểm không an toàn, hoặc khi bạn cảm thấy bị đe doạ. Hãy báo lại cho chúng tôi — việc từ chối một cuốc không ảnh hưởng tới thứ hạng hồ sơ của bạn.',

    reportTitle: 'Báo cáo một hồ sơ vi phạm',
    reportBody:
      'Mỗi trang hồ sơ đều có nút báo cáo và bạn không cần đăng nhập để dùng. Chúng tôi xem xét mọi báo cáo và ưu tiên những hồ sơ bị nhiều người báo cáo cùng lúc.',
    /* Nói thẳng rằng báo cáo không tự ẩn hồ sơ. Đây là quyết định kiến trúc có
       chủ ý (một nút ẩn được bằng vài lần bấm là vũ khí để KTV hạ nhau) và giấu
       nó đi sẽ khiến người báo cáo tưởng hệ thống hỏng khi hồ sơ vẫn còn đó. */
    reportNote:
      'Báo cáo không tự động ẩn hồ sơ. Việc gỡ một hồ sơ luôn do quản trị viên quyết định sau khi xem xét, để tránh việc báo cáo bị dùng làm công cụ hạ uy tín lẫn nhau.',
    reportUrgentTitle: 'Trường hợp khẩn cấp',
    reportUrgentBody:
      'Nếu bạn đang gặp nguy hiểm hoặc chứng kiến hành vi phạm tội, hãy gọi 113 trước. Sau đó báo cho chúng tôi để xử lý tài khoản liên quan.',
    reportCta: 'Tìm hồ sơ để báo cáo',
  },

  terms: {
    metaTitle: 'Điều khoản sử dụng',
    metaDescription:
      'Điều khoản sử dụng nền tảng MasGo: vai trò của nền tảng, quyền và nghĩa vụ của khách và kỹ thuật viên, quy định về gói đẩy tin và chấm dứt tài khoản.',
    h1: 'Điều khoản sử dụng',
    lead: 'Khi truy cập hoặc sử dụng MasGo, bạn đồng ý với các điều khoản dưới đây. Nếu không đồng ý, vui lòng ngừng sử dụng nền tảng.',

    s1Title: '1. Vai trò của nền tảng',
    /* Điểm quan trọng nhất của cả trang: MasGo là nơi kết nối, không phải bên
       cung cấp dịch vụ. Mọi điều khoản về trách nhiệm phía dưới đều dựa vào đây. */
    s1p1:
      'MasGo là nền tảng trung gian kết nối khách hàng với kỹ thuật viên massage độc lập. Chúng tôi không tuyển dụng kỹ thuật viên, không trực tiếp cung cấp dịch vụ massage, và không phải là một bên trong hợp đồng dịch vụ giữa bạn và kỹ thuật viên.',
    s1p2:
      'Việc thanh toán cho buổi trị liệu diễn ra trực tiếp giữa khách và kỹ thuật viên. MasGo không thu hoa hồng trên từng cuốc và không giữ tiền dịch vụ.',

    s2Title: '2. Tài khoản',
    s2p1:
      'Bạn phải từ đủ 18 tuổi để tạo tài khoản. Mỗi số điện thoại tương ứng với một tài khoản, và bạn chịu trách nhiệm về mọi hoạt động diễn ra dưới tài khoản của mình.',
    s2p2:
      'Vui lòng giữ mật khẩu an toàn và thông báo cho chúng tôi ngay khi nghi ngờ tài khoản bị truy cập trái phép.',

    s3Title: '3. Nghĩa vụ của kỹ thuật viên',
    s3p1:
      'Kỹ thuật viên chịu trách nhiệm về tính chính xác của thông tin hồ sơ, tính hợp pháp của hoạt động cung cấp dịch vụ, và việc tuân thủ bản cam kết đã ký khi đăng ký.',
    s3p2:
      'Kỹ thuật viên tự thực hiện nghĩa vụ thuế đối với thu nhập từ hoạt động của mình theo quy định pháp luật.',
    s3p3: 'Nội dung bị cấm và hệ quả vi phạm được nêu tại trang An toàn và quy tắc cộng đồng.',

    s4Title: '4. Nghĩa vụ của khách hàng',
    s4p1:
      'Bạn đồng ý sử dụng nền tảng đúng mục đích, không quấy rối kỹ thuật viên, không đề nghị dịch vụ ngoài phạm vi massage trị liệu, và không đăng đánh giá sai sự thật.',
    s4p2:
      'Thông tin liên hệ của kỹ thuật viên chỉ được dùng để đặt dịch vụ. Nghiêm cấm thu thập, sao chép hoặc sử dụng dữ liệu trên nền tảng cho mục đích khác.',

    s5Title: '5. Đánh giá và nội dung người dùng',
    s5p1:
      'Đánh giá phải dựa trên trải nghiệm thật. Chúng tôi gỡ những đánh giá có dấu hiệu giả mạo, xúc phạm, hoặc không liên quan tới dịch vụ.',
    s5p2:
      'Khi đăng nội dung lên nền tảng, bạn cấp cho MasGo quyền hiển thị nội dung đó trên nền tảng và trong kết quả tìm kiếm. Bạn vẫn giữ quyền sở hữu đối với nội dung của mình.',

    s6Title: '6. Gói đẩy tin và thanh toán trên nền tảng',
    s6p1:
      'Kỹ thuật viên có thể nạp tiền vào ví trong tài khoản để mua các gói tăng khả năng hiển thị. Số dư ví chỉ dùng để mua dịch vụ trên nền tảng.',
    s6p2:
      'Gói đẩy tin ảnh hưởng tới thứ tự hiển thị trong kết quả tìm kiếm. Gói đẩy tin không thay đổi kết quả duyệt hồ sơ và không phải là sự bảo chứng của MasGo về chất lượng dịch vụ.',
    s6p3:
      'Khi huỷ một chiến dịch đang chạy, phần thời gian chưa sử dụng được hoàn về ví theo đúng đơn vị thời gian của gói. Phần thời gian đã chạy không được hoàn.',
    s6p4: 'Chi phí gói đẩy tin của hồ sơ bị gỡ do vi phạm sẽ không được hoàn lại.',

    s7Title: '7. Tạm khoá và chấm dứt',
    s7p1:
      'Chúng tôi có thể tạm khoá hoặc xoá tài khoản khi phát hiện vi phạm điều khoản, vi phạm bản cam kết, hoặc khi có yêu cầu từ cơ quan có thẩm quyền.',
    s7p2:
      'Bạn có thể ngừng sử dụng dịch vụ bất kỳ lúc nào. Liên hệ chúng tôi để yêu cầu xoá tài khoản và dữ liệu cá nhân.',

    s8Title: '8. Giới hạn trách nhiệm',
    s8p1:
      'MasGo cung cấp nền tảng ở trạng thái hiện có. Chúng tôi nỗ lực đối chiếu danh tính và duyệt nội dung hồ sơ, nhưng không bảo đảm chất lượng, tính an toàn hay hành vi của kỹ thuật viên trong từng buổi hẹn cụ thể.',
    s8p2:
      'Trong phạm vi pháp luật cho phép, MasGo không chịu trách nhiệm với thiệt hại phát sinh từ quan hệ dịch vụ trực tiếp giữa khách và kỹ thuật viên.',

    s9Title: '9. Thay đổi điều khoản',
    s9p1:
      'Chúng tôi có thể cập nhật điều khoản này. Ngày hiệu lực luôn được ghi ở đầu trang. Việc tiếp tục sử dụng nền tảng sau khi điều khoản được cập nhật đồng nghĩa với việc bạn chấp nhận bản mới.',

    s10Title: '10. Luật áp dụng và liên hệ',
    s10p1:
      'Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Tranh chấp được ưu tiên giải quyết bằng thương lượng trước khi đưa ra toà án có thẩm quyền.',
  },

  privacy: {
    metaTitle: 'Chính sách bảo vệ dữ liệu cá nhân',
    metaDescription:
      'Chính sách bảo vệ dữ liệu cá nhân của MasGo: dữ liệu chúng tôi thu thập, mục đích sử dụng, thời gian lưu trữ và quyền của bạn theo Nghị định 13/2023/NĐ-CP.',
    h1: 'Chính sách bảo vệ dữ liệu cá nhân',
    lead:
      'Chính sách này mô tả cách MasGo thu thập, sử dụng và bảo vệ dữ liệu cá nhân của bạn, theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.',

    s1Title: '1. Dữ liệu chúng tôi thu thập',
    s1CustomerTitle: 'Với khách hàng',
    s1Customer1: 'Số điện thoại và mật khẩu đã mã hoá, dùng để đăng nhập.',
    s1Customer2:
      'Vị trí gần đúng khi bạn chủ động bấm tìm quanh mình. Vị trí chỉ dùng cho lượt tìm kiếm đó và không được lưu vào tài khoản của bạn.',
    s1Customer3: 'Nội dung đánh giá bạn viết, gắn với tài khoản của bạn.',
    s1Customer4:
      'Địa chỉ IP và thông tin trình duyệt khi bạn bấm liên hệ hoặc báo cáo, dùng để gộp các lượt trùng và chống lạm dụng.',
    s1KtvTitle: 'Với kỹ thuật viên',
    /* Nêu đích danh CCCD là dữ liệu nhạy cảm và nói rõ chúng tôi KHÔNG lưu số —
       đây là quyết định kiến trúc có thật (chỉ lưu ảnh, không lưu số và tên trên
       thẻ) và là điểm mạnh nhất của chính sách này. */
    s1Ktv1:
      'Ảnh hai mặt căn cước công dân, dùng để đối chiếu danh tính. Đây là dữ liệu cá nhân nhạy cảm.',
    s1Ktv2:
      'Chúng tôi cố ý không lưu số căn cước và họ tên in trên thẻ vào cơ sở dữ liệu. Quản trị viên đối chiếu trực tiếp trên ảnh khi duyệt hồ sơ.',
    s1Ktv3:
      'Thông tin hồ sơ công khai: tên hiển thị, giới tính, năm kinh nghiệm, khu vực hoạt động, bảng giá, ảnh đại diện và ảnh thư viện.',
    s1Ktv4:
      'Toạ độ khu vực hoạt động. Trên hồ sơ công khai, toạ độ được làm tròn khoảng 100 mét và địa chỉ chi tiết không bao giờ được hiển thị.',
    s1Ktv5:
      'Phiên bản cam kết đã ký, thời điểm và địa chỉ IP lúc ký, dùng làm bằng chứng chấp thuận.',
    s1Ktv6: 'Lịch sử giao dịch ví và gói đẩy tin đã mua.',

    s2Title: '2. Mục đích sử dụng',
    s2p1:
      'Vận hành nền tảng: hiển thị hồ sơ, tìm kiếm theo vị trí, kết nối khách với kỹ thuật viên.',
    s2p2: 'Đối chiếu danh tính và duyệt nội dung hồ sơ trước khi hiển thị công khai.',
    s2p3:
      'Chống gian lận: gộp lượt liên hệ trùng, phát hiện đánh giá giả, xử lý báo cáo vi phạm.',
    s2p4: 'Thống kê hiệu quả hiển thị cho kỹ thuật viên và đối soát ví.',
    s2p5: 'Thực hiện nghĩa vụ theo yêu cầu của cơ quan nhà nước có thẩm quyền.',

    s3Title: '3. Chia sẻ dữ liệu',
    /* Nêu đúng và đủ những gì thật sự được chia sẻ. Số điện thoại KTV chỉ lộ khi
       khách bấm liên hệ — đó là quyết định chống quét số đã có từ Phase 1. */
    s3p1:
      'Chúng tôi không bán dữ liệu cá nhân. Số điện thoại của kỹ thuật viên chỉ được cung cấp cho khách tại thời điểm khách chủ động bấm liên hệ, và không hiển thị công khai trên trang hồ sơ.',
    s3p2:
      'Ảnh căn cước công dân và chứng chỉ không bao giờ được hiển thị công khai. Chúng chỉ được truy cập bởi quản trị viên trong quá trình duyệt hồ sơ, qua đường dẫn có thời hạn ngắn.',
    s3p3:
      'Chúng tôi sử dụng nhà cung cấp hạ tầng để lưu trữ dữ liệu và tệp tin. Các bên này xử lý dữ liệu theo hướng dẫn của chúng tôi và không được dùng cho mục đích riêng.',

    s4Title: '4. Thời gian lưu trữ',
    s4p1:
      'Dữ liệu tài khoản được lưu trong suốt thời gian tài khoản còn hoạt động. Khi bạn yêu cầu xoá tài khoản, chúng tôi xoá dữ liệu cá nhân trừ phần bắt buộc phải giữ theo quy định pháp luật.',
    s4p2:
      'Dữ liệu thống kê hiển thị được lưu tối đa sáu tháng rồi tự động xoá. Lịch sử giao dịch ví được giữ lâu hơn để phục vụ đối soát và giải quyết tranh chấp.',

    s5Title: '5. Quyền của bạn',
    s5Lead:
      'Theo Nghị định 13/2023/NĐ-CP, bạn có các quyền sau đối với dữ liệu cá nhân của mình:',
    s5r1: 'Quyền được biết dữ liệu nào của bạn đang được xử lý và xử lý vào mục đích gì.',
    s5r2: 'Quyền truy cập, xem và yêu cầu cung cấp bản sao dữ liệu của bạn.',
    s5r3: 'Quyền chỉnh sửa dữ liệu không chính xác.',
    s5r4: 'Quyền rút lại sự đồng ý đã cấp.',
    s5r5: 'Quyền yêu cầu xoá dữ liệu và xoá tài khoản.',
    s5r6: 'Quyền phản đối hoặc yêu cầu hạn chế việc xử lý dữ liệu.',
    s5r7: 'Quyền khiếu nại tới cơ quan nhà nước có thẩm quyền.',
    s5Contact:
      'Để thực hiện các quyền trên, vui lòng liên hệ với chúng tôi. Chúng tôi phản hồi trong vòng 72 giờ kể từ khi nhận được yêu cầu hợp lệ.',

    s6Title: '6. Bảo mật',
    s6p1:
      'Mật khẩu được mã hoá một chiều và không thể khôi phục về dạng gốc. Kết nối tới nền tảng được mã hoá. Giấy tờ tuỳ thân được lưu ở khu vực riêng và chỉ truy cập được qua đường dẫn có thời hạn.',
    s6p2:
      'Không có hệ thống nào an toàn tuyệt đối. Khi xảy ra sự cố ảnh hưởng tới dữ liệu cá nhân, chúng tôi thông báo cho người bị ảnh hưởng và cơ quan có thẩm quyền theo quy định.',

    s7Title: '7. Trẻ em',
    s7p1:
      'Nền tảng không dành cho người dưới 18 tuổi. Chúng tôi không chủ ý thu thập dữ liệu của trẻ em và sẽ xoá ngay khi phát hiện.',

    s8Title: '8. Cookie và lưu trữ trên trình duyệt',
    /* Ba chỗ dùng browser storage đã được ghi lại trong rules — nói đúng ba chỗ
       đó thay vì một câu chung chung về cookie. */
    s8p1:
      'Chúng tôi dùng cookie kỹ thuật để giữ phiên đăng nhập. Cookie này không dùng cho quảng cáo và không chia sẻ với bên thứ ba.',
    s8p2:
      'Trình duyệt của bạn lưu một vài tuỳ chọn hiển thị ngay trên máy: khu vực bạn đã chọn gần nhất, việc bạn đã đọc thông báo dành cho kỹ thuật viên, và việc gợi ý bộ lọc đã hiện trong phiên này. Những dữ liệu này không được gửi về máy chủ và bạn có thể xoá bằng cách xoá dữ liệu trang trong trình duyệt.',

    s9Title: '9. Thay đổi chính sách',
    s9p1:
      'Khi chính sách này thay đổi, ngày hiệu lực ở đầu trang được cập nhật. Với thay đổi ảnh hưởng đáng kể tới quyền của bạn, chúng tôi sẽ thông báo trực tiếp.',
  },

  search: {
    metaTitle: 'Tìm kỹ thuật viên massage tận nơi',
    metaDescription:
      'Tìm kỹ thuật viên massage thư giãn tận nơi theo vị trí hiện tại hoặc theo quận/huyện.',

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
    lead: 'Đánh giá bạn đã viết. Tìm và đặt lịch kỹ thuật viên không cần đăng nhập.',
    reviewsTitle: 'Đánh giá đã viết',
    emptyTitle: 'Bạn chưa viết đánh giá nào.',
    emptyBody: 'Sau khi dùng dịch vụ, mở hồ sơ kỹ thuật viên đó để chấm điểm.',
    emptyCta: 'Tìm kỹ thuật viên',
    statusRejected: 'Đánh giá này đã bị gỡ và không còn hiển thị công khai.',
    statusRejectedReason: ' Lý do: {reason}',
    statusPending: 'Đánh giá đang chờ kiểm duyệt, chưa hiển thị công khai.',
    logout: 'Đăng xuất',
    loggingOut: 'Đang thoát…',

    passwordTitle: 'Đổi mật khẩu',
    passwordTitleSet: 'Đặt mật khẩu',
    passwordIntro: 'Nhập mật khẩu hiện tại rồi chọn mật khẩu mới.',
    passwordIntroSet:
      'Tài khoản của bạn chưa có mật khẩu. Đặt một mật khẩu để lần sau đăng nhập nhanh hơn.',
    passwordCurrent: 'Mật khẩu hiện tại',
    passwordNew: 'Mật khẩu mới',
    passwordConfirm: 'Nhập lại mật khẩu mới',
    passwordHint: 'Ít nhất {length} ký tự.',
    passwordSubmit: 'Đổi mật khẩu',
    passwordSubmitSet: 'Đặt mật khẩu',
    passwordSubmitting: 'Đang lưu…',
    passwordSuccess: 'Đã cập nhật mật khẩu.',
    passwordErrorMismatch: 'Hai lần nhập mật khẩu mới không giống nhau.',
    passwordErrorShort: 'Mật khẩu phải có ít nhất {length} ký tự.',
    passwordErrorWrongCurrent: 'Mật khẩu hiện tại không đúng.',
    passwordErrorGeneric: 'Không lưu được mật khẩu. Vui lòng thử lại.',
  },

  contact: {
    priceFrom: 'Giá từ',
    minutes: 'phút',
    // Cố ý KHÔNG có tên KTV (bỏ 2026-09-10). Khách đang đứng trên trang hồ sơ của
    // đúng người đó, tên đã ở tiêu đề ngay phía trên — nhắc lại trong nút chỉ đẩy chữ
    // xuống hai dòng ở khối cột phải hẹp. Key giữ tên `callName` để khỏi phải sửa chỗ
    // gọi; `{name}` không còn nên biến truyền vào cũng đã gỡ.
    callName: 'Đặt lịch',
    // Thanh dính đáy mobile giữ "ngay": ở đó nút nằm tách khỏi mọi ngữ cảnh khác và
    // là thứ duy nhất trên thanh, nên một từ thúc giục còn chỗ đứng.
    callNow: 'Đặt lịch ngay',
    zalo: 'Nhắn Zalo',
    zaloShort: 'Zalo',
    fetching: 'Đang lấy số…',
    payLater: 'Trả sau buổi massage',
    phoneLabel: 'Số điện thoại:',
    phoneRevealed: 'Số điện thoại của {name}',
    copy: 'Sao chép',
    copied: 'Đã chép',
    trust1: 'Bấm đặt lịch là hiện số điện thoại để bạn gọi trực tiếp',
    trust2: 'Thanh toán trực tiếp sau buổi massage',
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
    loginRest: 'để viết đánh giá. Không cần đăng nhập để tìm hoặc đặt lịch.',

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
    // Ba câu cho ba tình huống, vì việc khách phải làm tiếp khác hẳn nhau. Trước đây
    // cả ba dùng chung `geoFailed`: người bị chặn quyền đọc "chưa lấy được vị trí"
    // rồi bấm lại mãi mà không bao giờ có popup nào hiện ra, vì trình duyệt đã nhớ
    // lựa chọn "Chặn" và không hỏi lại nữa.
    geoDenied:
      'Bạn đã chặn quyền vị trí cho trang này. Mở phần cài đặt quyền của trình duyệt (biểu tượng khoá cạnh địa chỉ web) để bật lại, hoặc chọn quận/huyện bên dưới.',
    geoFailed:
      'Chưa lấy được vị trí. Thử lại ở nơi thoáng, hoặc chọn quận/huyện bên dưới.',
    geoDismiss: 'Đã hiểu',
    areaClear: 'Xoá khu vực đang chọn',
    areaSuggestions: 'Gợi ý khu vực',
    areaKtvCount: { one: '{count} KTV', other: '{count} KTV' },
    areaNoKtv: 'Chưa có KTV',

    // Popup lọc nâng cao. Nhãn nút mang luôn số bộ lọc đang bật: bộ lọc nằm trong
    // popup là bộ lọc khách không nhìn thấy, nên kết quả bị thu hẹp mà không có gì
    // trên màn hình giải thích vì sao lại ít hồ sơ đến vậy.
    moreFilters: 'Bộ lọc',
    moreFiltersActive: 'Bộ lọc ({count})',
    filterDialogTitle: 'Lọc kỹ thuật viên',
    filterDialogClose: 'Đóng',
    genderLabel: 'Giới tính',
    genderAny: 'Không giới hạn',
    genderFemale: 'Nữ',
    genderMale: 'Nam',
    // Câu này bắt buộc phải có: hồ sơ chưa khai giới tính bị loại khỏi kết quả, và
    // không nói ra thì khách thấy danh sách ngắn đi mà tưởng khu vực mình ít KTV.
    genderNote: 'Hồ sơ chưa khai giới tính sẽ không hiện khi bạn lọc mục này.',
    experienceLabel: 'Kinh nghiệm tối thiểu',
    experienceAny: 'Không giới hạn',
    experienceYears: { one: 'Từ {count} năm', other: 'Từ {count} năm' },
    ratingLabel: 'Đánh giá tối thiểu',
    ratingAny: 'Không giới hạn',
    ratingStars: 'Từ {count} sao',
    ratingNote: 'Chỉ hiện hồ sơ đã có đánh giá.',
    statusLabel: 'Trạng thái',
    filterReset: 'Xoá bộ lọc',
    filterApply: 'Xem kết quả',
  },
} as const;
