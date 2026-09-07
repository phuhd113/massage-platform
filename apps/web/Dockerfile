# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# API_BASE_URL chỉ dùng lúc chạy; các trang ISR sẽ fetch khi có request đầu tiên.
#
# NEXT_PUBLIC_MEDIA_BASE_URL thì ngược lại, **bắt buộc phải có lúc build**:
# `next.config.mjs` dựng `images.remotePatterns` từ nó, và Next chốt danh sách đó vào
# bản build. Truyền qua `environment:` của compose là quá muộn — build ra
# `remotePatterns: []`, rồi mọi ảnh nhận `"url" parameter is not allowed` (400) trong
# khi trang vẫn 200, nên lỗi chỉ lộ ra khi có người nhìn đúng tấm ảnh. Đã cắn.
ARG NEXT_PUBLIC_MEDIA_BASE_URL=""
#
# NEXT_PUBLIC_SITE_URL cũng phải có **lúc build**, vì `app/robots.ts` là route tĩnh:
# Next đánh giá nó một lần lúc build rồi ghi thẳng ra file. Truyền qua `environment:`
# của compose là quá muộn — `robots.txt` giữ nguyên host lúc build trong khi
# `sitemap.xml` (route động) đọc env lúc chạy, nên hai file mà Googlebot luôn đọc
# cùng nhau lại khai hai host khác nhau. Dòng `Sitemap:` khi đó trỏ sang một host
# khác với chính các `<loc>` bên trong sitemap, và Google bỏ qua sitemap đó.
#
# Triệu chứng khó thấy: cả hai file đều trả 200 và trông hợp lệ khi mở riêng lẻ.
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
#
# NEXT_PUBLIC_API_BASE_URL cũng phải có **lúc build**, và lý do khác hai biến trên:
# Next inline mọi biến `NEXT_PUBLIC_*` thẳng vào **bundle JavaScript của trình duyệt**
# lúc build. Đặt ở `environment:` của compose là quá muộn — biến đó chỉ tới được tiến
# trình Node ở server, còn mã đã tải về máy khách vẫn giữ nguyên giá trị lúc build.
#
# Bốn client component đọc nó: ContactButtons (nút "Gọi ngay" -> POST /leads),
# ProfileViewBeacon, ReportProfileButton, và lib/media.ts. Cả bốn fallback về
# `http://localhost:5080/api/v1`, nghĩa là **máy của khách** sẽ gọi localhost của chính
# khách. Nút "Gọi ngay" — đường doanh thu chính — chết hoàn toàn, và chết lặng lẽ:
# trang render 200, nút hiện ra, bấm vào không có gì xảy ra.
ARG NEXT_PUBLIC_API_BASE_URL="http://localhost:5080/api/v1"
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
