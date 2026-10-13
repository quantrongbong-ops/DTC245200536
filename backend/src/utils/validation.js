// ============================================================
// Helper kiểm tra dữ liệu đầu vào
//
// Tách khỏi controller để có thể viết unit test mà KHÔNG cần database.
// Mỗi hàm trả về { value } khi hợp lệ hoặc { error } khi không hợp lệ —
// không ném exception, để controller dễ chuyển thành HTTP 400.
// ============================================================

// Cột menu_items.price là NUMERIC(12,2) → giá trị lớn nhất 9,999,999,999.99.
// Vượt ngưỡng này PostgreSQL báo lỗi 22003 (numeric field overflow).
const MAX_PRICE = 9999999999.99;

// Cột menu_items.name là VARCHAR(150)
const MAX_NAME_LENGTH = 150;

// Cột categories.name là VARCHAR(100)
const MAX_CATEGORY_NAME_LENGTH = 100;

// Cột dining_tables.table_number là VARCHAR(10)
const MAX_TABLE_NUMBER_LENGTH = 10;

/**
 * Kiểm tra và chuẩn hoá giá trị giá.
 *
 * Dùng Number() thay vì parseFloat() vì parseFloat('100abc') trả 100
 * (âm thầm bỏ qua phần rác), còn Number('100abc') trả NaN → phát hiện được
 * dữ liệu sai kiểu.
 *
 * @param {*} value giá trị thô từ req.body
 * @returns {{value: number}|{error: string}}
 */
const parsePriceInput = (value) => {
  if (value === undefined || value === null || value === '') {
    return { error: 'Giá món ăn là bắt buộc.' };
  }
  // Chỉ chấp nhận number hoặc string. Chặn true/false/object/array
  // vì Number(true) === 1 và Number([]) === 0 sẽ lọt qua kiểm tra.
  if (typeof value !== 'number' && typeof value !== 'string') {
    return { error: 'Giá món ăn không hợp lệ.' };
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return { error: 'Giá món ăn phải là một số.' };
  }
  if (num < 0) {
    return { error: 'Giá món ăn không được âm.' };
  }
  if (num > MAX_PRICE) {
    return { error: `Giá món ăn vượt giới hạn cho phép (tối đa ${MAX_PRICE}).` };
  }
  return { value: num };
};

/**
 * Kiểm tra số lượng món.
 * @param {*} value
 * @returns {{value: number}|{error: string}}
 */
const parseQuantityInput = (value) => {
  if (value === undefined || value === null || value === '') {
    return { error: 'Số lượng món là bắt buộc.' };
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { error: 'Số lượng món phải là số nguyên.' };
  }
  if (value < 1) {
    return { error: 'Số lượng món phải lớn hơn 0.' };
  }
  // Cột order_items.quantity là INT (4 byte) → tối đa 2,147,483,647.
  // Đặt trần thấp hơn nhiều vì đơn hàng thực tế không thể tới mức đó,
  // và tránh tràn số khi nhân với đơn giá.
  if (value > 10000) {
    return { error: 'Số lượng món vượt giới hạn cho phép (tối đa 10000).' };
  }
  return { value };
};

/**
 * Kiểm tra chuỗi bắt buộc, có giới hạn độ dài.
 * @param {*} value
 * @param {string} label tên trường để hiện trong thông báo lỗi
 * @param {number} maxLength
 * @returns {{value: string}|{error: string}}
 */
const parseRequiredString = (value, label, maxLength) => {
  if (value === undefined || value === null || typeof value !== 'string' || !value.trim()) {
    return { error: `${label} là bắt buộc.` };
  }
  const trimmed = value.trim();
  if (maxLength && trimmed.length > maxLength) {
    return { error: `${label} tối đa ${maxLength} ký tự.` };
  }
  return { value: trimmed };
};

module.exports = {
  MAX_PRICE,
  MAX_NAME_LENGTH,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_TABLE_NUMBER_LENGTH,
  parsePriceInput,
  parseQuantityInput,
  parseRequiredString,
};
