# PHÂN TÍCH DỰ ÁN VÀ CHUẨN BỊ BÁO CÁO — ĐỀ TÀI 12

> **Môn:** Triển khai và Quản trị Hệ thống Phần mềm
> **Đề tài 12:** Hệ thống Quản lý Nhà hàng / Order — *Xây dựng hệ thống quản lý đặt món nhà hàng*
>
> Tài liệu này là **bản ghi thu thập và xác minh thông tin** (giai đoạn 1), **không phải báo cáo nộp**.
> Không chứa mật khẩu / token / secret từ `.env`. Mọi nội dung dưới đây được đối chiếu với
> mã nguồn, file cấu hình và trạng thái thực tế của dự án.

---

## 0. Tóm tắt nhanh (đọc trước)

| # | Kết luận | Chi tiết |
|---|---|---|
| 1 | Dự án **đầy đủ và đang chạy** | 13 container `Up (healthy)` (12 service chính + `postgres-test`) |
| 2 | **5 commit đã push** lên GitHub, trong đó **3 commit khớp đúng yêu cầu** giảng viên | Xem mục 1.2 |
| 3 | Báo cáo cũ `docs/BAO-CAO.md` đang có **10 chương** | **KHÔNG khớp** yêu cầu mới "đúng 3 chương" → cần viết lại theo 3 chương |
| 4 | **0 ảnh minh chứng** (`docs/screenshots/` trống) | Cần chụp theo danh sách mục 5 |
| 5 | Tài liệu + script còn lẫn **tài khoản cũ `admin`/`Admin@123`** | Seed thực tế đã đổi sang tài khoản sinh viên `quantrongbong` |
| 6 | Thay đổi seed (`001_seed_data.sql`) **chưa commit + chưa push** | GitHub vẫn còn seed tài khoản cũ |

---

## 1. Thông tin dự án đã xác minh

### 1.1 Thông tin sinh viên (do sinh viên cung cấp)

| Mục | Giá trị |
|---|---|
| Trường | Trường Công nghệ thông tin và truyền thông |
| Khoa | Công nghệ thông tin |
| Mã số sinh viên | DTC245200536 |
| Họ và tên | Quan Trọng Bổng |
| Lớp | CNTTK23M |
| Giảng viên hướng dẫn | Vũ Văn Diện |
| Tên đề tài | Xây dựng hệ thống quản lý đặt món nhà hàng |

### 1.2 Git repository và lịch sử commit (đã xác minh bằng `git log`)

- **Remote:** `https://github.com/quantrongbong-ops/DTC245200536.git`
- **Nhánh:** `master` (đồng bộ `origin/master`)
- **Số file được theo dõi:** 105 (đã loại `node_modules`)

| # | Hash | Thời điểm | Thông điệp | Nội dung chính |
|---|---|---|---|---|
| 1 | `53ca4cd` | 2026-10-13 19:32 | feat: ứng dụng quản lý nhà hàng, PostgreSQL và Nginx reverse proxy | Toàn bộ app (backend + frontend), PostgreSQL, `docker-compose.yml`, **Nginx reverse proxy + TLS tự ký + security headers** |
| 2 | `27ce2e7` | 2026-10-13 19:33 | feat: giám sát với Prometheus, Grafana và các exporter | `prometheus.yml`, Grafana provisioning (2 datasource + dashboard JSON 21 panel), 3 exporter |
| 3 | `17a047c` | 2026-10-13 19:33 | feat: thu thập log tập trung, hardening và bộ kiểm thử | `loki-config.yml`, `promtail.yml`, tài liệu hardening, toàn bộ test + 2 script test |
| 4 | `c80d26e` | 2026-10-13 19:34 | docs: cập nhật số service Loki theo kết quả đo thực tế | Chỉnh số liệu trong `TEST-REPORT.md` |
| 5 | `c70d94f` | 2026-10-13 20:35 | fix: tăng cường bảo mật đăng nhập và sửa giới hạn tốc độ | Sửa `auth.controller.js`, `auth.routes.js`, `app.js` (rate-limit + chống user enumeration) |

