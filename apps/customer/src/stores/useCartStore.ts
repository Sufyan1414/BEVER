/**
 * BEVER Customer App — Cart Store
 *
 * Manages in-session shopping cart state for the customer.
 *
 * Design decisions:
 *   - One store per cart. Adding from a different store requires explicit
 *     confirmation (see addItem / CartConflict pattern).
 *   - No variant system: the database Product model has no variants field.
 *     Cart items are keyed by product.id only.
 *   - Prices are captured at add-time from the live product catalogue
 *     (price in paise, as returned by the database). These are DISPLAY prices
 *     only — the authoritative order total must be revalidated server-side
 *     at checkout time.
 *   - Persistence uses AsyncStorage with the project's existing @bever/ key
 *     convention. No new packages — no Zustand persist middleware.
 *   - Cart is available to both guests and authenticated users.
 *     Authentication gate lives in Task 3 (checkout gate), not here.
 *
 * Safety:
 *   - Unavailable products cannot be added.
 *   - Quantities cannot go below zero (item is removed at zero).
 *   - Price and name are snapshotted at add-time to avoid stale catalogue
 *     references when the cart is opened later in the session.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '../types/store';

// ─── Storage key ─────────────────────────────────────────────────────────────

const CART_STORAGE_KEY = '@bever/cart';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A single line item in the active cart. */
export interface CartItem {
  /** Product UUID */
  productId: string;
  /** Store UUID that owns this product */
  storeId: string;
  /** Snapshot of product name at time of adding */
  productName: string;
  /** Snapshot of product image URL at time of adding, or null */
  productImageUrl: string | null;
  /** Snapshot of product unit label at time of adding (e.g. "500g", "1 pc") */
  unit: string;
  /** Selling price in paise at time of adding (₹1 = 100 paise) */
  unitPricePaise: number;
  /** Current quantity in cart (always ≥ 1) */
  quantity: number;
}

/** Computed summary derived from cart items. Never stored — always computed. */
export interface CartSummary {
  /** Total number of individual units across all lines */
  totalItems: number;
  /** Subtotal in paise (sum of unitPrice × quantity for all lines) */
  subtotalPaise: number;
}

/** Persisted cart snapshot written to AsyncStorage. */
interface PersistedCart {
  storeId: string | null;
  storeName: string | null;
  items: CartItem[];
}

/** Return value for addItem when a cross-store conflict is detected. */
export type AddItemResult =
  | { kind: 'added' }
  | { kind: 'increased' }
  | { kind: 'unavailable' }
  | { kind: 'conflict'; existingStoreName: string };

interface CartState {
  /** UUID of the store whose products are in the cart, or null if empty. */
  storeId: string | null;
  /** Display name of the store (snapshotted). */
  storeName: string | null;
  /** Ordered array of line items. */
  items: CartItem[];
  /** True while loading persisted cart from AsyncStorage on app start. */
  isCartLoading: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Load persisted cart from AsyncStorage. Call once on app init. */
  loadPersistedCart: () => Promise<void>;

  /**
   * Attempt to add a product to the cart.
   *
   * Returns:
   *   'added'       — new item added successfully
   *   'increased'   — existing item quantity incremented
   *   'unavailable' — product.is_available is false; nothing changed
   *   'conflict'    — product belongs to a different store; nothing changed,
   *                   caller must show confirmation UI then call
   *                   clearCartAndAdd() if the user confirms
   */
  addItem: (product: Product, store: { id: string; name: string }) => AddItemResult;

  /**
   * Clear the entire cart and immediately add the given product.
   * Used when the customer confirms the cross-store warning.
   */
  clearCartAndAdd: (product: Product, store: { id: string; name: string }) => void;

  /** Increment quantity of an existing item by 1. No-op if item not in cart. */
  incrementItem: (productId: string) => void;

  /**
   * Decrement quantity of an item by 1.
   * Removes the item entirely when quantity reaches zero.
   */
  decrementItem: (productId: string) => void;

  /** Remove a single item regardless of quantity. */
  removeItem: (productId: string) => void;

  /** Remove all items and reset store reference. Prompts no confirmation — UI layer must do that. */
  clearCart: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute summary from current items list. */
export function computeCartSummary(items: CartItem[]): CartSummary {
  return items.reduce<CartSummary>(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      subtotalPaise: acc.subtotalPaise + item.unitPricePaise * item.quantity,
    }),
    { totalItems: 0, subtotalPaise: 0 },
  );
}

