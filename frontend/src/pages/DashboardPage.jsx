import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { dashboardService } from '../services/api'
import { formatCurrency, formatDateTime, getStatusClass, getStatusLabel } from '../utils/helpers'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const StatCard = ({ icon, label, value, change, color, bgColor, iconBg }) => (
  <div className="stat-card" style={{ '--card-accent': color }}>
    <div className="stat-card-icon" style={{ background: iconBg }}>
      {icon}
    </div>
    <div className="stat-card-value">{value}</div>
    <div className="stat-card-label">{label}</div>
    {change !== null && change !== undefined && (
      <div className={`stat-card-change ${change > 0 ? 'up' : 'down'}`}>
        {change > 0 ? '↑' : '↓'} {Math.abs(change)}% so với hôm qua
      </div>
    )}
  </div>
)

const STATUS_ORDER_LABELS = {
  pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang nấu',
  served: 'Đang phục vụ', completed: 'Hoàn thành', cancelled: 'Đã hủy'
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [recentOrders, setRecentOrders] = useState([])
  const [revenueChange, setRevenueChange] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { user } = useAuth()

  const loadData = useCallback(async () => {
    try {
      const [statsRes, chartRes, ordersRes] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRevenueChart(7),
        dashboardService.getRecentOrders(8),
      ])
      setStats(statsRes.data.data)
      setChartData(chartRes.data.data.map(d => ({
        date: d.date.slice(5),
        revenue: d.revenue / 1000000,
        orders: d.order_count,
      })))

      // Tính % thay đổi doanh thu so với hôm qua từ dữ liệu thật
      const rawChart = chartRes.data.data
      if (rawChart.length >= 2) {
        const todayRev = parseFloat(rawChart[rawChart.length - 1].revenue) || 0
        const yesterdayRev = parseFloat(rawChart[rawChart.length - 2].revenue) || 0
        if (yesterdayRev > 0) {
          setRevenueChange(Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100))
        }
      }

      setRecentOrders(ordersRes.data.data)
    } catch (err) {
      console.error('Dashboard load error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000) // Refresh mỗi 30s
    return () => clearInterval(interval)
  }, [loadData])

  if (loading) return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>Đang tải dữ liệu...</p>
    </div>
  )

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Xin chào, {user?.full_name?.split(' ').pop()}! 👋</h2>
          <p>Chúc bạn một ngày làm việc hiệu quả!</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/tables')}>
          + Tạo đơn hàng
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <StatCard
          icon="💰"
          label="Doanh thu hôm nay"
          value={formatCurrency(stats?.revenue?.today || 0)}
          change={revenueChange}
          color="#22c55e"
          iconBg="linear-gradient(135deg, #dcfce7, #bbf7d0)"
        />
        <StatCard
          icon="📋"
          label="Tổng đơn hàng"
          value={stats?.orders?.today || 0}
          change={null}
          color="#3b82f6"
          iconBg="linear-gradient(135deg, #dbeafe, #bfdbfe)"
        />
        <StatCard
          icon="🪑"
          label="Bàn đang sử dụng"
          value={`${stats?.tables?.occupied || 0} / ${stats?.tables?.total || 0}`}
          color="#f97316"
          iconBg="linear-gradient(135deg, #ffedd5, #fed7aa)"
        />
        <StatCard
          icon="🍽️"
          label="Món ăn đang bán"
          value={stats?.menu?.total || 0}
          color="#8b5cf6"
          iconBg="linear-gradient(135deg, #ede9fe, #ddd6fe)"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, marginBottom: 24 }}>
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📈 Doanh thu 7 ngày gần nhất</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/reports')}>
              Xem tất cả
            </button>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => `${v}tr`} />
                  <Tooltip
                    formatter={(val) => [`${(val).toFixed(1)}tr đ`, 'Doanh thu']}
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.5}
                    fill="url(#revGradient)" dot={{ fill: '#f59e0b', r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Table Status Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🪑 Trạng thái bàn</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Bàn trống', count: stats?.tables?.available || 0, color: '#22c55e', bg: '#dcfce7', emoji: '🟢' },
                { label: 'Đang phục vụ', count: stats?.tables?.occupied || 0, color: '#f97316', bg: '#ffedd5', emoji: '🟠' },
                { label: 'Đặt trước', count: stats?.tables?.reserved || 0, color: '#3b82f6', bg: '#dbeafe', emoji: '🔵' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{item.emoji}</span>
                    <span style={{ fontWeight: 500, color: '#374151' }}>{item.label}</span>
                  </div>
                  <div style={{
                    background: item.bg, color: item.color,
                    padding: '4px 16px', borderRadius: 20, fontWeight: 700, fontSize: 16
                  }}>
                    {item.count}
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#1f2937' }}>
                {stats?.tables?.total ? Math.round((stats.tables.occupied / stats.tables.total) * 100) : 0}%
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Tỷ lệ lấp đầy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📋 Đơn hàng gần đây</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/orders')}>
            Xem tất cả
          </button>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Mã đơn</th>
                <th>Khách hàng / Bàn</th>
                <th>Tổng tiền</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Chưa có đơn hàng nào</td></tr>
              ) : recentOrders.map((order, i) => (
                <tr key={order.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders/${order.id}`)}>
                  <td style={{ color: '#9ca3af', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ fontWeight: 700, color: '#1f2937' }}>{order.order_code}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{order.staff_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Bàn {order.table_number}</div>
                  </td>
                  <td style={{ fontWeight: 700, color: '#f59e0b' }}>
                    {formatCurrency(order.total_amount)}
                  </td>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>{formatDateTime(order.created_at)}</td>
                  <td>
                    <span className={`badge ${getStatusClass(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