**Đối chiếu 3 commit yêu cầu:**

| Yêu cầu giảng viên | Commit thực tế | Khớp? |
|---|---|---|
| Commit 1: Nginx reverse proxy và HTTPS / security headers | `53ca4cd` (chứa `nginx/`, `certgen`, TLS, security headers) | ✅ |
| Commit 2: Prometheus và Grafana | `27ce2e7` (chứa `prometheus/prometheus.yml`, `docker/grafana/provisioning/*`) | ✅ |
| Commit 3: Loki, Promtail và LogQL | `17a047c` (chứa `docker/loki/loki-config.yml`, `promtail/promtail.yml`, truy vấn LogQL trong README/BAO-CAO) | ✅ |

> Repo có thêm 2 commit phụ (docs + fix bảo mật) — điều này **không vi phạm**, thậm chí thể hiện quá trình hoàn thiện liên tục. Trong báo cáo nên trình bày **đủ 5 commit**, nhấn mạnh 3 commit cốt lõi.

### 1.3 Trạng thái chạy thực tế (`docker compose ps`)

Toàn bộ **13 container đang chạy và `healthy`** (riêng `nginx-exporter` không có healthcheck do image distroless — đã ghi rõ lý do trong `docker-compose.yml`; `certgen` chạy một lần rồi thoát theo thiết kế):

```
restaurant-postgres          Up (healthy)  127.0.0.1:5434->5432
restaurant-postgres-test     Up (healthy)  127.0.0.1:5433->5432   (profile "test")
restaurant-pgadmin           Up (healthy)  127.0.0.1:5051->80
restaurant-backend           Up (healthy)
restaurant-frontend          Up (healthy)
restaurant-nginx             Up (healthy)  0.0.0.0:8083->80, 0.0.0.0:8443->443
restaurant-prometheus        Up (healthy)  127.0.0.1:9091->9090
restaurant-grafana           Up (healthy)  127.0.0.1:3002->3000
restaurant-loki              Up (healthy)
restaurant-promtail          Up (healthy)
restaurant-postgres-exporter Up (healthy)
restaurant-nginx-exporter    Up (no healthcheck — by design)
restaurant-cadvisor          Up (healthy)  127.0.0.1:8082->8080
```

### 1.4 Cấu trúc thư mục (đã xác minh)

```
restaurant-order-management/
├── backend/                    # Node.js/Express (8 controller, 9 route, JWT, prom-client, winston+loki)
│   ├── src/{app,server}.js, config/database.js, controllers/, middlewares/, routes/, utils/
│   ├── tests/                  # Jest + supertest (unit, integration, concurrency)
│   └── Dockerfile              # multi-stage, non-root nodeuser (uid 1001)
├── frontend/                   # React 18 + Vite + Tailwind + Recharts (12 trang)
│   ├── src/pages/, components/, layouts/, contexts/, services/
│   ├── nginx.conf              # serve static + SPA fallback + stub_status
│   └── Dockerfile              # multi-stage build Vite → nginx
├── database/
│   ├── init.sh                 # tạo appuser (least privilege) + migration + seed
│   ├── migrations/001_init_schema.sql   # 7 bảng + trigger + constraint
│   └── seeds/001_seed_data.sql          # 1 admin + 6 danh mục + 19 món + 15 bàn
├── nginx/
│   ├── templates/default.conf.template   # reverse proxy (envsubst), HTTP→HTTPS
│   ├── snippets/security-headers.conf    # CSP, HSTS, X-Content-Type-Options, ...
│   ├── scripts/certgen.sh                # sinh chứng chỉ tự ký
│   └── certs/                            # (gitignore)
├── prometheus/prometheus.yml
├── promtail/promtail.yml
├── docker/
│   ├── grafana/provisioning/{datasources,dashboards}/   # Prometheus + Loki + dashboard JSON
│   ├── loki/loki-config.yml
│   └── pgadmin/{servers.json,pgpass}
├── scripts/{smoke-test.sh,e2e-test.sh}
├── docs/                       # BAO-CAO.md, TEST-REPORT.md, HARDENING.md, DEMO-CHECKLIST.md
├── docker-compose.yml
├── .env / .env.example         # (.env gitignore, không commit)
└── README.md                   # 1042 dòng hướng dẫn đầy đủ
```

