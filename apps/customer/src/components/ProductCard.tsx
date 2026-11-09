/**
 * ProductCard — the BEVER product tile used on home rows, search and store pages.
 * Photo, veg mark, discount ribbon, ADD / stepper, price, savings, name, unit, shop, ETA.
 */
import React, { useCallback } from 'react';
import { Alert, Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { useCartStore } from '../stores/useCartStore';
import type { Product } from '../types/store';

const rupees = (paise: number) => `₹${Math.round(paise / 100)}`;

interface Props {
  product: Product;
  storeName: string;
  etaMinutes?: number | null;
  width: number;
  onOpen?: () => void;
  /** Hide the shop name line (when already inside that shop). */
  hideStore?: boolean;
}

export function ProductCard({ product, storeName, etaMinutes, width, onOpen, hideStore }: Props) {
  const qty = useCartStore((s) => s.items.find((i) => i.productId === product.id)?.quantity ?? 0);
  const addItem = useCartStore((s) => s.addItem);
  const clearCartAndAdd = useCartStore((s) => s.clearCartAndAdd);
  const inc = useCartStore((s) => s.incrementItem);
  const dec = useCartStore((s) => s.decrementItem);

  const hasDiscount = !!product.compare_at_price && product.compare_at_price > product.price;
  const off = hasDiscount ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100) : 0;
  const saved = hasDiscount ? product.compare_at_price! - product.price : 0;
  const lowStock = product.is_available && product.stock_qty != null && product.stock_qty <= 5;
  const imgH = Math.round(width * 0.92);

  const handleAdd = useCallback(() => {
    const store = { id: product.store_id, name: storeName };
    const r = addItem(product, store);
    if (r.kind === 'conflict') {
      Alert.alert('Start a new basket?', `Your basket has items from ${r.existingStoreName}. Add this from ${storeName} instead?`, [
        { text: 'Keep old basket', style: 'cancel' },
        { text: 'Start new', style: 'destructive', onPress: () => clearCartAndAdd(product, store) },
      ]);
    }
  }, [addItem, clearCartAndAdd, product, storeName]);

  return (
    <View style={[styles.card, { width }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={onOpen} style={[styles.media, { height: imgH }]} accessibilityLabel={`View ${product.name}`}>
        {product.image_url ? <Image source={{ uri: product.image_url }} style={styles.img} resizeMode="contain" /> : <Text style={styles.fallback}>🛍️</Text>}
        {hasDiscount ? (
          <View style={styles.ribbon}><Text style={styles.ribbonText}>{off}% OFF</Text></View>
        ) : null}
        <View style={styles.vegMark}><View style={styles.vegDot} /></View>
        {!product.is_available ? <View style={styles.veil}><Text style={styles.veilText}>Out of stock</Text></View> : null}
      </TouchableOpacity>

      <View style={[styles.addWrap, { top: imgH - 18 }]}>
        {product.is_available ? (
          qty === 0 ? (
            <TouchableOpacity style={styles.add} onPress={handleAdd} activeOpacity={0.85} accessibilityLabel={`Add ${product.name} to cart`}>
              <Text style={styles.addText}>ADD</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => dec(product.id)} accessibilityLabel={`Decrease ${product.name}`}><Text style={styles.stepText}>−</Text></TouchableOpacity>
              <Text style={styles.qty}>{qty}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => { if (product.stock_qty != null && qty >= product.stock_qty) return; inc(product.id); }} accessibilityLabel={`Increase ${product.name}`}><Text style={styles.stepText}>+</Text></TouchableOpacity>
            </View>
          )
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.unit} numberOfLines={1}>{product.unit || '1 pc'}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{rupees(product.price)}</Text>
          {hasDiscount ? <Text style={styles.mrp}>{rupees(product.compare_at_price!)}</Text> : null}
        </View>
        {hasDiscount ? <Text style={styles.save}>Save {rupees(saved)}</Text> : null}
        {lowStock ? <Text style={styles.low}>Only {product.stock_qty} left</Text> : null}
        <View style={styles.metaRow}>
          {etaMinutes != null ? <View style={styles.eta}><Text style={styles.etaText}>⚡ {etaMinutes} min</Text></View> : null}
          {!hideStore ? <Text style={styles.store} numberOfLines={1}>{storeName}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E3F1EA', overflow: 'hidden', shadowColor: '#064E3B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  media: { backgroundColor: '#F4FBF7', alignItems: 'center', justifyContent: 'center', padding: 8 },
  img: { width: '100%', height: '100%' },
  fallback: { fontSize: 40 },
  ribbon: { position: 'absolute', top: 0, left: 0, backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 4, borderBottomRightRadius: 12 },
  ribbonText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  vegMark: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: '#059669', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  vegDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' },
  veilText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  addWrap: { position: 'absolute', right: 8, alignItems: 'flex-end' },
  add: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#059669', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 7, minWidth: 64, alignItems: 'center' },
  addText: { color: '#059669', fontWeight: '800', fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', borderRadius: 10, overflow: 'hidden' },
  stepBtn: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  qty: { color: '#fff', fontWeight: '800', fontSize: 13, minWidth: 18, textAlign: 'center' },
  body: { paddingHorizontal: 10, paddingTop: 22, paddingBottom: 12, gap: 2 },
  unit: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  name: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 17, minHeight: 34 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  price: { fontSize: 16, fontWeight: '800', color: '#111827' },
  mrp: { fontSize: 11.5, color: '#9CA3AF', textDecorationLine: 'line-through' },
  save: { fontSize: 11, fontWeight: '800', color: '#047857' },
  low: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  eta: { backgroundColor: '#ECFDF5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  etaText: { fontSize: 10.5, fontWeight: '800', color: '#047857' },
  store: { flex: 1, fontSize: 10.5, color: '#6B7280', fontWeight: '600' },
});
