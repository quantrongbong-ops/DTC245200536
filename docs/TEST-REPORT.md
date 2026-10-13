# BÁO CÁO KIỂM THỬ

**Dự án:** Hệ thống quản lý nhà hàng An Phúc (Order-New)
**Đề tài:** Đề 12 — Hệ thống quản lý nhà hàng / Order
**Ngày chạy kiểm thử:** 2026-10-13
**Môi trường:** Windows 11 Pro 26200, Docker 26.1.4, Docker Compose v2.27.1,
Node.js 24.21.0, PostgreSQL 16, Chrome/Edge (kiểm tra thủ công)

> **Nguyên tắc của báo cáo này:** mọi kết quả **PASS** đều đến từ lần chạy thật
> và có lệnh tái lập. Không có kết quả nào được suy đoán hay điền sẵn.
> Mục nào chưa chạy được ghi rõ **CHƯA XÁC MINH** kèm lý do.

---

## 1. Tổng hợp kết quả

| # | Bộ kiểm thử | Loại | Số test | PASS | FAIL | Trạng thái |
|---|---|---|---|---|---|---|
| 1 | `backend/tests/unit/money.test.js` | Unit | 21 | 21 | 0 | ✅ PASS |
| 2 | `backend/tests/unit/validation.test.js` | Unit | 21 | 21 | 0 | ✅ PASS |
| 3 | `backend/tests/auth.test.js` | Integration | — | — | 0 | ✅ PASS |
| 4 | `backend/tests/menu.test.js` | Integration | — | — | 0 | ✅ PASS |
| 5 | `backend/tests/orders.test.js` | Integration | — | — | 0 | ✅ PASS |
| 6 | `backend/tests/payments.test.js` | Integration | — | — | 0 | ✅ PASS |
| 7 | `backend/tests/tables.test.js` | Integration | — | — | 0 | ✅ PASS |
| 8 | `backend/tests/users.test.js` | Integration | — | — | 0 | ✅ PASS |
| 9 | `backend/tests/concurrency.test.js` | Concurrency | 7 | 7 | 0 | ✅ PASS |
| | **Tổng Jest** | | **101** | **101** | **0** | ✅ |
| 10 | `scripts/smoke-test.sh` | Smoke | 56 | 56 | 0 | ✅ PASS |
| 11 | `scripts/e2e-test.sh` | E2E | 41 | 41 | 0 | ✅ PASS |

**Lệnh tái lập:**

```bash
# Jest (unit + integration + concurrency)
docker compose --profile test up -d postgres-test
cd backend && npm test

# Smoke test (không ghi dữ liệu)
cd .. && bash scripts/smoke-test.sh

# E2E test (TẠO dữ liệu thật)
bash scripts/e2e-test.sh
```

**Kết quả độ phủ mã nguồn (coverage):**

| Chỉ số | Giá trị |
|---|---|
| Dòng (lines) | **69,12%** (730/1056) |
| Nhánh (branches) | **53,19%** (242/455) |

Các module lõi đạt 100%: `utils/money.js`, `utils/validation.js`, `utils/query.js`,
và toàn bộ 8 file khai báo route.

---

## 2. Kiểm thử đơn vị (Unit test)

**Đặc điểm:** không kết nối database, không gọi HTTP. Chạy độc lập được.

### 2.1. Logic tính tiền — `tests/unit/money.test.js` (21 test)

| # | Test case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 1 | Quy đổi số thập phân sang đơn vị nhỏ nhất | `12500.5 → 1250050` | PASS |
| 2 | Khử sai số dấu phẩy động | `0.1 → 10` (không phải `10.000000000000002`) | PASS |
| 3 | Làm tròn nửa-lên | `1.005 → 101` | PASS |
| 4 | Ném lỗi với giá trị không phải số | `TypeError` | PASS |
| 5 | Thành tiền = đơn giá × số lượng | `55000 × 2 = 110000` | PASS |
| 6 | Không tích luỹ sai số nhị phân | `0.1 × 3 = 0.3` chính xác | PASS |
| 7 | Đơn giá thập phân × số lượng lớn | `33333.33 × 3 = 99999.99` | PASS |
| 8 | Từ chối số lượng không nguyên | `RangeError` | PASS |
| 9 | Từ chối số lượng âm | `RangeError` | PASS |
| 10 | Cộng tổng nhiều dòng | 3 dòng → 315000 | PASS |
| 11 | Mảng rỗng → 0 | `0` | PASS |
| 12 | Tổng thập phân không sai số | `0.1 + 0.2 = 0.3` chính xác | PASS |
| 13 | Từ chối đầu vào không phải mảng | `TypeError` | PASS |
| 14 | Tổng sau chiết khấu | `315000 − 15000 = 300000` | PASS |
| 15 | Không trả về số âm | `1000 − 5000 → 0` | PASS |
| 16–21 | Các biến thể còn lại | — | PASS |

