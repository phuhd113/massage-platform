using Massage.Api.Modules.Analytics;
using Massage.Api.Modules.Analytics.Entities;

namespace Massage.Api.Tests;

/// <summary>
/// Hàng đợi analytics giả: giữ sự kiện trong bộ nhớ để test soi được.
///
/// Dùng bản giả thay vì <c>AnalyticsWriter</c> thật ở hầu hết test vì writer thật ghi
/// theo lô và có độ trễ tới hai giây — một test khẳng định ngay sau khi gọi sẽ đỏ ngẫu
/// nhiên tuỳ máy chạy nhanh chậm. Đường ghi thật xuống DB có test riêng
/// (<c>AnalyticsWriterTests</c>).
/// </summary>
public sealed class FakeAnalyticsQueue : IAnalyticsQueue
{
    private readonly List<AnalyticsEvent> events = [];

    public void Enqueue(AnalyticsEvent e)
    {
        lock (events) events.Add(e);
    }

    public IReadOnlyList<AnalyticsEvent> Events
    {
        get { lock (events) return events.ToList(); }
    }

    public IReadOnlyList<AnalyticsEvent> OfType(string type) =>
        Events.Where(e => e.Type == type).ToList();
}
