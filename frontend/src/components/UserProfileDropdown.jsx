import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { authService } from '../services/api'
import { formatDate } from '../utils/helpers'

export default function UserProfileDropdown({ isOpen, onClose }) {
  const { user, logout, login } = useAuth()
  const navigate = useNavigate()
  const dropdownRef = useRef(null)

  // Modals inside profile dropdown
  const [showSwitchModal, setShowSwitchModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  // Switch account form state
  const [switchUsername, setSwitchUsername] = useState('')
  const [switchPassword, setSwitchPassword] = useState('')
  const [switching, setSwitching] = useState(false)

  // Change password form state
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [changingPwd, setChangingPwd] = useState(false)

  // Close when click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        if (!showSwitchModal && !showPasswordModal) {
          onClose()
        }
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, showSwitchModal, showPasswordModal])

  if (!isOpen) return null

  // Chữ cái đầu của tên
  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U'

  // Xử lý đăng xuất
  const handleLogout = () => {
    logout()
    onClose()
    toast.success('Đã đăng xuất khỏi hệ thống!')
    navigate('/login')
  }

  // Xử lý chuyển tài khoản
  const handleSwitchAccountSubmit = async (e) => {
    e.preventDefault()
    if (!switchUsername || !switchPassword) {
      toast.error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu')
      return
    }

    try {
      setSwitching(true)
      await login(switchUsername, switchPassword)
      toast.success(`Đã chuyển sang tài khoản ${switchUsername}!`)
      setShowSwitchModal(false)
      setSwitchUsername('')
      setSwitchPassword('')
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không đúng'
      toast.error(msg)
    } finally {
      setSwitching(false)
    }
  }

  // Xử lý đổi mật khẩu
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault()
    if (pwdForm.new_password.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự!')
      return
    }
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error('Mật khẩu xác nhận không khớp!')
      return
    }

    try {
      setChangingPwd(true)
      await authService.changePassword({
        current_password: pwdForm.current_password,
        new_password: pwdForm.new_password,
      })
      toast.success('Đổi mật khẩu thành công!')
      setShowPasswordModal(false)
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      const msg = err.response?.data?.message || 'Đổi mật khẩu thất bại'
      toast.error(msg)
    } finally {
      setChangingPwd(false)
    }
  }

  // Nhãn vai trò
  const roleLabel =
    user?.role === 'admin'
      ? '👑 Quản trị viên'
      : user?.role === 'cashier'
      ? '💰 Thu ngân'
      : '🍽️ Nhân viên phục vụ'

  return (
    <>
      <div className="profile-dropdown-container" ref={dropdownRef}>
        {/* User Card Header */}
        <div className="profile-header-card">
          <div className="profile-avatar-large">{initials}</div>
          <div className="profile-header-info">
            <h3 className="profile-name">{user?.full_name || 'Người dùng'}</h3>
            <span className="profile-role-badge">{roleLabel}</span>
            <div className="profile-status-dot">
              <span className="online-indicator" /> Online • Đang hoạt động
            </div>
          </div>
        </div>

        {/* User Details */}
        <div className="profile-details-list">
          <div className="profile-detail-item">
            <span className="detail-label">👤 Tài khoản:</span>
            <strong className="detail-value">{user?.username || '-'}</strong>
          </div>
          <div className="profile-detail-item">
            <span className="detail-label">✉️ Email:</span>
            <span className="detail-value">{user?.email || 'Chưa cập nhật'}</span>
          </div>
          <div className="profile-detail-item">
            <span className="detail-label">📞 Số điện thoại:</span>
            <span className="detail-value">{user?.phone || 'Chưa cập nhật'}</span>
          </div>
          <div className="profile-detail-item">
            <span className="detail-label">📅 Ngày tham gia:</span>
            <span className="detail-value">{user?.created_at ? formatDate(user.created_at) : 'Hôm nay'}</span>
          </div>
        </div>

        <div className="divider" style={{ margin: '8px 0' }} />

        {/* Menu Actions */}
        <div className="profile-menu-actions">
          <button
            type="button"
            className="profile-menu-item"
            onClick={() => setShowSwitchModal(true)}
          >
            <span className="menu-item-icon">🔄</span>
            <div className="menu-item-text">
              <span className="menu-item-title">Chuyển tài khoản</span>
              <span className="menu-item-sub">Đăng nhập tài khoản nhân viên / quản lý khác</span>
            </div>
          </button>

          <button
            type="button"
            className="profile-menu-item"
            onClick={() => setShowPasswordModal(true)}
          >
            <span className="menu-item-icon">🔒</span>
            <div className="menu-item-text">
              <span className="menu-item-title">Đổi mật khẩu</span>
              <span className="menu-item-sub">Bảo mật tài khoản cá nhân</span>
            </div>
          </button>

          {user?.role === 'admin' && (
            <button
              type="button"
              className="profile-menu-item"
              onClick={() => {
                onClose()
                navigate('/users')
              }}
            >
              <span className="menu-item-icon">👥</span>
              <div className="menu-item-text">
                <span className="menu-item-title">Quản lý người dùng</span>
                <span className="menu-item-sub">Xem và phân quyền nhân viên</span>
              </div>
            </button>
          )}

          <button
            type="button"
            className="profile-menu-item logout-item"
            onClick={handleLogout}
          >
            <span className="menu-item-icon">🚪</span>
            <div className="menu-item-text">
              <span className="menu-item-title text-danger">Đăng xuất</span>
              <span className="menu-item-sub">Thoát phiên làm việc</span>
            </div>
          </button>
        </div>
      </div>

      {/* Modal Chuyển Tài Khoản */}
      {showSwitchModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🔄 Chuyển đổi tài khoản</h3>
              <button className="modal-close" onClick={() => setShowSwitchModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSwitchAccountSubmit} className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Đăng nhập tài khoản khác để làm việc mà không cần thoát ứng dụng.
              </p>

              <div className="form-group">
                <label className="form-label">Tên đăng nhập hoặc Email:</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="Nhập username (vd: admin, cashier1...)"
                  value={switchUsername}
                  onChange={(e) => setSwitchUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mật khẩu:</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Nhập mật khẩu..."
                  value={switchPassword}
                  onChange={(e) => setSwitchPassword(e.target.value)}
                />
              </div>

              <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: 'none' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSwitchModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={switching}
                >
                  {switching ? 'Đang chuyển...' : 'Đăng nhập ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Đổi Mật Khẩu */}
      {showPasswordModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🔒 Đổi mật khẩu</h3>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>✕</button>
            </div>
            <form onSubmit={handleChangePasswordSubmit} className="modal-body">
              <div className="form-group">
                <label className="form-label">Mật khẩu hiện tại:</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Nhập mật khẩu cũ..."
                  value={pwdForm.current_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, current_password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mật khẩu mới (ít nhất 6 ký tự):</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Nhập mật khẩu mới..."
                  value={pwdForm.new_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, new_password: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Xác nhận mật khẩu mới:</label>
                <input
                  type="password"
                  required
                  className="form-input"
                  placeholder="Nhập lại mật khẩu mới..."
                  value={pwdForm.confirm_password}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirm_password: e.target.value })}
                />
              </div>

              <div className="modal-footer" style={{ padding: '16px 0 0', borderTop: 'none' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPasswordModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={changingPwd}
                >
                  {changingPwd ? 'Đang lưu...' : 'Xác nhận đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