---

## 2. Cấu trúc hệ thống và công nghệ thực tế

### 2.1 Luồng hoạt động

```
Người dùng → nginx (revers proxy) ──┬── /            → frontend (SPA static, nginx :8080)
   :8083 HTTP → 301 HTTPS           │
   :8443 HTTPS (TLS tự ký)          └── /api/        → backend (Express :3001) ── pg ── postgres:16
                                                             │
                                        giám sát:            ├── Prometheus scrape backend /metrics (prom-client)
                                        ┌─────────────────────┼── postgres-exporter:9187
                                        ▼                     ├── nginx-exporter:9113 (stub_status :8081)
                              mon-net  Grafana ── Prometheus └── cadvisor:8080
                                        └── Loki :3100 ◄── Promtail (docker_sd, filter restaurant-*)
```

- **2 mạng chính:** `restaurant-app-net` (nghiệp vụ) và `restaurant-mon-net` (giám sát + log). `restaurant-test-net` riêng cho database test.
- Backend/nginx nằm ở cả hai mạng (vừa phục vụ nghiệp vụ vừa bị scrape metrics).

### 2.2 Công nghệ thực tế (chỉ liệt kê cái có thật)

| Thành phần | Công nghệ | Phiên bản (đã pin) |
|---|---|---|
| Backend | Node.js + Express | Node 20, Express 4.19 |
| Truy cập DB | `pg` (node-postgres) | 8.12 |
| Xác thực | jsonwebtoken + bcrypt (cost 12) | 9.0 / 5.1 |
| Bảo mật HTTP | helmet, express-rate-limit, cors | 7.1 / 7.3 / 2.8 |
| Log | winston + winston-loki | 3.13 / 6.1 |
| Metrics | prom-client | 15.1 |
| Frontend | React + Vite + Tailwind CSS + Recharts | 18.3 / 5.3 / 3.4 / 2.12 |
| Database | PostgreSQL | 16-alpine |
| Quản trị DB | pgAdmin 4 | 8.5 |
| Reverse proxy | Nginx | alpine |
| Giám sát | Prometheus / Grafana | 2.51.2 / 10.4.0 |
| Log tập trung | Loki / Promtail | 3.0.0 / 3.0.0 |
| Exporter | postgres-exporter / nginx-prometheus-exporter / cAdvisor | 0.15.0 / 1.1.0 / 0.45.0 (mirror) |

> **Công nghệ không dùng trong dự án:** không có Kubernetes, không có Docker Swarm, không có ELK (dùng Loki thay thế), không có RabbitMQ/Kafka, không có Redis. Không khẳng định các thứ này trong báo cáo.

### 2.3 Các service Docker Compose (14 service, 3 mạng)

| Service | Image | Cổng publish | Ghi chú |
|---|---|---|---|
| postgres | postgres:16-alpine | 127.0.0.1:5434 | DB chính, volume riêng |
| postgres-test | postgres:16-alpine | 127.0.0.1:5433 | profile `test`, mạng `test-net` |
| pgadmin | dpage/pgadmin4:8.5 | 127.0.0.1:5051 | loopback, đọc `servers.json` + `pgpass` |
| backend | (build) | — (nội bộ 3001) | non-root |
| frontend | (build) | — (nội bộ 8080) | SPA build bằng Vite |
| certgen | alpine/openssl | — | sinh TLS tự ký, chạy 1 lần |
| nginx | nginx:alpine | 8083→80, 8443→443 | reverse proxy, điểm vào duy nhất |
| prometheus | prom/prometheus:v2.51.2 | 127.0.0.1:9091 | scrape 5 job |
| grafana | grafana/grafana:10.4.0 | 127.0.0.1:3002 | provisioning datasource + dashboard |
| loki | grafana/loki:3.0.0 | — (nội bộ 3100) | filesystem storage |
| promtail | grafana/promtail:3.0.0 | — | docker_sd, filter `restaurant-*` |
| postgres-exporter | prometheuscommunity/postgres-exporter:v0.15.0 | — | metric PostgreSQL |
| nginx-exporter | nginx/nginx-prometheus-exporter:1.1.0 | — | scrape `stub_status` nội bộ :8081 |
| cadvisor | zcube/cadvisor:v0.45.0 | 127.0.0.1:8082 | `privileged: true` (rủi ro, đã ghi nhận) |

