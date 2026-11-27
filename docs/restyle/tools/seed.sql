-- Fictional data for local screenshots only. Never run against production.
BEGIN;

-- the profile the signup trigger made for the test login becomes an active system admin (all factories)
UPDATE public.users
SET role = 'system_admin', is_active = true, location_id = NULL, full_name = '테스트 관리자', username = 'restyle_admin'
WHERE email = 'restyle@example.com';

INSERT INTO public.departments (department_code, department_name) VALUES
  ('PROD', '생산'), ('QC', '품질'), ('MAINT', '보전'), ('PURCH', '구매'), ('LOG', '물류'), ('ADMIN', '총무')
ON CONFLICT (department_code) DO NOTHING;

INSERT INTO public.users (username, full_name, email, role, is_active, position, location_id, department_id) VALUES
  ('kim.minsu', '김민수', 'kim.minsu@example.com', 'admin', true, '과장', (SELECT location_id FROM locations WHERE location_code = 'ALT'), (SELECT department_id FROM departments WHERE department_code = 'PURCH')),
  ('nguyen.an', 'Nguyễn Văn An', 'nguyen.an@example.com', 'user', true, 'Nhân viên', (SELECT location_id FROM locations WHERE location_code = 'ALT'), (SELECT department_id FROM departments WHERE department_code = 'MAINT')),
  ('tran.huong', 'Trần Thị Hương', 'tran.huong@example.com', 'viewer', true, 'Kế toán', (SELECT location_id FROM locations WHERE location_code = 'ALV'), (SELECT department_id FROM departments WHERE department_code = 'ADMIN')),
  ('lee.jiwon', '이지원', 'lee.jiwon@example.com', 'viewer', false, '사원', NULL, (SELECT department_id FROM departments WHERE department_code = 'QC'))
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.suppliers (supplier_code, supplier_name, contact_person, email, phone, country, status, location_id)
SELECT v.code, v.name, v.person, v.email, v.phone, v.country, v.status, l.location_id
FROM (VALUES
  ('SUP-001', 'Công ty TNHH Dụng cụ Bắc Ninh', 'Phạm Quốc Bảo', 'sales@bacninh-tools.example', '0222-555-0101', 'Vietnam', 'ACTIVE'),
  ('SUP-002', '한성공구상사', '박정훈', 'order@hansung.example', '031-555-0102', 'Korea', 'ACTIVE'),
  ('SUP-003', 'Vina Safety Co., Ltd', 'Lê Thị Mai', 'contact@vinasafety.example', '024-555-0103', 'Vietnam', 'ACTIVE'),
  ('SUP-004', 'Thiết bị điện Hà Nội', 'Đỗ Minh Tuấn', 'info@hanoi-electric.example', '024-555-0104', 'Vietnam', 'ACTIVE'),
  ('SUP-005', '대한절삭유', '최영호', 'cs@daehan-oil.example', '055-555-0105', 'Korea', 'INACTIVE'),
  ('SUP-006', 'Văn phòng phẩm Sao Việt', 'Hoàng Thu Trang', 'vpp@saoviet.example', '0222-555-0106', 'Vietnam', 'ACTIVE')
) AS v(code, name, person, email, phone, country, status)
CROSS JOIN locations l WHERE l.location_code = 'ALT'
ON CONFLICT (supplier_code) DO NOTHING;

