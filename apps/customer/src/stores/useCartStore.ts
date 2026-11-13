/**
 * BEVER Customer App — Cart Store
 *
 * Manages the customer's active shopping cart and checkout intent.
 *
 * Design decisions:
 *   - Multi-basket: the cart holds one BASKET per shop. A grocery shop and an
 *     electronics shop are separate baskets, each checked out as its own order
 *     (so each gets its own rider). Adding from a new shop just opens a new basket.
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
  /** MRP snapshot for savings display; absent in older persisted carts. */
  mrpPaise?: number;
  quantity: number;
}

export interface CartSummary {
  totalItems: number;
  subtotalPaise: number;
  savingsPaise: number;
}

export interface StoreMeta {
  id: string;
  name: string;
  /** store_category enum value, e.g. GROCERY / ELECTRONICS — used for the basket label. */
  category?: string;
}

export interface Basket {
  storeId: string;
  storeName: string;
  category?: string;
  items: CartItem[];
}

interface PersistedCart {
  version: 2;
  stores: Record<string, { name: string; category?: string }>;
  items: CartItem[];
}

export type AddItemResult =
  | { kind: 'added' }
  | { kind: 'increased' }
  | { kind: 'unavailable' };

interface CartState {
  stores: Record<string, { name: string; category?: string }>;
  /** Every item across all baskets. Use selectBaskets() to group by shop. */
  items: CartItem[];
  isCartLoading: boolean;

  /**
   * True when a guest tapped checkout and must be taken to Checkout after
   * authentication/profile completion. In memory only (navigation intent).
   */
  pendingCheckout: boolean;
  /** Which basket the user is checking out (set from the cart screen). */
  checkoutStoreId: string | null;

  loadPersistedCart: () => Promise<void>;
  addItem: (product: Product, store: StoreMeta) => AddItemResult;
  incrementItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  /** Remove a whole basket (after its order is placed, or "Clear basket"). */
  clearBasket: (storeId: string) => void;
  clearCart: () => void;
  setCheckoutStore: (storeId: string | null) => void;

  requestCheckout: () => void;
  consumeCheckoutIntent: () => void;
}

export function computeCartSummary(items: CartItem[]): CartSummary {
  return items.reduce<CartSummary>(
    (acc, item) => ({
      totalItems: acc.totalItems + item.quantity,
      subtotalPaise: acc.subtotalPaise + item.unitPricePaise * item.quantity,
      savingsPaise: acc.savingsPaise + (item.mrpPaise && item.mrpPaise > item.unitPricePaise ? (item.mrpPaise - item.unitPricePaise) * item.quantity : 0),
    }),
    { totalItems: 0, subtotalPaise: 0, savingsPaise: 0 },
  );
}

/** Group the flat item list into one basket per shop, in the order the shops were first added. */
export function selectBaskets(items: CartItem[], stores: CartState['stores']): Basket[] {
  const order: string[] = [];
  const map = new Map<string, CartItem[]>();
  for (const it of items) {
    if (!map.has(it.storeId)) { map.set(it.storeId, []); order.push(it.storeId); }
    map.get(it.storeId)!.push(it);
  }
  return order.map((id) => {
    const meta = stores[id];
    return {
      storeId: id,
      storeName: meta?.name ?? 'Shop',
      ...(meta?.category ? { category: meta.category } : {}),
      items: map.get(id) ?? [],
    };
  });
}

/** Friendly basket label from the shop's category. */
export function basketKind(category?: string): string {
  switch (category) {
    case 'GROCERY': return 'Groceries';
    case 'RESTAURANT': return 'Food';
    case 'PHARMACY': return 'Medicines';
    case 'BAKERY': return 'Bakery';
    case 'ELECTRONICS': return 'Electronics';
    case 'CLOTHING': return 'Clothing';
    case 'HARDWARE': return 'Hardware';
    case 'STATIONERY': return 'Stationery';
    case 'PET_SUPPLIES': return 'Pet supplies';
    default: return 'Basket';
  }
}

async function persist(stores: CartState['stores'], items: CartItem[]) {
  try {
    const snapshot: PersistedCart = { version: 2, stores, items };
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Non-fatal: cart remains correct in memory.
  }
}

