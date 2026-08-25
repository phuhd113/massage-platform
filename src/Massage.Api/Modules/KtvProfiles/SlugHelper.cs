using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace Massage.Api.Modules.KtvProfiles;

public static partial class SlugHelper
{
    /// <summary>
    /// Chuyển tên tiếng Việt có dấu thành slug URL không dấu.
    /// Slug đi vào URL công khai (/ktv/{slug}-{id}) nên phải ổn định và đọc được —
    /// đây là một phần của chiến lược SEO, không chỉ là chuyện thẩm mỹ.
    /// </summary>
    public static string ToSlug(string input)
    {
        // đ/Đ không phải là "d + dấu" trong Unicode nên FormD không tách được,
        // phải thay thủ công trước khi chuẩn hoá.
        var normalized = input.Replace('đ', 'd').Replace('Đ', 'D').Normalize(NormalizationForm.FormD);

        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }

        var slug = NonAlphanumeric().Replace(sb.ToString().ToLowerInvariant(), "-").Trim('-');
        return slug.Length > 120 ? slug[..120].TrimEnd('-') : slug;
    }

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonAlphanumeric();
}
