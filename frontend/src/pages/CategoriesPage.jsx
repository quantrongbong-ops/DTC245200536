import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { categoryService } from '../services/api'

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', sort_order: 0 })

  const load = async () => {
    setLoading(true)
    try {
      const res = await categoryService.getAll()
      setCategories(res.data.data)
    } catch { toast.error('Lỗi tải danh mục') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEdit(null)
    setForm({ name: '', description: '', sort_order: 0 })
    setShowModal(true)
  }

  const openEdit = (cat) => {
    setEdit(cat)
    setForm({ name: cat.name, description: cat.description || '', sort_order: cat.sort_order })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Tên danh mục không được trống'); return }
    try {
      if (edit) {
        await categoryService.update(edit.id, { ...form, is_active: true })
        toast.success('Cập nhật danh mục thành công')
      } else {
        await categoryService.create(form)
        toast.success('Thêm danh mục thành công')
      }
      setShowModal(false)
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi khi lưu') }
  }

  const handleDelete = async (cat) => {
    if (!confirm(`Xóa danh mục "${cat.name}"?`)) return
    try {
      await categoryService.remove(cat.id)
      toast.success('Xóa danh mục thành công')
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Không thể xóa') }
  }

  const CATEGORY_ICONS = {
    'Khai vị': '🥗', 'Món chính': '🍜', 'Hải sản': '🦐',
    'Đồ uống': '🧋', 'Tráng miệng': '🍨', 'Lẩu': '🍲',
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Danh mục món ăn</h2>
          <p>{categories.length} danh mục</p>
        </div>
        <button className="btn btn-primary" id="add-category-btn" onClick={openCreate}>+ Thêm danh mục</button>
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {categories.map(cat => (
            <div key={cat.id} className="card" style={{ transition: 'transform 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg, #fef3c7, #fed7aa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0
                  }}>
                    {CATEGORY_ICONS[cat.name] || '🍽️'}
                  </div>
                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: 16 }}>{cat.name}</h3>
                    <p style={{ fontSize: 12, color: '#6b7280' }}>Thứ tự: {cat.sort_order}</p>
                  </div>
                </div>
                {cat.description && <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>{cat.description}</p>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#374151' }}>
                    🍽️ <strong>{cat.item_count}</strong> món đang bán
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cat)}>✏️ Sửa</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cat)}>🗑️</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{edit ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Tên danh mục <span className="required">*</span></label>
                <input className="form-input" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} placeholder="VD: Khai vị" />
              </div>
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <textarea className="form-textarea" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Thứ tự hiển thị</label>
                <input className="form-input" type="number" min="0"
                  value={form.sort_order} onChange={e => setForm({ ...form, sort_order: parseInt(e.target.value) })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {edit ? 'Cập nhật' : 'Thêm danh mục'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
