import axios from 'axios'
import toast from 'react-hot-toast'

// Khởi tạo instance của Axios
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

// Request Interceptor: Tự động đính kèm JWT Bearer Token
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('restaurant_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response Interceptor: Xử lý dữ liệu trả về và bắt lỗi tập trung (401, 403, 500)
axiosClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    const { response } = error

    if (response) {
      const { status, data } = response

      // 401 Unauthorized: Hết hạn token hoặc chưa đăng nhập
      if (status === 401) {
        localStorage.removeItem('restaurant_token')
        delete axiosClient.defaults.headers.common['Authorization']
        if (window.location.pathname !== '/login') {
          toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!')
          setTimeout(() => {
            window.location.href = '/login'
          }, 800)
        }
      }

      // 403 Forbidden: Không có quyền thao tác
      else if (status === 403) {
        toast.error(data?.message || 'Bạn không có quyền thực hiện chức năng này!')
      }

      // 500+ Server Error
      else if (status >= 500) {
        toast.error(data?.message || 'Lỗi hệ thống máy chủ. Vui lòng thử lại sau!')
      }
    } else if (error.code === 'ECONNABORTED') {
      toast.error('Yêu cầu hết thời gian chờ (Timeout). Vui lòng kiểm tra lại mạng!')
    } else {
      toast.error('Không thể kết nối đến máy chủ API!')
    }

    return Promise.reject(error)
  }
)

export default axiosClient
