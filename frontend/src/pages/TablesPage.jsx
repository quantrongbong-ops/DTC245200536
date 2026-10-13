import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { tableService, orderService } from '../services'
import { formatCurrency, formatDateTime } from '../utils/helpers'

// Cấu hình nhãn và style trạng thái bàn
const TABLE_STATUS_CONFIG = {
  available: {
    label: 'Bàn trống',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20',
    dotClass: 'bg-emerald-500',
    borderClass: 'border-emerald-200 hover:border-emerald-400',
    accentBg: 'bg-emerald-50/50',
    icon: '🟢',
  },
  occupied: {
    label: 'Đang phục vụ',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20',
    dotClass: 'bg-amber-500 animate-pulse',
    borderClass: 'border-amber-300 hover:border-amber-500',
    accentBg: 'bg-amber-50/40',
    icon: '🍽️',
  },
  reserved: {
    label: 'Đã đặt trước',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500/20',
    dotClass: 'bg-blue-500',
    borderClass: 'border-blue-200 hover:border-blue-400',
    accentBg: 'bg-blue-50/50',
    icon: '📅',
  },
  maintenance: {
    label: 'Bảo trì',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 ring-slate-400/20',
    dotClass: 'bg-slate-400',
    borderClass: 'border-slate-200 hover:border-slate-400',
    accentBg: 'bg-slate-50',
    icon: '🔧',
  },
}

