#!/usr/bin/env bash
#
# Kiểm chứng DNS của Email Server (P.A Việt Nam) đã trỏ đúng chưa.
#
# Lý do tồn tại: cụm bản ghi email hỏng theo kiểu **im lặng**. Webmail vẫn mở được khi
# MX sai, và trang quản trị vẫn báo "đã gửi" cho thư bị bên nhận từ chối. Bẫy nặng nhất
# là hai CNAME `mail`/`mx` lỡ bật Cloudflare Proxy: chúng trả IP của Cloudflare, SMTP và
# IMAP không kết nối được, mà triệu chứng đọc như lỗi Outlook chứ không như lỗi DNS.
#
#   bash tools/verify-email-dns.sh
#
# Không cần stack chạy — script chỉ tra DNS qua resolver công cộng.
# Xem docs/email-server-setup.md.

set -uo pipefail

DOMAIN=${DOMAIN:-masgo.vn}
RESOLVER=${RESOLVER:-8.8.8.8}

# IP máy chủ mail của P.A. Đổi khi P.A chuyển gói sang máy chủ khác.
MAIL_IP=${MAIL_IP:-112.213.92.231}

pass=0
fail=0
warn=0

ok()   { echo "  ✓ $1"; pass=$((pass + 1)); }
bad()  { echo "  ✗ $1"; fail=$((fail + 1)); }
note() { echo "  ! $1"; warn=$((warn + 1)); }
head2() { echo; echo "$1"; }

# dig không có sẵn trên Git Bash của Windows; nslookup thì luôn có.
q() { nslookup -type="$1" "$2" "$RESOLVER" 2>/dev/null; }

echo "Kiểm DNS email cho $DOMAIN (resolver $RESOLVER)"

# ---------------------------------------------------------------------------
head2 "1. Bản ghi MX"

mx=$(q MX "$DOMAIN" | grep -i "mail exchanger" || true)

if [ -z "$mx" ]; then
  bad "Không có bản ghi MX nào — thư gửi tới @$DOMAIN sẽ bị trả về."
  echo "    Thêm hai bản ghi MX ở Cloudflare, xem docs/email-server-setup.md mục 1."
else
  echo "$mx" | sed 's/^/    /'
  n=$(echo "$mx" | grep -c .)
  [ "$n" -ge 2 ] \
    && ok "Có $n bản ghi MX (cần 2: priority 5 và 10)" \
    || note "Chỉ có $n bản ghi MX. P.A cấp hai máy chủ — thiếu bản dự phòng thì thư đến
       không có đường thứ hai khi máy chính bận."

  echo "$mx" | grep -qi "maychuemail" \
    && ok "MX trỏ về hạ tầng P.A (maychuemail)" \
    || bad "MX KHÔNG trỏ về maychuemail — kiểm lại Content của bản ghi."
fi

# ---------------------------------------------------------------------------
head2 "2. CNAME mail/mx — bẫy Cloudflare Proxy"

# Đây là mục quan trọng nhất của script. Proxy bật thì IP trả về là của Cloudflare
# (dải 104.x / 172.6x.x / 162.15x.x), và mọi kết nối SMTP/IMAP chết trong khi
# webmail vẫn mở được qua hostname gốc của P.A.
for h in mail mx; do
  fqdn="$h.$DOMAIN"
  ip=$(q A "$fqdn" | awk '/^Name:/{n=1} n&&/^Address/{print $2; exit}')

  if [ -z "$ip" ]; then
    bad "$fqdn không phân giải được — chưa tạo CNAME?"
  elif [ "$ip" = "$MAIL_IP" ]; then
    ok "$fqdn -> $ip (đúng, DNS only)"
  else
    bad "$fqdn -> $ip, KHÔNG phải $MAIL_IP"
    case "$ip" in
      104.*|172.6[4-9].*|172.7[0-1].*|162.15[89].*|188.114.*|', '*)
        echo "    Đây là IP của Cloudflare: CNAME đang bật Proxy (đám mây CAM)."
        echo "    Sửa: Cloudflare -> DNS -> bấm vào đám mây để chuyển sang DNS only (XÁM)."
        ;;
      *)
        echo "    Kiểm lại Target của CNAME ở Cloudflare."
        ;;
    esac
  fi
done

# ---------------------------------------------------------------------------
head2 "3. SPF"

