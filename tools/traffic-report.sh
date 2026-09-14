#!/usr/bin/env bash
#
# Báo cáo lưu lượng truy cập từ hai nguồn đã có sẵn trên production.
#
#   bash tools/traffic-report.sh          # 30 ngày gần nhất
#   bash tools/traffic-report.sh 7        # 7 ngày gần nhất
#
# Chạy từ thư mục gốc repo trên VPS (nơi có docker-compose.prod.yml).
#
# Hai nguồn, đo hai thứ KHÁC NHAU — đừng cộng chúng lại:
#
#   1. `analytics_events` (Postgres) — phễu IMPRESSION → VIEW → LEAD, mọi dòng đều gắn
#      với một KTV cụ thể (`ktv_id` NOT NULL). Nó đo **hiệu quả của gói đẩy tin**, không
#      phải lưu lượng website: một người vào trang chủ, đọc /an-toan rồi thoát không sinh
#      dòng nào. Cũng có thể mất dòng khi hàng đợi trong bộ nhớ đầy (BoundedChannelFullMode
#      .DropWrite) — cố ý, vì chặn request để giữ một dòng thống kê là đánh đổi sai chiều.
#
#   2. Caddy access log — mọi request HTTP, gồm cả Googlebot và cả trang không gắn KTV.
#      Đây là nguồn DUY NHẤT thấy được bot. Chỉ có dữ liệu từ lúc khối `log` được thêm
#      vào Caddyfile; trước đó Caddy không ghi request thành công.
#
# Vì sao hai nguồn luôn lệch nhau: analytics_events bỏ lượt khi hàng đợi đầy và không
# đếm trang không gắn KTV; access log đếm cả bot, cả asset, cả lượt bị Next cache nên
# không bao giờ chạm tới backend. Lệch là bình thường. Lệch **quá lớn** ở riêng phễu
# (ví dụ access log thấy nhiều lượt /ktv/... mà VIEW gần như bằng 0) là dấu hiệu beacon
# hỏng — đúng kiểu lỗi CORS từng làm nút "Gọi ngay" chết trong im lặng.

set -euo pipefail

cd "$(dirname "$0")/.."

DAYS="${1:-30}"

# Đọc tên DB và user từ chính file cấu hình, không ghi cứng lại — cùng lý do với
# tools/backup-db.sh: hai nơi khai cùng một giá trị là hai nơi có thể lệch nhau.
set -a
# shellcheck disable=SC1091
source .env.production
set +a

PSQL="docker exec -i masgo_postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB}"

echo "════════════════════════════════════════════════════════════════"
echo " LƯU LƯỢNG MASGO.VN — ${DAYS} ngày gần nhất"
echo " (giờ Việt Nam, khớp với cách backend cắt khung ngày)"
echo "════════════════════════════════════════════════════════════════"
echo
echo "── 1. PHỄU THEO NGÀY (analytics_events) ────────────────────────"
echo

# `viewer_hash` là cách duy nhất đếm khách phân biệt ở đây; nó NULL khi không dựng được
# (thiếu IP lẫn user agent), nên count(DISTINCT) tự bỏ qua — đó là điều mong muốn.
$PSQL -c "
SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ngay,
       count(*) FILTER (WHERE type = 'IMPRESSION') AS hien_thi,
       count(*) FILTER (WHERE type = 'VIEW')       AS xem_ho_so,
       count(*) FILTER (WHERE type = 'LEAD')       AS lien_he,
       count(DISTINCT viewer_hash)                 AS khach_pb
FROM analytics_events
WHERE created_at >= now() - interval '${DAYS} days'
GROUP BY 1 ORDER BY 1 DESC;"

echo "── 2. TỔNG HỢP & TỈ LỆ CHUYỂN ĐỔI ──────────────────────────────"
echo

# Tỉ lệ tính bằng NULLIF để mẫu số 0 cho ra NULL thay vì lỗi chia. Hiển thị rỗng đúng
# hơn là 0%: "chưa có dữ liệu" và "0%" là hai điều khác nhau, và nhầm hai cái đó ở đây
# sẽ đọc thành "không ai bấm" trong khi thật ra là "chưa ai nhìn thấy".
$PSQL -c "
SELECT count(*) FILTER (WHERE type = 'IMPRESSION') AS hien_thi,
       count(*) FILTER (WHERE type = 'VIEW')       AS xem_ho_so,
       count(*) FILTER (WHERE type = 'LEAD')       AS lien_he,
       count(DISTINCT viewer_hash)                 AS khach_pb,
       round(100.0 * count(*) FILTER (WHERE type = 'VIEW')
             / NULLIF(count(*) FILTER (WHERE type = 'IMPRESSION'), 0), 1) AS ty_le_xem_pct,
       round(100.0 * count(*) FILTER (WHERE type = 'LEAD')
             / NULLIF(count(*) FILTER (WHERE type = 'VIEW'), 0), 1)       AS ty_le_lien_he_pct
FROM analytics_events
WHERE created_at >= now() - interval '${DAYS} days';"

echo "── 3. LEAD — CON SỐ ĐEM TÍNH TIỀN ──────────────────────────────"
echo

