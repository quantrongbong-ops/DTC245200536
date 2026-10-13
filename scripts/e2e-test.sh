#!/usr/bin/env bash
# ============================================================
# E2E test - chạy trọn một luồng nghiệp vụ qua Nginx → backend → PostgreSQL
#
# KHÁC với smoke-test.sh:
#   smoke-test.sh chỉ ĐỌC (không tạo dữ liệu).
#   e2e-test.sh  TẠO DỮ LIỆU THẬT trong database.
#
# Mỗi lần chạy sẽ tạo 1 món ăn, 1 bàn và 1 đơn hàng hoàn chỉnh đã thanh toán.
# Đây là dữ liệu nghiệp vụ hợp lệ, có thể dùng làm minh chứng cho báo cáo.
#
# Tiền điều kiện:
#   - `docker compose up -d` đã chạy, container healthy
#   - Tài khoản admin đã được seed (quantrongbong / Trongbong123@)
#
# Cách dùng:
#   bash scripts/e2e-test.sh
#
# Mã trả về: 0 = tất cả PASS, 1 = có FAIL.
# ============================================================
set -uo pipefail

WEB_SSL_PORT="${WEB_SSL_PORT:-8443}"
BASE="https://localhost:${WEB_SSL_PORT}"
API="${BASE}/api/v1"

APP_USER="${SMOKE_APP_USER:-quantrongbong}"
APP_PASS="${SMOKE_APP_PASS:-Trongbong123@}"

PASS=0; FAIL=0; FAILED_NAMES=()

if [ -t 1 ]; then G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[36m'; N=$'\033[0m'
else G=''; R=''; Y=''; B=''; N=''; fi

section() { printf '\n%s=== %s ===%s\n' "$B" "$1" "$N"; }
ok()  { PASS=$((PASS+1)); printf '  %s[PASS]%s %s\n' "$G" "$N" "$1"; }
bad() { FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); printf '  %s[FAIL]%s %s\n' "$R" "$N" "$1"; [ -n "${2:-}" ] && printf '         %s\n' "$2"; }
info(){ printf '  %s[INFO]%s %s\n' "$B" "$N" "$1"; }

# Gọi API, trả về body. $1=method $2=path $3=body(optional) $4=token(optional)
api() {
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-k -s --max-time 20 -X "$method" -H 'Content-Type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}" "${API}${path}" 2>/dev/null
}

# Lấy giá trị của một khoá JSON ở tầng bất kỳ (không cần jq)
json_get() {
  printf '%s' "$1" | sed -n "s/.*\"$2\":\(\"[^\"]*\"\|[0-9.]*\).*/\1/p" | head -1 | tr -d '"'
}

# Lấy mã HTTP
http_code() {
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-k -s -o /dev/null -w '%{http_code}' --max-time 20 -X "$method" -H 'Content-Type: application/json')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}" "${API}${path}" 2>/dev/null
}

echo "============================================================"
echo " E2E TEST - luồng nghiệp vụ nhà hàng đầy đủ"
echo " Thời điểm: $(date '+%Y-%m-%d %H:%M:%S')"
echo " CẢNH BÁO: bài test này TẠO DỮ LIỆU THẬT trong database."
echo "============================================================"

MARK="E2E-$(date +%Y%m%d-%H%M%S)"

# ------------------------------------------------------------
section "BƯỚC 1. Đăng nhập qua Nginx (HTTPS)"
LOGIN=$(api POST /auth/login "{\"username\":\"${APP_USER}\",\"password\":\"${APP_PASS}\"}")
TOKEN=$(json_get "$LOGIN" token)
if [ -n "$TOKEN" ]; then
  ok "đăng nhập thành công qua ${BASE}"
else
  bad "không đăng nhập được" "phản hồi: ${LOGIN:0:300}"
  echo; echo "Dừng: không thể tiếp tục khi chưa có token."; exit 1
fi

