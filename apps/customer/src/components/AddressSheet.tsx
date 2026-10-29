import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { fetchMyAddresses, setDefaultAddress } from '../services/address';
import type { CustomerAddress } from '../types/address';

interface Props {
  visible: boolean;
  selectedId: string | undefined;
  onClose: () => void;
  onSelect: (a: CustomerAddress) => void;
  onAddNew: () => void;
}

/** Bottom sheet: pick a saved delivery address or add a new one. */
export function AddressSheet({ visible, selectedId, onClose, onSelect, onAddNew }: Props) {
  const [list, setList] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    setLoading(true); setErr(null);
    fetchMyAddresses().then((r) => { if (live) setList(r); }).catch((e: any) => { if (live) setErr(e?.message ?? 'Could not load your addresses.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [visible]);

  const pick = async (a: CustomerAddress) => {
    setBusyId(a.id); setErr(null);
    try { const d = await setDefaultAddress(a.id); onSelect(d); }
    catch (e: any) { setErr(e?.message ?? 'Could not select this address.'); }
    finally { setBusyId(null); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close address list" />
      <View style={s.sheet}>
        <View style={s.grab} />
        <Text style={s.title}>Select delivery location</Text>
        <TouchableOpacity style={s.addRow} onPress={onAddNew} accessibilityRole="button">
          <Text style={s.plus}>＋</Text><Text style={s.addText}>Add new address</Text><Text style={s.chev}>›</Text>
        </TouchableOpacity>
        <Text style={s.sub}>Your saved addresses</Text>
        {loading ? <ActivityIndicator color="#059669" style={{ marginVertical: 24 }} /> : null}
        {err ? <Text style={s.err}>{err}</Text> : null}
        <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
          {list.map((a) => (
            <TouchableOpacity key={a.id} style={[s.card, a.id === selectedId && s.cardOn]} onPress={() => { void pick(a); }} disabled={busyId !== null} accessibilityRole="button">
              <View style={s.badge}><Text style={s.badgeText}>{a.label === 'Work' ? '🏢' : a.label === 'Other' ? '📍' : '🏠'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{a.label}</Text>
                <Text style={s.line} numberOfLines={2}>{[a.address_line_1, a.address_line_2, a.city, a.pincode].filter(Boolean).join(', ')}</Text>
              </View>
              {busyId === a.id ? <ActivityIndicator color="#059669" /> : a.id === selectedId ? <Text style={s.tick}>✓</Text> : null}
            </TouchableOpacity>
          ))}
          {!loading && list.length === 0 && !err ? <Text style={s.empty}>No saved addresses yet.</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,78,59,0.45)' },
  sheet: { backgroundColor: '#F3FBF7', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 32 },
  grab: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#A7F3D0', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', color: '#064E3B', marginBottom: 14 },
  addRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#D1FAE5' },
  plus: { fontSize: 20, color: '#059669', fontWeight: '900', marginRight: 12 },
  addText: { flex: 1, fontSize: 15, fontWeight: '800', color: '#059669' },
  chev: { fontSize: 24, color: '#A8A29E' },
  sub: { fontSize: 13, color: '#78716C', fontWeight: '700', marginTop: 18, marginBottom: 10 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E7E5E4' },
  cardOn: { borderColor: '#059669', borderWidth: 2 },
  badge: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  badgeText: { fontSize: 22 },
  label: { fontSize: 15, fontWeight: '900', color: '#064E3B' },
  line: { fontSize: 12, color: '#57534E', marginTop: 3, lineHeight: 17 },
  tick: { fontSize: 20, color: '#059669', fontWeight: '900', marginLeft: 8 },
  empty: { textAlign: 'center', color: '#78716C', paddingVertical: 18 },
  err: { color: '#B91C1C', fontSize: 12, marginBottom: 8 },
});
