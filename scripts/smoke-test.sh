#!/usr/bin/env bash
# ============================================================
# Smoke test - kiểm tra nhanh toàn bộ stack đang chạy
#
# Phạm vi: chỉ KIỂM TRA, KHÔNG ghi dữ liệu nghiệp vụ.
# Tiền điều kiện: `docker compose up -d` đã chạy xong và container đã healthy.
#
# Cách dùng:
#   bash scripts/smoke-test.sh
#
# Mã trả về: 0 = tất cả PASS, 1 = có ít nhất 1 FAIL.
# ============================================================
set -uo pipefail

# ---- Cổng lấy từ biến môi trường, mặc định khớp docker-compose.yml ----
WEB_PORT="${WEB_PORT:-8083}"
WEB_SSL_PORT="${WEB_SSL_PORT:-8443}"
PROMETHEUS_PORT="${PROMETHEUS_PORT:-9091}"
GRAFANA_PORT="${GRAFANA_PORT:-3002}"
PGADMIN_HOST_PORT="${PGADMIN_HOST_PORT:-5051}"
LOKI_URL_INTERNAL="http://localhost:3100"   # truy cập qua docker compose exec

APP_USER="${SMOKE_APP_USER:-quantrongbong}"
APP_PASS="${SMOKE_APP_PASS:-Trongbong123@}"

PASS=0
FAIL=0
FAILED_NAMES=()

