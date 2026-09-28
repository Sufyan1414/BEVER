-- ============================================================
-- BEVER — Migration 001: Initial Schema
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
  'STATIONARY',
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

-- ============================================================
-- NOTE: RLS POLICIES are in a separate migration file.
-- See: 002_rls_policies.sql
-- ============================================================
