#!/usr/bin/env bash
#
# Kiểm chứng R2 đã bật và cấu hình đúng chưa.
#
# Lý do tồn tại: app **không** báo lỗi khi thiếu cấu hình R2 — nó lặng lẽ dùng đĩa
# local. Nên "chạy được" không chứng minh gì cả, và cách duy nhất để biết là đo.
#
#   bash tools/verify-r2.sh
#
# Cần: stack đang chạy (docker compose up -d).

set -uo pipefail

API=${API:-http://localhost:5080/api/v1}
WEB=${WEB:-http://localhost:3000}

pass=0
fail=0

ok()   { echo "  ✓ $1"; pass=$((pass + 1)); }
bad()  { echo "  ✗ $1"; fail=$((fail + 1)); }
head2() { echo; echo "$1"; }

# ---------------------------------------------------------------------------
head2 "1. Biến môi trường đã tới container API chưa"

env_out=$(docker compose exec -T api env 2>/dev/null | grep '^R2__' | sort)

if [ -z "$env_out" ]; then
  bad "Container API không thấy biến R2__ nào — app đang chạy đĩa local."
  echo
  echo "    Kiểm: file .env có ở gốc repo chưa, và đã 'docker compose up -d --build api web' chưa."
  echo "    (docker compose chỉ đọc .env lúc tạo container, không đọc lại khi restart.)"
  exit 1
fi

# Không in secret ra màn hình — script này hay được chạy trong lúc chia sẻ màn hình.
# Che **chỉ khi có giá trị**: `=.*` cũng khớp chuỗi rỗng, nên bản che tất sẽ in
# "<đã đặt>" cho một biến trống và giấu đi đúng thứ đang cần tìm.
echo "$env_out" | sed -E 's/^(R2__(SecretAccessKey|AccessKeyId))=.+$/\1=<đã đặt>/'

for var in R2__AccountId R2__AccessKeyId R2__SecretAccessKey R2__Bucket R2__PublicBaseUrl; do
  value=$(echo "$env_out" | grep "^$var=" | cut -d= -f2-)
  if [ -n "$value" ]; then ok "$var có giá trị"; else bad "$var TRỐNG"; fi
done

public_base=$(echo "$env_out" | grep '^R2__PublicBaseUrl=' | cut -d= -f2-)
BUCKET_NAME=$(echo "$env_out" | grep '^R2__Bucket=' | cut -d= -f2-)

# Cái bẫy số một trong tài liệu: endpoint S3 chỉ nhận request đã ký, nên dùng nó làm
# origin công khai sẽ khiến mọi ảnh 401 mà không có lỗi nào trong log.
case "$public_base" in
  *r2.cloudflarestorage.com*)
    bad "R2__PublicBaseUrl đang trỏ vào endpoint S3 — ảnh sẽ 401 mà log không báo gì."
    echo "    Dùng custom domain (https://cdn.ten-mien.com) hoặc URL r2.dev."
    ;;
  https://*) ok "R2__PublicBaseUrl có dạng origin công khai" ;;
  *) bad "R2__PublicBaseUrl phải bắt đầu bằng https://" ;;
esac

# ---------------------------------------------------------------------------
head2 "2. App có khởi động được không"

health=$(curl -s "$API/health" 2>/dev/null)
if echo "$health" | grep -q '"status":"ok"'; then
  ok "API sống, DB up"
else
  bad "API không phản hồi. Xem: docker compose logs api --tail 40"
  echo "    Nếu log ghi 'R2:PublicBaseUrl bắt buộc khi bật R2' thì đó là cố ý —"
  echo "    có credential mà thiếu origin công khai sẽ khiến mọi ảnh không hiện."
  exit 1
fi

# ---------------------------------------------------------------------------
head2 "3. Upload thật một tấm ảnh và xem nó nằm ở đâu"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

printf 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' \
  | base64 -d > "$tmp/tiny.png"

# Bản thứ hai cho mặt sau CCCD: hai mặt phải là hai file khác nhau (CHECK
# chk_identity_doc_two_sides ở tầng DB). Nội dung giống nhau không sao — key do
# server sinh nên hai lượt upload vẫn ra hai key khác nhau.
cp "$tmp/tiny.png" "$tmp/tiny2.png"

