import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { useNavigation } from '@react-navigation/native';
import { useCartStore, computeCartSummary, selectBaskets } from '../stores/useCartStore';
import { C, rupees } from '../theme';

/** Floating cart bar. Shows only when the cart has items; counts baskets when there are several. */
export function CartBar() {
  const navigation = useNavigation<any>();
  const items = useCartStore((s) => s.items);
  const stores = useCartStore((s) => s.stores);
  if (!items.length) return null;
  const s = computeCartSummary(items);
  const baskets = selectBaskets(items, stores);
  const count = `${s.totalItems} ${s.totalItems === 1 ? 'item' : 'items'}`;
  const sub = baskets.length > 1 ? `${baskets.length} baskets · ${count}` : `${baskets[0]?.storeName ?? 'Shop'} · ${count}`;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <TouchableOpacity activeOpacity={0.9} style={styles.bar} onPress={() => navigation.navigate('Cart')} accessibilityRole="button" accessibilityLabel={`View cart, ${sub}, ${rupees(s.subtotalPaise)}`}>
        <View style={styles.badge}><Text style={styles.badgeText}>{baskets.length > 1 ? baskets.length : s.totalItems}</Text></View>
        <View style={styles.mid}>
          <Text style={styles.title}>View cart</Text>
          <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
        </View>
        <Text style={styles.total}>{rupees(s.subtotalPaise)}</Text>
        <Text style={styles.go}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', padding: 8, paddingRight: 16, borderRadius: 22, backgroundColor: C.ink, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  badge: { width: 44, height: 44, borderRadius: 16, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  mid: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15.5, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 12, color: '#B8B8B2', marginTop: 1, fontWeight: '600' },
  total: { fontSize: 16, fontWeight: '800', color: '#fff', marginRight: 6 },
  go: { fontSize: 26, color: '#fff', lineHeight: 28, fontWeight: '700' },
});
