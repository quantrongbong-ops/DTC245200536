import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { paymentService, orderService } from '../services/api'
import { formatCurrency, formatDateTime } from '../utils/helpers'

export default function NotificationDropdown({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([])
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('restaurant_read_notifications') || '[]')
    } catch {
      return []
    }
  })
  const [filter, setFilter] = useState('all') // 'all' | 'payment' | 'order'
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const dropdownRef = useRef(null)

  // Đóng khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Lấy danh sách thông báo từ đơn hàng & thanh toán thực tế
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true)
      const [paymentsRes, ordersRes] = await Promise.all([
        paymentService.getAll().catch(() => ({ data: { data: [] } })),
        orderService.getAll({ limit: 30 }).catch(() => ({ data: { data: [] } })),
      ])

      const payList = paymentsRes.data?.data || []
      const orderList = ordersRes.data?.data || []

      const items = []

      // 1. Thông báo thanh toán (Payment received)
      payList.slice(0, 15).forEach((p) => {
        items.push({
          id: `pay_${p.id}`,
          type: 'payment',
          title: `Đã thanh toán hóa đơn ${p.order_code || '#' + p.order_id}`,
          desc: `Bàn ${p.table_number || '-'} thanh toán ${formatCurrency(p.amount)} qua ${
            p.method === 'cash' ? 'Tiền mặt' : p.method === 'transfer' ? 'Chuyển khoản QR' : 'Thẻ'
          }`,
          time: p.paid_at || p.created_at,
          link: `/payments?tab=history`,
          icon: '💰',
          badgeClass: 'badge-success',
          statusText: 'Thành công',
        })
      })

      // 2. Thông báo đơn hàng (Orders)
      orderList.slice(0, 20).forEach((o) => {
        if (!['completed', 'cancelled'].includes(o.status)) {
          // Đơn đang hoạt động
          items.push({
            id: `order_${o.id}`,
            type: 'order',
            title: `Bàn ${o.table_number} có đơn hàng ${o.order_code}`,
            desc: `Tổng tiền: ${formatCurrency(o.total_amount)} • Trạng thái: ${
              o.status === 'served' ? 'Đang phục vụ (Cần thu tiền)' : o.status === 'preparing' ? 'Đang nấu' : 'Chờ xác nhận'
            }`,
            time: o.created_at,
            link: `/payments?tab=pending&orderId=${o.id}`,
            icon: o.status === 'served' ? '🧾' : '🍽️',
            badgeClass: o.status === 'served' ? 'badge-warning' : 'badge-info',
            statusText: o.status === 'served' ? 'Chờ thanh toán' : 'Đang xử lý',
          })
        }
      })

      // Sắp xếp thời gian mới nhất lên đầu
      items.sort((a, b) => new Date(b.time) - new Date(a.time))
      setNotifications(items)
    } catch {
      // Bỏ qua lỗi
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 25000) // Tự động cập nhật mỗi 25s
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Đánh dấu 1 thông báo đã đọc
  const markAsRead = (id) => {
    if (!readIds.includes(id)) {
      const next = [...readIds, id]
      setReadIds(next)
      localStorage.setItem('restaurant_read_notifications', JSON.stringify(next))
    }
  }

  // Đánh dấu tất cả đã đọc
  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id)
    setReadIds(allIds)
    localStorage.setItem('restaurant_read_notifications', JSON.stringify(allIds))
  }

  // Click vào thông báo
  const handleItemClick = (n) => {
    markAsRead(n.id)
    onClose()
    if (n.link) {
      navigate(n.link)
    }
  }

  const filtered = useMemo(() => {
    if (filter === 'payment') return notifications.filter((n) => n.type === 'payment')
    if (filter === 'order') return notifications.filter((n) => n.type === 'order')
    return notifications
  }, [notifications, filter])

  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length

  if (!isOpen) return null

  return (
    <div className="notif-dropdown-container" ref={dropdownRef}>
      {/* Header */}
      <div className="notif-header">
        <div className="notif-header-left">
          <h3>Thông báo hệ thống</h3>
          {unreadCount > 0 && (
            <span className="notif-badge-count">{unreadCount} mới</span>
          )}
        </div>
        <div className="notif-header-right">
          {unreadCount > 0 && (
            <button
              className="notif-action-btn"
              onClick={markAllAsRead}
              title="Đánh dấu tất cả là đã đọc"
            >
              ✓ Đã đọc
            </button>
          )}
          <button
            className="notif-action-btn"
            onClick={fetchNotifications}
            title="Làm mới thông báo"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="notif-tabs">
        <button
          className={`notif-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Tất cả ({notifications.length})
        </button>
        <button
          className={`notif-tab ${filter === 'payment' ? 'active' : ''}`}
          onClick={() => setFilter('payment')}
        >
          💰 Thanh toán ({notifications.filter((n) => n.type === 'payment').length})
        </button>
        <button
          className={`notif-tab ${filter === 'order' ? 'active' : ''}`}
          onClick={() => setFilter('order')}
        >
          📋 Đơn hàng ({notifications.filter((n) => n.type === 'order').length})
        </button>
      </div>

      {/* Notification list */}
      <div className="notif-list">
        {loading && notifications.length === 0 ? (
          <div className="notif-empty">
            <span className="spinner" style={{ width: 22, height: 22 }} />
            <p style={{ marginTop: 8 }}>Đang cập nhật thông báo...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="notif-empty">
            <div style={{ fontSize: 32, marginBottom: 6 }}>🔕</div>
            <p>Không có thông báo nào trong mục này.</p>
          </div>
        ) : (
          filtered.map((n) => {
            const isRead = readIds.includes(n.id)
            return (
              <div
                key={n.id}
                className={`notif-item ${!isRead ? 'unread' : ''}`}
                onClick={() => handleItemClick(n)}
              >
                <div className="notif-item-icon">{n.icon}</div>
                <div className="notif-item-body">
                  <div className="notif-item-title-row">
                    <span className="notif-item-title">{n.title}</span>
                    <span className="notif-item-time">{formatDateTime(n.time)}</span>
                  </div>
                  <p className="notif-item-desc">{n.desc}</p>
                  <div className="notif-item-footer">
                    <span className={`badge ${n.badgeClass}`} style={{ fontSize: 10.5, padding: '1px 6px' }}>
                      {n.statusText}
                    </span>
                    <span className="notif-click-hint">Bấm xem chi tiết →</span>
                  </div>
                </div>
                {!isRead && <span className="notif-unread-dot" />}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="notif-footer">
        <button
          className="notif-view-all-btn"
          onClick={() => {
            onClose()
            navigate('/payments?tab=pending')
          }}
        >
          ⚡ Xem đơn chờ thanh toán
        </button>
      </div>
    </div>
  )
}
