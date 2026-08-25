---
name: new-feature-module
description: Scaffold một module .NET mới cho nền tảng massage marketplace theo đúng convention Vertical Slice của dự án, tự động chọn giữa kiến trúc Hexagonal (cho module chạm tiền/slot như Wallet, Promotion, Campaign, Billing) và kiến trúc CRUD phẳng (cho Listing, Profile, Service catalog, Review, Area...). Dùng skill này bất cứ khi nào người dùng nói đến việc tạo module/feature/domain mới, thêm resource mới, "scaffold", "tạo module X", "thêm tính năng Y" trong backend — kể cả khi họ chỉ mô tả tính năng chứ không nói rõ từ "module".
---

# Tạo module mới (.NET 8, Vertical Slice)

## Nguyên tắc cốt lõi

Dự án tổ chức theo **Vertical Slice**: mỗi module là một lát cắt tự chứa (controller + logic + truy cập dữ liệu nằm cùng nhau), không phải chia theo tầng kỹ thuật toàn cục. Mục đích là khi sửa một tính năng, mọi thứ cần đọc nằm trong một thư mục.

Nhưng **không phải module nào cũng đáng chi phí abstraction giống nhau**. Đây là quyết định kiến trúc quan trọng nhất khi scaffold:

| Loại | Ví dụ | Kiến trúc | Vì sao |
|---|---|---|---|
| **Sensitive** | Wallet, Promotion, Campaign, SlotAllocation, Billing, Payout | Hexagonal, tách **project riêng** | Sai một dòng = mất tiền thật hoặc bán trùng slot. Cần test được 100% business rule mà không đụng DB/framework |
| **Standard** | Listing, KtvProfile, Certification, Service catalog, Review, Area, Lead | CRUD phẳng trong `Massage.Api` | Logic nghiệp vụ mỏng. Bọc thêm 3 lớp chỉ tạo ma sát khi sửa |

Nếu chưa rõ module thuộc loại nào, hỏi thẳng: *"Module này có ghi/trừ tiền, cấp phát slot quảng cáo, hay ảnh hưởng số dư ví không?"* — Có → Sensitive. Không → Standard. Khi lưỡng lự (ví dụ module Notification gửi thông báo trừ tiền nhưng không tự trừ), chọn Standard: nó chỉ đọc, không phải nơi giữ invariant về tiền.

## Scaffold cho module Standard (CRUD)

```
src/Massage.Api/Modules/<TênModule>/
├── <TênModule>Controller.cs
├── <TênModule>Service.cs
├── <TênModule>Dtos.cs            # record DTO + FluentValidation validator cùng file
└── Entities/
    └── <Entity>.cs
```

Service dùng `AppDbContext` trực tiếp. **Không tạo interface repository nếu chỉ có một implementation** — đó là abstraction rỗng, và EF `DbSet` đã là abstraction trên SQL rồi.

Đăng ký trong `Program.cs`: `builder.Services.AddScoped<TênModuleService>();`
Cấu hình entity trong `AppDbContext.OnModelCreating` (đặt tên cột snake_case khớp migration).

## Scaffold cho module Sensitive (Hexagonal)

Tạo **project riêng**, không chỉ là thư mục:

```
src/Massage.<Tên>.Domain/          # csproj KHÔNG tham chiếu ASP.NET, EF Core, Npgsql
├── <Entity>.cs                    # business rules, invariants
├── <Tên>Errors.cs                 # InsufficientBalanceException, SlotExhaustedException...
└── Ports/
    ├── I<Entity>Repository.cs
    └── I<Service>.cs

src/Massage.Api/Modules/<Tên>/
├── UseCases/
│   └── <Action>UseCase.cs         # 1 file = 1 hành động nghiệp vụ
├── Infrastructure/
│   └── <Entity>Repository.cs      # implements port, dùng EF thật
└── <Tên>Controller.cs

tests/Massage.<Tên>.Domain.Tests/  # test business rule, KHÔNG cần Postgres
```

**Vì sao tách project chứ không chỉ tách thư mục:** trong .NET, ranh giới này được *trình biên dịch* ép buộc. Nếu `Massage.Wallet.Domain.csproj` không tham chiếu EF Core thì không ai vô tình `using Microsoft.EntityFrameworkCore` vào domain được — build sẽ đỏ. Ở TypeScript đây chỉ là quy ước dựa vào kỷ luật con người. Đây là lợi thế thật của stack hiện tại, đừng bỏ phí bằng cách chỉ tạo thư mục.

Hệ quả tốt kèm theo: test domain của module tiền bạc **không cần Postgres**, chạy trong mili giây — khác với test tầng API vốn phải có DB thật (xem mục test bên dưới).

## Test

Test tầng API/service chạy trên **Postgres thật** qua `PostgresFixture`:

```csharp
[Collection(PostgresCollection.Name)]
public class XxxServiceTests(PostgresFixture fixture)
{
    private AppDbContext Db() => fixture.CreateContext();
}
```

Không dùng `Microsoft.EntityFrameworkCore.InMemory`: nó không chạy được `ExecuteUpdate`, không có CHECK constraint, không có PostGIS — test sẽ xanh trong khi code thật vỡ.

Hai cái bẫy đã gặp:

- **Change tracker che mất `ExecuteUpdate`.** `ExecuteUpdateAsync` ghi thẳng xuống DB, bỏ qua change tracker. Nếu test dùng lại cùng `DbContext` cho cả ghi lẫn đọc, nó đọc trúng entity cũ trong tracker. Thực tế mỗi HTTP request có `DbContext` riêng — test phải tạo context mới để mô phỏng đúng.
- **Test giẫm chân nhau.** Fixture dùng chung một database cho cả collection. Cho mỗi test tự sinh dữ liệu riêng (số điện thoại ngẫu nhiên, v.v.) thay vì dọn bảng giữa các test.

## Checklist khi hoàn tất scaffold

- [ ] Service đã đăng ký DI trong `Program.cs`
- [ ] Entity đã cấu hình trong `AppDbContext.OnModelCreating` với tên cột snake_case
- [ ] DTO là `record` + có FluentValidation validator; controller không nhận raw body vào service
- [ ] Với module Sensitive: domain project **không** tham chiếu EF/ASP.NET, và có test business rule chạy không cần DB
- [ ] Nếu module đụng tới bảng mới → tạo migration kèm theo (xem skill `db-migration`)
- [ ] Nếu module ghi/trừ tiền hoặc cấp slot → chạy qua checklist của skill `wallet-tx-review` trước khi coi là xong
- [ ] Nếu module tạo ra trang public mới trên Next.js → chạy qua checklist của skill `seo-page-check`
- [ ] `dotnet format Massage.sln` sạch (CI kiểm tra bằng `--verify-no-changes`)

## Đặt tên

Namespace và thư mục dùng PascalCase số nhiều theo domain nghiệp vụ (`KtvProfiles`, `AdCampaigns`, `Wallets`), không phải theo kỹ thuật (`UserCrud`, `DataServices`). Tên nên khớp với ngôn ngữ nghiệp vụ trong bản kiến trúc để người đọc code và người đọc tài liệu nói cùng một thứ tiếng.

Test đặt tên bằng tiếng Việt mô tả hành vi (`Mã_chỉ_dùng_được_một_lần`) — khi CI đỏ, tên test phải nói rõ *quy tắc nghiệp vụ nào* vừa bị phá, không phải hàm nào vừa fail.
