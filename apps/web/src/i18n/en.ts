import type { Dictionary } from './dictionaries';

/**
 * Bản tiếng Anh cho khách nước ngoài đang ở Việt Nam.
 *
 * Kiểu `Dictionary` suy từ `vi.ts`, nên thiếu key là build đỏ — đó là toàn bộ cơ
 * chế kiểm soát độ phủ bản dịch.
 *
 * Giọng văn bám theo bản tiếng Việt: nói thẳng điều kiểm chứng được trên site
 * ("certificates checked against the issuer"), không dùng ngôn ngữ quảng cáo. Đây
 * là ngành mà Google phạt nặng khi phân loại nhầm, nên mọi câu phải đọc như một
 * dịch vụ trị liệu chứ không như lời mời gọi.
 */
export const en: Dictionary = {
  common: {
    siteName: 'Home Massage Vietnam',
    home: 'Home',
    ktvUnit: 'therapists',
    from: 'from',
    loading: 'Loading…',
    retry: 'Try again',
    close: 'Close',
    cancel: 'Cancel',
  },

  shell: {
    navFindKtv: 'Find a therapist',
    navHcm: 'Ho Chi Minh City',
    navHanoi: 'Hanoi',
    navHowWeVerify: 'How we verify',
    navForKtv: 'For therapists',
    footerBlurb:
      '{siteName} — connecting clients with certified massage therapists who come to your home. Every profile shown has had its practising certificate checked.',
    languageLabel: 'Language',
    switchToEnglish: 'English',
    switchToVietnamese: 'Tiếng Việt',
  },

  home: {
    metaTitle: '{siteName} — certified therapists who come to you',
    metaDescription:
      'Find certified massage therapists who visit your home in Vietnam. See practising certificates, real reviews and distance before you call.',
    verifiedBadge: {
      one: '{count} therapist with a verified practising certificate',
      other: '{count} therapists with verified practising certificates',
    },
    heroTitle: 'Therapeutic massage at home, from certified professionals',
    heroSubtitle:
      'See each therapist’s photos, practising certificate and distance before you call. No booking fee — you pay after the session.',

    verifyTitle: 'How certificates are verified',
    verifySubtitle: 'Three steps before a profile is allowed to appear in search results.',
    step1Title: 'The therapist uploads the original certificate',
    step1Body:
      'A massage therapy or rehabilitation certificate, together with a portrait photo.',
    step2Title: 'We check it against the issuer',
    step2Body:
      'We verify the name, certificate number and issuing body before marking a profile as verified.',
    step3Title: 'The profile opens to clients',
    step3Body:
      'You can see exactly which certificates were verified, who issued them, and what previous clients said.',

    areasTitle: 'Browse by area',
    areasSubtitle: 'Pick a district to see the therapists who travel there.',
    servicesTitle: 'Services',
    servicesSubtitle: 'Each therapist publishes their own prices for every service on their profile.',

    heroAreaLabel: 'Area',
    heroAreaPlaceholder: 'District, ward…',
    heroServiceLabel: 'Service',
    heroServiceAll: 'All services',
    heroSubmit: 'Find therapists',
    heroGeoUnsupported: 'Your browser does not support location. You can choose a district instead.',
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
    headingCustomer: 'Log in or create an account',
    headingKtv: 'Therapist login',
    intro:
      'Enter your phone number and we will send a {length}-digit code to your Zalo. If you do not have an account yet, one is created for you. No password needed.',

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
    asideKtv1: 'Upload your certificate once — we check it and open your profile.',
    asideKtv2: 'You set your own prices and the areas you travel to.',
    asideKtv3: 'Clients call you directly; we never hold your money.',
    asideCustomer1: 'Review the therapists you have booked.',
    asideCustomer2: 'Searching and calling need no account — logging in is only for reviews.',
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
      '{count} certified massage therapists travel to homes in {name}. Verified practising certificates, published prices and real client reviews.',
    ogTitle: 'Home massage in {name}',
    h1: 'Home massage therapy in {name}',
    lead: {
      one: '{count} therapist is taking clients in {name}. Pick your district to see who is closest.',
      other: '{count} therapists are taking clients in {name}. Pick your district to see who is closest.',
    },
    pickDistrict: 'Choose a district',
    featured: 'Featured therapists in {name}',
  },

  ktvCard: {
    sponsored: 'Sponsored',
    sponsoredTitle: 'Advertised placement — this therapist paid to appear here',
    newProfile: 'New profile',
    noReviews: 'no reviews yet',
    noPrices: 'No prices listed yet',
    minutes: '{n} min',
    viewProfile: 'View profile',
    call: 'Call',
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
      one: ' therapist travelling to homes in {name}{province}. Every profile has had its practising certificate verified before being listed.',
      other: ' therapists travelling to homes in {name}{province}. Every profile has had its practising certificate verified before being listed.',
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
      'Find certified therapists offering {nameLower} in your own home.',
    h1: '{name} at home',
    byArea: 'Find {nameLower} by area',
  },

  ktvProfile: {
    metaTitle: '{name} — home massage therapist',
    metaDescription:
      '{name}, {years} years of experience in home massage therapy{area}. Verified practising certificate, published prices and real client reviews.',
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
    bioTitle: 'About',
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
    lead: 'The reviews you have written. Searching and calling need no account.',
    reviewsTitle: 'Reviews written',
    emptyTitle: 'You have not written any reviews yet.',
    emptyBody: 'After a session, open that therapist profile to rate them.',
    emptyCta: 'Find a therapist',
    statusRejected: 'This review was taken down and is no longer shown publicly.',
    statusRejectedReason: ' Reason: {reason}',
    statusPending: 'This review is awaiting moderation and is not public yet.',
    logout: 'Log out',
    loggingOut: 'Logging out…',
  },

  contact: {
    priceFrom: 'From',
    minutes: 'min',
    callName: 'Call {name}',
    callNow: 'Call now',
    zalo: 'Message on Zalo',
    zaloShort: 'Zalo',
    fetching: 'Getting the number…',
    payLater: 'Pay after the session',
    phoneLabel: 'Phone number:',
    trust1: 'The phone number appears as soon as you tap call',
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
    loginRest: 'to write a review. You do not need an account to search or call.',

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
    geoFailed: 'Could not get your location. You can choose a district below instead.',
    areaClear: 'Clear the selected area',
    areaSuggestions: 'Area suggestions',
    areaKtvCount: { one: '{count} therapist', other: '{count} therapists' },
    areaNoKtv: 'No therapists yet',
  },
};
