import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { to: '/', icon: '📊', label: 'Tổng quan', exact: true },
  { to: '/orders', icon: '📋', label: 'Đơn hàng' },
  { to: '/tables', icon: '🪑', label: 'Bàn ăn' },
  { to: '/kitchen', icon: '👨‍🍳', label: 'Thực đơn bếp' },
  { to: '/menu', icon: '🍽️', label: 'Thực đơn' },
  { to: '/categories', icon: '📂', label: 'Danh mục' },
  { to: '/payments', icon: '💰', label: 'Thanh toán', roles: ['admin', 'cashier'] },
  { to: '/reports', icon: '📈', label: 'Báo cáo' },
]

const ADMIN_ITEMS = [
  { to: '/users', icon: '👤', label: 'Nhân viên' },
  { to: '/settings', icon: '⚙️', label: 'Cài đặt' },
]

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🍜</div>
        <div className="sidebar-logo-text">
          <h1>OrderNew-System</h1>
          <p>Hệ thống quản lý</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section">Quản lý</div>
        {NAV_ITEMS
          .filter((item) => !item.roles || item.roles.includes(user?.role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
            >
              <span className="item-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

        {isAdmin && (
          <>
            <div className="sidebar-section">Quản trị</div>
            {ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}
              >
                <span className="item-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User Footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={handleLogout} title="Đăng xuất">
          <div className="sidebar-avatar">{getInitials(user?.full_name)}</div>
          <div className="sidebar-user-info">
            <h4>{user?.full_name || 'Người dùng'}</h4>
            <p>{user?.role === 'admin' ? 'Quản lý' : user?.role === 'cashier' ? 'Thu ngân' : 'Nhân viên'}</p>
          </div>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>↩</span>
        </div>
      </div>
    </aside>
  )
}
