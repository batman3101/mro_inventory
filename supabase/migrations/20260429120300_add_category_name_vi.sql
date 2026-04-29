-- Add Vietnamese name field for categories so the UI can swap labels with i18n.
-- ko stays in the existing category_name column (used as fallback when vi is null).

ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS category_name_vi text;

COMMENT ON COLUMN categories.category_name_vi IS
  'Vietnamese display name. NULL falls back to category_name (Korean).';
