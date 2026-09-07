# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy riêng file project trước để layer restore được cache lại khi chỉ code thay đổi.
COPY Massage.sln ./
COPY src/Massage.Api/Massage.Api.csproj src/Massage.Api/
COPY src/Massage.Wallet.Domain/Massage.Wallet.Domain.csproj src/Massage.Wallet.Domain/
COPY src/Massage.Promotion.Domain/Massage.Promotion.Domain.csproj src/Massage.Promotion.Domain/
COPY tests/Massage.Api.Tests/Massage.Api.Tests.csproj tests/Massage.Api.Tests/
COPY tests/Massage.Wallet.Domain.Tests/Massage.Wallet.Domain.Tests.csproj tests/Massage.Wallet.Domain.Tests/
RUN dotnet restore Massage.sln

COPY . .
RUN dotnet publish src/Massage.Api/Massage.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Chạy bằng user không phải root: nếu ứng dụng bị chiếm quyền, kẻ tấn công không
# có sẵn quyền root trong container.
# curl cho healthcheck của compose: nó phải gọi được /api/v1/health, và endpoint đó
# chạy `SELECT postgis_version()` nên kiểm cả kết nối DB lẫn extension — không chỉ
# "tiến trình còn sống". Một healthcheck kiểu ping cổng vẫn báo xanh khi PostGIS thiếu,
# trong khi mọi truy vấn geo hỏng lúc chạy.
RUN apt-get update     && apt-get install -y --no-install-recommends curl     && rm -rf /var/lib/apt/lists/*

RUN adduser --system --group --uid 1001 appuser
COPY --from=build /app ./
RUN mkdir -p /app/uploads && chown -R appuser:appuser /app/uploads
USER appuser

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "Massage.Api.dll"]