# Nhiều hơn một chuỗi v=spf1 là PermError — hệ quả tệ hơn hẳn so với không có SPF,
# vì thư bị đánh spam thay vì chỉ mất một tín hiệu tin cậy.
spf=$(q TXT "$DOMAIN" | grep -i "v=spf1" || true)
spf_n=$(echo "$spf" | grep -c "v=spf1" || true)

if [ -z "$spf" ]; then
  bad "Không có bản ghi SPF — thư gửi đi khả năng cao vào spam."
elif [ "$spf_n" -gt 1 ]; then
  bad "Có $spf_n bản ghi SPF. Phải GỘP thành MỘT dòng — nhiều dòng = PermError."
  echo "$spf" | sed 's/^/    /'
else
  echo "$spf" | sed 's/^/    /'
  ok "Có đúng một bản ghi SPF"
  echo "$spf" | grep -qi "spf.maychuemail.com" \
    && ok "SPF include hạ tầng P.A" \
    || bad "SPF thiếu include:spf.maychuemail.com — thư gửi từ webmail sẽ fail SPF."
  echo "$spf" | grep -q -- "-all" \
    && note "SPF dùng -all (HardFail). Chỉ nên siết thế khi CHẮC CHẮN mọi đường gửi đã
       khai đủ; nếu không, thư của đường thiếu bị từ chối im lặng."
fi

# ---------------------------------------------------------------------------
head2 "4. DKIM"

# Không đoán được selector (P.A cấp riêng), nên chỉ dò vài selector phổ biến để báo
# hiện diện. Không tìm thấy KHÔNG chứng minh là chưa có.
found_dkim=""
for sel in default mail pa dkim s1 selector1; do
  if q TXT "$sel._domainkey.$DOMAIN" | grep -qi "v=DKIM1"; then
    found_dkim="$sel"
    break
  fi
done

if [ -n "$found_dkim" ]; then
  ok "Có DKIM ở selector '$found_dkim'"
else
  note "Không thấy DKIM ở các selector phổ biến. Script không đoán được selector P.A cấp,
       nên đây KHÔNG phải kết luận chắc chắn — kiểm bằng cách gửi thư thật tới Gmail rồi
       xem 'Hiển thị bản gốc' (docs/email-server-setup.md mục 5).
       Chưa có thì liên hệ kỹ thuật P.A xin selector + public key: SPF một mình không đủ
       để Gmail và M365 không hạ thư vào spam."
fi

# ---------------------------------------------------------------------------
head2 "5. DMARC"

dmarc=$(q TXT "_dmarc.$DOMAIN" | grep -i "v=DMARC1" || true)

if [ -z "$dmarc" ]; then
  note "Chưa có DMARC. Không bắt buộc để thư chạy được, nhưng nó là thứ chặn người khác
       giả danh @$DOMAIN — với sàn có tài khoản người dùng thì đó là đường lừa đảo thẳng
       vào chính khách của mình. Thêm sau khi SPF/DKIM đã PASS, bắt đầu bằng p=none."
else
  echo "$dmarc" | sed 's/^/    /'
  ok "Có DMARC"
  echo "$dmarc" | grep -qi "p=reject" \
    && note "DMARC đang p=reject. Chỉ đúng khi đã đọc báo cáo rua= và chắc chắn không còn
       nguồn gửi hợp lệ nào nằm ngoài SPF/DKIM."
fi

# ---------------------------------------------------------------------------
head2 "6. Bản ghi A của web — phải KHÔNG bị đụng tới"

# Cấu hình email không được làm gì tới đường web. Kiểm để bắt trường hợp sửa nhầm.
a_ip=$(q A "$DOMAIN" | awk '/^Name:/{n=1} n&&/^Address/{print $2; exit}')
if [ -n "$a_ip" ]; then
  ok "$DOMAIN -> $a_ip (A record còn nguyên)"
else
  bad "$DOMAIN không có A record — web sẽ chết. Cấu hình email KHÔNG được đụng vào đây."
fi

# ---------------------------------------------------------------------------
echo
echo "-----------------------------------------------------------"
echo "  $pass đạt, $fail lỗi, $warn cảnh báo"
echo
echo "DNS đúng chưa chứng minh thư gửi được. Bước cuối bắt buộc: gửi thư thật tới Gmail,"
echo "mở 'Hiển thị bản gốc' và xem SPF/DKIM/DMARC có PASS không — webmail báo 'đã gửi'"
echo "cho cả thư bị bên nhận từ chối."

[ "$fail" -eq 0 ] || exit 1
