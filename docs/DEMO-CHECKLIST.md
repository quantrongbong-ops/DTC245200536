# Checklist Demo và Nộp bài

> Hướng dẫn thực hành **theo đúng thứ tự**. Mỗi bước gồm:
> **lệnh cần chạy → URL cần mở → kết quả cần thấy → ảnh cần chụp → cách xử lý nếu thất bại**.
>
> Ô `[ ]` dùng để bạn tích khi đã làm xong.

---

## Chuẩn bị trước khi demo (làm trước 1 ngày)

- [ ] **C1.** Docker Desktop đã cài và chạy được
- [ ] **C2.** Còn ít nhất **5 GB** trống trên ổ C:
- [ ] **C3.** Đã tạo file `.env` từ `.env.example` với mật khẩu mạnh
- [ ] **C4.** Đã điền thông tin sinh viên vào `README.md` (mục đầu) và báo cáo
- [ ] **C5.** Đã tạo repository GitHub và push code (xem bước 11)
- [ ] **C6.** Đã chụp đủ ảnh trong `docs/screenshots/`

Kiểm tra nhanh C1 và C2:

```bash
docker info --format '{{.ServerVersion}}'   # phải in ra phiên bản, không báo lỗi
df -h /c 2>/dev/null | tail -1               # cột "Avail" phải còn vài GB
```

---

## Bước 1 — Kiểm tra Docker

**Lệnh:**

```bash
docker --version
docker compose version
docker info --format 'Server: {{.ServerVersion}} | Containers: {{.Containers}}'
```

**Kết quả cần thấy:** cả ba lệnh đều in ra phiên bản, **không** có dòng
`Cannot connect to the Docker daemon`.

**Xử lý nếu thất bại:**

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop chưa chạy | Mở Docker Desktop, chờ biểu tượng trên khay hệ thống chuyển màu xanh |
| `docker: command not found` | Chưa cài Docker Desktop | Cài từ https://www.docker.com/products/docker-desktop |
| WSL 2 kernel outdated | WSL2 lỗi thời | Chạy `wsl --update` trong PowerShell (quyền Admin) |

**Ảnh cần chụp:** không bắt buộc.

---

## Bước 2 — Khởi động toàn bộ stack

**Tiền điều kiện:** đang ở thư mục gốc dự án và đã có file `.env`.

**Lệnh:**

```bash
docker compose up -d --build
```

**Kết quả cần thấy:** dòng cuối là các dòng `Container restaurant-xxx  Started`.
Lần đầu mất **3–10 phút**. Các lần sau nhanh hơn nhiều nhờ cache.

**Xử lý nếu thất bại:**

| Lỗi | Cách sửa |
|---|---|
| `input/output error` khi build | Ổ đĩa đầy — xem C2 |
| `failed to solve: node:20-alpine` | Không tải được image. Kiểm tra mạng, hoặc thử `docker pull node:20-alpine` |
| `port is already allocated` | Cổng đang bị chiếm. Xem bước 3 để biết cổng nào, rồi tắt ứng dụng đang dùng cổng đó |
| `variable is not set. Defaulting to a blank string` | `.env` thiếu biến. So sánh với `.env.example` |

**Ảnh cần chụp:** không (kết quả ở bước 3).

---

## Bước 3 — Kiểm tra trạng thái container

**Lệnh:**

```bash
docker compose ps
```

**Kết quả cần thấy:** **12 container**, tất cả ở trạng thái `Up` và có `(healthy)`:

```
NAME                            SERVICE              STATUS
restaurant-nginx                nginx                Up X minutes (healthy)
restaurant-backend              backend              Up X minutes (healthy)
restaurant-frontend             frontend             Up X minutes (healthy)
restaurant-postgres             postgres             Up X minutes (healthy)
restaurant-pgadmin              pgadmin              Up X minutes (healthy)
restaurant-prometheus           prometheus           Up X minutes (healthy)
restaurant-grafana              grafana              Up X minutes (healthy)
restaurant-loki                 loki                 Up X minutes (healthy)
restaurant-promtail             promtail             Up X minutes (healthy)
restaurant-postgres-exporter    postgres-exporter    Up X minutes (healthy)
restaurant-nginx-exporter       nginx-exporter       Up X minutes (healthy)
restaurant-cadvisor             cadvisor             Up X minutes (healthy)
```

