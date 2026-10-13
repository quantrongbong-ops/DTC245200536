import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { paymentService, orderService, dashboardService } from '../services/api'
import { formatCurrency, formatDateTime, getPaymentMethodLabel, getStatusClass, getStatusLabel } from '../utils/helpers'
import InvoiceModal from '../components/InvoiceModal'

export default function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = searchParams.get('tab') || 'pending'
  const targetOrderId = searchParams.get('orderId')

  const [activeTab, setActiveTab] = useState(initialTab) // 'pending' | 'dashboard' | 'history'
  const [payments, setPayments] = useState([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [pendingOrders, setPendingOrders] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters for history
  const [methodFilter, setMethodFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Modal Invoice
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [isPaidInvoice, setIsPaidInvoice] = useState(false)
  const [selectedPaymentInfo, setSelectedPaymentInfo] = useState(null)

  // Fetch all payment and order data
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [payRes, ordersRes, statsRes, chartRes] = await Promise.all([
        paymentService.getAll().catch(() => ({ data: { data: [], total_revenue: 0 } })),
        orderService.getAll({ limit: 100 }).catch(() => ({ data: { data: [] } })),
        dashboardService.getStats().catch(() => ({ data: { data: null } })),
        dashboardService.getRevenueChart(7).catch(() => ({ data: { data: [] } })),
      ])

      const payList = payRes.data?.data || []
      setPayments(payList)
      setTotalRevenue(payRes.data?.total_revenue || payList.reduce((s, p) => s + parseFloat(p.amount || 0), 0))

      // Lọc các đơn chưa hoàn tất (cần thanh toán)
      const allOrders = ordersRes.data?.data || []
      const unpaid = allOrders.filter(
        (o) => !['completed', 'cancelled'].includes(o.status)
      )
      setPendingOrders(unpaid)

      setDashboardStats(statsRes.data?.data || null)
      setChartData(
        (chartRes.data?.data || []).map((d) => ({
          date: d.date.slice(5),
          revenue: (parseFloat(d.revenue) || 0) / 1000000,
          orders: d.order_count || 0,
        }))
      )

      // Nếu có targetOrderId từ URL, mở luôn hóa đơn của đơn đó
      if (targetOrderId) {
        try {
          const detailRes = await orderService.getById(targetOrderId)
          if (detailRes.data?.data) {
            setSelectedOrder(detailRes.data.data)
            setIsPaidInvoice(detailRes.data.data.status === 'completed')
            setIsInvoiceOpen(true)
          }
        } catch {
          // Bỏ qua nếu không tải được đơn
        }
      }
    } catch {
      toast.error('Không tải được dữ liệu thanh toán!')
    } finally {
      setLoading(false)
    }
  }, [targetOrderId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Chuyển tab
  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  // Mở thanh toán cho đơn đang chờ
  const handleOpenCheckout = async (order) => {
    try {
      const res = await orderService.getById(order.id)
      setSelectedOrder(res.data?.data || order)
      setIsPaidInvoice(false)
      setSelectedPaymentInfo(null)
      setIsInvoiceOpen(true)
    } catch {
      setSelectedOrder(order)
      setIsPaidInvoice(false)
      setSelectedPaymentInfo(null)
      setIsInvoiceOpen(true)
    }
  }

  // Xem lại hóa đơn đã thanh toán trong lịch sử
  const handleViewPaidInvoice = async (payment) => {
    try {
      const res = await orderService.getById(payment.order_id)
      setSelectedOrder(res.data?.data || {
        id: payment.order_id,
        order_code: payment.order_code,
        table_number: payment.table_number,
        total_amount: payment.amount,
        created_at: payment.paid_at,
        items: [],
      })
      setIsPaidInvoice(true)
      setSelectedPaymentInfo(payment)
      setIsInvoiceOpen(true)
    } catch {
      toast.error('Không tải được chi tiết hóa đơn!')
    }
  }

  // Xử lý sau khi ấn thanh toán thành công
  const handlePaymentSuccess = async () => {
    await loadData()
    // Sau khi thanh toán thành công, tự động chuyển qua xem Dashboard Doanh thu!
    setActiveTab('dashboard')
    setSearchParams({ tab: 'dashboard' })
  }

  // Lọc lịch sử
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchMethod = methodFilter === 'all' || p.method === methodFilter
      const matchSearch =
        !search ||
        p.order_code?.toLowerCase().includes(search.toLowerCase()) ||
        p.table_number?.toString().includes(search)
      return matchMethod && matchSearch
    })
  }, [payments, methodFilter, search])

  // Thống kê theo phương thức thanh toán
  const methodStats = useMemo(() => {
    const stats = { cash: 0, transfer: 0, card: 0, other: 0 }
    payments.forEach((p) => {
      const amt = parseFloat(p.amount) || 0
      if (stats[p.method] !== undefined) {
        stats[p.method] += amt
      } else {
        stats.other += amt
      }
    })
    return [
      { name: 'Tiền mặt', value: stats.cash / 1000000, raw: stats.cash, color: '#22c55e' },
      { name: 'Chuyển khoản QR', value: stats.transfer / 1000000, raw: stats.transfer, color: '#3b82f6' },
      { name: 'Thẻ POS', value: stats.card / 1000000, raw: stats.card, color: '#f59e0b' },
    ]
  }, [payments])

  return (
    <div>
      {/* Header trang thanh toán */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>💰 Quản lý thanh toán & Hóa đơn</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Xuất hóa đơn, xử lý thanh toán đa phương thức và theo dõi dashboard doanh thu thời gian thực
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            title="Làm mới dữ liệu"
          >
            🔄 Cập nhật
          </button>
        </div>
      </div>

      {/* 3 Tab điều hướng chính */}
      <div style={{ marginBottom: 20 }}>
        <div className="filter-tabs" style={{ display: 'flex', gap: 6 }}>
          <button
            className={`filter-tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => handleTabChange('pending')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>⚡ Đơn chờ thanh toán</span>
            {pendingOrders.length > 0 && (
              <span
                style={{
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: 20,
                  padding: '1px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            className={`filter-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>📊 Dashboard Doanh thu</span>
          </button>
          <button
            className={`filter-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>🧾 Lịch sử giao dịch ({payments.length})</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          TAB 1: ĐƠN CHỜ THANH TOÁN (Xuất hóa đơn & Thanh toán ngay)
          ==================================================================== */}
      {activeTab === 'pending' && (
        <div>
          {/* Quick Notice */}
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              padding: '14px 18px',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🧾</span>
              <div>
                <strong style={{ color: '#1e40af' }}>
                  Có {pendingOrders.length} đơn hàng đang phục vụ tại bàn cần thanh toán
                </strong>
                <p style={{ fontSize: 12, color: '#3b82f6', margin: 0 }}>
                  Nhấn "Xuất hóa đơn & Thanh toán" để in bill và thu tiền khách.
                </p>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleTabChange('dashboard')}
            >
              📊 Xem Dashboard Doanh thu →
            </button>
          </div>

          <div className="card">
            {loading ? (
              <div className="empty-state">
                <span className="spinner"></span>
                <p style={{ marginTop: 12 }}>Đang kiểm tra các đơn hàng...</p>
              </div>
            ) : pendingOrders.length === 0 ? (
              <div className="empty-state" style={{ padding: '60px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <h3>Tất cả bàn đã thanh toán xong!</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                  Hiện tại không có bàn nào đang chờ tính tiền.
                </p>
                <div style={{ marginTop: 18 }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleTabChange('dashboard')}
                  >
                    📊 Xem Dashboard Doanh thu hôm nay
                  </button>
                </div>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bàn</th>
                      <th>Mã đơn</th>
                      <th>Nhân viên</th>
                      <th>Thời gian gọi</th>
                      <th>Trạng thái đơn</th>
                      <th>Tổng tiền cần thu</th>
                      <th style={{ textAlign: 'right' }}>Thao tác thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrders.map((order) => (
                      <tr key={order.id} style={{ transition: 'background 0.15s' }}>
                        <td>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
                            Bàn {order.table_number || '-'}
                          </div>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{order.area || 'Khu vực chính'}</span>
                        </td>
                        <td>
                          <span className="badge badge-info" style={{ fontWeight: 700 }}>
                            {order.order_code || `#${order.id}`}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, color: '#334155' }}>{order.staff_name || '—'}</span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                          {formatDateTime(order.created_at)}
                        </td>
                        <td>
                          <span className={`badge ${getStatusClass(order.status)}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#d97706' }}>
                            {formatCurrency(order.total_amount)}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-success"
                            style={{
                              padding: '8px 16px',
                              fontSize: 13,
                              fontWeight: 700,
                              boxShadow: '0 2px 8px rgba(34, 197, 94, 0.25)',
                            }}
                            onClick={() => handleOpenCheckout(order)}
                          >
                            🧾 Xuất hóa đơn & Thanh toán
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 2: DASHBOARD DOANH THU (Sau khi ấn thanh toán hiển thị tại đây)
          ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Top KPI Cards */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card" style={{ '--card-accent': '#22c55e' }}>
              <div className="stat-card-icon" style={{ background: '#dcfce7' }}>💵</div>
              <div className="stat-card-value">
                {formatCurrency(dashboardStats?.revenue?.today || totalRevenue)}
              </div>
              <div className="stat-card-label">Doanh thu hôm nay</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': '#3b82f6' }}>
              <div className="stat-card-icon" style={{ background: '#dbeafe' }}>🧾</div>
              <div className="stat-card-value">
                {payments.length}
              </div>
              <div className="stat-card-label">Số hóa đơn đã thanh toán</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': '#f59e0b' }}>
              <div className="stat-card-icon" style={{ background: '#fef3c7' }}>💳</div>
              <div className="stat-card-value">
                {formatCurrency(payments.length ? totalRevenue / payments.length : 0)}
              </div>
              <div className="stat-card-label">Giá trị trung bình / đơn</div>
            </div>

            <div className="stat-card" style={{ '--card-accent': '#8b5cf6' }}>
              <div className="stat-card-icon" style={{ background: '#ede9fe' }}>🍽️</div>
              <div className="stat-card-value">
                {pendingOrders.length} bàn
              </div>
              <div className="stat-card-label">Đang phục vụ (chờ thu)</div>
            </div>
          </div>

          {/* Biểu đồ doanh thu */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginBottom: 24 }}>
            {/* Biểu đồ doanh thu 7 ngày */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">📈 Xu hướng doanh thu 7 ngày gần nhất</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Đơn vị: Triệu VNĐ</span>
              </div>
              <div className="card-body">
                <div style={{ height: 260, width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="payRevGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `${v}tr`} />
                      <Tooltip
                        formatter={(val) => [`${parseFloat(val).toFixed(2)} triệu đ`, 'Doanh thu']}
                        contentStyle={{
                          borderRadius: 10,
                          border: 'none',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#22c55e"
                        strokeWidth={2.5}
                        fill="url(#payRevGradient)"
                        dot={{ fill: '#22c55e', r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Phân bổ theo phương thức thanh toán */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">💳 Doanh thu theo phương thức</h3>
              </div>
              <div className="card-body">
                <div style={{ height: 180, width: '100%', marginBottom: 12 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={methodStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `${v}tr`} />
                      <Tooltip
                        formatter={(val) => [`${parseFloat(val).toFixed(2)} triệu đ`, 'Doanh thu']}
                        contentStyle={{ borderRadius: 10, border: 'none', fontSize: 12 }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  {methodStats.map((m) => (
                    <div key={m.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#475569' }}>{m.name}:</span>
                      <strong style={{ color: '#0f172a' }}>{formatCurrency(m.raw)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Giao dịch gần nhất */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">⚡ Các hóa đơn vừa thanh toán gần đây</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleTabChange('history')}
              >
                Xem tất cả lịch sử →
              </button>
            </div>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã hóa đơn</th>
                    <th>Bàn</th>
                    <th>Số tiền</th>
                    <th>Phương thức</th>
                    <th>Thời gian thanh toán</th>
                    <th style={{ textAlign: 'right' }}>Hóa đơn</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 5).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="badge badge-info">{p.order_code || `#${p.order_id}`}</span>
                      </td>
                      <td><strong>Bàn {p.table_number || '-'}</strong></td>
                      <td style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(p.amount)}</td>
                      <td>
                        <span className="badge badge-default">{getPaymentMethodLabel(p.method)}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {formatDateTime(p.paid_at)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleViewPaidInvoice(p)}
                        >
                          👁️ Xem bill & In
                        </button>
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                        Chưa có giao dịch thanh toán nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          TAB 3: LỊCH SỬ GIAO DỊCH & HÓA ĐƠN
          ==================================================================== */}
      {activeTab === 'history' && (
        <div>
          {/* Filters */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 260 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔍 Tìm theo mã đơn, số bàn..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ maxWidth: 300 }}
                />
                <select
                  className="form-select"
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  style={{ maxWidth: 200 }}
                >
                  <option value="all">Tất cả phương thức</option>
                  <option value="cash">Tiền mặt</option>
                  <option value="card">Thẻ ngân hàng</option>
                  <option value="transfer">Chuyển khoản</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Tổng cộng: <strong>{filteredPayments.length}</strong> giao dịch •{' '}
                <strong style={{ color: '#16a34a' }}>
                  {formatCurrency(filteredPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0))}
                </strong>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            {filteredPayments.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 42, marginBottom: 8 }}>💳</div>
                <p>Chưa có giao dịch thanh toán nào phù hợp.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Bàn</th>
                      <th>Số tiền</th>
                      <th>Phương thức</th>
                      <th>Thời gian</th>
                      <th>Ghi chú</th>
                      <th style={{ textAlign: 'right' }}>Hóa đơn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="badge badge-info">{p.order_code || `#${p.order_id}`}</span>
                        </td>
                        <td><strong>Bàn {p.table_number || '-'}</strong></td>
                        <td style={{ fontWeight: 700, color: '#16a34a' }}>
                          {formatCurrency(p.amount)}
                        </td>
                        <td>
                          <span className="badge badge-default">
                            {getPaymentMethodLabel(p.method)}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                          {formatDateTime(p.paid_at)}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                          {p.note || '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewPaidInvoice(p)}
                          >
                            🖨️ In lại hóa đơn
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL HÓA ĐƠN THANH TOÁN (IN HÓA ĐƠN & ẤN THANH TOÁN)
          ==================================================================== */}
      <InvoiceModal
        isOpen={isInvoiceOpen}
        order={selectedOrder}
        isPaid={isPaidInvoice}
        paymentInfo={selectedPaymentInfo}
        onClose={() => setIsInvoiceOpen(false)}
        onPaymentSuccess={handlePaymentSuccess}
        onViewDashboard={() => {
          setIsInvoiceOpen(false)
          handleTabChange('dashboard')
        }}
      />
    </div>
  )
}
