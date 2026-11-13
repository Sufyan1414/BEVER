/**
 * BEVER Customer App — Cart (multi-basket)
 *
 * One BASKET per shop. A grocery basket and an electronics basket are separate orders,
 * delivered by separate riders, each checked out on its own.
 */
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore, computeCartSummary, selectBaskets, basketKind, type Basket } from '../../stores/useCartStore';
import { FreeDeliveryProgress } from '../../components/FreeDeliveryProgress';
import { C, CATEGORY_STYLE, rupees } from '../../theme';

function BasketCard({ basket, onCheckout, onClear }: { basket: Basket; onCheckout: () => void; onClear: () => void }) {
  const inc = useCartStore((s) => s.incrementItem);
  const dec = useCartStore((s) => s.decrementItem);
  const remove = useCartStore((s) => s.removeItem);
  const sum = computeCartSummary(basket.items);
  const cs = CATEGORY_STYLE[basket.category ?? 'OTHER'] ?? CATEGORY_STYLE.OTHER!;
  return (
    <View style={s.basket}>
      <View style={s.basketHead}>
        <View style={[s.kindIcon, { backgroundColor: cs.bg }]}><Text style={{ fontSize: 20 }}>{cs.icon}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.kind}>{basketKind(basket.category).toUpperCase()}</Text>
          <Text style={s.shopName} numberOfLines={1}>{basket.storeName}</Text>
        </View>
        <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={`Clear ${basket.storeName} basket`}><Text style={s.clear}>Clear</Text></TouchableOpacity>
      </View>

      {basket.items.map((it) => (
        <View key={it.productId} style={s.line}>
          {it.productImageUrl ? <Image source={{ uri: it.productImageUrl }} style={s.thumb} resizeMode="contain" /> : <View style={[s.thumb, s.thumbFallback]}><Text style={{ fontSize: 22 }}>🛍️</Text></View>}
          <View style={{ flex: 1 }}>
            <Text style={s.itemName} numberOfLines={2}>{it.productName}</Text>
            <Text style={s.itemUnit}>{it.unit}</Text>
            <TouchableOpacity onPress={() => remove(it.productId)} accessibilityLabel={`Remove ${it.productName}`}><Text style={s.remove}>Remove</Text></TouchableOpacity>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <View style={s.stepper}>
              <TouchableOpacity style={s.stepBtn} onPress={() => dec(it.productId)} accessibilityLabel={`Decrease ${it.productName}`}><Text style={s.stepText}>−</Text></TouchableOpacity>
              <Text style={s.qty}>{it.quantity}</Text>
              <TouchableOpacity style={s.stepBtn} onPress={() => inc(it.productId)} accessibilityLabel={`Increase ${it.productName}`}><Text style={s.stepText}>+</Text></TouchableOpacity>
            </View>
            <Text style={s.lineTotal}>{rupees(it.unitPricePaise * it.quantity)}</Text>
          </View>
        </View>
      ))}

      <FreeDeliveryProgress subtotalPaise={sum.subtotalPaise} style={{ marginTop: 10 }} />
      {sum.savingsPaise > 0 ? <Text style={s.saving}>You save {rupees(sum.savingsPaise)} on this basket</Text> : null}

      <View style={s.foot}>
        <View>
          <Text style={s.footLabel}>{sum.totalItems} {sum.totalItems === 1 ? 'item' : 'items'}</Text>
          <Text style={s.footTotal}>{rupees(sum.subtotalPaise)}</Text>
        </View>
        <TouchableOpacity style={s.checkout} onPress={onCheckout} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`Checkout ${basket.storeName} basket`}>
          <Text style={s.checkoutText}>Checkout</Text>
          <Text style={s.checkoutArrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function CartScreen() {
  const navigation = useNavigation<any>();
  const { session } = useAuthStore();
  const items = useCartStore((st) => st.items);
  const stores = useCartStore((st) => st.stores);
  const clearBasket = useCartStore((st) => st.clearBasket);
  const clearCart = useCartStore((st) => st.clearCart);
  const setCheckoutStore = useCartStore((st) => st.setCheckoutStore);
  const requestCheckout = useCartStore((st) => st.requestCheckout);
  const baskets = selectBaskets(items, stores);
  const [open, setOpen] = useState(true);

  const checkout = (storeId: string) => {
    setCheckoutStore(storeId);
    if (!session) { requestCheckout(); navigation.navigate('Auth'); return; }
    navigation.navigate('Checkout');
  };
  const confirmClear = (b: Basket) => Alert.alert(`Clear ${b.storeName} basket?`, 'Items in this basket will be removed. Your other baskets stay as they are.', [
    { text: 'Keep', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: () => clearBasket(b.storeId) },
  ]);
  const confirmClearAll = () => Alert.alert('Empty your whole cart?', `This removes all ${baskets.length} baskets.`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Empty cart', style: 'destructive', onPress: () => clearCart() },
  ]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={s.round} accessibilityLabel="Back" accessibilityRole="button"><Text style={s.roundText}>‹</Text></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Your cart</Text>
          {baskets.length > 0 ? <Text style={s.sub}>{baskets.length} {baskets.length === 1 ? 'basket' : 'baskets'} · {computeCartSummary(items).totalItems} items</Text> : null}
        </View>
        {baskets.length > 1 ? <TouchableOpacity onPress={confirmClearAll}><Text style={s.clear}>Empty all</Text></TouchableOpacity> : null}
      </View>

      {baskets.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}><Text style={{ fontSize: 44 }}>🛒</Text></View>
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptyBody}>Add something from any shop near you. Groceries, electronics, medicines — each shop gets its own basket.</Text>
          <TouchableOpacity style={s.cta} onPress={() => navigation.navigate('Home')}><Text style={s.ctaText}>Start shopping</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {baskets.length > 1 && open ? (
            <View style={s.note}>
              <View style={{ flex: 1 }}>
                <Text style={s.noteTitle}>{baskets.length} baskets, {baskets.length} deliveries</Text>
                <Text style={s.noteBody}>Different shops send their own rider, so each basket is checked out separately. Pick any one to continue — the others wait here.</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Dismiss"><Text style={{ fontSize: 16, color: C.sky }}>✕</Text></TouchableOpacity>
            </View>
          ) : null}
          {baskets.map((b) => <BasketCard key={b.storeId} basket={b} onCheckout={() => checkout(b.storeId)} onClear={() => confirmClear(b)} />)}
          <TouchableOpacity style={s.more} onPress={() => navigation.navigate('Home')} accessibilityRole="button"><Text style={s.moreText}>+ Add from another shop</Text></TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.paper, borderBottomWidth: 1, borderBottomColor: C.line },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' },
  roundText: { fontSize: 28, color: C.ink, marginTop: -4, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: C.muted, marginTop: 1, fontWeight: '600' },
  clear: { fontSize: 13, fontWeight: '800', color: C.coral },
  note: { flexDirection: 'row', gap: 10, backgroundColor: C.skySoft, borderRadius: 18, padding: 14, marginBottom: 14 },
  noteTitle: { fontSize: 14, fontWeight: '800', color: '#1D4ED8' },
  noteBody: { fontSize: 12.5, color: '#1E40AF', marginTop: 3, lineHeight: 18 },
  basket: { backgroundColor: C.paper, borderRadius: 24, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.line },
  basketHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  kindIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kind: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: C.muted },
  shopName: { fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.canvas },
  thumb: { width: 60, height: 60, borderRadius: 14, backgroundColor: C.canvas },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 18 },
  itemUnit: { fontSize: 12, color: C.muted, marginTop: 2 },
  remove: { fontSize: 11.5, fontWeight: '700', color: C.faint, marginTop: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.ink, borderRadius: 10, height: 34 },
  stepBtn: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  qty: { color: '#fff', fontWeight: '800', minWidth: 18, textAlign: 'center' },
  lineTotal: { fontSize: 14, fontWeight: '800', color: C.ink },
  saving: { fontSize: 12.5, fontWeight: '800', color: C.mint, marginTop: 10 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.canvas },
  footLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  footTotal: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  checkout: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 16, paddingHorizontal: 22, height: 52 },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  checkoutArrow: { color: '#fff', fontSize: 18, fontWeight: '800' },
  more: { alignItems: 'center', paddingVertical: 14, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.faint },
  moreText: { fontSize: 14, fontWeight: '800', color: C.ink2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  emptyIcon: { width: 96, height: 96, borderRadius: 32, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.line },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: C.ink, marginTop: 18 },
  emptyBody: { fontSize: 13.5, color: C.muted, textAlign: 'center', lineHeight: 20, marginTop: 6 },
  cta: { marginTop: 22, backgroundColor: C.ink, borderRadius: 16, paddingHorizontal: 30, height: 52, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
