import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../stores/useCartStore';
import type { Bundle } from '../services/taste';
import { C, rupees } from '../theme';

interface Props {
  bundle: Bundle | null;
  store: { id: string; name: string; category?: string; etaMinutes?: number | null } | null;
  onClose: () => void;
  onAdded: () => void;
}

/** A shop's ready-made basket (breakfast, snacks, dinner). One tap adds every item. */
export function BundleSheet({ bundle, store, onClose, onAdded }: Props) {
  const addItem = useCartStore((s) => s.addItem);
  if (!bundle || !store) return null;
  const count = bundle.items.reduce((n, i) => n + i.quantity, 0);

  const addAll = () => {
    for (const it of bundle.items) {
      for (let k = 0; k < it.quantity; k++) addItem(it.product, { id: store.id, name: store.name, ...(store.category ? { category: store.category } : {}) });
    }
    onAdded();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} transparent>
      <View style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} accessibilityLabel="Close basket" />
        <SafeAreaView edges={['bottom']} style={s.sheet}>
          <View style={s.grab} />
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.kicker}>{store.name.toUpperCase()}</Text>
              <Text style={s.title}>{bundle.name}</Text>
              {bundle.description ? <Text style={s.desc}>{bundle.description}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} style={s.close} accessibilityLabel="Close"><Text style={{ fontSize: 16, fontWeight: '700', color: C.ink }}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {bundle.items.map((it) => (
              <View key={it.product.id} style={s.row}>
                {it.product.image_url ? <Image source={{ uri: it.product.image_url }} style={s.img} resizeMode="contain" /> : <View style={[s.img, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 22 }}>🛍️</Text></View>}
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={2}>{it.product.name}</Text>
                  <Text style={s.unit}>{it.product.unit}{it.quantity > 1 ? ` × ${it.quantity}` : ''}</Text>
                </View>
                <Text style={s.price}>{rupees(it.product.price * it.quantity)}</Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.cta} activeOpacity={0.9} onPress={addAll} accessibilityRole="button">
            <Text style={s.ctaText}>Add all {count} items</Text>
            <Text style={s.ctaText}>{rupees(bundle.totalPaise)}</Text>
          </TouchableOpacity>
          <Text style={s.note}>You can change quantities in the cart. Cash on delivery.</Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  kicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: C.muted },
  title: { fontSize: 22, fontWeight: '800', color: C.ink, letterSpacing: -0.4, marginTop: 2 },
  desc: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 18 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.canvas },
  img: { width: 54, height: 54, borderRadius: 14, backgroundColor: C.canvas },
  name: { fontSize: 14, fontWeight: '700', color: C.ink },
  unit: { fontSize: 12, color: C.muted, marginTop: 2 },
  price: { fontSize: 14, fontWeight: '800', color: C.ink },
  cta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.ink, borderRadius: 18, paddingHorizontal: 20, height: 56, marginTop: 14 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  note: { fontSize: 11.5, color: C.muted, textAlign: 'center', marginVertical: 10 },
});
