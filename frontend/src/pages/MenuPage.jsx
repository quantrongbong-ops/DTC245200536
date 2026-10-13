import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { menuService, categoryService } from '../services/api'
import { formatCurrency, getMenuEmoji } from '../utils/helpers'

export default function MenuPage() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({
    name: '', category_id: '', price: '', description: '', image_url: '', is_available: true
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, limit: 15 }
      if (catFilter) params.category_id = catFilter
      if (search) params.search = search
      const [itemsRes, catsRes] = await Promise.all([
        menuService.getAll(params),
        categoryService.getAll(),
      ])
      setItems(itemsRes.data.data)
      setTotalPages(itemsRes.data.pagination.total_pages)
      setCategories(catsRes.data.data)
    } catch { toast.error('Không tải được dữ liệu') }
    finally { setLoading(false) }
  }, [page, catFilter, search])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditItem(null)
    setForm({ name: '', category_id: categories[0]?.id || '', price: '', description: '', image_url: '', is_available: true })
    setShowModal(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name: item.name, category_id: item.category_id, price: item.price,
      description: item.description || '', image_url: item.image_url || '', is_available: item.is_available
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.category_id || !form.price) {
      toast.error('Vui lòng điền đầy đủ tên, danh mục và giá')
      return
    }
    if (parseFloat(form.price) < 0) { toast.error('Giá không được âm'); return }
    try {
      if (editItem) {
        await menuService.update(editItem.id, form)
        toast.success('Cập nhật món ăn thành công')
      } else {
        await menuService.create(form)
        toast.success('Thêm món ăn thành công')
      }
      setShowModal(false)
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi khi lưu') }
  }

  const handleToggle = async (item) => {
    try {
      await menuService.toggle(item.id)
      setItems(prev => prev.map(m => m.id === item.id ? { ...m, is_available: !m.is_available } : m))
    } catch { toast.error('Lỗi khi thay đổi trạng thái') }
  }

  const handleDelete = async (item) => {
    if (!confirm(`Xóa món "${item.name}"?`)) return
    try {
      await menuService.remove(item.id)
      toast.success('Xóa món ăn thành công')
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Không thể xóa') }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Quản lý thực đơn</h2>
          <p>{items.length} món ăn</p>
        </div>
        <button className="btn btn-primary" id="add-menu-btn" onClick={openCreate}>+ Thêm món</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input placeholder="Tìm tên món ăn..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="form-select" style={{ width: 200 }} value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
          <option value="">Tất cả danh mục</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          {loading ? <div className="loading-spinner"><div className="spinner"></div></div> :
            items.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🍽️</span>
                <h3>Chưa có món ăn nào</h3>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hình ảnh</th>
                    <th>Tên món</th>
                    <th>Danh mục</th>
                    <th>Giá bán</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div className="img-thumbnail">
                          {item.image_url
                            ? <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                            : getMenuEmoji(item.category_name)
                          }
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        {item.description && <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.description.substring(0, 50)}...</div>}
                      </td>
                      <td><span className="badge badge-info">{item.category_name}</span></td>
                      <td style={{ fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(item.price)}</td>
                      <td>
                        <label className="toggle">
                          <input type="checkbox" checked={item.is_available}
                            onChange={() => handleToggle(item)} />
                          <span className="toggle-slider"></span>
                        </label>
                        <span style={{ marginLeft: 8, fontSize: 12, color: item.is_available ? '#22c55e' : '#9ca3af' }}>
                          {item.is_available ? 'Đang bán' : 'Tạm ngừng'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => openEdit(item)} title="Sửa">✏️</button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(item)} title="Xóa">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Sửa món ăn' : 'Thêm món ăn mới'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tên món <span className="required">*</span></label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nhập tên món ăn" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Danh mục <span className="required">*</span></label>
                  <select className="form-select" value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">Chọn danh mục</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Giá bán (VNĐ) <span className="required">*</span></label>
                  <input className="form-input" type="number" min="0" step="1000"
                    value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="VD: 75000" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <textarea className="form-textarea" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Mô tả ngắn về món ăn" />
              </div>
              <div className="form-group">
                <label className="form-label">URL hình ảnh</label>
                <input className="form-input" value={form.image_url}
                  onChange={e => setForm({ ...form, image_url: e.target.value })}
                  placeholder="/images/ten-mon.jpg" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label className="toggle">
                  <input type="checkbox" checked={form.is_available}
                    onChange={e => setForm({ ...form, is_available: e.target.checked })} />
                  <span className="toggle-slider"></span>
                </label>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Đang kinh doanh</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editItem ? 'Cập nhật' : 'Thêm món'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