---

## 3. Đối chiếu 6 nhóm công việc với thang điểm

> Trạng thái dùng nhãn **Đã triển khai** (đã kiểm chứng trong code/cấu hình) và **Cần minh chứng** (đã có nhưng phải demo/chụp ảnh). Không tự kết luận "đạt điểm tối đa".

| Tiêu chí (điểm) | Bằng chứng thực tế | Tình trạng | Việc cần bổ sung |
|---|---|---|---|
| **1. Quản lý mã nguồn GitHub** (1,5) | 5 commit (3 khớp yêu cầu), README 1042 dòng, `.gitignore` chặn secret | ✅ Đã triển khai | Chụp Hình 1 (repo), Hình 2 (git log); **commit + push seed mới** |
| **2. Triển khai app + PostgreSQL/pgAdmin** (1,5) | 14 service Compose, schema 7 bảng, `appuser` least-privilege, pgAdmin `servers.json` | ✅ Đã triển khai | Chụp Hình 3 (docker ps), Hình 4 (web), Hình 5 (pgAdmin) |
| **3. Nginx Reverse Proxy** (1,5) | `default.conf.template` (301 + TLS), `security-headers.conf` (CSP/HSTS/…), `server_tokens off` | ✅ Đã triển khai | Chụp Hình 6 (web qua Nginx), Hình 7 (headers/TLS) |
| **4. Prometheus + Grafana** (1,5) | `prometheus.yml` 5 job (15s), Grafana provisioning 2 datasource + dashboard 21 panel | ✅ Đã triển khai | Chụp Hình 8 (targets), Hình 9 (dashboard) |
| **5. Loki + Promtail + LogQL** (1,5) | `loki-config.yml`, `promtail.yml` (docker_sd + relabel), `winston-loki`, LogQL trong README | ✅ Đã triển khai | Chụp Hình 10 (nguồn log), Hình 11 (LogQL + kết quả) |
| **6. Hardening** (1,5) | 12 biện pháp (non-root, mạng tách biệt, least privilege, headers, rate limit, pin image…) | ✅ Đã triển khai | Chụp Hình 12 (minh chứng hardening) |
| **7. Tổng thể & trình bày** | Chạy được bằng `docker compose up`, có smoke/e2e test | ⚠️ Cần demo thật | Demo trực tiếp + ảnh + khả năng giải thích |

---

## 4. Nội dung đề xuất cho từng chương (đúng 3 chương)

> **Lưu ý quan trọng:** báo cáo cũ `docs/BAO-CAO.md` đang có **10 chương** → **không dùng được** cho yêu cầu "đúng 3 chương". Cần viết lại bố cục sau. Đề xuất bố cục 3 chương như sau, bám sát thang điểm, thiên về **triển khai & quản trị** (không viết theo hướng "phân tích & thiết kế phần mềm").

### Chương I — Tổng quan đề tài và công nghệ sử dụng
- I.1 Lý do chọn đề tài (quản lý món/đơn/bàn thủ công → sai sót, cần tự động hóa + giám sát vận hành).
- I.2 Mục tiêu đề tài (quản lý nghiệp vụ nhà hàng + vận hành có giám sát, có log, có bảo mật).
- I.3 Phạm vi (món ăn, đơn hàng, bàn ăn; không có bếp ăn thật, không giao hàng online).
- I.4 Tổng quan hệ thống và yêu cầu đề tài 12.
- I.5 Công nghệ sử dụng → **bảng 2.2 ở trên** (chỉ công nghệ có thật).
- I.6 Vai trò từng thành phần: Docker Compose, app web, PostgreSQL, pgAdmin, Nginx, Prometheus, Grafana, Loki, Promtail.
- I.7 GitHub và quản lý mã nguồn (repo, nhánh, `.gitignore`).