# Đọc từ `leads`, KHÔNG từ analytics_events. Bảng leads không bao giờ bị dọn và không
# bao giờ bị bỏ khi hàng đợi đầy; dòng LEAD trong analytics chỉ để dựng phễu và chỉ ghi
# khi lead **không** bị gộp. Đây là lý do hai con số "lien_he" ở mục 2 và mục 3 có thể
# khác nhau — cả hai đều đúng, chúng trả lời hai câu hỏi khác nhau.
$PSQL -c "
SELECT (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS ngay,
       count(*)                                                AS tong,
       count(*) FILTER (WHERE l.customer_user_id IS NOT NULL)   AS da_dang_nhap,
       count(*) FILTER (WHERE l.channel = 'CALL')               AS goi,
       count(*) FILTER (WHERE l.channel = 'ZALO')               AS zalo
FROM leads l
WHERE l.created_at >= now() - interval '${DAYS} days'
GROUP BY 1 ORDER BY 1 DESC;"

echo "── 4. TOP HỒ SƠ ĐƯỢC XEM ───────────────────────────────────────"
echo

$PSQL -c "
SELECT p.full_name,
       p.slug,
       count(*) FILTER (WHERE e.type = 'VIEW') AS xem,
       count(*) FILTER (WHERE e.type = 'LEAD') AS lien_he
FROM analytics_events e
JOIN ktv_profiles p ON p.id = e.ktv_id
WHERE e.created_at >= now() - interval '${DAYS} days'
  AND e.type IN ('VIEW', 'LEAD')
GROUP BY p.id, p.full_name, p.slug
HAVING count(*) FILTER (WHERE e.type = 'VIEW') > 0
ORDER BY 3 DESC LIMIT 15;"

echo "── 5. QUY MÔ SÀN ───────────────────────────────────────────────"
echo

# Bối cảnh để đọc bốn mục trên. Lưu lượng thấp khi chỉ có vài hồ sơ đã duyệt là chuyện
# bình thường chứ không phải lỗi đo đạc — Google không có gì để index.
$PSQL -c "
SELECT (SELECT count(*) FROM ktv_profiles)                                    AS ho_so_tong,
       (SELECT count(*) FROM ktv_profiles WHERE verification_status='VERIFIED') AS da_duyet,
       (SELECT count(*) FROM ktv_profiles WHERE is_online)                     AS dang_nhan_khach,
       (SELECT count(*) FROM users)                                            AS tai_khoan,
       (SELECT count(*) FROM reviews)                                          AS danh_gia;"

echo "── 6. ACCESS LOG (Caddy) ───────────────────────────────────────"
echo

# Log nằm trong volume `caddylogs`, không bind mount ra host, nên phải đọc qua exec.
# `|| true` ở mọi lệnh đọc log: khối này là phần MỚI nhất của báo cáo và khi Caddy chưa
# được deploy lại thì file chưa tồn tại. `set -e` ở đầu file sẽ làm cả script chết ở đây
# và nuốt mất năm mục đã in ở trên — tức mất phần chắc chắn có dữ liệu vì phần có thể
# chưa có.
if docker exec masgo_caddy test -f /var/log/caddy/access.log 2>/dev/null; then
  TOTAL=$(docker exec masgo_caddy sh -c "wc -l < /var/log/caddy/access.log" 2>/dev/null || echo 0)
  echo "Tổng số dòng log hiện có: ${TOTAL}"
  echo
  echo "Top 15 đường dẫn (bỏ asset tĩnh):"
  # Lọc /_next/, /api/ và file có đuôi: chúng lấn át danh sách mà không nói gì về trang
  # nào được đọc. `jq -r` im lặng bỏ qua dòng không parse được thay vì làm hỏng pipe.
  docker exec masgo_caddy sh -c "cat /var/log/caddy/access.log" 2>/dev/null \
    | jq -r 'select(.request.uri != null) | .request.uri' 2>/dev/null \
    | grep -vE '^/(_next|api)/|\.(js|css|png|jpg|jpeg|webp|avif|svg|ico|woff2?)(\?|$)' \
    | sed 's/?.*//' | sort | uniq -c | sort -rn | head -15 || true
  echo
  echo "Bot vs khách thật (theo User-Agent):"
  # Câu hỏi quan trọng nhất của cả khối này: Googlebot đã bò vào chưa. Nếu số này bằng 0
  # sau nhiều ngày thì vấn đề nằm ở index chứ không ở lưu lượng.
  docker exec masgo_caddy sh -c "cat /var/log/caddy/access.log" 2>/dev/null \
    | jq -r '.request.headers["User-Agent"][0] // "?"' 2>/dev/null \
    | awk '{
        if (/Googlebot/)        print "Googlebot";
        else if (/bingbot/)     print "bingbot";
        else if (/bot|crawl|spider|Bot/) print "bot khác";
        else                    print "khách thật (hoặc UA lạ)";
      }' \
    | sort | uniq -c | sort -rn || true
  echo
  echo "Mã trạng thái:"
  docker exec masgo_caddy sh -c "cat /var/log/caddy/access.log" 2>/dev/null \
    | jq -r '.status // empty' 2>/dev/null | sort -n | uniq -c | sort -rn | head -10 || true
else
  echo "Chưa có access log."
  echo
  echo "Caddy mặc định KHÔNG ghi request thành công. Khối \`log\` đã có trong Caddyfile"
  echo "nhưng cần deploy lại để có tác dụng:"
  echo
  echo "  docker compose -f docker-compose.prod.yml --env-file .env.production up -d caddy"
  echo
  echo "Log chỉ có dữ liệu TỪ LÚC ĐÓ trở đi — không truy hồi được quá khứ."
fi

echo
echo "════════════════════════════════════════════════════════════════"
echo " Lưu ý khi đọc: hai nguồn đo hai thứ khác nhau, đừng cộng lại."
echo " Chi tiết ở phần comment đầu file này."
echo "════════════════════════════════════════════════════════════════"
