/**
 * BEVER — Shared Package Entry Point
 *
 * All exports from the shared package are centralised here.
 * Apps import from '@bever/shared', not from individual files.
 *
 * Example:
 *   import { Order, OrderStatus, ORDER_STATUS_LABELS } from '@bever/shared';
 */

// Types
export * from './types/index.js';

// Constants
export * from './constants/index.js';

// Order State Machine
export * from './order-state-machine/index.js';
