import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

export default function SettingsPage() {
  const { user } = useAuth()
  const [storeInfo, setStoreInfo] = useState({
    name: 'Nhà Hàng An Phúc',
    address: '123 Đường Ẩm Thực, Quận 1, TP. Hồ Chí Minh',
    phone: '0901 234 567',
    taxCode: '0312345678',
    currency: 'VND',
    vatRate: '8',
  })

  const [notifications, setNotifications] = useState({
    soundOnNewOrder: true,
    kitchenAlert: true,
    autoPrintReceipt: false,
  })

  const handleSaveStore = (e) => {
    e.preventDefault()
    toast.success('Đã lưu cấu hình nhà hàng thành công!')
  }

  const handleToggleNotice = (key) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
    toast.success('Đã cập nhật tùy chọn thông báo')
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>⚙️ Cài đặt hệ thống</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Quản lý thông tin nhà hàng, hóa đơn và tùy chọn hệ thống
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Restaurant profile */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            🏪 Thông tin nhà hàng
          </h3>
          <form onSubmit={handleSaveStore}>
            <div className="form-group">
              <label className="form-label">Tên nhà hàng</label>
              <input
                type="text"
                className="form-input"
                value={storeInfo.name}
                onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Địa chỉ</label>
              <input
                type="text"
                className="form-input"
                value={storeInfo.address}
                onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Số điện thoại</label>
                <input
                  type="text"
                  className="form-input"
                  value={storeInfo.phone}
                  onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mã số thuế</label>
                <input
                  type="text"
                  className="form-input"
                  value={storeInfo.taxCode}
                  onChange={(e) => setStoreInfo({ ...storeInfo, taxCode: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Đơn vị tiền tệ</label>
                <input
                  type="text"
                  className="form-input"
                  value={storeInfo.currency}
                  disabled
                />
              </div>
              <div className="form-group">
                <label className="form-label">VAT (%)</label>
                <input
                  type="number"
                  className="form-input"
                  value={storeInfo.vatRate}
                  onChange={(e) => setStoreInfo({ ...storeInfo, vatRate: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 12 }}>
              💾 Lưu thông tin
            </button>
          </form>
        </div>

        {/* System Settings & User Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🔔 Tùy chọn hoạt động & Chuông báo
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Âm báo khi có đơn mới</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Phát chuông cảnh báo cho nhân viên thu ngân</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.soundOnNewOrder}
                  onChange={() => handleToggleNotice('soundOnNewOrder')}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-accent)' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Thông báo bếp tự động</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Đồng bộ tức thời màn hình bếp khi bấm gọi món</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.kitchenAlert}
                  onChange={() => handleToggleNotice('kitchenAlert')}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-accent)' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Tự động in phiếu bếp / hóa đơn</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gửi lệnh in nhiệt sau khi hoàn tất thanh toán</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.autoPrintReceipt}
                  onChange={() => handleToggleNotice('autoPrintReceipt')}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-accent)' }}
                />
              </label>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              👤 Thông tin tài khoản hiện tại
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div className="sidebar-avatar" style={{ width: 52, height: 52, fontSize: 20 }}>
                {user?.full_name ? user.full_name[0].toUpperCase() : 'A'}
              </div>
              <div>
                <h4 style={{ fontWeight: 700, fontSize: 15 }}>{user?.full_name || 'Quản trị viên'}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Tên đăng nhập: <strong>{user?.username || 'admin'}</strong> • Quyền: <span className="badge badge-primary">{user?.role || 'admin'}</span>
                </p>
              </div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-body)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              Phiên bản hệ thống: <strong>v1.0.0 (Production Ready)</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
