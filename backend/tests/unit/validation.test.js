// ============================================================
// UNIT TEST cho logic kiểm tra dữ liệu đầu vào
//
// Đặc điểm: KHÔNG kết nối database, KHÔNG gọi HTTP.
// Chạy được độc lập:  npm run test:unit
// ============================================================
const {
  parsePriceInput,
  parseQuantityInput,
  parseRequiredString,
  MAX_PRICE,
  MAX_NAME_LENGTH,
} = require('../../src/utils/validation');

const { parsePositiveInt } = require('../../src/utils/query');

describe('UNIT - validation.parsePriceInput', () => {
  test('chấp nhận giá hợp lệ', () => {
    expect(parsePriceInput(0)).toEqual({ value: 0 });
    expect(parsePriceInput(55000)).toEqual({ value: 55000 });
    expect(parsePriceInput(12500.5)).toEqual({ value: 12500.5 });
    expect(parsePriceInput('45000')).toEqual({ value: 45000 });
    expect(parsePriceInput('45000.25')).toEqual({ value: 45000.25 });
  });

  test('giá bằng 0 là hợp lệ (món miễn phí)', () => {
    expect(parsePriceInput(0).value).toBe(0);
    expect(parsePriceInput('0').value).toBe(0);
  });

  test('từ chối giá âm', () => {
    expect(parsePriceInput(-1).error).toMatch(/không được âm/i);
    expect(parsePriceInput(-1000).error).toBeDefined();
    expect(parsePriceInput('-0.01').error).toBeDefined();
  });

  test('từ chối giá thiếu', () => {
    expect(parsePriceInput(undefined).error).toBeDefined();
    expect(parsePriceInput(null).error).toBeDefined();
    expect(parsePriceInput('').error).toBeDefined();
  });

  test('từ chối giá sai kiểu', () => {
    expect(parsePriceInput('abc').error).toMatch(/phải là một số/i);
    // parseFloat('100abc') = 100 (âm thầm bỏ qua rác) nhưng Number('100abc') = NaN
    expect(parsePriceInput('100abc').error).toBeDefined();
    expect(parsePriceInput('12,5').error).toBeDefined();
    expect(parsePriceInput(NaN).error).toBeDefined();
    expect(parsePriceInput(Infinity).error).toBeDefined();
  });

  test('từ chối kiểu boolean và object (Number(true) === 1 sẽ lọt nếu không chặn)', () => {
    expect(parsePriceInput(true).error).toBeDefined();
    expect(parsePriceInput(false).error).toBeDefined();
    expect(parsePriceInput({}).error).toBeDefined();
    expect(parsePriceInput([]).error).toBeDefined();
  });

  test('từ chối giá vượt giới hạn NUMERIC(12,2)', () => {
    expect(parsePriceInput(MAX_PRICE).value).toBe(MAX_PRICE);
    expect(parsePriceInput(MAX_PRICE + 1).error).toMatch(/vượt giới hạn/i);
    expect(parsePriceInput(99999999999999).error).toBeDefined();
  });
});

describe('UNIT - validation.parseQuantityInput', () => {
  test('chấp nhận số nguyên dương', () => {
    expect(parseQuantityInput(1)).toEqual({ value: 1 });
    expect(parseQuantityInput(100)).toEqual({ value: 100 });
  });

  test('từ chối số lượng bằng 0', () => {
    expect(parseQuantityInput(0).error).toBeDefined();
  });

  test('từ chối số lượng âm', () => {
    expect(parseQuantityInput(-1).error).toBeDefined();
    expect(parseQuantityInput(-100).error).toBeDefined();
  });

  test('từ chối số thập phân', () => {
    expect(parseQuantityInput(1.5).error).toMatch(/số nguyên/i);
    expect(parseQuantityInput(0.5).error).toBeDefined();
  });

  test('từ chối chuỗi (không tự động ép kiểu)', () => {
    // Nếu dùng parseInt('2') sẽ thành 2 — ở đây cố ý từ chối để
    // buộc client gửi đúng kiểu JSON number.
    expect(parseQuantityInput('2').error).toBeDefined();
  });

  test('từ chối số lượng vượt giới hạn', () => {
    expect(parseQuantityInput(10000).value).toBe(10000);
    expect(parseQuantityInput(10001).error).toMatch(/vượt giới hạn/i);
    expect(parseQuantityInput(999999999).error).toBeDefined();
  });

  test('từ chối giá trị thiếu', () => {
    expect(parseQuantityInput(undefined).error).toBeDefined();
    expect(parseQuantityInput(null).error).toBeDefined();
  });
});

describe('UNIT - validation.parseRequiredString', () => {
  test('cắt khoảng trắng đầu cuối', () => {
    expect(parseRequiredString('  Phở bò  ', 'Tên món ăn', 150)).toEqual({ value: 'Phở bò' });
  });

  test('từ chối chuỗi rỗng hoặc chỉ có khoảng trắng', () => {
    expect(parseRequiredString('', 'Tên món ăn', 150).error).toBeDefined();
    expect(parseRequiredString('   ', 'Tên món ăn', 150).error).toBeDefined();
    expect(parseRequiredString(null, 'Tên món ăn', 150).error).toBeDefined();
  });

  test('từ chối chuỗi vượt độ dài cột VARCHAR', () => {
    const vua = 'a'.repeat(MAX_NAME_LENGTH);
    const qua = 'a'.repeat(MAX_NAME_LENGTH + 1);
    expect(parseRequiredString(vua, 'Tên món ăn', MAX_NAME_LENGTH).value).toBe(vua);
    expect(parseRequiredString(qua, 'Tên món ăn', MAX_NAME_LENGTH).error).toMatch(/tối đa/i);
  });

  test('từ chối giá trị không phải chuỗi', () => {
    expect(parseRequiredString(123, 'Tên món ăn', 150).error).toBeDefined();
    expect(parseRequiredString({}, 'Tên món ăn', 150).error).toBeDefined();
  });
});

describe('UNIT - query.parsePositiveInt', () => {
  test('trả về giá trị mặc định khi thiếu hoặc không phải số', () => {
    expect(parsePositiveInt(undefined, 20, 100)).toBe(20);
    expect(parsePositiveInt(null, 20, 100)).toBe(20);
    expect(parsePositiveInt('abc', 20, 100)).toBe(20);
    expect(parsePositiveInt('', 20, 100)).toBe(20);
  });

  test('ép trần và sàn', () => {
    expect(parsePositiveInt('999', 20, 100)).toBe(100);
    expect(parsePositiveInt('-5', 20, 100)).toBe(1);
    expect(parsePositiveInt('0', 20, 100)).toBe(1);
  });

  test('giữ nguyên giá trị hợp lệ', () => {
    expect(parsePositiveInt('5', 20, 100)).toBe(5);
    expect(parsePositiveInt(50, 20, 100)).toBe(50);
  });

  test('KHÔNG bao giờ trả về NaN (đây là nguyên nhân lỗi LIMIT NaN trước đây)', () => {
    const inputs = [undefined, null, '', 'abc', 'NaN', {}, [], NaN, Infinity, '1e999'];
    for (const input of inputs) {
      const result = parsePositiveInt(input, 20, 100);
      expect(Number.isFinite(result)).toBe(true);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(100);
    }
  });
});