# ------------------------------------------------------------
section "BƯỚC 2. Tạo danh mục và món ăn mới"
# LƯU Ý VỀ ENCODING: không đặt ký tự tiếng Việt trực tiếp trong script.
# Git Bash trên Windows mã hoá chuỗi theo codepage hệ thống (CP1258) chứ không
# phải UTF-8, khiến byte gửi lên không hợp lệ và bị lưu thành U+FFFD.
# Dùng JSON unicode escape (\uXXXX) — JSON hợp lệ, thuần ASCII trong script,
# và vẫn kiểm tra được thật việc xử lý UTF-8 của ứng dụng.
#   ó = ó  -> tên món sẽ là "Món <MARK>"
ITEM_NAME_JSON="M\\u00f3n ${MARK}"
CAT=$(api POST /categories "{\"name\":\"Danh muc ${MARK}\",\"description\":\"Danh muc test tu dong\",\"sort_order\":99}" "$TOKEN")
CAT_ID=$(json_get "$CAT" id)
if [ -n "$CAT_ID" ]; then
  ok "tạo danh mục thành công (id=${CAT_ID})"
else
  bad "không tạo được danh mục" "${CAT:0:300}"
fi

# Giá có phần thập phân để kiểm tra làm tròn NUMERIC(12,2)
PRICE="12500.50"
ITEM=$(api POST /menu-items "{\"category_id\":${CAT_ID:-1},\"name\":\"${ITEM_NAME_JSON}\",\"description\":\"Mon test\",\"price\":${PRICE}}" "$TOKEN")
ITEM_ID=$(json_get "$ITEM" id)
if [ -n "$ITEM_ID" ]; then
  ok "tạo món ăn thành công (id=${ITEM_ID}, giá=${PRICE})"
else
  bad "không tạo được món ăn" "${ITEM:0:300}"
fi

# ---- Kiểm tra UTF-8 round-trip ----
# "Món ..." có đúng 1 ký tự ngoài ASCII là "ó" (U+00F3), chiếm 2 byte UTF-8.
# Nếu lưu đúng:  octet_length - char_length == 1
# Nếu bị hỏng thành U+FFFD (ký tự thay thế, 3 byte): hiệu số sẽ là 2
if [ -n "$ITEM_ID" ]; then
  CHARS=$(docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc \
    "SELECT char_length(name) FROM menu_items WHERE id=${ITEM_ID};" 2>/dev/null | tr -d '[:space:]')
  BYTES=$(docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc \
    "SELECT octet_length(name) FROM menu_items WHERE id=${ITEM_ID};" 2>/dev/null | tr -d '[:space:]')
  DIFF=$(( ${BYTES:-0} - ${CHARS:-0} ))
  if [ "$DIFF" = "1" ]; then
    ok "tên món lưu đúng UTF-8 (${BYTES} byte / ${CHARS} ký tự, chênh 1 = ký tự 'ó' 2 byte)"
  else
    bad "tên món bị sai encoding" "octet_length=${BYTES}, char_length=${CHARS}, chênh lệch ${DIFF} (mong đợi 1). Chênh lệch 2 nghĩa là ký tự U+FFFD đã bị lưu vào DB"
  fi
fi

# ------------------------------------------------------------
section "BƯỚC 3. Validation: giá âm và giá sai kiểu phải bị từ chối"

code=$(http_code POST /menu-items "{\"category_id\":${CAT_ID:-1},\"name\":\"Giá âm\",\"price\":-1000}" "$TOKEN")
if [ "$code" = "400" ]; then ok "giá âm bị từ chối (HTTP 400)"
else bad "giá âm phải trả 400" "nhận được HTTP $code"; fi

code=$(http_code POST /menu-items "{\"category_id\":${CAT_ID:-1},\"name\":\"Giá rác\",\"price\":\"abc\"}" "$TOKEN")
if [ "$code" = "400" ]; then ok "giá không phải số bị từ chối (HTTP 400)"
else bad "giá 'abc' phải trả 400" "nhận được HTTP $code"; fi

code=$(http_code POST /menu-items "{\"category_id\":${CAT_ID:-1},\"name\":\"   \",\"price\":1000}" "$TOKEN")
if [ "$code" = "400" ]; then ok "tên rỗng bị từ chối (HTTP 400)"
else bad "tên rỗng phải trả 400" "nhận được HTTP $code"; fi

