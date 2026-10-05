import { supabase } from './supabase';
import type { CartItem } from '../stores/useCartStore';

export type CheckoutPaymentMethod = 'COD' | 'UPI';

export interface CreateCustomerOrderResult {
  orderId: string;
  orderNumber: string;
  itemsTotalPaise: number;
  deliveryFeePaise: number;
  totalAmountPaise: number;
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
