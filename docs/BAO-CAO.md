# BÁO CÁO ĐỒ ÁN

## ĐỀ TÀI 12: HỆ THỐNG QUẢN LÝ NHÀ HÀNG / ORDER

---

| | |
|---|---|
| **Trường** | Trường Công nghệ thông tin và truyền thông |
| **Khoa** | Công nghệ thông tin |
| **Môn học** | Triển khai và Quản trị Hệ thống Phần mềm |
| **Đề tài** | Hệ thống quản lý nhà hàng / Order |
| **Sinh viên thực hiện** | Quan Trọng Bổng |
| **Mã số sinh viên** | DTC245200536 |
| **Lớp** | CNTTK23M |
| **Giảng viên hướng dẫn** | Vũ Văn Diện |
| **Địa điểm** | `<ĐỊA ĐIỂM>` |
| **Năm** | 2026 |

---

## MỤC LỤC

1. [Chương I. Tổng quan đề tài và công nghệ sử dụng](#chương-i-tổng-quan-đề-tài-và-công-nghệ-sử-dụng)
2. [Chương II. Triển khai và quản trị hệ thống](#chương-ii-triển-khai-và-quản-trị-hệ-thống)
3. [Chương III. Demo, kết quả và đánh giá](#chương-iii-demo-kết-quả-và-đánh-giá)
4. [Tài liệu tham khảo](#tài-liệu-tham-khảo)
5. [Phụ lục](#phụ-lục)

---

## CHƯƠNG I. TỔNG QUAN ĐỀ TÀI VÀ CÔNG NGHỆ SỬ DỤNG

### I.1. Lý do chọn đề tài

Trong hoạt động của một nhà hàng, các công việc ghi nhận món ăn, theo dõi bàn trống/bàn đang
dùng, tiếp nhận đơn hàng và tính tiền thường được thực hiện thủ công trên giấy hoặc bảng tính.
Cách làm này dẫn đến nhiều vấn đề: sai sót khi ghi nhận đơn, khó đối soát doanh thu cuối ngày,
khó theo dõi trạng thái đơn hàng theo thời gian thực, và không có dữ liệu tập trung để phân tích.

Đề tài hướng đến việc **xây dựng một hệ thống quản lý đặt món cho nhà hàng** chạy trên môi
trường web, giúp nhân viên (nhân viên phục vụ, thu ngân, quản lý) thao tác nhanh, dữ liệu được
lưu tập trung trong cơ sở dữ liệu, đồng thời hệ thống được **vận hành một cách chuyên nghiệp**:
triển khai bằng container, có giám sát (metrics), thu thập log tập trung và các biện pháp bảo mật.

Bên cạnh phần nghiệp vụ, môn học "Triển khai và Quản trị Hệ thống Phần mềm" đặt trọng tâm vào
**cách đưa một hệ thống lên chạy thật và quản trị nó**, nên đề tài cũng là cơ hội để áp dụng các
công cụ: Docker Compose, Nginx reverse proxy, PostgreSQL, Prometheus, Grafana, Loki, Promtail.

### I.2. Mục tiêu của đề tài

- **Nghiệp vụ:** quản lý danh mục, món ăn, bàn ăn, đơn hàng và thanh toán của nhà hàng.
- **Triển khai:** đóng gói toàn bộ hệ thống (ứng dụng + cơ sở dữ liệu + công cụ vận hành) thành
  các container, khởi động được bằng một lệnh `docker compose up`.
- **Vận hành và giám sát:** thu thập metrics bằng Prometheus, hiển thị bằng Grafana; thu thập
  log tập trung bằng Loki + Promtail và truy vấn bằng LogQL.
- **Bảo mật:** chạy container với quyền tối thiểu, phân tách mạng, cấu hình HTTPS qua Nginx và
  các security header, giới hạn tốc độ đăng nhập, không đưa secret lên mã nguồn.
- **Kiểm thử:** có bộ test tự động (unit + tích hợp) và script smoke-test/e2e-test để kiểm chứng.

### I.3. Phạm vi của đề tài

**Trong phạm vi:**
- Quản lý người dùng theo vai trò (quản lý `admin`, nhân viên `staff`, thu ngân `cashier`).
- Quản lý danh mục và món ăn (bật/tắt món, giá bán).
- Quản lý bàn ăn và trạng thái bàn.
- Tạo/duyệt đơn hàng, thêm món vào đơn, theo dõi trạng thái đơn, thanh toán.
- Toàn bộ hạ tầng vận hành: Nginx reverse proxy, PostgreSQL + pgAdmin, Prometheus + Grafana,
  Loki + Promtail, và các biện pháp hardening.

**Ngoài phạm vi (không triển khai):**
- Không có khu vực bếp thật, không in phiếu bếp.
- Không có giao hàng trực tuyến, không tích hợp thanh toán cổng (Visa/MoMo...).
- Không dùng Kubernetes, Docker Swarm, ELK, RabbitMQ/Kafka, Redis.

### I.4. Yêu cầu của đề tài 12

Đề tài yêu cầu sinh viên hoàn thành một hệ thống và **chứng minh năng lực triển khai, quản trị**
thông qua các nhóm công việc có trọng số điểm như sau:

| Nhóm công việc | Trọng tâm |
|---|---|
| Quản lý mã nguồn bằng GitHub | Repo, nhánh, commit rõ ràng, `.gitignore` |
| Triển khai ứng dụng + PostgreSQL + pgAdmin | Docker Compose, schema, phân quyền DB |
| Nginx reverse proxy, HTTPS, security headers | Điểm vào duy nhất, TLS, header bảo mật |
| Prometheus + Grafana | Scrape metrics, dashboard |
| Loki + Promtail + LogQL | Thu thập và truy vấn log tập trung |
| Hardening bảo mật | Quyền tối thiểu, mạng tách biệt, giới hạn tốc độ... |

> Ghi chú quan trọng về bố cục: báo cáo này được viết **đúng 3 chương** theo yêu cầu, bám sát
> hướng "triển khai và quản trị hệ thống" (không viết theo hướng phân tích & thiết kế phần mềm).

### I.5. Tổng quan kiến trúc hệ thống

Hệ thống gồm một ứng dụng web (React + Express) đặt sau một **reverse proxy Nginx**, dữ liệu lưu
trong **PostgreSQL**, và một bộ công cụ giám sát/log chạy song song trên mạng riêng.

```
Người dùng ──► Nginx (reverse proxy) ──┬── /      ──► Frontend (SPA, nginx :8080)
     :8083 HTTP → 301 HTTPS            │
     :8443 HTTPS (TLS tự ký)           └── /api/  ──► Backend (Express :3001) ──► PostgreSQL :5432
                                             │
        Giám sát (mạng riêng):              ├── Prometheus ◄── scrape backend /metrics (prom-client)
                                             ├── Prometheus ◄── postgres-exporter :9187
                                             ├── Prometheus ◄── nginx-exporter :9113 (stub_status)
                                             └── Prometheus ◄── cAdvisor :8080
        Log tập trung: Loki :3100 ◄── Promtail (docker_sd, lọc container restaurant-*)
```

- **2 mạng chính:** `restaurant-app-net` (nghiệp vụ) và `restaurant-mon-net` (giám sát + log);
  riêng `restaurant-test-net` dành cho cơ sở dữ liệu dùng trong kiểm thử.
- Backend và Nginx nằm ở cả hai mạng: vừa phục vụ nghiệp vụ, vừa để lộ metrics cho Prometheus.

### I.6. Công nghệ sử dụng

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
| Exporter | postgres-exporter / nginx-prometheus-exporter / cAdvisor | 0.15.0 / 1.1.0 / 0.45.0 |

### I.7. Quản lý mã nguồn với GitHub

- **Kho lưu trữ:** `https://github.com/quantrongbong-ops/DTC245200536.git`
- **Nhánh:** `master` (đồng bộ `origin/master`).
- **Cấu trúc repo:** mã nguồn backend/frontend, cấu hình hạ tầng (`nginx/`, `prometheus/`,
  `promtail/`, `docker/`), database, script kiểm thử và tài liệu (`docs/`).
- **Lịch sử commit** (trình bày chi tiết ở Chương II — II.1), gồm 3 commit cốt lõi tương ứng với
  3 nhóm yêu cầu về Nginx, Prometheus/Grafana và Loki/Promtail.

> 📷 **Hình 1 — Cấu trúc dự án và kho lưu trữ GitHub.**
> *(Chèn ảnh sau — chụp trang GitHub của repo `quantrongbong-ops/DTC245200536` hiển thị cấu trúc thư mục.)*

> 📷 **Hình 2 — Lịch sử commit trên GitHub.**
> *(Chèn ảnh sau — chụp kết quả `git log --oneline --graph --all`, thấy 3 commit cốt lõi.)*

---

## CHƯƠNG II. TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG

### II.1. Docker Compose và quản lý mã nguồn

#### II.1.1. Tổ chức mã nguồn và lịch sử commit

Toàn bộ hệ thống được quản lý bằng Git. Ba commit cốt lõi tương ứng với ba nhóm yêu cầu:

| Yêu cầu | Commit | Nội dung chính |
|---|---|---|
| Nginx reverse proxy + HTTPS + header | `53ca4cd` | App, PostgreSQL, `docker-compose.yml`, Nginx + TLS tự ký + security headers |
| Prometheus + Grafana | `27ce2e7` | `prometheus.yml`, Grafana provisioning (2 datasource + dashboard 21 panel), 3 exporter |
| Loki + Promtail + LogQL | `17a047c` | `loki-config.yml`, `promtail.yml`, tài liệu hardening, bộ test + 2 script test |

Ngoài ra repo còn có các commit bổ sung (cập nhật tài liệu, tăng cường bảo mật đăng nhập) thể hiện
quá trình hoàn thiện liên tục.

#### II.1.2. Các service Docker Compose

`docker-compose.yml` khai báo **14 service** trên **3 mạng**. Điểm vào duy nhất là Nginx; các cổng
giám sát/quản trị chỉ bind trên `127.0.0.1` (loopback) để không lộ ra ngoài.

| Service | Hình ảnh | Cổng publish | Ghi chú |
|---|---|---|---|
| postgres | postgres:16-alpine | 127.0.0.1:5434 | DB chính, volume riêng |
| postgres-test | postgres:16-alpine | 127.0.0.1:5433 | profile `test` cho kiểm thử |
| pgadmin | dpage/pgadmin4:8.5 | 127.0.0.1:5051 | đọc `servers.json` + `pgpass` |
| backend | (build) | nội bộ 3001 | non-root |
| frontend | (build) | nội bộ 8080 | SPA build bằng Vite |
| certgen | alpine/openssl | — | sinh TLS tự ký, chạy 1 lần |
| nginx | nginx:alpine | 8083→80, 8443→443 | reverse proxy, điểm vào duy nhất |
| prometheus | prom/prometheus:v2.51.2 | 127.0.0.1:9091 | scrape 5 job |
| grafana | grafana/grafana:10.4.0 | 127.0.0.1:3002 | provisioning datasource + dashboard |
| loki | grafana/loki:3.0.0 | nội bộ 3100 | filesystem storage |
| promtail | grafana/promtail:3.0.0 | — | docker_sd, lọc `restaurant-*` |
| postgres-exporter | prometheuscommunity/postgres-exporter:v0.15.0 | — | metric PostgreSQL |
| nginx-exporter | nginx/nginx-prometheus-exporter:1.1.0 | — | scrape `stub_status` nội bộ :8081 |
| cadvisor | zcube/cadvisor:v0.45.0 | 127.0.0.1:8082 | `privileged: true` (rủi ro đã ghi nhận) |

> 📷 **Hình 3 — Các service/container đang chạy.**
> *(Chèn ảnh sau — chụp kết quả `docker compose ps` với 13 container `Up (healthy)`.)*

### II.2. PostgreSQL và pgAdmin

- **Schema:** 7 bảng `users`, `categories`, `menu_items`, `dining_tables`, `orders`,
  `order_items`, `payments`; kèm trigger tự cập nhật `updated_at` và các ràng buộc khóa ngoại.
- **Khởi tạo tự động:** `database/init.sh` tạo user `appuser` (quyền tối thiểu), chạy migration
  và seed dữ liệu mẫu (1 tài khoản admin, 6 danh mục, 19 món, 15 bàn).
- **Phân quyền tối thiểu:** ứng dụng kết nối bằng `appuser` (không phải superuser) —
  `rolsuper=f`, `rolcreatedb=f`, `rolcreaterole=f`.
- **pgAdmin:** được provision tự động qua `servers.json` + `pgpass`, truy cập tại
  `http://127.0.0.1:5051` để xem/đối soát dữ liệu.

> 📷 **Hình 4 — Website quản lý nhà hàng (đăng nhập + màn hình chính).**
> *(Chèn ảnh sau — chụp `https://localhost:8443` sau khi đăng nhập `quantrongbong`.)*

> 📷 **Hình 5 — PostgreSQL và pgAdmin.**
> *(Chèn ảnh sau — chụp pgAdmin tại `http://127.0.0.1:5051`, Query Tool với kết quả `SELECT ... FROM orders`.)*

### II.3. Nginx reverse proxy, HTTPS và security headers

- **Định tuyến:** Nginx là điểm vào duy nhất. Request `/` đi tới frontend, `/api/` đi tới backend.
- **HTTPS:** HTTP (cổng 8083) chuyển hướng **301 sang HTTPS** (cổng 8443); chứng chỉ tự ký do
  service `certgen` sinh ra (dùng cho môi trường demo; production phải dùng CA tin cậy).
- **Security headers:** `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`; bật `server_tokens off`.
- **`stub_status` nội bộ:** bật ở cổng :8081 (chỉ nội bộ) để nginx-exporter scrape; đây là một
  lỗ hổng tiềm ẩn đã được phát hiện và giới hạn phạm vi truy cập.

> 📷 **Hình 6 — Website truy cập qua Nginx.**
> *(Chèn ảnh sau — chụp trang web ở `https://localhost:8443`, thấy ổ khóa HTTPS.)*

> 📷 **Hình 7 — HTTPS và các security header.**
> *(Chèn ảnh sau — chụp DevTools → Network → Response Headers, hoặc kết quả `curl -k -I https://localhost:8443/`.)*

### II.4. Prometheus và Grafana

- **Scrape:** Prometheus cấu hình 5 job (`prometheus`, `backend`, `postgres-exporter`,
  `nginx-exporter`, `cadvisor`), chu kỳ 15 giây, lưu 30 ngày.
- **Metrics ứng dụng:** backend xuất `/metrics` bằng `prom-client` (đếm request theo mã trạng thái,
  phân vị thời gian phản hồi, số đơn tạo, doanh thu...).
- **Grafana:** provisioning sẵn 2 datasource (Prometheus `uid=prometheus`, Loki `uid=loki`) và
  dashboard `Restaurant Overview` gồm 21 panel.

Một số truy vấn PromQL minh chứng (đã có trong cấu hình/bảng điều khiển):

```
rate(http_requests_total[5m])                     # tốc độ request API
histogram_quantile(0.95, http_request_duration_seconds_bucket)
sum(orders_created_total)                         # tổng đơn đã tạo
sum(revenue_total)                                # doanh thu tích luỹ
process_cpu_seconds_total{}                       # CPU từng container
```

> 📷 **Hình 8 — Prometheus targets.**
> *(Chèn ảnh sau — chụp `http://127.0.0.1:9091/targets`, các target ở trạng thái UP.)*

> 📷 **Hình 9 — Dashboard Grafana.**
> *(Chèn ảnh sau — chụp `http://127.0.0.1:3002` → dashboard "Restaurant Overview".)*

### II.5. Loki, Promtail và truy vấn LogQL

- **Thu thập:** Promtail dùng `docker_sd` để tự phát hiện container, dùng `relabel` để **chỉ giữ**
  các container có tên `restaurant-*`, gắn nhãn `service`/`job` rồi đẩy về Loki.
- **Ứng dụng ghi log:** backend dùng `winston` + `winston-loki` ghi log có cấu trúc (JSON), không
  ghi mật khẩu/token vào log.
- **Lưu trữ:** Loki dùng filesystem storage (schema tsdb), không phụ thuộc dịch vụ ngoài.

Một số truy vấn LogQL minh chứng:

```
{service="backend"}
{service="backend"} |~ "(?i)error|unhandled|exception"
{service="postgres"}
{service=~".+"} |= "error" | json
{service="backend"} |~ "(?i)login|đăng nhập"
count_over_time({service=~".+"} |~ "(?i)error" [1h])
```

> 📷 **Hình 10 — Loki và các nguồn log.**
> *(Chèn ảnh sau — chụp Grafana → Explore → datasource Loki, danh sách label `service`.)*

> 📷 **Hình 11 — Truy vấn LogQL và kết quả.**
> *(Chèn ảnh sau — chụp Explore chạy `{service="backend"} |~ "(?i)error"` kèm kết quả.)*

### II.6. Hardening bảo mật

Các biện pháp đã áp dụng (tóm tắt; chi tiết đầy đủ trong `docs/HARDENING.md`):

1. Chạy container với user **non-root** (`nodeuser`, uid 1001).
2. Phân tách mạng: `app-net` (nghiệp vụ) và `mon-net` (giám sát).
3. Cổng quản trị/giám sát chỉ bind `127.0.0.1`.
4. Tài khoản DB `appuser` **least-privilege** (không superuser).
5. **Security headers** + `server_tokens off` trên Nginx.
6. **Giới hạn tốc độ**: 500 req/15 phút toàn cục, 20 req/15 phút cho đăng nhập; chống dò tên người dùng.
7. **Pin phiên bản image** cụ thể (không dùng `latest`).
8. Secret qua biến môi trường và `.gitignore`, không commit `.env`.
9. Mã hóa mật khẩu bằng **bcrypt (cost 12)**, JWT có thời hạn 8 giờ.
10. Log không ghi thông tin nhạy cảm.
11. `promtail` mount `docker.sock` **read-only**.
12. Chứng chỉ TLS tự ký (chỉ cho demo; production dùng CA tin cậy).

> 📷 **Hình 12 — Minh chứng hardening.**
> *(Chèn ảnh sau — chụp `docker compose exec postgres psql ... SELECT rolname, rolsuper ... WHERE rolname='appuser'` và/hoặc `docker inspect` thấy user non-root.)*

---

## CHƯƠNG III. DEMO, KẾT QUẢ VÀ ĐÁNH GIÁ

### III.1. Môi trường demo

- Khởi động: `docker compose up -d --build`.
- Địa chỉ truy cập:
  - Website: `https://localhost:8443` (HTTP `:8083` tự chuyển 301 sang HTTPS).
  - pgAdmin: `http://127.0.0.1:5051`.
  - Prometheus: `http://127.0.0.1:9091` · Grafana: `http://127.0.0.1:3002`.
- Tài khoản demo: `quantrongbong` (mật khẩu demo công khai trong `README.md` — chỉ dùng cho
  chấm điểm, không dùng cho hệ thống thật).

### III.2. Demo hệ thống

1. Đăng nhập vào website bằng tài khoản demo.
2. Xem danh mục/món ăn, thao tác với bàn ăn, tạo và thanh toán một đơn hàng.
3. Đối soát dữ liệu vừa tạo trong pgAdmin.
4. Xem metrics trong Grafana và log trong Loki (Explore + LogQL).

### III.3. Kiểm thử và kết quả

Bộ kiểm thử gồm:

| Nhóm | Nội dung |
|---|---|
| Unit/integration (Jest + supertest) | Auth, users, categories, menu-items, tables, orders, payments; kiểm tra phân quyền theo vai trò |
| Smoke test | `bash scripts/smoke-test.sh` — kiểm tra nhanh các endpoint quan trọng |
| E2E test | `bash scripts/e2e-test.sh` — tạo dữ liệu thật và kiểm tra luồng nghiệp vụ |

> **Ghi chú trung thực:** số liệu kết quả kiểm thử phải lấy từ lần chạy thật. Kết quả chi tiết
> được ghi trong `docs/TEST-REPORT.md`; cần chạy lại `cd backend && npm test`,
> `bash scripts/smoke-test.sh`, `bash scripts/e2e-test.sh` với tài khoản demo mới rồi cập nhật
> số liệu vào đây (không tự bịa kết quả).

> 📷 **Hình 13 — Kết quả kiểm thử.**
> *(Chèn ảnh sau — chụp kết quả `bash scripts/smoke-test.sh`, `bash scripts/e2e-test.sh` và `npm test`.)*

### III.4. Đối chiếu thang điểm

| Tiêu chí | Bằng chứng | Tình trạng |
|---|---|---|
| Quản lý mã nguồn GitHub | 5 commit (3 khớp yêu cầu), README đầy đủ, `.gitignore` | Đã triển khai |
| App + PostgreSQL + pgAdmin | 14 service Compose, schema 7 bảng, `appuser` least-privilege | Đã triển khai |
| Nginx reverse proxy | 301 + TLS + security headers + `server_tokens off` | Đã triển khai |
| Prometheus + Grafana | 5 job, provisioning 2 datasource + dashboard 21 panel | Đã triển khai |
| Loki + Promtail + LogQL | docker_sd + relabel + `winston-loki` + truy vấn LogQL | Đã triển khai |
| Hardening | 12 biện pháp (non-root, mạng tách biệt, rate-limit...) | Đã triển khai |
| Tổng thể & trình bày | Chạy được bằng 1 lệnh, có smoke/e2e test | Cần demo thật |

### III.5. Kết luận, hạn chế và hướng phát triển

**Kết quả đạt được:** hệ thống quản lý đặt món nhà hàng hoàn chỉnh, được đóng gói bằng Docker
Compose và vận hành với đầy đủ reverse proxy, giám sát, thu thập log tập trung và các biện pháp
bảo mật, kèm bộ kiểm thử tự động.

**Hạn chế (ghi nhận trung thực):**

| Rủi ro / hạn chế | Mức độ | Ghi chú |
|---|---|---|
| `cadvisor` cần `privileged: true` | Cao | Yêu cầu kỹ thuật; đã giới hạn mạng loopback/read-only |
| Image `zcube/cadvisor` là mirror không chính thức | Trung bình | `gcr.io` không truy cập được; đã pin `v0.45.0` |
| Chứng chỉ TLS tự ký | Trung bình | Chỉ cho demo; production phải dùng CA tin cậy |
| `promtail` mount `docker.sock` (read-only) | Trung bình | Cần cho docker_sd |
| `pgpass` chứa mật khẩu plaintext trên đĩa | Trung bình | Đã gitignore; production nên dùng Docker secrets |
| Chưa có `mem_limit`/`cpus` cho container | Thấp | Container có thể chiếm tài nguyên host |
| Mật khẩu seed `Trongbong123@` công khai (mục đích demo) | Cao | Chỉ dùng cho demo/chấm điểm; phải đổi khi dùng thật |

**Hướng phát triển:** thay chứng chỉ tự ký bằng chứng chỉ từ CA tin cậy, dùng Docker secrets thay
cho `pgpass`, thêm giới hạn tài nguyên (`mem_limit`/`cpus`), mở rộng báo cáo doanh thu và tích hợp
in phiếu bếp.

---

## TÀI LIỆU THAM KHẢO

1. Tài liệu Docker Compose — https://docs.docker.com/compose/
2. Tài liệu Nginx — https://nginx.org/en/docs/
3. Tài liệu Prometheus — https://prometheus.io/docs/
4. Tài liệu Grafana — https://grafana.com/docs/
5. Tài liệu Grafana Loki / LogQL — https://grafana.com/docs/loki/latest/
6. OWASP Secure Headers Project — https://owasp.org/www-project-secure-headers/

---

## PHỤ LỤC

### Phụ lục A — Bảng tổng hợp cổng

| Dịch vụ | Cổng host | Ghi chú |
|---|---|---|
| Nginx HTTP | 8083 | chuyển 301 → HTTPS |
| Nginx HTTPS | 8443 | điểm vào duy nhất |
| pgAdmin | 5051 | loopback |
| PostgreSQL | 5434 | loopback |
| Prometheus | 9091 | loopback |
| Grafana | 3002 | loopback |
| cAdvisor | 8082 | loopback |
| PostgreSQL (test) | 5433 | profile test |

### Phụ lục B — Lệnh vận hành thường dùng

```bash
docker compose up -d --build      # khởi động / build lại
docker compose ps                 # trạng thái container
docker compose logs -f backend    # theo dõi log
docker compose down               # dừng (giữ volume)
docker compose down -v            # dừng và xóa volume (reset dữ liệu)
bash scripts/smoke-test.sh        # kiểm tra nhanh
bash scripts/e2e-test.sh          # kiểm tra end-to-end
cd backend && npm test            # bộ test unit/integration
```

### Phụ lục C — Danh sách 13 ảnh minh chứng

| # | Chú thích | Trạng thái |
|---|---|---|
| Hình 1 | Cấu trúc dự án và kho GitHub | ⏳ Chưa chèn |
| Hình 2 | Lịch sử commit | ⏳ Chưa chèn |
| Hình 3 | Các service đang chạy | ⏳ Chưa chèn |
| Hình 4 | Website quản lý nhà hàng | ⏳ Chưa chèn |
| Hình 5 | PostgreSQL + pgAdmin | ⏳ Chưa chèn |
| Hình 6 | Website qua Nginx | ⏳ Chưa chèn |
| Hình 7 | HTTPS / security headers | ⏳ Chưa chèn |
| Hình 8 | Prometheus targets | ⏳ Chưa chèn |
| Hình 9 | Dashboard Grafana | ⏳ Chưa chèn |
| Hình 10 | Loki và nguồn log | ⏳ Chưa chèn |
| Hình 11 | Truy vấn LogQL + kết quả | ⏳ Chưa chèn |
| Hình 12 | Minh chứng hardening | ⏳ Chưa chèn |
| Hình 13 | Kết quả kiểm thử | ⏳ Chưa chèn |

### Phụ lục D — Cấu trúc mã nguồn

```
restaurant-order-management/
├── backend/            # Express + JWT + prom-client + winston-loki; tests/
├── frontend/           # React + Vite + Tailwind + Recharts
├── database/           # init.sh, migrations/, seeds/
├── nginx/              # templates/, snippets/, scripts/certgen.sh
├── prometheus/         # prometheus.yml
├── promtail/           # promtail.yml
├── docker/             # grafana/, loki/, pgadmin/ (provisioning)
├── scripts/            # smoke-test.sh, e2e-test.sh
├── docs/               # báo cáo + tài liệu vận hành
├── docker-compose.yml
└── README.md
```
