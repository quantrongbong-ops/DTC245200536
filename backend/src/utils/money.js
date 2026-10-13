// ============================================================
// Helper tính tiền
//
// Vì sao cần module riêng: logic tính tiền trước đây nằm rải trong
// controller dưới dạng `parseFloat(price) * quantity`. Cách đó có hai vấn đề:
//
//  1. Số thực dấu phẩy động nhị phân không biểu diễn chính xác số thập phân.
//     Ví dụ 0.1 + 0.2 !== 0.3. Với tiền tệ, sai số này tích luỹ qua nhiều dòng.
//  2. Không thể viết unit test vì hàm nằm lẫn trong controller (phải có DB).
//
// Cách làm ở đây: quy đổi về số nguyên "đồng" (đơn vị nhỏ nhất) rồi tính,
// sau đó chia lại. Nhờ vậy phép cộng/trừ là chính xác tuyệt đối.
// ============================================================

// Cột tiền trong database là NUMERIC(12,2) → 2 chữ số thập phân.
const DECIMALS = 2;
const FACTOR = 10 ** DECIMALS;

/**
 * Quy đổi giá trị tiền về số nguyên đơn vị nhỏ nhất.
 * Làm tròn theo nửa-lên (half-up) để tránh sai số nhị phân,
 * ví dụ 1.005 * 100 = 100.49999999999999 trong JS, cần thành 101.
 * @param {number|string} amount
 * @returns {number} số nguyên
 */
const toMinorUnits = (amount) => {
  const num = Number(amount);
  if (!Number.isFinite(num)) {
    throw new TypeError(`Giá trị tiền không hợp lệ: ${amount}`);
  }
  // Cộng thêm epsilon tương đối để bù sai số biểu diễn nhị phân
  return Math.round((num + Number.EPSILON * Math.sign(num) * Math.abs(num)) * FACTOR);
};

/**
 * Đưa số nguyên đơn vị nhỏ nhất trở về số thập phân.
 * @param {number} minor
 * @returns {number}
 */
const fromMinorUnits = (minor) => minor / FACTOR;

/**
 * Thành tiền của một dòng: đơn giá × số lượng.
 * @param {number|string} unitPrice
 * @param {number} quantity
 * @returns {number} đã làm tròn 2 chữ số thập phân
 */
const calcLineTotal = (unitPrice, quantity) => {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`Số lượng không hợp lệ: ${quantity}`);
  }
  return fromMinorUnits(toMinorUnits(unitPrice) * quantity);
};

/**
 * Tổng tiền của danh sách dòng hàng.
 * Cộng trên số nguyên nên không tích luỹ sai số.
 * @param {Array<{unit_price: number|string, quantity: number}>} lines
 * @returns {number}
 */
const sumLineTotals = (lines) => {
  if (!Array.isArray(lines)) {
    throw new TypeError('sumLineTotals cần một mảng');
  }
  const totalMinor = lines.reduce(
    (acc, line) => acc + toMinorUnits(line.unit_price) * line.quantity,
    0
  );
  return fromMinorUnits(totalMinor);
};

/**
 * Tổng đơn hàng sau khi trừ chiết khấu. Không bao giờ trả về số âm.
 * @param {number} subtotal
 * @param {number} discount
 * @returns {number}
 */
const calcOrderTotal = (subtotal, discount = 0) => {
  const subMinor = toMinorUnits(subtotal);
  const discMinor = toMinorUnits(discount);
  const result = subMinor - discMinor;
  return fromMinorUnits(result > 0 ? result : 0);
};

module.exports = {
  DECIMALS,
  FACTOR,
  toMinorUnits,
  fromMinorUnits,
  calcLineTotal,
  sumLineTotals,
  calcOrderTotal,
};