phone="09$(shuf -i 10000000-99999999 -n 1)"

# Hai đường tạo tài khoản, chọn theo môi trường — script này phải chạy được ở CẢ HAI.
#
# Production cố ý TẮT OTP stub (Program.cs từ chối khởi động nếu bật): stub trả mã
# thẳng trong response, nên bật nó ở production nghĩa là ai biết số điện thoại đều
# chiếm được tài khoản đó. Vì vậy /auth/otp/request ở đó trả 503 và đường OTP bên
# dưới không bao giờ lấy được token — script sẽ dừng ở đúng mục này.
#
# Thử /auth/register (đường mật khẩu, lối vào đang dùng trên production) trước, rồi
# mới rơi về OTP cho môi trường dev.
pw="KiemTraR2-$(date +%s)"
token=$(curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"phone\":\"$phone\",\"password\":\"$pw\",\"role\":\"KTV\"}" \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$token" ]; then
  code=$(curl -s -X POST "$API/auth/otp/request" -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$phone\"}" | grep -o '"debugCode":"[0-9]*"' | cut -d'"' -f4)
  token=$(curl -s -X POST "$API/auth/otp/verify" -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$phone\",\"code\":\"$code\",\"role\":\"KTV\"}" \
    | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
fi

if [ -z "$token" ]; then
  bad "Không tạo được tài khoản qua /auth/register lẫn /auth/otp/*"
  echo "    Rate limit 'auth' là 10 lượt/5 phút — chạy lại script liên tục sẽ chạm."
  exit 1
fi

curl -s -X POST "$API/ktv/profile" -H "Authorization: Bearer $token" \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"KTV Kiem Tra R2","lat":10.7769,"lon":106.7009,"serviceRadiusKm":5}' \
  -o "$tmp/profile.json"

ktv_id=$(grep -o '"id":"[^"]*"' "$tmp/profile.json" | head -1 | cut -d'"' -f4)

# cygpath: curl trên Git Bash không đọc được đường dẫn kiểu POSIX.
img=$(cygpath -w "$tmp/tiny.png" 2>/dev/null || echo "$tmp/tiny.png")
img2=$(cygpath -w "$tmp/tiny2.png" 2>/dev/null || echo "$tmp/tiny2.png")

avatar_url=$(curl -s -X PUT "$API/ktv/profile/avatar" -H "Authorization: Bearer $token" \
  -F "file=@$img;type=image/png" | grep -o '"avatarUrl":"[^"]*"' | cut -d'"' -f4)

echo "  URL trả về: $avatar_url"

case "$avatar_url" in
  /uploads/*)
    bad "Vẫn đang lưu ở ĐĨA LOCAL, không phải R2."
    echo "    Credential có mặt nhưng adapter R2 không được chọn — kiểm lại R2__AccountId"
    echo "    và R2__AccessKeyId có thật sự khác rỗng trong container."
    ;;
  "$public_base"/avatars/*)
    ok "Ảnh đã lên R2, URL dùng đúng origin công khai"
    ;;
  *)
    bad "URL không khớp R2__PublicBaseUrl — kiểm lại giá trị đó."
    ;;
esac

# ---------------------------------------------------------------------------
head2 "4. Ảnh có tải được thật không"

if [ "${avatar_url#/uploads/}" != "$avatar_url" ]; then
  echo "  (bỏ qua — vẫn đang chạy đĩa local)"
else
  http=$(curl -s -o /dev/null -w '%{http_code}' "$avatar_url")
  if [ "$http" = "200" ]; then
    ok "Tải được ảnh công khai (200)"
  else
    bad "Ảnh trả $http — bucket chưa nối custom domain, hoặc domain chưa Active."
  fi
fi

# ---------------------------------------------------------------------------
head2 "5. File chứng chỉ KHÔNG được công khai"

cert_url=$(curl -s -X POST "$API/ktv/certifications" -H "Authorization: Bearer $token" \
  -F "Name=Chung chi kiem tra" -F "file=@$img;type=image/png" \
  | grep -o '"fileUrl":"[^"]*"' | cut -d'"' -f4)

case "$cert_url" in
  *X-Amz-Signature*|*x-amz-signature*)
    ok "Chứng chỉ trả về URL ký hạn (đúng, đang chạy R2)"

    # Đây là bước dễ bỏ sót nhất: custom domain / r2.dev phục vụ MỌI key trong
    # bucket, nên nếu thiếu WAF rule thì giấy tờ tuỳ thân tải được mà không cần
    # đăng nhập.
    #
    # Key phải lấy từ **URL đã ký** và bỏ phần query, đồng thời giải mã %2F — R2 ký
    # theo path-style nên đường dẫn có cả tên bucket ở đầu, phải cắt bỏ. Lấy nhầm key
    # thì URL kiểm tra trỏ vào một file không tồn tại, nhận 404, và script báo "an
    # toàn" trong khi lỗ hổng đang mở — đúng thứ nó sinh ra để bắt.
    key=$(echo "$cert_url" | sed -E 's|\?.*$||; s|^https?://[^/]+/||')
    key=$(printf '%s' "$key" | sed 's|%2F|/|g; s|%2f|/|g')
    key=${key#"$BUCKET_NAME/"}

    direct="$public_base/$key"
    http=$(curl -s -o /dev/null -w '%{http_code}' "$direct")

    # 404 ở đây mơ hồ: có thể do WAF chặn, mà cũng có thể do lấy sai key. Đối chứng
    # bằng một key chắc chắn tồn tại — nếu ảnh avatar cũng 404 thì phép đo hỏng, chứ
    # không phải bucket an toàn.
    if [ "$http" = "404" ] && [ -n "${avatar_url:-}" ]; then
      probe=$(curl -s -o /dev/null -w '%{http_code}' "$avatar_url")
      if [ "$probe" != "200" ]; then
        bad "Không kết luận được: cả chứng chỉ lẫn avatar đều không tải được ($http/$probe)."
        echo "    Phép đo hỏng — kiểm tay trước khi tin là an toàn."
        http="skip"
      fi
    fi

    if [ "$http" = "skip" ]; then
      : # đã báo ở trên
    elif [ "$http" = "200" ]; then
      bad "LỖ HỔNG: chứng chỉ tải được qua custom domain mà không cần đăng nhập ($http)."
      echo "    Thiếu WAF rule chặn /certifications/ — xem bước 4 trong"
      echo "    docs/cloudflare-r2-setup.md. Đây là ảnh chụp giấy tờ tuỳ thân."
    else
      ok "Custom domain chặn /certifications/ ($http) — WAF rule đang chạy"
    fi
    ;;
  */ktv/certifications/file*)
    ok "Chứng chỉ đi qua endpoint có kiểm quyền (đang chạy đĩa local)"
    http=$(curl -s -o /dev/null -w '%{http_code}' "$API/ktv/certifications/file?key=bat-ky")
    [ "$http" = "401" ] && ok "Không đăng nhập thì bị chặn (401)" \
                        || bad "Chưa đăng nhập mà nhận $http, phải là 401"
    ;;
  *)
    bad "Hình dạng URL chứng chỉ lạ: $cert_url"
    ;;
