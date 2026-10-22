import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createAddress } from '../services/address';
import type { CustomerAddress } from '../types/address';

interface Props {
  defaults: { city?: string | undefined; state?: string | undefined; pincode?: string | undefined; line1?: string | undefined; lat?: number | undefined; lng?: number | undefined };
  receiverName: string;
  phone: string;
  onSaved: (a: CustomerAddress) => void;
}

/** Inline "delivery details" form shown in checkout when the customer has no usable address yet. */
export function AddressQuickForm({ defaults, receiverName, phone, onSaved }: Props) {
  const [line1, setLine1] = useState(defaults.line1 ?? '');
  const [line2, setLine2] = useState('');
  const [pincode, setPincode] = useState(defaults.pincode ?? '');
  const [city, setCity] = useState(defaults.city ?? 'Chhatrapati Sambhajinagar');
  const [state, setState] = useState(defaults.state ?? 'Maharashtra');
  const [label, setLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (line1.trim().length < 3) { setErr('Enter your flat / house number and street.'); return; }
    if (!/^\d{6}$/.test(pincode)) { setErr('Pincode must be exactly 6 digits.'); return; }
    if (!city.trim() || !state.trim()) { setErr('City and state are required.'); return; }
    setBusy(true);
    try {
      const a = await createAddress({
        label, address_line_1: line1.trim(), address_line_2: line2.trim() || null,
        city: city.trim(), state: state.trim(), pincode,
        latitude: defaults.lat ?? null, longitude: defaults.lng ?? null, is_default: true,
      });
      onSaved(a);
    } catch (e: any) { setErr(e?.message ?? 'Could not save the address.'); }
    finally { setBusy(false); }
  };

  return (
    <View style={s.card}>
      <Text style={s.head}>Where should we deliver?</Text>
      <Text style={s.help}>Delivering to {receiverName || 'you'} · {phone}</Text>
      <View style={s.tags}>
        {(['Home', 'Work', 'Other'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setLabel(t)} style={[s.tag, label === t && s.tagOn]} accessibilityRole="button">
            <Text style={[s.tagText, label === t && s.tagTextOn]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.label}>Flat / house no. and street *</Text>
      <TextInput value={line1} onChangeText={setLine1} style={s.input} placeholder="Flat 12, Gulmandi Apartments" placeholderTextColor="#A8A29E" accessibilityLabel="Flat and street" />
      <Text style={s.label}>Landmark / floor (optional)</Text>
      <TextInput value={line2} onChangeText={setLine2} style={s.input} placeholder="2nd floor, near Ganesh temple" placeholderTextColor="#A8A29E" accessibilityLabel="Landmark" />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Pincode *</Text>
          <TextInput value={pincode} onChangeText={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" style={s.input} placeholder="431001" placeholderTextColor="#A8A29E" accessibilityLabel="Pincode" />
        </View>
        <View style={{ width: 10 }} />
        <View style={{ flex: 1.4 }}>
          <Text style={s.label}>City *</Text>
          <TextInput value={city} onChangeText={setCity} style={s.input} accessibilityLabel="City" />
        </View>
      </View>
      <Text style={s.label}>State *</Text>
      <TextInput value={state} onChangeText={setState} style={s.input} accessibilityLabel="State" />
      {err ? <Text style={s.err}>{err}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={save} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Save and continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 20, padding: 18, marginBottom: 18 },
  head: { fontSize: 17, fontWeight: '900', color: '#064E3B' },
  help: { fontSize: 12, color: '#78716C', marginTop: 3, marginBottom: 12 },
  tags: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tag: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#E7E5E4', backgroundColor: '#fff' },
  tagOn: { backgroundColor: '#059669', borderColor: '#059669' },
  tagText: { fontSize: 13, fontWeight: '800', color: '#44403C' },
  tagTextOn: { color: '#fff' },
  label: { fontSize: 12, fontWeight: '800', color: '#44403C', marginTop: 12, marginBottom: 6 },
  input: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: '#E7E5E4', backgroundColor: '#FAFAF9', paddingHorizontal: 14, fontSize: 15, color: '#1C1917' },
  row: { flexDirection: 'row' },
  err: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: 13 },
  btn: { marginTop: 16, backgroundColor: '#059669', borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
