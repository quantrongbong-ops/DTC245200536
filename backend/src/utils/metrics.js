// ============================================================
// Prometheus metrics endpoint
// ============================================================
const client = require('prom-client');

// Tự động thu thập default metrics (CPU, memory, event loop, etc.)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'restaurant_api_' });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'restaurant_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
  name: 'restaurant_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const activeConnections = new client.Gauge({
  name: 'restaurant_active_connections',
  help: 'Number of active connections',
});

const ordersCreated = new client.Counter({
  name: 'restaurant_orders_created_total',
  help: 'Total number of orders created',
});

// Counter: cộng dồn doanh thu của mọi đơn đã hoàn thành.
// KHÔNG dùng Gauge + .set() vì như vậy giá trị sẽ chỉ là doanh thu của
// đơn hoàn thành gần nhất, không phải tổng doanh thu.
const revenueTotal = new client.Counter({
  name: 'restaurant_revenue_total',
  help: 'Total revenue processed (VND, accumulated over completed orders)',
});

// Middleware thu thập metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode,
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
    activeConnections.dec();
  });

  next();
};

// Route trả về metrics
const metricsHandler = async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
};

// ------------------------------------------------------------
// Ghi nhận doanh thu của một đơn vừa hoàn thành.
//
// Vì sao cần hàm dùng chung: đơn hàng chuyển sang 'completed' ở HAI đường khác nhau:
//   1. payment.controller.createPayment()  — luồng bình thường (khách thanh toán)
//   2. order.controller.updateStatus()     — đổi trạng thái thủ công
// Trước đây chỉ đường (2) cộng metric, nên đơn thanh toán qua đường (1) —
// vốn là luồng chính — KHÔNG được tính vào doanh thu.
//
// Gọi hàm này ở cả hai nơi. Không lo cộng trùng vì:
//   - updateStatus từ chối đơn đã 'completed'/'cancelled'
//   - createPayment chỉ chấp nhận đơn ở 'served'/'ready'
// nên mỗi đơn chỉ đi qua đúng một trong hai đường.
// ------------------------------------------------------------
const recordCompletedOrder = (totalAmount) => {
  const amount = parseFloat(totalAmount);
  if (Number.isFinite(amount) && amount >= 0) {
    revenueTotal.inc(amount);
  }
};

module.exports = {
  metricsMiddleware,
  metricsHandler,
  ordersCreated,
  revenueTotal,
  recordCompletedOrder,
  client,
};
