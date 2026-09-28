-- ============================================================
-- BEVER — Migration 003: Order State Machine Enforcement
-- ============================================================
-- This function enforces the order state machine at the database level.
-- No client app can bypass this — it runs on every order status UPDATE.
--
-- See ORDER_STATE_MACHINE.md for the full specification.
-- ============================================================

-- ─── State Machine Validation Function ───────────────────────────────────────

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role user_role;
BEGIN
  -- Only validate if status is actually changing
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get the role of the user making this change
  SELECT role INTO v_user_role FROM profiles WHERE id = auth.uid();

  -- Validate the transition based on current state and user role
  CASE OLD.status
    WHEN 'PENDING' THEN
      IF NEW.status = 'MERCHANT_ACCEPTED' AND v_user_role = 'merchant' THEN RETURN NEW; END IF;
      IF NEW.status = 'REJECTED'          AND v_user_role = 'merchant' THEN RETURN NEW; END IF;
      IF NEW.status = 'CANCELLED'         AND v_user_role IN ('customer', 'admin') THEN RETURN NEW; END IF;

    WHEN 'MERCHANT_ACCEPTED' THEN
      IF NEW.status = 'PREPARING'  AND v_user_role = 'merchant' THEN RETURN NEW; END IF;
      IF NEW.status = 'CANCELLED'  AND v_user_role = 'admin'    THEN RETURN NEW; END IF;

    WHEN 'PREPARING' THEN
      IF NEW.status = 'READY_FOR_PICKUP' AND v_user_role = 'merchant' THEN RETURN NEW; END IF;

    WHEN 'READY_FOR_PICKUP' THEN
      IF NEW.status = 'RIDER_ASSIGNED' AND v_user_role = 'admin' THEN RETURN NEW; END IF;

    WHEN 'RIDER_ASSIGNED' THEN
      IF NEW.status = 'RIDER_AT_STORE'    AND v_user_role = 'rider' THEN RETURN NEW; END IF;
      IF NEW.status = 'READY_FOR_PICKUP'  AND v_user_role = 'admin' THEN RETURN NEW; END IF;

    WHEN 'RIDER_AT_STORE' THEN
      IF NEW.status = 'PICKED_UP' AND v_user_role = 'rider' THEN RETURN NEW; END IF;

    WHEN 'PICKED_UP' THEN
      IF NEW.status = 'OUT_FOR_DELIVERY' AND v_user_role = 'rider' THEN RETURN NEW; END IF;

    WHEN 'OUT_FOR_DELIVERY' THEN
      IF NEW.status = 'DELIVERED'       AND v_user_role = 'rider' THEN RETURN NEW; END IF;
      IF NEW.status = 'DELIVERY_FAILED' AND v_user_role IN ('rider', 'admin') THEN RETURN NEW; END IF;

    WHEN 'DELIVERY_FAILED' THEN
      IF NEW.status = 'REFUND_PENDING' AND v_user_role = 'admin' THEN RETURN NEW; END IF;

    WHEN 'REFUND_PENDING' THEN
      IF NEW.status = 'REFUNDED' AND v_user_role = 'admin' THEN RETURN NEW; END IF;

    ELSE
      -- Terminal states: DELIVERED, REJECTED, CANCELLED, PAYMENT_FAILED, REFUNDED
      RAISE EXCEPTION
        'Order % is in terminal state % and cannot be updated.',
        OLD.id, OLD.status
        USING ERRCODE = 'P0001';
  END CASE;

  -- If we reach here, no valid transition matched
  RAISE EXCEPTION
    'Invalid order status transition: % → % for role %.',
    OLD.status, NEW.status, v_user_role
    USING ERRCODE = 'P0002';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to orders table
CREATE TRIGGER enforce_order_status_transition
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_status_transition();

-- ─── Auto-log Status Changes ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (
      order_id,
      from_status,
      to_status,
      changed_by,
      changed_by_role,
      created_at
    )
    SELECT
      NEW.id,
      OLD.status,
      NEW.status,
      auth.uid(),
      (SELECT role::TEXT FROM profiles WHERE id = auth.uid()),
      NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_order_status_changes
  AFTER UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();

-- ─── Auto-generate Order Number ───────────────────────────────────────────────

CREATE SEQUENCE order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number = 'BVR-' ||
    TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- ─── Auto-set Initial Status History ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION log_initial_order_status()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO order_status_history (
    order_id,
    from_status,
    to_status,
    changed_by,
    changed_by_role,
    created_at
  )
  VALUES (
    NEW.id,
    NULL, -- No previous status
    NEW.status,
    auth.uid(),
    (SELECT role::TEXT FROM profiles WHERE id = auth.uid()),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_initial_order_status
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION log_initial_order_status();
