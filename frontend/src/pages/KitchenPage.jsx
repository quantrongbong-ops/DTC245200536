import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { orderService } from '../services'
import { formatTime } from '../utils/helpers'

// Phát âm thanh chuông báo khi có món mới bằng Web Audio API (chuẩn không cần file ngoài)
const playBeep = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5

    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Ignore audio permission restrictions
  }
}

// Cấu hình các cột Kanban
const KANBAN_COLUMNS = [
  {
    id: 'pending',
    title: 'Mới gọi / Chờ chế biến',
    icon: '⏳',
    color: 'amber',
    headerBg: 'bg-amber-500',
    colBg: 'bg-amber-50/40',
    borderColor: 'border-amber-200',
    description: 'Các món đang đợi đầu bếp nhận chế biến',
  },
  {
    id: 'preparing',
    title: 'Đang nấu',
    icon: '🔥',
    color: 'orange',
    headerBg: 'bg-orange-500',
    colBg: 'bg-orange-50/40',
    borderColor: 'border-orange-200',
    description: 'Các món đầu bếp đang thực hiện',
  },
  {
    id: 'ready',
    title: 'Đã sẵn sàng / Ra món',
    icon: '✅',
    color: 'emerald',
    headerBg: 'bg-emerald-600',
    colBg: 'bg-emerald-50/40',
    borderColor: 'border-emerald-200',
    description: 'Đã nấu xong, chờ nhân viên bưng cho khách',
  },
]

