import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { orderService } from '../services/api'
import { formatCurrency, formatDateTime, getStatusLabel, getStatusClass } from '../utils/helpers'
import InvoiceModal from '../components/InvoiceModal'

const STATUS_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'preparing', label: 'Đang nấu' },
  { key: 'served', label: 'Đang phục vụ' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
]

const ORDER_STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'served', 'completed']

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {}
      const res = await orderService.getAll(params)
      setOrders(res.data.data)
    } catch { toast.error('Không tải được danh sách đơn') }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  const openDetail = async (order) => {
    try {
      const res = await orderService.getById(order.id)
      setSelected(res.data.data)
      setShowDetail(true)
    } catch { toast.error('Không tải được chi tiết đơn') }
  }

  const updateStatus = async (orderId, status) => {
    try {
      await orderService.updateStatus(orderId, status)
      toast.success('Cập nhật trạng thái thành công')
      load()
      if (selected?.id === orderId) {
        const res = await orderService.getById(orderId)
        setSelected(res.data.data)
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi cập nhật') }
  }

  const getNextStatus = (current) => {
    const idx = ORDER_STATUS_FLOW.indexOf(current)
    return idx >= 0 && idx < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[idx + 1] : null
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Quản lý đơn hàng</h2>
          <p>{orders.length} đơn hàng</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/tables')}>
          + Tạo đơn mới
        </button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 20 }}>
        <div className="filter-tabs">
          {STATUS_FILTERS.map(f => (
            <button key={f.key} className={`filter-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}>
              {f.label}
              {f.key !== 'all' && orders.filter(o => o.status === f.key).length > 0 && (
                <span style={{ marginLeft: 6, background: '#e5e7eb', padding: '1px 7px', borderRadius: 20, fontSize: 11 }}>
                  {orders.filter(o => o.status === f.key).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="table-wrapper">
          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : orders.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📋</span>
              <h3>Chưa có đơn hàng</h3>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mã đơn</th>
                  <th>Bàn</th>
                  <th>Nhân viên</th>
                  <th>Tổng tiền</th>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, i) => (
                  <tr key={order.id} style={{ cursor: 'pointer' }}>
                    <td style={{ color: '#9ca3af' }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{order.order_code}</td>
                    <td>Bàn {order.table_number}</td>
                    <td>{order.staff_name || '—'}</td>
                    <td style={{ fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(order.total_amount)}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{formatDateTime(order.created_at)}</td>
                    <td>
                      <span className={`badge ${getStatusClass(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openDetail(order)}>Chi tiết</button>
                        {getNextStatus(order.status) && (
                          <button className="btn btn-primary btn-sm"
                            onClick={() => updateStatus(order.id, getNextStatus(order.status))}>
                            ▶ {getStatusLabel(getNextStatus(order.status))}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Order Detail Modal */}
      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📋 Đơn hàng {selected.order_code}</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <p className="text-sm text-muted">Bàn</p>
                  <p className="font-bold">Bàn {selected.table_number} - {selected.area}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Trạng thái</p>
                  <span className={`badge ${getStatusClass(selected.status)}`}>
                    {getStatusLabel(selected.status)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted">Nhân viên</p>
                  <p className="font-bold">{selected.staff_name || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted">Thời gian</p>
                  <p className="font-bold">{formatDateTime(selected.created_at)}</p>
                </div>
              </div>

              {selected.note && (
                <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <strong>📝 Ghi chú:</strong> {selected.note}
                </div>
              )}

              <table className="data-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Món ăn</th>
                    <th>Danh mục</th>
                    <th>SL</th>
                    <th>Đơn giá</th>
                    <th>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items?.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td><span className="badge badge-default">{item.category_name}</span></td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>×{item.quantity}</td>
                      <td>{formatCurrency(item.unit_price)}</td>
                      <td style={{ fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, color: '#6b7280' }}>Tổng tiền: <strong>{formatCurrency(selected.subtotal)}</strong></div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', marginTop: 4 }}>
                  Tổng thanh toán: <span style={{ color: '#f59e0b' }}>{formatCurrency(selected.total_amount)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetail(false)}>Đóng</button>
              {selected.status === 'completed' ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowInvoiceModal(true)}
                >
                  🖨️ Xem & In hóa đơn
                </button>
              ) : (
                <button
                  className="btn btn-success"
                  onClick={() => setShowInvoiceModal(true)}
                >
                  🧾 Xuất hóa đơn & Thanh toán
                </button>
              )}
              {getNextStatus(selected.status) && (
                <button className="btn btn-primary"
                  onClick={() => updateStatus(selected.id, getNextStatus(selected.status))}>
                  ▶ {getStatusLabel(getNextStatus(selected.status))}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice & Payment Modal */}
      <InvoiceModal
        isOpen={showInvoiceModal}
        order={selected}
        isPaid={selected?.status === 'completed'}
        onClose={() => setShowInvoiceModal(false)}
        onPaymentSuccess={() => {
          load()
          setShowDetail(false)
        }}
        onViewDashboard={() => {
          setShowInvoiceModal(false)
          navigate('/payments?tab=dashboard')
        }}
      />
    </div>
  )
}
