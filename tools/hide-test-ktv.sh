#!/usr/bin/env bash
#
# Ẩn các hồ sơ KTV test khỏi trang công khai trên production.
#
#   bash tools/hide-test-ktv.sh --before 2026-09-14                # xem trước (mặc định)
#   bash tools/hide-test-ktv.sh --before 2026-09-14 --apply        # ghi thật
#   bash tools/hide-test-ktv.sh --before 2026-09-14 --apply --keep <id> --keep <id>
#   bash tools/hide-test-ktv.sh --restore                          # đảo ngược
#
# Chạy từ thư mục gốc repo trên VPS (nơi có docker-compose.prod.yml).
#
# ---------------------------------------------------------------------------
# Vì sao "ẩn" ở đây nghĩa là verification_status = 'REJECTED', không phải xoá
#
# `verification_status = 'VERIFIED'` là **mệnh đề duy nhất** mà cả SearchService lẫn
# đường đọc hồ sơ công khai lọc theo (xem SearchService: `WHERE k.verification_status
# = 'VERIFIED'`). Đưa hồ sơ ra khỏi giá trị đó là đủ để nó biến mất khỏi tìm kiếm,
# trang hồ sơ, sitemap và số đếm KTV theo khu vực — không cần cột "ẩn" mới, không cần
# migration, và đảo ngược được bằng một câu UPDATE.
#
# Không chọn PENDING vì hồ sơ sẽ rơi vào hàng đợi duyệt của admin và mời họ duyệt lại
# đúng thứ ta vừa cố ý ẩn. REJECTED kèm rejection_reason ghi rõ nguồn gốc thì người mở
# trang admin đọc được ngay vì sao nó ở đó.
#
# Không chọn xoá: hồ sơ test vẫn bị tham chiếu bởi leads, reviews, analytics_events và
# ví; xoá là một chuỗi cascade không đảo ngược được, đổi lấy đúng cái mà một câu UPDATE
# đã làm xong.
#
# ---------------------------------------------------------------------------
# Vì sao mặc định là xem trước, và vì sao --before không có giá trị mặc định
#
# Tiêu chí "tạo trước ngày X" không phân biệt được hồ sơ test với **KTV thật đăng ký
# sớm** — cả hai đều chỉ là một hàng có created_at nhỏ. Nên script này cố ý không tự
# đoán mốc, và không bao giờ ghi khi chưa được bảo ghi: bạn phải đọc danh sách in ra,
# nhận ra từng cái tên, rồi mới thêm --apply. `--keep <id>` để chừa lại hồ sơ thật lọt
# vào dải ngày.
#
# Chỉ đụng tới hồ sơ đang VERIFIED: hồ sơ PENDING/REJECTED vốn đã không hiển thị, ghi
# đè chúng chỉ làm mất lý do từ chối thật mà admin đã nhập.

set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

# Đọc tên DB và user từ chính file cấu hình, không ghi cứng lại: hai nơi khai cùng một
# giá trị là hai nơi có thể lệch nhau. (Cùng lý do với tools/backup-db.sh.)
#
# Điều này quan trọng hơn vẻ ngoài của nó: container Postgres có sẵn một DB tên
# `postgres`, và `psql -U massage` **mặc định nối vào chính nó** — một DB tồn tại, nối
# được, có đủ extension, và rỗng. Chạy nhầm vào đó thì mọi câu lệnh đều thành công và
# script in ra "0 hàng" một cách rất thuyết phục, trong khi dữ liệu thật nằm ở DB khác.
# Đã vấp đúng ca này lúc kiểm thử trên máy dev (app dùng `massage_platform`).
set -a
# shellcheck disable=SC1091
source .env.production
set +a

# Chuỗi đánh dấu trong rejection_reason. Đây là thứ --restore tìm theo, nên nó là khoá
# thật của script chứ không phải câu chữ trang trí: đổi nó đi thì các hồ sơ đã ẩn bằng
# bản cũ không còn khôi phục được bằng bản mới.
MARKER='[TEST-DATA]'
REASON="${MARKER} Hồ sơ dữ liệu thử nghiệm, đã ẩn khỏi trang công khai."

BEFORE=""
APPLY=0
RESTORE=0
KEEP=()

while [ $# -gt 0 ]; do
  case "$1" in
    --before)  BEFORE="${2:-}"; shift 2 ;;
    --apply)   APPLY=1; shift ;;
    --restore) RESTORE=1; shift ;;
    --keep)    KEEP+=("${2:-}"); shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "Tham số lạ: $1" >&2; exit 2 ;;
  esac
done

psql_q() {
  # -v ON_ERROR_STOP=1 là bắt buộc: thiếu nó psql chạy tiếp sau câu lỗi rồi thoát 0,
  # tức script báo thành công trong khi không có gì được ghi.
  $COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 "$@"
}

# ---------------------------------------------------------------------------
# Khôi phục
# ---------------------------------------------------------------------------
if [ "$RESTORE" -eq 1 ]; then
  echo "Khôi phục các hồ sơ đã ẩn bằng script này (tìm theo dấu ${MARKER})"
  echo

  psql_q -c "
    SELECT k.id, k.full_name, u.phone, k.created_at::date AS tao_ngay
    FROM ktv_profiles k JOIN users u ON u.id = k.user_id
    WHERE k.verification_status = 'REJECTED'
      AND k.rejection_reason LIKE '${MARKER}%'
    ORDER BY k.created_at;"

  if [ "$APPLY" -eq 0 ]; then
    echo "Xem trước. Thêm --apply để khôi phục thật."
    exit 0
  fi

  # Chỉ khôi phục đúng những hàng mang dấu, và xoá luôn dấu đó — không thì lần chạy
  # --restore sau sẽ lại "khôi phục" một hồ sơ mà admin đã chủ động từ chối thật.
  psql_q -c "
    UPDATE ktv_profiles
    SET verification_status = 'VERIFIED',
        rejection_reason    = NULL,
        updated_at          = now()
    WHERE verification_status = 'REJECTED'
      AND rejection_reason LIKE '${MARKER}%';"

  echo
  echo "Đã khôi phục. Xoá cache ISR — xem ghi chú cuối script."
  exit 0