> **Vì sao quan trọng:** JavaScript dùng số thực dấu phẩy động nhị phân, không biểu diễn
> chính xác số thập phân. Với tiền tệ, sai số tích luỹ qua nhiều dòng. Module `money.js`
> tính trên **số nguyên đơn vị nhỏ nhất** rồi mới chia lại, nên phép cộng là chính xác tuyệt đối.

### 2.2. Logic kiểm tra dữ liệu đầu vào — `tests/unit/validation.test.js` (21 test)

| # | Test case | Kỳ vọng | Kết quả |
|---|---|---|---|
| 1 | Giá bằng 0 hợp lệ (món miễn phí) | chấp nhận | PASS |
| 2 | Giá âm bị từ chối | lỗi | PASS |
| 3 | Giá thiếu (undefined/null/'') | lỗi | PASS |
| 4 | Giá `'abc'` bị từ chối | lỗi | PASS |
| 5 | **Giá `'100abc'` bị từ chối** | lỗi | PASS |
| 6 | Giá `true`/`{}`/`[]` bị từ chối | lỗi | PASS |
| 7 | Giá vượt `NUMERIC(12,2)` bị từ chối | lỗi | PASS |
| 8 | Số lượng 0 bị từ chối | lỗi | PASS |
| 9 | Số lượng âm bị từ chối | lỗi | PASS |
| 10 | Số lượng thập phân bị từ chối | lỗi | PASS |
| 11 | Số lượng dạng chuỗi `'2'` bị từ chối | lỗi | PASS |
| 12 | Số lượng vượt giới hạn bị từ chối | lỗi | PASS |
| 13 | Chuỗi được cắt khoảng trắng | `'  Phở bò  ' → 'Phở bò'` | PASS |
| 14 | Tên rỗng/chỉ khoảng trắng bị từ chối | lỗi | PASS |
| 15 | Tên vượt `VARCHAR(150)` bị từ chối | lỗi | PASS |
| 16 | **`parsePositiveInt` không bao giờ trả `NaN`** | số nguyên trong [1,100] | PASS |
| 17–21 | Các biến thể còn lại | — | PASS |

> **Vì sao quan trọng:** test số 5 phát hiện vấn đề `parseFloat('100abc') === 100` —
> `parseFloat` âm thầm bỏ qua phần rác của chuỗi. Dùng `Number()` sẽ trả `NaN` và
> phát hiện được dữ liệu sai kiểu. Test số 16 bảo vệ chống lỗi `LIMIT NaN` (xem mục 6.4).

---

## 3. Kiểm thử tích hợp (Integration test)

**Đặc điểm:** gọi HTTP API thật qua Express, ghi/đọc **PostgreSQL thật** trên database
test riêng (`restaurant-test-net`, cổng 5433, tách hoàn toàn khỏi database nghiệp vụ).

### 3.1. Xác thực — `auth.test.js`

| Test case | Kỳ vọng | Kết quả |
|---|---|---|
| Đăng nhập bằng username đúng | 200 + JWT | PASS |
| Đăng nhập bằng email | 200 + JWT | PASS |
| Sai mật khẩu | 401 | PASS |
| Username không tồn tại | 401 (cùng thông báo với sai mật khẩu) | PASS |
| Thiếu trường bắt buộc | 400 | PASS |
| Truy cập endpoint bảo vệ không có token | 401 | PASS |
| Truy cập với token sai định dạng | 401 | PASS |
| Đổi mật khẩu sai mật khẩu hiện tại | 400 | PASS |

### 3.2. Quản lý món ăn — `menu.test.js`

| Test case | Kỳ vọng | Kết quả |
|---|---|---|
| Danh sách món có phân trang | 200 + `pagination` | PASS |
| Lọc theo danh mục | chỉ món thuộc danh mục | PASS |
| Tìm kiếm theo tên (không phân biệt hoa thường) | đúng kết quả | PASS |
| Tạo món hợp lệ | 201 | PASS |
| Tạo món với danh mục không tồn tại | 400 | PASS |
| Tạo món với giá âm | 400 | PASS |
| Tạo món với tên rỗng | 400 | PASS |
| `?limit=abc` (dữ liệu sai kiểu) | 200, dùng giá trị mặc định — **không 500** | PASS |
| Ẩn/hiện món | 200 | PASS |
| Xóa món đã có trong đơn | 409 | PASS |

