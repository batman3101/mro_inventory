# MRO Inventory Management System - Project Plan

> **Consensus Planning (RALPLAN)**: Planner → Architect (APPROVE) → Critic (ACCEPT)
> **Date**: 2026-03-28
> **Source Reference**: https://github.com/batman3101/MT_Inventory_V2.git

---

## Executive Summary

| Item | Detail |
|------|--------|
| **Project** | MRO Inventory (일반 소모품 관리 시스템) |
| **Approach** | Hybrid — Clone Infrastructure, Fresh Domain |
| **Source** | MT_Inventory_V2 (CNC 부품 관리 시스템) |
| **Tech Stack** | React 18 + TypeScript + Vite, Ant Design 5 + Tailwind CSS 4, Zustand 5, Supabase PostgreSQL, Express.js (auth) |
| **Phases** | 7 phases |
| **Key Difference** | MRO is consumption-centric (소모품 소비 추적), NOT asset-centric (부품 수명 관리) |

---

## 1. Architecture Decision Record (ADR)

### Decision
Hybrid approach — Clone infrastructure from MT_Inventory_V2, design MRO domain layer fresh.

### Decision Drivers
1. **Speed**: Reusing infrastructure (auth, build, i18n, UI patterns) eliminates ~40% of setup work
2. **Domain Fidelity**: MRO consumables need fresh data models and workflows, not renamed CNC parts models
3. **Quality**: Project rules mandate TDD, immutability patterns, comprehensive error handling

### Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **A: Full Clone & Rename** | Fastest initial setup | Domain mismatch causes 40-70% rework; produces parts-app-with-MRO-labels | REJECTED |
| **B: Hybrid (Selected)** | 40% speed benefit; domain-appropriate model; no mismatch rework | Requires upfront domain design; clone boundary judgment needed | SELECTED |
| **C: Fresh Build** | Cleanest codebase | 2-3x slower; no infrastructure reuse | REJECTED |

### Why Chosen
Preserves ~40% speed advantage from infrastructure reuse while ensuring domain-appropriate data models, workflows (especially outbound requisition), and business logic (reorder automation).

### Consequences
- Infrastructure files (configs, build, auth pattern) copied directly
- All domain files (types, services, stores, pages) written fresh from MRO requirements
- Database schema designed upfront (P1) before any CRUD development

### Follow-ups
- Validate MRO categories with stakeholders before P3
- Review reorder-point trigger behavior under load
- Consider approval workflow for high-value outbound requests in future iteration

---

## 2. Principles

1. **Infrastructure Reuse, Domain Fresh** — Clone infrastructure (build tooling, auth, i18n framework, UI scaffolding) but design domain logic from MRO requirements
2. **Schema-First** — Database schema, RLS policies, and data model must be finalized before any CRUD development
3. **Consumption-Centric Design** — MRO tracks consumption patterns, reorder automation, and department-level cost tracking
4. **TDD Compliance** — Every phase includes tests per project rules (80% coverage, RED-GREEN-REFACTOR)
5. **Testable Phases** — Every phase has concrete acceptance criteria that can be verified

---

## 3. Clone Boundary Checklist

> Architect Action Item #3: Explicit file-level clone decisions

