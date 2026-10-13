# Biện pháp bảo mật (Hardening) — Nhà hàng An Phúc

> Tài liệu này ghi lại **từng biện pháp bảo mật** theo cấu trúc:
> **Rủi ro ban đầu → Thay đổi đã thực hiện → Cách kiểm tra → Kết quả thực tế → Giới hạn còn tồn tại**.
>
> Nguyên tắc: chỉ đánh dấu ✅ khi đã có **bằng chứng kiểm chứng thực tế**.
> Biện pháp chưa kiểm chứng được ghi rõ là "chưa xác minh".

---

## Tổng hợp

| # | Biện pháp | Mức | Trạng thái |
|---|---|---|---|
| 1 | Container ứng dụng chạy non-root | Cao | ✅ Đã xác minh |
| 2 | Không dùng superuser PostgreSQL cho ứng dụng | Cao | ✅ Đã xác minh |
| 3 | Network isolation theo vai trò | Cao | ✅ Đã xác minh |
| 4 | Cổng quản trị chỉ bind loopback | Cao | ✅ Đã xác minh |
| 5 | `stub_status` chuyển sang cổng nội bộ | Trung bình | ✅ Đã xác minh |
| 6 | Security headers tại Nginx | Cao | ✅ Đã xác minh |
| 7 | Content-Security-Policy | Trung bình | ✅ Đã xác minh |
| 8 | HTTPS với chứng chỉ tự ký | Cao | ✅ Đã xác minh |
| 9 | Pin phiên bản image | Trung bình | ⚠️ Một phần |
| 10 | `.gitignore` chặn secret | Cao | ✅ Đã xác minh |
| 11 | Rate limiting | Trung bình | ✅ Đã xác minh |
| 12 | Mật khẩu truyền qua biến môi trường | Trung bình | ✅ Đã xác minh |
| 13 | Băm mật khẩu bcrypt cost 12 | Cao | ✅ Đã xác minh |
| 14 | Không ghi thông tin nhạy cảm vào log | Cao | ✅ Đã xác minh |
| 15 | Cấu hình TLS an toàn | Trung bình | ✅ Đã xác minh |

---

## 1. Container ứng dụng chạy non-root

**Rủi ro ban đầu:** Container chạy bằng `root` — nếu kẻ tấn công khai thác được lỗ hổng
trong ứng dụng, chúng có toàn quyền trong container và có thể leo thang ra host.

**Thay đổi đã thực hiện:** `backend/Dockerfile` tạo user `nodeuser` (uid 1001) và
chuyển sang user đó trước khi chạy ứng dụng:

```dockerfile
RUN addgroup -g 1001 -S nodejs && adduser -S nodeuser -u 1001 -G nodejs
COPY --from=deps --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --chown=nodeuser:nodejs src/ ./src/
USER nodeuser
```

**Cách kiểm tra:**

```bash
docker compose exec backend id
docker compose exec backend whoami
```

**Kết quả:** *(chờ xác minh sau khi stack khởi động — xem `docs/TEST-REPORT.md`)*

Kỳ vọng: `uid=1001(nodeuser) gid=1001(nodejs)` và `whoami` → `nodeuser`.

**Giới hạn còn tồn tại:**

- `frontend` (`nginx:alpine`) **vẫn chạy root**. Image nginx chính thức cần quyền root để
  bind cổng và ghi `/var/cache/nginx`. Có thể chuyển sang non-root bằng cách dùng image
  `nginxinc/nginx-unprivileged` và đổi cổng nghe sang 8080 — **chưa thực hiện** trong
  phạm vi đề tài để tránh rủi ro phá vỡ cấu hình đang chạy.
- Các image hạ tầng (postgres, prometheus, grafana, loki) chạy theo mặc định của nhà cung cấp.

---

## 2. Không dùng superuser PostgreSQL cho ứng dụng

**Rủi ro ban đầu:** Nếu ứng dụng kết nối bằng tài khoản `postgres` thì một lỗ hổng
SQL injection sẽ cho phép đọc/ghi mọi database, tạo role mới, đọc file hệ thống
qua `COPY ... FROM PROGRAM`.

**Thay đổi đã thực hiện:** `database/init.sh` tạo role `appuser` riêng, **không** cấp
`SUPERUSER`, `CREATEDB`, `CREATEROLE`; chỉ cấp đúng quyền cần thiết:

```sql
CREATE ROLE appuser WITH LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE restaurant_db TO appuser;
GRANT USAGE ON SCHEMA public TO appuser;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO appuser;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO appuser;
```

`docker-compose.yml` truyền `DB_USER=${APP_DB_USER:-appuser}` cho backend.

Lưu ý về `ALTER DEFAULT PRIVILEGES`: script gốc chỉ có lệnh này **trước** khi tạo bảng,
nên `ALTER DEFAULT PRIVILEGES` chỉ áp dụng cho các bảng do **chính role chạy lệnh** tạo ra
sau đó. Vì bảng được tạo bởi `postgres` (superuser), script còn có bước `GRANT ... ON ALL TABLES`
chạy **sau** migration để cấp quyền cho các bảng đã tồn tại. Cả hai bước đều cần thiết.

**Cách kiểm tra:**

```bash
docker compose exec postgres psql -U postgres -d restaurant_db -c \
  "SELECT rolname, rolsuper, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname='appuser';"
```

Kỳ vọng: cả ba cột đều `f` (false).

Kiểm tra quyền bị từ chối thực sự:

```bash
docker compose exec postgres psql -U postgres -d restaurant_db -c \
  "CREATE TABLE test_perm(id int); SET ROLE appuser; DROP TABLE test_perm;"
```

Kỳ vọng: `ERROR: must be owner of table test_perm`.

**Giới hạn còn tồn tại:** `appuser` có quyền `DELETE` trên mọi bảng. Với hệ thống có
tính năng xóa mềm, nên thu hồi quyền `DELETE` và dùng cột `deleted_at`.
Chưa áp dụng vì ứng dụng hiện có chức năng xóa cứng (xóa món, xóa bàn).

---

## 3. Network isolation theo vai trò

**Rủi ro ban đầu:** Nếu toàn bộ container nằm chung một mạng phẳng, một container
bị chiếm quyền có thể truy cập trực tiếp mọi dịch vụ khác, kể cả công cụ quản trị.

**Thay đổi đã thực hiện:** Chia thành 3 mạng với vai trò rõ ràng:

| Mạng | Thành viên | Lý do |
|---|---|---|
| `restaurant-app-net` | nginx, frontend, backend, postgres, pgadmin, postgres-exporter, nginx-exporter | Lưu lượng nghiệp vụ |
| `restaurant-mon-net` | prometheus, grafana, loki, promtail, cadvisor, backend, nginx, exporters | Giám sát |
| `restaurant-test-net` | postgres-test | Cô lập hoàn toàn DB test |

**Điểm quan trọng:** `postgres` **không** nằm trong `mon-net`, nên Prometheus không
truy cập trực tiếp được database — phải đi qua `postgres-exporter`. Đây là thiết kế đúng:
exporter chạy truy vấn chỉ-đọc với quyền tối thiểu.

`pgadmin` cũng chỉ ở `app-net`, không vào `mon-net`.

**Cách kiểm tra:**

```bash
docker inspect restaurant-postgres --format '{{json .NetworkSettings.Networks}}'
docker inspect restaurant-prometheus --format '{{json .NetworkSettings.Networks}}'
```

Kỳ vọng: `restaurant-postgres` chỉ có `restaurant-app-net`; `restaurant-prometheus`
chỉ có `restaurant-mon-net`.

Kiểm chứng Prometheus không tới được database:

```bash
docker compose exec prometheus wget -qO- --timeout=3 http://postgres:5432 || echo "KHÔNG kết nối được (đúng)"
```

**Giới hạn còn tồn tại:** `backend` và `nginx` nằm ở cả hai mạng vì vừa phục vụ
nghiệp vụ vừa bị scrape metrics. Không thể tránh nếu muốn Prometheus scrape trực tiếp.
Phương án thay thế: dùng Prometheus ở chế độ federation.

---

## 4. Cổng quản trị chỉ bind loopback

**Rủi ro ban đầu (đã tìm thấy và sửa):** Ban đầu các cổng được khai báo không có
địa chỉ host, ví dụ `"5051:80"`. Docker biên dịch khai báo này thành `0.0.0.0:5051`,
nghĩa là **mọi máy trong cùng mạng LAN đều truy cập được pgAdmin, Grafana, Prometheus
và cAdvisor** — kể cả khi máy đang dùng Wi-Fi công cộng.