### 3.3. Quản lý đơn hàng — `orders.test.js`

| Test case | Kỳ vọng | Kết quả |
|---|---|---|
| Tạo đơn rỗng | 400 | PASS |
| Tạo đơn với bàn không tồn tại | 404 | PASS |
| Tạo đơn với số lượng 0 | 400 | PASS |
| **Tạo đơn — giá lấy từ DB, bỏ qua giá client gửi** | `total = 55000 × 2` dù client gửi giá 1đ | PASS |
| Bàn sau khi tạo đơn là `occupied` → tạo đơn nữa | 409 | PASS |
| Chi tiết đơn có đủ danh sách món | 200 | PASS |
| Thêm món → tổng tiền tính lại | 201 + đúng tổng | PASS |
| Thêm món vào đơn đã hủy | 409 | PASS |
| Đổi trạng thái đơn đã hủy | 409 | PASS |
| Cập nhật trạng thái món (2 dạng route) | 200 | PASS |
| Món chuyển `preparing` → đơn tự chuyển `preparing` | 200 | PASS |
| Bỏ món cuối cùng | 400 | PASS |
| Bỏ món → tổng tiền tính lại đúng | 70000 | PASS |

### 3.4. Bàn ăn — `tables.test.js`

| Test case | Kỳ vọng | Kết quả |
|---|---|---|
| Danh sách bàn, lọc theo trạng thái/khu vực | 200 | PASS |
| Tạo bàn trùng số bàn | 409 | PASS |
| Tạo bàn với sức chứa ≤ 0 | 400 | PASS |
| **Chặn đổi bàn về `available` khi còn đơn hoạt động** | 409 | PASS |
| Xóa bàn đang có đơn hoạt động | 409 | PASS |
| Chuyển bàn sang bàn đang có khách | 400 | PASS |
| Xem đơn hiện tại của bàn | 200 | PASS |

### 3.5. Thanh toán — `payments.test.js`

| Test case | Kỳ vọng | Kết quả |
|---|---|---|
| Thanh toán đơn chưa phục vụ | 409 | PASS |
| Thanh toán đơn hợp lệ | 201 + đơn `completed` + bàn `available` | PASS |
| Thanh toán lần hai | 409 | PASS |
| `?from=khong-phai-ngay` (ngày sai định dạng) | 400 — **không 500** | PASS |
| Lịch sử thanh toán kèm tổng doanh thu | 200 | PASS |

### 3.6. Người dùng — `users.test.js`

| Test case | Kỳ vọng | Kết quả |
|---|---|---|
| Danh sách người dùng (admin) | 200, **không trả trường `password`** | PASS |
| Tạo người dùng trùng username | 409 | PASS |
| Tạo người dùng với email sai định dạng | 400 | PASS |
| Tạo người dùng với vai trò không hợp lệ | 400 | PASS |
| **Nhân viên (`staff`) truy cập API quản lý người dùng** | 403 | PASS |
| Xóa tài khoản đang đăng nhập | 409 | PASS |

---

## 4. Kiểm thử đồng thời (Concurrency test)

**Đặc điểm:** gửi nhiều request **cùng lúc** bằng `Promise.all`, sau đó đối chiếu kết quả
ở **tầng PostgreSQL** bằng truy vấn trực tiếp. Đây là nhóm test chứng minh hệ thống
không chỉ dựa vào kiểm tra phía giao diện.

| # | Tình huống | Cách kiểm chứng | Kết quả |
|---|---|---|---|
| 1 | **5 request mở đơn đồng thời cho cùng một bàn** | Đếm số response `201` và `409`, rồi đếm đơn hoạt động trong DB | ✅ **đúng 1 thành công, 4 bị chặn 409**, DB có đúng 1 đơn |
| 2 | **4 request thanh toán đồng thời cho cùng một đơn** | Đếm bản ghi `payments` trong DB | ✅ **đúng 1 bản ghi** được tạo |
| 3 | **8 request thêm món đồng thời vào cùng một đơn** | Đếm `order_items` và so tổng tiền | ✅ **9 dòng** (1 ban đầu + 8), tổng tiền = 9 × 55000 = **495000**, khớp `SUM(subtotal)` |
| 4 | Mở đơn và đổi bàn về trống chạy song song | Kiểm tra bất biến sau khi cả hai xong | ✅ Không bao giờ có bàn `available` mà vẫn còn đơn hoạt động |
| 5 | Chèn 2 bản ghi `payments` cùng `order_id` ở mức DB | Bắt mã lỗi PostgreSQL | ✅ Lỗi **23505** (unique_violation) |
| 6 | Chèn `order_items` với `quantity = 0` ở mức DB | Bắt mã lỗi PostgreSQL | ✅ Lỗi **23514** (check_violation) |
| 7 | Chèn `orders` trỏ tới `table_id` không tồn tại | Bắt mã lỗi PostgreSQL | ✅ Lỗi **23503** (foreign_key_violation) |