**Xử lý nếu thất bại:**

```bash
# Xem container nào không lên
docker compose ps --format "table {{.Service}}\t{{.Status}}"

# Xem log của container lỗi (thay <service> bằng tên ở trên)
docker compose logs --tail=50 <service>
```

| Triệu chứng | Cách sửa |
|---|---|
| Container ở trạng thái `Restarting` | Xem log rồi sửa nguyên nhân; thường do thiếu biến trong `.env` |
| `(unhealthy)` kéo dài | `docker compose logs <service>` — healthcheck đang thất bại |
| `Exited (1)` | Backend thoát vì không kết nối được database — kiểm tra `postgres` đã healthy chưa |

**Ảnh cần chụp:** 📸 **`01-docker-ps.png`**

---

## Bước 4 — Truy cập website qua Nginx

**URL:** https://localhost:8443

**Kết quả cần thấy:**

1. Trình duyệt hiện cảnh báo **"Your connection is not private"** / `NET::ERR_CERT_AUTHORITY_INVALID`.
   → Bấm **Advanced** → **Proceed to localhost (unsafe)**.
   Đây là hành vi **đúng** với chứng chỉ tự ký, **không phải lỗi**.
2. Trang đăng nhập hiện ra với giao diện tiếng Việt.
3. Trên thanh địa chỉ có **ổ khoá** và `https://`.

**Kiểm tra thêm bằng dòng lệnh:**

```bash
# HTTP phải chuyển hướng sang HTTPS
curl -s -o /dev/null -w 'HTTP %{http_code} -> %{redirect_url}\n' http://localhost:8083/

# HTTPS phải trả 200
curl -k -s -o /dev/null -w 'HTTPS %{http_code}\n' https://localhost:8443/
```

Kỳ vọng: dòng đầu `HTTP 301 -> https://localhost:8443/`; dòng sau `HTTPS 200`.

**Xử lý nếu thất bại:**

| Triệu chứng | Cách sửa |
|---|---|
| `502 Bad Gateway` | Backend chưa healthy: `docker compose logs backend` |
| `504 Gateway Time-out` | Backend treo: kiểm tra `docker compose logs backend`, có thể tăng timeout |
| Trang trắng, không lỗi | Mở DevTools (F12) → Console. Kiểm tra `/api/v1/...` có trả 404 không |
| Không kết nối được | Kiểm tra `docker compose ps nginx` và `docker compose logs nginx` |

**Ảnh cần chụp:** 📸 **`02-tls-warning.png`** (cảnh báo chứng chỉ),
📸 **`03-login-page.png`**, 📸 **`22-logo-and-fonts.png`**

---

## Bước 5 — Thực hiện một luồng nghiệp vụ hoàn chỉnh

> Đây là bước **quan trọng nhất** để chứng minh hệ thống hoạt động.
> Bạn có thể làm thủ công hoặc chạy `bash scripts/e2e-test.sh` để làm tự động.

### 5.1 Đăng nhập

- **Thao tác:** nhập `quantrongbong` / `Trongbong123@` → bấm **Đăng nhập**
- **Kết quả cần thấy:** vào được trang Tổng quan, góc phải hiện tên người dùng
- 📸 **`04-dashboard.png`**

### 5.2 Xem và tạo món ăn

- **Thao tác:** menu trái → **Quản lý món ăn**
- **Kết quả cần thấy:** danh sách món có phân trang, có danh mục và giá
- 📸 **`05-menu-list.png`**
- **Thao tác:** bấm **Thêm món** → điền tên `Món demo <tên bạn>`, chọn danh mục,
  giá `12500.50` → **Lưu**
- **Kết quả cần thấy:** món mới xuất hiện đầu danh sách
- 📸 **`06-menu-create.png`**

**Kiểm tra validation:**

| Thao tác | Kết quả mong đợi |
|---|---|
| Nhập giá `-1000` | Báo lỗi, không lưu được |
| Để trống tên món | Báo lỗi, không lưu được |
| Nhập giá `abc` | Báo lỗi, không lưu được |

### 5.3 Tạo bàn và mở đơn hàng

- **Thao tác:** menu trái → **Quản lý bàn ăn** → **Thêm bàn**
  → số bàn `DEMO01`, khu vực `Khu demo`, sức chứa `4` → **Lưu**
