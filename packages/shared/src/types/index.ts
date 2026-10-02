/**
 * BEVER — Shared Types
 *
 * This file is the canonical definition of all BEVER data entities.
 * ALL apps (customer, merchant, rider, admin) must import types from here.
 * Never redefine these types locally in individual apps.
 *
 * These types mirror the PostgreSQL database schema exactly.
 * If the schema changes, this file must be updated to match.
 */

// ─── User Roles ──────────────────────────────────────────────────────────────

/**
 * Every authenticated user has exactly one role.
 * Role is stored in the `profiles` table and enforced via RLS.
 */
export type UserRole = 'customer' | 'merchant' | 'rider' | 'admin';

// ─── Order Status ─────────────────────────────────────────────────────────────

/**
 * The controlled order state machine.
 *
 * THESE ARE THE ONLY VALID ORDER STATES.
 * See ORDER_STATE_MACHINE.md for the full transition rules.
 * Never use arbitrary strings for order status anywhere in any app.
 */
export type OrderStatus =
  // Active states (happy path)
  | 'PENDING'
  | 'MERCHANT_ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'RIDER_ASSIGNED'
  | 'RIDER_AT_STORE'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  // Terminal / error states
  | 'REJECTED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED'
  | 'DELIVERY_FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

/** Terminal states — orders in these states cannot be transitioned further */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = [
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
  'PAYMENT_FAILED',
  'DELIVERY_FAILED',
  'REFUNDED',
] as const;

/** Returns true if an order status is terminal (no further transitions possible) */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}

// ─── Payment Method ───────────────────────────────────────────────────────────

/** Payment methods supported in the first version of BEVER */
export type PaymentMethod = 'COD' | 'UPI';

// ─── Payment Status ───────────────────────────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

// ─── Database Entity Types ────────────────────────────────────────────────────

/**
 * Profile — extends Supabase auth.users
 * One profile per user. Role determines what data they can access.
 */
export interface Profile {
  id: string; // UUID — matches auth.users.id
  role: UserRole;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  fcm_token: string | null; // Firebase Cloud Messaging token (updated on each app launch)
  is_active: boolean;
  created_at: string; // ISO 8601 timestamptz
  updated_at: string;
}

/**
 * Store — a merchant's shop on BEVER
 */
export interface Store {
  id: string; // UUID
  merchant_id: string; // FK → profiles.id
  name: string;
  description: string | null;
  banner_url: string | null;
  logo_url: string | null;
  phone: string;
  address_text: string; // Human-readable address
  // PostGIS geometry stored as GeoJSON in API responses
  location: GeoJSONPoint | null;
  category: StoreCategory;
  is_open: boolean;
  is_verified: boolean; // Verified by admin
  is_active: boolean;
  average_rating: number; // 0.0 – 5.0
  total_ratings: number;
  estimated_delivery_minutes: number | null;
  minimum_order_amount: number; // In paise (smallest currency unit)
  created_at: string;
  updated_at: string;
}

/** Store categories — determines what icon and filter is used */
export type StoreCategory =
  | 'GROCERY'
  | 'RESTAURANT'
  | 'PHARMACY'
  | 'BAKERY'
  | 'ELECTRONICS'
  | 'CLOTHING'
  | 'HARDWARE'
  | 'STATIONERY'
  | 'PET_SUPPLIES'
  | 'OTHER';


/**
 * ProductCategory — organises products within a store
 */
