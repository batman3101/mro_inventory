-- Decision: 사내코드 = 소모품코드. The user-managed code IS the item_code.
-- Roll back the external_code column added in 20260429120000 — it's redundant
-- now that item_code itself is user-supplied (no more MRO-YYYYMM-NNN auto gen).
-- Existing data is empty (pre-go-live), so no data preservation needed.

DROP INDEX IF EXISTS idx_items_external_code_unique;
ALTER TABLE items DROP COLUMN IF EXISTS external_code;