export default function KitchenPage() {
  const [kitchenItems, setKitchenItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAudioEnabled, setIsAudioEnabled] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTable, setSelectedTable] = useState('all')
  const [currentTime, setCurrentTime] = useState(new Date())

  // Ref để phát hiện có món mới xuất hiện và phát chuông
  const previousItemIdsRef = useRef(new Set())

  // Đồng hồ cập nhật mỗi giây để tính thời gian trôi qua chính xác
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // 1. Fetch dữ liệu từ API
  const fetchKitchenOrders = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true)
      const res = await orderService.getKitchen()
      const items = res.data?.data || []

      // Kiểm tra món mới để rung chuông
      if (isAudioEnabled && previousItemIdsRef.current.size > 0) {
        const hasNewItem = items.some(
          (item) => item.status === 'pending' && !previousItemIdsRef.current.has(item.id)
        )
        if (hasNewItem) {
          playBeep()
          toast('🔔 Có món mới gửi vào bếp!', { icon: '🍜' })
        }
      }

      previousItemIdsRef.current = new Set(items.map((i) => i.id))
      setKitchenItems(items)
    } catch {
      if (!isSilent) toast.error('Không tải được danh sách đơn bếp!')
    } finally {
      setLoading(false)
    }
  }, [isAudioEnabled])

  // Tự động tải lại mỗi 12 giây
  useEffect(() => {
    fetchKitchenOrders()
    const interval = setInterval(() => {
      fetchKitchenOrders(true)
    }, 12000)
    return () => clearInterval(interval)
  }, [fetchKitchenOrders])

  // Cập nhật trạng thái món ăn
  const handleUpdateItemStatus = async (item, newStatus) => {
    try {
      // Cập nhật optimistic trên giao diện trước để tạo cảm giác tức thì
      setKitchenItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: newStatus } : i))
      )

      await orderService.updateItemStatus(item.id, newStatus)
      toast.success(
        newStatus === 'preparing'
          ? `Bắt đầu nấu: ${item.item_name} (Bàn ${item.table_number})`
          : newStatus === 'ready'
          ? `Đã xong: ${item.item_name} (Bàn ${item.table_number})`
          : `Cập nhật trạng thái thành công`
      )
      // Đồng bộ lại nhẹ nhàng từ server
      fetchKitchenOrders(true)
    } catch {
      toast.error('Lỗi khi cập nhật trạng thái món!')
      fetchKitchenOrders(true)
    }
  }

  // Bật / tắt chế độ toàn màn hình cho màn hình bếp treo tường
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  // Danh sách các bàn đang có đơn tại bếp
  const tableList = useMemo(() => {
    const tables = [...new Set(kitchenItems.map((i) => i.table_number))]
    return ['all', ...tables]
  }, [kitchenItems])

  // Lọc danh sách món ăn
  const filteredItems = useMemo(() => {
    return kitchenItems.filter((item) => {
      const matchTable = selectedTable === 'all' || item.table_number?.toString() === selectedTable?.toString()
      const matchSearch =
        !searchQuery ||
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.order_code?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchTable && matchSearch
    })
  }, [kitchenItems, selectedTable, searchQuery])

  // Phân bổ món vào 3 cột Kanban
  const kanbanData = useMemo(() => {
    return {
      pending: filteredItems.filter((i) => i.status === 'pending'),
      preparing: filteredItems.filter((i) => i.status === 'preparing'),
      ready: filteredItems.filter((i) => i.status === 'ready'),
    }
  }, [filteredItems])

  // Tính số phút chờ và trả về badge màu sắc
  const getElapsedBadge = (createdAt) => {
    if (!createdAt) return null
    const diffMs = currentTime - new Date(createdAt)
    const minutes = Math.max(0, Math.floor(diffMs / 60000))

    if (minutes < 8) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
          ⏱️ {minutes} phút
        </span>
      )
    } else if (minutes < 15) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
          ⏱️ {minutes} phút
        </span>
      )
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 text-red-700 animate-pulse border border-red-300">
          ⚠️ {minutes} phút (Chậm!)
        </span>
      )
    }
  }

  return (
    <div className="space-y-4">
      {/* 1. Header Màn hình bếp */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-2xl">
            👨‍🍳
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              Màn Hình Bếp (KDS)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold">
                {kitchenItems.length} món
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Hệ thống điều phối món thời gian thực • Tự động đồng bộ mỗi 12s
            </p>
          </div>
        </div>

        {/* Thanh công cụ: Âm thanh, Fullscreen, Nút làm mới */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
              isAudioEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Bật / Tắt chuông báo đơn mới"
          >
            <span>{isAudioEnabled ? '🔔 Chuông: Bật' : '🔕 Chuông: Tắt'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
          >
            🖥️ Toàn màn hình
          </button>

          <button
            onClick={() => fetchKitchenOrders()}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow transition active:scale-95"
          >
            🔄 Tải lại
          </button>
        </div>
      </div>

      {/* 2. Bộ lọc nhanh: Theo Bàn ăn & Tìm kiếm món */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-slate-500 uppercase mr-1">Lọc bàn:</span>
          {tableList.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTable(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedTable === t
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t === 'all' ? 'Tất cả bàn' : `Bàn ${t}`}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Tìm tên món, mã đơn..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* 3. Bảng Kanban 3 Cột */}
      {loading && kitchenItems.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm font-semibold text-slate-600">Đang tải danh sách món ăn từ bếp...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4.5">
          {KANBAN_COLUMNS.map((col) => {
            const items = kanbanData[col.id] || []

            return (
              <div
                key={col.id}
                className={`flex flex-col rounded-2xl border-2 ${col.borderColor} ${col.colBg} min-h-[680px] shadow-sm`}
              >
                {/* Column Header */}
                <div className={`p-3.5 rounded-t-xl text-white ${col.headerBg} flex items-center justify-between shadow-sm`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{col.icon}</span>
                    <h3 className="font-extrabold text-sm tracking-wide uppercase">{col.title}</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-xs font-black">
                    {items.length} món
                  </span>
                </div>

                {/* Column Body: Danh sách Card món */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                  {items.length === 0 ? (
                    <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-xl border border-dashed border-slate-300 text-slate-400">
                      <span className="text-3xl mb-2">🍽️</span>
                      <p className="text-xs font-semibold">Chưa có món trong mục này</p>
                    </div>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition space-y-3"
                      >
                        {/* Header card món: Bàn số & Thời gian */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-extrabold text-sm shadow-sm">
                              Bàn {item.table_number}
                            </span>
                            <span className="text-xs font-semibold text-slate-400">
                              #{item.order_code}
                            </span>
                          </div>
                          {getElapsedBadge(item.created_at)}
                        </div>

                        {/* Thông tin món ăn & Số lượng (Font to cho đầu bếp dễ nhìn) */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                              {item.item_name}
                            </h4>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5">
                              <span>Đặt lúc: {formatTime(item.created_at)}</span>
                            </div>
                          </div>
                          <span className="text-2xl font-black text-amber-600 px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200">
                            ×{item.quantity}
                          </span>
                        </div>

                        {/* Ghi chú món (nếu khách dặn không cay, ít đá, v.v.) */}
                        {item.note && (
                          <div className="p-2.5 rounded-lg bg-amber-50/90 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-1.5">
                            <span className="text-sm">⚠️</span>
                            <span>Ghi chú: {item.note}</span>
                          </div>
                        )}

                        {/* Nút bấm chuyển trạng thái cảm ứng (Lớn, dễ chạm trên Tablet) */}
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          {col.id === 'pending' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateItemStatus(item, 'preparing')}
                              className="w-full py-2.5 px-4 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-sm shadow flex items-center justify-center gap-2 transition"
                            >
                              <span>🔥</span> Bắt đầu nấu
                            </button>
                          )}

                          {col.id === 'preparing' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemStatus(item, 'pending')}
                                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs transition"
                                title="Trả lại chờ nấu"
                              >
                                ↩
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemStatus(item, 'ready')}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm shadow flex items-center justify-center gap-2 transition"
                              >
                                <span>✅</span> Hoàn thành / Ra món
                              </button>
                            </>
                          )}

                          {col.id === 'ready' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemStatus(item, 'preparing')}
                                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs transition"
                                title="Nấu lại"
                              >
                                ↩ Nấu lại
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemStatus(item, 'served')}
                                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-sm shadow flex items-center justify-center gap-2 transition"
                              >
                                <span>🍽️</span> Đã bưng món
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
