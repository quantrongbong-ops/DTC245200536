import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('restaurant_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('restaurant_token')
      if (savedToken) {
        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
          const res = await api.get('/auth/me')
          setUser(res.data.data)
          setToken(savedToken)
        } catch {
          localStorage.removeItem('restaurant_token')
          delete api.defaults.headers.common['Authorization']
          setToken(null)
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password })
    const { token: newToken, user: userData } = res.data.data
    localStorage.setItem('restaurant_token', newToken)
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    setToken(newToken)
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('restaurant_token')
    delete api.defaults.headers.common['Authorization']
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