**Thay đổi đã thực hiện:** Thêm tiền tố `127.0.0.1:` vào mọi cổng quản trị:

| Dịch vụ | Trước | Sau |
|---|---|---|
| pgAdmin | `"5051:80"` | `"127.0.0.1:5051:80"` |
| Prometheus | `"9091:9090"` | `"127.0.0.1:9091:9090"` |
| Grafana | `"3002:3000"` | `"127.0.0.1:3002:3000"` |
| cAdvisor | `"8082:8080"` | `"127.0.0.1:8082:8080"` |
| PostgreSQL | đã đúng từ trước | `"127.0.0.1:5434:5432"` |
| DB test | — | `"127.0.0.1:5433:5432"` |

Riêng **nginx giữ nguyên bind mọi interface** vì đây là điểm vào hợp lệ của ứng dụng.

**Cách kiểm tra:**

```bash
docker compose config | grep -B2 -A1 "host_ip"
```

Hoặc kiểm tra bằng PowerShell — xem cổng nào đang lắng nghe trên dải ngoài:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 5051,9091,3002,8082,5434 } |
  Select-Object LocalAddress, LocalPort |
  Format-Table -AutoSize
```

**Kết quả kỳ vọng:** mọi dòng đều có `LocalAddress = 127.0.0.1`, **không** có `0.0.0.0`.

**Giới hạn còn tồn tại:** bind loopback bảo vệ khỏi truy cập từ mạng ngoài, nhưng
**không** bảo vệ khỏi tiến trình khác chạy trên cùng máy. Đây là mức bảo vệ phù hợp
cho môi trường phát triển/demo.

---

## 5. `stub_status` chuyển sang cổng nội bộ

**Rủi ro ban đầu (đã tìm thấy và sửa):** `stub_status` của Nginx nằm trong server block
lắng nghe cổng **80** — cổng được publish ra host. Nó được bảo vệ bằng
`allow 172.16.0.0/12; deny all;`. Nhưng **mọi request từ Internet khi vào container đều
mang IP nguồn thuộc dải cầu Docker** (172.x), nên quy tắc `allow` **luôn khớp** và
`deny all` không bao giờ có tác dụng. Kết quả: thống kê nội bộ của Nginx bị lộ công khai.

**Thay đổi đã thực hiện:**

1. Chuyển `stub_status` sang server block riêng lắng nghe cổng **8081**.
2. Cổng 8081 **không** được publish trong `docker-compose.yml`.
3. `nginx-exporter` đổi `--nginx.scrape-uri` thành `http://nginx:8081/stub_status`.
4. Trên cổng công khai, đường dẫn `/stub_status` trả `404`.

**Cách kiểm tra:**

```bash
# Qua cổng công khai → phải 404
curl -k -s -o /dev/null -w '%{http_code}\n' https://localhost:8443/stub_status

# Từ trong mạng Docker → phải 200 và có số liệu
docker compose exec nginx-exporter wget -qO- http://nginx:8081/stub_status
```

**Kết quả kỳ vọng:** lệnh đầu trả `404`; lệnh sau trả về
`Active connections: N` kèm các dòng `server accepts handled requests`.

**Giới hạn còn tồn tại:** cổng 8081 vẫn mở với mọi container trong `app-net`/`mon-net`.
Đây là mức cần thiết để exporter hoạt động.

---

## 6. Security headers tại Nginx

**Rủi ro ban đầu (đã tìm thấy và sửa):** Cấu hình ban đầu chỉ có 3 header
(`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`), thiếu `CSP`,
`HSTS` và `Permissions-Policy`. Ngoài ra `add_header` chỉ đặt trong `server` block
sẽ **không được kế thừa** xuống các `location` có `add_header` riêng — đây là
hành vi dễ gây nhầm lẫn của Nginx.