INSERT INTO public.items (item_code, item_name, korean_name, vietnamese_name, category_id, spec, unit, min_stock, max_stock, reorder_point, storage_location, status, description)
SELECT v.code, v.name, v.ko, v.vi, c.category_id, v.spec, v.unit, v.mn, v.mx, v.rp, v.loc, v.status, v.descr
FROM (VALUES
  ('AT-0001', '엔드밀 Ø10 4날', '엔드밀 Ø10 4날', 'Dao phay ngón Ø10 4 me', 'TOL', 'Ø10 x 75L', 'EA', 20, 200, 30, 'A-01', 'ACTIVE', '알루미늄 가공용'),
  ('AT-0002', '엔드밀 Ø6 2날', '엔드밀 Ø6 2날', 'Dao phay ngón Ø6 2 me', 'TOL', 'Ø6 x 50L', 'EA', 20, 200, 30, 'A-01', 'ACTIVE', NULL),
  ('AT-0003', '드릴 Ø8.5 초경', '드릴 Ø8.5 초경', 'Mũi khoan hợp kim Ø8.5', 'TOL', 'Ø8.5 x 100L', 'EA', 10, 100, 15, 'A-02', 'ACTIVE', NULL),
  ('AT-0004', '탭 M6x1.0', '탭 M6x1.0', 'Mũi taro M6x1.0', 'TOL', 'M6 x 1.0', 'EA', 15, 150, 20, 'A-02', 'ACTIVE', NULL),
  ('AT-0005', '인서트 CNMG120408', '인서트 CNMG120408', 'Mảnh dao tiện CNMG120408', 'TOL', 'CNMG120408', 'EA', 50, 500, 80, 'A-03', 'ACTIVE', NULL),
  ('AT-0006', '절삭유 수용성 20L', '절삭유 수용성 20L', 'Dầu cắt gọt pha nước 20L', 'ETC', '20L', 'CAN', 5, 40, 8, 'C-01', 'ACTIVE', NULL),
  ('AT-0007', '안전장갑 (코팅)', '안전장갑 (코팅)', 'Găng tay bảo hộ phủ cao su', 'SAF', 'L', 'PAIR', 100, 1000, 150, 'B-01', 'ACTIVE', NULL),
  ('AT-0008', '보안경', '보안경', 'Kính bảo hộ', 'SAF', '투명', 'EA', 20, 200, 30, 'B-01', 'ACTIVE', NULL),
  ('AT-0009', '방진마스크 KF94', '방진마스크 KF94', 'Khẩu trang chống bụi KF94', 'SAF', 'KF94', 'BOX', 10, 100, 15, 'B-02', 'ACTIVE', NULL),
  ('AT-0010', '귀마개', '귀마개', 'Nút tai chống ồn', 'SAF', NULL, 'BOX', 5, 50, 8, 'B-02', 'ACTIVE', NULL),
  ('AT-0011', '산업용 와이퍼', '산업용 와이퍼', 'Giấy lau công nghiệp', 'CLN', '280매', 'BOX', 10, 120, 20, 'C-02', 'ACTIVE', NULL),
  ('AT-0012', '세척제 IPA 18L', '세척제 IPA 18L', 'Dung dịch tẩy rửa IPA 18L', 'CLN', '18L', 'CAN', 4, 30, 6, 'C-01', 'ACTIVE', NULL),
  ('AT-0013', '빗자루 세트', '빗자루 세트', 'Bộ chổi quét', 'CLN', NULL, 'SET', 3, 20, 5, 'C-03', 'INACTIVE', NULL),
  ('AT-0014', '전선 2.5SQ', '전선 2.5SQ', 'Dây điện 2.5SQ', 'ELC', '100m', 'ROLL', 2, 20, 4, 'D-01', 'ACTIVE', NULL),
  ('AT-0015', '근접센서 M12', '근접센서 M12', 'Cảm biến tiệm cận M12', 'ELC', 'NPN NO', 'EA', 5, 50, 8, 'D-01', 'ACTIVE', NULL),
  ('AT-0016', '릴레이 24VDC', '릴레이 24VDC', 'Rơ le 24VDC', 'ELC', '24VDC 8P', 'EA', 10, 80, 15, 'D-02', 'ACTIVE', NULL),
  ('AT-0017', 'LED 작업등', 'LED 작업등', 'Đèn LED làm việc', 'ELC', '24V 10W', 'EA', 3, 30, 5, 'D-02', 'ACTIVE', NULL),
  ('AT-0018', '에어호스 Ø8', '에어호스 Ø8', 'Ống khí nén Ø8', 'PLB', '100m', 'ROLL', 2, 15, 3, 'E-01', 'ACTIVE', NULL),
  ('AT-0019', '원터치 피팅 Ø8', '원터치 피팅 Ø8', 'Đầu nối nhanh Ø8', 'PLB', 'PC8-02', 'EA', 30, 300, 50, 'E-01', 'ACTIVE', NULL),
  ('AT-0020', '테프론 테이프', '테프론 테이프', 'Băng tan', 'PLB', '13mm', 'EA', 20, 200, 30, 'E-02', 'ACTIVE', NULL),
  ('AT-0021', 'A4 복사용지', 'A4 복사용지', 'Giấy in A4', 'OFF', '80g 500매', 'BOX', 10, 100, 15, 'F-01', 'ACTIVE', NULL),
  ('AT-0022', '네임펜 (흑)', '네임펜 (흑)', 'Bút lông dầu (đen)', 'OFF', NULL, 'EA', 20, 200, 30, 'F-01', 'ACTIVE', NULL),
  ('AT-0023', '라벨지 100x50', '라벨지 100x50', 'Giấy nhãn 100x50', 'OFF', '1000매', 'ROLL', 10, 100, 15, 'F-02', 'ACTIVE', NULL),
  ('AT-0024', '버니어 캘리퍼스 150mm', '버니어 캘리퍼스 150mm', 'Thước cặp điện tử 150mm', 'TOL', '0-150mm', 'EA', 2, 20, 3, 'A-04', 'ACTIVE', NULL),
  ('AT-0025', '줄 세트 (구형)', '줄 세트 (구형)', 'Bộ giũa (loại cũ)', 'TOL', '5본조', 'SET', 0, 10, 0, 'A-04', 'DISCONTINUED', '단종')
) AS v(code, name, ko, vi, cat, spec, unit, mn, mx, rp, loc, status, descr)
JOIN categories c ON c.category_code = v.cat
ON CONFLICT (item_code) DO NOTHING;