export default function TablesPage() {
  const navigate = useNavigate()

  // State danh sách bàn và bộ lọc
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedArea, setSelectedArea] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Cache thông tin đơn hàng hiện tại cho các bàn occupied
  const [ordersMap, setOrdersMap] = useState({})

  // State các Modal tương tác
  const [tableModal, setTableModal] = useState({ isOpen: false, mode: 'create', data: null })
  const [transferModal, setTransferModal] = useState({ isOpen: false, sourceTable: null, targetTableId: '' })
  const [mergeModal, setMergeModal] = useState({ isOpen: false, sourceTable: null, targetTableId: '' })
  const [orderPreviewModal, setOrderPreviewModal] = useState({ isOpen: false, table: null, order: null })

  // Form thêm / sửa bàn
  const [formData, setFormData] = useState({ table_number: '', area: 'Tầng 1', capacity: 4 })
  const [submitting, setSubmitting] = useState(false)

  // 1. Tải danh sách bàn
  const fetchTables = useCallback(async () => {
    try {
      setLoading(true)
      const res = await tableService.getAll()
      const tablesList = res.data?.data || []
      setTables(tablesList)

      // Với các bàn đang có khách ('occupied'), fetch song song thông tin đơn hàng
      const occupiedTables = tablesList.filter((t) => t.status === 'occupied')
      if (occupiedTables.length > 0) {
        const orderPromises = occupiedTables.map((t) =>
          tableService.getCurrentOrder(t.id).catch(() => ({ data: { data: null } }))
        )
        const orderResults = await Promise.all(orderPromises)
        const map = {}
        occupiedTables.forEach((t, idx) => {
          map[t.id] = orderResults[idx].data?.data || null
        })
        setOrdersMap(map)
      } else {
        setOrdersMap({})
      }
    } catch {
      toast.error('Không tải được danh sách sơ đồ bàn!')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  // Danh sách các khu vực hiện có
  const areaList = useMemo(() => {
    const areas = [...new Set(tables.map((t) => t.area || 'Tầng 1'))]
    return ['all', ...areas]
  }, [tables])

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = tables.length
    const available = tables.filter((t) => t.status === 'available').length
    const occupied = tables.filter((t) => t.status === 'occupied').length
    const reserved = tables.filter((t) => t.status === 'reserved').length
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0
    return { total, available, occupied, reserved, occupancyRate }
  }, [tables])

  // Lọc danh sách bàn theo tab khu vực, trạng thái và tìm kiếm
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      const matchArea = selectedArea === 'all' || (t.area || 'Tầng 1') === selectedArea
      const matchStatus = selectedStatus === 'all' || t.status === selectedStatus
      const matchSearch =
        !searchTerm ||
        t.table_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.area?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchArea && matchStatus && matchSearch
    })
  }, [tables, selectedArea, selectedStatus, searchTerm])

  // Nhóm theo khu vực để hiển thị trực quan
  const groupedTables = useMemo(() => {
    const groups = {}
    filteredTables.forEach((t) => {
      const area = t.area || 'Tầng 1'
      if (!groups[area]) groups[area] = []
      groups[area].push(t)
    })
    return groups
  }, [filteredTables])

  // ============================================================
  // Handlers thao tác
  // ============================================================

  // Click vào bàn: nếu có khách mở xem đơn, nếu trống chuyển qua tạo đơn mới
  const handleTableClick = async (table) => {
    if (table.status === 'occupied') {
      const order = ordersMap[table.id]
      if (order) {
        setOrderPreviewModal({ isOpen: true, table, order })
      } else {
        try {
          const res = await tableService.getCurrentOrder(table.id)
          setOrderPreviewModal({ isOpen: true, table, order: res.data?.data })
        } catch {
          navigate(`/order/new?table=${table.id}`)
        }
      }
    } else {
      navigate(`/order/new?table=${table.id}`)
    }
  }

  // Đổi trạng thái nhanh (Trống <-> Đặt trước)
  const handleQuickStatusChange = async (table, newStatus, e) => {
    e.stopPropagation()
    try {
      await tableService.updateStatus(table.id, newStatus)
      toast.success(`Đã cập nhật Bàn ${table.table_number} sang "${TABLE_STATUS_CONFIG[newStatus].label}"`)
      fetchTables()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái bàn!')
    }
  }

  // Xóa bàn
  const handleDeleteTable = async (table, e) => {
    e.stopPropagation()
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Bàn ${table.table_number} (${table.area})?`)) return
    try {
      await tableService.remove(table.id)
      toast.success(`Đã xóa Bàn ${table.table_number} thành công`)
      fetchTables()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể xóa bàn đang có đơn hàng!')
    }
  }

  // Mở modal thêm bàn
  const openCreateModal = () => {
    setFormData({ table_number: '', area: selectedArea !== 'all' ? selectedArea : 'Tầng 1', capacity: 4 })
    setTableModal({ isOpen: true, mode: 'create', data: null })
  }

  // Mở modal sửa bàn
  const openEditModal = (table, e) => {
    e.stopPropagation()
    setFormData({ table_number: table.table_number, area: table.area || 'Tầng 1', capacity: table.capacity || 4 })
    setTableModal({ isOpen: true, mode: 'edit', data: table })
  }

  // Lưu thông tin bàn
  const handleSaveTable = async (e) => {
    e.preventDefault()
    if (!formData.table_number.trim()) {
      return toast.error('Vui lòng nhập số bàn!')
    }
    setSubmitting(true)
    try {
      if (tableModal.mode === 'create') {
        await tableService.create(formData)
        toast.success(`Thêm Bàn ${formData.table_number} thành công!`)
      } else {
        await tableService.update(tableModal.data.id, formData)
        toast.success(`Cập nhật Bàn ${formData.table_number} thành công!`)
      }
      setTableModal({ isOpen: false, mode: 'create', data: null })
      fetchTables()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu bàn!')
    } finally {
      setSubmitting(false)
    }
  }

  // Chuyển bàn
  const handleExecuteTransfer = async (e) => {
    e.preventDefault()
    if (!transferModal.targetTableId) {
      return toast.error('Vui lòng chọn bàn trống đích đến!')
    }
    try {
      await tableService.transferTable(transferModal.sourceTable.id, transferModal.targetTableId)
      toast.success('Chuyển bàn thành công!')
      setTransferModal({ isOpen: false, sourceTable: null, targetTableId: '' })
      fetchTables()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Chuyển bàn thất bại!')
    }
  }

  // Gộp bàn
  const handleExecuteMerge = async (e) => {
    e.preventDefault()
    if (!mergeModal.targetTableId) {
      return toast.error('Vui lòng chọn bàn cần gộp vào!')
    }
    try {
      await tableService.mergeTables(mergeModal.sourceTable.id, mergeModal.targetTableId)
      toast.success('Gộp bàn thành công!')
      setMergeModal({ isOpen: false, sourceTable: null, targetTableId: '' })
      fetchTables()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gộp bàn thất bại!')
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            🪑 Sơ Đồ Bàn Ăn
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {tables.length} bàn
            </span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý trực quan trạng thái bàn ăn, thao tác nhanh chuyển bàn, gộp bàn và gọi món.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTables}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition"
            title="Tải lại dữ liệu"
          >
            <span>🔄</span> Làm mới
          </button>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-500 rounded-lg shadow hover:bg-amber-600 transition active:scale-95"
          >
            <span>➕</span> Thêm bàn mới
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg">🏢</div>
          <div>
            <div className="text-xl font-bold text-slate-800">{stats.total}</div>
            <div className="text-xs font-medium text-slate-500">Tổng số bàn</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">🟢</div>
          <div>
            <div className="text-xl font-bold text-emerald-600">{stats.available}</div>
            <div className="text-xs font-medium text-slate-500">Bàn trống</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-lg">🍽️</div>
          <div>
            <div className="text-xl font-bold text-amber-600">{stats.occupied}</div>
            <div className="text-xs font-medium text-slate-500">Đang phục vụ</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg">📅</div>
          <div>
            <div className="text-xl font-bold text-blue-600">{stats.reserved}</div>
            <div className="text-xs font-medium text-slate-500">Đặt trước</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 shadow-sm flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">📈</div>
          <div>
            <div className="text-xl font-bold text-indigo-600">{stats.occupancyRate}%</div>
            <div className="text-xs font-medium text-slate-500">Tỷ lệ sử dụng</div>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls: Khu vực, Trạng thái, Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3.5">
        {/* Hàng 1: Tabs Khu vực */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Khu vực:</span>
          {areaList.map((area) => (
            <button
              key={area}
              onClick={() => setSelectedArea(area)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                selectedArea === area
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {area === 'all' ? 'Tất cả khu vực' : `📍 ${area}`}
              <span className="ml-1.5 opacity-70">
                ({area === 'all' ? tables.length : tables.filter((t) => (t.area || 'Tầng 1') === area).length})
              </span>
            </button>
          ))}
        </div>

        {/* Hàng 2: Trạng thái & Ô Tìm kiếm */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Trạng thái:</span>
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'available', label: 'Trống' },
              { key: 'occupied', label: 'Có khách' },
              { key: 'reserved', label: 'Đã đặt' },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setSelectedStatus(st.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedStatus === st.key
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <div className="w-full sm:w-72">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Tìm số bàn, khu vực..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Floor Layout Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-medium text-slate-500">Đang tải trạng thái sơ đồ bàn...</p>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <div className="text-5xl mb-3">🪑</div>
          <h3 className="text-base font-bold text-slate-700">Không tìm thấy bàn nào</h3>
          <p className="text-xs text-slate-500 mt-1">Hãy thử thay đổi bộ lọc hoặc thêm bàn mới vào hệ thống.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedTables).map(([areaName, areaTables]) => (
            <div key={areaName} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <h2 className="text-base font-bold text-slate-800">
                  {areaName} ({areaTables.length} bàn)
                </h2>
                <div className="flex-1 border-t border-slate-200 ml-2"></div>
              </div>

              {/* Grid các thẻ bàn */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {areaTables.map((table) => {
                  const cfg = TABLE_STATUS_CONFIG[table.status] || TABLE_STATUS_CONFIG.available
                  const activeOrder = ordersMap[table.id]

                  return (
                    <div
                      key={table.id}
                      onClick={() => handleTableClick(table)}
                      className={`group relative bg-white rounded-xl border-2 p-3.5 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${cfg.borderClass} ${cfg.accentBg}`}
                    >
                      {/* Header thẻ bàn: Số bàn & Badge trạng thái */}
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotClass}`}></span>
                          <span className="font-extrabold text-base text-slate-900 group-hover:text-amber-600 transition">
                            Bàn {table.table_number}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">👥 {table.capacity}</span>
                      </div>

                      {/* Badge trạng thái */}
                      <div className="mb-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.badgeClass}`}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      {/* Thông tin đơn hàng (nếu đang phục vụ) */}
                      {table.status === 'occupied' && (
                        <div className="my-2 p-2 rounded-lg bg-amber-50 border border-amber-200/60 text-xs space-y-1">
                          <div className="flex justify-between items-center text-slate-600">
                            <span>Mã đơn:</span>
                            <span className="font-bold text-amber-700">{activeOrder?.order_code || '---'}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-700">
                            <span>Tạm tính:</span>
                            <span className="font-extrabold text-amber-800">
                              {activeOrder ? formatCurrency(activeOrder.total_amount) : '0đ'}
                            </span>
                          </div>
                          {activeOrder?.items && (
                            <div className="text-[10px] text-slate-500 text-right">
                              {activeOrder.items.length} món ăn
                            </div>
                          )}
                        </div>
                      )}

                      {/* Thao tác nhanh bên dưới thẻ bàn */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-1">
                        {table.status === 'occupied' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setTransferModal({ isOpen: true, sourceTable: table, targetTableId: '' })
                              }}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                              title="Chuyển bàn"
                            >
                              🔄 Chuyển
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setMergeModal({ isOpen: true, sourceTable: table, targetTableId: '' })
                              }}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition"
                              title="Gộp bàn"
                            >
                              🔀 Gộp
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/orders/new?table=${table.id}`)
                              }}
                              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold transition"
                              title="Gọi thêm món"
                            >
                              ➕ Món
                            </button>
                          </>
                        ) : table.status === 'available' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleQuickStatusChange(table, 'reserved', e)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 font-medium transition text-[11px]"
                            >
                              📅 Đặt bàn
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/order/new?table=${table.id}`)
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition text-[11px]"
                            >
                              ⚡ Mở bàn
                            </button>
                          </>
                        ) : table.status === 'reserved' ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleQuickStatusChange(table, 'available', e)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition text-[11px]"
                            >
                              ✕ Hủy đặt
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/order/new?table=${table.id}`)
                              }}
                              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-semibold transition text-[11px]"
                            >
                              Nhận bàn
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleQuickStatusChange(table, 'available', e)}
                            className="w-full py-1 rounded bg-slate-100 text-slate-700 font-medium text-center"
                          >
                            Mở lại bàn
                          </button>
                        )}

                        {/* Menu quản trị bàn: Sửa / Xóa */}
                        <div className="relative group/menu">
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                          >
                            ⋮
                          </button>
                          <div className="hidden group-hover/menu:block absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-lg p-1 z-20 min-w-[100px]">
                            <button
                              type="button"
                              onClick={(e) => openEditModal(table, e)}
                              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-slate-50 text-slate-700"
                            >
                              ✏️ Sửa bàn
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTable(table, e)}
                              className="w-full text-left px-2 py-1 rounded text-xs hover:bg-red-50 text-red-600"
                            >
                              🗑️ Xóa bàn
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================
          5. Modal Chuyển Bàn (Transfer Table Modal)
          ============================================================ */}
      {transferModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                🔄 Chuyển Bàn {transferModal.sourceTable?.table_number}
              </h3>
              <button
                onClick={() => setTransferModal({ isOpen: false, sourceTable: null, targetTableId: '' })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="p-5 space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800">
                Chuyển toàn bộ đơn hàng đang hoạt động của <strong>Bàn {transferModal.sourceTable?.table_number}</strong> sang bàn đích còn trống. Bàn nguồn sẽ được giải phóng trở về trạng thái trống.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn bàn đích (chỉ các bàn đang trống):
                </label>
                <select
                  required
                  value={transferModal.targetTableId}
                  onChange={(e) => setTransferModal({ ...transferModal, targetTableId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Chọn bàn trống --</option>
                  {tables
                    .filter((t) => t.status === 'available' && t.id !== transferModal.sourceTable?.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        Bàn {t.table_number} ({t.area} - {t.capacity} chỗ)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTransferModal({ isOpen: false, sourceTable: null, targetTableId: '' })}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 shadow"
                >
                  Xác nhận chuyển bàn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          6. Modal Gộp Bàn (Merge Tables Modal)
          ============================================================ */}
      {mergeModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                🔀 Gộp Bàn {mergeModal.sourceTable?.table_number}
              </h3>
              <button
                onClick={() => setMergeModal({ isOpen: false, sourceTable: null, targetTableId: '' })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteMerge} className="p-5 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-xs text-blue-800">
                Toàn bộ món ăn từ <strong>Bàn {mergeModal.sourceTable?.table_number}</strong> sẽ được sáp nhập vào đơn hàng của bàn đích được chọn.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn bàn đích gộp vào:
                </label>
                <select
                  required
                  value={mergeModal.targetTableId}
                  onChange={(e) => setMergeModal({ ...mergeModal, targetTableId: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Chọn bàn đích --</option>
                  {tables
                    .filter((t) => t.id !== mergeModal.sourceTable?.id && (t.status === 'occupied' || t.status === 'available'))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        Bàn {t.table_number} ({t.area} - {TABLE_STATUS_CONFIG[t.status]?.label})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMergeModal({ isOpen: false, sourceTable: null, targetTableId: '' })}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow"
                >
                  Xác nhận gộp bàn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          7. Modal Xem Nhanh Đơn Hàng Bàn Đang Phục Vụ
          ============================================================ */}
      {orderPreviewModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  Bàn {orderPreviewModal.table?.table_number} - Đơn #{orderPreviewModal.order?.order_code || '---'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Khu vực: {orderPreviewModal.table?.area} • Bắt đầu: {formatDateTime(orderPreviewModal.order?.created_at)}
                </p>
              </div>
              <button
                onClick={() => setOrderPreviewModal({ isOpen: false, table: null, order: null })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Danh sách món đã gọi:</div>
              {orderPreviewModal.order?.items && orderPreviewModal.order.items.length > 0 ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {orderPreviewModal.order.items.map((item, i) => (
                    <div key={item.id || i} className="p-3 flex items-center justify-between text-sm hover:bg-slate-50">
                      <div>
                        <div className="font-semibold text-slate-800">{item.name}</div>
                        <div className="text-xs text-slate-400">
                          {formatCurrency(item.unit_price)} × {item.quantity}
                          {item.note && <span className="ml-2 text-amber-600 font-medium">({item.note})</span>}
                        </div>
                      </div>
                      <div className="font-bold text-slate-800">{formatCurrency(item.subtotal)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400 text-sm">Chưa có món nào được chọn.</div>
              )}

              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200/80 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">Tổng thanh toán tạm tính:</span>
                <span className="text-lg font-extrabold text-amber-700">
                  {formatCurrency(orderPreviewModal.order?.total_amount || 0)}
                </span>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOrderPreviewModal({ isOpen: false, table: null, order: null })}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
              >
                Đóng
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const tId = orderPreviewModal.table?.id
                    setOrderPreviewModal({ isOpen: false, table: null, order: null })
                    navigate(`/orders/new?table=${tId}`)
                  }}
                  className="px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
                >
                  ➕ Gọi thêm món
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const orderId = orderPreviewModal.order?.id
                    setOrderPreviewModal({ isOpen: false, table: null, order: null })
                    navigate(`/payments?tab=pending&orderId=${orderId}`)
                  }}
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow transition"
                >
                  💳 Xuất hóa đơn & Thanh toán
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          8. Modal Thêm / Sửa Bàn
          ============================================================ */}
      {tableModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-base">
                {tableModal.mode === 'create' ? '➕ Thêm bàn mới' : `✏️ Chỉnh sửa Bàn ${tableModal.data?.table_number}`}
              </h3>
              <button
                onClick={() => setTableModal({ isOpen: false, mode: 'create', data: null })}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số hiệu bàn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 01, 02, VIP-1..."
                  value={formData.table_number}
                  onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khu vực</label>
                  <select
                    value={formData.area}
                    onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="Tầng 1">Tầng 1</option>
                    <option value="Tầng 2">Tầng 2</option>
                    <option value="Sân vườn">Sân vườn</option>
                    <option value="Phòng VIP">Phòng VIP</option>
                    <option value="Tầng thượng">Tầng thượng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sức chứa (ghế) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 2 })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTableModal({ isOpen: false, mode: 'create', data: null })}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 shadow disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : tableModal.mode === 'create' ? 'Tạo bàn' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
