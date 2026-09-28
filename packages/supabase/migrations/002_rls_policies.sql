-- ============================================================
-- BEVER — Migration 002: Row Level Security Policies
-- ============================================================
-- This file defines all RLS policies for the BEVER database.
--
-- SECURITY PRINCIPLES:
-- 1. Every table has RLS enabled (done in 001_initial_schema.sql).
-- 2. Default: deny all. Policies only grant what is explicitly needed.
-- 3. Customers access only their own data.
-- 4. Merchants access only their own store's data.
-- 5. Riders access only their assigned delivery data.
-- 6. Admins use the service-role key (bypasses RLS) — NEVER in mobile apps.
--
-- Helper function: gets the current user's role from the profiles table.
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

-- ============================================================
-- NOTE: Admin operations use the service-role key which
-- bypasses all RLS. Admin web must NEVER run in mobile apps.
-- ============================================================
