// ============================================================
// UNIT TEST cho logic tính tiền
//
// Đặc điểm: KHÔNG kết nối database, KHÔNG gọi HTTP.
// Chạy được độc lập:  npm run test:unit
// ============================================================
const {
  toMinorUnits,
  fromMinorUnits,
  calcLineTotal,
  sumLineTotals,
  calcOrderTotal,
  FACTOR,
} = require('../../src/utils/money');

describe('UNIT - money.toMinorUnits', () => {
  test('quy đổi số thập phân sang đơn vị nhỏ nhất', () => {
    expect(toMinorUnits(12500.5)).toBe(1250050);
    expect(toMinorUnits(55000)).toBe(5500000);
    expect(toMinorUnits('45000.25')).toBe(4500025);
    expect(toMinorUnits(0)).toBe(0);
  });

  test('khử sai số dấu phẩy động nhị phân', () => {
    // Trong JavaScript thuần: 0.1 * 100 = 10.000000000000002
    // và 1.005 * 100 = 100.49999999999999 → phải làm tròn thành 101
    expect(toMinorUnits(0.1)).toBe(10);
    expect(toMinorUnits(1.005)).toBe(101);
    expect(toMinorUnits(2.675)).toBe(268);
  });

  test('ném lỗi với giá trị không phải số', () => {
    expect(() => toMinorUnits('abc')).toThrow(TypeError);
    expect(() => toMinorUnits(undefined)).toThrow(TypeError);
    expect(() => toMinorUnits(NaN)).toThrow(TypeError);
    expect(() => toMinorUnits(Infinity)).toThrow(TypeError);
  });

  test('FACTOR đúng bằng 100 cho 2 chữ số thập phân', () => {
    expect(FACTOR).toBe(100);
  });
});

describe('UNIT - money.fromMinorUnits', () => {
  test('đảo ngược đúng phép quy đổi', () => {
    expect(fromMinorUnits(1250050)).toBe(12500.5);
    expect(fromMinorUnits(0)).toBe(0);
  });
});

describe('UNIT - money.calcLineTotal (thành tiền một dòng)', () => {
  test('nhân đơn giá với số lượng', () => {
    expect(calcLineTotal(55000, 1)).toBe(55000);
    expect(calcLineTotal(55000, 2)).toBe(110000);
    expect(calcLineTotal(12500.5, 2)).toBe(25001);
  });

  test('số lượng 0 cho thành tiền 0', () => {
    expect(calcLineTotal(55000, 0)).toBe(0);
  });

  test('không tích luỹ sai số dấu phẩy động', () => {
    // 0.1 * 3 trong JS thuần = 0.30000000000000004
    expect(calcLineTotal(0.1, 3)).toBe(0.3);
    // 1.1 * 3 trong JS thuần = 3.3000000000000003
    expect(calcLineTotal(1.1, 3)).toBe(3.3);
  });

  test('đơn giá thập phân nhân số lượng lớn', () => {
    expect(calcLineTotal(33333.33, 3)).toBe(99999.99);
  });

  test('từ chối số lượng không phải số nguyên', () => {
    expect(() => calcLineTotal(55000, 1.5)).toThrow(RangeError);
  });

  test('từ chối số lượng âm', () => {
    expect(() => calcLineTotal(55000, -1)).toThrow(RangeError);
  });
});

describe('UNIT - money.sumLineTotals (tổng nhiều dòng)', () => {
  test('cộng thành tiền của nhiều dòng', () => {
    const lines = [
      { unit_price: 55000, quantity: 2 },   // 110000
      { unit_price: 70000, quantity: 1 },   //  70000
      { unit_price: 45000, quantity: 3 },   // 135000
    ];
    expect(sumLineTotals(lines)).toBe(315000);
  });

  test('mảng rỗng cho tổng bằng 0', () => {
    expect(sumLineTotals([])).toBe(0);
  });

  test('tổng khớp với ví dụ trong e2e-test.sh', () => {
    // 2 × 12500.50 rồi thêm 1 × 12500.50
    expect(sumLineTotals([{ unit_price: 12500.5, quantity: 2 }])).toBe(25001);
    expect(sumLineTotals([
      { unit_price: 12500.5, quantity: 2 },
      { unit_price: 12500.5, quantity: 1 },
    ])).toBe(37501.5);
  });

  test('cộng nhiều dòng thập phân không sai số', () => {
    // JS thuần: 0.1+0.2 = 0.30000000000000004
    const lines = [
      { unit_price: 0.1, quantity: 1 },
      { unit_price: 0.2, quantity: 1 },
    ];
    expect(sumLineTotals(lines)).toBe(0.3);
  });

  test('từ chối đầu vào không phải mảng', () => {
    expect(() => sumLineTotals('khong-phai-mang')).toThrow(TypeError);
    expect(() => sumLineTotals(null)).toThrow(TypeError);
  });
});

describe('UNIT - money.calcOrderTotal (tổng đơn sau chiết khấu)', () => {
  test('không chiết khấu thì bằng subtotal', () => {
    expect(calcOrderTotal(315000)).toBe(315000);
    expect(calcOrderTotal(315000, 0)).toBe(315000);
  });

  test('trừ chiết khấu', () => {
    expect(calcOrderTotal(315000, 15000)).toBe(300000);
    expect(calcOrderTotal(100.5, 0.5)).toBe(100);
  });

  test('không bao giờ trả về số âm', () => {
    expect(calcOrderTotal(1000, 5000)).toBe(0);
  });

  test('chiết khấu bằng đúng subtotal cho 0', () => {
    expect(calcOrderTotal(315000, 315000)).toBe(0);
  });
});