**Cơ chế bảo vệ đã kiểm chứng:**

| Tình huống | Cơ chế |
|---|---|
| Hai đơn cùng một bàn | `SELECT ... FOR UPDATE` trên hàng `dining_tables` trong transaction |
| Thanh toán hai lần | `SELECT ... FOR UPDATE` trên hàng `orders` + ràng buộc `UNIQUE` trên `payments.order_id` |
| Mất dòng khi thêm món đồng thời | `SELECT ... FOR UPDATE` trên đơn + tính lại tổng từ `order_items` |
| Bàn trống nhưng còn đơn | Transaction + `FOR UPDATE` trong `table.controller.updateStatus` |

---

## 5. Kiểm thử E2E — luồng nghiệp vụ đầy đủ (`scripts/e2e-test.sh`)

**Đặc điểm:** đi từ **Nginx → backend → PostgreSQL**, qua HTTPS thật, có kiểm tra
security headers và metrics. **Bài test này TẠO DỮ LIỆU THẬT.**

**Kết quả: 41 PASS / 0 FAIL**

| Bước | Nội dung | Kết quả |
|---|---|---|
| 1 | Đăng nhập qua HTTPS qua Nginx | ✅ 224 ký tự JWT |
| 2 | Tạo danh mục + món ăn (giá 12500.50) | ✅ |
| 2b | **Kiểm tra UTF-8 round-trip** (tên chứa ký tự `ó`) | ✅ `octet_length − char_length = 1` |
| 3 | Validation: giá âm, giá `'abc'`, tên rỗng, giá vượt giới hạn | ✅ cả 4 trả `400` |
| 4 | Tạo bàn, tạo trùng số bàn | ✅ `409` |
| 5 | Mở đơn cho bàn trống | ✅ mã đơn `DH...` |
| 5b | Tổng tiền = 2 × 12500.50 = **25001.00** | ✅ |
| 5c | Mở đơn thứ hai trên cùng bàn | ✅ bị chặn |
| 5d | `items` gửi dạng chuỗi (sai kiểu) | ✅ `400` — **không phải 500** |
| 6 | Bàn chuyển sang `occupied` | ✅ |
| 6b | Đổi bàn về `available` khi còn đơn | ✅ `409` |
| 7 | Thêm 1 món → tổng = **37501.50** | ✅ |
| 7b | Số lượng `0` và `-5` | ✅ cả hai `400` |
| 8 | Ẩn món → không thêm được vào đơn | ✅ `400` |
| 8b | Món đã ẩn **vẫn còn** trong đơn cũ | ✅ |
| 9 | Chuyển trạng thái `confirmed → preparing → ready → served` | ✅ cả 4 bước |
| 10 | Thanh toán bằng tiền mặt | ✅ |
| 10b | Thanh toán lần hai | ✅ `409` |
| 10c | Thêm món vào đơn đã hoàn thành | ✅ `409` |
| 11 | Bàn trở về `available` sau thanh toán | ✅ |
| 12 | **Đối chiếu PostgreSQL:** `total_amount` = 37501.50 khớp API | ✅ |
| 12b | `order_items` có đúng 2 dòng | ✅ |
| 12c | `SUM(subtotal)` khớp `orders.total_amount` | ✅ |
| 12d | Đúng 1 bản ghi `payments` trạng thái `completed` | ✅ |
| 13 | `restaurant_orders_created_total` tăng | ✅ |
| 13b | `restaurant_revenue_total` = 37501.5 (cộng dồn) | ✅ |
| 13c | `restaurant_http_requests_total` ghi nhận request | ✅ |
| 14 | Log của backend xuất hiện trong Loki | ✅ |
| 15 | Security headers còn nguyên trên HTTPS | ✅ CSP, HSTS, XCTO |

---

## 6. Kiểm thử hạ tầng (Smoke test — `scripts/smoke-test.sh`)

**Kết quả: 56 PASS / 0 FAIL.** Bài test này **chỉ đọc**, không ghi dữ liệu nghiệp vụ.

### 6.1. Docker Compose

