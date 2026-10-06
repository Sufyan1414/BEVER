import { supabase } from './supabase';
import type { CartItem } from '../stores/useCartStore';

export type CheckoutPaymentMethod = 'COD' | 'UPI';
export type CustomerOrderStatus =
  | 'PENDING' | 'MERCHANT_ACCEPTED' | 'PREPARING' | 'READY_FOR_PICKUP'
  | 'RIDER_ASSIGNED' | 'RIDER_AT_STORE' | 'PICKED_UP' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'REJECTED' | 'CANCELLED' | 'PAYMENT_FAILED'
  | 'DELIVERY_FAILED' | 'REFUND_PENDING' | 'REFUNDED';

export interface CreateCustomerOrderResult {
  orderId: string;
  orderNumber: string;
  itemsTotalPaise: number;
  deliveryFeePaise: number;
  totalAmountPaise: number;
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  storeName: string;
  status: CustomerOrderStatus;
  paymentMethod: CheckoutPaymentMethod;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
  estimatedDeliveryAt: string | null;
}

export interface CustomerOrderItem {
  id: string;
  productNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  unitSnapshot: string | null;
}

export interface CustomerOrderDetail extends CustomerOrderSummary {
  itemsTotal: number;
  deliveryFee: number;
  discountAmount: number;
  specialInstructions: string | null;
  deliveredAt: string | null;
  deliveryOtp: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  deliveryAddress: {
    label?: string;
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    state: string;
    pincode: string;
  } | null;
  items: CustomerOrderItem[];
}

export interface OrderProgressStep {
  key: string;
  label: string;
  detail: string;
  state: 'done' | 'active' | 'upcoming';
}

function normalizeRpcError(message: string): Error {
  const code = message.split(':')[0];
  const messages: Record<string, string> = {
    AUTH_REQUIRED: 'Please sign in to place your order.',
    CART_EMPTY: 'Your cart is empty.',
    STORE_UNAVAILABLE: 'This store is currently unavailable.',
    ADDRESS_NOT_FOUND: 'Please select a valid delivery address.',
    ADDRESS_LOCATION_REQUIRED: 'Your delivery address needs a delivery location. Please update the address.',
    STORE_LOCATION_UNAVAILABLE: 'This store is not ready for delivery yet.',
    ADDRESS_OUTSIDE_SERVICE_AREA: 'This address is outside the store delivery area.',
    INVALID_CART_ITEM: 'One of the cart items is invalid. Please review your cart.',
    INVALID_QUANTITY: 'One of the item quantities is invalid.',
    MINIMUM_ORDER_NOT_MET: 'The minimum order amount for this store has not been met.',
  };
  return new Error(messages[code] ?? (code.startsWith('PRODUCT_UNAVAILABLE') ? 'One or more items are no longer available. Please review your cart.' : message));
}

export async function createCustomerOrder(params: {
  storeId: string;
  addressId: string;
  items: CartItem[];
  paymentMethod: CheckoutPaymentMethod;
  specialInstructions?: string | null;
}): Promise<CreateCustomerOrderResult> {
  if (!params.items.length) throw new Error('Your cart is empty.');

  const { data, error } = await supabase.rpc('create_customer_order', {
    p_store_id: params.storeId,
    p_delivery_address_id: params.addressId,
    p_items: params.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_payment_method: params.paymentMethod,
    p_special_instructions: params.specialInstructions?.trim() || null,
  });

  if (error) throw normalizeRpcError(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) throw new Error('We could not create the order. Please try again.');

  return {
    orderId: row.order_id,
    orderNumber: row.order_number,
    itemsTotalPaise: row.items_total,
    deliveryFeePaise: row.delivery_fee,
    totalAmountPaise: row.total_amount,
  };
}

export async function fetchMyOrders(limit = 50): Promise<CustomerOrderSummary[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,status,payment_method,total_amount,created_at,estimated_delivery_at,order_items(quantity),stores(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    orderNumber: row.order_number,
    storeName: row.stores?.name ?? 'Store',
    status: row.status as CustomerOrderStatus,
    paymentMethod: row.payment_method as CheckoutPaymentMethod,
    totalAmount: row.total_amount,
    itemCount: (row.order_items ?? []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0),
    createdAt: row.created_at,
    estimatedDeliveryAt: row.estimated_delivery_at ?? null,
  }));
}

