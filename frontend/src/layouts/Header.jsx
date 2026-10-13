import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { orderService, paymentService } from '../services/api'
import NotificationDropdown from '../components/NotificationDropdown'
import UserProfileDropdown from '../components/UserProfileDropdown'

const PAGE_TITLES = {
  '/': 'Tổng quan',
  '/orders': 'Đơn hàng',
  '/tables': 'Sơ đồ bàn',
  '/kitchen': 'Đơn hàng bếp',
  '/menu': 'Quản lý thực đơn',
  '/categories': 'Danh mục',
  '/payments': 'Thanh toán & Hóa đơn',
  '/reports': 'Báo cáo',
  '/users': 'Nhân viên',
  '/settings': 'Cài đặt',
}

export default function Header() {
  const { user } = useAuth()
  const location = useLocation()
  const [time, setTime] = useState(new Date())

  // Dropdown states
  const [showNotif, setShowNotif] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  // Real-time Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Calculate unread notifications count
  const calculateUnreadCount = useCallback(async () => {
    try {
      const [paymentsRes, ordersRes] = await Promise.all([
        paymentService.getAll().catch(() => ({ data: { data: [] } })),
        orderService.getAll({ limit: 20 }).catch(() => ({ data: { data: [] } })),
      ])

      const payList = paymentsRes.data?.data || []
      const orderList = ordersRes.data?.data || []

      const allIds = [
        ...payList.map((p) => `pay_${p.id}`),
        ...orderList.filter((o) => !['completed', 'cancelled'].includes(o.status)).map((o) => `order_${o.id}`),
      ]

      let readIds = []
      try {
        readIds = JSON.parse(localStorage.getItem('restaurant_read_notifications') || '[]')
      } catch {
        readIds = []
      }

      const unread = allIds.filter((id) => !readIds.includes(id)).length
      setUnreadCount(unread > 0 ? unread : 0)
    } catch {
      // Giữ giá trị mặc định
    }
  }, [])

  useEffect(() => {
    calculateUnreadCount()
    const timer = setInterval(calculateUnreadCount, 30000)
    return () => clearInterval(timer)
  }, [calculateUnreadCount])

  const title = PAGE_TITLES[location.pathname] || 'OrderNew-System'

  const formatTime = (d) =>
    d.toLocaleString('vi-VN', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <header className="header">
      <div className="header-left">
        <h2 className="header-title">{title}</h2>
      </div>

      <div className="header-right">
        <span className="header-time">{formatTime(time)}</span>

        {/* Nút Chuông Thông Báo */}
        <div style={{ position: 'relative' }}>
          <button
            className={`header-btn ${showNotif ? 'active' : ''}`}
            title="Thông báo đơn hàng & thanh toán"
            onClick={() => {
              setShowNotif((prev) => !prev)
              setShowProfile(false)
            }}
          >
            🔔
            {unreadCount > 0 && (
              <span className="badge notif-bell-badge animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Thông Báo */}
          <NotificationDropdown
            isOpen={showNotif}
            onClose={() => {
              setShowNotif(false)
              calculateUnreadCount()
            }}
          />
        </div>

        {/* Nút Hồ Sơ Người Dùng */}
        <div style={{ position: 'relative' }}>
          <button
            className={`header-btn user-header-btn ${showProfile ? 'active' : ''}`}
            title={`Tài khoản: ${user?.full_name || 'Người dùng'}`}
            onClick={() => {
              setShowProfile((prev) => !prev)
              setShowNotif(false)
            }}
          >
            👤
          </button>

          {/* Dropdown Thông Tin Người Dùng */}
          <UserProfileDropdown
            isOpen={showProfile}
            onClose={() => setShowProfile(false)}
          />
        </div>
      </div>
    </header>
  )
}