function isValidItem(item: unknown): item is CartItem {
  const i = item as CartItem;
  return !!i &&
    typeof i.productId === 'string' && i.productId.length > 0 &&
    typeof i.storeId === 'string' &&
    typeof i.productName === 'string' &&
    (typeof i.productImageUrl === 'string' || i.productImageUrl === null) &&
    typeof i.unit === 'string' &&
    Number.isSafeInteger(i.unitPricePaise) && i.unitPricePaise >= 0 &&
    Number.isSafeInteger(i.quantity) && i.quantity > 0;
}

/** Keep only metadata for shops that still have items. */
function pruneStores(stores: CartState['stores'], items: CartItem[]): CartState['stores'] {
  const live = new Set(items.map((i) => i.storeId));
  return Object.fromEntries(Object.entries(stores).filter(([id]) => live.has(id)));
}

export const useCartStore = create<CartState>((set, get) => ({
  stores: {},
  items: [],
  isCartLoading: true,
  pendingCheckout: false,
  checkoutStoreId: null,

  loadPersistedCart: async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedCart> & { storeId?: string | null; storeName?: string | null };
        const items = Array.isArray(parsed.items) ? parsed.items.filter(isValidItem) : [];
        let stores: CartState['stores'] = {};
        if (parsed.version === 2 && parsed.stores && typeof parsed.stores === 'object') {
          stores = parsed.stores;
        } else if (typeof parsed.storeId === 'string') {
          // Old single-shop cart format.
          stores = { [parsed.storeId]: { name: parsed.storeName ?? 'Shop' } };
        }
        stores = pruneStores(stores, items);
        set({ stores, items, isCartLoading: false });
        return;
      }
    } catch {
      // Corrupt / missing data — start with an empty cart.
    }
    set({ stores: {}, items: [], isCartLoading: false });
  },

  addItem: (product, store) => {
    if (!product.is_available) return { kind: 'unavailable' };
    const { items, stores } = get();
    const nextStores = { ...stores, [store.id]: { name: store.name, ...(store.category ? { category: store.category } : stores[store.id]?.category ? { category: stores[store.id]!.category as string } : {}) } };
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      if (product.stock_qty != null && existing.quantity >= product.stock_qty) return { kind: 'increased' };
      const updated = items.map((i) => (i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      set({ items: updated, stores: nextStores });
      void persist(nextStores, updated);
      return { kind: 'increased' };
    }
    const newItem: CartItem = {
      productId: product.id,
      storeId: store.id,
      productName: product.name,
      productImageUrl: product.image_url,
      unit: product.unit,
      unitPricePaise: product.price,
      ...(product.compare_at_price ? { mrpPaise: product.compare_at_price } : {}),
      quantity: 1,
    };
    const updated = [...items, newItem];
    set({ items: updated, stores: nextStores });
    void persist(nextStores, updated);
    return { kind: 'added' };
  },

  incrementItem: (productId) => {
    const { items, stores } = get();
    const updated = items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i));
    set({ items: updated });
    void persist(stores, updated);
  },

  decrementItem: (productId) => {
    const { items, stores } = get();
    const updated = items
      .map((i) => (i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i))
      .filter((i) => i.quantity > 0);
    const nextStores = pruneStores(stores, updated);
    set({ items: updated, stores: nextStores });
    void persist(nextStores, updated);
  },

  removeItem: (productId) => {
    const { items, stores } = get();
    const updated = items.filter((i) => i.productId !== productId);
    const nextStores = pruneStores(stores, updated);
    set({ items: updated, stores: nextStores });
    void persist(nextStores, updated);
  },

  clearBasket: (storeId) => {
    const { items, stores, checkoutStoreId } = get();
    const updated = items.filter((i) => i.storeId !== storeId);
    const nextStores = pruneStores(stores, updated);
    set({ items: updated, stores: nextStores, checkoutStoreId: checkoutStoreId === storeId ? null : checkoutStoreId });
    void persist(nextStores, updated);
  },

  clearCart: () => {
    set({ stores: {}, items: [], pendingCheckout: false, checkoutStoreId: null });
    void persist({}, []);
  },

  setCheckoutStore: (storeId) => set({ checkoutStoreId: storeId }),

  requestCheckout: () => set({ pendingCheckout: true }),

  consumeCheckoutIntent: () => set({ pendingCheckout: false }),
}));
