-- MRO 소모품 관리 시스템 데이터베이스 설정

-- 확장 모듈 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. locations (사업장/위치)
CREATE TABLE IF NOT EXISTS locations (
    location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_code VARCHAR(20) UNIQUE NOT NULL,
    location_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. categories (카테고리 - 2단계 계층 구조)
CREATE TABLE IF NOT EXISTS categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_code VARCHAR(20) UNIQUE NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES categories(category_id),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. items (소모품)
CREATE TABLE IF NOT EXISTS items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code VARCHAR(20) UNIQUE NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    korean_name VARCHAR(100),
    vietnamese_name VARCHAR(100),
    category_id UUID REFERENCES categories(category_id),
    spec VARCHAR(100),
    unit VARCHAR(10) NOT NULL,
    min_stock INT DEFAULT 5,
    max_stock INT DEFAULT 100,
    reorder_point INT DEFAULT 10,
    storage_location VARCHAR(50),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

-- 4. suppliers (공급업체)
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_code VARCHAR(20) UNIQUE NOT NULL,
    supplier_name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    country VARCHAR(50),
    website VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    location_id UUID NOT NULL REFERENCES locations(location_id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. departments (부서)
CREATE TABLE IF NOT EXISTS departments (
    department_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_code VARCHAR(20) UNIQUE NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. users (사용자)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    department_id UUID REFERENCES departments(department_id),
    location_id UUID REFERENCES locations(location_id),
    is_active BOOLEAN DEFAULT TRUE,
    phone_number VARCHAR(20),
    position VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. inventory (재고)
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(item_id),
    location_id UUID NOT NULL REFERENCES locations(location_id),
    current_quantity INT DEFAULT 0,
    last_count_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    storage_location VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    UNIQUE(item_id, location_id)
);

-- 8. inbound (입고)
CREATE TABLE IF NOT EXISTS inbound (
    inbound_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inbound_date DATE NOT NULL,
    item_id UUID NOT NULL REFERENCES items(item_id),
    supplier_id UUID REFERENCES suppliers(supplier_id),
    location_id UUID NOT NULL REFERENCES locations(location_id),
    quantity INT NOT NULL,
    unit_price NUMERIC(12, 2),
    total_price NUMERIC(12, 2),
    currency VARCHAR(10) DEFAULT 'KRW',
    reference_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);

-- 9. outbound (출고 - MRO 소비 중심)
CREATE TABLE IF NOT EXISTS outbound (
    outbound_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outbound_date DATE NOT NULL,
    item_id UUID NOT NULL REFERENCES items(item_id),
    location_id UUID NOT NULL REFERENCES locations(location_id),
    quantity INT NOT NULL,
    requester VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES departments(department_id),
    purpose VARCHAR(200),
    cost_center VARCHAR(50),
    reference_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);

-- 10. item_prices (소모품 단가)
CREATE TABLE IF NOT EXISTS item_prices (
    price_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(item_id),
    location_id UUID NOT NULL REFERENCES locations(location_id),
    unit_price NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'KRW',
    supplier_id UUID REFERENCES suppliers(supplier_id),
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_current BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    UNIQUE(item_id, supplier_id, effective_from)
);

-- 11. reorder_alerts (재주문 알림)
CREATE TABLE IF NOT EXISTS reorder_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(item_id),
    location_id UUID NOT NULL REFERENCES locations(location_id),
    current_quantity INT NOT NULL,
    reorder_point INT NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(50)
);

-- ============================================================
-- 트리거: 재고 수량 변경 시 재주문 알림 생성
-- ============================================================

-- 재주문 포인트 확인 함수
CREATE OR REPLACE FUNCTION check_reorder_point()
RETURNS TRIGGER AS $$
DECLARE
    v_reorder_point INT;
BEGIN
    -- 해당 소모품의 재주문 포인트 조회
    SELECT reorder_point
    INTO v_reorder_point
    FROM items
    WHERE item_id = NEW.item_id;

    -- 현재 수량이 재주문 포인트 미만이고 미처리 알림이 없는 경우 알림 생성
    IF NEW.current_quantity < v_reorder_point THEN
        IF NOT EXISTS (
            SELECT 1
            FROM reorder_alerts
            WHERE item_id = NEW.item_id
              AND location_id = NEW.location_id
              AND status = 'OPEN'
        ) THEN
            INSERT INTO reorder_alerts (
                item_id,
                location_id,
                current_quantity,
                reorder_point,
                status
            ) VALUES (
                NEW.item_id,
                NEW.location_id,
                NEW.current_quantity,
                v_reorder_point,
                'OPEN'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 재고 수량 업데이트 시 재주문 알림 트리거
CREATE OR REPLACE TRIGGER trigger_check_reorder_point
AFTER UPDATE OF current_quantity ON inventory
FOR EACH ROW
EXECUTE FUNCTION check_reorder_point();

-- ============================================================
-- 인덱스 (조회 성능 최적화)
-- ============================================================

-- items 인덱스
CREATE INDEX IF NOT EXISTS idx_items_item_code ON items(item_code);
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);

-- inventory 인덱스
CREATE INDEX IF NOT EXISTS idx_inventory_item_id ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location_id ON inventory(location_id);

-- inbound 인덱스
CREATE INDEX IF NOT EXISTS idx_inbound_item_id ON inbound(item_id);
CREATE INDEX IF NOT EXISTS idx_inbound_inbound_date ON inbound(inbound_date);

-- outbound 인덱스
CREATE INDEX IF NOT EXISTS idx_outbound_item_id ON outbound(item_id);
CREATE INDEX IF NOT EXISTS idx_outbound_outbound_date ON outbound(outbound_date);
CREATE INDEX IF NOT EXISTS idx_outbound_department_id ON outbound(department_id);

-- reorder_alerts 인덱스
CREATE INDEX IF NOT EXISTS idx_reorder_alerts_status ON reorder_alerts(status);

-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

-- 모든 테이블에 RLS 활성화
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_alerts ENABLE ROW LEVEL SECURITY;

-- locations 정책
CREATE POLICY "인증된 사용자 조회 허용 - locations"
    ON locations FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - locations"
    ON locations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - locations"
    ON locations FOR UPDATE
    TO authenticated
    USING (true);

-- categories 정책
CREATE POLICY "인증된 사용자 조회 허용 - categories"
    ON categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - categories"
    ON categories FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - categories"
    ON categories FOR UPDATE
    TO authenticated
    USING (true);

-- items 정책
CREATE POLICY "인증된 사용자 조회 허용 - items"
    ON items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - items"
    ON items FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - items"
    ON items FOR UPDATE
    TO authenticated
    USING (true);

-- suppliers 정책
CREATE POLICY "인증된 사용자 조회 허용 - suppliers"
    ON suppliers FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - suppliers"
    ON suppliers FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - suppliers"
    ON suppliers FOR UPDATE
    TO authenticated
    USING (true);

-- departments 정책
CREATE POLICY "인증된 사용자 조회 허용 - departments"
    ON departments FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - departments"
    ON departments FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - departments"
    ON departments FOR UPDATE
    TO authenticated
    USING (true);

-- users 정책
CREATE POLICY "인증된 사용자 조회 허용 - users"
    ON users FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - users"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - users"
    ON users FOR UPDATE
    TO authenticated
    USING (true);

-- inventory 정책
CREATE POLICY "인증된 사용자 조회 허용 - inventory"
    ON inventory FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - inventory"
    ON inventory FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - inventory"
    ON inventory FOR UPDATE
    TO authenticated
    USING (true);

-- inbound 정책
CREATE POLICY "인증된 사용자 조회 허용 - inbound"
    ON inbound FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - inbound"
    ON inbound FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - inbound"
    ON inbound FOR UPDATE
    TO authenticated
    USING (true);

-- outbound 정책
CREATE POLICY "인증된 사용자 조회 허용 - outbound"
    ON outbound FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - outbound"
    ON outbound FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - outbound"
    ON outbound FOR UPDATE
    TO authenticated
    USING (true);

-- item_prices 정책
CREATE POLICY "인증된 사용자 조회 허용 - item_prices"
    ON item_prices FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - item_prices"
    ON item_prices FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - item_prices"
    ON item_prices FOR UPDATE
    TO authenticated
    USING (true);

-- reorder_alerts 정책
CREATE POLICY "인증된 사용자 조회 허용 - reorder_alerts"
    ON reorder_alerts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "인증된 사용자 입력 허용 - reorder_alerts"
    ON reorder_alerts FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "인증된 사용자 수정 허용 - reorder_alerts"
    ON reorder_alerts FOR UPDATE
    TO authenticated
    USING (true);

-- ============================================================
-- 카테고리 기초 데이터 (7개 최상위 카테고리)
-- ============================================================

INSERT INTO categories (category_code, category_name, parent_id, sort_order)
VALUES
    ('OFF', '사무용품',   NULL, 1),  -- Office Supplies
    ('CLN', '청소용품',   NULL, 2),  -- Cleaning Supplies
    ('SAF', '안전용품',   NULL, 3),  -- Safety Equipment
    ('TOL', '공구류',     NULL, 4),  -- Tools
    ('ELC', '전기자재',   NULL, 5),  -- Electrical Materials
    ('PLB', '배관자재',   NULL, 6),  -- Plumbing Materials
    ('ETC', '기타',       NULL, 7)   -- Others
ON CONFLICT (category_code) DO NOTHING;
