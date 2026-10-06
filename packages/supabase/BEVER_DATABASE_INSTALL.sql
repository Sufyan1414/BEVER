-- ============================================================
-- BEVER — CONSOLIDATED DATABASE INSTALLATION SCRIPT
-- ============================================================
-- This script combines migrations 001 through 016 in their
-- exact dependency order. It is safe to run on a completely
-- empty Supabase project.
--
-- DO NOT modify this script. If the schema needs to change,
-- add a new numbered migration file (014_...) and append it
-- to this consolidated script as a clearly separated section.
--
-- Source migration files: packages/supabase/migrations/
-- Generated from: 001_initial_schema.sql through 016_enable_realtime_operational_tables.sql
-- ============================================================


-- ============================================================
-- MIGRATION 001: Initial Schema
-- Source: 001_initial_schema.sql
-- Creates all tables, enums, extensions, triggers, and indexes.
-- ============================================================
-- This is the foundational schema for the BEVER platform.
-- Run via: supabase db push (from packages/supabase/)
--
-- IMPORTANT RULES:
-- 1. Every table MUST have RLS enabled.
-- 2. Every RLS policy MUST be written carefully.
-- 3. Every new migration gets a new numbered file.
-- 4. Never modify this file after it has been run in production.
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ─── Enums ───────────────────────────────────────────────────────────────────

-- User roles
CREATE TYPE user_role AS ENUM (
  'customer',
  'merchant',
  'rider',
  'admin'
);

-- Order statuses — this is the ONLY place order statuses are defined.
-- See ORDER_STATE_MACHINE.md for transition rules.
CREATE TYPE order_status AS ENUM (
  'PENDING',
  'MERCHANT_ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'RIDER_AT_STORE',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
  'PAYMENT_FAILED',
  'DELIVERY_FAILED',
  'REFUND_PENDING',
  'REFUNDED'
);

-- Payment methods
CREATE TYPE payment_method AS ENUM ('COD', 'UPI');

-- Payment statuses
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- Store categories
CREATE TYPE store_category AS ENUM (
  'GROCERY',
  'RESTAURANT',
  'PHARMACY',
  'BAKERY',
  'ELECTRONICS',
  'CLOTHING',
  'HARDWARE',
  'STATIONERY',
  'PET_SUPPLIES',

  'OTHER'
);

-- ─── Profiles ─────────────────────────────────────────────────────────────────
-- Extends Supabase auth.users. One row per user.

CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,
  avatar_url    TEXT,
  fcm_token     TEXT, -- Firebase Cloud Messaging token, updated on each app launch
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index on role for admin queries
CREATE INDEX idx_profiles_role ON profiles(role);

-- ─── Stores ───────────────────────────────────────────────────────────────────

CREATE TABLE stores (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  name                        TEXT NOT NULL,
  description                 TEXT,
  banner_url                  TEXT,
  logo_url                    TEXT,
  phone                       TEXT NOT NULL,
  address_text                TEXT NOT NULL,
  location                    GEOMETRY(Point, 4326), -- PostGIS: WGS84 lat/lng
  category                    store_category NOT NULL,
  is_open                     BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified                 BOOLEAN NOT NULL DEFAULT FALSE, -- Admin must verify
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  average_rating              NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
  total_ratings               INTEGER NOT NULL DEFAULT 0,
  estimated_delivery_minutes  INTEGER,
  minimum_order_amount        INTEGER NOT NULL DEFAULT 0, -- In paise
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Spatial index for nearby store queries (ST_DWithin)
CREATE INDEX idx_stores_location ON stores USING GIST(location);
CREATE INDEX idx_stores_merchant_id ON stores(merchant_id);
CREATE INDEX idx_stores_is_open ON stores(is_open) WHERE is_open = TRUE;
CREATE INDEX idx_stores_category ON stores(category);

-- ─── Product Categories ───────────────────────────────────────────────────────

CREATE TABLE product_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_product_categories_store_id ON product_categories(store_id);

-- ─── Products ─────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id            UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id         UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  image_url           TEXT,
  price               INTEGER NOT NULL, -- In paise
  compare_at_price    INTEGER, -- Original price if discounted, in paise
  unit                TEXT NOT NULL DEFAULT 'per piece',
  is_available        BOOLEAN NOT NULL DEFAULT TRUE, -- Merchant toggles
  is_active           BOOLEAN NOT NULL DEFAULT TRUE, -- Admin can deactivate
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_price CHECK (price > 0)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_available ON products(is_available, is_active);

-- ─── Customer Addresses ───────────────────────────────────────────────────────

CREATE TABLE customer_addresses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label           TEXT NOT NULL DEFAULT 'Home',
  address_line_1  TEXT NOT NULL,
  address_line_2  TEXT,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  pincode         TEXT NOT NULL,
  location        GEOMETRY(Point, 4326),
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_customer_addresses_customer_id ON customer_addresses(customer_id);

-- ─── Orders ───────────────────────────────────────────────────────────────────

CREATE TABLE orders (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number                TEXT NOT NULL UNIQUE,
  customer_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  store_id                    UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  status                      order_status NOT NULL DEFAULT 'PENDING',
  payment_method              payment_method NOT NULL,
  payment_status              payment_status NOT NULL DEFAULT 'PENDING',
  delivery_address_id         UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
  delivery_address_snapshot   JSONB NOT NULL, -- Snapshotted at order time
  items_total                 INTEGER NOT NULL, -- In paise
  delivery_fee                INTEGER NOT NULL DEFAULT 0, -- In paise
  discount_amount             INTEGER NOT NULL DEFAULT 0, -- In paise
  total_amount                INTEGER NOT NULL, -- In paise
  special_instructions        TEXT,
  delivery_otp                TEXT, -- 4-digit OTP, set when RIDER_ASSIGNED
  estimated_delivery_at       TIMESTAMPTZ,
  delivered_at                TIMESTAMPTZ,
  rejection_reason            TEXT,
  cancellation_reason         TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_amounts CHECK (items_total > 0 AND total_amount > 0)
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Critical indexes for order queries
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ─── Order Items ──────────────────────────────────────────────────────────────

CREATE TABLE order_items (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id                UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id              UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot   TEXT NOT NULL, -- Snapshotted at order time
  product_image_snapshot  TEXT,
  unit_price              INTEGER NOT NULL, -- In paise, snapshotted
  quantity                INTEGER NOT NULL,
  total_price             INTEGER NOT NULL, -- unit_price × quantity, in paise
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_unit_price CHECK (unit_price > 0)
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ─── Order Status History ─────────────────────────────────────────────────────
-- Full audit trail — every state change is recorded here.

CREATE TABLE order_status_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status     order_status, -- NULL for the initial PENDING entry
  to_status       order_status NOT NULL,
  changed_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_by_role TEXT, -- Denormalised for audit purposes
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);

-- ─── Delivery Assignments ─────────────────────────────────────────────────────

CREATE TABLE delivery_assignments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  rider_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_by         UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at         TIMESTAMPTZ,
  arrived_at_store_at TIMESTAMPTZ,
  picked_up_at        TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  cod_collected       BOOLEAN NOT NULL DEFAULT FALSE,
  cod_amount          INTEGER, -- In paise
  failure_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER delivery_assignments_updated_at
  BEFORE UPDATE ON delivery_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_delivery_assignments_rider_id ON delivery_assignments(rider_id);
CREATE INDEX idx_delivery_assignments_order_id ON delivery_assignments(order_id);

-- NOTE: RLS POLICIES are in migration 002 below.


-- ============================================================
-- MIGRATION 002: Row Level Security Policies
-- Source: 002_rls_policies.sql
-- Defines all RLS policies for the BEVER database.
-- ============================================================
-- SECURITY PRINCIPLES:
-- 1. Every table has RLS enabled (done in 001_initial_schema.sql).
-- 2. Default: deny all. Policies only grant what is explicitly needed.
-- 3. Customers access only their own data.
-- 4. Merchants access only their own store's data.
-- 5. Riders access only their assigned delivery data.
-- 6. Admins use the service-role key (bypasses RLS) — NEVER in mobile apps.
-- ============================================================

-- ─── Helper: get current user role ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── profiles ─────────────────────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "profiles: users read own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile (but not their role — handled by constraint)
CREATE POLICY "profiles: users update own"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- System can insert profiles (triggered on auth.users creation)
-- This is handled by a Supabase trigger, not direct client insert.

-- ─── stores ───────────────────────────────────────────────────────────────────

-- Anyone (including unauthenticated) can view active, verified stores
CREATE POLICY "stores: public read active verified"
  ON stores FOR SELECT
  USING (is_active = TRUE AND is_verified = TRUE);

-- Merchants can read their own stores (even unverified)
CREATE POLICY "stores: merchant reads own"
  ON stores FOR SELECT
  USING (merchant_id = auth.uid());

-- Merchants can update their own stores (limited fields — enforced in app/function)
CREATE POLICY "stores: merchant updates own"
  ON stores FOR UPDATE
  USING (merchant_id = auth.uid())
  WITH CHECK (merchant_id = auth.uid());

-- ─── product_categories ───────────────────────────────────────────────────────

-- Anyone can view active categories of active stores
CREATE POLICY "product_categories: public read active"
  ON product_categories FOR SELECT
  USING (is_active = TRUE);

-- Merchants can manage their own store's categories
CREATE POLICY "product_categories: merchant manages own"
  ON product_categories FOR ALL
  USING (
    store_id IN (SELECT id FROM stores WHERE merchant_id = auth.uid())
  );

-- ─── products ─────────────────────────────────────────────────────────────────

-- Anyone can view active, available products
CREATE POLICY "products: public read active"
  ON products FOR SELECT
  USING (is_active = TRUE);

-- Merchants can manage their own store's products
CREATE POLICY "products: merchant manages own"
  ON products FOR ALL
  USING (
    store_id IN (SELECT id FROM stores WHERE merchant_id = auth.uid())
  );

-- ─── customer_addresses ───────────────────────────────────────────────────────

-- Customers can only see their own addresses
CREATE POLICY "customer_addresses: owner reads own"
  ON customer_addresses FOR SELECT
  USING (customer_id = auth.uid());

-- Customers can manage their own addresses
CREATE POLICY "customer_addresses: owner manages own"
  ON customer_addresses FOR ALL
  USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

-- ─── orders ───────────────────────────────────────────────────────────────────

-- Customers can see their own orders
CREATE POLICY "orders: customer reads own"
  ON orders FOR SELECT
  USING (customer_id = auth.uid());

-- Customers can insert their own orders
CREATE POLICY "orders: customer places order"
  ON orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- Merchants can see orders for their stores
CREATE POLICY "orders: merchant reads store orders"
  ON orders FOR SELECT
  USING (
    store_id IN (SELECT id FROM stores WHERE merchant_id = auth.uid())
  );

-- Merchants can update status on their store's orders (validated further by state machine function)
CREATE POLICY "orders: merchant updates store orders"
  ON orders FOR UPDATE
  USING (
    store_id IN (SELECT id FROM stores WHERE merchant_id = auth.uid())
  );

-- Riders can see orders assigned to them
CREATE POLICY "orders: rider reads assigned"
  ON orders FOR SELECT
  USING (
    id IN (SELECT order_id FROM delivery_assignments WHERE rider_id = auth.uid())
  );

-- Riders can update status on their assigned orders
CREATE POLICY "orders: rider updates assigned"
  ON orders FOR UPDATE
  USING (
    id IN (SELECT order_id FROM delivery_assignments WHERE rider_id = auth.uid())
  );

-- ─── order_items ──────────────────────────────────────────────────────────────

-- Customers can see items for their own orders
CREATE POLICY "order_items: customer reads own"
  ON order_items FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- Customers can insert items when placing an order (validated by order ownership)
CREATE POLICY "order_items: customer inserts own"
  ON order_items FOR INSERT
  WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- Merchants can see items for their store's orders
CREATE POLICY "order_items: merchant reads store"
  ON order_items FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN stores s ON s.id = o.store_id
      WHERE s.merchant_id = auth.uid()
    )
  );

