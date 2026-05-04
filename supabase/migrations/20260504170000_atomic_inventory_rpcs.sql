-- Atomic inventory mutation RPCs.
--
-- Replaces the previous client-side read-modify-write pattern where
-- inbound/outbound mutation paths did:
--   1. SELECT current_quantity
--   2. compute next in JS
--   3. UPDATE current_quantity = next
-- That pattern silently dropped concurrent updates and could double-apply
-- on retry when the second of two HTTP calls failed.
--
-- These RPCs run inside a single implicit transaction so the row update
-- and the inventory adjustment commit (or rollback) together.

-- 1. apply_inventory_delta
-- Adds p_delta to inventory.(item_id, location_id). Inserts a new
-- inventory row when none exists and delta >= 0. Refuses to drive
-- current_quantity below zero. Returns the resulting quantity.
CREATE OR REPLACE FUNCTION apply_inventory_delta(
  p_item_id UUID,
  p_location_id UUID,
  p_delta INT,
  p_updated_by VARCHAR(50)
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_qty INT;
BEGIN
  IF p_delta = 0 THEN
    SELECT current_quantity INTO new_qty
    FROM inventory
    WHERE item_id = p_item_id AND location_id = p_location_id;
    RETURN COALESCE(new_qty, 0);
  END IF;

  UPDATE inventory
  SET
    current_quantity = current_quantity + p_delta,
    updated_at = NOW(),
    updated_by = p_updated_by
  WHERE item_id = p_item_id AND location_id = p_location_id
  RETURNING current_quantity INTO new_qty;

  IF NOT FOUND THEN
    IF p_delta < 0 THEN
      RAISE EXCEPTION 'inventory_negative: item=%, location=%, current=0, delta=%',
        p_item_id, p_location_id, p_delta;
    END IF;
    INSERT INTO inventory (
      item_id, location_id, current_quantity,
      last_count_date, storage_location, updated_by
    )
    VALUES (
      p_item_id, p_location_id, p_delta,
      NOW(), '', p_updated_by
    )
    RETURNING current_quantity INTO new_qty;
    RETURN new_qty;
  END IF;

  IF new_qty < 0 THEN
    RAISE EXCEPTION 'inventory_negative: item=%, location=%, new_qty=%',
      p_item_id, p_location_id, new_qty;
  END IF;

  RETURN new_qty;
END;
$$;

-- 2. update_inbound_atomic
-- Updates an inbound row and reconciles inventory in one transaction.
-- Item swap (item_id changes) results in -prev_qty on the old item and
-- +new_qty on the new item; same item is a single delta.
CREATE OR REPLACE FUNCTION update_inbound_atomic(
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
BEGIN
  SELECT item_id, location_id, quantity
  INTO prev_item_id, prev_location_id, prev_quantity
  FROM inbound
  WHERE inbound_id = p_inbound_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inbound_not_found: %', p_inbound_id;
  END IF;

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
      p_item_id, prev_location_id, p_quantity - prev_quantity, p_updated_by
    );
  ELSE
    PERFORM apply_inventory_delta(
      prev_item_id, prev_location_id, -prev_quantity, p_updated_by
    );
    PERFORM apply_inventory_delta(
      p_item_id, prev_location_id, p_quantity, p_updated_by
    );
  END IF;

  RETURN p_inbound_id;
END;
$$;

-- 3. delete_inbound_atomic
-- Deletes an inbound row and undoes its inventory contribution in one
-- transaction. Idempotent: missing row returns false silently.
CREATE OR REPLACE FUNCTION delete_inbound_atomic(
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
BEGIN
  SELECT item_id, location_id, quantity
  INTO prev_item_id, prev_location_id, prev_quantity
  FROM inbound
  WHERE inbound_id = p_inbound_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM apply_inventory_delta(
    prev_item_id, prev_location_id, -prev_quantity, p_updated_by
  );

  DELETE FROM inbound WHERE inbound_id = p_inbound_id;
  RETURN TRUE;
END;
$$;

-- 4. update_outbound_atomic
-- Symmetric to update_inbound_atomic but for outbound (deductive).
-- Same item: delta = prev_quantity - new_quantity (less out = restore).
-- Item swap: +prev on old item (restore), -new on new item (deduct).
CREATE OR REPLACE FUNCTION update_outbound_atomic(
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
BEGIN
  SELECT item_id, location_id, quantity
  INTO prev_item_id, prev_location_id, prev_quantity
  FROM outbound
  WHERE outbound_id = p_outbound_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'outbound_not_found: %', p_outbound_id;
  END IF;

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
      p_item_id, prev_location_id, prev_quantity - p_quantity, p_updated_by
    );
  ELSE
    PERFORM apply_inventory_delta(
      prev_item_id, prev_location_id, prev_quantity, p_updated_by
    );
    PERFORM apply_inventory_delta(
      p_item_id, prev_location_id, -p_quantity, p_updated_by
    );
  END IF;

  RETURN p_outbound_id;
END;
$$;

-- 5. delete_outbound_atomic
-- Restores the deducted quantity and removes the ledger row in one
-- transaction. Idempotent.
CREATE OR REPLACE FUNCTION delete_outbound_atomic(
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
BEGIN
  SELECT item_id, location_id, quantity
  INTO prev_item_id, prev_location_id, prev_quantity
  FROM outbound
  WHERE outbound_id = p_outbound_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  PERFORM apply_inventory_delta(
    prev_item_id, prev_location_id, prev_quantity, p_updated_by
  );

  DELETE FROM outbound WHERE outbound_id = p_outbound_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_inventory_delta(UUID, UUID, INT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION update_inbound_atomic(UUID, UUID, UUID, INT, NUMERIC, VARCHAR, TEXT, DATE, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_inbound_atomic(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION update_outbound_atomic(UUID, UUID, INT, DATE, VARCHAR(100), UUID, VARCHAR(200), VARCHAR(50), TEXT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_outbound_atomic(UUID, VARCHAR) TO authenticated;