### Clone As-Is (Infrastructure)
| File | Notes |
|------|-------|
| `vite.config.ts` | Minor proxy adjustments for /api |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` | Direct copy |
| `eslint.config.js` | Direct copy |
| `postcss.config.js` | Direct copy |
| `index.html` | Update title to "MRO Inventory" |
| `src/lib/supabase.ts` | Direct copy |
| `src/components/ProtectedRoute.tsx` | Direct copy (no factory imports) |
| `src/AntConfigProvider.tsx` | Direct copy |
| `src/App.tsx` | Direct copy |
| `src/main.tsx` | Direct copy |

### Clone & Strip (Adapt)
| File | Strip/Change |
|------|-------------|
| `package.json` | Rename to `mro-inventory-system`, reset version, keep deps |
| `src/components/layout/MainLayout.tsx` | Remove ObserverModeIndicator |
| `src/components/layout/Sidebar.tsx` | Remove ALMUS branding/images, update menu items for MRO |
| `src/router/index.tsx` | Update route paths and page imports for MRO |
| `src/i18n/config.ts` | Update language configuration (ko/vi) |
| `src/store/auth.store.ts` | **CRITICAL**: Remove factory.store dynamic import (lines 66-73), replace with location initialization |
| `server/index.js` | Update CORS, keep auth endpoint pattern |
| `server/package.json` | Rename, keep deps |
| `.gitignore` | Direct copy |
| `.env.example` | Update variable names if needed |

### Write Fresh (Domain)
| File | Reason |
|------|--------|
| `src/types/database.types.ts` | Entirely new MRO schema types |
| `src/services/*.service.ts` | All services — MRO domain logic, not CNC |
| `src/services/locationContext.ts` | Replaces factoryContext.ts — different scoping semantics |
| `src/store/*.store.ts` (domain) | items, inventory, inbound, outbound, suppliers, departments, itemPrice, location |
| `src/pages/*.tsx` (all) | Fresh domain UI — Items, Inventory, Inbound, Outbound, etc. |
| `src/components/LocationSelector.tsx` | Replaces FactorySelector with location semantics |
| `src/utils/excelExport.ts` | MRO-specific export columns |
| `src/utils/excelImport.ts` | MRO-specific import validation |
| `src/utils/excelTemplates.ts` | MRO-specific templates |
| `database/*.sql` | Entirely new schema |
| `src/i18n/locales/ko.json` | MRO-specific Korean translations |
| `src/i18n/locales/vi.json` | MRO-specific Vietnamese translations |

### Global Rename Pattern
- `factoryContext.ts` -> `locationContext.ts`
- `getFactoryId()` -> `getLocationId()`
- `getFactoryCode()` -> `getLocationCode()`
- All service files import from locationContext — systematic replacement needed

---

## 4. User Stories & Workflows

### User Roles

| Role | Description |
|------|-------------|
| **system_admin** | Full system access, user management |
| **admin** | Full data CRUD, no user management |
| **user** (staff) | Create inbound/outbound, view data |
| **viewer** | Read-only access |

### Permission Matrix

| Role | Items | Inventory | Inbound | Outbound | Suppliers | Users | Dashboard |
|------|-------|-----------|---------|----------|-----------|-------|-----------|
| system_admin | CRUD | CRUD | CRUD | CRUD | CRUD | CRUD | Full |
| admin | CRUD | CRUD | CRUD | CRUD | CRUD | View | Full |
| user (staff) | View | View | Create/View | Create/View | View | - | Basic |
| viewer | View | View | View | View | View | - | Basic |

### Core Workflows

**WF1. 소모품 등록 (Item Registration)**
```
Admin/Staff registers new consumable
  -> assigns category/sub_category
  -> sets min_stock/max_stock/reorder_point
  -> item_code auto-generated (MRO-YYYYMM-NNN)
  -> item status = ACTIVE
```

**WF2. 입고 (Inbound/Receiving)**
```
Supplier delivers goods
  -> Staff records inbound (item, quantity, unit_price, supplier)
  -> inventory.current_quantity auto-incremented
  -> reference_number auto-generated (IN-YYYYMMDD-NNN)
  -> item_prices updated if new price
```

**WF3. 출고 요청 (Outbound Requisition) — MRO-specific**
```
Requester submits request
  -> Select item, quantity, department, purpose
  -> System checks stock availability
     -> If sufficient: Confirm -> Decrement inventory -> Generate OUT-YYYYMMDD-NNN
     -> If insufficient: Warning displayed -> Allow override or cancel
  -> If current_quantity < reorder_point after decrement:
     -> DB trigger auto-creates reorder_alert (status=OPEN)
```

**WF4. 재고 점검 (Stock Check)**
```
Staff reviews Dashboard
  -> Items below reorder_point highlighted (yellow)
  -> Items below min_stock highlighted (red)
  -> Reorder alerts panel shows OPEN alerts
  -> Staff can ACKNOWLEDGE or RESOLVE alerts
  -> Export to Excel available
```

**WF5. 분석 (Analytics)**
```
Dashboard shows:
  -> Consumption by department (bar chart)
  -> Monthly inbound/outbound trends (line chart)
  -> Supplier spending (pie chart)
  -> Top consumed items ranking
  -> Date range filtering
```

---

## 5. Database Schema

> Architect Action Item #2: `location_id` is a **hard discriminator** (like MT's `factory_id`).
> NOT NULL on inventory/inbound/outbound. RLS policies enforce location-scoped access.
> Users are assigned to a location; system_admin can view all locations.

### Tables

```sql
-- 1. locations (사업장/위치) — replaces factories
CREATE TABLE locations (
    location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_code VARCHAR(20) UNIQUE NOT NULL,
    location_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. categories (카테고리) — two-level hierarchy
CREATE TABLE categories (
    category_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_code VARCHAR(20) UNIQUE NOT NULL,
    category_name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES categories(category_id),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed categories:
-- 사무용품 (Office) -> 필기구, 용지, 바인더
-- 청소용품 (Cleaning) -> 세제, 걸레, 쓰레기봉투
-- 안전용품 (Safety) -> 장갑, 안전화, 보호안경
-- 공구류 (Tools) -> 수공구, 전동공구, 측정기구
-- 전기자재 (Electrical) -> 케이블, 커넥터, 스위치
-- 배관자재 (Plumbing) -> 파이프, 밸브, 피팅
-- 기타 (Others)

-- 3. items (소모품) — fresh design
CREATE TABLE items (
    item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_code VARCHAR(20) UNIQUE NOT NULL,     -- MRO-YYYYMM-NNN
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
    status VARCHAR(20) DEFAULT 'ACTIVE',       -- ACTIVE, INACTIVE, DISCONTINUED
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50)
);

-- 4. suppliers (공급업체)
CREATE TABLE suppliers (
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
CREATE TABLE departments (
    department_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_code VARCHAR(20) UNIQUE NOT NULL,
    department_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. users (사용자)
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,        -- server-only, excluded from frontend types
    role VARCHAR(20) NOT NULL DEFAULT 'user',   -- system_admin, admin, user, viewer
    department_id UUID REFERENCES departments(department_id),
    location_id UUID REFERENCES locations(location_id),
    is_active BOOLEAN DEFAULT TRUE,
    phone_number VARCHAR(20),
    position VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. inventory (재고)
CREATE TABLE inventory (
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
CREATE TABLE inbound (
    inbound_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inbound_date DATE NOT NULL,
    item_id UUID NOT NULL REFERENCES items(item_id),
    supplier_id UUID REFERENCES suppliers(supplier_id),
    location_id UUID NOT NULL REFERENCES locations(location_id),
    quantity INT NOT NULL,
    unit_price NUMERIC(12, 2),
    total_price NUMERIC(12, 2),
    currency VARCHAR(10) DEFAULT 'KRW',
    reference_number VARCHAR(50),               -- IN-YYYYMMDD-NNN
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);

-- 9. outbound (출고) — MRO consumption-centric
CREATE TABLE outbound (
    outbound_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outbound_date DATE NOT NULL,
    item_id UUID NOT NULL REFERENCES items(item_id),
    location_id UUID NOT NULL REFERENCES locations(location_id),
    quantity INT NOT NULL,
    requester VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES departments(department_id),
    purpose VARCHAR(200),                       -- replaces MT's equipment/reason
    cost_center VARCHAR(50),
    reference_number VARCHAR(50),               -- OUT-YYYYMMDD-NNN
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50)
);

-- 10. item_prices (소모품 단가)
CREATE TABLE item_prices (
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

-- 11. reorder_alerts (재주문 알림) — NEW
CREATE TABLE reorder_alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(item_id),
    location_id UUID NOT NULL REFERENCES locations(location_id),
    current_quantity INT NOT NULL,
    reorder_point INT NOT NULL,
    status VARCHAR(20) DEFAULT 'OPEN',          -- OPEN, ACKNOWLEDGED, RESOLVED
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(50)
);
```

### Reorder-Point Trigger
```sql
CREATE OR REPLACE FUNCTION check_reorder_point()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_quantity < (
        SELECT reorder_point FROM items WHERE item_id = NEW.item_id
    ) THEN
        INSERT INTO reorder_alerts (item_id, location_id, current_quantity, reorder_point)
        SELECT NEW.item_id, NEW.location_id, NEW.current_quantity, i.reorder_point
        FROM items i
        WHERE i.item_id = NEW.item_id
        AND NOT EXISTS (
            SELECT 1 FROM reorder_alerts
            WHERE item_id = NEW.item_id
            AND location_id = NEW.location_id
            AND status = 'OPEN'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_reorder
AFTER UPDATE OF current_quantity ON inventory
FOR EACH ROW
EXECUTE FUNCTION check_reorder_point();
```

### RLS Policies
```sql
-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE reorder_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- All authenticated: READ all tables
-- system_admin: CRUD all, all locations
-- admin: CRUD data tables, own location
-- user: Create inbound/outbound, view others, own location
-- viewer: Read-only, own location
-- Location-scoped: queries filter by user's location_id (system_admin exempt)
```

### Indexes
```sql
CREATE INDEX idx_items_item_code ON items(item_code);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_inventory_item_id ON inventory(item_id);
CREATE INDEX idx_inventory_location ON inventory(location_id);
CREATE INDEX idx_inbound_item_id ON inbound(item_id);
CREATE INDEX idx_inbound_date ON inbound(inbound_date);
CREATE INDEX idx_outbound_item_id ON outbound(item_id);
CREATE INDEX idx_outbound_date ON outbound(outbound_date);
CREATE INDEX idx_outbound_department ON outbound(department_id);
CREATE INDEX idx_reorder_alerts_status ON reorder_alerts(status);
```

---

## 6. Implementation Phases

### P1: Schema & Project Skeleton
**Scope**: Database schema + project infrastructure

**Actions**:
- Create all Supabase tables, indexes, RLS policies, reorder trigger
- Seed categories data (7 top-level + sub-categories)
- Clone infrastructure from MT_Inventory_V2 (per Clone Boundary Checklist)
- Set up project structure, .env.example, .gitignore
- Initialize git repository
- Set up Express auth server skeleton
- Set up Vitest + Playwright test infrastructure

**Acceptance Criteria**:
1. All 11 tables created in Supabase with correct FKs and indexes
2. RLS policies enforce role-based and location-scoped access
3. Reorder trigger: decrement inventory below reorder_point -> reorder_alerts record created (no duplicate OPEN alerts)
4. `npm run dev` starts Vite dev server without errors
5. `npm run dev:server` starts Express server on port 3001
6. TypeScript compiles with zero errors
7. Vitest runs with zero config errors

**Tests**: DB trigger integration test; Supabase connection test

---

### P2: Auth, Layout & Routing
**Scope**: Login, protected routes, main layout, navigation

**Actions**:
- Build auth store fresh (Zustand + persist) — NO factory coupling
  - > **Architect Note**: MT's `auth.store.ts:66-73` dynamically imports `factory.store`. MRO auth must initialize `location.store` instead, with clean separation.
- Clone & adapt Express `/api/auth/login` endpoint (bcrypt against users table)
- Clone & adapt MainLayout (remove ObserverModeIndicator)
- Build Sidebar fresh with MRO menu: Dashboard, 소모품, 재고, 입고, 출고, 공급업체, 부서, 분석, 사용자
- Clone ProtectedRoute as-is
- Set up React Router with all route definitions
- Set up i18n with ko.json/vi.json skeletons
- Build LocationSelector (replaces FactorySelector)

**Acceptance Criteria**:
1. Login with valid credentials -> redirected to Dashboard; invalid -> error message
2. Unauthenticated access to any route -> redirected to Login
3. Sidebar shows all 9 MRO menu items with correct icons
4. Language switcher toggles Korean/Vietnamese
5. LocationSelector filters data by selected location
6. system_admin sees all locations; others see assigned location only

**Tests**: Auth store unit tests (login/logout/persistence); ProtectedRoute redirect tests; login API integration test

---

### P3: Items (소모품) CRUD
**Scope**: Consumable items master data management

**Actions**:
- Create `database.types.ts` with all MRO type definitions
- Create `items.service.ts` (Supabase CRUD with location-scoping)
- Create `items.store.ts` (Zustand with persist)
- Create `Items.tsx` page (Ant Design Table, create/edit modal, category filters)
- Item code auto-generation: `MRO-YYYYMM-NNN` format
- Two-level category filter dropdown
- Zod validation for all item fields

**Acceptance Criteria**:
1. Create item with all required fields validated by Zod -> saved to Supabase -> appears in list
2. Edit item -> changes persisted -> list updated immutably
3. Filter by category (top-level and sub-category) -> only matching items shown
4. Search by item_name or item_code -> results filtered
5. Item code auto-generated in `MRO-YYYYMM-NNN` format, uniqueness enforced
6. Excel export of items list downloads valid .xlsx

**Tests**: items.service CRUD unit tests; Zod validation tests (valid/invalid/edge); item code generation uniqueness tests

---

### P4: Suppliers, Departments & Item Prices
**Scope**: Reference data required by Inbound/Outbound

**Actions**:
- Create Suppliers page, service, store (location-scoped CRUD)
- Create Departments page, service, store
- Create ItemPrices service and store (effective date management)
- Bulk import support for suppliers (Excel)

**Acceptance Criteria**:
1. Supplier CRUD: create/edit/deactivate with validation, location-scoped
2. Department CRUD: create/edit departments
3. Item price management: set current price per item per supplier with effective date range
4. Supplier list filterable by status and location
5. Bulk supplier import from Excel with validation error reporting

**Tests**: Supplier/Department service unit tests; price effective date logic tests; bulk import validation tests

---

### P5: Inventory, Inbound & Outbound
**Scope**: Core MRO operations (acknowledged as NEW development, not adaptation)

**Actions**:
- **Inventory**: Stock status page with color-coded indicators, reorder alerts panel
- **Inbound**: Record receiving -> auto-increment inventory -> auto-generate IN-YYYYMMDD-NNN
- **Outbound**: MRO requisition workflow (requester, department, purpose, stock check, decrement, alert)
- **Reorder Alerts UI**: Dashboard widget, acknowledge/resolve actions
- Atomic multi-table operations via Supabase RPC functions

**Outbound Workflow (MRO-specific)**:
```
Requester -> Select Item -> Enter Quantity -> Select Department -> Enter Purpose
  -> System checks stock availability
  -> If sufficient: Confirm -> Decrement inventory -> Generate OUT reference
  -> If insufficient: Warning displayed -> Allow override or cancel
  -> If below reorder_point after: Alert auto-created by DB trigger
```

**Acceptance Criteria**:
1. Inventory page shows stock per item with status colors (green >= reorder_point, yellow < reorder_point, red < min_stock)
2. Inbound: record receipt -> inventory.current_quantity incremented by exact amount
3. Outbound: dispense -> inventory.current_quantity decremented by exact amount
4. Outbound with insufficient stock -> warning shown before confirmation
5. After outbound, if quantity < reorder_point -> reorder_alert record exists (status=OPEN)
6. Reference numbers auto-generated with correct format and sequential numbering
7. Multi-table operations are atomic (Supabase RPC)

**Tests**: Stock calculation tests; reference number generation tests; reorder trigger integration test; outbound insufficient-stock edge case test; inbound->stock->outbound E2E flow

---

### P6: Dashboard, Analytics & Excel
**Scope**: Reporting, visualization, data export/import

**Actions**:
- Dashboard: summary cards, reorder alerts panel, recent activity feed
- Analytics: consumption by department, monthly trends, supplier spending, top consumed items
- Excel export for all pages
- Excel import for bulk item registration

**KPIs**:
- 총 소모품 수 / 재고 부족 품목 수 / 이번 달 입고 건수 / 이번 달 출고 건수
- 부서별 소모 현황 (bar) / 월별 입출고 추이 (line) / 공급업체별 비용 (pie)
- 재주문 필요 품목 목록

**Acceptance Criteria**:
1. Dashboard loads with correct summary statistics matching DB data
2. Charts render with real data (Recharts)
3. Date range filter on analytics works correctly
4. Excel export downloads valid .xlsx with correct columns per entity
5. Excel import creates items with validation errors reported inline

**Tests**: Dashboard data aggregation logic tests; Excel export/import round-trip test

---

### P7: Users, Settings & Deploy
**Scope**: User management, i18n completion, production deployment

**Actions**:
- Users page: CRUD for system_admin, view for others (role-based)
- Complete i18n translations for all UI strings (ko.json, vi.json)
- Vercel deployment config (vercel.json, region: icn1 Seoul)
- Production environment setup (.env.production)
- Security audit (no hardcoded secrets, RLS verified)

**Acceptance Criteria**:
1. system_admin can create/edit/deactivate users with role assignment
2. Non-admin users cannot access Users page (route guard + RLS)
3. All UI strings display correctly in Korean and Vietnamese
4. `npm run build` produces production bundle without errors
5. Vercel deployment succeeds and app loads in production
6. No password_hash exposed in frontend types or API responses

**Tests**: User role permission tests; i18n key completeness check; build success verification

---

## 7. Testing Strategy

| Phase | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| P1 | DB trigger tests | Supabase connection | - |
| P2 | Auth store (login/logout/persist) | Login API endpoint | Login flow |
| P3 | Item validation, code generation | Items CRUD via Supabase | Item create/edit flow |
| P4 | Price date logic | Supplier/Dept CRUD | - |
| P5 | Stock calculations, ref# gen | Inbound/Outbound + inventory | Full inbound->stock->outbound |
| P6 | Data aggregation logic | Excel round-trip | Dashboard load |
| P7 | Role permission checks | User CRUD API | Full admin flow |

**Frameworks**: Vitest (unit/integration) + Playwright (E2E)
**Coverage Target**: 80% minimum
**Workflow**: TDD (RED -> GREEN -> REFACTOR)

---

## 8. Frontend Structure

```
src/
├── App.tsx                          # [clone] Router provider wrapper
├── AntConfigProvider.tsx            # [clone] Ant Design theme config
├── main.tsx                         # [clone] React entry point
├── vite-env.d.ts                    # [clone] Vite type declarations
├── lib/
│   └── supabase.ts                  # [clone] Supabase client init
├── types/
│   └── database.types.ts            # [fresh] MRO schema types
├── i18n/
│   ├── config.ts                    # [clone-strip] i18n configuration
│   └── locales/
│       ├── ko.json                  # [fresh] Korean translations
│       └── vi.json                  # [fresh] Vietnamese translations
├── router/
│   └── index.tsx                    # [clone-strip] Route definitions
├── store/
│   ├── index.ts                     # [fresh] Store barrel export
│   ├── auth.store.ts                # [fresh] Auth (NO factory coupling)
│   ├── items.store.ts               # [fresh] Items (was parts)
│   ├── inventory.store.ts           # [fresh] Inventory
│   ├── inbound.store.ts             # [fresh] Inbound
│   ├── outbound.store.ts            # [fresh] Outbound
│   ├── suppliers.store.ts           # [fresh] Suppliers
│   ├── departments.store.ts         # [fresh] Departments
│   ├── itemPrice.store.ts           # [fresh] Item prices
│   ├── location.store.ts            # [fresh] Location (was factory)
│   └── users.store.ts               # [fresh] Users
├── services/
│   ├── index.ts                     # [fresh] Service barrel export
│   ├── items.service.ts             # [fresh] Items CRUD
│   ├── inventory.service.ts         # [fresh] Inventory operations
│   ├── inbound.service.ts           # [fresh] Inbound operations
│   ├── outbound.service.ts          # [fresh] Outbound operations
│   ├── suppliers.service.ts         # [fresh] Suppliers CRUD
│   ├── departments.service.ts       # [fresh] Departments CRUD
│   ├── itemPrice.service.ts         # [fresh] Price management
│   ├── locationContext.ts           # [fresh] Location scoping
│   ├── users.service.ts             # [fresh] Users CRUD
│   └── bulkImport.service.ts        # [fresh] Excel import
├── pages/
│   ├── Login.tsx                    # [fresh] Login page
│   ├── Dashboard.tsx                # [fresh] MRO dashboard
│   ├── Items.tsx                    # [fresh] Consumables management
│   ├── Inventory.tsx                # [fresh] Stock management
│   ├── Inbound.tsx                  # [fresh] Receiving
│   ├── Outbound.tsx                 # [fresh] Requisition/dispensing
│   ├── Suppliers.tsx                # [fresh] Supplier management
│   ├── Departments.tsx              # [fresh] Department management
│   ├── Analytics.tsx                # [fresh] Reports & charts
│   └── Users.tsx                    # [fresh] User management
├── components/
│   ├── layout/
│   │   ├── MainLayout.tsx           # [clone-strip] Remove observer mode
│   │   └── Sidebar.tsx              # [fresh] MRO navigation
│   ├── ProtectedRoute.tsx           # [clone] Auth guard
│   ├── ResizableTable.tsx           # [clone] Table component
│   ├── BulkImportModal.tsx          # [fresh] MRO import
│   ├── LocationSelector.tsx         # [fresh] Location picker
│   └── LanguageSwitcher.tsx         # [clone-strip] Language toggle
└── utils/
    ├── excelExport.ts               # [fresh] MRO export columns
    ├── excelImport.ts               # [fresh] MRO import validation
    ├── excelTemplates.ts            # [fresh] MRO templates
    └── errorTranslation.ts          # [clone-strip] Error messages
```

---

## 9. Environment Variables

```env
# Supabase
VITE_SUPABASE_URL=                   # Supabase project URL
VITE_SUPABASE_ANON_KEY=              # Supabase anon key (frontend)
SUPABASE_SERVICE_KEY=                # Supabase service role key (server only)

# Server
PORT=3001                           # Express server port
NODE_ENV=development                # development | production
```

---

## 10. Domain Differences Summary (MT vs MRO)

| Aspect | MT_Inventory_V2 (CNC 부품) | MRO_Inventory (소모품) |
|--------|---------------------------|----------------------|
| Domain | Asset lifecycle management | Consumption tracking |
| Item codes | MT001, MT002 | MRO-YYYYMM-NNN |
| Categories | Flat VARCHAR field | Two-level lookup table |
| Scoping | Factories (ALT/ALV) | Locations (사업장) |
| Outbound | Equipment assignment + reason | Department requisition + purpose |
| Tracking | Part-per-machine | Consumption-per-department |
| Alerts | None | Reorder-point automation |
| Dashboard | Part-oriented metrics | Consumption-oriented KPIs |
| Pricing | Part prices per factory | Item prices per location |

---

## 11. Consensus Record

| Phase | Agent | Verdict | Key Feedback |
|-------|-------|---------|-------------|
| Iteration 1 | Planner | Draft | Clone & Adapt, 9 phases, schema at P9 |
| Iteration 1 | Architect | ITERATE | Schema must be P1; domain mismatch underestimated; reorder undefined |
| Iteration 1 | Critic | REJECT | 2 CRITICAL (schema ordering, no acceptance criteria) + 6 MAJOR |
| Iteration 2 | Planner | Revised | Hybrid approach, 7 phases, schema-first, fresh domain, full AC |
| Iteration 2 | Architect | APPROVE | 3 minor action items (auth coupling, location semantics, clone checklist) |
| Iteration 2 | Critic | ACCEPT | All 8 previous findings resolved; minor items only |