/** Persist current cart snapshot to AsyncStorage (fire-and-forget). */
async function persistCart(storeId: string | null, storeName: string | null, items: CartItem[]) {
  try {
    const snapshot: PersistedCart = { storeId, storeName, items };
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Non-fatal: cart is still correct in memory for this session.
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>((set, get) => ({
  storeId: null,
  storeName: null,
  items: [],
  isCartLoading: true,

  // ── Persistence ────────────────────────────────────────────────────────────

  loadPersistedCart: async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedCart;
        // Basic sanity check
        if (
          Array.isArray(parsed.items) &&
          (parsed.storeId === null || typeof parsed.storeId === 'string')
        ) {
          set({
            storeId: parsed.storeId,
            storeName: parsed.storeName ?? null,
            items: parsed.items,
            isCartLoading: false,
          });
          return;
        }
      }
    } catch {
      // Corrupt / missing data — start with empty cart
    }
    set({ storeId: null, storeName: null, items: [], isCartLoading: false });
  },

  // ── addItem ────────────────────────────────────────────────────────────────

  addItem: (product, store) => {
    if (!product.is_available) {
      return { kind: 'unavailable' };
    }

    const { storeId, storeName, items } = get();

    // Cross-store conflict check
    if (storeId !== null && storeId !== store.id) {
      return { kind: 'conflict', existingStoreName: storeName ?? 'another store' };
    }

    const existingIndex = items.findIndex((i) => i.productId === product.id);

    if (existingIndex >= 0) {
      // Increment existing
      const updated = items.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
      );
      set({ items: updated });
      persistCart(store.id, store.name, updated);
      return { kind: 'increased' };
    }

    // New line item
    const newItem: CartItem = {
      productId: product.id,
      storeId: store.id,
      productName: product.name,
      productImageUrl: product.image_url,
      unit: product.unit,
      unitPricePaise: product.price,
      quantity: 1,
    };
    const updated = [...items, newItem];
    set({ storeId: store.id, storeName: store.name, items: updated });
    persistCart(store.id, store.name, updated);
    return { kind: 'added' };
  },

  // ── clearCartAndAdd ────────────────────────────────────────────────────────

  clearCartAndAdd: (product, store) => {
    if (!product.is_available) return;

    const newItem: CartItem = {
      productId: product.id,
      storeId: store.id,
      productName: product.name,
      productImageUrl: product.image_url,
      unit: product.unit,
      unitPricePaise: product.price,
      quantity: 1,
    };
    set({ storeId: store.id, storeName: store.name, items: [newItem] });
    persistCart(store.id, store.name, [newItem]);
  },

  // ── incrementItem ──────────────────────────────────────────────────────────

  incrementItem: (productId) => {
    const { storeId, storeName, items } = get();
    const updated = items.map((item) =>
      item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
    );
    set({ items: updated });
    persistCart(storeId, storeName, updated);
  },

  // ── decrementItem ──────────────────────────────────────────────────────────

  decrementItem: (productId) => {
    const { storeId, storeName, items } = get();
    const updated = items
      .map((item) =>
        item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item,
      )
      .filter((item) => item.quantity > 0);

    const newStoreId = updated.length === 0 ? null : storeId;
    const newStoreName = updated.length === 0 ? null : storeName;

    set({ storeId: newStoreId, storeName: newStoreName, items: updated });
    persistCart(newStoreId, newStoreName, updated);
  },

  // ── removeItem ─────────────────────────────────────────────────────────────

  removeItem: (productId) => {
    const { storeId, storeName, items } = get();
    const updated = items.filter((item) => item.productId !== productId);
    const newStoreId = updated.length === 0 ? null : storeId;
    const newStoreName = updated.length === 0 ? null : storeName;
    set({ storeId: newStoreId, storeName: newStoreName, items: updated });
    persistCart(newStoreId, newStoreName, updated);
  },

  // ── clearCart ──────────────────────────────────────────────────────────────

  clearCart: () => {
    set({ storeId: null, storeName: null, items: [] });
    persistCart(null, null, []);
  },
}));