| Kiểm tra | Kết quả |
|---|---|
| `docker compose config --quiet` hợp lệ | ✅ |
| 12 service đang chạy | ✅ |
| `postgres`, `backend`, `frontend`, `nginx`, `pgadmin`, `prometheus`, `grafana`, `loki`, `promtail`, `cadvisor`, `postgres-exporter`, `nginx-exporter` — tất cả `healthy` | ✅ |
| Volume lưu bền tồn tại (`postgres-data`, `grafana-data`, `prometheus-data`, `loki-data`) | ✅ |
| `certgen` chạy xong và thoát (exit 0) | ✅ |

### 6.2. Nginx và HTTPS

| Kiểm tra | Kết quả thực tế |
|---|---|
| HTTP :8083 chuyển hướng sang HTTPS | ✅ `301 → https://localhost:8443/` |
| HTTPS :8443 trả trang chủ | ✅ `200` |
| `/healthz` phản hồi | ✅ `200` |
| Tài nguyên tĩnh `index-*.js` | ✅ `200`, `application/javascript`, 209844 byte |
| Tài nguyên tĩnh `index-*.css` | ✅ `200`, `text/css`, 61102 byte |
| Tài nguyên tĩnh `vendor-*.js` | ✅ `200`, `application/javascript`, 164319 byte |
| Tài nguyên tĩnh `charts-*.js` | ✅ `200`, `application/javascript`, 383853 byte |
| `/logo.svg` (favicon) | ✅ `200`, `image/svg+xml`, 1206 byte |
| Ảnh món ăn `/images/goi-cuon.jpg` (chưa có file) | ✅ `404` — **báo đúng, không giả `200`** |
| Route SPA không tồn tại `/khong-ton-tai-xyz` | ✅ `200` + `index.html` (đúng cho SPA) |
| `/api/v1/menu-items` không token | ✅ `401` + `application/json` — chứng minh `/api/` được route tới backend, **không bị SPA fallback nuốt** |

### 6.3. Security headers

| Header | Kết quả |
|---|---|
| `Content-Security-Policy` | ✅ có mặt |
| `Strict-Transport-Security` | ✅ `max-age=86400` |
| `X-Content-Type-Options` | ✅ `nosniff` |
| `X-Frame-Options` | ✅ `SAMEORIGIN` |
| `Referrer-Policy` | ✅ `strict-origin-when-cross-origin` |
| `Permissions-Policy` | ✅ có mặt |
| `server_tokens` đã tắt | ✅ không lộ phiên bản Nginx |
| CSP **không** cấp `unsafe-eval` | ✅ |

### 6.4. PostgreSQL và pgAdmin

| Kiểm tra | Kết quả thực tế |
|---|---|
| Kết nối PostgreSQL từ container | ✅ |
| Schema có đủ 7 bảng | ✅ 7/7 |
| `appuser` **không** phải superuser | ✅ `rolsuper = f` |
| `payments` có ràng buộc `UNIQUE` | ✅ |
| pgAdmin UI trả về | ✅ `200` |

### 6.5. Prometheus — target

Kiểm tra bằng truy vấn `up{job="..."}` (giá trị `1` = UP):

| Job | Target | Kết quả |
|---|---|---|
| `prometheus` | `localhost:9090` | ✅ UP |
| `backend` | `backend:3001` | ✅ UP |
| `postgres-exporter` | `postgres-exporter:9187` | ✅ UP |
| `nginx-exporter` | `nginx-exporter:9113` | ✅ UP |
| `cadvisor` | `cadvisor:8080` | ✅ UP |
| **Tổng** | `sum(up)` | ✅ **5** |

### 6.6. Loki và Promtail

| Kiểm tra | Kết quả thực tế |
|---|---|
| Loki `/ready` | ✅ ready |
| Promtail phản hồi HTTP 200 | ✅ |
| Loki có nhãn `service` | ✅ |
| **Số service được thu log** | ✅ **12**: `backend`, `cadvisor`, `frontend`, `grafana`, `loki`, `nginx`, `nginx-exporter`, `pgadmin`, `postgres`, `postgres-exporter`, `prometheus`, `promtail` |

---

## 7. Kiểm thử giám sát (Prometheus + Grafana + Loki)

### 7.1. Grafana provisioning

| Kiểm tra | Kết quả thực tế |
|---|---|
| Datasource `Prometheus` (uid=`prometheus` → `http://prometheus:9090`) | ✅ load thành công |
| Datasource `Loki` (uid=`loki` → `http://loki:3100`) | ✅ load thành công |
| Dashboard `restaurant-overview` trong thư mục `Restaurant` | ✅ load thành công |
| Số panel dữ liệu | 15 panel trong 5 nhóm |
| Số truy vấn PromQL trong dashboard | 21 |
| **Grafana → Prometheus chạy được truy vấn thật** (`sum(up)`) | ✅ trả về **5** |
| **Grafana → Loki chạy được truy vấn thật** | ✅ trả về danh sách 12 service |