export interface ProductCategory {
  id: string;
  store_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

/**
 * Product — an item listed by a merchant
 */
export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number; // In paise (e.g. ₹50 = 5000)
  compare_at_price: number | null; // Original price if discounted
  unit: string; // e.g. "per kg", "per piece", "500ml"
  is_available: boolean; // Merchant can toggle this
  is_active: boolean; // Admin can deactivate
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * CustomerAddress — a saved delivery address for a customer
 */
export interface CustomerAddress {
  id: string;
  customer_id: string; // FK → profiles.id
  label: string; // e.g. "Home", "Work", "Other"
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  location: GeoJSONPoint | null; // GPS coordinates
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Order — the central entity of the BEVER platform
 */
export interface Order {
  id: string;
  order_number: string; // Human-readable, e.g. "BVR-20241201-0042"
  customer_id: string; // FK → profiles.id
  store_id: string; // FK → stores.id
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  delivery_address_id: string; // FK → customer_addresses.id
  delivery_address_snapshot: DeliveryAddressSnapshot; // Snapshotted at order time
  items_total: number; // Sum of all item prices, in paise
  delivery_fee: number; // In paise
  discount_amount: number; // In paise
  total_amount: number; // Final amount customer pays, in paise
  special_instructions: string | null;
  delivery_otp: string | null; // 4-digit OTP for delivery confirmation
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Snapshot of the delivery address taken at order placement time.
 * This ensures address changes after ordering do not affect the in-progress order.
 */
export interface DeliveryAddressSnapshot {
  label: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  pincode: string;
  location: GeoJSONPoint | null;
}

/**
 * OrderItem — an individual product line in an order
 */
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name_snapshot: string; // Snapshotted at order time
  product_image_snapshot: string | null;
  unit_snapshot: string | null; // e.g. "per kg", "500ml", snapshotted at order time
  unit_price: number; // In paise, snapshotted at order time
  quantity: number;
  total_price: number; // unit_price × quantity, in paise
  created_at: string;
}


/**
 * OrderStatusHistory — audit trail for every order state change
 */
export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus | null; // null for the initial PENDING entry
  to_status: OrderStatus;
  changed_by: string | null; // FK → profiles.id (null for system)
  changed_by_role: UserRole | 'system' | null;
  note: string | null;
  created_at: string;
}

/**
 * DeliveryAssignment — links a rider to an order for delivery
 */
export interface DeliveryAssignment {
  id: string;
  order_id: string;
  rider_id: string; // FK → profiles.id
  assigned_by: string; // FK → profiles.id (admin who assigned)
  assigned_at: string;
  accepted_at: string | null;
  arrived_at_store_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  cod_collected: boolean; // True if rider collected cash payment
  cod_amount: number | null; // In paise
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ─── GeoJSON Types ────────────────────────────────────────────────────────────

/** GeoJSON Point — used for location data from PostGIS */
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [longitude: number, latitude: number];
}

// ─── Cart Types (client-side only, never persisted to DB directly) ────────────

/**
 * CartItem — a product in the customer's local cart
 * The cart lives in local state (Zustand) and is NOT stored in the database.
 * It is converted to OrderItems only when the order is placed.
 */
export interface CartItem {
  product_id: string;
  store_id: string;
  name: string;
  image_url: string | null;
  unit_price: number; // In paise
  quantity: number;
  unit: string;
}

/**
 * Cart — the full local cart state
 * RULE: All items must be from the same store_id.
 */
export interface Cart {
  store_id: string | null; // null = empty cart
  store_name: string | null;
  items: CartItem[];
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

/**
 * Paginated response wrapper for all list endpoints.
 * All list queries MUST be paginated — never return unlimited results.
 */
export interface PaginatedResponse<T> {
  data: T[];
  count: number; // Total number of records matching the query
  page: number; // Current page (0-indexed)
  pageSize: number; // Number of items per page
  hasMore: boolean; // True if there are more pages
}

/**
 * Standard API error shape
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ─── Utility Types ────────────────────────────────────────────────────────────

/** Converts a price in paise to a formatted INR string. e.g. 5000 → "₹50.00" */
export function formatPrice(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

/** Converts a price in paise to rupees as a number. e.g. 5000 → 50 */
export function paisaToRupees(paise: number): number {
  return paise / 100;
}

/** Converts rupees to paise. e.g. 50 → 5000 */
export function rupeesToPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}
