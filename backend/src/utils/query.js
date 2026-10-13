// ============================================================
// Helper xử lý tham số query
//
// Vì sao cần: các controller trước đây dùng
//     Math.min(100, parseInt(req.query.limit || '20', 10))
// Nếu client gửi ?limit=abc thì parseInt trả NaN, Math.min(100, NaN) = NaN,
// và NaN được truyền xuống PostgreSQL cho LIMIT/OFFSET → lỗi SQL → HTTP 500.
// Helper này đảm bảo luôn trả về số nguyên hợp lệ trong khoảng cho phép.
// ============================================================

/**
 * Ép một giá trị query về số nguyên dương, có giá trị mặc định và trần.
 * @param {*} value        giá trị thô từ req.query
 * @param {number} fallback giá trị dùng khi value không phải số hợp lệ
 * @param {number} max      trần cho phép (truyền Infinity nếu không giới hạn)
 * @param {number} min      sàn cho phép
 * @returns {number} số nguyên trong [min, max]
 */
const parsePositiveInt = (value, fallback, max = Infinity, min = 1) => {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

module.exports = { parsePositiveInt };
