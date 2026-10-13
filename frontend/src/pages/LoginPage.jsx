import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username.trim() || !form.password.trim()) {
      return toast.error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!')
    }

    setLoading(true)
    try {
      await login(form.username, form.password)
      toast.success('Đăng nhập thành công!')
      navigate('/')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản!')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo & Tên hệ thống OrderNew-System */}
        <div className="login-logo">
          <div className="login-logo-icon">🍜</div>
          <h1>OrderNew-System</h1>
          <p>Hệ thống Quản lý Nhà hàng & Gọi món</p>
        </div>

        {/* Form đăng nhập */}
        <form onSubmit={handleSubmit}>
          {/* Tên đăng nhập */}
          <div className="login-field">
            <label className="login-label" htmlFor="username">
              Tên đăng nhập hoặc Email <span className="required">*</span>
            </label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">👤</span>
              <input
                id="username"
                type="text"
                className="login-input"
                placeholder="Nhập tên đăng nhập hoặc email..."
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoComplete="username"
              />
            </div>
          </div>

          {/* Mật khẩu */}
          <div className="login-field">
            <label className="login-label" htmlFor="password">
              Mật khẩu <span className="required">*</span>
            </label>
            <div className="login-input-wrapper">
              <span className="login-input-icon">🔒</span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder="Nhập mật khẩu..."
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiển thị mật khẩu'}
                tabIndex={-1}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Nút đăng nhập */}
          <button
            id="login-btn"
            type="submit"
            className="login-submit-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                <span>Đang xử lý đăng nhập...</span>
              </>
            ) : (
              <>
                <span>🔐</span>
                <span>Đăng nhập hệ thống</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
