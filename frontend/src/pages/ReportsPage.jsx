import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { dashboardService, paymentService } from '../services/api'
import { formatCurrency, formatDate } from '../utils/helpers'

export default function ReportsPage() {
  const [stats, setStats] = useState(null)
  const [chartData, setChartData] = useState([])
  const [payments, setPayments] = useState([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const fromDate = new Date()
        fromDate.setDate(fromDate.getDate() - days)
        const [statsRes, chartRes, payRes] = await Promise.all([
          dashboardService.getStats(),
          dashboardService.getRevenueChart(days),
          paymentService.getAll({ from: fromDate.toISOString() }),
        ])
        setStats(statsRes.data.data)
        setChartData(chartRes.data.data)
        setPayments(payRes.data.data)
        setTotalRevenue(payRes.data.total_revenue || 0)
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [days])

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>📈 Báo cáo & Thống kê</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 14, 30].map(d => (
            <button key={d} className={`btn ${days === d ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDays(d)}>{d} ngày</button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 24 }}>
        {[
          { label: `Doanh thu ${days} ngày`, value: formatCurrency(totalRevenue), icon: '💰', color: '#22c55e' },
          { label: 'Số giao dịch', value: payments.length, icon: '📋', color: '#3b82f6' },
          { label: 'Trung bình/đơn', value: formatCurrency(payments.length > 0 ? totalRevenue / payments.length : 0), icon: '📊', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 36 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{s.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <h3 className="card-title">Doanh thu theo ngày</h3>
        </div>
        <div className="card-body">
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${(v/1000000).toFixed(1)}tr`} />
                <Tooltip formatter={v => [formatCurrency(v), 'Doanh thu']}
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Lịch sử thanh toán</h3>
        </div>
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Bàn</th>
                <th>Số tiền</th>
                <th>Phương thức</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 20).map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.order_code}</td>
                  <td>Bàn {p.table_number}</td>
                  <td style={{ fontWeight: 700, color: '#22c55e' }}>{formatCurrency(p.amount)}</td>
                  <td>
                    <span className="badge badge-info">
                      {{ cash: '💵 Tiền mặt', card: '💳 Thẻ', transfer: '📱 Chuyển khoản', other: 'Khác' }[p.method]}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(p.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
