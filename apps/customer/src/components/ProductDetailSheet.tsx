import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Product } from '../types/store';

const rupees = (paise: number) => '₹' + Math.round(paise / 100);

interface Props {
  product: Product | null;
  qty: number;
  storeName: string;
  etaMinutes?: number | null | undefined;
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
  onClose: () => void;
}

/** Full-screen product page: big picture, price and savings, sticky add bar. */
export function ProductDetailSheet({ product, qty, storeName, etaMinutes, onAdd, onInc, onDec, onClose }: Props) {
  if (!product) return null;
  const hasDiscount = !!product.compare_at_price && product.compare_at_price > product.price;
  const saved = hasDiscount ? product.compare_at_price! - product.price : 0;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={s.hero}>
            {product.image_url ? (
              <Image source={{ uri: product.image_url }} style={s.heroImg} resizeMode="cover" />
            ) : (
              <View style={[s.heroImg, s.heroFallback]}><Text style={{ fontSize: 80 }}>🛍️</Text></View>
            )}
            <TouchableOpacity style={s.close} onPress={onClose} accessibilityLabel="Close product" accessibilityRole="button">
              <Text style={s.closeText}>⌄</Text>
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <View style={s.chipsRow}>
              {etaMinutes ? <View style={s.chip}><Text style={s.chipText}>⏱ {etaMinutes} mins</Text></View> : null}
              {!product.is_available ? <View style={[s.chip, { backgroundColor: '#FEE2E2' }]}><Text style={[s.chipText, { color: '#991B1B' }]}>Out of stock</Text></View> : null}
            </View>
            <Text style={s.name}>{product.name}</Text>
            {product.unit ? <Text style={s.unit}>{product.unit}</Text> : null}
            <View style={s.priceRow}>
              <Text style={s.price}>{rupees(product.price)}</Text>
              {hasDiscount ? <Text style={s.mrp}>MRP {rupees(product.compare_at_price!)}</Text> : null}
              {hasDiscount ? <View style={s.saveTag}><Text style={s.saveText}>Save {rupees(saved)}</Text></View> : null}
            </View>
            <Text style={s.tax}>Inclusive of all taxes</Text>
          </View>

          {product.description ? (
            <View style={s.card}>
              <Text style={s.section}>About this item</Text>
              <Text style={s.desc}>{product.description}</Text>
            </View>
          ) : null}

          <View style={s.card}>
            <Text style={s.section}>Sold by</Text>
            <Text style={s.desc}>{storeName}</Text>
            <Text style={[s.desc, { marginTop: 6 }]}>Pay cash on delivery. The delivery fee and final total are confirmed when you place the order.</Text>
          </View>
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={s.bar}>
          <View style={{ flex: 1 }}>
            {product.unit ? <Text style={s.barUnit}>{product.unit}</Text> : null}
            <Text style={s.barPrice}>{rupees(product.price)}{hasDiscount ? <Text style={s.barMrp}>  {rupees(product.compare_at_price!)}</Text> : null}</Text>
            <Text style={s.tax}>Inclusive of all taxes</Text>
          </View>
          {!product.is_available ? (
            <View style={[s.addBtn, { backgroundColor: '#D6D3D1' }]}><Text style={s.addText}>Unavailable</Text></View>
          ) : qty === 0 ? (
            <TouchableOpacity style={s.addBtn} onPress={onAdd} accessibilityRole="button"><Text style={s.addText}>Add to cart</Text></TouchableOpacity>
          ) : (
            <View style={[s.addBtn, s.stepper]}>
              <TouchableOpacity onPress={onDec} style={s.stepBtn} accessibilityLabel="Decrease"><Text style={s.stepText}>−</Text></TouchableOpacity>
              <Text style={s.qty}>{qty}</Text>
              <TouchableOpacity onPress={onInc} style={s.stepBtn} accessibilityLabel="Increase"><Text style={s.stepText}>+</Text></TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FBF7' },
  hero: { backgroundColor: '#ECFDF5' },
  heroImg: { width: '100%', height: 340 },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  close: { position: 'absolute', top: 14, left: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 26, color: '#064E3B', marginTop: -6, fontWeight: '800' },
  card: { backgroundColor: '#fff', marginHorizontal: 14, marginTop: 12, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#D1FAE5' },
  chipsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '800', color: '#047857' },
  name: { fontSize: 22, fontWeight: '900', color: '#064E3B', lineHeight: 28 },
  unit: { fontSize: 14, color: '#57534E', marginTop: 4, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 10 },
  price: { fontSize: 28, fontWeight: '900', color: '#064E3B' },
  mrp: { fontSize: 14, color: '#A8A29E', textDecorationLine: 'line-through' },
  saveTag: { backgroundColor: '#FFF7E6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  saveText: { fontSize: 11, fontWeight: '900', color: '#B45309' },
  tax: { fontSize: 11, color: '#78716C', marginTop: 4 },
  section: { fontSize: 16, fontWeight: '900', color: '#064E3B', marginBottom: 6 },
  desc: { fontSize: 14, color: '#44403C', lineHeight: 21 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#D1FAE5' },
  barUnit: { fontSize: 14, fontWeight: '800', color: '#1C1917' },
  barPrice: { fontSize: 20, fontWeight: '900', color: '#064E3B' },
  barMrp: { fontSize: 13, fontWeight: '600', color: '#A8A29E', textDecorationLine: 'line-through' },
  addBtn: { minWidth: 168, height: 54, borderRadius: 16, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  addText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  stepper: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  stepBtn: { width: 48, height: 54, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  qty: { color: '#fff', fontSize: 18, fontWeight: '900', minWidth: 28, textAlign: 'center' },
});
