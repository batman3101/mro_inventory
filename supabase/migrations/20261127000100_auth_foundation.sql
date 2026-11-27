-- Phase A (additive) — Supabase Auth foundation.
-- Audit 2026-11-27: F02, F04, F05, F06, F07, F08, F11, F13, F15.
--
-- Safe to apply while the current anon-key frontend is still deployed:
-- nothing here removes an existing anon grant or policy. Phase B
-- (20261127000200_auth_lockdown.sql) removes the anon access and must be
-- applied only after the new frontend is live and users are linked to
-- auth.users (scripts/migrate-users-to-auth.mjs).
--
-- Permission model (business rules decided 2026-11-27):
--   * Only active app users linked to auth.users can access data.
--   * users.location_id set  -> that factory only; NULL -> every factory.
--   * system_admin           -> everything incl. user management.
--   * admin, user            -> everything except user management.
--   * viewer                 -> read only.

-- ============================================================
-- 1. users <-> auth.users link
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE
  REFERENCES auth.users(id) ON DELETE SET NULL;

-- Passwords now live in auth.users. Keep the legacy column (data is not
-- dropped) but new users no longer need a value.
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- ============================================================
-- 2. Private helpers (schema not exposed through the Data API)
-- ============================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- Role of the calling app user, NULL when not linked or inactive.
CREATE OR REPLACE FUNCTION private.app_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.role FROM public.users u
  WHERE u.auth_user_id = (SELECT auth.uid()) AND u.is_active;
$$;

-- Factory the calling user is restricted to; NULL means every factory.
-- Only meaningful together with is_active_user().
CREATE OR REPLACE FUNCTION private.user_location_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.location_id FROM public.users u
  WHERE u.auth_user_id = (SELECT auth.uid()) AND u.is_active;
$$;

-- Username of the calling app user, used for created_by / updated_by so the
-- audit trail cannot be spoofed by a client-supplied name.
CREATE OR REPLACE FUNCTION private.app_username()
RETURNS VARCHAR(50)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.username FROM public.users u
  WHERE u.auth_user_id = (SELECT auth.uid()) AND u.is_active;
$$;

CREATE OR REPLACE FUNCTION private.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT private.app_role() IS NOT NULL; $$;

CREATE OR REPLACE FUNCTION private.can_write()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE(private.app_role() IN ('system_admin', 'admin', 'user'), FALSE); $$;

CREATE OR REPLACE FUNCTION private.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE(private.app_role() = 'system_admin', FALSE); $$;