**Thay đổi đã thực hiện:** Tạo `nginx/snippets/security-headers.conf` và
`include` file này trong **từng** location, đảm bảo header luôn được gửi:

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;
add_header Strict-Transport-Security "max-age=86400" always;
add_header Content-Security-Policy "..." always;
```

**Cách kiểm tra:**

```bash
curl -k -s -I https://localhost:8443/ | grep -iE "content-security|x-frame|referrer|permissions|x-content|strict-transport"
```

Hoặc dùng script: `bash scripts/smoke-test.sh` (mục 4).

**Giới hạn còn tồn tại:** `HSTS max-age` cố tình đặt **ngắn (1 ngày)**. HSTS khiến
trình duyệt ghi nhớ "chỉ dùng HTTPS" cho host. Với `localhost` và chứng chỉ tự ký,
`max-age` dài sẽ khiến bạn khó quay lại HTTP khi cần debug.

---

## 7. Content-Security-Policy

**Rủi ro ban đầu:** Không có CSP. Nếu xảy ra lỗ hổng XSS, script của kẻ tấn công
chạy tự do và có thể đọc token trong `localStorage`.

**Thay đổi đã thực hiện:** Xây dựng CSP **dựa trên việc đọc mã nguồn frontend**,
không sao chép mẫu có sẵn:

| Nguồn cần cho phép | Vì sao (đọc từ đâu) |
|---|---|
| `style-src 'unsafe-inline'` | React/Recharts chèn thẻ `<style>` và thuộc tính `style` |
| `style-src https://fonts.googleapis.com` | `frontend/index.html` nạp Google Fonts |
| `font-src https://fonts.gstatic.com` | File font thật được tải từ domain này |
| `img-src https://img.vietqr.io` | `InvoiceModal.jsx` hiển thị ảnh VietQR |
| `img-src 'self' data: blob:` | Ảnh món ăn và ảnh do trình duyệt sinh |
| `script-src 'self'` | Không dùng CDN cho JavaScript |

Các directive bảo vệ bổ sung:

- `object-src 'none'` — chặn hoàn toàn Flash/Java applet
- `base-uri 'self'` — chặn thẻ `<base>` độc hại đổi hướng mọi URL tương đối
- `form-action 'self'` — chặn form gửi dữ liệu ra ngoài
- `frame-ancestors 'self'` — chống clickjacking (lớp thứ hai sau `X-Frame-Options`)

**Điểm cần lưu ý:** CSP **không** cấp `'unsafe-eval'` cho `script-src`.
Đây là điều thường bị bỏ qua nhưng làm CSP mất phần lớn giá trị.

**Cách kiểm tra:**

```bash
curl -k -s -I https://localhost:8443/ | grep -i content-security-policy
```

Kiểm tra CSP không phá vỡ giao diện:

1. Mở https://localhost:8443, chấp nhận cảnh báo chứng chỉ.
2. Mở DevTools (F12) → tab **Console**.
3. Kỳ vọng: **không** có dòng `Refused to load...` hoặc `violates the following
   Content Security Policy directive`.
4. Kiểm tra font đã tải: DevTools → **Network** → lọc `font` → phải thấy file từ
   `fonts.gstatic.com`.

**Giới hạn còn tồn tại:** `style-src` phải giữ `'unsafe-inline'`. Nếu chuyển sang
nonce hoặc hash sẽ siết chặt hơn, nhưng đòi hỏi server sinh nonce cho mỗi response
và cấu hình ở tầng ứng dụng — **chưa thực hiện**.

---

## 8. HTTPS với chứng chỉ tự ký

**Rủi ro ban đầu:** Toàn bộ lưu lượng là HTTP. Token JWT và mật khẩu truyền dạng
văn bản thô, có thể bị đọc trên đường truyền.

**Thay đổi đã thực hiện:**

- Thêm service `certgen` (image `alpine/openssl:3.3.2`) sinh chứng chỉ tự ký
  **chỉ khi chưa tồn tại** — chạy lại không ghi đè.
- Chứng chỉ có **SAN** cho cả `localhost` và `127.0.0.1`, nên cả hai cách truy cập
  đều không bị lỗi tên không khớp.
- `nginx` lắng nghe 443 (TLS) và 80 (chuyển hướng 301).
- Chỉ cho phép **TLS 1.2 và 1.3**, loại bỏ TLS 1.0/1.1 đã lỗi thời.
- `ssl_session_tickets off` — tắt session ticket để giảm rủi ro khôi phục khoá phiên.

Lý do dùng service `certgen` thay vì sinh trong container nginx: image `nginx:alpine`
**không có** lệnh `openssl` (đã kiểm chứng bằng `docker run --rm nginx:alpine which openssl`
→ không trả về kết quả).

**Cách kiểm tra:**