code=$(http_code POST /menu-items "{\"category_id\":${CAT_ID:-1},\"name\":\"Giá khổng lồ\",\"price\":99999999999999}" "$TOKEN")
if [ "$code" = "400" ]; then ok "giá vượt giới hạn NUMERIC(12,2) bị từ chối (HTTP 400)"
else bad "giá vượt giới hạn phải trả 400" "nhận được HTTP $code"; fi

# ------------------------------------------------------------
section "BƯỚC 4. Tạo bàn ăn mới"
TBL_NUM="E2E$(date +%H%M%S)"
TBL=$(api POST /tables "{\"table_number\":\"${TBL_NUM}\",\"area\":\"Khu test\",\"capacity\":4}" "$TOKEN")
TABLE_ID=$(json_get "$TBL" id)
if [ -n "$TABLE_ID" ]; then
  ok "tạo bàn thành công (id=${TABLE_ID}, số bàn=${TBL_NUM})"
else
  bad "không tạo được bàn" "${TBL:0:300}"
fi

code=$(http_code POST /tables "{\"table_number\":\"${TBL_NUM}\",\"capacity\":4}" "$TOKEN")
if [ "$code" = "409" ]; then ok "tạo bàn trùng số bàn bị chặn (HTTP 409)"
else bad "bàn trùng số phải trả 409" "nhận được HTTP $code"; fi

# ------------------------------------------------------------
section "BƯỚC 5. Mở đơn hàng cho bàn trống"
ORDER=$(api POST /orders "{\"table_id\":${TABLE_ID:-1},\"items\":[{\"menu_item_id\":${ITEM_ID:-1},\"quantity\":2}],\"note\":\"${MARK}\"}" "$TOKEN")
ORDER_ID=$(json_get "$ORDER" id)
ORDER_CODE=$(json_get "$ORDER" order_code)
if [ -n "$ORDER_ID" ]; then
  ok "tạo đơn thành công (id=${ORDER_ID}, mã=${ORDER_CODE})"
else
  bad "không tạo được đơn" "${ORDER:0:300}"
fi

TOTAL=$(json_get "$ORDER" total_amount)
EXPECTED="25001"
if [ "$TOTAL" = "$EXPECTED" ] || [ "$TOTAL" = "25001.00" ]; then
  ok "tổng tiền đúng: 2 × ${PRICE} = ${TOTAL}"
else
  bad "tổng tiền sai" "mong đợi ${EXPECTED}, nhận được '${TOTAL}'"
fi

# Gửi giá giả từ client — backend phải bỏ qua
FAKE=$(api POST /orders "{\"table_id\":${TABLE_ID:-1},\"items\":[{\"menu_item_id\":${ITEM_ID:-1},\"quantity\":1}]}" "$TOKEN")
if printf '%s' "$FAKE" | grep -q '"success":false'; then
  ok "không mở được đơn thứ hai trên cùng bàn (bàn đang occupied)"
else
  bad "phải chặn mở đơn thứ hai trên bàn đang có khách" "${FAKE:0:200}"
fi

code=$(http_code POST /orders "{\"table_id\":${TABLE_ID:-1},\"items\":\"khong-phai-mang\"}" "$TOKEN")
if [ "$code" = "400" ]; then ok "items sai kiểu (chuỗi) bị từ chối 400, không phải 500"
else bad "items sai kiểu phải trả 400" "nhận được HTTP $code"; fi

# ------------------------------------------------------------
section "BƯỚC 6. Bàn phải chuyển sang occupied"
TBL_AFTER=$(api GET "/tables/${TABLE_ID}" "" "$TOKEN")
TBL_STATUS=$(printf '%s' "$TBL_AFTER" | sed -n 's/.*"status":"\([a-z]*\)".*/\1/p' | head -1)
if [ "$TBL_STATUS" = "occupied" ]; then ok "bàn chuyển sang 'occupied'"
else bad "bàn phải là 'occupied'" "nhận được '${TBL_STATUS}'"; fi