- **Kết quả cần thấy:** bàn `DEMO01` hiện trong sơ đồ, màu xanh (trống)
- 📸 **`07-tables.png`**
- **Thao tác:** bấm vào bàn `DEMO01` → **Mở đơn hàng**
- **Kết quả cần thấy:** màn hình chọn món, bàn chuyển sang màu đỏ (có khách)
- 📸 **`08-new-order.png`**

### 5.4 Thêm món và kiểm tra tổng tiền

- **Thao tác:** chọn món vừa tạo, số lượng `2` → **Thêm vào đơn**
- **Kết quả cần thấy:** tổng tiền = **2 × 12.500,50 = 25.001 đ**
- **Thao tác:** thêm thêm 1 suất món đó
- **Kết quả cần thấy:** tổng tiền = **37.501,50 đ** (không phải 37.501 hay 37.502)
- 📸 **`09-order-detail.png`**

**Kiểm tra số lượng không hợp lệ:** thử nhập `0` hoặc `-1` → phải báo lỗi.

**Kiểm tra món ngừng bán:**

- **Thao tác:** sang **Quản lý món ăn**, bấm nút ẩn món demo (biểu tượng con mắt)
- **Kết quả cần thấy:** món vẫn **còn** trong đơn cũ (giá đã chốt không đổi),
  nhưng nếu thử **thêm mới** món đó vào đơn thì bị từ chối

### 5.5 Đưa đơn qua các trạng thái

- **Thao tác:** nhấn nút chuyển trạng thái lần lượt:
  `pending` → `confirmed` → `preparing` → `ready` → `served`
- **Kết quả cần thấy:** mỗi lần bấm, trạng thái đổi và có thông báo thành công
- 📸 **`10-order-status.png`**

**Kiểm tra màn hình bếp:** menu trái → **Nhà bếp** → phải thấy món của bàn `DEMO01`
- 📸 **`11-kitchen.png`**

### 5.6 Thanh toán

- **Thao tác:** vào đơn → **Thanh toán** → chọn phương thức **Tiền mặt** → xác nhận
- **Kết quả cần thấy:** thanh toán thành công, **bàn `DEMO01` trở về màu xanh (trống)**
- 📸 **`12-payment.png`**

**Kiểm tra không thanh toán hai lần:**

```bash
# Thay <ORDER_ID> bằng id đơn vừa tạo
curl -k -s -o /dev/null -w '%{http_code}\n' \
  -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"order_id":<ORDER_ID>,"method":"cash"}' \
  https://localhost:8443/api/v1/payments
```

Kỳ vọng: **409** (đã thanh toán rồi).

### 5.7 Xem báo cáo

- **Thao tác:** menu trái → **Báo cáo**
- **Kết quả cần thấy:** doanh thu hôm nay bao gồm đơn vừa thanh toán, biểu đồ có dữ liệu
- 📸 **`13-reports.png`**

---

## Bước 6 — pgAdmin: chứng minh dữ liệu có trong PostgreSQL

**URL:** http://127.0.0.1:5051

**Thao tác:**

1. Đăng nhập bằng `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` trong `.env`
2. Ở cây bên trái, mở **Servers → RestaurantDB** (đã cấu hình sẵn)
3. Mở **Databases → restaurant_db → Schemas → public → Tables**
4. **Kết quả cần thấy:** đúng **7 bảng**: `categories`, `dining_tables`, `menu_items`,
   `order_items`, `orders`, `payments`, `users`
5. 📸 **`14-pgadmin-tables.png`**

**Chứng minh dữ liệu thật:**

- Chuột phải **restaurant_db** → **Query Tool**
- Chạy truy vấn:

```sql
SELECT
    o.id,
    o.order_code,
    dt.table_number,
    o.status,
    o.subtotal,
    o.total_amount,
    o.created_at
FROM orders o
JOIN dining_tables dt ON o.table_id = dt.id
ORDER BY o.created_at DESC
LIMIT 10;
```

- **Kết quả cần thấy:** đơn vừa tạo ở dòng đầu, `total_amount` = `37501.50`
- 📸 **`15-pgadmin-query.png`**

**Chứng minh chi tiết đơn hàng liên kết đúng:**