export async function fetchOrderDetail(orderId: string): Promise<CustomerOrderDetail> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id,order_number,status,payment_method,total_amount,items_total,delivery_fee,discount_amount,special_instructions,delivered_at,delivery_otp,rejection_reason,cancellation_reason,created_at,estimated_delivery_at,delivery_address_snapshot,stores(name)')
    .eq('id', orderId)
    .maybeSingle();

  if (orderError) throw new Error(orderError.message);
  if (!order) throw new Error('Order not found.');

  const [{ data: items, error: itemsError }] = await Promise.all([
    supabase
      .from('order_items')
      .select('id,product_name_snapshot,unit_price,quantity,total_price,unit_snapshot')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
  ]);

  if (itemsError) throw new Error(itemsError.message);

  const snapshot = (order.delivery_address_snapshot ?? null) as CustomerOrderDetail['deliveryAddress'];

  return {
    id: order.id,
    orderNumber: order.order_number,
    storeName: (order as any).stores?.name ?? 'Store',
    status: order.status as CustomerOrderStatus,
    paymentMethod: order.payment_method as CheckoutPaymentMethod,
    totalAmount: order.total_amount,
    itemCount: (items ?? []).reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0),
    createdAt: order.created_at,
    estimatedDeliveryAt: order.estimated_delivery_at ?? null,
    itemsTotal: order.items_total,
    deliveryFee: order.delivery_fee,
    discountAmount: order.discount_amount,
    specialInstructions: order.special_instructions ?? null,
    deliveredAt: order.delivered_at ?? null,
    deliveryOtp: order.delivery_otp ?? null,
    rejectionReason: order.rejection_reason ?? null,
    cancellationReason: order.cancellation_reason ?? null,
    deliveryAddress: snapshot,
    items: (items ?? []).map((item: any) => ({
      id: item.id,
      productNameSnapshot: item.product_name_snapshot,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      totalPrice: item.total_price,
      unitSnapshot: item.unit_snapshot ?? null,
    })),
  };
}

export function formatOrderStatus(status: CustomerOrderStatus): string {
  const labels: Record<CustomerOrderStatus, string> = {
    PENDING: 'Waiting for store confirmation',
    MERCHANT_ACCEPTED: 'Store confirmed',
    PREPARING: 'Preparing your order',
    READY_FOR_PICKUP: 'Ready for pickup',
    RIDER_ASSIGNED: 'Rider assigned',
    RIDER_AT_STORE: 'Rider at store',
    PICKED_UP: 'Picked up',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    REJECTED: 'Order rejected',
    CANCELLED: 'Order cancelled',
    PAYMENT_FAILED: 'Payment failed',
    DELIVERY_FAILED: 'Delivery failed',
    REFUND_PENDING: 'Refund pending',
    REFUNDED: 'Refunded',
  };
  return labels[status];
}

export function getOrderProgress(status: CustomerOrderStatus): OrderProgressStep[] {
  const stages = [
    { key: 'confirmed', label: 'Order confirmed', detail: 'Your order has been received by BEVER.' },
    { key: 'preparing', label: 'Store preparing', detail: 'The store is preparing your items.' },
    { key: 'rider', label: 'Rider assigned', detail: 'A rider will pick up your order.' },
    { key: 'transit', label: 'On the way', detail: 'Your order is heading to you.' },
    { key: 'delivered', label: 'Delivered', detail: 'Order delivered successfully.' },
  ];
  const index = status === 'PENDING' ? 0
    : ['MERCHANT_ACCEPTED','PREPARING','READY_FOR_PICKUP'].includes(status) ? 1
    : ['RIDER_ASSIGNED','RIDER_AT_STORE','PICKED_UP'].includes(status) ? 2
    : status === 'OUT_FOR_DELIVERY' ? 3
    : status === 'DELIVERED' ? 4 : 0;
  const terminalFailure = ['REJECTED','CANCELLED','PAYMENT_FAILED','DELIVERY_FAILED','REFUND_PENDING','REFUNDED'].includes(status);

  return stages.map((stage, i) => ({
    ...stage,
    state: terminalFailure ? (i === 0 ? 'active' : 'upcoming') : i < index ? 'done' : i === index ? 'active' : 'upcoming',
    detail: terminalFailure && i === 0 ? formatOrderStatus(status) : stage.detail,
  }));
}

export async function transitionCustomerOrder(
  orderId: string,
  toStatus: Extract<CustomerOrderStatus, 'CANCELLED'>,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('transition_order_status', {
    p_order_id: orderId,
    p_to_status: toStatus,
    p_note: note?.trim() || null,
  });
  if (error) {
    const code = error.message.split(':')[0];
    const messages: Record<string, string> = {
      AUTH_REQUIRED: 'Please sign in again.',
      ORDER_NOT_FOUND: 'This order no longer exists.',
      ROLE_NOT_ALLOWED: 'You cannot change this order.',
      INVALID_ORDER_TRANSITION: 'This order can no longer be cancelled.',
    };
    throw new Error(messages[code] ?? error.message);
  }
}
