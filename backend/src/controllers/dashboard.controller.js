// ============================================================
// Dashboard Controller - Truy vấn thực từ database
// ============================================================
const { query } = require('../config/database');
const { parsePositiveInt } = require('../utils/query');
const logger = require('../utils/logger');

// GET /api/v1/dashboard/stats
const getStats = async (req, res) => {
  try {
    // Lấy "hôm nay" theo múi giờ Việt Nam từ chính database để tránh lệch ngày
    const todayResult = await query("SELECT TO_CHAR(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS today");
    const today = todayResult.rows[0].today;

    const [tablesResult, ordersResult, revenueResult, menuResult] = await Promise.all([
      // Thống kê bàn
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'available')  AS available,
          COUNT(*) FILTER (WHERE status = 'occupied')   AS occupied,
          COUNT(*) FILTER (WHERE status = 'reserved')   AS reserved
        FROM dining_tables
      `),
      // Đơn hàng hôm nay
      query(`
        SELECT
          COUNT(*) AS total_orders,
          COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled')) AS active_orders
        FROM orders
        WHERE DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = $1
      `, [today]),
      // Doanh thu hôm nay
      query(`
        SELECT COALESCE(SUM(total_amount), 0) AS today_revenue
        FROM orders
        WHERE status = 'completed'
          AND DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = $1
      `, [today]),
      // Số món ăn đang bán
      query(`SELECT COUNT(*) AS total FROM menu_items WHERE is_available = TRUE`),
    ]);

    res.json({
      success: true,
      data: {
        tables: {
          total:     parseInt(tablesResult.rows[0].total),
          available: parseInt(tablesResult.rows[0].available),
          occupied:  parseInt(tablesResult.rows[0].occupied),
          reserved:  parseInt(tablesResult.rows[0].reserved),
        },
        orders: {
          today:  parseInt(ordersResult.rows[0].total_orders),
          active: parseInt(ordersResult.rows[0].active_orders),
        },
        revenue: {
          today: parseFloat(revenueResult.rows[0].today_revenue),
        },
        menu: {
          total: parseInt(menuResult.rows[0].total),
        },
      },
    });
  } catch (err) {
    logger.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy thống kê.' });
  }
};

// GET /api/v1/dashboard/revenue-chart?days=7
const getRevenueChart = async (req, res) => {
  try {
    const days = parsePositiveInt(req.query.days, 7, 30);

    // Trả date dạng string 'YYYY-MM-DD' theo múi giờ Việt Nam để đồng bộ với phần fill ngày thiếu
    const result = await query(`
      SELECT
        TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS date,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COUNT(*) AS order_count
      FROM orders
      WHERE status = 'completed'
        AND created_at >= NOW() - ($1 || ' days')::INTERVAL
      GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')
      ORDER BY date ASC
    `, [days]);

    // Fill ngày thiếu (định dạng YYYY-MM-DD theo múi giờ Việt Nam)
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
    const chartData = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = fmt.format(d);
      const found = result.rows.find(r => r.date === dateStr);
      chartData.push({
        date: dateStr,
        revenue: found ? parseFloat(found.revenue) : 0,
        order_count: found ? parseInt(found.order_count) : 0,
      });
    }

    res.json({ success: true, data: chartData });
  } catch (err) {
    logger.error('Revenue chart error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// GET /api/v1/dashboard/recent-orders?limit=5
const getRecentOrders = async (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 10, 50);

    const result = await query(`
      SELECT
        o.id,
        o.order_code,
        o.status,
        o.total_amount,
        o.created_at,
        dt.table_number,
        u.full_name AS staff_name
      FROM orders o
      JOIN dining_tables dt ON o.table_id = dt.id
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Recent orders error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

module.exports = { getStats, getRevenueChart, getRecentOrders };
