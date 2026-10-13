# Hệ thống Quản lý Nhà hàng An Phúc (Order-New)

> **Đề tài 12** — Website quản lý món ăn, bàn ăn và đơn hàng cho nhà hàng.
> Triển khai toàn bộ bằng Docker Compose, có reverse proxy, giám sát, thu thập log tập trung và hardening bảo mật.

<!-- ============================================================
     NGƯỜI DÙNG TỰ ĐIỀN: thay các placeholder <...> bên dưới
     ============================================================ -->
| | |
|---|---|
| **Sinh viên** | `<HỌ TÊN>` |
| **Mã số sinh viên** | `<MSSV>` |
| **Lớp** | `<LỚP>` |
| **Giảng viên hướng dẫn** | `<GIẢNG VIÊN>` |
| **Trường / Khoa** | `<TRƯỜNG> / <KHOA>` |
| **Năm học** | `<NĂM>` |

> ⚠️ **Các giá trị `<...>` ở trên là placeholder do người soạn tài liệu để trống.**
> Vui lòng tự điền thông tin thật trước khi nộp. Không có thông tin nào được suy đoán.

---

## Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Chức năng](#2-chức-năng)
3. [Kiến trúc hệ thống](#3-kiến-trúc-hệ-thống)
4. [Công nghệ sử dụng](#4-công-nghệ-sử-dụng)
5. [Cấu trúc thư mục](#5-cấu-trúc-thư-mục)
6. [Yêu cầu môi trường](#6-yêu-cầu-môi-trường)
7. [Cài đặt và chạy](#7-cài-đặt-và-chạy)
8. [Địa chỉ truy cập](#8-địa-chỉ-truy-cập)
9. [Cơ sở dữ liệu và pgAdmin](#9-cơ-sở-dữ-liệu-và-pgadmin)
10. [API](#10-api)
11. [Giám sát: Prometheus và Grafana](#11-giám-sát-prometheus-và-grafana)
12. [Log tập trung: Loki, Promtail và LogQL](#12-log-tập-trung-loki-promtail-và-logql)
13. [Chạy kiểm thử](#13-chạy-kiểm-thử)
14. [Xử lý lỗi thường gặp](#14-xử-lý-lỗi-thường-gặp)
15. [Sao lưu và phục hồi dữ liệu](#15-sao-lưu-và-phục-hồi-dữ-liệu)
16. [Biện pháp bảo mật (hardening)](#16-biện-pháp-bảo-mật-hardening)
17. [Giới hạn hiện tại](#17-giới-hạn-hiện-tại)
18. [Danh sách ảnh minh chứng cần chụp](#18-danh-sách-ảnh-minh-chứng-cần-chụp)

---

## 1. Giới thiệu

Hệ thống quản lý nhà hàng An Phúc là ứng dụng web phục vụ nghiệp vụ hằng ngày của một nhà hàng:

- Quản lý **thực đơn** (danh mục, món ăn, giá, trạng thái còn/hết).
- Quản lý **bàn ăn** (trạng thái bàn, chuyển bàn, gộp bàn).
- Quản lý **đơn hàng** (mở đơn, thêm/bớt món, theo dõi trạng thái, bếp).
- **Thanh toán** và giải phóng bàn.
- **Báo cáo** doanh thu.

Toàn bộ hệ thống chạy trong Docker Compose, gồm 12 container: ứng dụng, cơ sở dữ liệu, công cụ quản trị, reverse proxy, giám sát và thu thập log.

---

## 2. Chức năng

### 2.1 Xác thực và phân quyền

- Đăng nhập bằng **username hoặc email**, mật khẩu băm bằng **bcrypt cost 12**.
- Phiên làm việc dùng **JWT** (mặc định hết hạn sau 8 giờ).
- Ba vai trò: `admin`, `staff`, `cashier`.
- Phân quyền theo vai trò ở tầng API (middleware `authorize`), không chỉ ẩn nút trên giao diện.

### 2.2 Quản lý món ăn

| Chức năng | Endpoint | Vai trò |
|---|---|---|
| Xem danh sách (tìm kiếm, lọc, phân trang) | `GET /api/v1/menu-items` | Đã đăng nhập |
| Xem chi tiết | `GET /api/v1/menu-items/:id` | Đã đăng nhập |
| Tạo món | `POST /api/v1/menu-items` | admin, staff |
| Sửa món | `PUT /api/v1/menu-items/:id` | admin, staff |
| Bật/tắt trạng thái còn bán | `PATCH /api/v1/menu-items/:id/toggle` | admin, staff |
| Xóa món | `DELETE /api/v1/menu-items/:id` | admin |

Quản lý danh mục tương tự tại `/api/v1/categories`.

### 2.3 Quản lý bàn ăn

- Trạng thái bàn: `available` (trống), `occupied` (có khách), `reserved` (đã đặt), `maintenance` (bảo trì).
- **Chuyển bàn**: `POST /api/v1/tables/:id/transfer` — dời đơn đang hoạt động sang bàn khác.
- **Gộp bàn**: `POST /api/v1/tables/:id/merge` — gộp món của hai bàn vào một đơn.

### 2.4 Quản lý đơn hàng

- Trạng thái đơn: `pending` → `confirmed` → `preparing` → `ready` → `served` → `completed`, và `cancelled`.
- Trạng thái từng món: `pending` → `preparing` → `ready` → `served`, hoặc `cancelled`.
- Màn hình bếp (Kitchen Display) hiển thị món cần chế biến.

### 2.5 Thanh toán

- Phương thức: `cash`, `card`, `transfer`, `other`.
- Mỗi đơn chỉ có **một** bản ghi thanh toán (ràng buộc `UNIQUE` trên `payments.order_id`).

---

## 3. Kiến trúc hệ thống

```
                            Internet / Người dùng
                                     │
                    ┌────────────────┴─────────────────┐
                    │                                  │
              HTTP  :8083                        HTTPS :8443
           (chuyển hướng 301)                  (chứng chỉ tự ký)
                    │                                  │
                    └────────────────┬─────────────────┘
                                     ▼
                        ┌────────────────────────┐
                        │   nginx (reverse proxy) │   ← điểm vào DUY NHẤT
                        │   Security headers      │
                        │   TLS, CSP, HSTS        │
                        └───┬────────────────┬────┘
                            │                │
                   /  (SPA) │                │ /api/  (JSON)
                            ▼                ▼
                  ┌──────────────┐   ┌──────────────────┐
                  │  frontend    │   │   backend        │
                  │  React+Vite  │   │   Node.js/Express│
                  │  nginx :8080 │   │   :3001          │
                  └──────────────┘   └────────┬─────────┘
                                              │ pg
                                              ▼
                                     ┌──────────────────┐
                                     │   postgres:16    │
                                     │   restaurant_db  │
                                     └────────┬─────────┘
                                              ▲
                                              │
                                     ┌────────┴─────────┐
                                     │    pgAdmin 4     │  (chỉ loopback :5051)
                                     └──────────────────┘

  ┌─────────────────────── MẶT PHẲNG GIÁM SÁT (mon-net) ───────────────────────┐
  │                                                                            │
  │   Prometheus :9090 (loopback :9091)                                        │
  │      ├── scrape backend:3001/metrics        (prom-client)                  │
  │      ├── scrape postgres-exporter:9187      (số liệu PostgreSQL)           │
  │      ├── scrape nginx-exporter:9113         (nginx stub_status :8081)      │
  │      └── scrape cadvisor:8080               (tài nguyên container)         │
  │                                                                            │
  │   Grafana :3000 (loopback :3002)                                           │
  │      ├── datasource Prometheus → http://prometheus:9090                    │
  │      └── datasource Loki       → http://loki:3100                          │
  │                                                                            │
  │   Loki :3100  ←── push ──  Promtail  (đọc /var/lib/docker/containers)      │
  │                                                                            │
  └────────────────────────────────────────────────────────────────────────────┘
```

### Hai mạng Docker

| Mạng | Thành viên | Mục đích |
|---|---|---|
| `restaurant-app-net` | nginx, frontend, backend, postgres, pgadmin, exporters | Lưu lượng nghiệp vụ |
| `restaurant-mon-net` | prometheus, grafana, loki, promtail, cadvisor, backend, nginx, exporters | Giám sát và log |

Prometheus/Grafana/Loki **không** nằm trong `app-net`. Backend và nginx nằm ở cả hai mạng vì vừa phục vụ nghiệp vụ vừa bị scrape metrics.

### Sơ đồ thực thể - quan hệ (ERD)

```
categories ──1:N──> menu_items
                         │
                         │ 1:N
                         ▼
dining_tables ──1:N──> orders ──1:N──> order_items
                         │
                         │ 1:1  (payments.order_id UNIQUE)
                         ▼
                      payments
                         
users ──1:N──> orders         (users.id = orders.user_id, ON DELETE SET NULL)
```

---

## 4. Công nghệ sử dụng

| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Backend | Node.js + Express | Node 20, Express 4.19 |
| Truy cập DB | `pg` (node-postgres) | 8.12 |
| Xác thực | jsonwebtoken + bcrypt | 9.0 / 5.1 |
| Bảo mật HTTP | helmet, express-rate-limit, cors | 7.1 / 7.3 / 2.8 |
| Log | winston + winston-loki | 3.13 / 6.1 |
| Metrics | prom-client | 15.1 |
| Frontend | React + Vite + Tailwind CSS | 18.3 / 5.3 / 3.4 |
| Biểu đồ | Recharts | 2.12 |
| Database | PostgreSQL | 16 |
| Quản trị DB | pgAdmin 4 | 8.5 |
| Reverse proxy | Nginx | alpine |
| Giám sát | Prometheus / Grafana | 2.51.2 / 10.4.0 |
| Log tập trung | Loki / Promtail | 3.0.0 / 3.0.0 |
| Exporter | postgres-exporter / nginx-prometheus-exporter / cAdvisor | 0.15.0 / 1.1.0 / 0.45.0 |

---

## 5. Cấu trúc thư mục

```
restaurant-order-management/
├── backend/                      # API Node.js/Express
│   ├── src/
│   │   ├── app.js                # Cấu hình Express, middleware, routes
│   │   ├── server.js             # Điểm khởi động
│   │   ├── config/database.js    # Pool kết nối PostgreSQL
│   │   ├── controllers/          # 8 controller nghiệp vụ
│   │   ├── middlewares/          # Xác thực JWT + phân quyền
│   │   ├── routes/               # Khai báo endpoint
│   │   └── utils/                # logger, metrics, helper truy vấn
│   ├── tests/                    # Jest + supertest
│   └── Dockerfile
├── frontend/                     # SPA React
│   ├── src/
│   │   ├── pages/                # 12 trang
│   │   ├── components/
│   │   ├── contexts/AuthContext.jsx
│   │   ├── layouts/
│   │   └── services/             # Tầng gọi API
│   ├── nginx.conf                # Phục vụ file tĩnh
│   └── Dockerfile
├── database/
│   ├── init.sh                   # Tạo app user + chạy migration + seed
│   ├── migrations/001_init_schema.sql
│   └── seeds/001_seed_data.sql
├── nginx/
│   ├── templates/default.conf.template   # Reverse proxy (envsubst)
│   ├── snippets/security-headers.conf    # Security headers + CSP
│   ├── scripts/certgen.sh                # Sinh chứng chỉ tự ký
│   └── certs/                            # (gitignore) chứng chỉ sinh tự động
├── prometheus/prometheus.yml
├── promtail/promtail.yml
├── docker/
│   ├── grafana/provisioning/
│   │   ├── datasources/          # Prometheus + Loki
│   │   └── dashboards/           # Provider + JSON dashboard
│   ├── loki/loki-config.yml
│   └── pgadmin/                  # servers.json + pgpass
├── docs/                         # Tài liệu, ảnh minh chứng
├── docker-compose.yml
├── .env / .env.example
└── README.md
```

---

## 6. Yêu cầu môi trường

| Yêu cầu | Tối thiểu | Đã kiểm chứng trên |
|---|---|---|
| Docker Desktop | 4.x | 26.1.4 |
| Docker Compose | v2 | v2.27.1-desktop.1 |
| RAM | 4 GB (khuyến nghị 8 GB) | — |
| Dung lượng trống | **≥ 5 GB** | ⚠️ Xem mục 14 |
| Hệ điều hành | Windows 10/11 + WSL2, macOS, Linux | Windows 11 Pro 26200 |

> **Quan trọng:** Docker Desktop phải đang **chạy** trước khi thực hiện bước 7.
> Kiểm tra bằng: `docker info`

---

## 7. Cài đặt và chạy

### Bước 1 — Tạo file `.env`

`.env` **không** được commit lên Git (đã có trong `.gitignore`). Tạo từ file mẫu:

**PowerShell:**
```powershell
Copy-Item .env.example .env
```

**Bash / Git Bash:**
```bash
cp .env.example .env
```

Mở `.env` và thay các giá trị `thay_bang_mat_khau_manh_cua_ban` bằng mật khẩu mạnh.

Sinh mật khẩu ngẫu nhiên bằng PowerShell:
```powershell
-join ((1..32) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })
```

Các biến bắt buộc phải có giá trị (không được để trống):

| Biến | Ý nghĩa |
|---|---|
| `POSTGRES_PASSWORD` | Mật khẩu superuser PostgreSQL |
| `APP_DB_PASSWORD` | Mật khẩu tài khoản ứng dụng (quyền hạn chế) |
| `PGADMIN_DEFAULT_PASSWORD` | Mật khẩu đăng nhập pgAdmin |
| `JWT_SECRET` | Khoá ký JWT |
| `GRAFANA_ADMIN_PASSWORD` | Mật khẩu admin Grafana |

### Bước 2 — Build và khởi động

```bash
docker compose up -d --build
```

Lần đầu mất khoảng 3–10 phút (tải image và build frontend).

### Bước 3 — Kiểm tra trạng thái

```bash
docker compose ps
```

Tất cả container phải ở trạng thái `running` hoặc `healthy`:

```
NAME                       SERVICE            STATUS
restaurant-nginx           nginx              Up (healthy)
restaurant-backend         backend            Up (healthy)
restaurant-frontend        frontend           Up (healthy)
restaurant-postgres        postgres           Up (healthy)
restaurant-pgadmin         pgadmin            Up (healthy)
restaurant-prometheus      prometheus         Up (healthy)
restaurant-grafana         grafana            Up (healthy)
restaurant-loki            loki               Up (healthy)
restaurant-promtail        promtail           Up (healthy)
restaurant-postgres-exporter  postgres-exporter  Up (healthy)
restaurant-nginx-exporter     nginx-exporter     Up (healthy)
restaurant-cadvisor        cadvisor           Up (healthy)
```

### Bước 4 — Kiểm tra nhanh toàn hệ thống

```bash
bash scripts/smoke-test.sh
```

Script này kiểm tra lần lượt: Nginx phản hồi, HTTPS hoạt động, security headers có mặt, backend health, đăng nhập API, Prometheus target UP, Loki sẵn sàng.

### Dừng hệ thống

```bash
docker compose down          # Dừng, GIỮ NGUYÊN dữ liệu
```

> ⛔ **KHÔNG chạy `docker compose down -v`** — cờ `-v` xóa volume và **mất toàn bộ dữ liệu PostgreSQL**.

---

## 8. Địa chỉ truy cập

| Dịch vụ | URL | Phạm vi truy cập |
|---|---|---|
| **Ứng dụng (HTTPS)** | https://localhost:8443 | Công khai |
| Ứng dụng (HTTP → chuyển hướng) | http://localhost:8083 | Công khai |
| pgAdmin 4 | http://127.0.0.1:5051 | Chỉ máy cục bộ |
| Prometheus | http://127.0.0.1:9091 | Chỉ máy cục bộ |
| Grafana | http://127.0.0.1:3002 | Chỉ máy cục bộ |
| cAdvisor (debug) | http://127.0.0.1:8082 | Chỉ máy cục bộ |
| PostgreSQL | `127.0.0.1:5434` | Chỉ máy cục bộ |

> **Chứng chỉ tự ký:** Truy cập `https://localhost:8443` lần đầu, trình duyệt sẽ cảnh báo
> *"Your connection is not private"* / *NET::ERR_CERT_AUTHORITY_INVALID*.
> Đây là hành vi **đúng** với chứng chỉ tự ký. Chọn **Advanced → Proceed to localhost**.
> Chứng chỉ tự ký **không tương đương** chứng chỉ do CA tin cậy cấp và không dùng cho production.

### Tài khoản đăng nhập ứng dụng

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `Admin@123` | Quản trị viên |

> ⚠️ Tài khoản này được **seed sẵn** cho mục đích demo, mật khẩu nằm công khai trong
> `database/seeds/001_seed_data.sql`. **Phải đổi mật khẩu** trước khi dùng thật —
> đăng nhập → menu người dùng → *Đổi mật khẩu*.

Tài khoản pgAdmin và Grafana dùng giá trị trong `.env` (`PGADMIN_DEFAULT_EMAIL`,
`PGADMIN_DEFAULT_PASSWORD`, `GRAFANA_ADMIN_USER`, `GRAFANA_ADMIN_PASSWORD`).

---

## 9. Cơ sở dữ liệu và pgAdmin

### 9.1 Mô hình dữ liệu

| Bảng | Mô tả | Khoá ngoại |
|---|---|---|
| `users` | Tài khoản người dùng | — |
| `categories` | Danh mục món ăn | — |
| `menu_items` | Món ăn | `category_id → categories(id)` |
| `dining_tables` | Bàn ăn | — |
| `orders` | Đơn hàng | `table_id → dining_tables(id)`, `user_id → users(id)` |
| `order_items` | Chi tiết đơn hàng | `order_id → orders(id)`, `menu_item_id → menu_items(id)` |
| `payments` | Thanh toán | `order_id → orders(id)` **UNIQUE** |

**Ràng buộc toàn vẹn quan trọng:**

- `menu_items.price` — `NUMERIC(12,2)`, `CHECK (price >= 0)`
- `order_items.quantity` — `CHECK (quantity > 0)`
- `order_items.subtotal` — `GENERATED ALWAYS AS (quantity * unit_price) STORED`
  → thành tiền do **database** tính, không thể sai lệch do làm trò hoặc lỗi ứng dụng
- `payments.order_id` — `UNIQUE` → chặn thanh toán hai lần ở tầng dữ liệu
- `orders.status`, `dining_tables.status`, `order_items.status` — `CHECK` theo danh sách giá trị hợp lệ
- `menu_items.category_id` — `ON DELETE RESTRICT` → không xóa được danh mục còn món
- Trigger `update_updated_at_column` tự cập nhật `updated_at` trên cả 7 bảng

### 9.2 Kết nối pgAdmin

1. Mở http://127.0.0.1:5051
2. Đăng nhập bằng `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` trong `.env`
3. Server **RestaurantDB** đã được cấu hình sẵn (qua `docker/pgadmin/servers.json`):
   - Host: `postgres` (tên service Docker, **không phải** `localhost`)
   - Port: `5432`
   - Database: `restaurant_db`
   - Username: `appuser`
4. Mật khẩu kết nối được đọc tự động từ file `/pgpass` (đã mount)

Xem dữ liệu bằng chuột phải → **Query Tool**, ví dụ:

```sql
SELECT o.order_code, dt.table_number, o.status, o.total_amount, o.created_at
FROM orders o
JOIN dining_tables dt ON o.table_id = dt.id
ORDER BY o.created_at DESC
LIMIT 20;
```

### 9.3 Kiểm tra PostgreSQL từ dòng lệnh

```bash
docker compose exec postgres psql -U postgres -d restaurant_db -c "\dt"
```

Kiểm tra ràng buộc và chỉ mục:

```bash
docker compose exec postgres psql -U postgres -d restaurant_db -c "\d+ payments"
docker compose exec postgres psql -U postgres -d restaurant_db -c "\d+ order_items"
```

### 9.4 Tài khoản ứng dụng có quyền tối thiểu

Ứng dụng **không** kết nối bằng tài khoản `postgres` (superuser). `database/init.sh`
tạo role `appuser` chỉ với `CONNECT`, `USAGE`, `SELECT/INSERT/UPDATE/DELETE`, và
`USAGE/SELECT` trên sequence. `appuser` **không** có quyền `CREATE`, `DROP`, `ALTER`
hay `SUPERUSER`.

Kiểm chứng:

```bash
docker compose exec postgres psql -U postgres -d restaurant_db \
  -c "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname='appuser';"
```

Kết quả mong đợi: `rolsuper = f`, `rolcreatedb = f`, `rolcreaterole = f`.

---

## 10. API

Base URL: `/api/v1`. Mọi endpoint (trừ đăng nhập) yêu cầu header:
`Authorization: Bearer <token>`

### Xác thực

| Method | Endpoint | Mục đích | Vai trò |
|---|---|---|---|
| POST | `/auth/login` | Đăng nhập, nhận JWT | Công khai |
| GET | `/auth/me` | Thông tin người dùng hiện tại | Đã đăng nhập |
| POST | `/auth/change-password` | Đổi mật khẩu | Đã đăng nhập |

### Bàn ăn

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/tables` | Danh sách bàn (lọc `?status=&area=`) |
| GET | `/tables/:id` | Chi tiết bàn |
| GET | `/tables/:id/current-order` | Đơn đang hoạt động của bàn |
| POST | `/tables` | Tạo bàn (admin) |
| PUT | `/tables/:id` | Sửa bàn (admin) |
| PATCH | `/tables/:id/status` | Đổi trạng thái bàn |
| POST | `/tables/:id/transfer` | Chuyển bàn |
| POST | `/tables/:id/merge` | Gộp bàn |
| DELETE | `/tables/:id` | Xóa bàn (admin) |

### Đơn hàng

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/orders` | Danh sách đơn (`?status=&table_id=&date=&page=&limit=`) |
| GET | `/orders/kitchen` | Món cần chế biến |
| GET | `/orders/:id` | Chi tiết đơn kèm danh sách món |
| POST | `/orders` | Tạo đơn |
| POST | `/orders/:id/items` | Thêm món vào đơn |
| PATCH | `/orders/:id/status` | Đổi trạng thái đơn |
| PATCH | `/orders/items/:id/status` | Đổi trạng thái một món |
| DELETE | `/orders/:id/items/:itemId` | Bỏ món khỏi đơn |
| DELETE | `/orders/:id` | Xóa đơn (admin, chỉ khi `pending`/`cancelled`) |

### Thanh toán, món ăn, bàn, người dùng, báo cáo

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/payments` | Lịch sử thanh toán (`?from=&to=`) |
| POST | `/payments` | Thanh toán đơn |
| GET/POST/PUT/DELETE | `/menu-items`, `/categories` | Quản lý thực đơn |
| GET/POST/PUT/DELETE | `/users` | Quản lý người dùng (chỉ admin) |
| GET | `/dashboard/stats` | Thống kê tổng quan |
| GET | `/dashboard/revenue-chart` | Doanh thu theo ngày (`?days=`) |
| GET | `/dashboard/recent-orders` | Đơn gần đây (`?limit=`) |

### Quy tắc nghiệp vụ được cưỡng chế ở backend

Các quy tắc sau được kiểm tra **trong transaction PostgreSQL**, không phụ thuộc giao diện:

1. **Giá luôn lấy từ database.** Client gửi `unit_price` bao nhiêu cũng bị bỏ qua.
2. **Không tạo hai đơn hoạt động trên cùng một bàn** — dùng `SELECT ... FOR UPDATE` trên hàng `dining_tables`.
3. **Không thanh toán hai lần** — khoá `orders` bằng `FOR UPDATE` + ràng buộc `UNIQUE` trên `payments.order_id`.
4. **Không bỏ món cuối cùng** của đơn (phải hủy đơn thay vì xóa món).
5. **Không sửa đơn đã `completed` hoặc `cancelled`.**
6. **Không đổi bàn về `available`/`maintenance` khi còn đơn hoạt động.**

---

## 11. Giám sát: Prometheus và Grafana

### 11.1 Prometheus

Mở http://127.0.0.1:9091 → menu **Status → Targets**.

Năm target cần ở trạng thái **UP**:

| Job | Target | Nguồn số liệu |
|---|---|---|
| `prometheus` | `localhost:9090` | Chính Prometheus |
| `backend` | `backend:3001` | Ứng dụng (prom-client) |
| `postgres-exporter` | `postgres-exporter:9187` | PostgreSQL |
| `nginx-exporter` | `nginx-exporter:9113` | Nginx reverse proxy |
| `cadvisor` | `cadvisor:8080` | Tài nguyên container |

Chu kỳ scrape: **15 giây**. Lưu trữ: **30 ngày**.

### 11.2 Grafana

Mở http://127.0.0.1:3002, đăng nhập bằng tài khoản trong `.env`.

Datasource và dashboard được **provision tự động** từ `docker/grafana/provisioning/`,
nên không cần tạo bằng tay. Dashboard nằm trong thư mục **Restaurant**.

### 11.3 Truy vấn PromQL

Các truy vấn dưới đây dùng tên metric **thực tế** của hệ thống:

```promql
# 1. Tốc độ request API (theo giây, trong 5 phút)
sum by (status_code) (rate(restaurant_http_requests_total[5m]))

# 2. Thời gian phản hồi API phân vị 95
histogram_quantile(0.95, sum by (le) (rate(restaurant_http_request_duration_seconds_bucket[5m])))

# 3. Số kết nối đang hoạt động tới backend
restaurant_active_connections

# 4. Tổng số đơn đã tạo (counter)
restaurant_orders_created_total

# 5. Tổng doanh thu tích luỹ
restaurant_revenue_total

# 6. Số kết nối tới PostgreSQL theo database
pg_stat_database_numbackends{datname="restaurant_db"}

# 7. CPU từng container (theo giây/giây)
sum by (name) (rate(container_cpu_usage_seconds_total{name=~"restaurant-.*"}[5m]))

# 8. Bộ nhớ từng container (byte)
sum by (name) (container_memory_usage_bytes{name=~"restaurant-.*"})

# 9. Số request Nginx đã phục vụ
nginx_http_requests_total

# 10. Kiểm tra exporter PostgreSQL còn sống
pg_up
```

> **Lưu ý phân biệt:**
> - `restaurant_*` là metric **do ứng dụng tự phát** (prom-client trong backend).
> - `pg_*` là metric do **postgres-exporter** đọc từ PostgreSQL — **không** phải ứng dụng phát ra.
> - `container_*` là metric của **cAdvisor**, đọc từ cgroup của Docker.
> - `nginx_*` là metric của **nginx-prometheus-exporter**, đọc từ `stub_status`.
>
> Không được nhầm lẫn các nhóm này khi viết báo cáo.

---

## 12. Log tập trung: Loki, Promtail và LogQL

### 12.1 Kiến trúc thu thập log

```
Các container restaurant-*
        │  ghi log ra stdout/stderr
        ▼
/var/lib/docker/containers/*/*-json.log
        │  Promtail đọc qua Docker service discovery
        │  Lọc: chỉ container có tên bắt đầu "restaurant-"
        │  Gán nhãn: service=<tên bỏ tiền tố>, job=restaurant
        ▼
Loki :3100  (lưu trên filesystem, volume restaurant-loki-data)
        │
        ▼
Grafana → Explore → datasource Loki
```

### 12.2 Phân biệt ba loại log

| Loại | Nguồn | Xem bằng |
|---|---|---|
| **Log container** | stdout/stderr của container, do Docker lưu | `docker compose logs <service>` |
| **Log ứng dụng** | Backend ghi qua winston (JSON), đẩy vào stdout **và** gửi trực tiếp tới Loki qua `winston-loki` | `docker compose logs backend`, Grafana → Loki |
| **Log hệ thống** | Syslog/kernel của máy host và của máy ảo WSL2 | Không thu thập trong đề tài này |

Promtail thu **log container**. Backend có thêm đường thứ hai là `winston-loki` gửi thẳng
sang Loki với nhãn `job="backend", app="restaurant-api"`.

### 12.3 Truy vấn LogQL

Mở Grafana → **Explore** → chọn datasource **Loki**.

```logql
# 1. Toàn bộ log của backend
{service="backend"}

# 2. Log của PostgreSQL
{service="postgres"}

# 3. Log của Nginx
{service="nginx"}

# 4. Lọc log có từ khoá lỗi (không phân biệt hoa thường)
{service="backend"} |~ "(?i)error|unhandled|exception"

# 5. Chỉ lấy cảnh báo và lỗi
{service="backend"} | json | level=~"warn|error"

# 6. Log đăng nhập thất bại (theo dõi bảo mật)
{service="backend"} |~ "Login attempt with wrong password"

# 7. Đếm số dòng log lỗi theo từng service trong 1 giờ
sum by (service) (count_over_time({job="restaurant"} |~ "(?i)error" [1h]))

# 8. Log tạo đơn hàng thành công
{service="backend"} |~ "Order created"

# 9. Tốc độ ghi log của từng service
sum by (service) (rate({job="restaurant"}[5m]))
```

> Nhãn `service` được Promtail sinh từ tên container: `restaurant-postgres` → `postgres`.
> Kiểm tra nhãn thực tế có sẵn bằng truy vấn: `{job="restaurant"}` rồi xem danh sách label.

### 12.4 Không ghi thông tin nhạy cảm vào log

- Mật khẩu **không** bao giờ được ghi log: `auth.controller.js` chỉ ghi `username`, không ghi `password`.
- JWT **không** được ghi log: middleware chỉ ghi `err.message` khi token sai.
- `docker-compose.yml` truyền mật khẩu qua **biến môi trường**, không qua tham số dòng lệnh
  (tham số dòng lệnh hiện trong `docker inspect` và tiến trình).
- Promtail chỉ thu container `restaurant-*`, tránh thu log của dự án khác trên cùng máy.

---

## 13. Chạy kiểm thử

### 13.1 Chuẩn bị database test

Database test **tách hoàn toàn** khỏi database thật, nằm trong profile `test`:

```bash
docker compose --profile test up -d postgres-test
```

Kiểm tra:

```bash
docker compose ps postgres-test
```

### 13.2 Các loại kiểm thử

| Loại | Vị trí | Cần gì | Lệnh | Số test |
|---|---|---|---|---|
| **Unit test** | `backend/tests/unit/` | Không cần DB | `npm run test:unit` | 42 |
| **Integration test** | `backend/tests/*.test.js` | PostgreSQL test (cổng 5433) | `npm run test:integration` | 52 |
| **Concurrency test** | `backend/tests/concurrency.test.js` | PostgreSQL test | `npm test` | 7 |
| **Smoke test** | `scripts/smoke-test.sh` | Stack đang chạy | `bash scripts/smoke-test.sh` | 56 |
| **E2E test** | `scripts/e2e-test.sh` | Stack đang chạy | `bash scripts/e2e-test.sh` | 41 |

Tổng: **101 test Jest** + **56 smoke** + **41 E2E**.
Độ phủ mã nguồn backend: **69,12% dòng** (các module lõi `money.js`, `validation.js`,
`query.js` và toàn bộ khai báo route đạt **100%**).

**Concurrency test** kiểm tra các tình huống tranh chấp bằng cách gửi nhiều request
**đồng thời** (`Promise.all`) rồi đối chiếu kết quả ở tầng PostgreSQL:

- 5 request mở đơn cùng lúc cho một bàn → **đúng 1** thành công, 4 bị chặn `409`
- 4 request thanh toán cùng lúc cho một đơn → **đúng 1** bản ghi `payments` được tạo
- 8 request thêm món cùng lúc vào một đơn → không mất dòng nào, tổng tiền cộng đúng
- Mở đơn và đổi bàn về trống chạy song song → không bao giờ có bàn `available` mà vẫn còn đơn hoạt động
- Kiểm tra trực tiếp ràng buộc database: `UNIQUE` (23505), `CHECK` (23514), khoá ngoại (23503)

**Phân biệt rõ:**
- **Unit test** kiểm tra hàm thuần (tính tiền, validation), **không** chạm database.
- **Integration test** gọi HTTP API thật và ghi/đọc PostgreSQL thật.
- **E2E test** đi từ Nginx → backend → PostgreSQL, kiểm tra cả security headers và metrics.

### 13.3 Chạy test backend

```bash
cd backend
npm ci
npm test
```

Test dùng biến môi trường trong `tests/setup-env.js`:
`localhost:5433`, database `restaurant_db`, user `appuser`.

---

## 14. Xử lý lỗi thường gặp

### `docker compose up` báo `input/output error` khi build

**Nguyên nhân:** ổ đĩa đầy. BuildKit không ghi được file tạm.

**Kiểm tra:**
```bash
df -h /c
docker system df
```

**Khắc phục:** giải phóng dung lượng (Windows → Settings → System → Storage → Temporary files),
cần tối thiểu **2 GB** trống. Sau đó chạy lại.

### Build treo rất lâu hoặc `docker compose ps` không phản hồi

**Triệu chứng:** `docker compose up` chạy mãi không xong; các lệnh `docker` khác bị treo.

**Nguyên nhân:** builder BuildKit của Docker Desktop bị hỏng. Thường xảy ra **sau khi ổ đĩa
từng bị đầy** — BuildKit ghi dở vào content store rồi bị lỗi I/O, để lại trạng thái hỏng.

**Kiểm tra:**
```bash
docker buildx ls
```
Nếu cột **STATUS** hiện `error` (thay vì `running`) thì đúng nguyên nhân này.

**Khắc phục — chọn một trong hai:**

*Cách 1 (khuyến nghị) — khởi động lại Docker Desktop:*
```powershell
Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process 'com.docker.backend' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 6
wsl --shutdown
Start-Sleep -Seconds 8
Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
```
Chờ 1–2 phút rồi kiểm tra lại `docker buildx ls`.

*Cách 2 — dùng builder cũ, không cần BuildKit:*
```bash
DOCKER_BUILDKIT=0 docker compose up -d --build
```
Builder cũ (legacy) không dùng content store của BuildKit nên tránh được lỗi này.
Đánh đổi: build chậm hơn và không có cache thông minh giữa các lần build.

> **Ghi chú:** trong quá trình phát triển đồ án, lỗi này đã gặp thật và đã khắc phục
> bằng cách kết hợp `wsl --shutdown` + khởi động lại Docker Desktop. Các lần build sau đó
> chạy bình thường với `docker compose up -d --build`.

### Container `unhealthy` dù dịch vụ vẫn chạy bình thường

**Nguyên nhân thường gặp:** healthcheck gọi `http://localhost:<port>` nhưng dịch vụ chỉ
lắng nghe trên IPv4. Trong container, `localhost` phân giải thành `::1` (IPv6) **trước**,
nên kết nối bị `Connection refused` dù dịch vụ hoàn toàn khoẻ mạnh.

**Kiểm tra:**
```bash
docker compose exec <service> getent hosts localhost   # → ::1 localhost
docker compose exec <service> netstat -ltn             # → chỉ thấy 0.0.0.0, không có :::
```

**Khắc phục:** hoặc cho dịch vụ lắng nghe cả IPv6 (`listen [::]:<port>;` với Nginx),
hoặc đổi healthcheck sang dùng `127.0.0.1` thay vì `localhost`. Trong dự án này đã làm **cả hai**.

### Dịch vụ báo `wget: not found` trong healthcheck

Một số image rất tối giản, không có `wget`/`curl`/`nc`. Ví dụ `grafana/promtail` (nền Debian)
chỉ có binary `promtail` và `bash`. Kiểm tra:

```bash
docker compose exec promtail sh -c "command -v wget curl nc busybox bash"
```

Nếu có `bash`, dùng `/dev/tcp` để kiểm tra cổng thay cho `wget`:

```yaml
test:
  - CMD-SHELL
  - >-
    bash -c 'exec 3<>/dev/tcp/127.0.0.1/9080;
    printf "GET /ready HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n" >&3;
    head -1 <&3 | grep -q 200' || exit 1
```

### `Cannot connect to the Docker daemon`

Docker Desktop chưa chạy. Mở Docker Desktop, chờ biểu tượng chuyển sang màu xanh, rồi kiểm tra:
```bash
docker info
```

### Container `backend` khởi động rồi thoát ngay

Xem log:
```bash
docker compose logs backend
```
Nguyên nhân thường gặp: `JWT_SECRET` hoặc `APP_DB_PASSWORD` chưa được đặt trong `.env`.
Backend cố tình **thoát** nếu không kết nối được database (xem `src/server.js`).

### Truy cập HTTPS bị cảnh báo chứng chỉ

Đúng như thiết kế — chứng chỉ tự ký. Chọn **Advanced → Proceed to localhost**.
Kiểm tra chứng chỉ đã sinh:
```bash
docker compose logs certgen
```

### `restaurant-postgres` không healthy

```bash
docker compose logs postgres
```
Nếu volume đã có dữ liệu từ trước, `database/init.sh` **không chạy lại**
(PostgreSQL chỉ chạy script khởi tạo khi thư mục dữ liệu còn trống).

### Xem log của một dịch vụ

```bash
docker compose logs -f backend        # theo dõi liên tục
docker compose logs --tail=100 nginx
docker compose logs --since=10m loki
```

### Trang web hiện nhưng gọi API lỗi 502

```bash
docker compose ps backend
docker compose logs --tail=50 nginx
```
Kiểm tra health của backend:
```bash
curl -k https://localhost:8443/health
```

---

## 15. Sao lưu và phục hồi dữ liệu

### 15.1 Sao lưu

```bash
docker compose exec -T postgres pg_dump -U postgres -d restaurant_db -Fc > "backups/restaurant_$(date +%Y%m%d_%H%M%S).dump"
```

Định dạng `-Fc` (custom) cho phép phục hồi chọn lọc và nén tốt hơn.

> Thư mục `backups/` đã được thêm vào `.gitignore` — **không** commit file dump
> lên Git vì chúng chứa dữ liệu thật và hash mật khẩu.

### 15.2 Phục hồi

```bash
# Dừng ứng dụng để không có ghi mới trong lúc phục hồi
docker compose stop backend

# Phục hồi (--clean xóa object cũ trước khi tạo lại)
docker compose exec -T postgres pg_restore -U postgres -d restaurant_db --clean --if-exists < backups/restaurant_YYYYMMDD_HHMMSS.dump

docker compose start backend
```

### 15.3 Kiểm tra bản sao lưu có dùng được không

```bash
# Liệt kê nội dung dump mà không phục hồi
docker compose exec -T postgres pg_restore -l < backups/restaurant_YYYYMMDD_HHMMSS.dump | head -30
```

### 15.4 Kiểm tra dữ liệu lưu bền qua restart

```bash
# Ghi nhận số đơn hiện có
docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc "SELECT COUNT(*) FROM orders;"

# Restart container database
docker compose restart postgres

# Đếm lại — con số phải giống hệt
docker compose exec -T postgres psql -U postgres -d restaurant_db -tAc "SELECT COUNT(*) FROM orders;"
```

---

## 16. Biện pháp bảo mật (hardening)

Tóm tắt; chi tiết đầy đủ (rủi ro → thay đổi → cách kiểm tra → kết quả → giới hạn còn lại)
xem tại **[docs/HARDENING.md](docs/HARDENING.md)**.

| # | Biện pháp | Trạng thái |
|---|---|---|
| 1 | Container ứng dụng chạy bằng user **non-root** (`nodeuser` uid 1001) | ✅ |
| 2 | **Network isolation** — 2 mạng tách vai trò, DB test ở mạng riêng | ✅ |
| 3 | **Không dùng superuser** cho ứng dụng (`appuser` quyền tối thiểu) | ✅ |
| 4 | **Security headers** tại Nginx: CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy | ✅ |
| 5 | **TLS/HTTPS** với chứng chỉ tự ký (demo) | ✅ |
| 6 | Cổng quản trị chỉ bind **loopback** (pgAdmin, Grafana, Prometheus, cAdvisor) | ✅ |
| 7 | **stub_status** chuyển sang cổng nội bộ không publish | ✅ |
| 8 | `.gitignore` chặn `.env`, `pgpass`, `servers.json`, chứng chỉ TLS, dump DB | ✅ |
| 9 | **Rate limiting**: 500 request/15 phút toàn cục, 20/15 phút cho đăng nhập | ✅ |
| 10 | **Pin phiên bản image** (bỏ tag `latest`) | ✅ (trừ `nginx:alpine`, `postgres:16-alpine`, `nginx:alpine` — xem tài liệu) |
| 11 | Mật khẩu mạnh sinh ngẫu nhiên, truyền qua **biến môi trường** | ✅ |
| 12 | Mật khẩu băm **bcrypt cost 12** | ✅ |

### Rủi ro còn tồn tại (ghi nhận trung thực)

| Rủi ro | Mức độ | Ghi chú |
|---|---|---|
| `cadvisor` cần `privileged: true` | Cao | Yêu cầu kỹ thuật của cAdvisor để đọc cgroup host. Đã giảm thiểu: chỉ ở `mon-net`, cổng loopback, mount read-only. Phương án thay thế: bỏ cAdvisor, dùng node-exporter — sẽ mất metric per-container. |
| Image `zcube/cadvisor` là mirror không chính thức | Trung bình | `gcr.io` không truy cập được trong môi trường thực hiện. Đã pin phiên bản `v0.45.0` thay vì `latest`. |
| Chứng chỉ TLS tự ký | Trung bình | Chỉ dùng cho demo. Production phải dùng Let's Encrypt hoặc CA nội bộ. |
| `promtail` mount `/var/run/docker.sock` | Trung bình | Cần thiết để Docker service discovery. Đã để **read-only** và không có quyền ghi. |
| Mật khẩu seed `Admin@123` công khai trong repo | Cao | Bắt buộc đổi trước khi dùng thật. |
| Không có `mem_limit`/`cpus` cho container | Thấp | Container có thể chiếm hết tài nguyên host. |
| `pgpass` chứa mật khẩu dạng plaintext trên đĩa | Trung bình | Đã gitignore. Production nên dùng Docker secrets. |

---

## 17. Giới hạn hiện tại

Các điểm **chưa** được triển khai, ghi rõ để không hiểu nhầm là đã có:

1. **Trang Cài đặt (`SettingsPage`) chỉ là giao diện.** Nút "Lưu cấu hình nhà hàng" chỉ hiện
   thông báo, **không** lưu vào database. Thông tin nhà hàng (tên, địa chỉ, VAT) đang
   hardcode trong mã nguồn.
2. **Không có refresh token.** JWT hết hạn sau 8 giờ, người dùng phải đăng nhập lại.
3. **Không có phân trang ở trang Đơn hàng và Bàn ăn** khi dữ liệu lớn.
4. **Ảnh món ăn chưa có file thật.** Seed trỏ tới `/images/*.jpg`; thư mục ảnh chưa được
   cung cấp nên các ảnh này hiển thị lỗi (Nginx trả `404` đúng, không giả `200`).
   Bổ sung ảnh vào `frontend/public/images/` với đúng tên trong
   `database/seeds/001_seed_data.sql`.
5. **Log hệ thống của host không được thu thập** — chỉ có log container.
6. **Chưa có CI/CD** (GitHub Actions).
7. **Chưa có HTTPS cho các công cụ quản trị** (pgAdmin, Grafana, Prometheus chỉ chạy HTTP nội bộ).
8. **Không có refresh token** — JWT hết hạn sau 8 giờ.

> **Đã khắc phục trong quá trình hoàn thiện:** favicon `/logo.svg` trước đây không tồn tại
> và Nginx SPA fallback trả `HTTP 200` kèm `index.html` cho mọi file tĩnh thiếu, khiến
> trình duyệt không phân biệt được file thiếu với file có thật. Hiện `/logo.svg` đã có file,
> và Nginx trả `404` thật cho file tĩnh không tồn tại (xem `frontend/nginx.conf`).

---

## 18. Danh sách ảnh minh chứng cần chụp

Đặt ảnh vào `docs/screenshots/` và chèn vào báo cáo. Chưa có ảnh nào được tạo tự động.

| # | Tên file gợi ý | Nội dung cần chụp |
|---|---|---|
| 1 | `01-docker-ps.png` | Kết quả `docker compose ps` — tất cả container `Up (healthy)` |
| 2 | `02-docker-images.png` | Kết quả `docker images` — các image đã build |
| 3 | `03-login.png` | Trang đăng nhập qua HTTPS (kèm cảnh báo chứng chỉ nếu có) |
| 4 | `04-dashboard.png` | Trang tổng quan sau khi đăng nhập |
| 5 | `05-menu-list.png` | Danh sách món ăn |
| 6 | `06-menu-create.png` | Form tạo món ăn mới |
| 7 | `07-tables.png` | Sơ đồ bàn ăn |
| 8 | `08-new-order.png` | Màn hình mở đơn và chọn món |
| 9 | `09-order-detail.png` | Chi tiết đơn hàng có nhiều món |
| 10 | `10-payment.png` | Màn hình thanh toán |
| 11 | `11-kitchen.png` | Màn hình bếp |
| 12 | `12-reports.png` | Trang báo cáo doanh thu |
| 13 | `13-pgadmin-tables.png` | pgAdmin hiển thị danh sách bảng |
| 14 | `14-pgadmin-query.png` | Query Tool trả về dữ liệu đơn hàng thật |
| 15 | `15-prometheus-targets.png` | Prometheus → Targets, tất cả UP |
| 16 | `16-prometheus-graph.png` | Biểu đồ một PromQL query |
| 17 | `17-grafana-dashboard.png` | Dashboard trong Grafana có dữ liệu thật |
| 18 | `18-grafana-loki-query.png` | Grafana Explore, datasource Loki, kết quả log |
| 19 | `19-loki-error-filter.png` | Truy vấn LogQL lọc log lỗi |
| 20 | `20-https-headers.png` | DevTools → Network → Response Headers có CSP, HSTS |
| 21 | `21-tls-cert.png` | Chi tiết chứng chỉ TLS tự ký trên trình duyệt |
| 22 | `22-http-redirect.png` | `curl -I http://localhost:8083` trả về `301` |
| 23 | `23-github-repo.png` | Trang repository GitHub |
| 24 | `24-git-log.png` | `git log --oneline --graph` với 3 commit |
| 25 | `25-test-result.png` | Kết quả chạy `npm test` |
| 26 | `26-smoke-test.png` | Kết quả `bash scripts/smoke-test.sh` |

---

## Phụ lục — Lệnh hữu ích

```bash
# Trạng thái tổng thể
docker compose ps
docker compose top

# Log
docker compose logs -f backend
docker compose logs -f --tail=100 nginx

# Vào shell trong container
docker compose exec backend sh
docker compose exec postgres psql -U postgres -d restaurant_db

# Kiểm tra cấu hình compose sau khi sửa
docker compose config

# Khởi động lại một dịch vụ sau khi sửa mã nguồn
docker compose up -d --build backend

# Xem tài nguyên đang dùng
docker stats --no-stream

# Dừng toàn bộ (GIỮ dữ liệu)
docker compose down
```

---

## Giấy phép

Dự án phục vụ mục đích học tập.