### Chương II — Quản trị và triển khai hệ thống (chương trọng tâm)
- **II.1 Quản lý mã nguồn GitHub:** cấu trúc repo, README, **5 commit** (nhấn mạnh 3 commit yêu cầu).
- **II.2 Triển khai app + PostgreSQL + pgAdmin:** 14 service Compose, `docker compose up -d --build`, volume, `appuser` least-privilege, `servers.json` + `pgpass`, lỗi gặp phải (BuildKit/đĩa đầy, localhost IPv6, image distroless thiếu healthcheck).
- **II.3 Nginx Reverse Proxy:** 301 HTTP→HTTPS, TLS tự ký, security headers, `stub_status` nội bộ, cách kiểm tra (`curl -I`).
- **II.4 Prometheus + Grafana:** 5 scrape job, 3 exporter + cAdvisor, provisioning datasource + dashboard 21 panel, PromQL.
- **II.5 Loki + Promtail + LogQL:** kiến trúc thu thập, relabel `restaurant-*`, `winston-loki`, 2–3 truy vấn LogQL + kết quả.
- **II.6 Hardening:** bảng 12 biện pháp + phân biệt rõ đã áp dụng / đề xuất / chưa thực hiện (xem mục 3 & 6 dưới).

### Chương III — Demo, kết quả triển khai và đánh giá
- III.1 Môi trường demo (điều kiện, lệnh Compose, địa chỉ truy cập).
- III.2 Demo website (đăng nhập, món ăn, bàn, đơn hàng).
- III.3 Demo PostgreSQL/pgAdmin.
- III.4 Demo Nginx (HTTPS + headers).
- III.5 Demo Prometheus/Grafana.
- III.6 Demo Loki/Promtail/LogQL.
- III.7 Demo Hardening.
- III.8 Tổng kết: đối chiếu thang điểm, hoàn thành/chưa hoàn thành/hạn chế, **Kết luận + hướng phát triển** (đặt cuối Chương III, không tạo chương mới).

---

## 5. Danh sách ảnh minh chứng cần chụp

> `docs/screenshots/` hiện **trống (0 ảnh)**. Danh sách dưới đây theo đúng 13 hình trong yêu cầu. Mỗi hình kèm lệnh/thao tác để chụp (xem mục 8).

| # | Hình | Nội dung | Cách tạo |
|---|---|---|---|
| 1 | Hình 1 | Cấu trúc dự án + repo GitHub | Mở repo GitHub / `git ls-files` |
| 2 | Hình 2 | Lịch sử 3–5 commit | `git log --oneline --graph` |
| 3 | Hình 3 | Các service đang chạy | `docker compose ps` |
| 4 | Hình 4 | Website quản lý nhà hàng | https://localhost:8443 (đăng nhập) |
| 5 | Hình 5 | PostgreSQL + pgAdmin | http://127.0.0.1:5051 → Query Tool |
| 6 | Hình 6 | Website truy cập qua Nginx | Trình duyệt https://localhost:8443 |
| 7 | Hình 7 | HTTPS / security headers | DevTools → Network → Response Headers |
| 8 | Hình 8 | Prometheus targets | http://127.0.0.1:9091/targets |
| 9 | Hình 9 | Dashboard Grafana | http://127.0.0.1:3002 → Dashboard "Restaurant" |
| 10 | Hình 10 | Loki và nguồn log | Grafana → Explore → datasource Loki |
| 11 | Hình 11 | Truy vấn LogQL + kết quả | Explore chạy `{service="backend"}`… |
| 12 | Hình 12 | Minh chứng Hardening | `curl -I`, `psql` kiểm `rolsuper`, `docker inspect` user |
| 13 | Hình 13 | Kết quả kiểm thử | `bash scripts/smoke-test.sh`, `npm test` |