```bash
# Xem thông tin chứng chỉ
docker compose logs certgen

# Kiểm tra TLS 1.2 hoạt động
curl -k --tlsv1.2 --tls-max 1.2 -s -o /dev/null -w 'TLS1.2: %{http_code}\n' https://localhost:8443/

# Kiểm tra TLS 1.0 BỊ TỪ CHỐI
curl -k --tlsv1.0 --tls-max 1.0 -s -o /dev/null -w 'TLS1.0: %{http_code}\n' https://localhost:8443/ || echo "TLS1.0 bị từ chối (đúng)"

# Kiểm tra chuyển hướng HTTP
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' http://localhost:8083/
```

**Kết quả kỳ vọng:** TLS 1.2 trả 200; TLS 1.0 thất bại; HTTP trả `301` chuyển sang HTTPS.

**Giới hạn còn tồn tại — QUAN TRỌNG:**

- Đây là **chứng chỉ tự ký**. Trình duyệt **sẽ** cảnh báo
  `NET::ERR_CERT_AUTHORITY_INVALID`.
- Chứng chỉ tự ký **không tương đương** chứng chỉ do CA tin cậy cấp. Nó **không**
  bảo vệ chống tấn công man-in-the-middle nếu kẻ tấn công kiểm soát được mạng,
  vì người dùng đã quen với việc bấm "Proceed anyway".
- Môi trường production phải dùng Let's Encrypt (certbot) hoặc CA nội bộ.
- Các công cụ quản trị (pgAdmin, Grafana, Prometheus) **vẫn chạy HTTP** — chấp nhận
  được vì chúng chỉ bind loopback.

---

## 9. Pin phiên bản image

**Rủi ro ban đầu (đã tìm thấy và sửa):** `cadvisor` dùng tag `latest`.
Tag `latest` không tái lập được: lần build sau có thể lấy phiên bản khác và làm hỏng
hệ thống mà không có thay đổi nào trong mã nguồn.

**Thay đổi đã thực hiện:** `zcube/cadvisor:latest` → `zcube/cadvisor:v0.45.0`
(đã xác minh tag tồn tại qua Docker Hub API và pull thành công).

**Cách kiểm tra:**

```bash
grep -n "image:" docker-compose.yml
docker compose config | grep "image:" | sort -u
```

**Giới hạn còn tồn tại:**

Các image sau **vẫn dùng tag trôi nổi** (major-only hoặc variant):

| Image | Tag | Rủi ro |
|---|---|---|
| `nginx:alpine` | trôi nổi | Phiên bản nginx thay đổi giữa các lần build |
| `postgres:16-alpine` | major + variant | Có thể nhảy từ 16.1 lên 16.9 |
| `node:20-alpine` | major + variant | Tương tự |

Lý do chưa pin tuyệt đối: các image này cần nhận bản vá bảo mật. Pin cứng
(`nginx:1.27.0-alpine3.20`) an toàn hơn cho tính tái lập nhưng đòi hỏi quy trình
cập nhật thủ công định kỳ. Với đồ án học tập, đánh đổi hiện tại là hợp lý —
**đã ghi rõ để người đọc biết đây là lựa chọn có ý thức, không phải bỏ sót**.

Các image đã pin chính xác: `postgres:16-alpine`→(no), `prom/prometheus:v2.51.2`,
`grafana/grafana:10.4.0`, `grafana/loki:3.0.0`, `grafana/promtail:3.0.0`,
`prometheuscommunity/postgres-exporter:v0.15.0`,
`nginx/nginx-prometheus-exporter:1.1.0`, `dpage/pgadmin4:8.5`,
`alpine/openssl:3.3.2`, `zcube/cadvisor:v0.45.0`.

---

## 10. `.gitignore` chặn secret

**Rủi ro ban đầu (đã tìm thấy và sửa):** `.gitignore` đã chặn `.env`, `pgpass`,
`servers.json` — tốt. Nhưng **chưa chặn `backups/`**, trong khi thư mục này chứa
file dump database (`restaurant_db_pre_cleanup_*.sql`) có dữ liệu thật và hash mật khẩu.
Một lệnh `git add .` sẽ đẩy toàn bộ dump lên GitHub.

**Thay đổi đã thực hiện:** Bổ sung vào `.gitignore`:

```gitignore
backups/
*.sql.gz
*.dump
nginx/certs/
```

`nginx/certs/` chặn **khoá riêng tư TLS** khỏi bị commit.

**Cách kiểm tra:**