esac

# ---------------------------------------------------------------------------
head2 "6. Ảnh CCCD KHÔNG được công khai"

# Kiểm riêng chứ không tin vào kết quả của chứng chỉ: WAF rule khai từng tiền tố một,
# nên chặn được `/certifications/` không nói gì về `/identity/`. Đây đúng là chỗ hỏng
# im lặng khi thêm loại giấy tờ mới — file vẫn lưu đúng, app vẫn chạy đúng, chỉ là ai
# có key đều tải được.
id_url=$(curl -s -X PUT "$API/ktv/profile/identity" -H "Authorization: Bearer $token" \
  -F "front=@$img;type=image/png" -F "back=@$img2;type=image/png" \
  | grep -o '"frontUrl":"[^"]*"' | cut -d'"' -f4)

case "$id_url" in
  *X-Amz-Signature*|*x-amz-signature*)
    ok "CCCD trả về URL ký hạn (đúng, đang chạy R2)"

    key=$(echo "$id_url" | sed -E 's|\?.*$||; s|^https?://[^/]+/||')
    key=$(printf '%s' "$key" | sed 's|%2F|/|g; s|%2f|/|g')
    key=${key#"$BUCKET_NAME/"}

    direct="$public_base/$key"
    http=$(curl -s -o /dev/null -w '%{http_code}' "$direct")

    # Cùng phép đối chứng với mục 5: 404 có thể là WAF chặn, mà cũng có thể là lấy
    # sai key. Avatar 200 chứng minh phép đo còn đúng.
    if [ "$http" = "404" ] && [ -n "${avatar_url:-}" ]; then
      probe=$(curl -s -o /dev/null -w '%{http_code}' "$avatar_url")
      if [ "$probe" != "200" ]; then
        bad "Không kết luận được: cả CCCD lẫn avatar đều không tải được ($http/$probe)."
        echo "    Phép đo hỏng — kiểm tay trước khi tin là an toàn."
        http="skip"
      fi
    fi

    if [ "$http" = "skip" ]; then
      : # đã báo ở trên
    elif [ "$http" = "200" ]; then
      bad "LỖ HỔNG: ảnh CCCD tải được công khai mà không cần đăng nhập ($http)."
      echo "    Thiếu WAF rule chặn /identity/ — xem bước 4 trong"
      echo "    docs/cloudflare-r2-setup.md. Đây là định danh cấp quốc gia:"
      echo "    một lần rò rỉ không có cách nào thu hồi."
    else
      ok "Origin công khai chặn /identity/ ($http) — WAF rule đang chạy"
    fi
    ;;
  */ktv/profile/identity/file*)
    ok "CCCD đi qua endpoint có kiểm quyền (đang chạy đĩa local)"
    http=$(curl -s -o /dev/null -w '%{http_code}' "$API/ktv/profile/identity/file?key=bat-ky")
    [ "$http" = "401" ] && ok "Không đăng nhập thì bị chặn (401)" \
                        || bad "Chưa đăng nhập mà nhận $http, phải là 401"
    ;;
  *)
    bad "Hình dạng URL CCCD lạ: $id_url"
    ;;
