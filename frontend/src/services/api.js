import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Gắn token từ localStorage nếu có
const token = localStorage.getItem('restaurant_token')
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

// Response interceptor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('restaurant_token')
      delete api.defaults.headers.common['Authorization']
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

// ============================================================
// Service helpers
// ============================================================
export const authService = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
}

export const dashboardService = {
  getStats: () => api.get('/dashboard/stats'),
  getRevenueChart: (days = 7) => api.get(`/dashboard/revenue-chart?days=${days}`),
  getRecentOrders: (limit = 10) => api.get(`/dashboard/recent-orders?limit=${limit}`),
}

export const categoryService = {
  getAll: () => api.get('/categories'),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  remove: (id) => api.delete(`/categories/${id}`),
}

export const menuService = {
  getAll: (params = {}) => api.get('/menu-items', { params }),
  getById: (id) => api.get(`/menu-items/${id}`),
  create: (data) => api.post('/menu-items', data),
  update: (id, data) => api.put(`/menu-items/${id}`, data),
  toggle: (id) => api.patch(`/menu-items/${id}/toggle`),
  remove: (id) => api.delete(`/menu-items/${id}`),
}

export const tableService = {
  getAll: (params = {}) => api.get('/tables', { params }),
  getById: (id) => api.get(`/tables/${id}`),
  getCurrentOrder: (id) => api.get(`/tables/${id}/current-order`),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  updateStatus: (id, status) => api.patch(`/tables/${id}/status`, { status }),
  transferTable: (fromId, toId) => api.post(`/tables/${fromId}/transfer`, { target_table_id: toId }),
  mergeTables: (sourceId, targetId) => api.post(`/tables/${sourceId}/merge`, { target_table_id: targetId }),
  remove: (id) => api.delete(`/tables/${id}`),
}

export const orderService = {
  getAll: (params = {}) => api.get('/orders', { params }),
  getById: (id) => api.get(`/orders/${id}`),
  getKitchen: () => api.get('/orders/kitchen'),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, status) => api.patch(`/orders/${id}/status`, { status }),
  addItems: (id, data) => api.post(`/orders/${id}/items`, data),
  removeItem: (id, itemId) => api.delete(`/orders/${id}/items/${itemId}`),
  updateItemStatus: (id, itemId, status) => api.patch(`/orders/${id}/items/${itemId}/status`, { status }),
  remove: (id) => api.delete(`/orders/${id}`),
}

export const paymentService = {
  getAll: (params = {}) => api.get('/payments', { params }),
  create: (data) => api.post('/payments', data),
}

export const userService = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
}