```sql
SELECT
    oi.id,
    mi.name AS ten_mon,
    oi.quantity AS so_luong,
    oi.unit_price AS don_gia,
    oi.subtotal AS thanh_tien,
    oi.status
FROM order_items oi
JOIN menu_items mi ON oi.menu_item_id = mi.id
WHERE oi.order_id = (SELECT MAX(id) FROM orders);
```

- **Kết quả cần thấy:** thành tiền = số lượng × đơn giá (do database tự tính)
- 📸 **`16-pgadmin-order-items.png`**

**Chứng minh thanh toán đã ghi nhận:**

```sql
SELECT p.id, o.order_code, p.amount, p.method, p.status, p.paid_at
FROM payments p
JOIN orders o ON p.order_id = o.id
ORDER BY p.paid_at DESC
LIMIT 5;
```

**Xử lý nếu thất bại:**

| Triệu chứng | Cách sửa |
|---|---|
| pgAdmin không mở được | `docker compose ps pgadmin` và `docker compose logs pgadmin` |
| Server `RestaurantDB` báo lỗi kết nối | Mật khẩu trong `docker/pgadmin/pgpass` phải khớp `APP_DB_PASSWORD` trong `.env`. Sửa file `pgpass` rồi `docker compose restart pgadmin` |
| Không thấy bảng nào | Schema chưa được tạo. Xem bước 7 để kiểm tra |

---

## Bước 7 — Prometheus: chứng minh target UP

**URL:** http://127.0.0.1:9091