CREATE OR REPLACE FUNCTION private.can_access_location(p_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT private.is_active_user()
     AND (private.user_location_id() IS NULL OR private.user_location_id() = p_location_id);
$$;

-- Raises 42501 unless the caller may write data of p_location_id.
CREATE OR REPLACE FUNCTION private.assert_can_write_location(p_location_id UUID)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NOT (private.can_write() AND private.can_access_location(p_location_id)) THEN
    RAISE EXCEPTION 'forbidden: location=%', p_location_id USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Server-side reference numbers: PREFIX-YYYYMMDD-NN (Vietnam local date).
-- A transaction-scoped advisory lock serialises concurrent creators, and the
-- sequence is compared numerically so ...-99 is followed by ...-100, ...-101.
CREATE OR REPLACE FUNCTION private.next_reference_number(p_kind TEXT)
RETURNS TEXT
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_prefix TEXT := p_kind || '-'
    || to_char((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYYMMDD') || '-';
  v_max INT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('mro_reference:' || v_prefix));

  IF p_kind = 'IN' THEN
    SELECT max(substr(reference_number, length(v_prefix) + 1)::int) INTO v_max
    FROM public.inbound
    WHERE reference_number LIKE v_prefix || '%'
      AND substr(reference_number, length(v_prefix) + 1) ~ '^[0-9]+$';
  ELSIF p_kind = 'OUT' THEN
    SELECT max(substr(reference_number, length(v_prefix) + 1)::int) INTO v_max
    FROM public.outbound
    WHERE reference_number LIKE v_prefix || '%'
      AND substr(reference_number, length(v_prefix) + 1) ~ '^[0-9]+$';
  ELSE
    RAISE EXCEPTION 'invalid_reference_kind: %', p_kind;
  END IF;

  -- lpad() truncates longer input, so never pad to less than the digit count.
  v_max := COALESCE(v_max, 0) + 1;
  RETURN v_prefix || lpad(v_max::text, greatest(2, length(v_max::text)), '0');
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon;
-- Policies are evaluated as the querying role, so authenticated needs EXECUTE.
-- The schema is not exposed, so these cannot be called through the Data API.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA private TO authenticated;

-- ============================================================
-- 3. Table privileges for authenticated
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.locations, public.categories, public.items, public.suppliers,
  public.departments, public.inventory, public.inbound, public.outbound,
  public.item_prices, public.reorder_alerts
TO authenticated;

-- users: read-only for clients and never the credential column. All writes
-- go through the server API (/api/users) with the service key.
REVOKE ALL ON public.users FROM authenticated;
GRANT SELECT (
  user_id, username, full_name, email, role, department_id, location_id,
  is_active, phone_number, position, created_at, updated_at, auth_user_id
) ON public.users TO authenticated;

-- ============================================================
-- 4. RLS policies for authenticated (prefix app_ — phase B keeps only these)
-- ============================================================
ALTER TABLE public.locations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_prices    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reorder_alerts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
  -- (SELECT fn()) form lets Postgres evaluate the helper once per query.
  loc_ok CONSTANT TEXT :=
    '(SELECT private.is_active_user()) AND ((SELECT private.user_location_id()) IS NULL'
    || ' OR location_id = (SELECT private.user_location_id()))';
BEGIN
  -- Global master data (no location column).
  FOREACH t IN ARRAY ARRAY['categories', 'items', 'departments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS app_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS app_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS app_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY app_select ON public.%I FOR SELECT TO authenticated
      USING ((SELECT private.is_active_user()))', t);
    EXECUTE format('CREATE POLICY app_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK ((SELECT private.can_write()))', t);
    EXECUTE format('CREATE POLICY app_update ON public.%I FOR UPDATE TO authenticated
      USING ((SELECT private.can_write())) WITH CHECK ((SELECT private.can_write()))', t);
    EXECUTE format('CREATE POLICY app_delete ON public.%I FOR DELETE TO authenticated
      USING ((SELECT private.can_write()))', t);
  END LOOP;

  -- Factory-scoped data.
  FOREACH t IN ARRAY ARRAY['suppliers', 'inventory', 'inbound', 'outbound',
                           'item_prices', 'reorder_alerts'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS app_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS app_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS app_delete ON public.%I', t);
    EXECUTE format('CREATE POLICY app_select ON public.%I FOR SELECT TO authenticated
      USING (%s)', t, loc_ok);
    EXECUTE format('CREATE POLICY app_insert ON public.%I FOR INSERT TO authenticated
      WITH CHECK ((SELECT private.can_write()) AND %s)', t, loc_ok);
    EXECUTE format('CREATE POLICY app_update ON public.%I FOR UPDATE TO authenticated
      USING ((SELECT private.can_write()) AND %s)
      WITH CHECK ((SELECT private.can_write()) AND %s)', t, loc_ok, loc_ok);
    EXECUTE format('CREATE POLICY app_delete ON public.%I FOR DELETE TO authenticated
      USING ((SELECT private.can_write()) AND %s)', t, loc_ok);
  END LOOP;
END;
$$;

-- locations: a user sees only the factories they may access (this also
-- drives the factory selector). Factory master changes: system_admin only.
DROP POLICY IF EXISTS app_select ON public.locations;
DROP POLICY IF EXISTS app_write ON public.locations;
CREATE POLICY app_select ON public.locations FOR SELECT TO authenticated
  USING ((SELECT private.is_active_user()) AND ((SELECT private.user_location_id()) IS NULL
         OR location_id = (SELECT private.user_location_id())));
CREATE POLICY app_write ON public.locations FOR ALL TO authenticated
  USING ((SELECT private.is_system_admin()))
  WITH CHECK ((SELECT private.is_system_admin()));

-- users: own profile, or every profile for system_admin. No client writes.
DROP POLICY IF EXISTS app_select ON public.users;
CREATE POLICY app_select ON public.users FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()) OR (SELECT private.is_system_admin()));

-- ============================================================
-- 5. Data invariants (F07, F15). Production data checked 2026-11-27:
--    no rows violate these.
-- ============================================================
ALTER TABLE public.inbound DROP CONSTRAINT IF EXISTS inbound_quantity_positive;
ALTER TABLE public.inbound ADD CONSTRAINT inbound_quantity_positive CHECK (quantity > 0);
ALTER TABLE public.inbound DROP CONSTRAINT IF EXISTS inbound_unit_price_nonnegative;
ALTER TABLE public.inbound ADD CONSTRAINT inbound_unit_price_nonnegative
  CHECK (unit_price IS NULL OR unit_price >= 0);
ALTER TABLE public.outbound DROP CONSTRAINT IF EXISTS outbound_quantity_positive;
ALTER TABLE public.outbound ADD CONSTRAINT outbound_quantity_positive CHECK (quantity > 0);
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_quantity_nonnegative;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_quantity_nonnegative
  CHECK (current_quantity >= 0);
ALTER TABLE public.item_prices DROP CONSTRAINT IF EXISTS item_prices_unit_price_nonnegative;
ALTER TABLE public.item_prices ADD CONSTRAINT item_prices_unit_price_nonnegative
  CHECK (unit_price >= 0);
ALTER TABLE public.items DROP CONSTRAINT IF EXISTS items_stock_levels_nonnegative;
ALTER TABLE public.items ADD CONSTRAINT items_stock_levels_nonnegative
  CHECK (min_stock >= 0 AND max_stock >= 0 AND reorder_point >= 0);

-- ============================================================
-- 6. item_prices: factory-scoped keys (F08, F11)
-- ============================================================
-- The original UNIQUE(item_id, supplier_id, effective_from) ignored the
-- factory, so the same price row could not exist in two factories and the
-- bulk upsert could move another factory's row. Drop it whatever its name.
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.item_prices'::regclass
      AND con.contype = 'u'
      AND (SELECT array_agg(att.attname::text ORDER BY att.attname)
           FROM unnest(con.conkey) k
           JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k)
          = ARRAY['effective_from', 'item_id', 'supplier_id']
  LOOP
    EXECUTE format('ALTER TABLE public.item_prices DROP CONSTRAINT %I', c.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.item_prices DROP CONSTRAINT IF EXISTS item_prices_item_location_supplier_from_key;
ALTER TABLE public.item_prices ADD CONSTRAINT item_prices_item_location_supplier_from_key
  UNIQUE (item_id, location_id, supplier_id, effective_from);

-- At most one current price per item per factory.
CREATE UNIQUE INDEX IF NOT EXISTS item_prices_one_current_per_item_location
  ON public.item_prices (item_id, location_id) WHERE is_current;

-- ============================================================
-- 7. Atomic create RPCs (F06, F13)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_inbound_atomic(
  p_inbound_date DATE,
  p_item_id UUID,
  p_supplier_id UUID,
  p_location_id UUID,
  p_quantity INT,
  p_unit_price NUMERIC,
  p_currency VARCHAR(10),
  p_notes TEXT,
  p_created_by VARCHAR(50)
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_actor VARCHAR(50) := private.app_username();  -- p_created_by is ignored
BEGIN
  PERFORM private.assert_can_write_location(p_location_id);
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity: %', p_quantity USING ERRCODE = '22023';
  END IF;
  IF p_unit_price IS NOT NULL AND p_unit_price < 0 THEN
    RAISE EXCEPTION 'invalid_unit_price: %', p_unit_price USING ERRCODE = '22023';
  END IF;

  INSERT INTO inbound (
    inbound_date, item_id, supplier_id, location_id, quantity,
    unit_price, total_price, currency, reference_number, notes, created_by
  ) VALUES (
    p_inbound_date, p_item_id, p_supplier_id, p_location_id, p_quantity,
    p_unit_price, p_quantity * p_unit_price, p_currency,
    private.next_reference_number('IN'), p_notes, v_actor
  )
  RETURNING inbound_id INTO v_id;

  PERFORM apply_inventory_delta(p_item_id, p_location_id, p_quantity, v_actor);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_outbound_atomic(
  p_outbound_date DATE,
  p_item_id UUID,
  p_location_id UUID,
  p_quantity INT,
  p_requester VARCHAR(100),
  p_department_id UUID,
  p_purpose VARCHAR(200),
  p_cost_center VARCHAR(50),
  p_notes TEXT,
  p_created_by VARCHAR(50)
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_current INT;
  v_actor VARCHAR(50) := private.app_username();  -- p_created_by is ignored
BEGIN
  PERFORM private.assert_can_write_location(p_location_id);
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'invalid_quantity: %', p_quantity USING ERRCODE = '22023';
  END IF;

  -- Lock the stock row so concurrent issues of the same item queue up.
  SELECT current_quantity INTO v_current
  FROM inventory
  WHERE item_id = p_item_id AND location_id = p_location_id
  FOR UPDATE;

  IF COALESCE(v_current, 0) < p_quantity THEN
    RAISE EXCEPTION 'inventory_insufficient:%', COALESCE(v_current, 0) USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO outbound (
    outbound_date, item_id, location_id, quantity, requester, department_id,
    purpose, cost_center, reference_number, notes, created_by
  ) VALUES (
    p_outbound_date, p_item_id, p_location_id, p_quantity, p_requester, p_department_id,
    p_purpose, p_cost_center, private.next_reference_number('OUT'), p_notes, v_actor
  )
  RETURNING outbound_id INTO v_id;

  PERFORM apply_inventory_delta(p_item_id, p_location_id, -p_quantity, v_actor);
  RETURN v_id;
END;
$$;

-- ============================================================
-- 8. Atomic price save (F08, F11)
-- ============================================================
-- p_price_id NULL  -> upsert on (item, factory, supplier, effective_from).
-- p_price_id given -> update that row; it must belong to the same item/factory.
-- When p_is_current, every other current price of the same item in the same
-- factory is cleared in the same transaction.
CREATE OR REPLACE FUNCTION public.save_item_price(
  p_price_id UUID,
  p_item_id UUID,
  p_location_id UUID,
  p_unit_price NUMERIC,
  p_currency VARCHAR(10),
  p_supplier_id UUID,
  p_effective_from DATE,
  p_effective_to DATE,
  p_is_current BOOLEAN,
  p_created_by VARCHAR(50)
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_item_id UUID;
  v_location_id UUID;
  v_actor VARCHAR(50) := private.app_username();  -- p_created_by is ignored
BEGIN
  PERFORM private.assert_can_write_location(p_location_id);
  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'invalid_unit_price: %', p_unit_price USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('mro_price:' || p_item_id || ':' || p_location_id));

  IF p_price_id IS NOT NULL THEN
    SELECT item_id, location_id INTO v_item_id, v_location_id
    FROM item_prices WHERE price_id = p_price_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'price_not_found: %', p_price_id;
    END IF;
    IF v_item_id <> p_item_id OR v_location_id <> p_location_id THEN
      RAISE EXCEPTION 'price_scope_mismatch: %', p_price_id USING ERRCODE = '42501';
    END IF;
    v_id := p_price_id;
  ELSE
    SELECT price_id INTO v_id
    FROM item_prices
    WHERE item_id = p_item_id
      AND location_id = p_location_id
      AND supplier_id IS NOT DISTINCT FROM p_supplier_id
      AND effective_from = p_effective_from
    FOR UPDATE;
  END IF;

  IF p_is_current THEN
    UPDATE item_prices SET is_current = FALSE
    WHERE item_id = p_item_id
      AND location_id = p_location_id
      AND is_current
      AND price_id IS DISTINCT FROM v_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO item_prices (
      item_id, location_id, unit_price, currency, supplier_id,
      effective_from, effective_to, is_current, created_by
    ) VALUES (
      p_item_id, p_location_id, p_unit_price, p_currency, p_supplier_id,
      p_effective_from, p_effective_to, p_is_current, v_actor
    )
    RETURNING price_id INTO v_id;
  ELSE
    UPDATE item_prices SET
      unit_price = p_unit_price,
      currency = p_currency,
      supplier_id = p_supplier_id,
      effective_from = p_effective_from,
      effective_to = p_effective_to,
      is_current = p_is_current
    WHERE price_id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- New entry points are for signed-in users only.
REVOKE EXECUTE ON FUNCTION
  public.create_inbound_atomic(DATE, UUID, UUID, UUID, INT, NUMERIC, VARCHAR, TEXT, VARCHAR),
  public.create_outbound_atomic(DATE, UUID, UUID, INT, VARCHAR, UUID, VARCHAR, VARCHAR, TEXT, VARCHAR),
  public.save_item_price(UUID, UUID, UUID, NUMERIC, VARCHAR, UUID, DATE, DATE, BOOLEAN, VARCHAR)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.create_inbound_atomic(DATE, UUID, UUID, UUID, INT, NUMERIC, VARCHAR, TEXT, VARCHAR),
  public.create_outbound_atomic(DATE, UUID, UUID, INT, VARCHAR, UUID, VARCHAR, VARCHAR, TEXT, VARCHAR),
  public.save_item_price(UUID, UUID, UUID, NUMERIC, VARCHAR, UUID, DATE, DATE, BOOLEAN, VARCHAR)
TO authenticated;