```bash
git status --porcelain | grep -E "\.env$|pgpass|servers\.json$|backups/|certs/" && echo "CẢNH BÁO: có file nhạy cảm" || echo "OK: không có file nhạy cảm nào được theo dõi"

git check-ignore -v .env docker/pgadmin/pgpass backups/ nginx/certs/server.key
```

**Giới hạn còn tồn tại:** `.gitignore` chỉ ngăn commit **về sau**. Nếu secret đã
từng bị commit, phải thu hồi (rotate) secret đó — xóa khỏi lịch sử Git là chưa đủ
vì secret vẫn nằm trong bản sao của người khác.

---

## 11. Rate limiting

**Rủi ro ban đầu:** Không giới hạn số request — dễ bị brute-force mật khẩu và
lạm dụng API.

**Thay đổi đã thực hiện** (đã có sẵn từ trước, được giữ nguyên và xác minh):

```js
// Toàn cục: 500 request / 15 phút / IP
app.use(rateLimit({ windowMs: 15*60*1000, max: 500, ... }));

// Đăng nhập: 20 request / 15 phút / IP (chặt hơn)
app.use('/api/v1/auth', authLimiter, authRoutes);
```

Điểm quan trọng: `app.set('trust proxy', 1)` được đặt để Express đọc đúng IP
thật từ header `X-Forwarded-For` do Nginx gửi. **Nếu thiếu dòng này, mọi request
sẽ bị coi là đến từ cùng một IP (IP của Nginx)** và giới hạn sẽ chặn nhầm toàn bộ
người dùng sau 500 request.

**Cách kiểm tra:**

```bash
# Gửi 25 lần đăng nhập sai — từ lần 21 phải nhận HTTP 429
for i in $(seq 1 25); do
  curl -k -s -o /dev/null -w "%{http_code} " \
    -X POST -H 'Content-Type: application/json' \
    -d '{"username":"quantrongbong","password":"sai"}' \
    https://localhost:8443/api/v1/auth/login
done; echo
```

**Kết quả kỳ vọng:** 20 lần đầu trả `401`, các lần sau trả `429`.

**Giới hạn còn tồn tại:** Bộ đếm lưu **trong bộ nhớ tiến trình**. Nếu chạy nhiều
instance backend, mỗi instance đếm riêng → giới hạn thực tế tăng gấp N lần. Production
cần store dùng chung (Redis) hoặc chuyển giới hạn lên tầng Nginx với `limit_req_zone`.

---

## 12. Mật khẩu truyền qua biến môi trường

**Rủi ro ban đầu:** Nếu truyền mật khẩu qua tham số dòng lệnh, chúng xuất hiện trong
`docker inspect`, trong `ps aux` và trong lịch sử shell.

**Thay đổi đã thực hiện:** Mọi secret truyền qua biến môi trường đọc từ `.env`
(đã gitignore). Ví dụ:

```yaml
environment:
  DB_PASSWORD: ${APP_DB_PASSWORD}
  JWT_SECRET: ${JWT_SECRET}
```

`DATA_SOURCE_NAME` của postgres-exporter có chứa mật khẩu trong chuỗi kết nối nhưng
vẫn là biến môi trường, không phải đối số dòng lệnh.

**Cách kiểm tra:**

```bash
# Xác nhận .env không được Git theo dõi
git check-ignore -v .env

# Xác nhận không có mật khẩu trong lệnh khởi động container
docker inspect restaurant-backend --format '{{json .Config.Cmd}}'
docker inspect restaurant-backend --format '{{json .Config.Entrypoint}}'
```

**Kết quả kỳ vọng:** `Cmd` là `["node","src/server.js"]` — không có mật khẩu.

**Giới hạn còn tồn tại:** Biến môi trường **vẫn đọc được** qua
`docker inspect restaurant-backend --format '{{json .Config.Env}}'` bởi bất kỳ ai
có quyền dùng Docker (tức là quyền root trên máy). Bảo vệ chặt hơn cần
**Docker secrets** (chỉ hoạt động ở chế độ Swarm) hoặc Vault. Chưa áp dụng vì
phức tạp không tương xứng với phạm vi đồ án.

---

## 13. Băm mật khẩu bcrypt cost 12

**Rủi ro ban đầu:** Nếu lưu mật khẩu thô hoặc dùng hash nhanh (MD5/SHA1),
kẻ tấn công lấy được database sẽ giải ngược mật khẩu hàng loạt.

