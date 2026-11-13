/**
 * BEVER customer app — design tokens ("ink & paper").
 * Black and white carry the interface; colour is used sparingly for meaning:
 * mint = go / add / success, saffron = offers, coral = heart / alert, sky = info.
 */
export const C = {
  ink: '#0B0B0C',
  ink2: '#26262A',
  paper: '#FFFFFF',
  canvas: '#F5F5F2',
  line: '#E6E6E1',
  muted: '#6E6E68',
  faint: '#A3A39C',
  mint: '#059669',
  mintSoft: '#E6F6EE',
  saffron: '#F59E0B',
  saffronSoft: '#FFF4DB',
  coral: '#F2553D',
  coralSoft: '#FDEBE7',
  sky: '#2F6FED',
  skySoft: '#E8F0FF',
  violet: '#7B5CFA',
  violetSoft: '#EFEAFF',
  pink: '#F0529C',
  pinkSoft: '#FDE8F2',
} as const;

export const rupees = (paise: number) => `₹${Math.round(paise / 100)}`;

/** Each shop category gets its own tile colour so the home grid scans at a glance. */
export const CATEGORY_STYLE: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
  GROCERY: { bg: C.mintSoft, fg: '#047857', icon: '🥬', label: 'Grocery' },
  RESTAURANT: { bg: C.coralSoft, fg: '#C2410C', icon: '🍛', label: 'Food' },
  PHARMACY: { bg: C.skySoft, fg: '#1D4ED8', icon: '💊', label: 'Pharmacy' },
  BAKERY: { bg: C.saffronSoft, fg: '#B45309', icon: '🥐', label: 'Bakery' },
  ELECTRONICS: { bg: C.violetSoft, fg: '#5B3FD9', icon: '🎧', label: 'Electronics' },
  CLOTHING: { bg: C.pinkSoft, fg: '#BE185D', icon: '👕', label: 'Clothing' },
  HARDWARE: { bg: '#EEEEEA', fg: '#3F3F3A', icon: '🔧', label: 'Hardware' },
  STATIONERY: { bg: '#E3F4F7', fg: '#0E7490', icon: '✏️', label: 'Stationery' },
  PET_SUPPLIES: { bg: '#F5EBDD', fg: '#92400E', icon: '🐾', label: 'Pet care' },
  OTHER: { bg: '#EEEEEA', fg: '#3F3F3A', icon: '🛍️', label: 'More' },
};
