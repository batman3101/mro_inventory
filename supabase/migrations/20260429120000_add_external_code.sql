-- Add external_code (사내 코드) column to items table.
-- User-managed product code from internal / corporate systems.
-- NULL allowed (점진 도입), unique when present.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS external_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_external_code_unique
  ON items(external_code)
  WHERE external_code IS NOT NULL;

COMMENT ON COLUMN items.external_code IS
  'User-managed external/corporate item code. NULL allowed; unique when present.';
