/**
 * BEVER Customer App — Store Type Definitions
 *
 * Types for public.stores database records and the get_nearby_stores RPC
 * return shape.
 *
 * IMPORTANT: StoreCategory values must exactly match the store_category
 * PostgreSQL enum defined in packages/supabase/migrations/001_initial_schema.sql.
 * Do not add or remove values here without a corresponding database migration.
 */

// ─── Store Category ───────────────────────────────────────────────────────────
// Mirrors the store_category PostgreSQL enum from 001_initial_schema.sql.

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

// Human-readable display labels for each category.
export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  GROCERY:     'Grocery',
  RESTAURANT:  'Restaurant',
  PHARMACY:    'Pharmacy',
  BAKERY:      'Bakery',
  ELECTRONICS: 'Electronics',
  CLOTHING:    'Clothing',
  HARDWARE:    'Hardware',
  STATIONERY:  'Stationery',
  PET_SUPPLIES: 'Pet Supplies',
  OTHER:       'Other',
};

// ─── Nearby Store (RPC return shape) ─────────────────────────────────────────
// Mirrors the RETURNS TABLE columns of public.get_nearby_stores() exactly.
// Column additions to the RPC must be reflected here.

export interface NearbyStore {
  /** Store UUID */
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  category: StoreCategory;
  /** Whether the store is currently accepting orders */
  is_open: boolean;
  /** Average star rating 0.00–5.00 */
  average_rating: number;
  total_ratings: number;
  /** Estimated minutes from store to customer door, or null if not set */
  estimated_delivery_minutes: number | null;
  /** Minimum basket value in paise (₹1 = 100 paise) */
  minimum_order_amount: number;
  /** Human-readable store address */
  address_text: string;
  /** Straight-line distance from customer coordinate to store, in metres */
  distance_meters: number;
  /**
   * The store's configured delivery radius in metres.
   * Always > 0 for rows returned by the RPC — NULL stores are excluded.
   */
  service_radius_meters: number;
}
