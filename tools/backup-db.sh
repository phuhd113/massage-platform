#!/usr/bin/env bash
#
# Sao lưu Postgres của production.
#
#   bash tools/backup-db.sh
#
# Chạy từ thư mục gốc repo trên VPS (nơi có docker-compose.prod.yml).
# Gắn vào cron — xem docs/deploy-vps.md mục 10.
#
# Vì sao `pg_dump -Fc` chứ không phải sao chép volume: volume của một Postgres đang chạy
# là ảnh chụp **không nhất quán** — nó có thể đang ghi dở một trang. Bản khôi phục từ đó
# có thể lên được và trông đúng, rồi hỏng ở một truy vấn ngẫu nhiên nhiều tuần sau.
# `pg_dump` chạy trong một transaction nên luôn nhất quán.

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

# Đọc tên DB và user từ chính file cấu hình, không ghi cứng lại: hai nơi khai cùng một
# giá trị là hai nơi có thể lệch nhau.
set -a
# shellcheck disable=SC1091
source .env.production
set +a

BACKUP_DIR=./backups
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="masgo-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "Đang dump ${POSTGRES_DB} → ${BACKUP_DIR}/${FILE}"

# Ghi vào /backups **bên trong container** (đã bind mount ra ./backups) thay vì stream
# qua stdout: stream qua stdout của docker rồi redirect ra file sẽ tạo ra một file 0 byte
# **có vẻ thành công** nếu pg_dump lỗi giữa chừng, vì shell đã tạo file trước khi lệnh
# chạy. Dump vào trong rồi kiểm kích thước thì bắt được.
$COMPOSE exec -T postgres pg_dump \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  --format=custom \
  --file="/backups/${FILE}"

SIZE=$(stat -c%s "${BACKUP_DIR}/${FILE}" 2>/dev/null || echo 0)

# Một dump rỗng hoặc gần rỗng là dấu hiệu dump hỏng. Ngưỡng 10KB: riêng schema đã lớn
# hơn thế nhiều.
if [ "$SIZE" -lt 10240 ]; then
  echo "LỖI: file dump chỉ ${SIZE} byte — coi như hỏng." >&2
  exit 1
fi

echo "OK: ${FILE} (${SIZE} byte)"

# Giữ 14 bản gần nhất. Backup không xoá bớt sẽ lấp đầy đĩa VPS, và một VPS hết đĩa thì
# Postgres dừng ghi — tức chính cái mà backup đang bảo vệ lại bị nó làm hỏng.
find "$BACKUP_DIR" -name 'masgo-*.dump' -type f -printf '%T@ %p\n' \
  | sort -rn | tail -n +15 | cut -d' ' -f2- | xargs -r rm -v

echo
echo "Khôi phục (XOÁ dữ liệu hiện có):"
echo "  $COMPOSE exec -T postgres pg_restore -U $POSTGRES_USER -d $POSTGRES_DB --clean --if-exists /backups/$FILE"
echo
echo "LƯU Ý: backup nằm cùng VPS với DB. Một VPS hỏng là mất cả hai."
echo "Đẩy ./backups sang nơi khác (rclone tới R2, scp về máy) — xem docs/deploy-vps.md."