> README mục 18 có sẵn một danh sách **26 ảnh chi tiết hơn** — có thể dùng để chụp nhiều ảnh rồi chọn ra 13 ảnh chuẩn nộp.

---

## 6. Thông tin chưa xác minh / còn thiếu / không nhất quán

### 6.1 ⚠️ Báo cáo cũ `BAO-CAO.md` có 10 chương (KHÔNG khớp yêu cầu)
`docs/BAO-CAO.md` (1422 dòng) đang chia **10 chương** + Kết luận + Phụ lục. Yêu cầu mới là **đúng 3 chương**. → Phải viết lại bố cục (nội dung có thể tái sử dụng, nhưng khung phải còn 3 chương).

### 6.2 ✅ Tài khoản cũ `admin`/`Admin@123` — đã đồng bộ sang `quantrongbong`
Seed thực tế đã dùng tài khoản sinh viên `quantrongbong` (email `quantrongbong@gmail.com`, role `admin`). Các tài liệu/script/test trước đây còn ghi tài khoản cũ đã được **sửa xong**:

| File | Vị trí | Trạng thái |
|---|---|---|
| `README.md` | bảng đăng nhập + rủi ro seed | ✅ Đã sửa |
| `docs/BAO-CAO.md` | rủi ro R2 | ✅ Đã sửa |
| `docs/DEMO-CHECKLIST.md` | bước đăng nhập | ✅ Đã sửa |
| `docs/HARDENING.md` | mục hardening + rủi ro R2 | ✅ Đã sửa |
| `scripts/smoke-test.sh` | mặc định `APP_USER` | ✅ Đã sửa |
| `scripts/e2e-test.sh` | comment + mặc định `APP_USER` | ✅ Đã sửa |
| `backend/tests/helpers.js`, `auth.test.js` | đăng nhập test | ✅ Đã sửa |

> **Quy ước:** mật khẩu demo `Trongbong123@` được công khai trong repo để tiện chấm điểm
> (script/test đã có mặc định sẵn; vẫn đè được qua `SMOKE_APP_PASS` / `TEST_ADMIN_PASS`).

### 6.3 ⚠️ Thay đổi seed `001_seed_data.sql` chưa commit + push
`git status` đang có `M database/seeds/001_seed_data.sql` (đổi admin → `quantrongbong`). **GitHub vẫn còn seed tài khoản cũ.** Cần commit + push.

### 6.4 ✅ Mật khẩu trong file seed — chỉ giữ hash bcrypt
File `database/seeds/001_seed_data.sql` chỉ giữ **hash bcrypt** (không có comment mật khẩu thô),
để DB init đúng và tránh bị chặn khi commit. Mật khẩu demo `Trongbong123@` được công khai ở
`README.md`, `docs/DEMO-CHECKLIST.md` và script/test (mục đích chấm điểm).

### 6.5 Ảnh minh chứng: 0 ảnh
`docs/screenshots/` trống. Báo cáo và DEMO-CHECKLIST tham chiếu ảnh nhưng chưa có file nào.

### 6.6 Placeholder thông tin cá nhân
`README.md` (dòng 12–16) và `BAO-CAO.md` còn placeholder `<HỌ TÊN>`, `<MSSV>`… → điền bằng thông tin ở mục 1.1.

### 6.7 Chưa xác minh lại sau khi đổi tài khoản
- Kết quả test trong `TEST-REPORT.md` (490 dòng) ghi nhận theo tài khoản cũ; **cần chạy lại** `npm test`, `smoke-test`, `e2e-test` với tài khoản mới để có số liệu/ảnh mới.
- Không tự bịa kết quả — mọi số liệu trong báo cáo phải từ lần chạy thật.

---

## 7. Công việc cần hoàn thành trước khi demo (checklist)

