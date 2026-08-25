---
name: new-feature-module
description: Scaffold một module NestJS mới cho nền tảng massage marketplace theo đúng convention Vertical Slice của dự án, tự động chọn giữa kiến trúc Hexagonal (cho module chạm tiền/slot như Wallet, Promotion, Campaign, Billing) và kiến trúc CRUD phẳng (cho Listing, Profile, Service catalog, Review, Area...). Dùng skill này bất cứ khi nào người dùng nói đến việc tạo module/feature/domain mới, thêm resource mới, "scaffold", "tạo module X", "thêm tính năng Y" trong backend — kể cả khi họ chỉ mô tả tính năng chứ không nói rõ từ "module".
---

# Tạo module mới (NestJS Vertical Slice)

## Nguyên tắc cốt lõi

Dự án tổ chức theo **Vertical Slice**: mỗi module là một lát cắt tự chứa (controller + logic + truy cập dữ liệu nằm cùng nhau), không phải chia theo tầng kỹ thuật toàn cục. Mục đích là khi sửa một tính năng, mọi thứ cần đọc nằm trong một thư mục.

Nhưng **không phải module nào cũng đáng chi phí abstraction giống nhau**. Đây là quyết định kiến trúc quan trọng nhất khi scaffold:

| Loại | Ví dụ | Kiến trúc | Vì sao |
|---|---|---|---|
| **Sensitive** | Wallet, Promotion, Campaign, SlotAllocation, Billing, Payout | Hexagonal/Clean | Sai một dòng = mất tiền thật hoặc bán trùng slot. Cần test được 100% business rule mà không đụng DB/framework |
| **Standard** | Listing, KtvProfile, Certification, Service catalog, Review, Area, Lead | CRUD phẳng | Logic nghiệp vụ mỏng. Bọc thêm 3 lớp chỉ tạo ma sát khi sửa |

Nếu chưa rõ module thuộc loại nào, hỏi thẳng: *"Module này có ghi/trừ tiền, cấp phát slot quảng cáo, hay ảnh hưởng số dư ví không?"* — Có → Sensitive. Không → Standard. Khi lưỡng lự (ví dụ module Notification gửi thông báo trừ tiền nhưng không tự trừ), chọn Standard: nó chỉ đọc, không phải nơi giữ invariant về tiền.

## Scaffold cho module Standard (CRUD)

```
src/modules/<module-name>/
├── <module-name>.module.ts
├── <module-name>.controller.ts
├── <module-name>.service.ts
├── <module-name>.repository.ts
├── dto/
│   ├── create-<entity>.dto.ts
│   └── update-<entity>.dto.ts
└── entities/
    └── <entity>.entity.ts
```

Service gọi thẳng repository, repository gọi thẳng ORM. Không tạo interface cho repository nếu chỉ có một implementation — đó là abstraction rỗng.

## Scaffold cho module Sensitive (Hexagonal)

```
src/modules/<module-name>/
├── <module-name>.module.ts
├── domain/                          # Không import gì từ NestJS/TypeORM/Prisma
│   ├── <entity>.entity.ts           # Business rules, invariants
│   ├── <entity>.errors.ts           # InsufficientBalanceError, SlotExhaustedError...
│   └── ports/
│       ├── <entity>.repository.port.ts
│       └── <service>.port.ts
├── application/
│   └── use-cases/
│       ├── <action>.use-case.ts     # 1 file = 1 hành động nghiệp vụ
│       └── <action>.use-case.spec.ts
├── infrastructure/
│   ├── persistence/
│   │   └── <entity>.repository.ts   # implements port, dùng ORM thật
│   └── adapters/
└── presentation/
    ├── <module-name>.controller.ts
    └── dto/
```

**Ràng buộc phải giữ:** thư mục `domain/` không được import bất kỳ thứ gì từ NestJS, TypeORM/Prisma, Redis client, hay HTTP layer. Đây không phải quy tắc hình thức — nó là thứ cho phép viết test về logic tiền bạc chạy trong mili giây, không cần DB, và không vỡ khi đổi framework. Nếu thấy mình cần import `@nestjs/common` vào domain, đó là dấu hiệu logic đó thuộc về `application/` hoặc `infrastructure/`.

## Checklist khi hoàn tất scaffold

- [ ] Module đã được đăng ký trong module cha / `AppModule`
- [ ] DTO có validation (`class-validator`), không nhận raw body vào service
- [ ] Với module Sensitive: có ít nhất 1 use-case spec test business rule mà **không** khởi tạo Nest TestingModule hay kết nối DB
- [ ] Nếu module đụng tới bảng mới → tạo migration kèm theo (xem skill `db-migration`)
- [ ] Nếu module ghi/trừ tiền hoặc cấp slot → chạy qua checklist của skill `wallet-tx-review` trước khi coi là xong
- [ ] Nếu module tạo ra trang public mới trên Next.js → chạy qua checklist của skill `seo-page-check`

## Đặt tên

Module dùng kebab-case số ít theo domain nghiệp vụ (`ktv-profile`, `ad-campaign`, `wallet`), không phải theo kỹ thuật (`user-crud`, `data-service`). Tên nên khớp với ngôn ngữ nghiệp vụ trong bản kiến trúc để người đọc code và người đọc tài liệu nói cùng một thứ tiếng.
