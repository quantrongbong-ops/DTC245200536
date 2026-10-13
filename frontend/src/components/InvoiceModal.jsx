import { useState, useRef, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { paymentService, orderService } from '../services/api'
import { formatCurrency, formatDateTime, getPaymentMethodLabel } from '../utils/helpers'

export default function InvoiceModal({
  isOpen,
  order,
  onClose,
  onPaymentSuccess,
  isPaid = false,
  paymentInfo = null,
  onViewDashboard = null,
}) {
  const [method, setMethod] = useState(paymentInfo?.method || 'cash')
  const [cashGiven, setCashGiven] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [paidState, setPaidState] = useState(isPaid)
  const [recentPayment, setRecentPayment] = useState(paymentInfo)
  const [showSuccessScreen, setShowSuccessScreen] = useState(false)
  const printRef = useRef(null)

  useEffect(() => {
    setPaidState(isPaid)
    setRecentPayment(paymentInfo)
    setMethod(paymentInfo?.method || 'cash')
    setCashGiven('')
    setNote('')
    setShowSuccessScreen(false)
  }, [isPaid, paymentInfo, order])

  if (!isOpen || !order) return null

  const totalAmount = parseFloat(order.total_amount || order.subtotal || 0)
  const numericCashGiven = parseFloat(cashGiven) || 0
  const changeAmount = numericCashGiven >= totalAmount ? numericCashGiven - totalAmount : 0

  // Đề xuất tiền mặt chẵn
  const quickCashOptions = [
    totalAmount,
    Math.ceil(totalAmount / 50000) * 50000,
    Math.ceil(totalAmount / 100000) * 100000,
    500000,
    1000000,
  ].filter((val, idx, arr) => val >= totalAmount && arr.indexOf(val) === idx)

  // In hóa đơn
  const handlePrint = () => {
    window.print()
  }

  // Xử lý ấn thanh toán
  const handleConfirmPayment = async () => {
    if (submitting) return
    try {
      setSubmitting(true)

      // Kiểm tra trạng thái đơn: nếu chưa là 'served' hoặc 'ready', cập nhật lên 'served' để backend cho phép thanh toán
      if (!['served', 'ready'].includes(order.status)) {
        try {
          await orderService.updateStatus(order.id, 'served')
        } catch {
          // Bỏ qua nếu đã ở trạng thái khác
        }
      }

      const res = await paymentService.create({
        order_id: order.id,
        method,
        note: note.trim() || undefined,
      })

      const paymentData = res.data?.data || {
        order_id: order.id,
        amount: totalAmount,
        method,
        paid_at: new Date().toISOString(),
      }

      setPaidState(true)
      setRecentPayment(paymentData)
      setShowSuccessScreen(true)
      toast.success('🎉 Thanh toán đơn hàng thành công!')

      if (onPaymentSuccess) {
        onPaymentSuccess(paymentData)
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi khi xử lý thanh toán'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // VietQR URL mẫu
  const vietQrUrl = `https://img.vietqr.io/image/MB-0901234567-compact2.png?amount=${Math.round(
    totalAmount
  )}&addInfo=${encodeURIComponent('TT ' + (order.order_code || order.id))}&accountName=NHA%20HANG%20AN%20PHUC`

  return (
    <div className="invoice-modal-overlay">
      <div className="invoice-modal-container">
        {/* Nút đóng modal */}
        <button className="invoice-modal-close" onClick={onClose} title="Đóng">
          ✕
        </button>

        {/* Màn hình thông báo thanh toán thành công */}
        {showSuccessScreen ? (
          <div className="invoice-success-screen">
            <div className="success-icon-badge">✅</div>
            <h2 className="success-title">Thanh toán hoàn tất!</h2>
            <p className="success-subtitle">
              Đơn hàng <strong>{order.order_code}</strong> (Bàn {order.table_number}) đã được thanh toán thành công.
            </p>

            <div className="success-summary-box">
              <div className="summary-row">
                <span>Số tiền thanh toán:</span>
                <span className="summary-amount">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="summary-row">
                <span>Phương thức:</span>
                <span className="badge badge-success">{getPaymentMethodLabel(method)}</span>
              </div>
              {method === 'cash' && numericCashGiven > 0 && (
                <>
                  <div className="summary-row">
                    <span>Khách đưa:</span>
                    <span>{formatCurrency(numericCashGiven)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Tiền thối lại:</span>
                    <span className="text-success font-bold">{formatCurrency(changeAmount)}</span>
                  </div>
                </>
              )}
              <div className="summary-row">
                <span>Thời gian:</span>
                <span>{formatDateTime(recentPayment?.paid_at || new Date().toISOString())}</span>
              </div>
            </div>

            <div className="success-actions">
              <button className="btn btn-secondary" onClick={handlePrint}>
                🖨️ In hóa đơn ngay
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onClose()
                  if (onViewDashboard) onViewDashboard()
                }}
              >
                📊 Xem Dashboard Doanh thu
              </button>
            </div>
          </div>
        ) : (
          <div className="invoice-modal-content">
            {/* Cột trái: Hóa đơn thanh toán (Bill receipt) */}
            <div className="invoice-receipt-wrapper">
              <div className="invoice-paper" ref={printRef} id="printable-invoice">
                {/* Header nhà hàng */}
                <div className="receipt-header">
                  <div className="receipt-logo">🍜 NHÀ HÀNG AN PHÚ</div>
                  <p className="receipt-slogan">Ẩm Thực Tinh Hoa & Truyền Thống</p>
                  <p className="receipt-info">Đ/C: Tầng 1-2, Tòa Nhà Landmark, Hà Nội</p>
                  <p className="receipt-info">Hotline: 0901 234 567 • Wifi: AnPhuc_VIP (Pass: 88888888)</p>
                  <div className="receipt-divider-dashed" />
                  <h3 className="receipt-title">
                    {paidState ? 'HÓA ĐƠN BÁN HÀNG' : 'PHIẾU TẠM TÍNH / HÓA ĐƠN'}
                  </h3>
                </div>

                {/* Thông tin đơn */}
                <div className="receipt-meta">
                  <div className="meta-col">
                    <div>
                      <strong>Số HĐ:</strong> {order.order_code || `#${order.id}`}
                    </div>
                    <div>
                      <strong>Bàn:</strong> Bàn {order.table_number} ({order.area || 'Khu vực chính'})
                    </div>
                    <div>
                      <strong>Thu ngân:</strong> {order.staff_name || 'Thu ngân'}
                    </div>
                  </div>
                  <div className="meta-col text-right">
                    <div>
                      <strong>Giờ vào:</strong> {formatDateTime(order.created_at)}
                    </div>
                    <div>
                      <strong>Giờ in:</strong> {formatDateTime(new Date())}
                    </div>
                    <div>
                      <strong>Trạng thái:</strong>{' '}
                      <span className={paidState ? 'text-success font-bold' : 'text-accent font-bold'}>
                        {paidState ? 'ĐÃ THANH TOÁN' : 'CHỜ THANH TOÁN'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="receipt-divider-dashed" />

                {/* Danh sách món ăn */}
                <table className="receipt-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Tên món</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>SL</th>
                      <th style={{ width: '20%', textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ width: '20%', textAlign: 'right' }}>T.Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items && order.items.length > 0 ? (
                      order.items.map((it, idx) => (
                        <tr key={it.id || idx}>
                          <td>
                            <div className="item-name">{it.name || it.item_name}</div>
                            {it.note && <div className="item-note">({it.note})</div>}
                          </td>
                          <td style={{ textAlign: 'center' }}>{it.quantity}</td>
                          <td style={{ textAlign: 'right' }}>
                            {formatCurrency(it.unit_price).replace('₫', '')}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(it.subtotal || it.unit_price * it.quantity).replace('₫', '')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '12px', color: '#9ca3af' }}>
                          Chi tiết các món ăn theo đơn
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="receipt-divider-dashed" />

                {/* Tổng thanh toán */}
                <div className="receipt-totals">
                  <div className="totals-row">
                    <span>Cộng tiền hàng:</span>
                    <span>{formatCurrency(order.subtotal || totalAmount)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="totals-row text-success">
                      <span>Giảm giá / Voucher:</span>
                      <span>-{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="totals-row">
                    <span>Thuế VAT (0%):</span>
                    <span>0đ</span>
                  </div>
                  <div className="receipt-grand-total">
                    <span>TỔNG THANH TOÁN:</span>
                    <span className="grand-amount">{formatCurrency(totalAmount)}</span>
                  </div>

                  {paidState && (
                    <div className="totals-row payment-verified-row">
                      <span>Phương thức:</span>
                      <span className="font-bold">{getPaymentMethodLabel(recentPayment?.method || method)}</span>
                    </div>
                  )}
                </div>

                {/* Lời cảm ơn */}
                <div className="receipt-footer">
                  <p>Cảm ơn Quý Khách đã dùng bữa tại Nhà Hàng An Phúc!</p>
                  <p>Hân hạnh được đón tiếp Quý Khách lần sau! 🌸</p>
                </div>
              </div>

              {/* Thanh công cụ in hóa đơn */}
              <div className="receipt-toolbar">
                <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
                  🖨️ In hóa đơn (POS K80 / A5)
                </button>
              </div>
            </div>

            {/* Cột phải: Bảng điều khiển phương thức & ấn thanh toán */}
            <div className="invoice-checkout-panel">
              <div className="checkout-header">
                <h3>Thanh toán đơn hàng</h3>
                <span className="order-pill-code">{order.order_code || `#${order.id}`}</span>
              </div>

              {paidState ? (
                <div className="already-paid-card">
                  <div className="paid-stamp">ĐÃ THANH TOÁN</div>
                  <div className="paid-details">
                    <p>
                      <strong>Số tiền đã thu:</strong> {formatCurrency(totalAmount)}
                    </p>
                    <p>
                      <strong>Hình thức:</strong>{' '}
                      {getPaymentMethodLabel(recentPayment?.method || method)}
                    </p>
                    <p>
                      <strong>Thời gian:</strong>{' '}
                      {formatDateTime(recentPayment?.paid_at || order.updated_at)}
                    </p>
                    {recentPayment?.note && (
                      <p>
                        <strong>Ghi chú:</strong> {recentPayment.note}
                      </p>
                    )}
                  </div>
                  <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary flex-1" onClick={handlePrint}>
                      🖨️ In lại hóa đơn
                    </button>
                    {onViewDashboard && (
                      <button
                        className="btn btn-primary flex-1"
                        onClick={() => {
                          onClose()
                          onViewDashboard()
                        }}
                      >
                        📊 Xem Dashboard
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="checkout-form">
                  {/* Chọn phương thức */}
                  <label className="checkout-label">1. Chọn phương thức thanh toán:</label>
                  <div className="payment-method-selector">
                    {[
                      { key: 'cash', label: 'Tiền mặt', icon: '💵', desc: 'Nhập tiền nhận & tính tiền thừa' },
                      { key: 'transfer', label: 'Chuyển khoản QR', icon: '📱', desc: 'Quét mã VietQR chuyển khoản' },
                      { key: 'card', label: 'Thẻ POS', icon: '💳', desc: 'Cà thẻ ATM / Visa / Master' },
                    ].map((m) => (
                      <div
                        key={m.key}
                        className={`method-option-card ${method === m.key ? 'active' : ''}`}
                        onClick={() => setMethod(m.key)}
                      >
                        <div className="method-icon">{m.icon}</div>
                        <div className="method-info">
                          <div className="method-title">{m.label}</div>
                          <div className="method-desc">{m.desc}</div>
                        </div>
                        <div className="method-radio">
                          {method === m.key && <span className="radio-dot" />}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Chi tiết theo từng phương thức */}
                  {method === 'cash' && (
                    <div className="method-detail-box">
                      <div className="form-group mb-2">
                        <label className="checkout-label">Khách thanh toán:</label>
                        <div className="cash-input-wrapper">
                          <input
                            type="number"
                            className="form-input cash-input"
                            placeholder="Nhập số tiền khách đưa..."
                            value={cashGiven}
                            onChange={(e) => setCashGiven(e.target.value)}
                          />
                          <span className="currency-suffix">VNĐ</span>
                        </div>
                      </div>

                      {/* Gợi ý tiền nhanh */}
                      <div className="quick-cash-row">
                        <span className="quick-label">Gợi ý nhanh:</span>
                        {quickCashOptions.map((opt, i) => (
                          <button
                            key={i}
                            type="button"
                            className="quick-cash-btn"
                            onClick={() => setCashGiven(opt.toString())}
                          >
                            {formatCurrency(opt)}
                          </button>
                        ))}
                      </div>

                      {/* Tiền thừa */}
                      <div className="change-calculation-box">
                        <div className="change-row">
                          <span>Số tiền cần thu:</span>
                          <span className="font-bold">{formatCurrency(totalAmount)}</span>
                        </div>
                        <div className="change-row">
                          <span>Khách đưa:</span>
                          <span>{numericCashGiven > 0 ? formatCurrency(numericCashGiven) : '0đ'}</span>
                        </div>
                        <div className="divider" style={{ margin: '8px 0' }} />
                        <div className="change-row change-highlight">
                          <span>Tiền thối lại khách:</span>
                          <span className={numericCashGiven >= totalAmount ? 'change-green' : 'change-red'}>
                            {numericCashGiven >= totalAmount
                              ? formatCurrency(changeAmount)
                              : `Còn thiếu ${formatCurrency(totalAmount - numericCashGiven)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {method === 'transfer' && (
                    <div className="method-detail-box qr-box">
                      <div className="qr-image-container">
                        <img
                          src={vietQrUrl}
                          alt="Mã QR thanh toán ngân hàng"
                          className="qr-image"
                          onError={(e) => {
                            // Fallback nếu ảnh không tải được
                            e.target.style.display = 'none'
                          }}
                        />
                      </div>
                      <div className="qr-info-list">
                        <div className="qr-info-item">
                          <span>Ngân hàng:</span>
                          <strong>MB Bank (Quân Đội)</strong>
                        </div>
                        <div className="qr-info-item">
                          <span>Số tài khoản:</span>
                          <strong>0901234567</strong>
                        </div>
                        <div className="qr-info-item">
                          <span>Chủ tài khoản:</span>
                          <strong>NHA HANG AN PHUC</strong>
                        </div>
                        <div className="qr-info-item">
                          <span>Số tiền:</span>
                          <strong className="text-accent">{formatCurrency(totalAmount)}</strong>
                        </div>
                        <div className="qr-info-item">
                          <span>Nội dung CK:</span>
                          <strong className="highlight-code">TT {order.order_code || order.id}</strong>
                        </div>
                      </div>
                      <p className="qr-helper-text">
                        Khách hàng mở App Ngân hàng quét mã QR trên hoặc chuyển đúng nội dung.
                      </p>
                    </div>
                  )}

                  {method === 'card' && (
                    <div className="method-detail-box card-pos-box">
                      <div style={{ fontSize: 36, marginBottom: 8 }}>💳</div>
                      <h4>Quẹt thẻ qua máy POS</h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                        Vui lòng nhập số tiền <strong>{formatCurrency(totalAmount)}</strong> vào máy POS, tiến hành chạm
                        hoặc quẹt thẻ ATM / Visa / Mastercard của khách.
                      </p>
                    </div>
                  )}

                  {/* Ghi chú */}
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label className="checkout-label">Ghi chú giao dịch (tùy chọn):</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ví dụ: Khách VIP, Giảm giá khuyến mãi..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  {/* Nút ấn thanh toán */}
                  <div className="checkout-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={onClose}
                      disabled={submitting}
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="button"
                      className="btn btn-success checkout-submit-btn"
                      onClick={handleConfirmPayment}
                      disabled={submitting}
                      id="submit-payment-btn"
                    >
                      {submitting ? (
                        <>
                          <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                          Đang xử lý...
                        </>
                      ) : (
                        <>✅ Xác nhận thanh toán ({formatCurrency(totalAmount)})</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
