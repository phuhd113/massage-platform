namespace Massage.Wallet.Domain;

/// <summary>
/// Ví của một KTV.
///
/// Hai cột tiền, cố ý tách rời:
/// <list type="bullet">
/// <item><c>Balance</c> — tổng tiền KTV đang sở hữu. Chỉ đổi khi tiền thật sự vào (nạp) hoặc ra (mua gói).</item>
/// <item><c>Held</c> — phần đang bị giữ cho một lần mua chưa chốt. Nằm trong <c>Balance</c>, không cộng thêm.</item>
/// </list>
/// Khả dụng = <c>Balance - Held</c>.
///
/// Giữ tiền **không** làm giảm <c>Balance</c>. Đây là điểm dễ làm sai nhất: nếu
/// Hold trừ thẳng số dư thì khi tranh slot thua, KTV thấy tiền biến mất rồi mới
/// quay lại — và nếu process chết đúng lúc đó thì tiền mất thật. Chỉ Capture, tức
/// khi slot đã chắc chắn thuộc về mình, mới được trừ.
/// </summary>
public sealed class Wallet
{
    public Guid Id { get; }
    public Guid UserId { get; }
    public Money Balance { get; private set; }
    public Money Held { get; private set; }

    /// <summary>Concurrency token, khớp với cột <c>version</c> của dòng ví trong DB.</summary>
    public int Version { get; private set; }

    public Wallet(Guid id, Guid userId, Money balance, Money held, int version)
    {
        if (held > balance)
            throw new InvalidAmountException($"Phần bị giữ {held} lớn hơn số dư {balance}");

        Id = id;
        UserId = userId;
        Balance = balance;
        Held = held;
        Version = version;
    }

    public Money Available => Balance - Held;

    /// <summary>
    /// Adapter gọi sau mỗi lần ghi thành công xuống DB, để token trong bộ nhớ đi
    /// theo giá trị thật.
    ///
    /// Cần thiết vì một luồng nghiệp vụ ghi ví nhiều lần: mua gói giữ tiền trước,
    /// chốt tiền sau. Không cập nhật token thì lần ghi thứ hai so với giá trị đã cũ
    /// và tự kết luận có người khác vừa sửa ví — luồng mua hỏng ở đúng bước cuối,
    /// sau khi slot đã bị chiếm.
    /// </summary>
    public void MarkPersisted() => Version++;

    /// <summary>Nạp tiền. <paramref name="idempotencyKey"/> phải là mã giao dịch của cổng thanh toán.</summary>
    public LedgerEntry TopUp(Money amount, string idempotencyKey)
    {
        var positive = Money.Positive(amount.Amount);
        Balance += positive;

        return new LedgerEntry(LedgerEntryTypes.TopUp, positive.Amount, Balance, idempotencyKey);
    }

    /// <summary>
    /// Giữ tiền cho một lần mua. Chưa trừ gì — chỉ giảm phần khả dụng.
    /// </summary>
    public WalletHold Hold(Guid holdId, Money amount, DateTimeOffset now, TimeSpan ttl)
    {
        var positive = Money.Positive(amount.Amount);

        if (Available < positive)
            throw new InsufficientBalanceException(Available, positive);

        Held += positive;
        return new WalletHold(holdId, Id, positive, now.Add(ttl), HoldStatuses.Active);
    }

    /// <summary>
    /// Chốt: tiền rời khỏi ví. Chỉ gọi sau khi slot đã được xác nhận là của mình.
    /// </summary>
    public LedgerEntry Capture(WalletHold hold, DateTimeOffset now, string idempotencyKey, Guid campaignId)
    {
        AssertOwnActiveHold(hold, now);

        Held -= hold.Amount;
        Balance -= hold.Amount;
        hold.MarkCaptured();

        return new LedgerEntry(
            LedgerEntryTypes.Capture, -hold.Amount.Amount, Balance, idempotencyKey, campaignId);
    }

    /// <summary>
    /// Nhả tiền đã giữ. Không sinh bút toán vì số dư không đổi — chỉ phần bị giữ
    /// trở lại khả dụng.
    /// </summary>
    public void Release(WalletHold hold)
    {
        if (!hold.IsActive)
            throw new HoldNotActiveException(hold.Id, hold.Status);
        if (hold.WalletId != Id)
            throw new HoldNotActiveException(hold.Id, "thuộc ví khác");

        Held -= hold.Amount;
        hold.MarkReleased();
    }

    /// <summary>Nhả hold quá hạn. Tách khỏi <see cref="Release"/> để đối soát phân biệt được hai nguyên nhân.</summary>
    public void Expire(WalletHold hold, DateTimeOffset now)
    {
        if (!hold.IsActive)
            throw new HoldNotActiveException(hold.Id, hold.Status);
        if (!hold.HasExpired(now))
            throw new HoldNotActiveException(hold.Id, "chưa hết hạn");

        Held -= hold.Amount;
        hold.MarkExpired();
    }

    /// <summary>Hoàn tiền khi huỷ gói. Tiền quay lại ví, không quay về cổng thanh toán.</summary>
    public LedgerEntry Refund(Money amount, string idempotencyKey, Guid campaignId)
    {
        var positive = Money.Positive(amount.Amount);
        Balance += positive;

        return new LedgerEntry(
            LedgerEntryTypes.Refund, positive.Amount, Balance, idempotencyKey, campaignId);
    }

    private void AssertOwnActiveHold(WalletHold hold, DateTimeOffset now)
    {
        if (hold.WalletId != Id)
            throw new HoldNotActiveException(hold.Id, "thuộc ví khác");
        if (!hold.IsActive)
            throw new HoldNotActiveException(hold.Id, hold.Status);
        if (hold.HasExpired(now))
            throw new HoldNotActiveException(hold.Id, HoldStatuses.Expired);
    }
}