**Thao tác:** menu trên → **Status** → **Targets**
(hoặc mở trực tiếp http://127.0.0.1:9091/targets)

**Kết quả cần thấy:** **5 target**, tất cả cột **State** đều màu xanh với chữ `UP`:

| Endpoint | Job |
|---|---|
| `http://localhost:9090/metrics` | prometheus |
| `http://backend:3001/metrics` | backend |
| `http://postgres-exporter:9187/metrics` | postgres-exporter |
| `http://nginx-exporter:9113/metrics` | nginx-exporter |
| `http://cadvisor:8080/metrics` | cadvisor |

- 📸 **`17-prometheus-targets.png`**

**Chứng minh có dữ liệu thật:**

- Vào http://127.0.0.1:9091/graph
- Dán truy vấn sau vào ô **Expression** rồi bấm **Execute**:

```promql
restaurant_orders_created_total
```

- **Kết quả cần thấy:** biểu đồ có giá trị, bảng bên dưới hiện số đơn đã tạo
- 📸 **`18-prometheus-graph.png`**

Thử thêm:

```promql
sum by (status_code) (rate(restaurant_http_requests_total[5m]))
```

**Xử lý nếu thất bại:**

| Triệu chứng | Cách sửa |
|---|---|
| Target `backend` DOWN | `docker compose logs backend`; kiểm tra `curl -k https://localhost:8443/metrics` |
| Target `postgres-exporter` DOWN | Sai mật khẩu trong `DATA_SOURCE_NAME`. Kiểm tra `APP_DB_PASSWORD` trong `.env` |
| Target `nginx-exporter` DOWN | `stub_status` không truy cập được: `docker compose logs nginx-exporter` |
| Target `cadvisor` DOWN | `docker compose logs cadvisor` |
| Tất cả target DOWN | `docker compose logs prometheus` — thường do lỗi cú pháp YAML |

---

## Bước 8 — Grafana: trình bày dashboard

**URL:** http://127.0.0.1:3002

**Thao tác:**

1. Đăng nhập bằng `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` trong `.env`
2. Menu trái → **Dashboards** → thư mục **Restaurant**
3. Mở dashboard **Tổng quan hệ thống**

**Kết quả cần thấy:**

- Dashboard mở **không cần tạo tay** (đã được provision tự động)
- Các panel **có dữ liệu thật** (đường biểu đồ nhấp nhô, không phải "No data")
- Khoảng thời gian: chọn **Last 15 minutes** để thấy dữ liệu mới nhất
- 📸 **`19-grafana-dashboard.png`**

**Kiểm chứng datasource:**

- Menu trái → **Connections** → **Data sources**
- **Kết quả cần thấy:** có **2 datasource**: `Prometheus` và `Loki`, cả hai báo
  *"Data source is working"* khi bấm **Save & test**
- 📸 **`20-grafana-datasources.png`**

**Xử lý nếu thất bại:**

| Triệu chứng | Cách sửa |
|---|---|
| Không thấy dashboard nào | `docker compose logs grafana`, kiểm tra `docker/grafana/provisioning/dashboards/` |
| Panel hiện "No data" | Đổi khoảng thời gian sang **Last 15 minutes**; kiểm tra datasource Prometheus trỏ đúng `http://prometheus:9090` |
| Không đăng nhập được | Đặt lại mật khẩu: `docker compose exec grafana grafana-cli admin reset-admin-password <mật_khẩu_mới>` |

---

## Bước 9 — Grafana Explore: chạy 3 truy vấn LogQL

**Thao tác:**

1. Menu trái → **Explore** (biểu tượng la bàn)
2. Ở dropdown datasource phía trên, chọn **Loki**
3. Chọn **Last 1 hour** ở góc phải
4. Dán từng truy vấn dưới đây vào ô **Query**, bấm **Run query**

### Truy vấn 1 — Log của ứng dụng backend

```logql
{service="backend"}
```

**Kết quả cần thấy:** các dòng log JSON của backend, có timestamp, có `orderCode`.
- 📸 **`21-loki-backend.png`**

### Truy vấn 2 — Lọc log có từ khoá lỗi

```logql
{service="backend"} |~ "(?i)error|unhandled|exception"
```

**Kết quả cần thấy:** chỉ các dòng chứa "error"/"unhandled"/"exception".
**Nếu không có dòng nào:** hệ thống không có lỗi — đây là tin tốt. Hãy tạo một lỗi
an toàn để chứng minh truy vấn hoạt động:

```bash
# Gửi JSON hỏng để backend ghi log lỗi parse
curl -k -s -o /dev/null -X POST -H "Content-Type: application/json" \
  -d '{"broken": ' https://localhost:8443/api/v1/auth/login
```

Rồi bấm **Run query** lại.

- 📸 **`22-loki-error-filter.png`**

### Truy vấn 3 — Log của PostgreSQL

```logql
{service="postgres"}
```

**Kết quả cần thấy:** log khởi động PostgreSQL, thông báo `database system is ready to accept connections`.

- 📸 **`23-loki-postgres.png`**

### Truy vấn 4 — Log của Nginx (nếu cần thêm)

```logql
{service="nginx"}
```

### Truy vấn 5 — Đếm log lỗi theo service

```logql
sum by (service) (count_over_time({job="restaurant"} |~ "(?i)error" [1h]))
```

- Đổi sang tab **Table** để xem dạng bảng.

**Chứng minh Promtail đang gửi log:**

```bash
# Liệt kê tất cả nhãn Loki đang có
docker compose exec loki wget -qO- http://localhost:3100/loki/api/v1/labels

# Liệt kê các giá trị của nhãn 'service'
docker compose exec loki wget -qO- "http://localhost:3100/loki/api/v1/label/service/values"
```

Kỳ vọng: thấy `["backend","cadvisor","grafana","loki","nginx","pgadmin","postgres",...]`

**Xử lý nếu thất bại:**

| Triệu chứng | Cách sửa |
|---|---|
| Explore không có datasource Loki | `docker compose restart grafana`; kiểm tra `docker/grafana/provisioning/datasources/loki.yml` |
| Truy vấn không trả dòng nào | Đợi ~30 giây. Kiểm tra Promtail: `docker compose logs promtail`. Phát sinh log bằng một request bất kỳ |
| Loki báo `Ingester not ready` | `docker compose restart loki` |
| Sai tên nhãn | Chạy lệnh liệt kê label ở trên để xem nhãn **thật** |

---

## Bước 10 — Chứng minh các biện pháp hardening

Xem chi tiết đầy đủ tại **[HARDENING.md](HARDENING.md)**. Dưới đây là các lệnh demo nhanh.

### 10.1 Container chạy non-root

```bash
docker compose exec backend id
```

**Kết quả cần thấy:** `uid=1001(nodeuser) gid=1001(nodejs)`
📸 **`24-nonroot.png`**

### 10.2 Ứng dụng không dùng superuser PostgreSQL

```bash
docker compose exec postgres psql -U postgres -d restaurant_db -c \
  "SELECT rolname, rolsuper FROM pg_roles WHERE rolname='appuser';"
```

**Kết quả cần thấy:** `rolsuper` = `f`
📸 **`25-least-privilege.png`**

### 10.3 Cổng quản trị chỉ bind loopback

```bash
docker compose config | grep -A1 "published" | grep -E "host_ip|published"
```

**Kết quả cần thấy:** `host_ip: 127.0.0.1` cho pgAdmin, Prometheus, Grafana, cAdvisor, PostgreSQL.

Kiểm tra bằng PowerShell:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 5051,9091,3002,8082,5434 } |
  Select-Object LocalAddress, LocalPort | Format-Table -AutoSize
