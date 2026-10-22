import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useCartStore, computeCartSummary } from '../stores/useCartStore';

/**
 * Floating "glass" cart bar. Shows only when the cart has items.
 * Frosted look: translucent white, light border, soft mint shadow, and a real
 * backdrop blur where the platform supports it (web). Native uses the translucent layer.
 */
export function CartBar() {
  const navigation = useNavigation<any>();
  const { items, storeName } = useCartStore();
  if (!items.length) return null;
  const s = computeCartSummary(items);
  const rupees = `₹${Math.round(s.subtotalPaise / 100)}`;
  const count = `${s.totalItems} ${s.totalItems === 1 ? 'item' : 'items'}`;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.bar, glass]}
        onPress={() => navigation.navigate('Cart')}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${count}, ${rupees}`}
      >
        <BlurView intensity={45} tint="light" style={styles.fill} {...({ experimentalBlurMethod: 'dimezisBlurView' } as object)} />
        <View style={styles.badge}><Text style={styles.badgeText}>{s.totalItems}</Text></View>
        <View style={styles.mid}>
          <Text style={styles.title}>View cart</Text>
          <Text style={styles.sub} numberOfLines={1}>{storeName ?? count} · {rupees}</Text>
        </View>
        <View style={styles.go}><Text style={styles.goText}>›</Text></View>
      </TouchableOpacity>
    </View>
  );
}

const glass = (Platform.OS === 'web'
  ? ({ backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)' } as unknown as ViewStyle)
  : {}) satisfies ViewStyle;

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  bar: {
    flexDirection: 'row', alignItems: 'center', padding: 8, paddingRight: 10, borderRadius: 22,
    backgroundColor: 'rgba(236,253,245,0.55)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#047857', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  badge: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#064E3B', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  mid: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '900', color: '#064E3B' },
  sub: { fontSize: 12, color: '#047857', marginTop: 1, fontWeight: '600' },
  go: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  goText: { fontSize: 24, color: '#FFFFFF', lineHeight: 28, fontWeight: '800' },
});