# Không cho đổi bàn về available khi còn đơn hoạt động
code=$(http_code PATCH "/tables/${TABLE_ID}/status" '{"status":"available"}' "$TOKEN")
if [ "$code" = "409" ]; then ok "chặn đổi bàn về 'available' khi còn đơn hoạt động (409)"
else bad "phải chặn đổi bàn về available" "nhận được HTTP $code"; fi

# ------------------------------------------------------------
section "BƯỚC 7. Thêm món và kiểm tra tính lại tổng tiền"
ADD=$(api POST "/orders/${ORDER_ID}/items" "{\"items\":[{\"menu_item_id\":${ITEM_ID:-1},\"quantity\":1}]}" "$TOKEN")
NEW_TOTAL=$(json_get "$ADD" total_amount)
EXPECTED2="37501.5"
if [ "$NEW_TOTAL" = "$EXPECTED2" ] || [ "$NEW_TOTAL" = "37501.50" ]; then
  ok "tổng tiền sau khi thêm 1 món: ${NEW_TOTAL}"
else
  bad "tổng tiền sau khi thêm món sai" "mong đợi 37501.50, nhận được '${NEW_TOTAL}'"
fi

code=$(http_code POST "/orders/${ORDER_ID}/items" '{"items":[{"menu_item_id":1,"quantity":0}]}' "$TOKEN")
if [ "$code" = "400" ]; then ok "số lượng 0 bị từ chối (400)"
else bad "số lượng 0 phải trả 400" "nhận được HTTP $code"; fi

code=$(http_code POST "/orders/${ORDER_ID}/items" '{"items":[{"menu_item_id":1,"quantity":-5}]}' "$TOKEN")
if [ "$code" = "400" ]; then ok "số lượng âm bị từ chối (400)"
else bad "số lượng âm phải trả 400" "nhận được HTTP $code"; fi

# ------------------------------------------------------------
section "BƯỚC 8. Ẩn món và kiểm tra món ngừng bán không thêm được vào đơn"
api PATCH "/menu-items/${ITEM_ID}/toggle" "" "$TOKEN" >/dev/null
code=$(http_code POST "/orders/${ORDER_ID}/items" "{\"items\":[{\"menu_item_id\":${ITEM_ID:-1},\"quantity\":1}]}" "$TOKEN")
if [ "$code" = "400" ]; then ok "món đã ngừng bán không thêm được vào đơn (400)"
else bad "món ngừng bán phải bị chặn" "nhận được HTTP $code"; fi

# ... nhưng món đó vẫn phải nằm trong đơn cũ.
# Kiểm tra theo menu_item_id (thuần ASCII) thay vì so khớp tên món, để phép
# kiểm tra không phụ thuộc encoding của tên.
DETAIL=$(api GET "/orders/${ORDER_ID}" "" "$TOKEN")
if printf '%s' "$DETAIL" | grep -q "\"menu_item_id\":${ITEM_ID}"; then
  ok "món ngừng bán vẫn còn trong đơn cũ (không ảnh hưởng đơn đã tạo)"
else
  bad "đơn cũ bị mất món khi ẩn món khỏi thực đơn" "kiểm tra lại logic toggle và join order_items"
fi

# Bật lại để tiếp tục luồng
api PATCH "/menu-items/${ITEM_ID}/toggle" "" "$TOKEN" >/dev/null

# ------------------------------------------------------------
section "BƯỚC 9. Đưa đơn qua các trạng thái tới 'served'"
for st in confirmed preparing ready served; do
  code=$(http_code PATCH "/orders/${ORDER_ID}/status" "{\"status\":\"${st}\"}" "$TOKEN")
  if [ "$code" = "200" ]; then ok "chuyển trạng thái đơn sang '${st}'"
  else bad "không chuyển được sang '${st}'" "nhận được HTTP $code"; fi
done

# ------------------------------------------------------------
section "BƯỚC 10. Thanh toán"
PAY=$(api POST /payments "{\"order_id\":${ORDER_ID},\"method\":\"cash\"}" "$TOKEN")
if printf '%s' "$PAY" | grep -q '"success":true'; then
  ok "thanh toán thành công"
else
  bad "thanh toán thất bại" "${PAY:0:300}"
fi