-- stock: a few lines below the minimum and two at zero so the warning states show
INSERT INTO public.inventory (item_id, location_id, current_quantity, storage_location, last_count_date)
SELECT i.item_id, l.location_id,
  CASE
    WHEN i.item_code IN ('AT-0003', 'AT-0015') THEN 0
    WHEN i.item_code IN ('AT-0005', 'AT-0007', 'AT-0012', 'AT-0019') THEN greatest(i.min_stock / 2, 1)
    ELSE i.min_stock + (abs(hashtext(i.item_code)) % (i.max_stock - i.min_stock + 1))
  END,
  i.storage_location, now() - (abs(hashtext(i.item_code)) % 20) * interval '1 day'
FROM items i CROSS JOIN locations l
WHERE l.location_code = 'ALT'
ON CONFLICT (item_id, location_id) DO NOTHING;

INSERT INTO public.item_prices (item_id, location_id, unit_price, currency, supplier_id, effective_from, is_current)
SELECT i.item_id, l.location_id, (20 + abs(hashtext(i.item_code)) % 480) * 1000, 'VND',
  (SELECT supplier_id FROM suppliers ORDER BY supplier_code OFFSET (abs(hashtext(i.item_code)) % 6) LIMIT 1),
  current_date - 30, true
FROM items i CROSS JOIN locations l
WHERE l.location_code = 'ALT' AND i.item_code NOT IN ('AT-0022', 'AT-0025');

-- price history for the first item (the price trend chart needs two or more)
INSERT INTO public.item_prices (item_id, location_id, unit_price, currency, supplier_id, effective_from, effective_to, is_current)
SELECT i.item_id, l.location_id, p.price, 'VND', (SELECT supplier_id FROM suppliers WHERE supplier_code = 'SUP-002'), current_date - p.ago, current_date - p.ago + 30, false
FROM items i CROSS JOIN locations l
CROSS JOIN (VALUES (150, 182000), (120, 188000), (90, 176000), (60, 195000)) AS p(ago, price)
WHERE l.location_code = 'ALT' AND i.item_code = 'AT-0001';

INSERT INTO public.inbound (inbound_date, item_id, supplier_id, location_id, quantity, unit_price, total_price, currency, reference_number, notes, created_at, created_by)
SELECT d.day, i.item_id,
  (SELECT supplier_id FROM suppliers ORDER BY supplier_code OFFSET ((g + n) % 6) LIMIT 1),
  l.location_id, q.qty, pr.price, q.qty * pr.price, 'VND',
  'IN-' || to_char(d.day, 'YYYYMMDD') || '-' || lpad(n::text, 2, '0'),
  NULL, d.day + interval '9 hours' + n * interval '17 minutes', 'restyle_admin'
FROM generate_series(0, 44) AS g
CROSS JOIN LATERAL (SELECT (current_date - g)::date AS day) d
CROSS JOIN generate_series(1, 1 + g % 3) AS n
CROSS JOIN LATERAL (SELECT item_id, item_code FROM items ORDER BY item_code OFFSET ((g * 7 + n * 3) % 24) LIMIT 1) i
CROSS JOIN LATERAL (SELECT 5 + (g * 13 + n * 7) % 60 AS qty) q
CROSS JOIN LATERAL (SELECT (20 + abs(hashtext(i.item_code)) % 480) * 1000 AS price) pr
CROSS JOIN locations l
WHERE l.location_code = 'ALT' AND g % 4 <> 3;

INSERT INTO public.outbound (outbound_date, item_id, location_id, quantity, requester, department_id, purpose, reference_number, created_at, created_by)
SELECT d.day, i.item_id, l.location_id, 1 + (g * 5 + n * 11) % 25,
  (ARRAY['김민수', 'Nguyễn Văn An', 'Trần Thị Hương', '이지원', 'Phạm Quốc Bảo', '박정훈'])[1 + (g + n) % 6],
  (SELECT department_id FROM departments ORDER BY department_code OFFSET ((g * 2 + n) % 6) LIMIT 1),
  (ARRAY['라인 소모품 교체', 'Thay dụng cụ máy CNC số 3', '정기 보전', 'Bảo trì định kỳ', '신규 작업자 지급', 'Vệ sinh cuối ca'])[1 + (g + n * 2) % 6],
  'OUT-' || to_char(d.day, 'YYYYMMDD') || '-' || lpad(n::text, 2, '0'),
  d.day + interval '13 hours' + n * interval '23 minutes', 'restyle_admin'
FROM generate_series(0, 89) AS g
CROSS JOIN LATERAL (SELECT (current_date - g)::date AS day) d
CROSS JOIN generate_series(1, 1 + g % 4) AS n
CROSS JOIN LATERAL (SELECT item_id FROM items ORDER BY item_code OFFSET ((g * 3 + n * 5) % 24) LIMIT 1) i
CROSS JOIN locations l
WHERE l.location_code = 'ALT' AND g % 7 <> 6;

COMMIT;