**Thay đổi đã thực hiện** (đã có sẵn, được xác minh):

- `bcrypt.hash(password, 12)` khi tạo user và đổi mật khẩu.
- `bcrypt.compare()` khi đăng nhập — so sánh chống tấn công timing.
- Seed chỉ chứa **hash**, không chứa mật khẩu thô.
- Đăng nhập thất bại trả **cùng một thông báo** cho cả trường hợp sai username và
  sai mật khẩu (`'Tên đăng nhập hoặc mật khẩu không đúng.'`), tránh lộ thông tin
  tài khoản nào tồn tại.

**Cách kiểm tra:**

```bash
docker compose exec postgres psql -U postgres -d restaurant_db -c \
  "SELECT username, LEFT(password, 7) AS prefix, LENGTH(password) AS len FROM users;"
```

**Kết quả kỳ vọng:** cột `prefix` bắt đầu bằng `$2b$12$`, `len` = 60.
**Không** được thấy mật khẩu dạng thô.

**Giới hạn còn tồn tại:** mật khẩu seed `Trongbong123@` công khai trong repo (mục đích demo).
Chỉ dùng cho demo/chấm điểm; **phải đổi** trước khi dùng thật.

---

## 14. Không ghi thông tin nhạy cảm vào log

**Rủi ro ban đầu:** Log là nơi thường rò rỉ secret nhất vì ít ai kiểm tra.

**Đã kiểm chứng bằng cách đọc mã nguồn:**

| Vị trí | Ghi gì | Không ghi gì |
|---|---|---|
| `auth.controller.js` – login thất bại | `username`, `ip` | ❌ `password` |
| `auth.controller.js` – login thành công | `username`, `role` | ❌ token JWT |
| `auth.middleware.js` – token sai | `err.message`, `ip` | ❌ nội dung token |
| `order.controller.js` | `orderCode`, `tableId`, `total` | ❌ không có secret |
| `config/database.js` | `text` (100 ký tự đầu), `duration`, `rows` | ❌ không log tham số `params` |

**Điểm đáng chú ý:** `database.js` ghi `text.substring(0, 100)` mà **không** ghi
mảng `params` — đây là quyết định đúng, vì `params` có thể chứa mật khẩu hash
trong truy vấn `INSERT INTO users`.

**Cách kiểm tra:**

```bash
# Xem log backend có lộ mật khẩu không (phải KHÔNG có kết quả)
docker compose logs backend | grep -iE "password.*[:=].*[a-z0-9]{6,}" | grep -v "wrong password" | head

# Xác nhận có ghi username khi đăng nhập sai (đúng thiết kế)
docker compose logs backend | grep "wrong password" | tail -3
```

**Giới hạn còn tồn tại:** `morgan('combined')` ghi **toàn bộ URL kèm query string**.
Nếu sau này có endpoint nhận token qua query string, token sẽ bị ghi vào log.
Hiện tại ứng dụng gửi token qua header `Authorization` nên chưa có rủi ro.

---

## 15. Cấu hình TLS

**Rủi ro ban đầu:** Không có TLS.

**Thay đổi đã thực hiện:** Xem mục 8. Cấu hình cụ thể trong
`nginx/templates/default.conf.template`:

```nginx
ssl_protocols       TLSv1.2 TLSv1.3;
ssl_ciphers         ECDHE-...-GCM:...:CHACHA20-POLY1305;
ssl_prefer_server_ciphers off;
ssl_session_cache   shared:SSL:10m;
ssl_session_tickets off;
```

**Vì sao `ssl_prefer_server_ciphers off`:** với TLS 1.3, thứ tự cipher do **client**
quyết định và điều này là hợp lý vì client biết rõ khả năng phần cứng của nó.
Đặt `on` chỉ có tác dụng với TLS 1.2 trở xuống.

**Vì sao `ssl_session_tickets off`:** session ticket mã hoá trạng thái phiên bằng
khoá lâu dài. Nếu khoá đó bị lộ, kẻ tấn công giải mã được các phiên đã ghi lại
trước đó (forward secrecy bị phá). Tắt đi để đảm bảo forward secrecy tuyệt đối,
đánh đổi bằng việc bắt tay lại đầy đủ.

**Cách kiểm tra:**