-- Riders can see items for their assigned orders
CREATE POLICY "order_items: rider reads assigned"
  ON order_items FOR SELECT
  USING (
    order_id IN (SELECT order_id FROM delivery_assignments WHERE rider_id = auth.uid())
  );

-- ─── order_status_history ─────────────────────────────────────────────────────

-- Customers can see status history for their own orders
CREATE POLICY "order_status_history: customer reads own"
  ON order_status_history FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- Merchants can see status history for their store's orders
CREATE POLICY "order_status_history: merchant reads store"
  ON order_status_history FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN stores s ON s.id = o.store_id
      WHERE s.merchant_id = auth.uid()
    )
  );

-- Riders can see history for their assigned orders
CREATE POLICY "order_status_history: rider reads assigned"
  ON order_status_history FOR SELECT
  USING (
    order_id IN (SELECT order_id FROM delivery_assignments WHERE rider_id = auth.uid())
  );

-- ─── delivery_assignments ─────────────────────────────────────────────────────

-- Riders can see their own assignments
CREATE POLICY "delivery_assignments: rider reads own"
  ON delivery_assignments FOR SELECT
  USING (rider_id = auth.uid());

-- Riders can update their own assignments (mark arrived, picked up, delivered)
CREATE POLICY "delivery_assignments: rider updates own"
  ON delivery_assignments FOR UPDATE
  USING (rider_id = auth.uid());

-- Customers can see delivery assignment for their own orders
-- (limited data — no rider personal info, just status timestamps)
CREATE POLICY "delivery_assignments: customer reads own order"
  ON delivery_assignments FOR SELECT
  USING (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- Merchants can see delivery assignments for their store's orders
CREATE POLICY "delivery_assignments: merchant reads store"
  ON delivery_assignments FOR SELECT
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN stores s ON s.id = o.store_id
      WHERE s.merchant_id = auth.uid()
    )
  );

-- NOTE: Admin operations use the service-role key which
-- bypasses all RLS. Admin web must NEVER run in mobile apps.


-- ============================================================
-- MIGRATION 003: Order State Machine Enforcement
-- Source: 003_order_state_machine.sql
-- Enforces order state transitions at the database level.
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


-- ============================================================
-- MIGRATION 004: Automatic Profile Creation Trigger
-- Source: 004_profile_trigger.sql
-- Automatically creates a public.profiles record whenever a
-- new user signs up in Supabase auth.users.
-- NOTE: This trigger function is replaced by migration 007.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
BEGIN
  -- Extract role from user_metadata if provided, default to 'customer'
  BEGIN
    v_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'customer'::public.user_role;
  END;

  IF v_role IS NULL THEN
    v_role := 'customer'::public.user_role;
  END IF;

  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    avatar_url,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop trigger if already exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- MIGRATION 005: Schema Fixes, Constraints & RLS Refinements
