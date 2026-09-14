#!/usr/bin/env bash
#
# Áp nội dung biên tập khu vực trong content.js lên một môi trường đang chạy.
#
#   bash tools/area-editorial/apply.sh https://masgo.vn 0900000123 'matkhau'
#   bash tools/area-editorial/apply.sh http://localhost:3000 0900000123 'matkhau'
#
# Tài khoản truyền vào phải có vai ADMIN.
#
# **Đi qua `/api/admin-area` của Next, KHÔNG gọi thẳng backend.** Trang khu vực là ISR,
# và nội dung này còn quyết định trang có vào sitemap hay không — gọi thẳng API thì DB
# đúng mà trang công khai vẫn phục vụ bản dựng cũ, không có nội dung và vẫn `noindex`.
# Đã đo được đúng ca đó trên production ngày 2026-09-15 trước khi viết script này.
#
# Script **idempotent**: chạy lại chỉ ghi đè đúng nội dung đó, không nhân bản gì. Dùng nó
# khi khôi phục DB từ backup, hoặc khi dựng một môi trường mới.
#
# Vì sao nội dung nằm trong repo chứ không chỉ trong DB: nó được viết tay, mỗi đoạn nói về
# đặc điểm thật của một khu vực. Một lần khôi phục DB từ bản dump cũ là mất trắng, và không
# ai nhớ nổi tám đoạn văn đó. Nguồn sự thật khi chạy vẫn là DB; file này là bản gốc để
# dựng lại.

set -euo pipefail

cd "$(dirname "$0")/../.."

BASE="${1:?Thiếu base URL, ví dụ https://masgo.vn}"
PHONE="${2:?Thiếu số điện thoại tài khoản ADMIN}"
PASSWORD="${3:?Thiếu mật khẩu}"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Đăng nhập ${BASE} …"

# Đăng nhập qua route của Next để lấy cookie phiên — `/api/admin-area` đọc cookie đó,
# không nhận Authorization header.
CODE=$(curl -sS -X POST "${BASE}/api/auth/password" \
  -H 'Content-Type: application/json' \
  -d "{\"phone\":\"${PHONE}\",\"password\":\"${PASSWORD}\",\"mode\":\"login\"}" \
  -c "${TMP}/cookies.txt" -o "${TMP}/login.json" -w '%{http_code}')

if [ "$CODE" != "200" ]; then
  echo "LỖI: đăng nhập thất bại (HTTP ${CODE})" >&2
  cat "${TMP}/login.json" >&2
  exit 1
fi

# Vai trò phải là ADMIN. Tài khoản khách đăng nhập được nhưng mọi lượt ghi sẽ 403, và
# vòng lặp bên dưới sẽ in tám dòng lỗi giống hệt nhau mà không nói được nguyên nhân.
if ! grep -q '"role":"ADMIN"' "${TMP}/login.json"; then
  echo "LỖI: tài khoản không có vai ADMIN." >&2
  cat "${TMP}/login.json" >&2
  exit 1
fi

# Tách từng đoạn ra file riêng: nội dung có dấu tiếng Việt, và nhét thẳng vào tham số
# dòng lệnh sẽ hỏng theo cách phụ thuộc encoding của shell đang chạy. Đã cắn trên Git
# Bash ở Windows — cùng một chuỗi gửi được qua file thì 200, gửi qua `-d` thì 400.
node -e "
const fs = require('fs');
const items = require('./tools/area-editorial/content.js');
items.forEach((it, i) => {
  fs.writeFileSync(process.argv[1] + '/note-' + i + '.json', JSON.stringify({ editorialNote: it.note }), 'utf8');
  fs.appendFileSync(process.argv[1] + '/list.txt', [i, it.slug, it.province || '', it.name].join('|') + '\n', 'utf8');
});
console.log('Sẽ áp ' + items.length + ' khu vực.');
" "$TMP"

echo

# Tra id từ slug qua API công khai. content.js cố ý không chứa UUID (xem ghi chú ở đó):
# id khác nhau giữa các database, còn slug thì không.
resolve_id() {
  local slug="$1" province="$2" path
  if [ -n "$province" ]; then path="areas/${province}/${slug}"; else path="areas/${slug}"; fi
  curl -sS "${BASE}/api/proxy/${path}" -b "${TMP}/cookies.txt" \
    | grep -oP '(?<="id":")[0-9a-f-]{36}' | head -1
}

FAIL=0
while IFS='|' read -r IDX SLUG PROVINCE NAME; do
  ID=$(resolve_id "$SLUG" "$PROVINCE")

  if [ -z "$ID" ]; then
    printf 'LỖI   không tra được id cho slug "%s"  %s\n' "$SLUG" "$NAME" >&2
    FAIL=$((FAIL + 1))
    continue
  fi

  RES=$(curl -sS -X PATCH "${BASE}/api/admin-area?id=${ID}" \
    -b "${TMP}/cookies.txt" \
    -H 'Content-Type: application/json; charset=utf-8' \
    --data-binary @"${TMP}/note-${IDX}.json" \
    -w '\n%{http_code}')

  HTTP=$(echo "$RES" | tail -1)
  BODY=$(echo "$RES" | head -1)

  if [ "$HTTP" = "200" ]; then
    KTV=$(echo "$BODY" | grep -oP '(?<="ktvCount":)[0-9]+' || echo '?')
    IDXABLE=$(echo "$BODY" | grep -oP '(?<="indexable":)[a-z]+' || echo '?')
    printf 'OK    ktv=%-3s indexable=%-5s  %s\n' "$KTV" "$IDXABLE" "$NAME"
  else
    printf 'LỖI %s  %s\n' "$HTTP" "$NAME" >&2
    echo "      $BODY" >&2
    FAIL=$((FAIL + 1))
  fi
done < "${TMP}/list.txt"

echo

if [ "$FAIL" -gt 0 ]; then
  echo "${FAIL} khu vực áp không thành công." >&2
  exit 1
fi

# `indexable=false` ở trên KHÔNG phải lỗi: nội dung chỉ là một trong hai vế. Vế còn lại
# là đủ KTV đã duyệt (AreaService.MinKtvForIndex), và nó không phụ thuộc vào script này.
echo "Xong. Nhắc lại: 'indexable=false' nghĩa là khu vực đó chưa đủ số KTV đã duyệt —"
echo "nội dung đã có và trang sẽ tự vào index ngay khi đủ KTV, không cần chạy lại script."