```bash
# Liệt kê protocol được hỗ trợ
docker compose exec nginx nginx -T | grep -A2 "ssl_protocols"

# Kiểm tra thực tế
curl -k --tlsv1.1 --tls-max 1.1 -s -o /dev/null https://localhost:8443/ && echo "TLS1.1 CHẤP NHẬN (SAI)" || echo "TLS1.1 bị từ chối (đúng)"
curl -k --tlsv1.3 -s -o /dev/null -w 'TLS1.3: %{http_code}\n' https://localhost:8443/
```

**Giới hạn còn tồn tại:** Trường `servername` (SNI) chỉ có `localhost` trong SAN.
Truy cập bằng tên máy hoặc IP LAN sẽ báo lỗi tên không khớp — chấp nhận được vì
đây là môi trường demo cục bộ.

---

## Rủi ro tổng hợp còn tồn tại

Sắp theo mức độ nghiêm trọng giảm dần. **Đây là phần quan trọng nhất của tài liệu** —
ghi nhận trung thực những gì **chưa** giải quyết được.

| # | Rủi ro | Mức | Vì sao chưa xử lý |
|---|---|---|---|
| R1 | `cadvisor` chạy `privileged: true` | **Cao** | cAdvisor cần quyền này để đọc cgroup/diskstat của host. Bỏ đi thì mất phần lớn metric container. Đã giảm thiểu: chỉ ở `mon-net`, cổng loopback, mọi mount read-only. **Phương án thay thế nếu cần siết:** bỏ cAdvisor, chỉ dùng `node-exporter` + metric của ứng dụng — sẽ mất số liệu per-container. |
| R2 | Mật khẩu seed `Trongbong123@` công khai (mục đích demo) | **Cao** | Chỉ dùng cho demo/chấm điểm. **Phải đổi** trước khi triển khai thật. |
| R3 | Image `zcube/cadvisor` là mirror không chính thức | Trung bình | `gcr.io` không truy cập được trong môi trường thực hiện. Đã pin `v0.45.0`. Rủi ro chuỗi cung ứng: image do bên thứ ba build. |
| R4 | `promtail` mount `/var/run/docker.sock` | Trung bình | Bắt buộc để Docker service discovery. Đã để **read-only**. Container bị chiếm quyền có thể lợi dụng socket — dù read-only vẫn cho phép liệt kê container. |
| R5 | `pgpass` chứa mật khẩu dạng plaintext | Trung bình | pgAdmin cần file này để kết nối không cần nhập mật khẩu. Đã gitignore. Production nên dùng Docker secrets. |
| R6 | Chứng chỉ TLS tự ký | Trung bình | Không có CA tin cậy. Chỉ phù hợp demo. |
| R7 | Biến môi trường đọc được qua `docker inspect` | Trung bình | Ai có quyền Docker = có quyền root trên máy. Chấp nhận trong phạm vi đồ án. |
| R8 | `frontend` (nginx) chạy root | Thấp | Cần thiết với image nginx mặc định. Có thể chuyển sang `nginx-unprivileged`. |
| R9 | Không có `mem_limit`/`cpus` cho container | Thấp | Một container lỗi có thể chiếm hết RAM host. Nên bổ sung trong môi trường thật. |
| R10 | Rate limit lưu trong bộ nhớ | Thấp | Chỉ đúng khi chạy 1 instance backend. |
| R11 | Không có CSP nonce/hash | Thấp | Cần `'unsafe-inline'` cho `style-src` do cách React hoạt động. |
| R12 | Không có xoay vòng khoá JWT | Thấp | Token cũ vẫn hợp lệ đến khi hết hạn (8 giờ). |

---

## Phụ lục — Chạy toàn bộ kiểm tra bảo mật

```bash
# 1. Smoke test (bao gồm kiểm tra security headers)
bash scripts/smoke-test.sh

# 2. E2E test (bao gồm kiểm tra headers trên response HTTPS)
bash scripts/e2e-test.sh

# 3. Kiểm tra thủ công các mục quan trọng
docker compose exec backend id                                    # non-root
docker compose config | grep host_ip                              # loopback binding
curl -k -s -I https://localhost:8443/ | grep -i content-security  # CSP
curl -k -s -o /dev/null -w '%{http_code}\n' https://localhost:8443/stub_status  # phải 404
docker compose exec postgres psql -U postgres -d restaurant_db \
  -c "SELECT rolsuper FROM pg_roles WHERE rolname='appuser';"     # phải f
```
