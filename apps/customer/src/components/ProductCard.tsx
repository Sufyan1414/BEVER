/**
 * ProductCard — the BEVER product tile used on home rows, search and store pages.
 * Photo, discount tag, heart, ADD / stepper, price, savings, name, unit, shop, ETA.
 */
import React, { useCallback } from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { useCartStore } from '../stores/useCartStore';
import { useFavouritesStore } from '../stores/useFavouritesStore';
import type { Product } from '../types/store';
import { C, rupees } from '../theme';

interface Props {
  product: Product;
  storeName: string;
  storeCategory?: string | undefined;
  etaMinutes?: number | null | undefined;
  width: number;
  onOpen?: (() => void) | undefined;
  /** Hide the shop name line (when already inside that shop). */
  hideStore?: boolean | undefined;
}

export function ProductCard({ product, storeName, storeCategory, etaMinutes, width, onOpen, hideStore }: Props) {
  const qty = useCartStore((s) => s.items.find((i) => i.productId === product.id)?.quantity ?? 0);
  const addItem = useCartStore((s) => s.addItem);
  const inc = useCartStore((s) => s.incrementItem);
  const dec = useCartStore((s) => s.decrementItem);

  const isFav = useFavouritesStore((st) => st.ids.includes(product.id));
  const toggleFav = useFavouritesStore((st) => st.toggle);
  const hasDiscount = !!product.compare_at_price && product.compare_at_price > product.price;
  const off = hasDiscount ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100) : 0;
  const saved = hasDiscount ? product.compare_at_price! - product.price : 0;
  const lowStock = product.is_available && product.stock_qty != null && product.stock_qty <= 5;
  const imgH = Math.round(width * 0.92);

  // Different shops never clash: a new shop simply opens its own basket.
  const handleAdd = useCallback(() => {
    addItem(product, { id: product.store_id, name: storeName, ...(storeCategory ? { category: storeCategory } : {}) });
  }, [addItem, product, storeName, storeCategory]);

  return (
    <View style={[styles.card, { width }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={onOpen} style={[styles.media, { height: imgH }]} accessibilityLabel={`View ${product.name}`}>
        {product.image_url ? <Image source={{ uri: product.image_url }} style={styles.img} resizeMode="contain" /> : <Text style={styles.fallback}>🛍️</Text>}
        {hasDiscount ? <View style={styles.ribbon}><Text style={styles.ribbonText}>{off}% OFF</Text></View> : null}
        <TouchableOpacity style={styles.heart} onPress={() => toggleFav(product.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={isFav ? 'Remove from favourites' : 'Save to favourites'}>
          <Text style={[styles.heartText, isFav && styles.heartOn]}>{isFav ? '♥' : '♡'}</Text>
        </TouchableOpacity>
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

      <TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={styles.body}>
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
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.paper, borderRadius: 20, borderWidth: 1, borderColor: C.line, overflow: 'hidden' },
  media: { backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', padding: 8 },
  img: { width: '100%', height: '100%' },
  fallback: { fontSize: 40 },
  ribbon: { position: 'absolute', top: 8, left: 8, backgroundColor: C.ink, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  ribbonText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  heart: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  heartText: { fontSize: 17, color: C.muted, marginTop: -1 },
  heartOn: { color: C.coral },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.78)', alignItems: 'center', justifyContent: 'center' },
  veilText: { fontSize: 12, fontWeight: '800', color: C.muted },
  addWrap: { position: 'absolute', right: 8, alignItems: 'flex-end' },
  add: { backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.ink, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 7, minWidth: 64, alignItems: 'center' },
  addText: { color: C.ink, fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.ink, borderRadius: 10, overflow: 'hidden' },
  stepBtn: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  qty: { color: '#fff', fontWeight: '800', fontSize: 13, minWidth: 18, textAlign: 'center' },
  body: { paddingHorizontal: 10, paddingTop: 22, paddingBottom: 12, gap: 2 },
  unit: { fontSize: 11, color: C.muted, fontWeight: '600' },
  name: { fontSize: 13, fontWeight: '700', color: C.ink, lineHeight: 17, minHeight: 34 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  price: { fontSize: 16, fontWeight: '800', color: C.ink },
  mrp: { fontSize: 11.5, color: C.faint, textDecorationLine: 'line-through' },
  save: { fontSize: 11, fontWeight: '800', color: C.mint },
  low: { fontSize: 11, fontWeight: '700', color: '#B45309' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  eta: { backgroundColor: C.canvas, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  etaText: { fontSize: 10.5, fontWeight: '800', color: C.ink2 },
  store: { flex: 1, fontSize: 10.5, color: C.muted, fontWeight: '600' },
});
