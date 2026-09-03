---
paths:
  - "src/Massage.Api/Data/**"
---

# Kiến trúc — Migration viết bằng raw SQL, không dùng fluent API

`Data/Migrations/*.cs` dùng `migrationBuilder.Sql(...)` chứ không dùng `CreateTable(...)`. Lý do:
EF không mô hình hoá được CHECK constraint, index GiST cho `geography`, hay partial index — mà đây
đều là thứ bảo vệ tính đúng đắn dữ liệu. Model snapshot vẫn do EF sinh, nên `dotnet ef migrations add`
vẫn hoạt động bình thường; chỉ phần thân `Up`/`Down` là viết tay.

`Down()` phải thật sự chạy được — CI chạy up → down → up để kiểm chứng.

Quy ước cột: UUID PK (`gen_random_uuid()`), `TIMESTAMPTZ` cho mọi mốc thời gian, `GEOGRAPHY(POINT,
4326)` + index GiST cho toạ độ, `NUMERIC` cho tiền (không bao giờ `float`/`double`), enum bằng
`VARCHAR + CHECK` thay vì Postgres ENUM.