### 7.2. Truy vấn PromQL đã xác minh có dữ liệu

Mỗi metric dưới đây đã được kiểm tra tồn tại **và có dữ liệu thật** trên hệ thống:

| Truy vấn | Số series | Nguồn |
|---|---|---|
| `sum(up)` | → 5 | Prometheus |
| `restaurant_http_requests_total` | 13 | Ứng dụng |
| `restaurant_http_request_duration_seconds_bucket` | — | Ứng dụng (histogram) |
| `restaurant_active_connections` | 1 | Ứng dụng |
| `restaurant_orders_created_total` | 1 | Ứng dụng |
| `restaurant_revenue_total` | 1 | Ứng dụng |
| `restaurant_api_process_resident_memory_bytes` | 1 | Ứng dụng (default metrics) |
| `restaurant_api_nodejs_heap_size_used_bytes` | 1 | Ứng dụng (default metrics) |
| `restaurant_api_nodejs_eventloop_lag_mean_seconds` | 1 | Ứng dụng (default metrics) |
| `container_cpu_usage_seconds_total{name=~"restaurant-.*"}` | 13 | cAdvisor |
| `container_memory_usage_bytes{name=~"restaurant-.*"}` | 13 | cAdvisor |
| `pg_up` | 1 | postgres-exporter |
| `pg_stat_database_numbackends` | 4 | postgres-exporter |
| `pg_database_size_bytes` | 4 | postgres-exporter |
| `nginx_http_requests_total` | 1 | nginx-exporter |
| `nginx_connections_active` | 1 | nginx-exporter |

> **Lưu ý phân biệt nguồn metric:** tiền tố `restaurant_*` là metric do **ứng dụng tự phát**
> (prom-client). Tiền tố `pg_*` do **postgres-exporter** đọc từ database. Tiền tố
> `container_*` do **cAdvisor** đọc từ cgroup. Tiền tố `nginx_*` do
> **nginx-prometheus-exporter** đọc từ `stub_status`.

### 7.3. Truy vấn LogQL đã xác minh

| Truy vấn | Kết quả |
|---|---|
| `{service="backend"}` | ✅ trả về log |
| `{service="postgres"}` | ✅ trả về log |
| `{service="nginx"}` | ✅ trả về log |
| `{service="backend"} \|~ "(?i)error\|unhandled\|exception"` | ✅ truy vấn chạy được |
| `sum by (service) (count_over_time({job="restaurant"} \|~ "(?i)error" [1h]))` | ✅ truy vấn chạy được |
| Liệt kê nhãn `service` | ✅ 12 giá trị |

---

## 8. Lỗi phát hiện trong quá trình kiểm thử và đã sửa

