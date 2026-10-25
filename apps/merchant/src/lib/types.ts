export type OrderStatus =
  | 'PENDING' | 'MERCHANT_ACCEPTED' | 'PREPARING' | 'READY_FOR_PICKUP'
  | 'RIDER_ASSIGNED' | 'RIDER_AT_STORE' | 'PICKED_UP' | 'OUT_FOR_DELIVERY'
  | 'DELIVERED' | 'REJECTED' | 'CANCELLED' | 'PAYMENT_FAILED'
  | 'DELIVERY_FAILED' | 'REFUND_PENDING' | 'REFUNDED';

export interface OrderItem {
  id: string;
  product_name_snapshot: string;
  unit_price: number; // paise
  quantity: number;
  total_price: number; // paise
  unit_snapshot: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_method: string;
  payment_status: string | null;
  items_total: number; // paise
  delivery_fee: number; // paise
  total_amount: number; // paise
  special_instructions: string | null;
  rejection_reason: string | null;
  created_at: string;
  order_items: OrderItem[];
}

export interface Product {
  id: string;
  name: string;
  unit: string;
  price: number; // paise
  is_available: boolean;
  is_active: boolean;
  updated_at: string;
  image_url?: string | null | undefined;
}

export interface Store {
  id: string;
  name: string;
  category: string;
  is_open: boolean;
  is_verified: boolean;
  address_text: string | null;
}
