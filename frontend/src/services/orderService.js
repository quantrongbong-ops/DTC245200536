import axiosClient from './axiosClient'
import { ENDPOINTS } from './endpoints'

export const orderService = {
  // Lấy danh sách đơn hàng có phân trang và bộ lọc
  getAll: (params = {}) => {
    return axiosClient.get(ENDPOINTS.ORDERS.BASE, { params })
  },

  // Chi tiết đơn hàng
  getById: (id) => {
    return axiosClient.get(ENDPOINTS.ORDERS.BY_ID(id))
  },

  // Lấy danh sách món cho màn hình bếp (Kitchen Display System)
  getKitchen: () => {
    return axiosClient.get(ENDPOINTS.ORDERS.KITCHEN)
  },

  // Tạo đơn hàng mới
  create: (data) => {
    return axiosClient.post(ENDPOINTS.ORDERS.BASE, data)
  },

  // Cập nhật trạng thái đơn hàng (pending, confirmed, preparing, ready, served, completed, cancelled)
  updateStatus: (id, status) => {
    return axiosClient.patch(ENDPOINTS.ORDERS.STATUS(id), { status })
  },

  // Cập nhật trạng thái từng món ăn cho bếp
  updateItemStatus: (itemId, status) => {
    return axiosClient.patch(ENDPOINTS.ORDERS.ITEM_STATUS(itemId), { status })
  },

  // Xóa / Hủy đơn hàng
  remove: (id) => {
    return axiosClient.delete(ENDPOINTS.ORDERS.BY_ID(id))
  },
}

export default orderService
