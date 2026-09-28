/**
 * BEVER — Order State Machine (TypeScript implementation)
 *
 * This is the client-side representation of the order state machine.
 * Note: Transitions are ENFORCED by the database. This client-side
 * implementation is for UI guidance only (e.g. showing correct buttons).
 *
 * The database will reject any illegal transition regardless of what the
 * client sends. Never trust client-side state validation alone.
 */

import type { OrderStatus, UserRole } from '../types/index.js';

/**
 * Defines which role can trigger which state transitions.
 * Format: { fromState: { toState: requiredRole[] } }
 */
export const ORDER_TRANSITIONS: Readonly<
  Partial<Record<OrderStatus, Partial<Record<OrderStatus, UserRole[]>>>>
> = {
  PENDING: {
    MERCHANT_ACCEPTED: ['merchant'],
    REJECTED: ['merchant'],
    CANCELLED: ['customer', 'admin'],
  },
  MERCHANT_ACCEPTED: {
    PREPARING: ['merchant'],
    CANCELLED: ['admin'],
  },
  PREPARING: {
    READY_FOR_PICKUP: ['merchant'],
  },
  READY_FOR_PICKUP: {
    RIDER_ASSIGNED: ['admin'],
  },
  RIDER_ASSIGNED: {
    RIDER_AT_STORE: ['rider'],
    READY_FOR_PICKUP: ['admin'], // Rider unassigned, back to queue
  },
  RIDER_AT_STORE: {
    PICKED_UP: ['rider'],
  },
  PICKED_UP: {
    OUT_FOR_DELIVERY: ['rider'],
  },
  OUT_FOR_DELIVERY: {
    DELIVERED: ['rider'],
    DELIVERY_FAILED: ['rider', 'admin'],
  },
  DELIVERY_FAILED: {
    REFUND_PENDING: ['admin'],
  },
  REFUND_PENDING: {
    REFUNDED: ['admin'],
  },
  // Terminal states — no transitions allowed
  DELIVERED: {},
  REJECTED: {},
  CANCELLED: {},
  PAYMENT_FAILED: {},
  REFUNDED: {},
} as const;

/**
 * Returns the allowed next states for a given current order status and user role.
 * Used to determine which action buttons to show in the UI.
 *
 * @param currentStatus - The current order status
 * @param role - The role of the currently authenticated user
 * @returns Array of statuses this user can transition the order to
 */
export function getAllowedTransitions(
  currentStatus: OrderStatus,
  role: UserRole,
): OrderStatus[] {
  const transitions = ORDER_TRANSITIONS[currentStatus];
  if (!transitions) return [];

  return (Object.entries(transitions) as [OrderStatus, UserRole[]][])
    .filter(([, allowedRoles]) => allowedRoles.includes(role))
    .map(([toStatus]) => toStatus);
}

/**
 * Returns a human-readable label for each order status.
 * Used for display in app UIs.
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Order Placed',
  MERCHANT_ACCEPTED: 'Order Accepted',
  PREPARING: 'Being Prepared',
  READY_FOR_PICKUP: 'Ready for Pickup',
  RIDER_ASSIGNED: 'Rider Assigned',
  RIDER_AT_STORE: 'Rider at Store',
  PICKED_UP: 'Order Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Order Rejected',
  CANCELLED: 'Order Cancelled',
  PAYMENT_FAILED: 'Payment Failed',
  DELIVERY_FAILED: 'Delivery Failed',
  REFUND_PENDING: 'Refund Processing',
  REFUNDED: 'Refunded',
};

/**
 * Returns a customer-friendly description of each order status.
 */
export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  PENDING: 'Your order has been placed. Waiting for the store to confirm.',
  MERCHANT_ACCEPTED: 'Great! The store has accepted your order.',
  PREPARING: 'The store is preparing your order.',
  READY_FOR_PICKUP: 'Your order is ready. Finding a delivery partner.',
  RIDER_ASSIGNED: 'A delivery partner is on the way to the store.',
  RIDER_AT_STORE: 'The delivery partner has arrived at the store.',
  PICKED_UP: 'The delivery partner has picked up your order.',
  OUT_FOR_DELIVERY: 'Your order is on its way to you!',
  DELIVERED: 'Your order has been delivered. Enjoy!',
  REJECTED: 'Sorry, the store could not fulfil your order.',
  CANCELLED: 'Your order has been cancelled.',
  PAYMENT_FAILED: 'There was a problem with your payment.',
  DELIVERY_FAILED: 'We could not deliver your order. Our team will contact you.',
  REFUND_PENDING: 'A refund is being processed for your order.',
  REFUNDED: 'Your refund has been completed.',
};
