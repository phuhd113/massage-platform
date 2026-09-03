# apps/web — Frontend Next.js

Chạy cùng `docker compose up -d` ở thư mục gốc (cổng 3000).

```bash
docker compose build web && docker compose up -d web
# typecheck/lint/build không cần cài Node trên host:
docker run --rm --network massage-platform_default -v "C:/Startup/massage-platform/apps/web:/app" \
  -w /app -e API_BASE_URL="http://api:8080/api/v1" node:20-alpine npm run build
```

Kiểm chứng SSR **luôn bằng HTML thô** (`curl http://localhost:3000/... | grep`), không bằng
DevTools Elements — DevTools hiển thị DOM sau khi JS chạy nên trang client-render vẫn trông ổn.