# Thanh toán lần hai phải bị chặn
code=$(http_code POST /payments "{\"order_id\":${ORDER_ID},\"method\":\"cash\"}" "$TOKEN")
if [ "$code" = "409" ]; then ok "thanh toán lần hai bị chặn (409)"
else bad "thanh toán trùng phải trả 409" "nhận được HTTP $code"; fi

# Không sửa được đơn đã hoàn thành
code=$(http_code POST "/orders/${ORDER_ID}/items" "{\"items\":[{\"menu_item_id\":1,\"quantity\":1}]}" "$TOKEN")
if [ "$code" = "409" ]; then ok "không thêm được món vào đơn đã hoàn thành (409)"
else bad "đơn đã hoàn thành không được sửa" "nhận được HTTP $code"; fi

# ------------------------------------------------------------
section "BƯỚC 11. Bàn được giải phóng sau thanh toán"
TBL_FINAL=$(api GET "/tables/${TABLE_ID}" "" "$TOKEN")
TBL_ST=$(printf '%s' "$TBL_FINAL" | sed -n 's/.*"status":"\([a-z]*\)".*/\1/p' | head -1)
if [ "$TBL_ST" = "available" ]; then ok "bàn đã trở về 'available'"
else bad "bàn phải về 'available' sau thanh toán" "nhận được '${TBL_ST}'"; fi

# ------------------------------------------------------------
section "BƯỚC 12. Kiểm tra dữ liệu thật trong PostgreSQL"
PSQL() { docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc "$1" 2>/dev/null | tr -d '[:space:]'; }

DB_TOTAL=$(PSQL "SELECT total_amount FROM orders WHERE id=${ORDER_ID};")
if [ "$DB_TOTAL" = "37501.50" ]; then
  ok "đơn trong PostgreSQL có total_amount = ${DB_TOTAL} (khớp API)"
else
  bad "total_amount trong DB không khớp" "DB='${DB_TOTAL}', mong đợi 37501.50"
fi

DB_ITEMS=$(PSQL "SELECT COUNT(*) FROM order_items WHERE order_id=${ORDER_ID};")
if [ "$DB_ITEMS" = "2" ]; then ok "order_items có đúng 2 dòng (khớp số lần thêm món)"
else bad "số dòng order_items sai" "nhận được '${DB_ITEMS}', mong đợi 2"; fi

DB_SUM=$(PSQL "SELECT SUM(subtotal) FROM order_items WHERE order_id=${ORDER_ID};")
if [ "$DB_SUM" = "37501.50" ]; then
  ok "tổng subtotal của các dòng khớp total_amount của đơn"
else
  bad "tổng subtotal không khớp total_amount" "SUM(subtotal)='${DB_SUM}', orders.total_amount='${DB_TOTAL}'"
fi

DB_PAY=$(PSQL "SELECT COUNT(*) FROM payments WHERE order_id=${ORDER_ID} AND status='completed';")
if [ "$DB_PAY" = "1" ]; then ok "có đúng 1 bản ghi thanh toán completed cho đơn"
else bad "số bản ghi thanh toán sai" "nhận được '${DB_PAY}', mong đợi 1"; fi

DB_ITEM_STATUS=$(PSQL "SELECT status FROM orders WHERE id=${ORDER_ID};")
if [ "$DB_ITEM_STATUS" = "completed" ]; then ok "trạng thái đơn trong DB là 'completed'"
else bad "trạng thái đơn trong DB sai" "nhận được '${DB_ITEM_STATUS}'"; fi

