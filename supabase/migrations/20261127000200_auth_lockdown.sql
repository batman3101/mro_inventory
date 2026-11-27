-- Phase B (lockdown) — remove anonymous access.
-- Audit 2026-11-27: F02, F04, F05, F07.
--
-- PRECONDITIONS (apply only when all are true, otherwise the app stops working):
--   1. 20261127000100_auth_foundation.sql is applied.
--   2. scripts/migrate-users-to-auth.mjs linked every active user (auth_user_id).
--   3. The frontend that signs in with Supabase Auth is deployed.

-- ============================================================
-- 1. Drop every legacy policy on app tables. Production policies are not
--    recorded in this repo (they allowed anon), so drop by catalog rather
--    than by name. Phase A policies (prefix app_) are kept.
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('locations', 'categories', 'items', 'suppliers', 'departments',
                        'users', 'inventory', 'inbound', 'outbound', 'item_prices',
                        'reorder_alerts')
      AND policyname NOT LIKE 'app\_%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END;
$$;

-- ============================================================
-- 2. No anonymous table access at all; keep it that way for new objects.
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- ============================================================
-- 3. Existing inventory RPCs: add caller authorisation and input checks
--    (same signatures, so the frontend calls do not change).
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_inbound_atomic(
  p_inbound_id UUID,
  p_item_id UUID,
  p_supplier_id UUID,
  p_quantity INT,
  p_unit_price NUMERIC,
  p_currency VARCHAR(10),
  p_notes TEXT,
  p_inbound_date DATE,
  p_updated_by VARCHAR(50)
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_item_id UUID;
  prev_location_id UUID;
  prev_quantity INT;
  v_actor VARCHAR(50) := private.app_username();  -- p_updated_by is ignored
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity: %', p_quantity USING ERRCODE = '22023';
  END IF;
  IF p_unit_price IS NOT NULL AND p_unit_price < 0 THEN
    RAISE EXCEPTION 'invalid_unit_price: %', p_unit_price USING ERRCODE = '22023';
  END IF;

  SELECT item_id, location_id, quantity
  INTO prev_item_id, prev_location_id, prev_quantity
  FROM inbound
  WHERE inbound_id = p_inbound_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inbound_not_found: %', p_inbound_id;
  END IF;
  PERFORM private.assert_can_write_location(prev_location_id);

  UPDATE inbound
  SET
    item_id = p_item_id,
    supplier_id = p_supplier_id,
    quantity = p_quantity,
    unit_price = p_unit_price,
    total_price = p_quantity * p_unit_price,
    currency = p_currency,
    notes = p_notes,
    inbound_date = p_inbound_date
  WHERE inbound_id = p_inbound_id;

  IF prev_item_id = p_item_id THEN
    PERFORM apply_inventory_delta(
      p_item_id, prev_location_id, p_quantity - prev_quantity, v_actor
    );
  ELSE
    PERFORM apply_inventory_delta(
      prev_item_id, prev_location_id, -prev_quantity, v_actor
    );
    PERFORM apply_inventory_delta(
      p_item_id, prev_location_id, p_quantity, v_actor
    );
  END IF;

  RETURN p_inbound_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_inbound_atomic(
  p_inbound_id UUID,
  p_updated_by VARCHAR(50)
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_item_id UUID;
  prev_location_id UUID;
  prev_quantity INT;
  v_actor VARCHAR(50) := private.app_username();  -- p_updated_by is ignored
BEGIN
  SELECT item_id, location_id, quantity
  INTO prev_item_id, prev_location_id, prev_quantity
  FROM inbound
  WHERE inbound_id = p_inbound_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  PERFORM private.assert_can_write_location(prev_location_id);

  PERFORM apply_inventory_delta(
    prev_item_id, prev_location_id, -prev_quantity, v_actor
  );

  DELETE FROM inbound WHERE inbound_id = p_inbound_id;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_outbound_atomic(
  p_outbound_id UUID,
  p_item_id UUID,
  p_quantity INT,
  p_outbound_date DATE,
  p_requester VARCHAR(100),
  p_department_id UUID,
  p_purpose VARCHAR(200),
  p_cost_center VARCHAR(50),
  p_notes TEXT,
  p_updated_by VARCHAR(50)
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_item_id UUID;
  prev_location_id UUID;
  prev_quantity INT;
  v_actor VARCHAR(50) := private.app_username();  -- p_updated_by is ignored
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity: %', p_quantity USING ERRCODE = '22023';
  END IF;

  SELECT item_id, location_id, quantity
  INTO prev_item_id, prev_location_id, prev_quantity
  FROM outbound
  WHERE outbound_id = p_outbound_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbound_not_found: %', p_outbound_id;
  END IF;
  PERFORM private.assert_can_write_location(prev_location_id);

  UPDATE outbound
  SET
    item_id = p_item_id,
    quantity = p_quantity,
    outbound_date = p_outbound_date,
    requester = p_requester,
    department_id = p_department_id,
    purpose = p_purpose,
    cost_center = p_cost_center,
    notes = p_notes
  WHERE outbound_id = p_outbound_id;

  IF prev_item_id = p_item_id THEN
    PERFORM apply_inventory_delta(
      p_item_id, prev_location_id, prev_quantity - p_quantity, v_actor
    );
  ELSE
    PERFORM apply_inventory_delta(
      prev_item_id, prev_location_id, prev_quantity, v_actor
    );
    PERFORM apply_inventory_delta(
      p_item_id, prev_location_id, -p_quantity, v_actor
    );
  END IF;

  RETURN p_outbound_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_outbound_atomic(
  p_outbound_id UUID,
  p_updated_by VARCHAR(50)
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prev_item_id UUID;
  prev_location_id UUID;
  prev_quantity INT;
  v_actor VARCHAR(50) := private.app_username();  -- p_updated_by is ignored
BEGIN
  SELECT item_id, location_id, quantity
  INTO prev_item_id, prev_location_id, prev_quantity
  FROM outbound
  WHERE outbound_id = p_outbound_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  PERFORM private.assert_can_write_location(prev_location_id);

  PERFORM apply_inventory_delta(
    prev_item_id, prev_location_id, prev_quantity, v_actor
  );

  DELETE FROM outbound WHERE outbound_id = p_outbound_id;
  RETURN TRUE;
END;
$$;

-- ============================================================
-- 4. Function privileges (F02). CREATE FUNCTION grants EXECUTE to PUBLIC by
--    default, which included anon.
-- ============================================================
REVOKE EXECUTE ON FUNCTION
  public.apply_inventory_delta(UUID, UUID, INT, VARCHAR),
  public.update_inbound_atomic(UUID, UUID, UUID, INT, NUMERIC, VARCHAR, TEXT, DATE, VARCHAR),
  public.delete_inbound_atomic(UUID, VARCHAR),
  public.update_outbound_atomic(UUID, UUID, INT, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, TEXT, VARCHAR),
  public.delete_outbound_atomic(UUID, VARCHAR)
FROM PUBLIC, anon;

-- Internal helper: only reachable through the RPCs above (definer context).
REVOKE EXECUTE ON FUNCTION public.apply_inventory_delta(UUID, UUID, INT, VARCHAR)
FROM authenticated;

GRANT EXECUTE ON FUNCTION
  public.update_inbound_atomic(UUID, UUID, UUID, INT, NUMERIC, VARCHAR, TEXT, DATE, VARCHAR),
  public.delete_inbound_atomic(UUID, VARCHAR),
  public.update_outbound_atomic(UUID, UUID, INT, DATE, VARCHAR, UUID, VARCHAR, VARCHAR, TEXT, VARCHAR),
  public.delete_outbound_atomic(UUID, VARCHAR)
TO authenticated;
