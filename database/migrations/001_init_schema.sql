-- ============================================================
-- Migration 001: Khởi tạo schema hệ thống quản lý nhà hàng
-- ============================================================

-- Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    full_name   VARCHAR(100) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff', 'cashier')),
    email       VARCHAR(100),
    phone       VARCHAR(20),
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
-- Email unique (không bắt buộc có email) để đăng nhập bằng email không bị nhập nhằng
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email) WHERE email IS NOT NULL;

-- ============================================================
-- Bảng categories: Danh mục món ăn
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    sort_order  INT          NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);

-- ============================================================
-- Bảng menu_items: Món ăn
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id            SERIAL PRIMARY KEY,
    category_id   INT          NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name          VARCHAR(150) NOT NULL,
    description   TEXT,
    price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
    image_url     VARCHAR(500),
    is_available  BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order    INT          NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category_id  ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_menu_items_name         ON menu_items(name);

-- ============================================================
-- Bảng dining_tables: Bàn ăn
-- ============================================================
CREATE TABLE IF NOT EXISTS dining_tables (
    id          SERIAL PRIMARY KEY,
    table_number VARCHAR(10)  NOT NULL UNIQUE,
    area        VARCHAR(50)  DEFAULT 'Tầng 1',
    capacity    INT          NOT NULL DEFAULT 4 CHECK (capacity > 0),
    status      VARCHAR(20)  NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'occupied', 'reserved', 'maintenance')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dining_tables_status ON dining_tables(status);

-- ============================================================
-- Bảng orders: Đơn hàng
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    order_code      VARCHAR(20)   NOT NULL UNIQUE,
    table_id        INT           NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
    user_id         INT           REFERENCES users(id) ON DELETE SET NULL,
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
    note            TEXT,
    subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_table_id   ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- ============================================================
-- Bảng order_items: Chi tiết đơn hàng
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INT           NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id    INT           NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    quantity        INT           NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    subtotal        NUMERIC(12,2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED,
    note            TEXT,
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'preparing', 'ready', 'served', 'cancelled')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id     ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

-- ============================================================
-- Bảng payments: Thanh toán
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id              SERIAL PRIMARY KEY,
    order_id        INT           NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    method          VARCHAR(30)   NOT NULL DEFAULT 'cash'
                        CHECK (method IN ('cash', 'card', 'transfer', 'other')),
    status          VARCHAR(20)   NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
    note            TEXT,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status   ON payments(status);

-- ============================================================
-- Function: Tự động cập nhật updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger cho tất cả bảng
CREATE OR REPLACE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_menu_items_updated_at
    BEFORE UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_dining_tables_updated_at
    BEFORE UPDATE ON dining_tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_order_items_updated_at
    BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Function: Sinh mã đơn hàng tự động
-- ============================================================
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TEXT AS $$
DECLARE
    v_code TEXT;
    v_count INT;
BEGIN
    LOOP
        v_code := 'DH' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(FLOOR(RANDOM() * 9999 + 1)::TEXT, 4, '0');
        SELECT COUNT(*) INTO v_count FROM orders WHERE order_code = v_code;
        EXIT WHEN v_count = 0;
    END LOOP;
    RETURN v_code;
END;
$$ LANGUAGE plpgsql;
