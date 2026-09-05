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
  },
};