-- Source: 005_fix_stationery_and_constraints.sql
-- 1. Fix STATIONARY typo in store_category enum to STATIONERY
-- 2. Add non-negative CHECK constraints to delivery_fee/discount
-- 3. Add unit_snapshot column to order_items
-- 4. Refine merchant RLS policy on products (no DELETE)
-- ============================================================

-- 1. Rename enum value if 'STATIONARY' exists (no-op on fresh install)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.store_category'::regtype 
    AND enumlabel = 'STATIONARY'
  ) THEN
    ALTER TYPE public.store_category RENAME VALUE 'STATIONARY' TO 'STATIONERY';
  END IF;
END $$;

-- 2. Non-negative constraints on order amounts
ALTER TABLE public.orders
  ADD CONSTRAINT check_delivery_fee_non_negative CHECK (delivery_fee >= 0),
  ADD CONSTRAINT check_discount_amount_non_negative CHECK (discount_amount >= 0);

-- 3. Add unit_snapshot column to order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS unit_snapshot VARCHAR(50);

-- 4. Replace product FOR ALL policy with explicit SELECT, INSERT, UPDATE policies
DROP POLICY IF EXISTS "Merchants manage their own products" ON public.products;

CREATE POLICY "Merchants view their own products"
  ON public.products FOR SELECT
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE merchant_id = auth.uid()
    )
  );

CREATE POLICY "Merchants insert their own products"
  ON public.products FOR INSERT
  WITH CHECK (
    store_id IN (
      SELECT id FROM public.stores WHERE merchant_id = auth.uid()
    )
  );

CREATE POLICY "Merchants update their own products"
  ON public.products FOR UPDATE
  USING (
    store_id IN (
      SELECT id FROM public.stores WHERE merchant_id = auth.uid()
    )
  );


-- ============================================================
-- MIGRATION 006: Storage Buckets & Public Read Policies
-- Source: 006_storage_buckets.sql
-- Creates the 4 required storage buckets and public read access.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('product-images', 'product-images', true),
  ('store-banners', 'store-banners', true),
  ('store-logos', 'store-logos', true),
  ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access policies for media buckets
CREATE POLICY "Public Read Product Images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Public Read Store Banners" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-banners');

CREATE POLICY "Public Read Store Logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-logos');

CREATE POLICY "Public Read User Avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-avatars');


-- ============================================================
-- MIGRATION 007: Secure Profile Creation Trigger (Security Hardening)
-- Source: 007_secure_profile_trigger.sql
-- Replaces the handle_new_user() trigger function from 004.
-- PUBLIC SIGNUPS MUST ALWAYS DEFAULT TO 'customer'.
-- raw_user_meta_data->>'role' IS SOURCED FROM CLIENT INPUT AND
-- MUST NEVER BE TRUSTED FOR ASSIGNING PRIVILEGED ROLES.
--
-- TRUSTED ROLE ASSIGNMENT NOTICE:
-- Admin, Merchant, and Rider profiles MUST be created or updated
-- through an authorized server-side backend / Edge Function using
-- the Supabase Service Role key or via an authenticated Admin API
-- endpoint. Public Auth signups are strictly customers.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- PUBLIC SIGNUPS: Always assign 'customer' role.
  -- Do NOT read 'role' from NEW.raw_user_meta_data as client can supply arbitrary metadata.

  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    avatar_url,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    'customer'::public.user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger remains attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- MIGRATION 008: Storage Upload & Write Policies
-- Source: 008_storage_write_policies.sql
-- Adds secure INSERT, UPDATE, DELETE RLS for storage buckets.
--   - user-avatars: restricted to authenticated owner ({user_id}/...)
--   - store-banners, store-logos: restricted to merchants owning a store
--   - product-images: restricted to merchants owning a store
-- ============================================================

-- 1. USER AVATARS WRITE POLICIES (Scoped to owner user ID folder)
CREATE POLICY "Authenticated Users Upload Own Avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated Users Update Own Avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Authenticated Users Delete Own Avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-avatars' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. STORE MEDIA WRITE POLICIES (Banners & Logos — Scoped to authenticated merchants)
CREATE POLICY "Merchants Upload Store Banners" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-banners' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Update Store Banners" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-banners' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Delete Store Banners" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-banners' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Upload Store Logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-logos' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Update Store Logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-logos' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Delete Store Logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-logos' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

-- 3. PRODUCT IMAGES WRITE POLICIES (Scoped to authenticated merchants)
CREATE POLICY "Merchants Upload Product Images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Update Product Images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );

CREATE POLICY "Merchants Delete Product Images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images' AND
    EXISTS (SELECT 1 FROM public.stores WHERE merchant_id = auth.uid())
  );


-- ============================================================
-- MIGRATION 009: Guarded Store Category Enum Recovery
-- Source: 009_fix_enum_rename_guard.sql
-- Ensures store_category contains 'STATIONERY' regardless of
-- migration history. No-op on a fresh install from 001.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumtypid = 'public.store_category'::regtype 
    AND enumlabel = 'STATIONARY'
  ) THEN
    ALTER TYPE public.store_category RENAME VALUE 'STATIONARY' TO 'STATIONERY';
  END IF;
END $$;


-- ============================================================
-- MIGRATION 010: Restrict Customer Profile Update Columns
-- Source: 010_restrict_profile_update_columns.sql
-- Restricts UPDATE privileges on public.profiles for the
-- authenticated role to ONLY the full_name column.
--
-- Security Enforcement:
-- 1. REVOKE table-level UPDATE on profiles from authenticated and anon.
-- 2. GRANT column-level UPDATE ONLY on (full_name) to authenticated.
-- 3. All other columns (id, role, phone, avatar_url, fcm_token,
--    is_active, created_at, updated_at) are BLOCKED from client
--    UPDATE requests.
-- 4. Preserves RLS policies and server-side triggers.
-- ============================================================

-- Revoke table-level UPDATE permissions from public API roles
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE UPDATE ON public.profiles FROM authenticated;

-- Grant column-level UPDATE privilege ONLY on full_name to authenticated role
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

-- Ensure SELECT privilege on public.profiles is granted to authenticated role
GRANT SELECT ON public.profiles TO authenticated;

-- Confirm Row Level Security remains active
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- MIGRATION 011: Customer Addresses Single-Default Integrity
-- Source: 011_customer_addresses_integrity.sql
-- Enforces that a customer may have at most one default
-- delivery address (is_default = TRUE) at the database level.
-- ============================================================

-- Partial unique index ensuring at most one is_default = TRUE per customer_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_addresses_single_default
ON public.customer_addresses (customer_id)
WHERE is_default = TRUE;


-- ============================================================
-- MIGRATION 012: Store-Specific Delivery Service Radius
-- Source: 012_store_service_radius.sql
-- Adds service_radius_meters column to public.stores.
-- NULL = delivery not configured (never treated as unlimited).
-- ============================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS service_radius_meters INTEGER DEFAULT NULL,
  ADD CONSTRAINT check_service_radius_positive CHECK (
    service_radius_meters IS NULL OR service_radius_meters > 0
  );


-- ============================================================
-- MIGRATION 013: Nearby Stores RPC
-- Source: 013_nearby_stores_rpc.sql
-- Creates the public.get_nearby_stores() function used by the
-- customer app to discover stores that service a given location.
--
-- SECURITY MODEL:
--   SECURITY DEFINER — runs with the privileges of its owner.
--   Execution revoked from PUBLIC; granted only to anon and
--   authenticated (stores are publicly browsable).
--
-- BUSINESS RULES (enforced here, not in the app):
--   1. Only active AND verified AND open stores returned.
--   2. Only stores with non-null, positive service_radius_meters.
--   3. Only stores with a populated location column.
--   4. Store included only when customer point is within that
--      store's own service_radius_meters (geography, metres).
--   5. Results ordered nearest-first, capped by limit_count.
-- ============================================================