esac

# ---------------------------------------------------------------------------
head2 "7. Frontend có khai đúng origin ảnh không"

# next/image chặn mọi host ngoài remotePatterns, và danh sách đó chốt LÚC BUILD —
# đổi biến rồi chỉ restart là không đủ.
web_media=$(docker compose exec -T web env 2>/dev/null \
  | grep '^NEXT_PUBLIC_MEDIA_BASE_URL=' | cut -d= -f2-)

if [ -z "$public_base" ] && [ -z "$web_media" ]; then
  echo "  (bỏ qua — chưa bật R2, cả hai cùng trống là đúng)"
elif [ "$web_media" = "$public_base" ]; then
  ok "Web dùng đúng origin ảnh"
elif [ -z "$web_media" ]; then
  bad "Web KHÔNG có NEXT_PUBLIC_MEDIA_BASE_URL — ảnh sẽ không qua được next/image."
  echo "    Phải build lại: docker compose up -d --build web"
else
  bad "Web đang dùng '$web_media', khác API ('$public_base')."
fi

# Dọn dữ liệu kiểm tra: hồ sơ này không được nằm lại trong kết quả tìm kiếm.
if [ -n "$ktv_id" ]; then
  docker compose exec -T postgres psql -U massage -d massage_platform \
    -c "DELETE FROM ktv_profiles WHERE id = '$ktv_id';" >/dev/null 2>&1
  docker compose exec -T postgres psql -U massage -d massage_platform \
    -c "DELETE FROM users WHERE phone = '$phone';" >/dev/null 2>&1
fi

echo
echo "─────────────────────────────────────────"
echo "  Đạt: $pass    Không đạt: $fail"
echo "─────────────────────────────────────────"
echo
if [ -n "$public_base" ]; then
  echo "Lưu ý: ảnh vừa upload để kiểm tra vẫn nằm trong bucket (hồ sơ đã xoá khỏi DB)."
  echo "Xoá tay trong R2 dashboard nếu muốn sạch hẳn."
else
  echo "Đang chạy đĩa local — bình thường khi chưa cấu hình R2."
  echo "Xem docs/cloudflare-r2-setup.md để bật."
fi

[ "$fail" -eq 0 ]
