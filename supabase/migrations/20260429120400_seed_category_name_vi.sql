-- Seed Vietnamese names for the existing 8 default categories.
-- The `IS NULL` guard preserves any vi names the user may already have edited
-- through the Categories page, so re-running this migration is safe.

UPDATE categories SET category_name_vi = 'Văn phòng phẩm'  WHERE category_code = 'OFF' AND category_name_vi IS NULL;
UPDATE categories SET category_name_vi = 'Vật tư sản xuất' WHERE category_code = 'SXS' AND category_name_vi IS NULL;
UPDATE categories SET category_name_vi = 'Vật tư vệ sinh'  WHERE category_code = 'CLN' AND category_name_vi IS NULL;
UPDATE categories SET category_name_vi = 'Vật tư an toàn'  WHERE category_code = 'SAF' AND category_name_vi IS NULL;
UPDATE categories SET category_name_vi = 'Dụng cụ'         WHERE category_code = 'TOL' AND category_name_vi IS NULL;
UPDATE categories SET category_name_vi = 'Vật tư điện'     WHERE category_code = 'ELC' AND category_name_vi IS NULL;
UPDATE categories SET category_name_vi = 'Vật tư đường ống' WHERE category_code = 'PLB' AND category_name_vi IS NULL;
UPDATE categories SET category_name_vi = 'Khác'            WHERE category_code = 'ETC' AND category_name_vi IS NULL;
