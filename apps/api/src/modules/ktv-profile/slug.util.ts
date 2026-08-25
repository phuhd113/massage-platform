/**
 * Chuyển tên tiếng Việt có dấu thành slug URL không dấu.
 * Slug đi vào URL công khai (/ktv/{slug}-{id}) nên phải ổn định và đọc được —
 * đây là một phần của chiến lược SEO, không chỉ là chuyện thẩm mỹ.
 */
export function toSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[Đđ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
