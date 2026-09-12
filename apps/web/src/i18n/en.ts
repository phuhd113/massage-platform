import type { Dictionary } from './dictionaries';

/**
 * Bản tiếng Anh cho khách nước ngoài đang ở Việt Nam.
 *
 * Kiểu `Dictionary` suy từ `vi.ts`, nên thiếu key là build đỏ — đó là toàn bộ cơ
 * chế kiểm soát độ phủ bản dịch.
 *
 * Giọng văn bám theo bản tiếng Việt: nói thẳng điều kiểm chứng được trên site
 * ("identity documents checked"), không dùng ngôn ngữ quảng cáo. Đây là ngành mà
 * Google phạt nặng khi phân loại nhầm, nên mọi câu phải đọc như một dịch vụ trị
 * liệu chứ không như lời mời gọi.
 *
 * Ví dụ cũ ở dòng này từng là "certificates checked against the issuer" — chính
 * câu đã phải gỡ vì sàn không làm việc đó và chứng chỉ không phải điều kiện để
 * hồ sơ hiển thị. "Kiểm chứng được" nghĩa là kiểm được ở `DecideProfileAsync`,
 * không phải nghe có vẻ cụ thể.
 */
export const en: Dictionary = {
  common: {
    home: 'Home',
    ktvUnit: 'therapists',
    from: 'from',
    loading: 'Loading…',
    retry: 'Try again',
    close: 'Close',
    cancel: 'Cancel',
  },

  validation: {
    required: 'Please fill in this field.',
    tooShort: 'Please use at least {min} characters — you have {current}.',
    tooLong: 'Please use at most {max} characters.',
    rangeUnderflow: 'Please enter {min} or more.',
    rangeOverflow: 'Please enter {max} or less.',
    stepMismatch: 'That value is not allowed.',
    patternMismatch: 'That format is not quite right.',
    typeMismatch: 'That format is not quite right.',
    invalid: 'That value is not valid.',
  },

  shell: {
    /* Slogan, không phải nhãn danh mục — đối xứng với bản vi (xem ghi chú ở đó).
       Giữ nguyên "MasGo.vn": tên sàn và tên miền không dịch, và `PublicShell` đã bỏ
       `uppercase` nên chữ hoa ở đây là chữ hiện ra.

       Gạch ngang thay dấu hỏi là chủ ý, và cũng ngắn hơn: header tiếng Anh chật hơn
       hẳn tiếng Việt ở cùng bề rộng vì nhãn nav dài hơn ("Become a therapist"). Câu
       dài thêm ở đây là đẩy thẳng vào chỗ đã hết. */
    logoTagline: 'Need a massage - Open MasGo.vn',
    navHome: 'Home',
    navLocation: 'Set location',
    navFindKtv: 'Find a therapist',
    navHcm: 'Ho Chi Minh City',
    navHanoi: 'Hanoi',
    navHowWeVerify: 'How we verify',
    navForKtv: 'Become a MasGo therapist',
    navForKtvShort: 'Become a therapist',
    footerBlurb:
      '{siteName} — connecting clients with relaxation and body-care massage therapists who come to your home. Every profile shown has had its identity documents checked.',
    languageLabel: 'Language',
    switchToEnglish: 'English',
    switchToVietnamese: 'Tiếng Việt',
  },

  home: {
    /* "certified" ở đây từng là một khẳng định về **từng** therapist, mạnh hơn hẳn vế
       tiếng Việt vốn chỉ là cụm từ khoá danh mục. Điều kiểm được là danh tính đã đối
       chiếu, nên đó là từ dùng ở mọi chỗ khẳng định; các câu chỉ nói "xem được chứng
       chỉ" thì giữ nguyên vì đó là tính năng có thật. */
    metaTitle: '{siteName} — verified therapists who come to you',
    metaDescription:
      'Find massage therapists who visit your home in Vietnam. See prices, real reviews and distance before you book.',
    /* Vế đầu giữ nguyên tên miền đầy đủ như bản tiếng Việt: đó là phần khách gõ lại ở
       lần sau, và nó không dịch. Vế sau dịch nghĩa chứ không dịch chữ — bản tiếng Việt
       là một câu danh ngữ ("Nền tảng kết nối…"), dựng nguyên cấu trúc đó sang tiếng Anh
       cho ra một mệnh đề cụt. `verifiedBadge` và `heroSubtitle` đã xoá cùng lúc với bản
       vi; lý do đầy đủ ghi ở `i18n/vi.ts`. */
    heroTitleLine1: 'Need a massage? Open MasGo.vn',
    heroTitleLine2: 'The marketplace for massage that comes to you.',
    heroImageAlt:
      'A uniformed therapist giving a back massage to a client on a massage table at home',
    heroCardCaption: 'Every profile shows services, prices, reviews and certificates if any',
    heroCardAria: 'Illustration of a therapist profile card',
    heroCardVerified: 'Verified',

    verifyTitle: 'How profiles are verified',
    verifySubtitle: 'Three steps before a profile is allowed to appear in search results.',
    step1Title: 'The therapist submits their ID card',
    step1Body:
      'Photos of both sides of their national ID card. Only administrators can see them — they are never shown publicly.',
    step2Title: 'We check the identity and take a commitment',
    step2Body:
      'We check the ID photos, and the therapist signs the platform’s professional commitment.',
    step3Title: 'The profile opens to clients',
    step3Body:
      'You can see prices, experience, what previous clients said, and a practising certificate if the therapist has one.',
    verifyImageAlt:
      'A therapist with verified identity documents massaging a client’s arm at home',

    areasTitle: 'Browse by area',
    areasSubtitle: 'Pick a district to see the therapists who travel there.',
    servicesTitle: 'Services',
    servicesSubtitle: 'Each therapist publishes their own prices for every service on their profile.',

    trustVerifiedTitle: 'Verified profiles',
    trustVerifiedBody:
      'Safe and trustworthy — every profile has its ID checked before it is listed.',
    trustPriceTitle: 'Transparent prices',
    trustPriceBody:
      'No surprises — every therapist publishes their prices on their profile.',
    trustChoiceTitle: 'You choose',
    trustChoiceBody:
      'On your terms — see photos, reviews and experience, then decide for yourself.',
    trustProofVerified: '{n} profiles with identity checked',
    trustProofRating: '{value}/5 average client rating',

    sloganAsk: 'Need a massage -',
    sloganVerb: 'Open',
    sloganBrand: 'MasGo.vn',

    heroAreaLabel: 'Area',
    heroAreaPlaceholder: 'District, ward…',
    heroServiceLabel: 'Service',
    heroServiceAll: 'All services',
    heroSubmit: 'Search MasGo',
    heroGeoUnsupported: 'Your browser does not support location. You can choose a district instead.',
    heroGeoPromise: 'We only ask for your location when you tap — never on our own.',
  },

  notFound: {
    title: 'Page not found',
    body: 'This page does not exist, or the profile is no longer listed.',
    backHome: 'Back to home',
  },

  account: {
    login: 'Log in',
    myAccount: 'My account',
  },

  login: {
    metaTitleCustomer: 'Log in',
    metaTitleKtv: 'Register as a therapist',
    metaTitleRegister: 'Create an account',
    headingCustomer: 'Log in or create an account',
    headingKtv: 'Therapist login',
    intro:
      'Enter your phone number and we will send a {length}-digit code to your Zalo. If you do not have an account yet, one is created for you. No password needed.',

    headingLogin: 'Log in',
    headingRegisterCustomer: 'Create an account',
    headingRegisterKtv: 'Sign up as a therapist',
    introLogin: 'Enter your phone number and password.',
    introRegister: 'All you need is a phone number and a password. It is free.',
    passwordLabel: 'Password',
    passwordHint: 'At least {length} characters.',
    passwordConfirmLabel: 'Confirm password',
    tabLogin: 'Log in',
    tabRegister: 'Sign up',
    tabAriaLabel: 'Choose log in or sign up',

    alreadyTitle: 'You are signed in as a client',
    alreadyBody:
      'A client account cannot open a therapist profile. The role is fixed when the account is created and cannot be changed, so you need to log out and sign up for a new therapist account.',
    alreadyLogout: 'Log out and sign up as a therapist',
    alreadyHome: 'Back to home',
    submitLogin: 'Log in',
    submitRegister: 'Create account',
    submitting: 'Working…',
    noAccountQuestion: 'No account yet?',
    noAccountAction: 'Create one',
    hasAccountQuestion: 'Already have an account?',
    hasAccountAction: 'Log in',
    errorWrongCredentials: 'That phone number or password is wrong.',
    errorPhoneTaken: 'That phone number already has an account. Please log in.',
    errorLocked: 'Too many wrong attempts, so this account is locked for a few minutes.',
    errorInvalidPhone: 'That phone number is not in a valid format. Example: 0901234567.',
    errorPasswordMismatch: 'The two passwords do not match.',
    errorPasswordShort: 'Your password must be at least {length} characters.',

    phoneLabel: 'Phone number',
    sendCode: 'Send code',
    sending: 'Sending…',

    step2: 'Step 2 · enter the code',
    codeInputLabel: '{length}-digit verification code',
    changePhone: 'Change phone number',
    resend: 'Resend code',
    resendIn: 'Resend code in',
    submit: 'Log in',
    verifying: 'Checking…',
    stubNotice: 'Test mode: the code is {code}. In production it is only sent via Zalo.',

    errorSendFailed: 'Could not send the code. Please check the phone number.',
    errorProviderDown: 'Our code delivery service is temporarily down. Please try again in a few minutes.',
    errorTooManyRequests: 'Too many code requests. Please wait a moment and try again.',
    errorBadCode: 'That code is wrong or has expired.',
    errorNetwork: 'Could not reach the server.',

    crossLinkKtvQuestion: 'Looking for a therapist instead?',
    crossLinkKtvAction: 'Log in here',
    crossLinkCustomerQuestion: 'Are you a therapist looking for clients?',
    crossLinkCustomerAction: 'Create a free profile',

    asideImageAlt: 'Photo of a therapist at work',
    asideTitleKtv: 'Verified profiles get more calls',
    asideTitleCustomer: 'An account for reviews and history',
    asideKtv1: 'Submit your ID card once — we check it and open your profile.',
    asideKtv2: 'You set your own prices and the areas you travel to.',
    asideKtv3: 'Clients call you directly; we never hold your money.',
    asideCustomer1: 'Review the therapists you have booked.',
    asideCustomer2: 'Searching and booking need no account — logging in is only for reviews.',
    asideCustomer3: 'We charge clients no booking fee.',
  },

  breadcrumbs: {
    label: 'Breadcrumb',
  },

  areaStats: {
    priceRange: 'Typical price',
    avgRating: 'Average rating',
    topService: 'Most requested service',
  },

  areaProvince: {
    metaTitle: 'Home massage in {name}',
    metaDescription:
      '{count} massage therapists travel to homes in {name}. Verified identity documents, published prices and real client reviews.',
    ogTitle: 'Home massage in {name}',
    h1: 'Home massage therapy in {name}',
    lead: {
      one: '{count} therapist is taking clients in {name}. Pick your district to see who is closest.',
      other: '{count} therapists are taking clients in {name}. Pick your district to see who is closest.',
    },
    pickDistrict: 'Choose a district',
    featured: 'Featured therapists in {name}',
  },

  gender: {
    FEMALE: 'Female',
    MALE: 'Male',
  },

  ktvCard: {
    sponsored: 'Sponsored',
    sponsoredTitle: 'Advertised placement — this therapist paid to appear here',
    newProfile: 'New profile',
    noReviews: 'no reviews yet',
    noPrices: 'No prices listed yet',
    minutes: '{n} min',
    viewProfile: 'View profile',
    call: 'Book',
    reviews: {
      one: '{count} review',
      other: '{count} reviews',
    },
  },

  areaDistrict: {
    metaTitle: 'Home massage in {name}',
    metaDescription:
      '{count} massage therapists travel to homes in {name}, {province}. Check certificates, prices and reviews before you call.',
    ogTitle: 'Home massage in {name}',
    h1: 'Home massage therapy in {name}',

    leadPre: 'There are ',
    leadPost: {
      one: ' therapist travelling to homes in {name}{province}. Every profile has had its identity documents verified before being listed.',
      other: ' therapists travelling to homes in {name}{province}. Every profile has had its identity documents verified before being listed.',
    },
    leadEmpty:
      'No therapist covers {name} yet. Have a look at the nearby districts below — many therapists travel within a 10km radius.',
    thinNotice:
      'This area has few therapists so far. Widening your search to a neighbouring district will give you more choice.',

    listTitle: 'Therapists in {name}',
    listEmpty: 'No profiles in this area yet.',
    nearby: 'Nearby areas',

    howToTitle: 'How to choose a therapist in {name}',
    howTo1:
      'Favour profiles with a verified practising certificate — the certificate is shown openly on the profile page.',
    howTo2:
      'Read reviews from previous clients. A new profile with few reviews is not necessarily worse, but it is worth asking more about experience.',
    howTo3:
      'Agree on the service, the length and the price before fixing a time. Prices on a profile are starting prices.',
    howTo4:
      'If the therapist is far from {name}, confirm any travel fee — each one sets their own coverage radius.',

    jsonLdItemList: 'Home massage therapists in {name}',
  },

  servicePage: {
    metaTitle: '{name} at home',
    metaDescriptionFallback:
      'Find identity-verified therapists offering {nameLower} in your own home.',
    h1: '{name} at home',
    byArea: 'Find {nameLower} by area',
  },

  ktvProfile: {
    metaTitle: '{name} — home massage therapist',
    metaDescription:
      '{name}, {years} years of experience in home massage therapy{area}. Verified identity, published prices and real client reviews.',
    metaAreaPrefix: ' in {area}',

    avatarAlt: 'Profile photo of {name}',
    certCount: {
      one: '{count} verified certificate',
      other: '{count} verified certificates',
    },
    online: 'Available now',
    radius: 'travels up to',
    reviewCountInline: {
      one: '· {count} review ·',
      other: '· {count} reviews ·',
    },
    newProfileInline: 'New profile · no reviews yet ·',
    experience: {
      one: '{count} year of experience',
      other: '{count} years of experience',
    },

    certsTitle: 'Verified practising certificates',
    certChecked: 'Checked',
    photosTitle: 'Photos',
    areasTitle: 'Areas covered',
    priceFrom: 'from',
    minutes: 'min',

    reviewsTitle: 'Client reviews',
    ratingFrom: {
      one: 'from {count} review',
      other: 'from {count} reviews',
    },
    starsSr: '{rating} out of 5 stars',
    noReviews: 'No reviews yet.',

    writtenInVietnamese: 'Written in Vietnamese',
  },

  /**
   * Ba trang pháp lý. Bản EN phải khai **đúng mức khẳng định** như bản VI, không
   * mạnh hơn: bài học từ `verifiedBadge` ngày 2026-09-09, nơi "certified therapists"
   * là khẳng định về từng người trong khi vế tiếng Việt chỉ là cụm từ khoá danh mục.
   * Văn bản pháp lý thì hệ quả của việc lệch mức khẳng định là một lời hứa với khách
   * nước ngoài mà sàn không giữ.
   */
  legal: {
    effectiveDate: 'Effective from {date}',
    tocTitle: 'On this page',
    entityHeading: 'Platform operator',
    entityName: 'Operating entity',
    entityAddress: 'Address',
    entityTaxCode: 'Business registration number',
    entityPrivacyEmail: 'Personal data enquiries',
    entitySupportEmail: 'General support',
    relatedTitle: 'Related pages',
    navSafety: 'Safety and community rules',
    navTerms: 'Terms of use',
    navPrivacy: 'Personal data protection policy',
    placeholderWarning:
      'Developer warning: the operator details in lib/legal.ts have not been filled in. Do not ship this page to production while this warning is visible.',
  },

  safety: {
    metaTitle: 'Safety and community rules',
    metaDescription:
      'How MasGo checks therapist identity documents, which services are strictly prohibited on the platform, and how to report a profile that breaks the rules.',
    h1: 'Safety and community rules',
    lead: 'MasGo connects customers with independent therapists for in-home therapeutic massage and body care. This page explains what we check before a profile goes live, what is strictly prohibited, and what to do when you come across a profile that breaks the rules.',

    scopeTitle: 'What this platform is for',
    scopeBody:
      'MasGo is only for massage, therapeutic bodywork, relaxation and body care services permitted under Vietnamese law. This is a therapeutic platform, not an adult services platform.',
    scopeProhibitedTitle: 'Strictly prohibited',
    scopeProhibited1:
      'Prostitution, sexual stimulation, procuring, or sexual services of any kind.',
    scopeProhibited2:
      'Pornographic or sexually suggestive images, or using another person photo as a profile picture.',
    scopeProhibited3: 'False information about identity, experience or certifications.',
    scopeProhibited4: 'Any activity prohibited under Vietnamese law.',
    scopeEnforcement:
      'Profiles that break these rules are removed from search results with no refund for any promotion package still running, and the account may be permanently suspended.',

    verifyTitle: 'What we check before a profile goes live',
    verifyLead:
      'A profile only appears in search results after an administrator approves it manually. There are exactly two mandatory conditions, and the system enforces both at the approval step:',
    verifyStep1Title: 'Identity document check',
    verifyStep1Body:
      'The therapist must submit photographs of both sides of their national ID card, and an administrator must check them against the details in the profile. The system refuses to approve a profile without a verified ID document.',
    verifyStep2Title: 'Signed content and legal undertaking',
    verifyStep2Body:
      'The therapist must accept the undertaking currently in force, which includes a clause prohibiting prostitution and sexual stimulation services in any form. We record the version accepted, the time, and the IP address used.',
    verifyPhotoTitle: 'Photos are reviewed too',
    verifyPhotoBody:
      'Profile pictures and gallery photos are each reviewed before they appear publicly, including on profiles that were approved earlier.',
    verifyCertTitle: 'About professional certifications',
    verifyCertBody:
      'A professional certification is optional and is not a condition for a profile to be approved. When a therapist does submit one, it is reviewed separately and shown on the profile. You can check it before getting in touch and give preference to profiles that have one.',
    verifyLimitTitle: 'What we cannot guarantee',
    verifyLimitBody:
      'MasGo checks identity documents and reviews profile content. We do not supervise appointments, we are not the service provider, and we cannot guarantee the quality or conduct of any individual in any given appointment. Read the reviews, look at the profile carefully, and trust your own judgement.',

    customerTitle: 'Safety advice for customers',
    customerTip1Title: 'Agree the details before you book',
    customerTip1Body:
      'Settle the service, duration and price before confirming. Prices shown on a profile are set by the therapist themselves.',
    customerTip2Title: 'Check when they arrive',
    customerTip2Body:
      'The person who arrives should be the person in the profile you chose. If they do not match, you are entitled to turn the appointment down and report that profile.',
    customerTip3Title: 'Refuse anything outside the scope',
    customerTip3Body:
      'If you are offered anything beyond therapeutic massage, end the appointment and report it. This is a serious breach and we act on it by suspending the account.',
    customerTip4Title: 'Leave a review afterwards',
    customerTip4Body:
      'Your review is what helps the next customer choose well. We screen reviews and remove those that show signs of being fake.',

    ktvTitle: 'Safety for therapists',
    ktvBody:
      'You are entitled to refuse or end an appointment when a customer asks for something outside the scope of the service, when the location is unsafe, or when you feel threatened. Report it to us — turning down a job does not affect your profile ranking.',

    reportTitle: 'Reporting a profile',
    reportBody:
      'Every profile page has a report button and you do not need an account to use it. We look at every report and prioritise profiles that several people report around the same time.',
    reportNote:
      'A report does not hide a profile automatically. Removing a profile is always an administrator decision made after review, so that reporting cannot be used as a way to damage a competitor.',
    reportUrgentTitle: 'In an emergency',
    reportUrgentBody:
      'If you are in danger or witness a crime, call 113 first. Then let us know so we can deal with the account involved.',
    reportCta: 'Browse profiles',
  },

  terms: {
    metaTitle: 'Terms of use',
    metaDescription:
      'MasGo terms of use: the role of the platform, the rights and obligations of customers and therapists, and the rules covering promotion packages and account termination.',
    h1: 'Terms of use',
    lead: 'By accessing or using MasGo you agree to the terms below. If you do not agree with them, please stop using the platform.',

    s1Title: '1. The role of the platform',
    s1p1:
      'MasGo is an intermediary platform connecting customers with independent massage therapists. We do not employ therapists, we do not provide massage services ourselves, and we are not a party to the service agreement between you and the therapist.',
    s1p2:
      'Payment for a treatment is made directly between the customer and the therapist. MasGo does not take a commission on individual jobs and does not hold service payments.',

    s2Title: '2. Accounts',
    s2p1:
      'You must be at least 18 years old to create an account. Each phone number corresponds to one account, and you are responsible for everything done under your account.',
    s2p2:
      'Please keep your password safe and tell us as soon as you suspect your account has been accessed by someone else.',

    s3Title: '3. Therapist obligations',
    s3p1:
      'Therapists are responsible for the accuracy of their profile information, the legality of the services they provide, and compliance with the undertaking they signed at registration.',
    s3p2:
      'Therapists are responsible for their own tax obligations on income earned through their work, as required by law.',
    s3p3:
      'Prohibited content and the consequences of breaching these rules are set out on the Safety and community rules page.',

    s4Title: '4. Customer obligations',
    s4p1:
      'You agree to use the platform for its intended purpose, not to harass therapists, not to request anything outside the scope of therapeutic massage, and not to post false reviews.',
    s4p2:
      'Therapist contact details may only be used to book a service. Collecting, copying or using platform data for any other purpose is prohibited.',

    s5Title: '5. Reviews and user content',
    s5p1:
      'Reviews must be based on a genuine experience. We remove reviews that appear fake, abusive, or unrelated to the service.',
    s5p2:
      'When you post content to the platform, you grant MasGo the right to display that content on the platform and in search results. You retain ownership of your content.',

    s6Title: '6. Promotion packages and platform payments',
    s6p1:
      'Therapists can add funds to the wallet in their account to buy packages that increase their visibility. The wallet balance can only be used to buy services on the platform.',
    s6p2:
      'Promotion packages affect the order in which profiles appear in search results. They do not affect the outcome of profile approval and are not an endorsement by MasGo of the quality of the service.',
    s6p3:
      'When a running campaign is cancelled, the unused time is refunded to the wallet in the same time unit as the package. Time already used is not refunded.',
    s6p4:
      'No refund is given for promotion packages on a profile that is removed for breaching these terms.',

    s7Title: '7. Suspension and termination',
    s7p1:
      'We may suspend or delete an account when we find a breach of these terms or of the signed undertaking, or when required to do so by a competent authority.',
    s7p2:
      'You may stop using the service at any time. Contact us to request deletion of your account and personal data.',

    s8Title: '8. Limitation of liability',
    s8p1:
      'MasGo provides the platform on an as-is basis. We make every effort to check identity documents and review profile content, but we do not guarantee the quality, safety or conduct of a therapist in any specific appointment.',
    s8p2:
      'To the extent permitted by law, MasGo is not liable for loss arising out of the direct service relationship between a customer and a therapist.',

    s9Title: '9. Changes to these terms',
    s9p1:
      'We may update these terms. The effective date is always shown at the top of this page. Continuing to use the platform after an update means you accept the new version.',

    s10Title: '10. Governing law and contact',
    s10p1:
      'These terms are governed by Vietnamese law. Disputes will first be addressed through negotiation before being brought before a competent court.',
  },

  privacy: {
    metaTitle: 'Personal data protection policy',
    metaDescription:
      'MasGo personal data protection policy: the data we collect, what we use it for, how long we keep it, and your rights under Decree 13/2023/ND-CP.',
    h1: 'Personal data protection policy',
    lead:
      'This policy describes how MasGo collects, uses and protects your personal data, in line with Decree 13/2023/ND-CP on personal data protection.',

    s1Title: '1. Data we collect',
    s1CustomerTitle: 'From customers',
    s1Customer1: 'Your phone number and an encrypted password, used to sign in.',
    s1Customer2:
      'Your approximate location when you actively choose to search near you. That location is used for that search only and is not saved to your account.',
    s1Customer3: 'The reviews you write, linked to your account.',
    s1Customer4:
      'Your IP address and browser details when you tap to make contact or submit a report, used to group duplicate actions together and to prevent abuse.',
    s1KtvTitle: 'From therapists',
    s1Ktv1:
      'Photographs of both sides of the national ID card, used to check identity. This is sensitive personal data.',
    s1Ktv2:
      'We deliberately do not store the ID number or the name printed on the card in our database. An administrator reads them from the photograph while reviewing the profile.',
    s1Ktv3:
      'Public profile information: display name, gender, years of experience, service areas, prices, profile picture and gallery photos.',
    s1Ktv4:
      'Coordinates of the service area. On the public profile these coordinates are rounded to roughly 100 metres, and the full address is never shown.',
    s1Ktv5:
      'The version of the undertaking accepted, together with the time and IP address, kept as a record of consent.',
    s1Ktv6: 'Wallet transaction history and promotion packages purchased.',

    s2Title: '2. What we use it for',
    s2p1:
      'Running the platform: showing profiles, searching by location, and connecting customers with therapists.',
    s2p2: 'Checking identity documents and reviewing profile content before it is published.',
    s2p3:
      'Preventing abuse: grouping duplicate contact events, detecting fake reviews, and handling reports.',
    s2p4: 'Producing visibility statistics for therapists and reconciling wallet balances.',
    s2p5: 'Meeting obligations at the request of a competent state authority.',

    s3Title: '3. Sharing data',
    s3p1:
      'We do not sell personal data. A therapist phone number is released to a customer only at the moment that customer actively taps to make contact, and it is never shown publicly on the profile page.',
    s3p2:
      'ID card photographs and certifications are never shown publicly. They are accessible only to administrators during profile review, through short-lived links.',
    s3p3:
      'We use infrastructure providers to store data and files. They process data on our instructions and may not use it for their own purposes.',

    s4Title: '4. How long we keep it',
    s4p1:
      'Account data is kept for as long as the account is active. When you ask us to delete your account, we delete your personal data except for anything we are legally required to keep.',
    s4p2:
      'Visibility statistics are kept for at most six months and then deleted automatically. Wallet transaction history is kept longer for reconciliation and dispute resolution.',

    s5Title: '5. Your rights',
    s5Lead:
      'Under Decree 13/2023/ND-CP you have the following rights over your personal data:',
    s5r1: 'The right to know what data of yours is being processed and for what purpose.',
    s5r2: 'The right to access your data and to request a copy of it.',
    s5r3: 'The right to have inaccurate data corrected.',
    s5r4: 'The right to withdraw consent you have given.',
    s5r5: 'The right to request deletion of your data and your account.',
    s5r6: 'The right to object to processing or to request that it be restricted.',
    s5r7: 'The right to complain to a competent state authority.',
    s5Contact:
      'To exercise any of these rights, please contact us. We respond within 72 hours of receiving a valid request.',

    s6Title: '6. Security',
    s6p1:
      'Passwords are hashed one way and cannot be recovered in their original form. Connections to the platform are encrypted. Identity documents are stored separately and are reachable only through time-limited links.',
    s6p2:
      'No system is completely secure. If an incident affects personal data, we notify the people affected and the competent authority as required.',

    s7Title: '7. Children',
    s7p1:
      'The platform is not intended for anyone under 18. We do not knowingly collect data from children and will delete it as soon as we become aware of it.',

    s8Title: '8. Cookies and browser storage',
    s8p1:
      'We use a technical cookie to keep you signed in. It is not used for advertising and is not shared with third parties.',
    s8p2:
      'Your browser stores a few display preferences on your own device: the area you last chose, whether you have read the notice for therapists, and whether the filter prompt has appeared during this session. This data is never sent to our servers, and you can remove it by clearing site data in your browser.',

    s9Title: '9. Changes to this policy',
    s9p1:
      'When this policy changes, the effective date at the top of the page is updated. Where a change materially affects your rights, we will tell you directly.',
  },

  search: {
    metaTitle: 'Find a home massage therapist',
    metaDescription:
      'Find massage therapists who travel to your home, by your current location or by district.',

    headingArea: {
      one: '{count} therapist in {area}',
      other: '{count} therapists in {area}',
    },
    headingNearby: {
      one: '{count} therapist near you',
      other: '{count} therapists near you',
    },
    headingPlain: {
      one: '{count} therapist',
      other: '{count} therapists',
    },
    headingIdle: 'Find a therapist',

    sortLabel: 'Sorted by:',
    sortBest: 'Best match',
    empty: 'No therapists match yet. Try a wider radius or remove the service filter.',
    errorLoad: 'Could not load the results. Please try again.',
    promptPre: 'Tap ',
    promptAction: 'Search near me',
    promptPost: ' to search from your current location, or choose a district.',
  },

  myAccount: {
    metaTitle: 'My account',
    h1: 'My account',
    lead: 'The reviews you have written. Searching and booking need no account.',
    reviewsTitle: 'Reviews written',
    emptyTitle: 'You have not written any reviews yet.',
    emptyBody: 'After a session, open that therapist profile to rate them.',
    emptyCta: 'Find a therapist',
    statusRejected: 'This review was taken down and is no longer shown publicly.',
    statusRejectedReason: ' Reason: {reason}',
    statusPending: 'This review is awaiting moderation and is not public yet.',
    logout: 'Log out',
    loggingOut: 'Logging out…',

    passwordTitle: 'Change password',
    passwordTitleSet: 'Set a password',
    passwordIntro: 'Enter your current password, then choose a new one.',
    passwordIntroSet:
      'Your account does not have a password yet. Set one to log in faster next time.',
    passwordCurrent: 'Current password',
    passwordNew: 'New password',
    passwordConfirm: 'Confirm new password',
    passwordHint: 'At least {length} characters.',
    passwordSubmit: 'Change password',
    passwordSubmitSet: 'Set password',
    passwordSubmitting: 'Saving…',
    passwordSuccess: 'Password updated.',
    passwordErrorMismatch: 'The two new passwords do not match.',
    passwordErrorShort: 'Your password must be at least {length} characters.',
    passwordErrorWrongCurrent: 'That is not your current password.',
    passwordErrorGeneric: 'Could not save your password. Please try again.',
  },

  contact: {
    priceFrom: 'From',
    minutes: 'min',
    // Không còn `{name}` — xem ghi chú ở bản vi.
    callName: 'Book now',
    callNow: 'Book now',
    zalo: 'Message on Zalo',
    zaloShort: 'Zalo',
    fetching: 'Getting the number…',
    payLater: 'Pay after the session',
    phoneLabel: 'Phone number:',
    phoneRevealed: "{name}'s phone number",
    copy: 'Copy',
    copied: 'Copied',
    trust1: 'Tap to book and the phone number appears so you can call directly',
    trust2: 'You pay the therapist directly after the session',
    trust3: 'We charge no booking fee',
    errorRateLimited: 'That is a lot of contact attempts. Please try again in a few minutes.',
    errorNoPhone: 'Could not get the phone number. Please try again.',
    errorNetwork: 'Could not reach the server. Check your connection and try again.',
  },

  map: {
    yourLocation: 'Your location',
    viewMap: 'View map',
    viewList: 'View list',
    mapLabel: 'Map of therapist locations',
    distanceAway: '{distance} away',
    noRating: 'None yet',
    clusterCount: '{count} listings',
    popupNoReviews: 'No reviews yet',
    popupRating: '★ {rating} · {count} reviews',
    searchHere: 'Search this whole map',
    searching: 'Searching…',
    expand: 'Expand',
    closeMap: 'Close map',
    clampedHint: 'The map is wider than the maximum search radius — only {km}km around the centre is searched.',
    zoomHint: 'Zoom in to see more therapists',
    countInList: { one: '{count} therapist', other: '{count} therapists' },
  },

  reviewForm: {
    title: 'Write a review',
    subtitle:
      'Reviews appear publicly straight away, and each account can review a therapist once.',
    ratingLegend: 'Your rating',
    starSr: '{star} stars',
    commentLabel: 'Comment (optional)',
    commentPlaceholder: 'Did the therapist arrive on time? How was the treatment?',
    submit: 'Submit review',
    submitting: 'Sending…',

    thanks: 'Thanks for reviewing {name}. Your comment is now public.',
    viewMine: 'See your reviews',

    loginQuestion: 'Have you had a session with {name}?',
    loginAction: 'Log in',
    loginRest: 'to write a review. You do not need an account to search or book.',

    errorNoRating: 'Pick a star rating before sending.',
    errorExpired: 'Your session has expired. Log in again to post your review.',
    errorDuplicate: 'You have already reviewed this therapist.',
    errorRateLimited: 'That is a lot of reviews in a short time. Please try again in a few minutes.',
    errorGeneric: 'Could not send the review. Please try again.',
    errorNetwork: 'Could not reach the server. Check your connection and try again.',
  },

  report: {
    trigger: 'Report this profile',
    dialogTitle: 'Report profile',
    dialogIntro:
      'Reports go to our moderation team and are never shown publicly. The profile is not hidden straight away — we review it first.',
    reasonLegend: 'Reason',
    reasonProstitution: 'Signs of a disguised service',
    reasonInappropriate: 'Inappropriate photos or wording',
    reasonFalseInfo: 'False information',
    reasonImpersonation: 'Impersonating someone else',
    reasonMisconduct: 'Unprofessional conduct',
    reasonOther: 'Other reason',
    detailLabel: 'Details',
    detailOptional: '(optional)',
    detailPlaceholder: 'What did you see on this profile?',
    submit: 'Send report',
    submitting: 'Sending…',
    thanks: 'Thank you. Your report has been sent to the moderation team.',
    errorNeedDetail: 'If you choose "Other reason", please tell us what you saw.',
    errorRateLimited: 'That is a lot of reports in a short time. Please try again in a few minutes.',
    errorGeneric: 'Could not send the report. Please try again.',
    errorNetwork: 'Could not reach the server. Check your connection and try again.',
  },

  filters: {
    nearMe: 'Search near me',
    locating: 'Finding you…',
    areaLabel: 'Area',
    areaPlaceholder: 'Type a district or ward…',
    serviceLabel: 'Service',
    serviceAll: 'All',
    radiusLabel: 'Radius',
    onlineOnly: 'Available now',
    verifiedOnly: 'Verified profiles only',
    viewGroupLabel: 'How results are shown',
    viewList: 'List',
    viewMap: 'Map',
    geoUnsupported: 'Your browser does not support location.',
    geoDenied:
      'Location is blocked for this site. Open your browser permission settings (the lock icon next to the address bar) to allow it, or choose a district below.',
    geoFailed:
      'Could not get your location. Try again somewhere with a clear view of the sky, or choose a district below.',
    geoDismiss: 'Got it',
    areaClear: 'Clear the selected area',
    areaSuggestions: 'Area suggestions',
    areaKtvCount: { one: '{count} therapist', other: '{count} therapists' },
    areaNoKtv: 'No therapists yet',

    moreFilters: 'Filters',
    moreFiltersActive: 'Filters ({count})',
    filterDialogTitle: 'Filter therapists',
    filterDialogClose: 'Close',
    genderLabel: 'Gender',
    genderAny: 'Any',
    genderFemale: 'Female',
    genderMale: 'Male',
    genderNote: 'Profiles that have not stated a gender are hidden while this filter is on.',
    experienceLabel: 'Minimum experience',
    experienceAny: 'Any',
    experienceYears: { one: '{count}+ year', other: '{count}+ years' },
    ratingLabel: 'Minimum rating',
    ratingAny: 'Any',
    ratingStars: '{count}+ stars',
    ratingNote: 'Only shows profiles that already have reviews.',
    statusLabel: 'Status',
    filterReset: 'Clear filters',
    filterApply: 'Show results',
  },
};
