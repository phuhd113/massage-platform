# Smart App Control chặn binary build local

Máy dev hiện tại bật Smart App Control, nên `dotnet run` / `dotnet test` chạy trực tiếp trên host
sẽ fail với `An Application Control policy has blocked this file (0x800711C7)`. Đường vòng đã dùng
là chạy trong container SDK:

```bash
MSYS_NO_PATHCONV=1 docker run --rm --network massage-platform_default \
  -v "C:/Startup/massage-platform:/src" -w /src \
  -e TEST_DB_CONNECTION="Host=postgres;Port=5432;Database=postgres;Username=massage;Password=massage_dev_pw" \
  -e TEST_REDIS="redis:6379" \
  mcr.microsoft.com/dotnet/sdk:8.0 dotnet test Massage.sln
```

**Đừng đề xuất tắt Smart App Control** — đó là thao tác một chiều, muốn bật lại phải cài lại Windows.