| # | Lỗi | Cách phát hiện | Mức | Trạng thái |
|---|---|---|---|---|
| 1 | `revenueTotal` là **Gauge** và dùng `.set()` → doanh thu chỉ bằng đơn cuối cùng | Đọc mã nguồn `metrics.js` + `order.controller.js` | HIGH | ✅ Sửa: đổi thành **Counter** + `.inc()` |
| 2 | **Doanh thu không được ghi nhận khi thanh toán** — `.inc()` chỉ có trong `updateStatus`, nhưng luồng thanh toán đặt `status='completed'` bằng SQL trực tiếp | **E2E test** (metric = 0 sau khi thanh toán thành công) | HIGH | ✅ Sửa: tách hàm `recordCompletedOrder()`, gọi từ cả hai controller |
| 3 | PUT menu-item thiếu `price` → `parseFloat(undefined) = NaN` → **lưu NaN vào cột giá** | Đọc mã nguồn, phân tích nhánh `price !== undefined` | HIGH | ✅ Sửa: bắt buộc có `price`, dùng `Number()` |
| 4 | `?limit=abc` → `LIMIT NaN` → lỗi SQL → HTTP **500** | Truy vết `parseInt` + `Math.min` trong 3 controller | MEDIUM | ✅ Sửa: helper `parsePositiveInt()` |
| 5 | `items` không phải mảng → `items.map is not a function` → HTTP **500** thay vì 400 | Đọc `order.controller.js` | MEDIUM | ✅ Sửa: thêm `Array.isArray()` |
| 6 | `?from=khong-phai-ngay` → PostgreSQL lỗi 22007 → HTTP **500** | Đọc `payment.controller.js` | MEDIUM | ✅ Sửa: kiểm tra `new Date()` hợp lệ |
| 7 | Đổi trạng thái bàn **không** nằm trong transaction → race condition | Đọc `table.controller.js` | MEDIUM | ✅ Sửa: bọc transaction + `FOR UPDATE` |
| 8 | **`stub_status` bị lộ ra Internet** — quy tắc `allow 172.16.0.0/12` luôn khớp với request từ ngoài do NAT của Docker | Phân tích quy tắc `allow/deny` | HIGH | ✅ Sửa: chuyển sang cổng nội bộ 8081, không publish |
| 9 | Cổng pgAdmin/Grafana/Prometheus/cAdvisor bind `0.0.0.0` → lộ ra mạng LAN | Đọc `docker-compose.yml` | HIGH | ✅ Sửa: bind `127.0.0.1` |
| 10 | **SPA fallback trả HTTP 200 kèm HTML cho file tĩnh thiếu** | Kiểm tra content-type của `/logo.svg` | MEDIUM | ✅ Sửa: thêm location regex trả `404` thật |
| 11 | `/logo.svg` không tồn tại (favicon lỗi) | Đọc `index.html` + kiểm tra `frontend/public/` | LOW | ✅ Sửa: tạo file logo SVG |
| 12 | Hàm chết `handlePayment` gọi biến không tồn tại `payMethod`, `setShowPayment` | Khảo sát giao diện | MEDIUM | ✅ Sửa: xóa hàm và import thừa |
| 13 | Chuông thông báo hiện **số 3 giả** trước khi tải xong | Khảo sát giao diện | LOW | ✅ Sửa: đổi `useState(3)` → `useState(0)` |
| 14 | `backups/` chứa dump database **không** nằm trong `.gitignore` | Đọc `.gitignore` | HIGH | ✅ Sửa: bổ sung `backups/`, `*.dump`, `nginx/certs/` |
| 15 | Container `nginx`, `frontend` **unhealthy** — healthcheck gọi `localhost` nhưng dịch vụ chỉ nghe IPv4, mà `localhost` phân giải thành `::1` | Đọc log healthcheck, kiểm chứng bằng `getent hosts localhost` và `netstat` | HIGH | ✅ Sửa: thêm listener IPv6 + đổi healthcheck sang `127.0.0.1` |
| 16 | Container `promtail` **unhealthy** — healthcheck dùng `wget` nhưng image không có `wget` | Đọc log: `wget: not found` | HIGH | ✅ Sửa: dùng `/dev/tcp` của bash |
| 17 | **BuildKit builder hỏng** (`STATUS=error`) sau khi ổ đĩa từng đầy → build treo vô hạn | `docker buildx ls` hiện `error` | HIGH | ✅ Khắc phục: `wsl --shutdown` + khởi động lại Docker Desktop; ghi vào README |
| 18 | Grafana **không có dashboard nào** và thiếu datasource Loki | Đọc `docker/grafana/provisioning/` | HIGH | ✅ Sửa: thêm provider + dashboard JSON (21 truy vấn) + datasource Loki |
| 19 | **Test database không tồn tại** trong compose → `npm test` không chạy được | Đọc `tests/setup-env.js` so với compose | HIGH | ✅ Sửa: thêm service `postgres-test` (profile `test`, mạng riêng) |

### 8.1. Ba lỗi do chính bộ test mắc phải (đã sửa, ghi để minh bạch)

Trong lần chạy đầu, một số FAIL **không phải lỗi hệ thống mà là lỗi của script test**:

| # | Biểu hiện | Nguyên nhân thật | Cách sửa |
|---|---|---|---|
| T1 | `metric 'restaurant_process_cpu_user_seconds_total' KHÔNG có mặt` | Sai tên: metric mặc định của prom-client có tiền tố `restaurant_api_` | Sửa tên trong test |
| T2 | `metric '..._bucket' KHÔNG có mặt` | Histogram không có dòng `# HELP ..._bucket` riêng, chỉ có dòng dữ liệu | Sửa hàm kiểm tra để chấp nhận cả hai dạng |
| T3 | `Prometheus target 'X' không UP` | Logic phân tích JSON bằng `grep` quá giòn | Chuyển sang endpoint `/api/v1/query?query=up{job="X"}` |
| T4 | `/metrics` không có metric nào | Test gọi qua Nginx, nhưng `/metrics` **cố ý không được reverse proxy** (đúng về bảo mật) | Đổi sang lấy qua mạng nội bộ Docker |
| T5 | Tên món bị `Món` → `M�n` | **Git Bash trên Windows mã hoá chuỗi theo CP1258, không phải UTF-8** | Dùng JSON unicode escape (`ó`) |