```

**Kết quả cần thấy:** `LocalAddress` = `127.0.0.1`, **không** có `0.0.0.0`.
📸 **`26-loopback-bind.png`**

### 10.4 Security headers và HTTPS

Mở https://localhost:8443 → F12 → tab **Network** → bấm vào request đầu tiên
→ mục **Response Headers**. Kéo xuống tìm:

- `content-security-policy: default-src 'self'; script-src 'self'; ...`
- `strict-transport-security: max-age=86400`
- `x-content-type-options: nosniff`
- `x-frame-options: SAMEORIGIN`
- `referrer-policy: strict-origin-when-cross-origin`

📸 **`27-security-headers.png`**

Bấm vào ổ khoá cạnh địa chỉ → **Certificate is not valid** → xem chi tiết chứng chỉ tự ký.

📸 **`28-self-signed-cert.png`**

### 10.5 `stub_status` không bị lộ

```bash
curl -k -s -o /dev/null -w 'Qua cổng công khai: %{http_code}\n' https://localhost:8443/stub_status
docker compose exec nginx-exporter wget -qO- http://nginx:8081/stub_status
```

**Kết quả cần thấy:** lệnh đầu `404`; lệnh sau in ra
`Active connections: N` kèm các dòng thống kê.

### 10.6 Mật khẩu được băm

```bash
docker compose exec postgres psql -U postgres -d restaurant_db -c \
  "SELECT username, LEFT(password,7) AS prefix, LENGTH(password) AS len FROM users;"
```

**Kết quả cần thấy:** `prefix` = `$2b$12$`, `len` = `60`.
**Không** thấy mật khẩu dạng thô.

### 10.7 Không lộ secret trong `.gitignore`

```bash
git check-ignore -v .env docker/pgadmin/pgpass backups/ nginx/certs/server.key
```

**Kết quả cần thấy:** mỗi đường dẫn in ra một dòng kèm tên file `.gitignore`.

---

## Bước 11 — Chứng minh repository GitHub, README và 3 commit

### 11.1 Khởi tạo Git (nếu chưa có)

```bash
git init
git add .
git status --short | head -20
```

⚠️ **Kiểm tra kỹ `git status` trước khi commit** — phải **KHÔNG** thấy:
`.env`, `docker/pgadmin/pgpass`, `backups/`, `nginx/certs/`.

### 11.2 Tạo 3 commit có ý nghĩa

```bash
# Commit 1: Ứng dụng, database, Nginx reverse proxy, HTTPS, README
git add backend/ frontend/ database/ docker-compose.yml nginx/ .env.example .gitignore README.md
git commit -m "feat: ứng dụng quản lý nhà hàng, PostgreSQL và Nginx reverse proxy

- Backend Node.js/Express với 8 nhóm API nghiệp vụ
- Frontend React + Vite
- PostgreSQL 16 với migration, seed và tài khoản ứng dụng quyền tối thiểu
- Nginx reverse proxy với HTTPS tự ký và security headers
- README hướng dẫn cài đặt và sử dụng"

# Commit 2: Giám sát
git add prometheus/ docker/grafana/ docker-compose.yml
git commit -m "feat: giám sát với Prometheus, Grafana và các exporter

- Prometheus scrape backend, PostgreSQL, Nginx và cAdvisor
- Grafana provision datasource và dashboard tự động
- postgres-exporter, nginx-prometheus-exporter, cAdvisor"

# Commit 3: Logging, hardening, test và tài liệu
git add docker/loki/ promtail/ backend/ scripts/ docs/ README.md
git commit -m "feat: thu thập log tập trung với Loki, hardening và kiểm thử

