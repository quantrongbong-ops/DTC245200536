import axiosClient from './axiosClient'
import { ENDPOINTS } from './endpoints'

export const tableService = {
  // Lấy danh sách bàn kèm filter status, area
  getAll: (params = {}) => {
    return axiosClient.get(ENDPOINTS.TABLES.BASE, { params })
  },

  // Chi tiết 1 bàn
  getById: (id) => {
    return axiosClient.get(ENDPOINTS.TABLES.BY_ID(id))
  },

  // Lấy đơn hàng hiện tại đang phục vụ của bàn
  getCurrentOrder: (id) => {
    return axiosClient.get(ENDPOINTS.TABLES.CURRENT_ORDER(id))
  },

  // Thêm bàn mới
  create: (data) => {
    return axiosClient.post(ENDPOINTS.TABLES.BASE, data)
  },

  // Cập nhật thông tin bàn
  update: (id, data) => {
    return axiosClient.put(ENDPOINTS.TABLES.BY_ID(id), data)
  },

  // Cập nhật nhanh trạng thái bàn (available, occupied, reserved, maintenance)
  updateStatus: (id, status) => {
    return axiosClient.patch(ENDPOINTS.TABLES.STATUS(id), { status })
  },

  // Xóa bàn
  remove: (id) => {
    return axiosClient.delete(ENDPOINTS.TABLES.BY_ID(id))
  },

  // Chuyển bàn (chuyển đơn từ bàn này sang bàn khác)
  transferTable: (fromTableId, toTableId) => {
    return axiosClient.post(ENDPOINTS.TABLES.TRANSFER(fromTableId), { target_table_id: toTableId })
  },

  // Gộp bàn
  mergeTables: (sourceTableId, targetTableId) => {
    return axiosClient.post(ENDPOINTS.TABLES.MERGE(sourceTableId), { target_table_id: targetTableId })
  },
}

export default tableService