-- ─── 1. Geography expression index ──────────────────────────────────────────
-- Allows ST_DWithin(location::geography, ...) to use an index scan.

CREATE INDEX IF NOT EXISTS idx_stores_location_geography
  ON public.stores
  USING GIST ((location::geography));

-- ─── 2. RPC function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_nearby_stores(
  customer_lat   DOUBLE PRECISION,
  customer_lng   DOUBLE PRECISION,
  limit_count    INTEGER DEFAULT 50
)
RETURNS TABLE (
  id                          UUID,
  name                        TEXT,
  description                 TEXT,
  logo_url                    TEXT,
  banner_url                  TEXT,
  category                    public.store_category,
  is_open                     BOOLEAN,
  average_rating              NUMERIC,
  total_ratings               INTEGER,
  estimated_delivery_minutes  INTEGER,
  minimum_order_amount        INTEGER,
  address_text                TEXT,
  distance_meters             DOUBLE PRECISION,
  service_radius_meters       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
STABLE
AS $$
BEGIN
  -- ── Input validation ──────────────────────────────────────────────────────
  -- Reject coordinates outside WGS84 range and degenerate limit values.
  -- Errors surface to the caller as Postgres error code 'invalid_parameter_value'.

  IF customer_lat < -90.0 OR customer_lat > 90.0 THEN
    RAISE EXCEPTION 'customer_lat must be between -90 and 90, got %', customer_lat
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF customer_lng < -180.0 OR customer_lng > 180.0 THEN
    RAISE EXCEPTION 'customer_lng must be between -180 and 180, got %', customer_lng
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF limit_count < 1 OR limit_count > 200 THEN
    RAISE EXCEPTION 'limit_count must be between 1 and 200, got %', limit_count
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── Query ─────────────────────────────────────────────────────────────────
  -- ST_MakePoint(longitude, latitude) — PostGIS axis order: lng first, lat second.
  -- ::geography cast makes ST_DWithin and ST_Distance operate in metres.

  RETURN QUERY
    SELECT
      s.id,
      s.name,
      s.description,
      s.logo_url,
      s.banner_url,
      s.category,
      s.is_open,
      s.average_rating,
      s.total_ratings,
      s.estimated_delivery_minutes,
      s.minimum_order_amount,
      s.address_text,
      ST_Distance(
        s.location::geography,
        ST_SetSRID(ST_MakePoint(customer_lng, customer_lat), 4326)::geography
      )                           AS distance_meters,
      s.service_radius_meters
    FROM public.stores s
    WHERE
      s.is_active               = TRUE
      AND s.is_verified         = TRUE
      AND s.is_open             = TRUE
      AND s.location            IS NOT NULL
      -- NULL radius = delivery not configured: always exclude
      AND s.service_radius_meters IS NOT NULL
      -- Defensive; guaranteed by CHECK constraint but explicit here
      AND s.service_radius_meters > 0
      -- Spatial filter: customer point must be within the store's own radius
      AND ST_DWithin(
            s.location::geography,
            ST_SetSRID(ST_MakePoint(customer_lng, customer_lat), 4326)::geography,
            s.service_radius_meters
          )
    ORDER BY distance_meters ASC
    LIMIT limit_count;
END;
$$;

-- ─── 3. Grants ───────────────────────────────────────────────────────────────
-- PostgreSQL grants EXECUTE to PUBLIC by default on function creation.
-- Revoke that, then grant only to the roles the customer app uses.

REVOKE EXECUTE
  ON FUNCTION public.get_nearby_stores(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.get_nearby_stores(DOUBLE PRECISION, DOUBLE PRECISION, INTEGER)
  TO anon, authenticated;


-- ============================================================
-- END OF BEVER DATABASE INSTALLATION SCRIPT
-- All 13 migrations applied. Schema is now complete.
-- ============================================================


-- ============================================================
-- CUSTOMER CHECKOUT RPC
-- Revalidates store, address, live product prices/availability,
-- serviceability and delivery fee before creating the order.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_customer_order(
  p_store_id uuid,
  p_delivery_address_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method DEFAULT 'COD'::public.payment_method,
  p_special_instructions text DEFAULT NULL
)
RETURNS TABLE (order_id uuid, order_number text, items_total integer, delivery_fee integer, total_amount integer)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_customer_id uuid := auth.uid();
  v_store record;
  v_address record;
  v_items_total integer := 0;
  v_delivery_fee integer := 0;
  v_total integer := 0;
  v_order_id uuid;
  v_order_number text;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_distance_meters double precision;
BEGIN
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'CART_EMPTY'; END IF;

  SELECT id, name, is_active, is_verified, is_open, minimum_order_amount, service_radius_meters, location
    INTO v_store FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND OR NOT v_store.is_active OR NOT v_store.is_verified OR NOT v_store.is_open THEN RAISE EXCEPTION 'STORE_UNAVAILABLE'; END IF;

  SELECT id, customer_id, label, address_line_1, address_line_2, city, state, pincode, location
    INTO v_address FROM public.customer_addresses WHERE id = p_delivery_address_id AND customer_id = v_customer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADDRESS_NOT_FOUND'; END IF;
  IF v_address.location IS NULL THEN RAISE EXCEPTION 'ADDRESS_LOCATION_REQUIRED'; END IF;
  IF v_store.location IS NULL OR v_store.service_radius_meters IS NULL THEN RAISE EXCEPTION 'STORE_LOCATION_UNAVAILABLE'; END IF;

  v_distance_meters := public.ST_Distance(v_store.location::public.geography, v_address.location::public.geography);
  IF v_distance_meters > v_store.service_radius_meters THEN RAISE EXCEPTION 'ADDRESS_OUTSIDE_SERVICE_AREA'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF NOT (v_item ? 'product_id') OR NOT (v_item ? 'quantity') THEN RAISE EXCEPTION 'INVALID_CART_ITEM'; END IF;
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty < 1 OR v_qty > 99 THEN RAISE EXCEPTION 'INVALID_QUANTITY'; END IF;
    SELECT id, store_id, name, image_url, unit, price, is_available, is_active INTO v_product
      FROM public.products WHERE id = (v_item->>'product_id')::uuid AND store_id = p_store_id;
    IF NOT FOUND OR NOT v_product.is_active OR NOT v_product.is_available THEN RAISE EXCEPTION 'PRODUCT_UNAVAILABLE:%', (v_item->>'product_id'); END IF;
    v_items_total := v_items_total + (v_product.price * v_qty);
  END LOOP;

  IF v_items_total < v_store.minimum_order_amount THEN RAISE EXCEPTION 'MINIMUM_ORDER_NOT_MET'; END IF;

  -- Pilot rule: ₹199+ item total => free delivery; below ₹199 => ₹20 + ₹7 per started km.
  IF v_items_total < 19900 THEN
    v_delivery_fee := 2000 + (ceil(v_distance_meters / 1000.0)::integer * 700);
  END IF;
  v_total := v_items_total + v_delivery_fee;

  INSERT INTO public.orders (customer_id, store_id, status, payment_method, payment_status, delivery_address_id, delivery_address_snapshot, items_total, delivery_fee, discount_amount, total_amount, special_instructions)
  VALUES (v_customer_id, p_store_id, 'PENDING', p_payment_method, 'PENDING', p_delivery_address_id,
    jsonb_build_object('label',v_address.label,'address_line_1',v_address.address_line_1,'address_line_2',v_address.address_line_2,'city',v_address.city,'state',v_address.state,'pincode',v_address.pincode,'location',v_address.location::text),
    v_items_total, v_delivery_fee, 0, v_total, nullif(trim(p_special_instructions), ''))
  RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'quantity')::integer;
    SELECT id, name, image_url, unit, price INTO v_product FROM public.products WHERE id=(v_item->>'product_id')::uuid AND store_id=p_store_id AND is_active=true AND is_available=true;
    INSERT INTO public.order_items (order_id, product_id, product_name_snapshot, product_image_snapshot, unit_price, quantity, total_price, unit_snapshot)
    VALUES (v_order_id,v_product.id,v_product.name,v_product.image_url,v_product.price,v_qty,v_product.price*v_qty,v_product.unit);
  END LOOP;

  RETURN QUERY SELECT v_order_id,v_order_number,v_items_total,v_delivery_fee,v_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_customer_order(uuid, uuid, jsonb, public.payment_method, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_customer_order(uuid, uuid, jsonb, public.payment_method, text) TO authenticated;


-- ============================================================================
-- 2026-10-06 OPERATIONAL HARDENING
-- Order state machine, delivery OTP, rider assignment, admin RBAC.
-- These statements intentionally override the earlier baseline definitions.
-- ============================================================================

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke execute on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated;

create or replace function public.generate_order_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.order_number = 'BVR-' ||
    to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('public.order_number_seq')::text, 4, '0');
  return new;
end;
$$;

create or replace function public.validate_order_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_role public.user_role;
begin
  if old.status = new.status then return new; end if;

  select role into v_user_role
  from public.profiles
  where id = (select auth.uid());

  case old.status
    when 'PENDING' then
      if new.status = 'MERCHANT_ACCEPTED' and v_user_role = 'merchant' then return new; end if;
      if new.status = 'REJECTED' and v_user_role = 'merchant' then return new; end if;
      if new.status = 'CANCELLED' and v_user_role in ('customer','admin') then return new; end if;
    when 'MERCHANT_ACCEPTED' then
      if new.status = 'PREPARING' and v_user_role = 'merchant' then return new; end if;
      if new.status = 'CANCELLED' and v_user_role = 'admin' then return new; end if;
    when 'PREPARING' then
      if new.status = 'READY_FOR_PICKUP' and v_user_role = 'merchant' then return new; end if;
    when 'READY_FOR_PICKUP' then
      if new.status = 'RIDER_ASSIGNED' and v_user_role = 'admin' then return new; end if;
    when 'RIDER_ASSIGNED' then
      if new.status = 'RIDER_AT_STORE' and v_user_role = 'rider' then return new; end if;
      if new.status = 'READY_FOR_PICKUP' and v_user_role = 'admin' then return new; end if;
    when 'RIDER_AT_STORE' then
      if new.status = 'PICKED_UP' and v_user_role = 'rider' then return new; end if;
    when 'PICKED_UP' then
      if new.status = 'OUT_FOR_DELIVERY' and v_user_role = 'rider' then return new; end if;
    when 'OUT_FOR_DELIVERY' then
      if new.status = 'DELIVERED' and v_user_role = 'rider' then return new; end if;
      if new.status = 'DELIVERY_FAILED' and v_user_role in ('rider','admin') then return new; end if;
    when 'DELIVERY_FAILED' then
      if new.status = 'REFUND_PENDING' and v_user_role = 'admin' then return new; end if;
    when 'REFUND_PENDING' then
      if new.status = 'REFUNDED' and v_user_role = 'admin' then return new; end if;
    else
      raise exception 'Order % is in terminal state % and cannot be updated.', old.id, old.status
        using errcode = 'P0001';
  end case;

  raise exception 'Invalid order status transition: % -> % for role %.', old.status, new.status, v_user_role
    using errcode = 'P0002';
end;
$$;

create or replace function public.log_initial_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.order_status_history
    (order_id, from_status, to_status, changed_by, changed_by_role, created_at)
  values
    (new.id, null, new.status, (select auth.uid()),
     (select role::text from public.profiles where id = (select auth.uid())), now());
  return new;
end;
$$;

create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.order_status_history
      (order_id, from_status, to_status, changed_by, changed_by_role, created_at)
    values
      (new.id, old.status, new.status, (select auth.uid()),
       (select role::text from public.profiles where id = (select auth.uid())), now());
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_order_status_transition() from public, anon, authenticated;
revoke execute on function public.log_initial_order_status() from public, anon, authenticated;
revoke execute on function public.log_order_status_change() from public, anon, authenticated;

drop trigger if exists trg_orders_record_created on public.orders;
drop function if exists public.record_order_created();

drop policy if exists "orders: merchant updates store orders" on public.orders;
drop policy if exists "orders: rider updates assigned" on public.orders;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_from_status public.order_status;
  v_role public.user_role;
  v_uid uuid := (select auth.uid());
  v_allowed boolean := false;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  v_from_status := v_order.status;

  select role into v_role from public.profiles
  where id = v_uid and is_active = true;
  if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;

  if v_role = 'admin' then
    v_allowed := true;
  elsif v_role = 'customer' then
    v_allowed := v_order.customer_id = v_uid and v_from_status = 'PENDING' and p_to_status = 'CANCELLED';
  elsif v_role = 'merchant' then
    v_allowed := exists (
      select 1 from public.stores s where s.id = v_order.store_id and s.merchant_id = v_uid
    ) and (
      (v_from_status = 'PENDING' and p_to_status in ('MERCHANT_ACCEPTED','REJECTED')) or
      (v_from_status = 'MERCHANT_ACCEPTED' and p_to_status = 'PREPARING') or
      (v_from_status = 'PREPARING' and p_to_status = 'READY_FOR_PICKUP')
    );
  elsif v_role = 'rider' then
    v_allowed := exists (
      select 1 from public.delivery_assignments da where da.order_id = v_order.id and da.rider_id = v_uid
    ) and (
      (v_from_status = 'RIDER_ASSIGNED' and p_to_status = 'RIDER_AT_STORE') or
      (v_from_status = 'RIDER_AT_STORE' and p_to_status = 'PICKED_UP') or
      (v_from_status = 'PICKED_UP' and p_to_status = 'OUT_FOR_DELIVERY') or
      (v_from_status = 'OUT_FOR_DELIVERY' and p_to_status in ('DELIVERED','DELIVERY_FAILED'))
    );
  end if;

  if not v_allowed then raise exception 'ROLE_NOT_ALLOWED'; end if;

  update public.orders
  set status = p_to_status,
      delivered_at = case when p_to_status = 'DELIVERED' then now() else delivered_at end,
      cancellation_reason = case when p_to_status = 'CANCELLED' then nullif(trim(p_note), '') else cancellation_reason end,
      rejection_reason = case when p_to_status = 'REJECTED' then nullif(trim(p_note), '') else rejection_reason end,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

revoke execute on function public.transition_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.transition_order_status(uuid, public.order_status, text) to authenticated;

create or replace function public.create_customer_order(
  p_store_id uuid,
  p_delivery_address_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method default 'COD',
  p_special_instructions text default null
)
returns table(order_id uuid, order_number text, items_total integer, delivery_fee integer, total_amount integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_id uuid := (select auth.uid());
  v_store record;
  v_address record;
  v_items_total integer := 0;
  v_delivery_fee integer := 0;
  v_total integer := 0;
  v_order_id uuid;
  v_order_number text;
  v_delivery_otp text;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_distance_meters double precision;
begin
  if v_customer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'CART_EMPTY'; end if;

  select id,name,is_active,is_verified,is_open,minimum_order_amount,service_radius_meters,location into v_store
  from public.stores where id = p_store_id;
  if not found or not v_store.is_active or not v_store.is_verified or not v_store.is_open then raise exception 'STORE_UNAVAILABLE'; end if;

  select id,customer_id,label,address_line_1,address_line_2,city,state,pincode,location into v_address
  from public.customer_addresses where id = p_delivery_address_id and customer_id = v_customer_id;
  if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
  if v_address.location is null then raise exception 'ADDRESS_LOCATION_REQUIRED'; end if;
  if v_store.location is null or v_store.service_radius_meters is null then raise exception 'STORE_LOCATION_UNAVAILABLE'; end if;

  v_distance_meters := public.ST_Distance(v_store.location::public.geography,v_address.location::public.geography);
  if v_distance_meters > v_store.service_radius_meters then raise exception 'ADDRESS_OUTSIDE_SERVICE_AREA'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'product_id') or not (v_item ? 'quantity') then raise exception 'INVALID_CART_ITEM'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception 'INVALID_QUANTITY'; end if;

    select id,store_id,name,image_url,unit,price,is_available,is_active into v_product
    from public.products where id = (v_item->>'product_id')::uuid and store_id = p_store_id;
    if not found or not v_product.is_active or not v_product.is_available then raise exception 'PRODUCT_UNAVAILABLE:%',(v_item->>'product_id'); end if;
    v_items_total := v_items_total + (v_product.price * v_qty);
  end loop;

  if v_items_total < (v_store.minimum_order_amount * 100) then raise exception 'MINIMUM_ORDER_NOT_MET'; end if;
  if v_items_total < 19900 then v_delivery_fee := 2000 + (ceil(v_distance_meters / 1000.0)::integer * 700); end if;
  v_total := v_items_total + v_delivery_fee;
  v_delivery_otp := lpad((floor(random() * 10000))::integer::text,4,'0');

  insert into public.orders
    (customer_id,store_id,status,payment_method,payment_status,delivery_address_id,delivery_address_snapshot,
     items_total,delivery_fee,discount_amount,total_amount,special_instructions,delivery_otp)
  values
    (v_customer_id,p_store_id,'PENDING',p_payment_method,'PENDING',p_delivery_address_id,
     jsonb_build_object('label',v_address.label,'address_line_1',v_address.address_line_1,'address_line_2',v_address.address_line_2,
       'city',v_address.city,'state',v_address.state,'pincode',v_address.pincode,'location',v_address.location::text),
     v_items_total,v_delivery_fee,0,v_total,nullif(trim(p_special_instructions),''),v_delivery_otp)
  returning id,order_number into v_order_id,v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select id,name,image_url,unit,price into v_product
    from public.products where id=(v_item->>'product_id')::uuid and store_id=p_store_id and is_active=true and is_available=true;
    insert into public.order_items
      (order_id,product_id,product_name_snapshot,product_image_snapshot,unit_price,quantity,total_price,unit_snapshot)
    values
      (v_order_id,v_product.id,v_product.name,v_product.image_url,v_product.price,v_qty,v_product.price*v_qty,v_product.unit);
  end loop;

  return query select v_order_id,v_order_number,v_items_total,v_delivery_fee,v_total;
end;
$$;

create or replace function public.complete_order_delivery(
  p_order_id uuid,
  p_delivery_otp text,
  p_cod_collected boolean default false,
  p_failure_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id=v_uid and is_active=true;
  if v_role <> 'rider' then raise exception 'ROLE_NOT_ALLOWED'; end if;

  select o.* into v_order
  from public.orders o
  join public.delivery_assignments da on da.order_id=o.id and da.rider_id=v_uid
  where o.id=p_order_id for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  if v_order.status <> 'OUT_FOR_DELIVERY' then raise exception 'INVALID_ORDER_STATUS'; end if;
  if p_delivery_otp is null or p_delivery_otp !~ '^\d{4}$' or p_delivery_otp <> v_order.delivery_otp then raise exception 'INVALID_DELIVERY_OTP'; end if;

  update public.orders set status='DELIVERED',delivered_at=now(),updated_at=now() where id=v_order.id returning * into v_order;

  update public.delivery_assignments
  set delivered_at=now(),
      cod_collected=case when v_order.payment_method='COD' then p_cod_collected else cod_collected end,
      cod_amount=case when v_order.payment_method='COD' and p_cod_collected then v_order.total_amount else cod_amount end,
      updated_at=now()
  where order_id=v_order.id and rider_id=v_uid;

  return v_order;
end;
$$;

revoke execute on function public.complete_order_delivery(uuid,text,boolean,text) from public,anon;
grant execute on function public.complete_order_delivery(uuid,text,boolean,text) to authenticated;

create policy "profiles: admin reads all" on public.profiles for select to authenticated
using ((select public.get_my_role())='admin');

create policy "stores: admin reads all" on public.stores for select to authenticated
using ((select public.get_my_role())='admin');

create policy "stores: admin updates all" on public.stores for update to authenticated
using ((select public.get_my_role())='admin')
with check ((select public.get_my_role())='admin');

create policy "products: admin reads all" on public.products for select to authenticated
using ((select public.get_my_role())='admin');

create policy "products: admin updates all" on public.products for update to authenticated
using ((select public.get_my_role())='admin')
with check ((select public.get_my_role())='admin');

create policy "orders: admin reads all" on public.orders for select to authenticated
using ((select public.get_my_role())='admin');

create policy "order_items: admin reads all" on public.order_items for select to authenticated
using ((select public.get_my_role())='admin');

create policy "order_status_history: admin reads all" on public.order_status_history for select to authenticated
using ((select public.get_my_role())='admin');

create policy "delivery_assignments: admin reads all" on public.delivery_assignments for select to authenticated
using ((select public.get_my_role())='admin');

create policy "delivery_assignments: admin inserts" on public.delivery_assignments for insert to authenticated
with check ((select public.get_my_role())='admin');

create policy "delivery_assignments: admin updates" on public.delivery_assignments for update to authenticated
using ((select public.get_my_role())='admin')
with check ((select public.get_my_role())='admin');

create or replace function public.assign_order_to_rider(p_order_id uuid,p_rider_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id=v_uid and is_active=true;
  if v_role <> 'admin' then raise exception 'ROLE_NOT_ALLOWED'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  if v_order.status <> 'READY_FOR_PICKUP' then raise exception 'ORDER_NOT_READY_FOR_ASSIGNMENT'; end if;
  if not exists(select 1 from public.profiles where id=p_rider_id and role='rider' and is_active=true) then raise exception 'RIDER_NOT_AVAILABLE'; end if;
  if exists(select 1 from public.delivery_assignments where order_id=p_order_id) then raise exception 'ORDER_ALREADY_ASSIGNED'; end if;

  insert into public.delivery_assignments(order_id,rider_id,assigned_by,cod_amount)
  values(p_order_id,p_rider_id,v_uid,case when v_order.payment_method='COD' then v_order.total_amount else null end);

  update public.orders set status='RIDER_ASSIGNED',updated_at=now() where id=p_order_id returning * into v_order;
  return v_order;
end;
$$;

revoke execute on function public.assign_order_to_rider(uuid,uuid) from public,anon;
grant execute on function public.assign_order_to_rider(uuid,uuid) to authenticated;


-- ============================================================================
-- 2026-10-06 RIDER WORKFLOW HARDENING
-- Prevents generic rider transitions from bypassing delivery OTP and records
-- assignment timestamps server-side.
-- ============================================================================

create or replace function public.accept_delivery_assignment(p_order_id uuid)
returns public.delivery_assignments
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_assignment public.delivery_assignments;
  v_status public.order_status;
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles
  where id = v_uid and is_active = true;
  if v_role <> 'rider' then raise exception 'ROLE_NOT_ALLOWED'; end if;
  select da.* into v_assignment
  from public.delivery_assignments da
  where da.order_id = p_order_id and da.rider_id = v_uid
  for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  select status into v_status from public.orders where id = p_order_id for update;
  if v_status <> 'RIDER_ASSIGNED' then raise exception 'INVALID_ORDER_STATUS'; end if;
  update public.delivery_assignments
  set accepted_at = coalesce(accepted_at, now()), updated_at = now()
  where id = v_assignment.id
  returning * into v_assignment;
  return v_assignment;
end;
$function$;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_order public.orders;
  v_from_status public.order_status;
  v_role public.user_role;
  v_uid uuid := (select auth.uid());
  v_allowed boolean := false;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  v_from_status := v_order.status;
  select role into v_role from public.profiles
  where id = v_uid and is_active = true;
  if v_role is null then raise exception 'PROFILE_NOT_FOUND'; end if;

  if v_role = 'admin' then
    v_allowed := true;
  elsif v_role = 'customer' then
    v_allowed := v_order.customer_id = v_uid
      and v_from_status = 'PENDING' and p_to_status = 'CANCELLED';
  elsif v_role = 'merchant' then
    v_allowed := exists (
      select 1 from public.stores s
      where s.id = v_order.store_id and s.merchant_id = v_uid
    ) and (
      (v_from_status = 'PENDING' and p_to_status in ('MERCHANT_ACCEPTED','REJECTED')) or
      (v_from_status = 'MERCHANT_ACCEPTED' and p_to_status = 'PREPARING') or
      (v_from_status = 'PREPARING' and p_to_status = 'READY_FOR_PICKUP')
    );
  elsif v_role = 'rider' then
    v_allowed := exists (
      select 1 from public.delivery_assignments da
      where da.order_id = v_order.id and da.rider_id = v_uid
    ) and (
      (v_from_status = 'RIDER_ASSIGNED' and p_to_status = 'RIDER_AT_STORE') or
      (v_from_status = 'RIDER_AT_STORE' and p_to_status = 'PICKED_UP') or
      (v_from_status = 'PICKED_UP' and p_to_status = 'OUT_FOR_DELIVERY') or
      (v_from_status = 'OUT_FOR_DELIVERY' and p_to_status = 'DELIVERY_FAILED')
    );
  end if;

  if not v_allowed then raise exception 'ROLE_NOT_ALLOWED'; end if;

  update public.orders
  set status = p_to_status,
      cancellation_reason = case when p_to_status = 'CANCELLED' then nullif(trim(p_note), '') else cancellation_reason end,
      rejection_reason = case when p_to_status = 'REJECTED' then nullif(trim(p_note), '') else rejection_reason end,
      updated_at = now()
  where id = v_order.id
  returning * into v_order;

  if v_role = 'rider' then
    update public.delivery_assignments
    set arrived_at_store_at = case when p_to_status = 'RIDER_AT_STORE' then coalesce(arrived_at_store_at, now()) else arrived_at_store_at end,
        picked_up_at = case when p_to_status = 'PICKED_UP' then coalesce(picked_up_at, now()) else picked_up_at end,
        updated_at = now()
    where order_id = v_order.id and rider_id = v_uid;
  end if;

  return v_order;
end;
$function$;

create or replace function public.complete_order_delivery(
  p_order_id uuid,
  p_delivery_otp text,
  p_cod_collected boolean default false,
  p_failure_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_order public.orders;
  v_role public.user_role;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select role into v_role from public.profiles where id = v_uid and is_active = true;
  if v_role <> 'rider' then raise exception 'ROLE_NOT_ALLOWED'; end if;

  select o.* into v_order
  from public.orders o
  join public.delivery_assignments da on da.order_id = o.id and da.rider_id = v_uid
  where o.id = p_order_id for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  if v_order.status <> 'OUT_FOR_DELIVERY' then raise exception 'INVALID_ORDER_STATUS'; end if;
  if p_delivery_otp is null or p_delivery_otp !~ '^\\d{4}$' or p_delivery_otp <> v_order.delivery_otp then
    raise exception 'INVALID_DELIVERY_OTP';
  end if;
  if v_order.payment_method = 'COD' and coalesce(p_cod_collected, false) <> true then
    raise exception 'COD_NOT_COLLECTED';
  end if;

  update public.orders
  set status = 'DELIVERED', delivered_at = now(), updated_at = now()
  where id = v_order.id
  returning * into v_order;

  update public.delivery_assignments
  set delivered_at = now(),
      cod_collected = case when v_order.payment_method = 'COD' then true else cod_collected end,
      cod_amount = case when v_order.payment_method = 'COD' then v_order.total_amount else cod_amount end,
      updated_at = now()
  where order_id = v_order.id and rider_id = v_uid;
  return v_order;
end;
$function$;

revoke execute on function public.accept_delivery_assignment(uuid) from public, anon;
grant execute on function public.accept_delivery_assignment(uuid) to authenticated;
revoke execute on function public.transition_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.transition_order_status(uuid, public.order_status, text) to authenticated;
revoke execute on function public.complete_order_delivery(uuid, text, boolean, text) from public, anon;
grant execute on function public.complete_order_delivery(uuid, text, boolean, text) to authenticated;


-- ============================================================================
-- 2026-10-06 REALTIME OPERATIONAL EVENTS
-- Enables live order, delivery, product, and store updates for app consoles.
-- ============================================================================

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.delivery_assignments;
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.stores;


-- ============================================================================
-- 2026-10-06 COD-ONLY ENFORCEMENT
-- The pilot checkout supports Cash on Delivery only. Keep the database as the
-- final authority so unsupported payment methods cannot be inserted by clients.
-- ============================================================================

create or replace function public.create_customer_order(
  p_store_id uuid,
  p_delivery_address_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method default 'COD',
  p_special_instructions text default null
)
returns table(order_id uuid, order_number text, items_total integer, delivery_fee integer, total_amount integer)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_customer_id uuid := (select auth.uid());
  v_store record;
  v_address record;
  v_items_total integer := 0;
  v_delivery_fee integer := 0;
  v_total integer := 0;
  v_order_id uuid;
  v_order_number text;
  v_delivery_otp text;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_distance_meters double precision;
begin
  if v_customer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_payment_method <> 'COD' then raise exception 'PAYMENT_METHOD_NOT_SUPPORTED'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'CART_EMPTY'; end if;

  select id,name,is_active,is_verified,is_open,minimum_order_amount,service_radius_meters,location into v_store
  from public.stores where id = p_store_id;
  if not found or not v_store.is_active or not v_store.is_verified or not v_store.is_open then raise exception 'STORE_UNAVAILABLE'; end if;

  select id,customer_id,label,address_line_1,address_line_2,city,state,pincode,location into v_address
  from public.customer_addresses where id = p_delivery_address_id and customer_id = v_customer_id;
  if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
  if v_address.location is null then raise exception 'ADDRESS_LOCATION_REQUIRED'; end if;
  if v_store.location is null or v_store.service_radius_meters is null then raise exception 'STORE_LOCATION_UNAVAILABLE'; end if;

  v_distance_meters := public.ST_Distance(v_store.location::public.geography,v_address.location::public.geography);
  if v_distance_meters > v_store.service_radius_meters then raise exception 'ADDRESS_OUTSIDE_SERVICE_AREA'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'product_id') or not (v_item ? 'quantity') then raise exception 'INVALID_CART_ITEM'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception 'INVALID_QUANTITY'; end if;

    select id,store_id,name,image_url,unit,price,is_available,is_active into v_product
    from public.products where id = (v_item->>'product_id')::uuid and store_id = p_store_id;
    if not found or not v_product.is_active or not v_product.is_available then raise exception 'PRODUCT_UNAVAILABLE:%',(v_item->>'product_id'); end if;
    v_items_total := v_items_total + (v_product.price * v_qty);
  end loop;

  if v_items_total < (v_store.minimum_order_amount * 100) then raise exception 'MINIMUM_ORDER_NOT_MET'; end if;
  if v_items_total < 19900 then v_delivery_fee := 2000 + (ceil(v_distance_meters / 1000.0)::integer * 700); end if;
  v_total := v_items_total + v_delivery_fee;
  v_delivery_otp := lpad((floor(random() * 10000))::integer::text,4,'0');

  insert into public.orders
    (customer_id,store_id,status,payment_method,payment_status,delivery_address_id,delivery_address_snapshot,
     items_total,delivery_fee,discount_amount,total_amount,special_instructions,delivery_otp)
  values
    (v_customer_id,p_store_id,'PENDING','COD','PENDING',p_delivery_address_id,
     jsonb_build_object('label',v_address.label,'address_line_1',v_address.address_line_1,'address_line_2',v_address.address_line_2,
       'city',v_address.city,'state',v_address.state,'pincode',v_address.pincode,'location',v_address.location::text),
     v_items_total,v_delivery_fee,0,v_total,nullif(trim(p_special_instructions),''),v_delivery_otp)
  returning id,order_number into v_order_id,v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select id,name,image_url,unit,price into v_product
    from public.products where id=(v_item->>'product_id')::uuid and store_id=p_store_id and is_active=true and is_available=true;
    insert into public.order_items
      (order_id,product_id,product_name_snapshot,product_image_snapshot,unit_price,quantity,total_price,unit_snapshot)
    values
      (v_order_id,v_product.id,v_product.name,v_product.image_url,v_product.price,v_qty,v_product.price*v_qty,v_product.unit);
  end loop;

  return query select v_order_id,v_order_number,v_items_total,v_delivery_fee,v_total;
end;
$function$;

revoke execute on function public.create_customer_order(uuid,uuid,jsonb,public.payment_method,text) from public, anon;
grant execute on function public.create_customer_order(uuid,uuid,jsonb,public.payment_method,text) to authenticated;


-- ============================================================================
-- 2026-10-06 ORDER INSERT SECURITY HARDENING
-- Only the server-side create_customer_order RPC may insert orders/order items.
-- ============================================================================

create or replace function public.create_customer_order(
  p_store_id uuid,
  p_delivery_address_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method default 'COD',
  p_special_instructions text default null
)
returns table(order_id uuid, order_number text, items_total integer, delivery_fee integer, total_amount integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_id uuid := (select auth.uid());
  v_store record;
  v_address record;
  v_items_total integer := 0;
  v_delivery_fee integer := 0;
  v_total integer := 0;
  v_order_id uuid;
  v_order_number text;
  v_delivery_otp text;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_distance_meters double precision;
begin
  if v_customer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_payment_method <> 'COD' then raise exception 'PAYMENT_METHOD_NOT_SUPPORTED'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'CART_EMPTY'; end if;

  select id,name,is_active,is_verified,is_open,minimum_order_amount,service_radius_meters,location into v_store
  from public.stores where id = p_store_id;
  if not found or not v_store.is_active or not v_store.is_verified or not v_store.is_open then raise exception 'STORE_UNAVAILABLE'; end if;

  select id,customer_id,label,address_line_1,address_line_2,city,state,pincode,location into v_address
  from public.customer_addresses where id = p_delivery_address_id and customer_id = v_customer_id;
  if not found then raise exception 'ADDRESS_NOT_FOUND'; end if;
  if v_address.location is null then raise exception 'ADDRESS_LOCATION_REQUIRED'; end if;
  if v_store.location is null or v_store.service_radius_meters is null then raise exception 'STORE_LOCATION_UNAVAILABLE'; end if;

  v_distance_meters := public.ST_Distance(v_store.location::public.geography,v_address.location::public.geography);
  if v_distance_meters > v_store.service_radius_meters then raise exception 'ADDRESS_OUTSIDE_SERVICE_AREA'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'product_id') or not (v_item ? 'quantity') then raise exception 'INVALID_CART_ITEM'; end if;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 99 then raise exception 'INVALID_QUANTITY'; end if;

    select id,store_id,name,image_url,unit,price,is_available,is_active into v_product
    from public.products where id = (v_item->>'product_id')::uuid and store_id = p_store_id;
    if not found or not v_product.is_active or not v_product.is_available then raise exception 'PRODUCT_UNAVAILABLE:%',(v_item->>'product_id'); end if;
    v_items_total := v_items_total + (v_product.price * v_qty);
  end loop;

  if v_items_total < (v_store.minimum_order_amount * 100) then raise exception 'MINIMUM_ORDER_NOT_MET'; end if;
  if v_items_total < 19900 then v_delivery_fee := 2000 + (ceil(v_distance_meters / 1000.0)::integer * 700); end if;
  v_total := v_items_total + v_delivery_fee;
  v_delivery_otp := lpad((floor(random() * 10000))::integer::text,4,'0');

  insert into public.orders
    (customer_id,store_id,status,payment_method,payment_status,delivery_address_id,delivery_address_snapshot,
     items_total,delivery_fee,discount_amount,total_amount,special_instructions,delivery_otp)
  values
    (v_customer_id,p_store_id,'PENDING','COD','PENDING',p_delivery_address_id,
     jsonb_build_object('label',v_address.label,'address_line_1',v_address.address_line_1,'address_line_2',v_address.address_line_2,
       'city',v_address.city,'state',v_address.state,'pincode',v_address.pincode,'location',v_address.location::text),
     v_items_total,v_delivery_fee,0,v_total,nullif(trim(p_special_instructions),''),v_delivery_otp)
  returning id,order_number into v_order_id,v_order_number;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select id,name,image_url,unit,price into v_product
    from public.products where id=(v_item->>'product_id')::uuid and store_id=p_store_id and is_active=true and is_available=true;
    insert into public.order_items
      (order_id,product_id,product_name_snapshot,product_image_snapshot,unit_price,quantity,total_price,unit_snapshot)
    values
      (v_order_id,v_product.id,v_product.name,v_product.image_url,v_product.price,v_qty,v_product.price*v_qty,v_product.unit);
  end loop;

  return query select v_order_id,v_order_number,v_items_total,v_delivery_fee,v_total;
end;
$function$;

revoke insert on public.orders from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;
revoke execute on function public.create_customer_order(uuid,uuid,jsonb,public.payment_method,text) from public, anon;
grant execute on function public.create_customer_order(uuid,uuid,jsonb,public.payment_method,text) to authenticated;
