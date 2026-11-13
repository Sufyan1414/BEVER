import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { Product } from '../types/store';
import { useCartStore, computeCartSummary } from '../stores/useCartStore';
import { useFavouritesStore } from '../stores/useFavouritesStore';
import { C, rupees } from '../theme';

export interface SheetStore { id: string; name: string; category?: string; etaMinutes?: number | null }

interface Props {
  product: Product | null;
  store: SheetStore | null;
  onClose: () => void;
  /** Shown as a "Visit shop" row; omit when already inside that shop. */
  onViewShop?: (() => void) | undefined;
}

/** Product page: big picture, price and savings, sticky add bar. Works from any screen. */
export function ProductDetailSheet({ product, store, onClose, onViewShop }: Props) {
  const navigation = useNavigation<any>();
  const items = useCartStore((st) => st.items);
  const addItem = useCartStore((st) => st.addItem);
  const inc = useCartStore((st) => st.incrementItem);
  const dec = useCartStore((st) => st.decrementItem);
  const isFav = useFavouritesStore((st) => (product ? st.ids.includes(product.id) : false));
  const toggleFav = useFavouritesStore((st) => st.toggle);
  if (!product || !store) return null;

  const qty = items.find((i) => i.productId === product.id)?.quantity ?? 0;
  const cart = computeCartSummary(items);
  const hasDiscount = !!product.compare_at_price && product.compare_at_price > product.price;
  const off = hasDiscount ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100) : 0;
  const saved = hasDiscount ? product.compare_at_price! - product.price : 0;
  const atLimit = product.stock_qty != null && qty >= product.stock_qty;
  const add = () => { addItem(product, { id: store.id, name: store.name, ...(store.category ? { category: store.category } : {}) }); };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.topBar}>
          <TouchableOpacity style={s.roundBtn} onPress={onClose} accessibilityLabel="Close product" accessibilityRole="button"><Text style={s.roundText}>✕</Text></TouchableOpacity>
          <TouchableOpacity style={s.roundBtn} onPress={() => toggleFav(product.id)} accessibilityLabel={isFav ? 'Remove from favourites' : 'Save to favourites'}>
            <Text style={[s.roundText, isFav && { color: C.coral }]}>{isFav ? '♥' : '♡'}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            {product.image_url ? <Image source={{ uri: product.image_url }} style={s.heroImg} resizeMode="contain" /> : <Text style={{ fontSize: 84 }}>🛍️</Text>}
            {hasDiscount ? <View style={s.offTag}><Text style={s.offText}>{off}% OFF</Text></View> : null}
          </View>

          <View style={s.body}>
            <View style={s.chipsRow}>
              {store.etaMinutes ? <View style={s.chip}><Text style={s.chipText}>⚡ {store.etaMinutes} min</Text></View> : null}
              {product.is_available ? <View style={[s.chip, { backgroundColor: C.mintSoft }]}><Text style={[s.chipText, { color: '#047857' }]}>In stock</Text></View> : <View style={[s.chip, { backgroundColor: C.coralSoft }]}><Text style={[s.chipText, { color: '#B42318' }]}>Out of stock</Text></View>}
              {product.is_available && product.stock_qty != null && product.stock_qty <= 5 ? <View style={[s.chip, { backgroundColor: C.saffronSoft }]}><Text style={[s.chipText, { color: '#B45309' }]}>Only {product.stock_qty} left</Text></View> : null}
            </View>
            <Text style={s.name}>{product.name}</Text>
            {product.unit ? <Text style={s.unit}>{product.unit}</Text> : null}
            <View style={s.priceRow}>
              <Text style={s.price}>{rupees(product.price)}</Text>
              {hasDiscount ? <Text style={s.mrp}>{rupees(product.compare_at_price!)}</Text> : null}
              {hasDiscount ? <View style={s.saveTag}><Text style={s.saveText}>You save {rupees(saved)}</Text></View> : null}
            </View>
            <Text style={s.tax}>Inclusive of all taxes</Text>
          </View>

          {product.description ? (
            <View style={s.block}>
              <Text style={s.blockTitle}>About this item</Text>
              <Text style={s.desc}>{product.description}</Text>
            </View>
          ) : null}

          <TouchableOpacity activeOpacity={onViewShop ? 0.8 : 1} onPress={onViewShop} disabled={!onViewShop} style={s.shopRow} accessibilityRole={onViewShop ? 'button' : 'text'}>
            <View style={s.shopDot}><Text style={{ fontSize: 18 }}>🏪</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.shopLabel}>SOLD BY</Text>
              <Text style={s.shopName} numberOfLines={1}>{store.name}</Text>
            </View>
            {onViewShop ? <Text style={s.shopGo}>Visit shop ›</Text> : null}
          </TouchableOpacity>

          <View style={s.assure}>
            {[['💵', 'Cash on delivery'], ['⚡', 'Delivered in minutes'], ['↩︎', 'Easy returns']].map(([i, t]) => (
              <View key={t} style={s.assureItem}><Text style={{ fontSize: 18 }}>{i}</Text><Text style={s.assureText}>{t}</Text></View>
            ))}
          </View>
        </ScrollView>

        {cart.totalItems > 0 ? (
          <TouchableOpacity activeOpacity={0.9} style={s.cartStrip} onPress={() => { onClose(); navigation.navigate('Cart'); }} accessibilityRole="button" accessibilityLabel="View cart">
            <Text style={s.cartStripText}>{cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'} in cart · {rupees(cart.subtotalPaise)}</Text>
            <Text style={s.cartStripGo}>View cart ›</Text>
          </TouchableOpacity>
        ) : null}
        <SafeAreaView edges={['bottom']} style={s.bar}>
          <View style={{ flex: 1 }}>
            <Text style={s.barPrice}>{rupees(product.price)}{hasDiscount ? <Text style={s.barMrp}>  {rupees(product.compare_at_price!)}</Text> : null}</Text>
            {product.unit ? <Text style={s.barUnit}>{product.unit}</Text> : null}
          </View>
          {!product.is_available ? (
            <View style={[s.addBtn, { backgroundColor: C.line }]}><Text style={[s.addText, { color: C.muted }]}>Unavailable</Text></View>
          ) : qty === 0 ? (
            <TouchableOpacity style={s.addBtn} onPress={add} accessibilityRole="button"><Text style={s.addText}>Add to cart</Text></TouchableOpacity>
          ) : (
            <View style={[s.addBtn, s.stepper]}>
              <TouchableOpacity onPress={() => dec(product.id)} style={s.stepBtn} accessibilityLabel="Decrease"><Text style={s.stepText}>−</Text></TouchableOpacity>
              <Text style={s.qty}>{qty}</Text>
              <TouchableOpacity onPress={() => { if (!atLimit) inc(product.id); }} style={s.stepBtn} accessibilityLabel="Increase"><Text style={[s.stepText, atLimit && { opacity: 0.35 }]}>+</Text></TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  roundBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' },
  roundText: { fontSize: 18, color: C.ink, fontWeight: '700' },
  hero: { height: 320, backgroundColor: C.canvas, marginHorizontal: 16, borderRadius: 28, alignItems: 'center', justifyContent: 'center', padding: 18 },
  heroImg: { width: '100%', height: '100%' },
  offTag: { position: 'absolute', left: 14, top: 14, backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  offText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  body: { paddingHorizontal: 20, paddingTop: 18 },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  chip: { backgroundColor: C.canvas, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '800', color: C.ink2 },
  name: { fontSize: 24, fontWeight: '800', color: C.ink, lineHeight: 30, letterSpacing: -0.3 },
  unit: { fontSize: 14, color: C.muted, marginTop: 4, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 10 },
  price: { fontSize: 30, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  mrp: { fontSize: 15, color: C.faint, textDecorationLine: 'line-through' },
  saveTag: { backgroundColor: C.saffronSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  saveText: { fontSize: 11, fontWeight: '800', color: '#B45309' },
  tax: { fontSize: 11.5, color: C.muted, marginTop: 4 },
  block: { paddingHorizontal: 20, marginTop: 22 },
  blockTitle: { fontSize: 15, fontWeight: '800', color: C.ink, marginBottom: 6 },
  desc: { fontSize: 14, color: C.ink2, lineHeight: 21 },
  shopRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 22, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: C.line },
  shopDot: { width: 42, height: 42, borderRadius: 14, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  shopLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: C.faint },
  shopName: { fontSize: 15, fontWeight: '800', color: C.ink, marginTop: 1 },
  shopGo: { fontSize: 13, fontWeight: '800', color: C.ink },
  assure: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 8 },
  assureItem: { flex: 1, alignItems: 'center', backgroundColor: C.canvas, borderRadius: 16, paddingVertical: 12, gap: 4 },
  assureText: { fontSize: 11, fontWeight: '700', color: C.ink2, textAlign: 'center' },
  cartStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.ink, paddingHorizontal: 18, paddingVertical: 13 },
  cartStripText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cartStripGo: { color: '#fff', fontSize: 14, fontWeight: '800' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6, backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line },
  barUnit: { fontSize: 12, fontWeight: '600', color: C.muted },
  barPrice: { fontSize: 21, fontWeight: '800', color: C.ink },
  barMrp: { fontSize: 13, fontWeight: '600', color: C.faint, textDecorationLine: 'line-through' },
  addBtn: { minWidth: 168, height: 54, borderRadius: 16, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  addText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  stepBtn: { width: 48, height: 54, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  qty: { color: '#fff', fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
});