- [ ] **1.** Sửa `database/seeds/001_seed_data.sql`: xóa comment chứa mật khẩu plaintext (chỉ giữ hash bcrypt).
- [ ] **2.** Commit + push seed mới (lưu ý: đừng để mật khẩu trong commit message).
- [ ] **3.** Cập nhật tài khoản mới vào `README.md`, `BAO-CAO.md`, `DEMO-CHECKLIST.md`, `HARDENING.md`.
- [ ] **4.** Cập nhật tài khoản mặc định trong `scripts/smoke-test.sh` và `scripts/e2e-test.sh` (hoặc chạy kèm `SMOKE_APP_USER`/`SMOKE_APP_PASS`).
- [ ] **5.** Điền thông tin sinh viên (mục 1.1) vào placeholder README + báo cáo.
- [ ] **6.** Viết lại báo cáo theo **đúng 3 chương** (dùng bố cục mục 4).
- [ ] **7.** Chạy lại test thật: `npm test`, `bash scripts/smoke-test.sh`, `bash scripts/e2e-test.sh` → lấy số liệu mới.
- [ ] **8.** Chụp đủ **13 ảnh minh chứng** (mục 5) vào `docs/screenshots/`.
- [ ] **9.** Xuất Word/PDF (chỉ sau khi hoàn tất mục 6–8).

---

## 8. Lệnh kiểm tra và thao tác cụ thể (để chụp ảnh minh chứng)

```bash
# Hình 3 — trạng thái container
docker compose ps

# Hình 2 — lịch sử commit
git log --oneline --graph --all

# Hình 7 — security headers + chuyển hướng HTTPS
curl -k -I https://localhost:8443/
curl -I http://localhost:8083/          # phải trả 301 → https://...

# Hình 8 — Prometheus targets
# Mở trình duyệt: http://127.0.0.1:9091/targets

# Hình 9 — Grafana dashboard
# Mở: http://127.0.0.1:3002 → Dashboards → Restaurant

# Hình 10/11 — Loki + LogQL
# Mở: http://127.0.0.1:3002 → Explore → datasource Loki
#   {service="backend"}
#   {service="backend"} |~ "(?i)error|unhandled|exception"

# Hình 5 — pgAdmin + dữ liệu thật
# Mở: http://127.0.0.1:5051 → server RestaurantDB → Query Tool:
#   SELECT order_code, status, total_amount FROM orders ORDER BY created_at DESC LIMIT 20;

# Hình 12 — minh chứng hardening
docker compose exec postgres psql -U postgres -d restaurant_db \
  -c "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname='appuser';"
#   → rolsuper=f, rolcreatedb=f, rolcreaterole=f  (least privilege)

# Hình 13 — kết quả kiểm thử
bash scripts/smoke-test.sh
bash scripts/e2e-test.sh          # TẠO dữ liệu thật (có thể dùng làm minh chứng)
cd backend && npm test
```

---

## 9. Ghi chú trung thực về rủi ro (không che giấu)

| Rủi ro | Mức độ | Ghi chú (đã ghi trong HARDENING.md) |
|---|---|---|
| `cadvisor` cần `privileged: true` | Cao | Yêu cầu kỹ thuật; đã giảm thiểu (chỉ `mon-net`, loopback, read-only) |
| Image `zcube/cadvisor` là mirror không chính thức | Trung bình | `gcr.io` không truy cập được; đã pin `v0.45.0` |
| Chứng chỉ TLS tự ký | Trung bình | Chỉ cho demo; production phải dùng CA tin cậy |
| `promtail` mount `/var/run/docker.sock` (read-only) | Trung bình | Cần cho docker_sd |
| `pgpass` chứa mật khẩu plaintext trên đĩa | Trung bình | Đã gitignore; production nên dùng Docker secrets |
| Chưa có `mem_limit`/`cpus` cho container | Thấp | Container có thể chiếm tài nguyên host |

> Các rủi ro này nên trình bày **đúng mức** trong báo cáo (phần "hạn chế") để thể hiện tính trung thực, không che giấu và không phóng đại.
