// Utility functions
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '0đ'
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export const getStatusLabel = (status) => {
  const labels = {
    pending:    'Chờ xác nhận',
    confirmed:  'Đã xác nhận',
    preparing:  'Đang nấu',
    ready:      'Sẵn sàng',
    served:     'Đang phục vụ',
    completed:  'Hoàn thành',
    cancelled:  'Đã hủy',
    available:  'Trống',
    occupied:   'Đang phục vụ',
    reserved:   'Đặt trước',
    maintenance:'Bảo trì',
  }
  return labels[status] || status
}

export const getStatusClass = (status) => {
  const classes = {
    pending:    'status-pending',
    confirmed:  'status-confirmed',
    preparing:  'status-preparing',
    ready:      'status-ready',
    served:     'status-served',
    completed:  'status-completed',
    cancelled:  'status-cancelled',
  }
  return classes[status] || 'badge-default'
}

export const getTableStatusClass = (status) => {
  const map = { available: 'badge-success', occupied: 'badge-warning', reserved: 'badge-info', maintenance: 'badge-default' }
  return map[status] || 'badge-default'
}

export const getMenuEmoji = (categoryName) => {
  const map = {
    'Khai vị': '🥗', 'Món chính': '🍜', 'Hải sản': '🦐',
    'Đồ uống': '🧋', 'Tráng miệng': '🍨', 'Lẩu': '🍲',
  }
  return map[categoryName] || '🍽️'
}

export const getPaymentMethodLabel = (method) => {
  const map = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', other: 'Khác' }
  return map[method] || method
}