fi

# ---------------------------------------------------------------------------
# Ẩn
# ---------------------------------------------------------------------------
if [ -z "$BEFORE" ]; then
  echo "Thiếu --before <YYYY-MM-DD>." >&2
  echo >&2
  echo "Script cố ý không có mốc mặc định: 'tạo trước ngày X' không phân biệt được" >&2
  echo "hồ sơ test với KTV thật đăng ký sớm, nên mốc phải do bạn chọn." >&2
  exit 2
fi

# Ép đúng dạng ngày trước khi nhét vào SQL. Chuỗi này đi vào câu lệnh nên đây vừa là
# kiểm tính hợp lệ vừa là chốt chặn injection — một --before '2026-01-01'' OR true--'
# sẽ quét sạch bảng.
if ! [[ "$BEFORE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "LỖI: --before phải có dạng YYYY-MM-DD (nhận: '$BEFORE')" >&2
  exit 2
fi

KEEP_SQL=""
if [ ${#KEEP[@]} -gt 0 ]; then
  for id in "${KEEP[@]}"; do
    if ! [[ "$id" =~ ^[0-9a-fA-F-]{36}$ ]]; then
      echo "LỖI: --keep phải là UUID (nhận: '$id')" >&2
      exit 2
    fi
  done
  KEEP_SQL=" AND k.id NOT IN ('$(IFS="','"; echo "${KEEP[*]}")')"
fi

# Điều kiện dùng chung cho cả câu xem trước lẫn câu UPDATE. Viết một lần để hai câu
# không thể lệch nhau — nếu lệch thì bảng bạn duyệt bằng mắt không phải bảng bị ghi.
WHERE="k.verification_status = 'VERIFIED'
       AND k.created_at < DATE '${BEFORE}'${KEEP_SQL}"

echo "Hồ sơ KTV đang hiển thị công khai, tạo TRƯỚC ${BEFORE}:"
echo

psql_q -c "
  SELECT k.id, k.full_name, u.phone, k.created_at::date AS tao_ngay,
         (SELECT count(*) FROM leads   l WHERE l.ktv_id = k.id) AS leads,
         (SELECT count(*) FROM reviews r WHERE r.ktv_id = k.id) AS reviews
  FROM ktv_profiles k JOIN users u ON u.id = k.user_id
  WHERE ${WHERE}
  ORDER BY k.created_at;"

# Số lead/review khác 0 là tín hiệu mạnh rằng hồ sơ đó KHÔNG phải dữ liệu test: đã có
# khách thật bấm gọi hoặc viết đánh giá. Cảnh báo chứ không chặn — dữ liệu seed cũng có
# thể có sẵn vài dòng — nhưng đây là dòng đáng dừng lại đọc kỹ nhất trên màn hình.
suspicious=$(psql_q -t -A -c "
  SELECT count(*) FROM ktv_profiles k
  WHERE ${WHERE}
    AND ((SELECT count(*) FROM leads   l WHERE l.ktv_id = k.id) > 0
      OR (SELECT count(*) FROM reviews r WHERE r.ktv_id = k.id) > 0);")

if [ "${suspicious:-0}" -gt 0 ]; then
  echo
  echo "CẢNH BÁO: ${suspicious} hồ sơ trong danh sách trên đã có lead hoặc đánh giá thật."
  echo "          Nhiều khả năng đó là KTV thật. Chừa chúng lại bằng --keep <id>."
fi

if [ "$APPLY" -eq 0 ]; then
  echo
  echo "Xem trước — CHƯA ghi gì. Đọc lại danh sách, rồi chạy lại với --apply."
  exit 0
fi

echo
echo "Đang ẩn..."

# RETURNING để biết chính xác đã đụng bao nhiêu hàng, thay vì tin vào bảng in phía trên
# — giữa lúc xem và lúc ghi vẫn có thể có hồ sơ mới được duyệt.
psql_q -c "
  UPDATE ktv_profiles k
  SET verification_status = 'REJECTED',
      rejection_reason    = '${REASON}',
      updated_at          = now()
  WHERE ${WHERE}
  RETURNING k.id, k.full_name;"

cat <<'EOF'

Đã ẩn ở tầng DB. CÒN MỘT BƯỚC NỮA:

Trang hồ sơ công khai là ISR 600 giây, nên hồ sơ vừa ẩn **vẫn còn hiển thị** cho tới
khi cache hết hạn — có hai tầng cache (fetch-cache trên đĩa và một tầng trong bộ nhớ
tiến trình), nên `restart` một mình cũng không dọn hết. Cách chắc chắn nhất:

  docker compose -f docker-compose.prod.yml --env-file .env.production up -d --force-recreate web

Sitemap và số đếm KTV theo khu vực đọc thẳng từ DB nên đã đúng ngay.

Đảo ngược:  bash tools/hide-test-ktv.sh --restore --apply
EOF