> **Điểm T5 rất đáng lưu ý.** Ban đầu tưởng đây là lỗi encoding của ứng dụng.
> Đã kiểm chứng bằng cách so sánh codepoint thật của dữ liệu API trả về:
> `Gỏi cuốn` = `U+1ECF ...` và `Phở bò` = `U+1EDF` — **hoàn toàn đúng UTF-8**.
> Chỉ những bản ghi do script test tạo ra bị hỏng. Kết luận: **ứng dụng đúng,
> script test sai**. Từ đó bổ sung kiểm tra UTF-8 round-trip thật sự trong E2E
> (so `octet_length` với `char_length` ở tầng database).

---

## 9. Kết quả chưa xác minh (ghi nhận trung thực)

| # | Hạng mục | Lý do chưa xác minh | Cách tự kiểm tra |
|---|---|---|---|
| 1 | **Kiểm thử giao diện bằng trình duyệt thật** (Playwright/Selenium) | Chưa cài Playwright trong môi trường. Các kiểm tra giao diện mới ở mức tải được trang và tài nguyên tĩnh | `npx playwright test` sau khi cài, hoặc kiểm tra thủ công theo `docs/DEMO-CHECKLIST.md` bước 5 |
| 2 | **Hình ảnh món ăn hiển thị** | Ảnh chưa được cung cấp; Nginx trả `404` đúng | Bổ sung ảnh vào `frontend/public/images/` |
| 3 | **Phục hồi dữ liệu từ bản sao lưu** | Chưa thực hiện `pg_restore` thật để tránh ghi đè database đang dùng | `docker compose exec -T postgres pg_restore -l < file.dump` để xem trước |
| 4 | **Kiểm thử tải (load test)** | Ngoài phạm vi đề tài | Dùng `k6` hoặc `autocannon` |
| 5 | **Quét lỗ hổng image (Trivy/Grype)** | Chưa cài công cụ | `trivy image restaurant-backend:1.0.0` |
| 6 | **TLS 1.0/1.1 bị từ chối** | Đã cấu hình `ssl_protocols TLSv1.2 TLSv1.3` nhưng chưa chạy `curl --tlsv1.0` để xác nhận | `curl -k --tlsv1.0 --tls-max 1.0 https://localhost:8443/` (kỳ vọng: thất bại) |
| 7 | **Rate limiting trả 429** | Chưa chạy 25 lần đăng nhập sai liên tiếp | Xem `docs/HARDENING.md` mục 11 |
| 8 | **Kiểm tra giao diện trên điện thoại** | Chưa chụp ở kích thước màn hình nhỏ | DevTools → chế độ thiết bị di động |

---

## 10. Bảng tổng hợp PASS / FAIL / BLOCKED / NOT TESTED

| Trạng thái | Số lượng | Ghi chú |
|---|---|---|
| **PASS** | 198 | 101 Jest + 56 smoke + 41 E2E |
| **FAIL** | 0 | — |
| **BLOCKED** | 0 | Không còn mục nào bị chặn |
| **NOT TESTED** | 8 | Liệt kê ở mục 9, có lý do và cách tự kiểm tra |

---

## 11. Kết luận

1. **Toàn bộ 198 bài kiểm thử đều PASS**, không có FAIL và không còn mục nào bị chặn.

2. **Các quy tắc nghiệp vụ quan trọng đã được chứng minh ở tầng database**, không chỉ
   ở tầng giao diện: giá luôn lấy từ DB, không thể mở hai đơn trên cùng một bàn,
   không thể thanh toán hai lần, không thể bán món đã ngừng kinh doanh.

3. **Kiểm thử đồng thời đã chứng minh** hệ thống chịu được tranh chấp: 5 request mở đơn
   cùng lúc chỉ 1 thành công; 4 request thanh toán cùng lúc chỉ tạo 1 bản ghi.

4. **19 lỗi đã được phát hiện và sửa**, trong đó có những lỗi nghiêm trọng mà kiểm thử
   thủ công qua giao diện **không thể** phát hiện:
   - Doanh thu không được ghi nhận khi thanh toán (lỗi chỉ lộ ra khi chạy E2E và đối chiếu metric)
   - `stub_status` bị lộ ra Internet (lỗi logic của quy tắc `allow`, không phải lỗi cấu hình)
   - Giá món ăn có thể bị lưu thành `NaN` (PostgreSQL chấp nhận `NaN` cho kiểu `NUMERIC`)

5. **8 hạng mục chưa kiểm thử** đã được ghi rõ kèm lý do và lệnh để tự kiểm tra,
   không đánh dấu PASS cho những gì chưa chạy.
