import React, { useState } from 'react';
import { KeyboardAvoidingView, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Banner, Button, Chip } from '../components/ui';
import { signUpMerchant } from '../services/auth';
import { colors, radius } from '../theme';

const CATEGORIES: Array<[string, string]> = [
  ['GROCERY', 'Grocery'], ['RESTAURANT', 'Restaurant'], ['BAKERY', 'Bakery'], ['PHARMACY', 'Pharmacy'],
  ['ELECTRONICS', 'Electronics'], ['CLOTHING', 'Clothing'], ['HARDWARE', 'Hardware'], ['STATIONERY', 'Stationery'],
  ['PET_SUPPLIES', 'Pet supplies'], ['OTHER', 'Other'],
];
const FOOD = new Set(['RESTAURANT', 'BAKERY']);

function Field(p: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; keyboard?: 'default' | 'number-pad'; secure?: boolean; error?: string | undefined; hint?: string }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{p.label}</Text>
      <TextInput
        value={p.value} onChangeText={p.onChange} placeholder={p.placeholder} placeholderTextColor={colors.faint}
        keyboardType={p.keyboard ?? 'default'} secureTextEntry={p.secure ?? false} autoCapitalize={p.keyboard ? 'none' : 'words'}
        style={[styles.input, p.error ? styles.inputBad : null]} accessibilityLabel={p.label}
      />
      {p.error ? <Text style={styles.err}>{p.error}</Text> : p.hint ? <Text style={styles.hint}>{p.hint}</Text> : null}
    </View>
  );
}

const timeOk = (t: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t);

