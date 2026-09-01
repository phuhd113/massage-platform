namespace Massage.Wallet.Domain;

public static class LedgerEntryTypes
{
    public const string TopUp = "TOPUP";
    public const string Capture = "CAPTURE";
    public const string Refund = "REFUND";
    public const string Adjust = "ADJUST";
}

/// <summary>
/// Một bút toán làm đổi số dư.
///
/// Sổ cái **chỉ** chứa những dòng làm đổi <c>balance</c>, nên bất biến
/// <c>SUM(amount) == balance</c> đúng theo nghĩa đen và kiểm được bằng một câu
/// SQL. Việc giữ/nhả tiền không đổi số dư (nó đổi phần bị giữ) nên có vòng đời
/// riêng ở bảng <c>wallet_holds</c> thay vì chen vào đây thành những dòng 0 đồng.
/// </summary>
/// <param name="Amount">Có dấu: dương là tiền vào, âm là tiền ra.</param>
/// <param name="BalanceAfter">
/// Số dư ngay sau bút toán này. Lưu lại để đối soát truy ngược được tới đúng dòng
/// gây lệch, thay vì chỉ biết tổng đang sai.
/// </param>
/// <param name="IdempotencyKey">
/// Do bên ngoài truyền vào — cổng thanh toán, hoặc header của client. Tự sinh
/// trong hàm thì mỗi lần gọi lại ra một khoá khác và việc chống lặp thành vô nghĩa.
/// </param>
public sealed record LedgerEntry(
    string Type,
    decimal Amount,
    Money BalanceAfter,
    string IdempotencyKey,
    Guid? CampaignId = null);
