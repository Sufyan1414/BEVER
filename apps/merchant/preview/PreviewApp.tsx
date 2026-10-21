/**
 * DEV-ONLY visual preview harness. It is never imported by the shipped app.
 * CI swaps it in as the entry point to screenshot the real screens with SAMPLE data.
 * Nothing here is shown to merchants.
 */
import React from 'react';
import { View } from 'react-native';
import { OrdersScreen } from '../src/screens/OrdersScreen';
import { OrderDetailScreen } from '../src/screens/OrderDetailScreen';
import { CatalogueScreen } from '../src/screens/CatalogueScreen';
import { StoreScreen } from '../src/screens/StoreScreen';
import { LoginScreen } from '../src/screens/LoginScreen';
import { AddProductSheet, PriceSheet, RejectSheet } from '../src/components/sheets';
import { Banner, EmptyState } from '../src/components/ui';
import type { Order, Product, Store } from '../src/lib/types';

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60000).toISOString();

const orders: Order[] = [
  { id: 'o1', order_number: 'BVR-20261022-0007', status: 'PENDING', payment_method: 'COD', payment_status: 'PENDING', items_total: 14800, delivery_fee: 2700, total_amount: 17500, special_instructions: 'Please pack the eggs separately.', rejection_reason: null, created_at: ago(7),
    order_items: [
      { id: 'i1', product_name_snapshot: 'Toor Dal', unit_price: 15500, quantity: 1, total_price: 15500, unit_snapshot: '1 kg' },
      { id: 'i2', product_name_snapshot: 'Farm Eggs', unit_price: 8400, quantity: 2, total_price: 16800, unit_snapshot: '12 pcs' },
    ] },
  { id: 'o2', order_number: 'BVR-20261022-0006', status: 'PENDING', payment_method: 'COD', payment_status: 'PENDING', items_total: 25600, delivery_fee: 0, total_amount: 25600, special_instructions: null, rejection_reason: null, created_at: ago(1),
    order_items: [{ id: 'i3', product_name_snapshot: 'Basmati Rice', unit_price: 12800, quantity: 2, total_price: 25600, unit_snapshot: '5 kg' }] },
  { id: 'o3', order_number: 'BVR-20261022-0005', status: 'PREPARING', payment_method: 'COD', payment_status: 'PENDING', items_total: 9900, delivery_fee: 2700, total_amount: 12600, special_instructions: null, rejection_reason: null, created_at: ago(22),
    order_items: [{ id: 'i4', product_name_snapshot: 'Amul Butter', unit_price: 5900, quantity: 1, total_price: 5900, unit_snapshot: '500 g' }, { id: 'i5', product_name_snapshot: 'Bread', unit_price: 4000, quantity: 1, total_price: 4000, unit_snapshot: '400 g' }] },
  { id: 'o4', order_number: 'BVR-20261022-0004', status: 'DELIVERED', payment_method: 'COD', payment_status: 'PAID', items_total: 31000, delivery_fee: 0, total_amount: 31000, special_instructions: null, rejection_reason: null, created_at: ago(95),
    order_items: [{ id: 'i6', product_name_snapshot: 'Sunflower Oil', unit_price: 15500, quantity: 2, total_price: 31000, unit_snapshot: '1 L' }] },
];

const products: Product[] = [
  { id: 'p1', name: 'Toor Dal', unit: '1 kg', price: 15500, is_available: true, is_active: true, updated_at: ago(60 * 24 * 2) },
  { id: 'p2', name: 'Farm Eggs', unit: '12 pcs', price: 8400, is_available: true, is_active: true, updated_at: ago(30) },
  { id: 'p3', name: 'Basmati Rice (Premium Long Grain, Aged)', unit: '5 kg', price: 64000, is_available: false, is_active: true, updated_at: ago(60 * 24 * 11) },
  { id: 'p4', name: 'Amul Butter', unit: '500 g', price: 29500, is_available: true, is_active: true, updated_at: ago(60 * 5) },
];

const store: Store = { id: 's1', name: 'Sharma Kirana & General Store', category: 'grocery', is_open: true, is_verified: true, address_text: 'Shop 4, Gulmandi Road, Chhatrapati Sambhajinagar, Maharashtra 431001' };
const noop = () => {};

const view = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') || 'orders';

export default function PreviewApp() {
  const frame = { flex: 1, backgroundColor: '#FFFBF5' } as const;
  let body: React.ReactNode;
  switch (view) {
    case 'detail':
      body = <OrderDetailScreen order={orders[0] as Order} now={now} busy={false} onBack={noop} onAdvance={noop} onReject={noop} />;
      break;
    case 'catalogue':
      body = <CatalogueScreen products={products} loading={false} refreshing={false} now={now} busyIds={new Set()} onRefresh={noop} onToggle={noop} onEditPrice={noop} onAdd={noop} />;
      break;
    case 'store':
      body = <StoreScreen store={store} busy={false} activeOrders={1} onToggleOpen={noop} onSignOut={noop} />;
      break;
    case 'login':
      body = <LoginScreen />;
      break;
    case 'empty':
      body = <View style={{ padding: 16 }}><OrdersScreen orders={[]} loading={false} refreshing={false} now={now} busyId={null} onRefresh={noop} onOpen={noop} onAccept={noop} onReject={noop} /><Banner message="No internet connection. Check your network and try again." tone="bad" onRetry={noop} /><EmptyState icon="cube-outline" title="No products yet" body="Add the items you sell." /></View>;
      break;
    case 'reject':
      body = <><OrdersScreen orders={orders} loading={false} refreshing={false} now={now} busyId={null} onRefresh={noop} onOpen={noop} onAccept={noop} onReject={noop} /><RejectSheet visible orderNumber="#BVR-20261022-0007" busy={false} onClose={noop} onConfirm={noop} /></>;
      break;
    case 'price':
      body = <><CatalogueScreen products={products} loading={false} refreshing={false} now={now} busyIds={new Set()} onRefresh={noop} onToggle={noop} onEditPrice={noop} onAdd={noop} /><PriceSheet visible productName="Toor Dal" currentPaise={15500} busy={false} onClose={noop} onSave={noop} /></>;
      break;
    case 'add':
      body = <><CatalogueScreen products={products} loading={false} refreshing={false} now={now} busyIds={new Set()} onRefresh={noop} onToggle={noop} onEditPrice={noop} onAdd={noop} /><AddProductSheet visible busy={false} onClose={noop} onSave={noop} /></>;
      break;
    default:
      body = <OrdersScreen orders={orders} loading={false} refreshing={false} now={now} busyId={null} onRefresh={noop} onOpen={noop} onAccept={noop} onReject={noop} />;
  }
  return <View style={frame}>{body}</View>;
}