export function SignUpScreen({ onBack }: { onBack: () => void }) {
  const [phone, setPhone] = useState(''); const [pin, setPin] = useState(''); const [pin2, setPin2] = useState('');
  const [owner, setOwner] = useState(''); const [store, setStore] = useState(''); const [category, setCategory] = useState('GROCERY');
  const [address, setAddress] = useState(''); const [pincode, setPincode] = useState(''); const [city, setCity] = useState('Chhatrapati Sambhajinagar');
  const [opens, setOpens] = useState('09:00'); const [closes, setCloses] = useState('21:00');
  const [fssai, setFssai] = useState(''); const [gstin, setGstin] = useState('');
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [top, setTop] = useState<string | null>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!/^[6-9]\d{9}$/.test(phone)) e['phone'] = 'Enter a valid 10-digit mobile number.';
    if (!/^\d{6}$/.test(pin)) e['pin'] = 'PIN must be exactly 6 digits.';
    if (pin2 !== pin) e['pin2'] = 'PINs do not match.';
    if (owner.trim().length < 3) e['owner'] = 'Enter the owner’s full name.';
    if (store.trim().length < 2) e['store'] = 'Enter your shop name.';
    if (address.trim().length < 8) e['address'] = 'Enter the full shop address (shop no., street, area).';
    if (!/^\d{6}$/.test(pincode)) e['pincode'] = 'Pincode must be 6 digits.';
    if (!city.trim()) e['city'] = 'Enter the city.';
    if (!timeOk(opens)) e['opens'] = 'Use 24-hour time, e.g. 09:00.';
    if (!timeOk(closes)) e['closes'] = 'Use 24-hour time, e.g. 21:00.';
    if (FOOD.has(category) && !/^\d{14}$/.test(fssai)) e['fssai'] = 'FSSAI licence number (14 digits) is required for food shops.';
    if (fssai && !/^\d{14}$/.test(fssai)) e['fssai'] = 'FSSAI number must be 14 digits.';
    if (gstin && !/^[0-9A-Z]{15}$/.test(gstin.toUpperCase())) e['gstin'] = 'GSTIN must be 15 characters, or leave it empty.';
    if (!agree) e['agree'] = 'Please accept the merchant terms to continue.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    Keyboard.dismiss(); setTop(null);
    if (!validate()) { setTop('Please fix the highlighted fields.'); return; }
    setBusy(true);
    try {
      const r = await signUpMerchant(phone, pin, {
        owner_name: owner.trim(), store_name: store.trim(), category, address: address.trim(), pincode, city: city.trim(),
        opens_at: opens, closes_at: closes, ...(fssai ? { fssai } : {}), ...(gstin ? { gstin: gstin.toUpperCase() } : {}),
      });
      if (!r.ok) setTop(r.error ?? 'Could not create the account.');
    } catch { setTop('No internet connection. Check your network and try again.'); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.back}>‹ Back to sign in</Text></Pressable>
        <Text style={styles.heading}>Register your shop</Text>
        <Text style={styles.sub}>Fill these once. BEVER checks the details and activates your store, usually within a day.</Text>

        <Text style={styles.section}>1 · Your login</Text>
        <Field label="Mobile number *" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboard="number-pad" placeholder="98765 43210" error={errors['phone']} />
        <Field label="Create 6-digit PIN *" value={pin} onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} keyboard="number-pad" secure placeholder="••••••" error={errors['pin']} />
        <Field label="Confirm PIN *" value={pin2} onChange={(v) => setPin2(v.replace(/\D/g, '').slice(0, 6))} keyboard="number-pad" secure placeholder="••••••" error={errors['pin2']} />

        <Text style={styles.section}>2 · Shop details</Text>
        <Field label="Owner full name *" value={owner} onChange={setOwner} placeholder="As on your ID" error={errors['owner']} />
        <Field label="Shop name *" value={store} onChange={setStore} placeholder="Sharma Kirana & General Store" error={errors['store']} />
        <Text style={[styles.label, { marginTop: 14 }]}>Shop category *</Text>
        <View style={styles.chips}>{CATEGORIES.map(([k, l]) => <Chip key={k} label={l} active={category === k} onPress={() => setCategory(k)} />)}</View>
        <Field label="Shop address *" value={address} onChange={setAddress} placeholder="Shop no., street, area" error={errors['address']} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Pincode *" value={pincode} onChange={(v) => setPincode(v.replace(/\D/g, '').slice(0, 6))} keyboard="number-pad" placeholder="431001" error={errors['pincode']} /></View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1.4 }}><Field label="City *" value={city} onChange={setCity} error={errors['city']} /></View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="Opens at *" value={opens} onChange={setOpens} placeholder="09:00" error={errors['opens']} /></View>
          <View style={{ width: 10 }} />
          <View style={{ flex: 1 }}><Field label="Closes at *" value={closes} onChange={setCloses} placeholder="21:00" error={errors['closes']} /></View>
        </View>

        <Text style={styles.section}>3 · Licences</Text>
        <Field label={FOOD.has(category) ? 'FSSAI licence number *' : 'FSSAI licence number (if you sell food)'} value={fssai} onChange={(v) => setFssai(v.replace(/\D/g, '').slice(0, 14))} keyboard="number-pad" placeholder="14 digits" error={errors['fssai']} />
        <Field label="GSTIN (optional)" value={gstin} onChange={(v) => setGstin(v.toUpperCase().slice(0, 15))} placeholder="15 characters" error={errors['gstin']} />

        <Pressable style={styles.agreeRow} onPress={() => setAgree(!agree)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }}>
          <View style={[styles.box, agree && styles.boxOn]}>{agree ? <Text style={styles.tick}>✓</Text> : null}</View>
          <Text style={styles.agreeText}>I confirm these details are true and I agree to BEVER’s merchant terms.</Text>
        </Pressable>
        {errors['agree'] ? <Text style={styles.err}>{errors['agree']}</Text> : null}

        {top ? <View style={{ marginTop: 16 }}><Banner message={top} tone="bad" onDismiss={() => setTop(null)} /></View> : null}
        <Button label="Submit for activation" onPress={() => { void submit(); }} loading={busy} style={{ marginTop: 18 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 64, paddingBottom: 60 },
  back: { fontSize: 14, fontWeight: '800', color: colors.brandDark, paddingVertical: 6 },
  heading: { fontSize: 28, fontWeight: '900', color: colors.ink, marginTop: 10 },
  sub: { fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 8 },
  section: { fontSize: 13, fontWeight: '900', letterSpacing: 1, color: colors.brandDark, marginTop: 28, textTransform: 'uppercase' },
  label: { fontSize: 12, fontWeight: '800', color: colors.ink2, marginBottom: 6 },
  input: { height: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, paddingHorizontal: 16, fontSize: 16, color: colors.ink },
  inputBad: { borderColor: colors.danger },
  err: { color: colors.danger, fontSize: 12, marginTop: 5 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row' },
  agreeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', marginRight: 12, backgroundColor: colors.surface },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tick: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  agreeText: { flex: 1, fontSize: 13, color: colors.ink2, lineHeight: 19 },
});
