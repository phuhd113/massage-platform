# Kiến trúc — Modular Monolith + Vertical Slice, KHÔNG đồng nhất mức abstraction

Đây là quyết định kiến trúc quan trọng nhất và dễ bị làm sai nhất. Mỗi module nằm trong
`src/Massage.Api/Modules/<Tên>/` và tự chứa, nhưng **mức abstraction khác nhau tuỳ mức rủi ro**:

| Loại | Ví dụ | Kiến trúc |
|---|---|---|
| Chạm tiền / cấp phát slot | Wallet, Promotion, Campaign, SlotAllocation | Hexagonal — tách thành **class library riêng** (`Massage.Wallet.Domain`) không tham chiếu ASP.NET/EF |
| Còn lại | Auth, KtvProfiles, Admin, Search, ServiceCatalog, Areas, Leads, Review | Phẳng — controller / service / EF trực tiếp |

Hai module Hexagonal đầu tiên đã có từ Phase 2 (`Massage.Wallet.Domain`, `Massage.Promotion.Domain`)
— dùng chúng làm mẫu thay vì dựng lại từ đầu.

Lý do: module CRUD có logic mỏng, bọc thêm ba lớp chỉ tạo ma sát. Module tiền bạc thì ngược lại —
cần test được 100% business rule mà không đụng DB, vì một lỗi im lặng ở đó thành mất tiền thật
hoặc bán trùng slot, và cả hai đều không tự phục hồi.

**Điểm mạnh riêng của .NET ở đây**: ranh giới Hexagonal được *trình biên dịch* ép buộc qua project
reference — nếu `Massage.Wallet.Domain` không tham chiếu EF Core thì không ai vô tình import được
`DbContext` vào domain. Ở TypeScript đây chỉ là quy ước. Khi tạo module chạm tiền, hãy tận dụng:
tạo project riêng thay vì chỉ tạo thư mục.

Khi lưỡng lự, hỏi: *module này có tự ghi/trừ số dư hoặc tự cấp phát slot không?* Có → Hexagonal.
