import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { userService } from '../services/api'
import { formatDate } from '../utils/helpers'
import { useAuth } from '../contexts/AuthContext'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'staff', email: '', phone: '' })
  const { user: currentUser } = useAuth()

  const load = async () => {
    setLoading(true)
    try {
      const res = await userService.getAll()
      setUsers(res.data.data)
    } catch { toast.error('Không tải được danh sách nhân viên') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.username || !form.password || !form.full_name) {
      toast.error('Vui lòng nhập đầy đủ thông tin bắt buộc')
      return
    }
    try {
      await userService.create(form)
      toast.success('Tạo tài khoản thành công')
      setShowModal(false)
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi khi tạo tài khoản') }
  }

  const handleToggleActive = async (u) => {
    try {
      await userService.update(u.id, { ...u, is_active: !u.is_active })
      toast.success('Cập nhật trạng thái thành công')
      load()
    } catch { toast.error('Lỗi cập nhật') }
  }

  const ROLE_LABELS = { admin: '👑 Quản lý', staff: '👤 Nhân viên', cashier: '💰 Thu ngân' }
  const ROLE_COLORS = { admin: 'badge-warning', staff: 'badge-info', cashier: 'badge-success' }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Quản lý nhân viên</h2>
          <p>{users.length} tài khoản</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ username: '', password: '', full_name: '', role: 'staff', email: '', phone: '' }); setShowModal(true) }}>
          + Thêm nhân viên
        </button>
      </div>

      <div className="card">
        <div className="table-wrapper">
          {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tên đầy đủ</th>
                  <th>Tên đăng nhập</th>
                  <th>Vai trò</th>
                  <th>Email</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0
                        }}>
                          {u.full_name?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                      </div>
                    </td>
                    <td><code style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{u.username}</code></td>
                    <td><span className={`badge ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                    <td style={{ color: '#6b7280' }}>{u.email || '—'}</td>
                    <td>
                      <label className="toggle">
                        <input type="checkbox" checked={u.is_active}
                          onChange={() => u.id !== currentUser?.id && handleToggleActive(u)}
                          disabled={u.id === currentUser?.id} />
                        <span className="toggle-slider"></span>
                      </label>
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(u.created_at)}</td>
                    <td>
                      {u.id !== currentUser?.id && (
                        <button className="btn btn-danger btn-sm" onClick={async () => {
                          if (!confirm(`Xóa tài khoản ${u.username}?`)) return
                          try { await userService.remove(u.id); toast.success('Xóa thành công'); load() }
                          catch (err) { toast.error(err.response?.data?.message || 'Lỗi xóa') }
                        }}>🗑️</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm nhân viên mới</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tên đăng nhập <span className="required">*</span></label>
                  <input className="form-input" value={form.username}
                    onChange={e => setForm({ ...form, username: e.target.value })} placeholder="staff01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Mật khẩu <span className="required">*</span></label>
                  <input className="form-input" type="password" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Ít nhất 6 ký tự" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Họ và tên <span className="required">*</span></label>
                <input className="form-input" value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Nguyễn Văn A" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Vai trò</label>
                  <select className="form-select" value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="staff">Nhân viên</option>
                    <option value="cashier">Thu ngân</option>
                    <option value="admin">Quản lý</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={handleSave}>Tạo tài khoản</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
