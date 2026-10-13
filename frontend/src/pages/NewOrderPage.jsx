import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { tableService, menuService, orderService } from '../services/api'
import { formatCurrency, getMenuEmoji } from '../utils/helpers'

export default function NewOrderPage() {
  const [searchParams] = useSearchParams()
  const tableId = searchParams.get('table')
  const navigate = useNavigate()

  const [table, setTable] = useState(null)
  const [existingOrder, setExistingOrder] = useState(null)
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const tableRes = await tableService.getById(tableId)
        setTable(tableRes.data.data)

        // Bàn đang phục vụ → tải đơn hiện tại để thêm món
        let currentOrder = null
        if (tableRes.data.data.status === 'occupied') {
          try {
            const orderRes = await tableService.getCurrentOrder(tableId)
            currentOrder = orderRes.data.data || null
          } catch { currentOrder = null }
        }
        setExistingOrder(currentOrder)

        const menuRes = await menuService.getAll({ available: true, limit: 100 })
        setMenuItems(menuRes.data.data)

        // Lấy danh mục từ menu items
        const cats = [...new Set(menuRes.data.data.map(m => m.category_name))]
        setCategories(cats)
      } catch {
        toast.error('Không tải được thông tin')
        navigate('/tables')
      } finally {
        setLoading(false)
      }
    }
    if (tableId) load()
    else navigate('/tables')
  }, [tableId, navigate])

  const filteredItems = menuItems.filter(m => {
    const matchCat = activeCategory === 'all' || m.category_name === activeCategory
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.menu_item_id === item.id)
      if (existing) {
        return prev.map(c => c.menu_item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      }
      return [...prev, {
        menu_item_id: item.id,
        name: item.name,
        unit_price: parseFloat(item.price),
        quantity: 1,
        image_url: item.image_url,
        category_name: item.category_name,
      }]
    })
  }

  const updateQty = (itemId, delta) => {
    setCart(prev => {
      const updated = prev.map(c => c.menu_item_id === itemId ? { ...c, quantity: c.quantity + delta } : c)
      return updated.filter(c => c.quantity > 0)
    })
  }

  const subtotal = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0)
  const existingSubtotal = existingOrder ? parseFloat(existingOrder.subtotal || 0) : 0

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error('Vui lòng chọn ít nhất 1 món'); return }
    setSubmitting(true)
    try {
      const payload = {
        items: cart.map(c => ({ menu_item_id: c.menu_item_id, quantity: c.quantity })),
        note,
      }
      if (existingOrder) {
        const res = await orderService.addItems(existingOrder.id, payload)
        toast.success(`Đã thêm món vào đơn ${res.data.data.order_code}!`)
      } else {
        const res = await orderService.create({ ...payload, table_id: parseInt(tableId) })
        toast.success(`Tạo đơn hàng ${res.data.data.order_code} thành công!`)
      }
      navigate('/orders')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi tạo đơn hàng')
    } finally {
      setSubmitting(false)
    }
  }

  const removeExistingItem = async (itemId) => {
    if (!existingOrder) return
    try {
      await orderService.removeItem(existingOrder.id, itemId)
      toast.success('Đã bỏ món khỏi đơn')
      const res = await tableService.getCurrentOrder(tableId)
      setExistingOrder(res.data.data || null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể bỏ món')
    }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>🍽️ {existingOrder ? `Đơn ${existingOrder.order_code} - Thêm món` : `Đặt món - Bàn ${table?.table_number}`}</h2>
          <p>{table?.area} • {table?.capacity} chỗ {existingOrder ? `• Bàn ${table?.table_number}` : ''}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/tables')}>← Quay lại</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>
        {/* Menu Panel */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Danh sách món</h3>
            <div className="search-bar" style={{ maxWidth: 240 }}>
              <span className="search-icon">🔍</span>
              <input placeholder="Tìm món ăn..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="card-body">
            {/* Category Tabs */}
            <div className="filter-tabs" style={{ marginBottom: 20, flexWrap: 'wrap' }}>
              <button
                className={`filter-tab ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >Tất cả</button>
              {categories.map(cat => (
                <button
                  key={cat}
                  className={`filter-tab ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >{cat}</button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="menu-grid">
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.menu_item_id === item.id)
                return (
                  <div
                    key={item.id}
                    className={`menu-item-card ${inCart ? 'selected' : ''}`}
                    onClick={() => addToCart(item)}
                    id={`menu-item-${item.id}`}
                  >
                    <div className="menu-item-img">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                        : getMenuEmoji(item.category_name)
                      }
                    </div>
                    <div className="menu-item-info">
                      <div className="menu-item-name">{item.name}</div>
                      <div className="menu-item-price">{formatCurrency(item.price)}</div>
                    </div>
                    {inCart && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8,
                        background: '#f59e0b', color: 'white',
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700
                      }}>{inCart.quantity}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Cart Panel */}
        <div className="card" style={{ position: 'sticky', top: 80 }}>
          <div className="card-header">
            <h3 className="card-title">🛒 Bàn {table?.table_number}</h3>
            <span className="badge badge-info">{existingOrder ? 'Đang phục vụ' : 'Bàn trống'}</span>
          </div>
          <div className="card-body" style={{ padding: '12px 20px' }}>
            {/* Món đã gọi trong đơn hiện tại */}
            {existingOrder && (
              <>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                  Món đã gọi ({existingOrder.items?.length || 0})
                </h4>
                {existingOrder.items?.length > 0 ? (
                  <div style={{ marginBottom: 12 }}>
                    {existingOrder.items.map(item => (
                      <div key={item.id} className="cart-item" style={{ opacity: 0.85 }}>
                        <div className="cart-item-img">🍽️</div>
                        <div className="cart-item-info">
                          <div className="cart-item-name">{item.name}</div>
                          <div className="cart-item-price">{formatCurrency(item.unit_price)}</div>
                        </div>
                        <span className="qty-value">×{item.quantity}</span>
                        <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700, fontSize: 13 }}>
                          {formatCurrency(item.subtotal)}
                        </div>
                        <button
                          className="btn btn-sm"
                          title="Bỏ món"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                          onClick={() => removeExistingItem(item.id)}
                        >🗑</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>Đơn này chưa có món nào.</p>
                )}
                <div className="divider" />
                <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '4px 0 12px' }}>
                  Món thêm mới
                  {cart.length > 0 && (
                    <button className="btn btn-sm" style={{ float: 'right', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                      onClick={() => setCart([])}>🗑️ Xóa tất cả</button>
                  )}
                </h4>
              </>
            )}

            {!existingOrder && (
              <h4 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
                Danh sách món đã chọn
                {cart.length > 0 && (
                  <button className="btn btn-sm" style={{ float: 'right', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    onClick={() => setCart([])}>🗑️ Xóa tất cả</button>
                )}
              </h4>
            )}

            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#9ca3af' }}>
                <div style={{ fontSize: 40 }}>🛒</div>
                <p style={{ marginTop: 8 }}>{existingOrder ? 'Chọn món để thêm vào đơn' : 'Chưa có món nào được chọn'}</p>
              </div>
            ) : (
              <div>
                {cart.map(item => (
                  <div key={item.menu_item_id} className="cart-item">
                    <div className="cart-item-img">{getMenuEmoji(item.category_name)}</div>
                    <div className="cart-item-info">
                      <div className="cart-item-name">{item.name}</div>
                      <div className="cart-item-price">{formatCurrency(item.unit_price)}</div>
                    </div>
                    <div className="qty-control">
                      <button className="qty-btn" onClick={() => updateQty(item.menu_item_id, -1)}>−</button>
                      <span className="qty-value">{item.quantity}</span>
                      <button className="qty-btn" onClick={() => updateQty(item.menu_item_id, +1)}>+</button>
                    </div>
                    <div style={{ minWidth: 70, textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#f59e0b' }}>
                      {formatCurrency(item.unit_price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="divider" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {existingOrder && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>Tổng hiện tại:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(existingSubtotal)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: '#6b7280' }}>{existingOrder ? 'Món thêm:' : 'Tổng tiền món:'}</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: '#6b7280' }}>Giảm giá:</span>
                <span style={{ color: '#22c55e' }}>0đ</span>
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}>
                <span>{existingOrder ? 'Tổng mới:' : 'Tổng thanh toán:'}</span>
                <span style={{ color: '#f59e0b' }}>{formatCurrency(existingSubtotal + subtotal)}</span>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Ghi chú:</label>
              <textarea className="form-textarea" style={{ height: 60, fontSize: 13 }}
                placeholder="Ghi chú cho bếp..." value={note} onChange={e => setNote(e.target.value)} />
            </div>

            <button
              id="submit-order-btn"
              className="btn btn-success w-full btn-lg"
              style={{ marginTop: 16, justifyContent: 'center' }}
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
            >
              {submitting ? '⏳ Đang xử lý...' : existingOrder ? '➕ Thêm món vào đơn' : '✅ Xác nhận đơn hàng'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
