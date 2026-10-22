/**
 * BEVER Customer App — Cart Store
 *
 * Manages the customer's active shopping cart and checkout intent.
 *
 * Design decisions:
 *   - One store per cart. Adding from a different store requires explicit
 *     confirmation (see addItem / CartConflict pattern).
 *   - Cart is available to guests; authentication is required only when
 *     proceeding to checkout.
 *   - Prices are display snapshots only; the server revalidates totals at
 *     order placement.
 *   - Persistence uses AsyncStorage with the project's existing @bever/ key.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Product } from '../types/store';

const CART_STORAGE_KEY = '@bever/cart';

export interface CartItem {
  productId: string;
  storeId: string;
  productName: string;
  productImageUrl: string | null;
  unit: string;
  unitPricePaise: number;
  quantity: number;
}

export interface CartSummary {
  totalItems: number;
  subtotalPaise: number;
}

interface PersistedCart {
  storeId: string | null;
  storeName: string | null;
  items: CartItem[];
}

export type AddItemResult =
  | { kind: 'added' }
  | { kind: 'increased' }
  | { kind: 'unavailable' }
  | { kind: 'conflict'; existingStoreName: string };

interface CartState {
  storeId: string | null;
  storeName: string | null;
  items: CartItem[];
  isCartLoading: boolean;

  /**
   * True when a guest tapped checkout and must be taken to Checkout after
   * authentication/profile completion. This is intentionally in memory only:
   * it represents a current navigation intent, not durable business state.
   */
  pendingCheckout: boolean;

  loadPersistedCart: () => Promise<void>;
  addItem: (product: Product, store: { id: string; name: string }) => AddItemResult;
  clearCartAndAdd: (product: Product, store: { id: string; name: string }) => void;
  incrementItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;

  requestCheckout: () => void;
  consumeCheckoutIntent: () => void;
}

export function computeCartSummary(items: CartItem[]): CartSummary {
  return items.reduce<CartSummary>(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      subtotalPaise: acc.subtotalPaise + item.unitPricePaise * item.quantity,
    }),
    { totalItems: 0, subtotalPaise: 0 },
  );
}

async function persistCart(storeId: string | null, storeName: string | null, items: CartItem[]) {
  try {
    const snapshot: PersistedCart = { storeId, storeName, items };
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Non-fatal: cart remains correct in memory.
  }
}

export const useCartStore = create<CartState>((set, get) => ({
  storeId: null,
  storeName: null,
  items: [],
  isCartLoading: true,
  pendingCheckout: false,

  loadPersistedCart: async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedCart;
        const validStoreId = parsed.storeId === null || typeof parsed.storeId === 'string';
        const validStoreName = parsed.storeName === null || typeof parsed.storeName === 'string';
        const validItems = Array.isArray(parsed.items)
          ? parsed.items.filter((item): item is CartItem =>
              !!item &&
              typeof item.productId === 'string' &&
              item.productId.length > 0 &&
              typeof item.storeId === 'string' &&
              typeof item.productName === 'string' &&
              (typeof item.productImageUrl === 'string' || item.productImageUrl === null) &&
              typeof item.unit === 'string' &&
              Number.isSafeInteger(item.unitPricePaise) &&
              item.unitPricePaise >= 0 &&
              Number.isSafeInteger(item.quantity) &&
              item.quantity > 0
            )
          : null;
        const oneStoreOnly = validItems !== null &&
          validItems.every((item) => item.storeId === validItems[0]?.storeId) &&
          (validItems.length === 0 || parsed.storeId === validItems[0]?.storeId);

        if (validStoreId && validStoreName && validItems && oneStoreOnly) {
          const storeId = validItems.length ? parsed.storeId : null;
          const storeName = validItems.length ? parsed.storeName : null;
          set({
            storeId,
            storeName,
            items: validItems,
            isCartLoading: false,
          });
          if (validItems.length !== parsed.items.length || storeId !== parsed.storeId) {
            await persistCart(storeId, storeName, validItems);
          }
          return;
        }
      }
    } catch {
      // Corrupt / missing data — start with empty cart.
    }
    set({ storeId: null, storeName: null, items: [], isCartLoading: false });
  },

  addItem: (product, store) => {
    if (!product.is_available) return { kind: 'unavailable' };

    const { storeId, storeName, items } = get();

    if (storeId !== null && storeId !== store.id) {
      return { kind: 'conflict', existingStoreName: storeName ?? 'another store' };
    }

    const existingIndex = items.findIndex((i) => i.productId === product.id);

    if (existingIndex >= 0) {
      const updated = items.map((item, idx) =>
        idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
      );
      set({ items: updated });
      persistCart(store.id, store.name, updated);
      return { kind: 'increased' };
    }

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

  incrementItem: (productId) => {
    const { storeId, storeName, items } = get();
    const updated = items.map((item) =>
      item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
    );
    set({ items: updated });
    persistCart(storeId, storeName, updated);
  },

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

  removeItem: (productId) => {
    const { storeId, storeName, items } = get();
    const updated = items.filter((item) => item.productId !== productId);
    const newStoreId = updated.length === 0 ? null : storeId;
    const newStoreName = updated.length === 0 ? null : storeName;
    set({ storeId: newStoreId, storeName: newStoreName, items: updated });
    persistCart(newStoreId, newStoreName, updated);
  },

  clearCart: () => {
    set({ storeId: null, storeName: null, items: [], pendingCheckout: false });
    persistCart(null, null, []);
  },

  requestCheckout: () => set({ pendingCheckout: true }),

  consumeCheckoutIntent: () => set({ pendingCheckout: false }),
}));
