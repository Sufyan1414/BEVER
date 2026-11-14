/**
 * Decides tomorrow's morning message from what this customer actually does.
 * Pure function: no network, easy to reason about.
 */
import type { NudgePlan } from './notifications';
import type { Bundle, Taste } from './taste';

const BREAKFAST_WORDS = ['milk', 'bread', 'egg', 'butter', 'tea', 'coffee', 'poha', 'oats', 'corn', 'jam', 'banana', 'curd', 'paneer'];
const rupees = (p: number) => `₹${Math.round(p / 100)}`;
const isBreakfasty = (name: string) => BREAKFAST_WORDS.some((w) => name.toLowerCase().includes(w));

/** Hour of day (5–11) in which the customer most often orders, or null. */
function usualMorningHour(taste: Taste | null): number | null {
  if (!taste || taste.orders < 2 || taste.morning_orders < 1) return null;
  let best = -1; let n = 0;
  for (let h = 5; h <= 11; h++) { const c = taste.hours[h] ?? 0; if (c > n) { n = c; best = h; } }
  return best >= 0 ? best : null;
}

export function planMorningNudge(taste: Taste | null, bundles: Bundle[], storeNames: Record<string, string>): NudgePlan {
  const usual = usualMorningHour(taste);
  // Arrive ~20 minutes before they usually order; never before 6:30 or after 10:30.
  let total = usual != null ? usual * 60 - 20 : 8 * 60;
  total = Math.min(Math.max(total, 6 * 60 + 30), 10 * 60 + 30);
  const hour = Math.floor(total / 60); const minute = total % 60;

  const breakfast = bundles.filter((b) => b.slot === 'BREAKFAST');
  const favourites = taste?.top_products ?? [];
  const breakfastFavs = favourites.filter((p) => isBreakfasty(p.name));

  // Prefer a breakfast basket from a shop the customer already buys from.
  const favShops = new Set(favourites.map((p) => p.store_id));
  const basket = breakfast.find((b) => favShops.has(b.store_id)) ?? breakfast[0] ?? null;

  if (basket && (usual != null || breakfastFavs.length > 0 || !taste || taste.orders === 0)) {
    const shop = storeNames[basket.store_id] ?? 'a shop near you';
    const names = basket.items.slice(0, 3).map((i) => i.product.name.replace(/\s*\(.*\)$/, ''));
    const more = basket.items.length > 3 ? ` +${basket.items.length - 3} more` : '';
    const why = breakfastFavs.length > 0 ? `You often order ${breakfastFavs[0]!.name.toLowerCase()}. ` : '';
    return {
      hour, minute,
      title: 'Good morning ☀️ Breakfast sorted?',
      body: `${why}${shop}'s ${basket.name.toLowerCase()}: ${names.join(', ')}${more} · ${rupees(basket.totalPaise)}. Add it in one tap.`,
      data: { kind: 'bundle', bundleId: basket.id },
    };
  }
  const fav = favourites[0];
  if (fav) {
    return {
      hour, minute,
      title: `Running low on ${fav.name}?`,
      body: `Reorder from ${storeNames[fav.store_id] ?? 'your shop'} in one tap. It's your most-ordered item.`,
      data: { kind: 'product', productId: fav.product_id, storeId: fav.store_id },
    };
  }
  return { hour, minute, title: 'Good morning ☀️', body: 'Fresh groceries from shops around the corner, at your door in minutes.', data: { kind: 'home' } };
}
