/**
 * BEVER — Shared Constants
 *
 * Application-wide constants used across all apps.
 * Never hardcode these values in individual apps.
 */

// ─── Pagination ───────────────────────────────────────────────────────────────

/** Default number of items per page for all paginated queries */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum allowed page size to prevent abuse */
export const MAX_PAGE_SIZE = 100;

// ─── Cart ─────────────────────────────────────────────────────────────────────

/** Maximum number of distinct products allowed in a single cart */
export const MAX_CART_ITEMS = 50;

// ─── OTP ──────────────────────────────────────────────────────────────────────

/** Length of the delivery OTP sent to customers */
export const DELIVERY_OTP_LENGTH = 4;

// ─── Images ───────────────────────────────────────────────────────────────────

/** Maximum product image dimensions (pixels) */
export const PRODUCT_IMAGE_MAX_WIDTH = 800;
export const PRODUCT_IMAGE_MAX_HEIGHT = 800;

/** Maximum store banner dimensions (pixels) */
export const STORE_BANNER_MAX_WIDTH = 1200;
export const STORE_BANNER_MAX_HEIGHT = 400;

/** Maximum image file size before upload (bytes) — 2MB */
export const MAX_IMAGE_FILE_SIZE_BYTES = 2 * 1024 * 1024;

// ─── Realtime ─────────────────────────────────────────────────────────────────

/**
 * Maximum number of Realtime subscriptions a single app instance should hold.
 * Do not subscribe to more than this at once to conserve resources.
 */
export const MAX_REALTIME_SUBSCRIPTIONS = 3;

// ─── Order ────────────────────────────────────────────────────────────────────

/** Prefix for human-readable order numbers */
export const ORDER_NUMBER_PREFIX = 'BVR';

// ─── Maps ─────────────────────────────────────────────────────────────────────

/** Default map centre (approximate geographic centre of India) */
export const DEFAULT_MAP_CENTER = {
  latitude: 20.5937,
  longitude: 78.9629,
};

/** Default zoom level for store discovery map */
export const DEFAULT_MAP_ZOOM = 13;

/** Search radius in metres for finding nearby stores */
export const DEFAULT_NEARBY_RADIUS_METRES = 5000; // 5 km

// ─── Storage Bucket Names ─────────────────────────────────────────────────────

/**
 * Supabase Storage bucket names.
 * These must match exactly what is configured in Supabase Storage.
 */
export const STORAGE_BUCKETS = {
  PRODUCT_IMAGES: 'product-images',
  STORE_BANNERS: 'store-banners',
  STORE_LOGOS: 'store-logos',
  USER_AVATARS: 'user-avatars',
} as const;

// ─── Environment Variable Keys ────────────────────────────────────────────────

/**
 * The names of required environment variables.
 * Each app reads these from its own .env.local file.
 * These are listed here for documentation purposes only.
 *
 * NEVER hardcode the actual values here.
 */
export const ENV_KEYS = {
  SUPABASE_URL: 'EXPO_PUBLIC_SUPABASE_URL', // Safe to expose in mobile apps
  SUPABASE_ANON_KEY: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', // Safe to expose in mobile apps
  // SUPABASE_SERVICE_ROLE_KEY — NEVER in mobile apps. Admin web only, server-side.
} as const;