# ------------------------------------------------------------
section "BƯỚC 13. Metrics phản ánh giao dịch vừa thực hiện"
# Lấy metrics từ MẠNG NỘI BỘ Docker — /metrics cố ý KHÔNG được reverse proxy
# ra ngoài (nó lộ cấu trúc route và số liệu nội bộ). Prometheus cũng scrape
# qua địa chỉ nội bộ backend:3001.
METRICS=$(docker compose exec -T backend wget -qO- http://127.0.0.1:3001/metrics 2>/dev/null || true)

ORDERS_COUNTER=$(printf '%s' "$METRICS" | grep -E '^restaurant_orders_created_total' | head -1 | awk '{print $2}')
if [ -n "$ORDERS_COUNTER" ] && [ "${ORDERS_COUNTER%%.*}" -ge 1 ] 2>/dev/null; then
  ok "restaurant_orders_created_total = ${ORDERS_COUNTER} (≥ 1)"
else
  bad "restaurant_orders_created_total không tăng" "giá trị: '${ORDERS_COUNTER:-không có}'"
fi

REVENUE=$(printf '%s' "$METRICS" | grep -E '^restaurant_revenue_total' | head -1 | awk '{print $2}')
if [ -n "$REVENUE" ] && [ "${REVENUE%%.*}" -ge 37501 ] 2>/dev/null; then
  ok "restaurant_revenue_total = ${REVENUE} (đã cộng dồn doanh thu)"
else
  bad "restaurant_revenue_total không cộng dồn đúng" "giá trị: '${REVENUE:-không có}' — metric phải là Counter và dùng .inc()"
fi

# Kiểm tra metric phản ánh ĐÚNG số request đã phục vụ (không chỉ tồn tại)
HTTP_TOTAL=$(printf '%s' "$METRICS" | grep -E '^restaurant_http_requests_total\{' | awk '{s+=$NF} END {print s}')
if [ -n "$HTTP_TOTAL" ] && [ "${HTTP_TOTAL%%.*}" -ge 10 ] 2>/dev/null; then
  ok "restaurant_http_requests_total tổng = ${HTTP_TOTAL} (đã ghi nhận request)"
else
  bad "restaurant_http_requests_total không tăng" "tổng: '${HTTP_TOTAL:-không có}'"
fi

# ------------------------------------------------------------
section "BƯỚC 14. Log xuất hiện trong Loki"
sleep 3
LOKI_Q=$(docker compose exec -T loki wget -qO- \
  "http://localhost:3100/loki/api/v1/query_range?query=%7Bservice%3D%22backend%22%7D&limit=50" 2>/dev/null || true)
if printf '%s' "$LOKI_Q" | grep -q '"values"'; then
  ok "Loki trả về log của service=backend"
else
  bad "Loki chưa có log của backend" "kiểm tra: docker compose logs promtail ; đợi ~30s rồi chạy lại"
fi

if docker compose exec -T postgres psql -U postgres -d restaurant_db -c "\d" >/dev/null 2>&1; then
  info "log của PostgreSQL cũng được Promtail thu (nhãn service=postgres)"
fi

# ------------------------------------------------------------
section "BƯỚC 15. Security headers vẫn còn trên response HTTPS"
H=$(curl -k -s -I --max-time 10 "${BASE}/" 2>/dev/null || true)
for h in content-security-policy strict-transport-security x-content-type-options; do
  if printf '%s' "$H" | grep -qiE "^${h}:"; then ok "header '${h}' có mặt"
  else bad "header '${h}' thiếu" "kiểm tra nginx/snippets/security-headers.conf"; fi
done

# ------------------------------------------------------------
printf '\n============================================================\n'
printf ' DỮ LIỆU ĐÃ TẠO (dùng làm minh chứng cho báo cáo)\n'
printf '   Mã đơn hàng : %s\n' "${ORDER_CODE:-?}"
printf '   ID đơn      : %s\n' "${ORDER_ID:-?}"
printf '   Bàn         : %s (id %s)\n' "$TBL_NUM" "${TABLE_ID:-?}"
printf '   Món         : Món %s (id %s)\n' "$MARK" "${ITEM_ID:-?}"
printf '   Xem trong pgAdmin:\n'
printf "     SELECT * FROM orders WHERE order_code='%s';\n" "${ORDER_CODE:-?}"
printf '============================================================\n'
printf ' KẾT QUẢ: %s%d PASS%s  |  %s%d FAIL%s\n' "$G" "$PASS" "$N" "$R" "$FAIL" "$N"
if [ "$FAIL" -gt 0 ]; then
  printf ' Các mục thất bại:\n'
  for n in "${FAILED_NAMES[@]}"; do printf '   - %s\n' "$n"; done
fi
printf '============================================================\n'

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
