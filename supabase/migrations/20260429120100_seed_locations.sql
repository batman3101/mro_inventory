-- Seed default factory locations (idempotent).
-- ALT and ALV are the two factories used in this multi-factory deployment.

INSERT INTO locations (location_code, location_name, is_active)
VALUES
  ('ALT', 'ALT Factory', true),
  ('ALV', 'ALV Factory', true)
ON CONFLICT (location_code) DO NOTHING;
