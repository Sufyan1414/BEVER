import type { OrderStatus } from './types';

function groupIndian(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Money is stored as integer paise everywhere. */
export function rupees(paise: number): string {
  const whole = Math.floor(Math.abs(paise) / 100);
  const frac = Math.abs(paise) % 100;
  const sign = paise < 0 ? '-' : '';
  return `${sign}₹${groupIndian(whole)}${frac ? '.' + String(frac).padStart(2, '0') : ''}`;
}

export function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function minutesSince(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export function isToday(iso: string, now: number): boolean {
  const a = new Date(iso);
  const b = new Date(now);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

export type Tone = 'warn' | 'info' | 'ok' | 'bad' | 'neutral';

export const STATUS_META: Record<OrderStatus, { label: string; tone: Tone; hint: string }> = {
  PENDING: { label: 'New order', tone: 'warn', hint: 'Accept or reject this order. The customer is waiting.' },
  MERCHANT_ACCEPTED: { label: 'Accepted', tone: 'info', hint: 'Start preparing when you begin packing.' },
  PREPARING: { label: 'Preparing', tone: 'info', hint: 'Mark it ready once everything is packed.' },
  READY_FOR_PICKUP: { label: 'Ready for pickup', tone: 'ok', hint: 'Waiting for BEVER to assign a rider. Keep the package ready.' },
  RIDER_ASSIGNED: { label: 'Rider assigned', tone: 'ok', hint: 'A rider is on the way to your store.' },
  RIDER_AT_STORE: { label: 'Rider at store', tone: 'ok', hint: 'Hand over the package to the rider.' },
  PICKED_UP: { label: 'Picked up', tone: 'ok', hint: 'The rider has your package.' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'ok', hint: 'On its way to the customer.' },
  DELIVERED: { label: 'Delivered', tone: 'ok', hint: 'This order is complete.' },
  REJECTED: { label: 'Rejected', tone: 'bad', hint: 'You declined this order.' },
  CANCELLED: { label: 'Cancelled', tone: 'bad', hint: 'This order was cancelled.' },
  PAYMENT_FAILED: { label: 'Payment failed', tone: 'bad', hint: 'Payment did not go through.' },
  DELIVERY_FAILED: { label: 'Delivery failed', tone: 'bad', hint: 'Delivery could not be completed. BEVER support will follow up.' },
  REFUND_PENDING: { label: 'Refund pending', tone: 'neutral', hint: 'BEVER is handling the refund.' },
  REFUNDED: { label: 'Refunded', tone: 'neutral', hint: 'This order was refunded.' },
};

export const NEW_STATUSES: OrderStatus[] = ['PENDING'];
export const ACTIVE_STATUSES: OrderStatus[] = [
  'MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED',
  'RIDER_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY',
];

export function nextAction(status: OrderStatus): { to: OrderStatus; label: string } | null {
  switch (status) {
    case 'PENDING': return { to: 'MERCHANT_ACCEPTED', label: 'Accept order' };
    case 'MERCHANT_ACCEPTED': return { to: 'PREPARING', label: 'Start preparing' };
    case 'PREPARING': return { to: 'READY_FOR_PICKUP', label: 'Mark ready for pickup' };
    default: return null;
  }
}

export const REJECT_REASONS = [
  'Item(s) out of stock',
  'Store is closing or too busy',
  'Cannot fulfil this order',
  'Other',
] as const;