# ---- Màu (tắt nếu không phải terminal) ----
if [ -t 1 ]; then
  G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[36m'; N=$'\033[0m'
else
  G=''; R=''; Y=''; B=''; N=''
fi

section() { printf '\n%s=== %s ===%s\n' "$B" "$1" "$N"; }

ok()   { PASS=$((PASS+1)); printf '  %s[PASS]%s %s\n' "$G" "$N" "$1"; }
bad()  { FAIL=$((FAIL+1)); FAILED_NAMES+=("$1"); printf '  %s[FAIL]%s %s\n' "$R" "$N" "$1"; [ -n "${2:-}" ] && printf '         %s\n' "$2"; }
skip() { printf '  %s[SKIP]%s %s\n' "$Y" "$N" "$1"; }

# Kiểm tra một URL trả về mã HTTP mong đợi
# $1 = mô tả, $2 = url, $3 = mã mong đợi (có thể là danh sách cách nhau dấu |)
# $4 = token Bearer (tuỳ chọn)
check_http() {
  local desc="$1" url="$2" want="$3" token="${4:-}"
  local code
  local args=(-k -s -o /dev/null -w '%{http_code}' --max-time 10)
  [ -n "$token" ] && args+=(-H "Authorization: Bearer ${token}")
  code=$(curl "${args[@]}" "$url" 2>/dev/null) || code="000"
  if printf '%s' "$want" | tr '|' '\n' | grep -qx "$code"; then
    ok "$desc (HTTP $code)"
  else
    bad "$desc" "mong đợi HTTP $want, nhận được $code — URL: $url"
  fi
}

echo "============================================================"
echo " SMOKE TEST - Hệ thống quản lý nhà hàng An Phúc"
echo " Thời điểm: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================================"

# ------------------------------------------------------------
section "1. Docker: container tồn tại và đang chạy"
EXPECTED_SERVICES="postgres pgadmin backend frontend nginx prometheus grafana loki promtail postgres-exporter nginx-exporter cadvisor"
RUNNING=$(docker compose ps --services --filter status=running 2>/dev/null || true)
for svc in $EXPECTED_SERVICES; do
  if printf '%s\n' "$RUNNING" | grep -qx "$svc"; then
    ok "container '$svc' đang chạy"
  else
    bad "container '$svc' KHÔNG chạy" "chạy: docker compose up -d $svc ; xem log: docker compose logs $svc"
  fi
done

# ------------------------------------------------------------
section "2. Nginx reverse proxy - HTTP chuyển hướng sang HTTPS"
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:${WEB_PORT}/" 2>/dev/null) || code="000"
loc=$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 10 "http://localhost:${WEB_PORT}/" 2>/dev/null) || loc=""
if [ "$code" = "301" ] && printf '%s' "$loc" | grep -q "https://"; then
  ok "HTTP :${WEB_PORT} chuyển hướng 301 sang HTTPS (${loc})"
else
  bad "HTTP :${WEB_PORT} phải trả 301 sang HTTPS" "nhận được HTTP $code, Location='$loc'"
fi

# ------------------------------------------------------------
section "3. HTTPS hoạt động qua reverse proxy"
check_http "HTTPS :${WEB_SSL_PORT} - trang chủ" "https://localhost:${WEB_SSL_PORT}/" "200"
check_http "HTTPS :${WEB_SSL_PORT}/healthz - nginx sống" "https://localhost:${WEB_SSL_PORT}/healthz" "200"

# ------------------------------------------------------------
section "4. Security headers tại Nginx"
HDRS=$(curl -k -s -I --max-time 10 "https://localhost:${WEB_SSL_PORT}/" 2>/dev/null || true)
check_header() {
  local name="$1" pattern="$2"
  if printf '%s' "$HDRS" | grep -qiE "^${pattern}"; then
    ok "header $name có mặt"
  else
    bad "header $name THIẾU" "thêm vào nginx/snippets/security-headers.conf"
  fi
}
check_header "Content-Security-Policy" "content-security-policy:"
check_header "Strict-Transport-Security" "strict-transport-security:"
check_header "X-Content-Type-Options" "x-content-type-options:"
check_header "X-Frame-Options" "x-frame-options:"
check_header "Referrer-Policy" "referrer-policy:"
check_header "Permissions-Policy" "permissions-policy:"

if printf '%s' "$HDRS" | grep -qiE "^server:.*nginx/[0-9]"; then
  bad "server_tokens để lộ phiên bản nginx" "đặt 'server_tokens off' trong nginx template"
else
  ok "server_tokens đã tắt (không lộ phiên bản)"
fi

if printf '%s' "$HDRS" | grep -qiE "content-security-policy:.*unsafe-eval"; then
  bad "CSP chứa 'unsafe-eval'" "gỡ 'unsafe-eval' khỏi script-src"
else
  ok "CSP không cấp 'unsafe-eval'"
fi

# ------------------------------------------------------------
section "5. Backend API - health check"
HEALTH=$(curl -k -s --max-time 10 "https://localhost:${WEB_SSL_PORT}/health" 2>/dev/null || true)
if printf '%s' "$HEALTH" | grep -q '"database":"connected"'; then
  ok "backend /health báo database đã kết nối"
else
  bad "backend /health không báo database connected" "nhận được: ${HEALTH:0:200}"
fi

# ------------------------------------------------------------
section "6. Xác thực API"
LOGIN_BODY=$(curl -k -s --max-time 15 -X POST \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${APP_USER}\",\"password\":\"${APP_PASS}\"}" \
  "https://localhost:${WEB_SSL_PORT}/api/v1/auth/login" 2>/dev/null || true)

TOKEN=$(printf '%s' "$LOGIN_BODY" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -n "$TOKEN" ]; then
  ok "đăng nhập thành công, nhận được JWT (${#TOKEN} ký tự)"
else
  bad "đăng nhập thất bại" "kiểm tra tài khoản '${APP_USER}' đã được seed chưa: docker compose exec postgres psql -U postgres -d restaurant_db -c 'SELECT username FROM users;'"
fi

# Endpoint yêu cầu xác thực phải từ chối khi không có token
check_http "GET /api/v1/orders không token → 401" "https://localhost:${WEB_SSL_PORT}/api/v1/orders" "401"

if [ -n "$TOKEN" ]; then
  check_http "GET /api/v1/menu-items có token → 200" \
    "https://localhost:${WEB_SSL_PORT}/api/v1/menu-items" "200" "$TOKEN"

  AUTHORDERS=$(curl -k -s --max-time 10 -H "Authorization: Bearer ${TOKEN}" \
    "https://localhost:${WEB_SSL_PORT}/api/v1/orders?page=1&limit=5" 2>/dev/null || true)
  if printf '%s' "$AUTHORDERS" | grep -q '"success":true'; then
    ok "GET /api/v1/orders có token → dữ liệu hợp lệ"
  else
    bad "GET /api/v1/orders có token nhưng trả lỗi" "nhận được: ${AUTHORDERS:0:200}"
  fi
fi

# ------------------------------------------------------------
section "7. Backend metrics (prom-client)"
# Metrics được lấy từ MẠNG NỘI BỘ Docker, KHÔNG qua Nginx.
# Đây là chủ ý: /metrics không được reverse proxy ra ngoài vì nó lộ thông tin
# nội bộ (tên route, số kết nối, cấu hình tiến trình). Prometheus cũng scrape
# qua địa chỉ nội bộ backend:3001.
METRICS=$(docker compose exec -T backend wget -qO- http://127.0.0.1:3001/metrics 2>/dev/null || true)
if [ -z "$METRICS" ]; then
  bad "không lấy được /metrics từ backend" "kiểm tra: docker compose logs backend"
fi
# Lưu ý về định dạng exposition của Prometheus:
#  - Counter/Gauge: có dòng "# HELP <tên>" và dòng dữ liệu "<tên>{...} <giá trị>"
#  - Histogram: "# HELP" và "# TYPE" dùng tên GỐC (không hậu tố), còn dữ liệu
#    nằm ở "<tên>_bucket", "<tên>_sum", "<tên>_count" và KHÔNG có dòng HELP riêng.
# Vì vậy phải chấp nhận cả hai dạng: có dòng HELP/TYPE, HOẶC có dòng dữ liệu.
#
# Tên metric mặc định của prom-client có tiền tố 'restaurant_api_'
# (do collectDefaultMetrics({ prefix: 'restaurant_api_' })).
metric_present() {
  printf '%s' "$METRICS" | grep -qE "^(# (HELP|TYPE) $1([[:space:]]|$)|$1(\{|[[:space:]]))"
}

for m in restaurant_http_requests_total \
         restaurant_http_request_duration_seconds \
         restaurant_http_request_duration_seconds_bucket \
         restaurant_api_process_cpu_user_seconds_total \
         restaurant_api_nodejs_heap_size_used_bytes \
         restaurant_active_connections \
         restaurant_orders_created_total \
         restaurant_revenue_total; do
  if metric_present "$m"; then
    ok "metric '${m}' có mặt"
  else
    bad "metric '${m}' KHÔNG có mặt" "backend/src/utils/metrics.js chưa khai báo metric này"
  fi
done

# ------------------------------------------------------------
section "8. Prometheus - target UP"
check_http "Prometheus UI" "http://127.0.0.1:${PROMETHEUS_PORT}/-/healthy" "200"

# Dùng endpoint /api/v1/query với metric `up` — đơn giản và ổn định hơn
# việc tự phân tích JSON của /api/v1/targets bằng grep.
# `up{job="X"}` trả về `"value":[<timestamp>,"1"]` khi target UP, `"0"` khi DOWN.
if curl -s --max-time 10 "http://127.0.0.1:${PROMETHEUS_PORT}/api/v1/query?query=up" >/dev/null 2>&1; then
  for job in prometheus backend postgres-exporter nginx-exporter cadvisor; do
    RESULT=$(curl -s -G --max-time 10 \
      --data-urlencode "query=up{job=\"${job}\"}" \
      "http://127.0.0.1:${PROMETHEUS_PORT}/api/v1/query" 2>/dev/null || true)

    if printf '%s' "$RESULT" | grep -q '"value":\[[0-9.]*,"1"\]'; then
      ok "Prometheus target '${job}' = UP"
    elif printf '%s' "$RESULT" | grep -q '"value":\[[0-9.]*,"0"\]'; then
      bad "Prometheus target '${job}' = DOWN" "xem http://127.0.0.1:${PROMETHEUS_PORT}/targets để biết lỗi scrape"
    else
      bad "Prometheus target '${job}' không tồn tại" "job này chưa được khai báo trong prometheus/prometheus.yml"
    fi
  done
else
  bad "không gọi được Prometheus API" "kiểm tra: docker compose logs prometheus"
fi

# ------------------------------------------------------------
section "9. Grafana"
check_http "Grafana health" "http://127.0.0.1:${GRAFANA_PORT}/api/health" "200"

# Kiểm tra datasource đã được provision (không cần đăng nhập với endpoint này trả 401 — cần token)
DS_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://127.0.0.1:${GRAFANA_PORT}/api/datasources" 2>/dev/null) || DS_CODE="000"
if [ "$DS_CODE" = "401" ]; then
  ok "Grafana API yêu cầu xác thực (đúng — anonymous bị tắt)"
else
  bad "Grafana API không yêu cầu xác thực" "GF_AUTH_ANONYMOUS_ENABLED phải là 'false', nhận được HTTP $DS_CODE"
fi

# ------------------------------------------------------------
section "10. Loki và Promtail"
LOKI_READY=$(docker compose exec -T loki wget -qO- http://localhost:3100/ready 2>/dev/null || true)
if printf '%s' "$LOKI_READY" | grep -qi "ready"; then
  ok "Loki :3100 báo ready"
else
  bad "Loki chưa ready" "xem: docker compose logs loki"
fi

LOKI_LABELS=$(docker compose exec -T loki wget -qO- http://localhost:3100/loki/api/v1/labels 2>/dev/null || true)
if printf '%s' "$LOKI_LABELS" | grep -q "service"; then
  ok "Loki đã có nhãn 'service' (Promtail đang gửi log)"
else
  printf '  %s[WARN]%s Loki chưa có nhãn "service" — Promtail có thể chưa gửi log nào\n' "$Y" "$N"
  printf '         Đợi ~30s rồi chạy lại, hoặc phát sinh log bằng một request bất kỳ.\n'
fi

# Image grafana/promtail KHÔNG có wget/curl/nc/busybox (đã kiểm chứng),
# nhưng có bash → dùng /dev/tcp của bash để kiểm tra HTTP server nội bộ.
PT_READY=$(docker compose exec -T promtail bash -c \
  'exec 3<>/dev/tcp/127.0.0.1/9080; printf "GET /ready HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n" >&3; head -1 <&3' 2>/dev/null || true)
if printf '%s' "$PT_READY" | grep -q "200"; then
  ok "Promtail :9080 phản hồi HTTP 200"
else
  bad "Promtail không phản hồi" "xem: docker compose logs promtail"
fi

# ------------------------------------------------------------
section "11. pgAdmin"
check_http "pgAdmin UI (:${PGADMIN_HOST_PORT})" "http://127.0.0.1:${PGADMIN_HOST_PORT}/login" "200"

# ------------------------------------------------------------
section "12. PostgreSQL - kết nối và ràng buộc"
if docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc "SELECT 1" >/dev/null 2>&1; then
  ok "kết nối PostgreSQL từ container thành công"

  TABLES=$(docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" 2>/dev/null | tr -d '[:space:]')
  if [ "$TABLES" = "7" ]; then
    ok "schema có đủ 7 bảng"
  else
    bad "schema có ${TABLES:-0} bảng, mong đợi 7" "users, categories, menu_items, dining_tables, orders, order_items, payments"
  fi

  # appuser KHÔNG được là superuser
  SUPER=$(docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc \
    "SELECT rolsuper FROM pg_roles WHERE rolname='appuser';" 2>/dev/null | tr -d '[:space:]')
  if [ "$SUPER" = "f" ]; then
    ok "appuser KHÔNG phải superuser (least privilege)"
  else
    bad "appuser là superuser (rolsuper='${SUPER}')" "sửa database/init.sh — không cấp SUPERUSER cho tài khoản ứng dụng"
  fi

  # Ràng buộc UNIQUE chặn thanh toán 2 lần
  UNIQ=$(docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc \
    "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='payments'::regclass AND contype='u';" 2>/dev/null | tr -d '[:space:]')
  if [ "${UNIQ:-0}" -ge 1 ]; then
    ok "payments có ràng buộc UNIQUE (chặn thanh toán trùng)"
  else
    bad "payments THIẾU ràng buộc UNIQUE trên order_id" "chạy migration 001_init_schema.sql"
  fi
else
  bad "không kết nối được PostgreSQL" "xem: docker compose logs postgres"
fi

# ------------------------------------------------------------
section "13. Dữ liệu lưu bền (volume tồn tại)"
for v in restaurant-postgres-data restaurant-grafana-data restaurant-prometheus-data restaurant-loki-data; do
  if docker volume inspect "$v" >/dev/null 2>&1; then
    ok "volume '${v}' tồn tại"
  else
    bad "volume '${v}' KHÔNG tồn tại" "dữ liệu sẽ mất khi container bị tạo lại"
  fi
done

# ============================================================
printf '\n============================================================\n'
printf ' KẾT QUẢ: %s%d PASS%s  |  %s%d FAIL%s\n' "$G" "$PASS" "$N" "$R" "$FAIL" "$N"
if [ "$FAIL" -gt 0 ]; then
  printf ' Các mục thất bại:\n'
  for n in "${FAILED_NAMES[@]}"; do printf '   - %s\n' "$n"; done
fi
printf '============================================================\n'

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
