# Kiến trúc — Test chạy trên Postgres thật, không dùng EF InMemory

`PostgresFixture` dựng database test riêng và áp migration thật. Chủ ý không dùng
`Microsoft.EntityFrameworkCore.InMemory`: provider đó không chạy được `ExecuteUpdate`, không có
CHECK constraint, không có PostGIS — test sẽ xanh trong khi code thật vỡ.

Hệ quả: **test cần Postgres đang chạy**. Đừng "sửa" test bằng cách chuyển sang InMemory, và đừng
hạ cấp code production (ví dụ đổi `ExecuteUpdateAsync` thành load-rồi-save) chỉ để chiều provider giả.

Một cái bẫy đã gặp: `ExecuteUpdate` ghi thẳng xuống DB và bỏ qua change tracker, nên nếu test dùng
lại cùng một `DbContext` cho cả ghi lẫn đọc thì sẽ đọc trúng entity cũ còn trong tracker. Thực tế
mỗi HTTP request có `DbContext` riêng — test phải mô phỏng đúng như vậy.

Bẫy thứ hai, đã cắn hai lần: **Npgsql tra data source theo chuỗi kết nối trong một cache dùng chung
cả process**. Kết nối nào mở trước sẽ chiếm chỗ, và nếu bản đó không có plugin NetTopologySuite thì
mọi thứ dựng sau — kể cả ứng dụng trong `WebApplicationFactory` — nhận lại bản thiếu plugin rồi fail
khi đọc cột `geography`. Vì vậy `PostgresFixture` dựng data source tường minh cho mình và dùng
`ApplicationName` khác cho kết nối bootstrap.
