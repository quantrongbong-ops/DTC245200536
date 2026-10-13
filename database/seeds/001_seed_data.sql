-- ============================================================
-- Seed dữ liệu demo cho hệ thống quản lý nhà hàng An Phúc
-- (Bản sạch: chỉ 1 tài khoản admin, mỗi khu vực 5 bàn, không có đơn hàng)
-- ============================================================

-- Xóa dữ liệu cũ theo thứ tự (tránh vi phạm FK)
TRUNCATE TABLE payments, order_items, orders, menu_items, categories, dining_tables, users RESTART IDENTITY CASCADE;

-- ============================================================
-- Users: chỉ tài khoản admin
-- Password: Admin@123 (bcrypt, cost=12)
-- ============================================================
INSERT INTO users (username, password, full_name, role, email, phone) VALUES
('admin', '$2b$12$fAMCJgmgRTOaI.Fgl9oXR.CoOUWGFFc7aiKeWMo6YuylOY1RhL7Wi', 'Quản lý Admin', 'admin', 'admin@nhahang.com', '0901234567');

-- ============================================================
-- Categories: Danh mục món
-- ============================================================
INSERT INTO categories (name, description, sort_order) VALUES
('Khai vị',    'Các món khai vị và salad',           1),
('Món chính',  'Các món chính - cơm, bún, phở',      2),
('Hải sản',    'Các món hải sản tươi sống',           3),
('Đồ uống',   'Nước giải khát, trà, sinh tố',        4),
('Tráng miệng','Kem, bánh ngọt, chè',                5),
('Lẩu',        'Các loại lẩu đặc biệt',              6);

-- ============================================================
-- Menu items: Món ăn
-- ============================================================
INSERT INTO menu_items (category_id, name, description, price, image_url, is_available, sort_order) VALUES
-- Khai vị (category_id=1)
(1, 'Gỏi cuốn',       'Gỏi cuốn tôm thịt, rau sống, bánh tráng',     55000,  '/images/goi-cuon.jpg',      TRUE, 1),
(1, 'Chả giò',        'Chả giò chiên giòn, nhân thịt cua',             45000,  '/images/cha-gio.jpg',       TRUE, 2),
(1, 'Salad cá ngừ',   'Salad cá ngừ tươi, rau trộn sốt mè rang',      90000,  '/images/salad-ca-ngu.jpg',  TRUE, 3),

-- Món chính (category_id=2)
(2, 'Phở bò',         'Phở bò truyền thống, nước dùng hầm xương 8h',  70000,  '/images/pho-bo.jpg',        TRUE, 1),
(2, 'Bún chả',        'Bún chả Hà Nội, nem rán, nước mắm pha',        65000,  '/images/bun-cha.jpg',       TRUE, 2),
(2, 'Cơm tấm',        'Cơm tấm sườn bì chả, dưa leo, cà chua',        60000,  '/images/com-tam.jpg',       TRUE, 3),
(2, 'Bún bò Huế',     'Bún bò Huế đậm vị, chả huế, huyết',            70000,  '/images/bun-bo-hue.jpg',    TRUE, 4),

-- Hải sản (category_id=3)
(3, 'Tôm nướng',      'Tôm hùm đất nướng muối ớt, tẩm bơ tỏi',      150000, '/images/tom-nuong.jpg',     TRUE, 1),
(3, 'Cá hồi nướng',   'Cá hồi Na Uy nướng cam, sốt chanh leo',       160000, '/images/ca-hoi-nuong.jpg',  TRUE, 2),
(3, 'Mực xào cay',    'Mực ống xào cay kiểu Thái',                   120000, '/images/muc-xao-cay.jpg',   TRUE, 3),

-- Đồ uống (category_id=4)
(4, 'Trà đào',        'Trà đào cam sả, đá viên, topping đào',         45000,  '/images/tra-dao.jpg',       TRUE, 1),
(4, 'Sinh tố xoài',   'Sinh tố xoài tươi, sữa dừa',                   45000,  '/images/sinh-to-xoai.jpg',  TRUE, 2),
(4, 'Cà phê sữa đá', 'Cà phê phin truyền thống, sữa đặc, đá',        35000,  '/images/ca-phe.jpg',        TRUE, 3),
(4, 'Nước cam',       'Nước cam ép tươi 100%',                         40000,  '/images/nuoc-cam.jpg',      TRUE, 4),

-- Tráng miệng (category_id=5)
(5, 'Chè thái',       'Chè thái đủ vị, nước cốt dừa béo ngậy',        40000,  '/images/che-thai.jpg',      TRUE, 1),
(5, 'Kem dừa',        'Kem dừa thiên nhiên, đậu phộng rang',           35000,  '/images/kem-dua.jpg',       TRUE, 2),

-- Lẩu (category_id=6)
(6, 'Lẩu thái',       'Lẩu thái chua cay, rau nấm tươi, hải sản',    180000, '/images/lau-thai.jpg',      TRUE, 1),
(6, 'Lẩu bò',         'Lẩu bò nhúng, rau thơm, bún tươi',             150000, '/images/lau-bo.jpg',        TRUE, 2);

-- ============================================================
-- Dining tables: mỗi khu vực 5 bàn, tất cả trống
-- ============================================================
INSERT INTO dining_tables (table_number, area, capacity, status) VALUES
('01', 'Tầng 1', 4, 'available'),
('02', 'Tầng 1', 4, 'available'),
('03', 'Tầng 1', 6, 'available'),
('04', 'Tầng 1', 4, 'available'),
('05', 'Tầng 1', 4, 'available'),
('09', 'Tầng 2', 4, 'available'),
('10', 'Tầng 2', 4, 'available'),
('11', 'Tầng 2', 6, 'available'),
('12', 'Tầng 2', 4, 'available'),
('13', 'Tầng 2', 4, 'available'),
('16', 'Sân vườn', 4, 'available'),
('17', 'Sân vườn', 6, 'available'),
('18', 'Sân vườn', 4, 'available'),
('19', 'Sân vườn', 4, 'available'),
('20', 'Sân vườn', 8, 'available');