- Loki + Promtail thu log container, datasource Loki trong Grafana
- Hardening: non-root, network isolation, loopback binding, CSP, HSTS
- Unit test, smoke test và E2E test
- Tài liệu hardening, test report, checklist demo và báo cáo"
```

Kiểm tra:

```bash
git log --oneline --graph
```

**Kết quả cần thấy:** 3 commit với thông điệp mô tả rõ nội dung.

### 11.3 Tạo repository và push

```bash
git remote add origin https://github.com/<TÀI_KHOẢN>/<MSSV>-order-new.git
git branch -M main
git push -u origin main
```

> Thay `<TÀI_KHOẢN>` và `<MSSV>` bằng thông tin thật của bạn.

**Kiểm tra:** mở repository trên trình duyệt → phải thấy README hiển thị,
số commit là 3, **không** có file `.env`.

📸 **`29-github-repo.png`**, 📸 **`30-git-log.png`**

### Xử lý nếu thất bại

| Triệu chứng | Cách sửa |
|---|---|
| `src refspec main does not match any` | Chưa commit: `git add . && git commit -m "..."` |
| `remote origin already exists` | `git remote set-url origin <URL_mới>` |
| Push bị từ chối | `git pull --rebase origin main` rồi push lại |
| ⚠️ **Lỡ commit `.env`** | **Thu hồi ngay:** đổi mọi mật khẩu trong `.env`, xóa file khỏi Git bằng `git rm --cached .env`, commit lại. Xóa khỏi lịch sử Git là **chưa đủ** |

---

## Bước 12 — Kiểm tra báo cáo và ảnh minh chứng

- [ ] **12.1** Báo cáo có **tối thiểu 10 trang** khi in ra PDF
- [ ] **12.2** Đã điền đủ thông tin sinh viên (không còn placeholder `<...>`)
- [ ] **12.3** Đã chèn ảnh vào đúng vị trí, mỗi ảnh có **chú thích** (caption)
- [ ] **12.4** Bảng kết quả test ghi **kết quả thật**, không có PASS cho bài chưa chạy
- [ ] **12.5** Các truy vấn PromQL/LogQL trong báo cáo **đã chạy thật** và trả về dữ liệu
- [ ] **12.6** Có sơ đồ kiến trúc
- [ ] **12.7** Có mô tả bảng dữ liệu và quan hệ
- [ ] **12.8** Phần "Hạn chế" ghi trung thực, khớp với `docs/HARDENING.md`

**Kiểm tra số trang:**

- Mở file báo cáo bằng Word/LibreOffice → **Insert → Page Number** → xem tổng số trang
- Hoặc xuất PDF rồi đếm

**Ảnh còn thiếu:** `ls -la docs/screenshots/` — đối chiếu với danh sách 26 ảnh trong README mục 18.

---

## Bước 13 — Dừng và dọn dẹp (sau khi demo xong)

```bash
# Dừng stack nhưng GIỮ NGUYÊN dữ liệu
docker compose down

# Dừng và xóa cả database test (an toàn, không phải dữ liệu thật)
docker compose --profile test down
```

> ⛔ **TUYỆT ĐỐI KHÔNG chạy `docker compose down -v`** — cờ `-v` xóa volume
> và **mất toàn bộ dữ liệu PostgreSQL** đã tạo.

Khởi động lại sau này chỉ cần:

```bash
docker compose up -d
```

Dữ liệu vẫn còn nguyên vì đã lưu trong volume `restaurant-postgres-data`.

---

## Bảng tóm tắt lệnh nhanh

```bash
# --- Kiểm tra sức khoẻ toàn hệ thống ---
docker compose ps
bash scripts/smoke-test.sh

# --- Chạy luồng nghiệp vụ đầy đủ ---
bash scripts/e2e-test.sh

# --- Chạy unit test ---
cd backend && npm run test:unit

# --- Chạy integration test (cần DB test) ---
docker compose --profile test up -d postgres-test
cd backend && npm test

# --- Kiểm tra cấu hình ---
docker compose config --quiet && echo "compose OK"

# --- Sao lưu dữ liệu ---
docker compose exec -T postgres pg_dump -U postgres -d restaurant_db -Fc \
  > "backups/restaurant_$(date +%Y%m%d_%H%M%S).dump"

# --- Xem log ---
docker compose logs -f backend
docker compose logs --tail=50 nginx
```
