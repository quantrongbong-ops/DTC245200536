#!/bin/sh
# ============================================================
# Sinh chứng chỉ TLS tự ký cho môi trường demo.
#
# Được chạy bởi service `certgen` trong docker-compose (image alpine/openssl).
#
# Đặc tính:
#  - CHỈ sinh khi chưa có chứng chỉ => chạy lại compose không ghi đè,
#    không làm trình duyệt phải chấp nhận lại chứng chỉ mới.
#  - Đặt SAN cho cả `localhost` và `127.0.0.1` để truy cập bằng cả hai cách
#    đều không bị lỗi tên không khớp.
#  - Đây là chứng chỉ TỰ KÝ: trình duyệt sẽ cảnh báo. Không dùng cho production.
# ============================================================
set -eu

CERT_DIR="/certs"
CRT="$CERT_DIR/server.crt"
KEY="$CERT_DIR/server.key"

mkdir -p "$CERT_DIR"

if [ -f "$CRT" ] && [ -f "$KEY" ]; then
    echo ">>> Chứng chỉ đã tồn tại, bỏ qua. ($CRT)"
    # In thông tin ngắn gọn để dễ kiểm tra trong log
    openssl x509 -in "$CRT" -noout -subject -enddate 2>/dev/null || true
    exit 0
fi

echo ">>> Chưa có chứng chỉ, tiến hành sinh mới..."

openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
    -keyout "$KEY" \
    -out "$CRT" \
    -subj "/C=VN/ST=HCM/L=Ho Chi Minh/O=Nha Hang An Phuc/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Khoá riêng tư chỉ chủ sở hữu đọc được
chmod 600 "$KEY"
chmod 644 "$CRT"

echo ">>> Đã sinh chứng chỉ tự ký:"
openssl x509 -in "$CRT" -noout -subject -dates

exit 0
