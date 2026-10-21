import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { colors, radius } from '../theme';
import { Button } from './ui';
import { REJECT_REASONS } from '../lib/format';

function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grab} />
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function RejectSheet({ visible, orderNumber, busy, onClose, onConfirm }: {
  visible: boolean; orderNumber: string; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState('');
  useEffect(() => { if (visible) { setPicked(null); setOther(''); } }, [visible]);

  const reason = picked === 'Other' ? other.trim() : picked;
  const valid = !!reason && reason.length >= 3;

  return (
    <Sheet visible={visible} title={`Reject order ${orderNumber}?`} onClose={onClose}>
      <Text style={styles.sub}>Pick a reason. The customer will be told their order was not accepted.</Text>
      {REJECT_REASONS.map((r) => (
        <Pressable key={r} onPress={() => setPicked(r)} style={[styles.option, picked === r && styles.optionActive]} accessibilityRole="radio" accessibilityState={{ selected: picked === r }}>
          <View style={[styles.radio, picked === r && styles.radioActive]}>{picked === r ? <View style={styles.radioDot} /> : null}</View>
          <Text style={styles.optionText}>{r}</Text>
        </Pressable>
      ))}
      {picked === 'Other' ? (
        <TextInput value={other} onChangeText={setOther} placeholder="Tell the customer why" placeholderTextColor={colors.faint} style={styles.input} maxLength={140} multiline />
      ) : null}
      <View style={styles.actions}>
        <Button label="Keep order" variant="secondary" onPress={onClose} style={{ flex: 1, marginRight: 10 }} />
        <Button label="Reject" variant="danger" loading={busy} disabled={!valid} onPress={() => { if (reason) onConfirm(reason); }} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

/** Whole-rupee amounts only for the MVP; stored as integer paise. */
export function parseRupeesToPaise(text: string): number | null {
  const cleaned = text.trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) return null;
  const paise = Math.round(parseFloat(cleaned) * 100);
  return paise > 0 && paise <= 100000 * 100 ? paise : null;
}

export function PriceSheet({ visible, productName, currentPaise, busy, onClose, onSave }: {
  visible: boolean; productName: string; currentPaise: number; busy: boolean; onClose: () => void; onSave: (paise: number) => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => { if (visible) setText(String(currentPaise / 100)); }, [visible, currentPaise]);
  const paise = parseRupeesToPaise(text);
  return (
    <Sheet visible={visible} title={`Edit price`} onClose={onClose}>
      <Text style={styles.sub}>{productName}</Text>
      <Text style={styles.label}>Selling price (₹)</Text>
      <TextInput value={text} onChangeText={(v) => setText(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" style={styles.input} autoFocus maxLength={9} />
      {text.length > 0 && paise === null ? <Text style={styles.err}>Enter a price between ₹1 and ₹1,00,000.</Text> : null}
      <Text style={styles.hint}>You are responsible for keeping prices accurate. Changes apply to new orders immediately.</Text>
      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1, marginRight: 10 }} />
        <Button label="Save price" loading={busy} disabled={paise === null || paise === currentPaise} onPress={() => { if (paise !== null) onSave(paise); }} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

export function AddProductSheet({ visible, busy, onClose, onSave }: {
  visible: boolean; busy: boolean; onClose: () => void; onSave: (v: { name: string; unit: string; pricePaise: number }) => void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  useEffect(() => { if (visible) { setName(''); setUnit(''); setPrice(''); } }, [visible]);
  const paise = parseRupeesToPaise(price);
  const valid = name.trim().length >= 2 && unit.trim().length >= 1 && paise !== null;
  return (
    <Sheet visible={visible} title="Add a product" onClose={onClose}>
      <Text style={styles.label}>Product name</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Toor Dal" placeholderTextColor={colors.faint} style={styles.input} maxLength={80} />
      <Text style={styles.label}>Pack size / unit</Text>
      <TextInput value={unit} onChangeText={setUnit} placeholder="e.g. 1 kg" placeholderTextColor={colors.faint} style={styles.input} maxLength={30} />
      <Text style={styles.label}>Selling price (₹)</Text>
      <TextInput value={price} onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.faint} style={styles.input} maxLength={9} />
      <Text style={styles.hint}>Photos can be added later by BEVER staff on request.</Text>
      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={{ flex: 1, marginRight: 10 }} />
        <Button label="Add product" loading={busy} disabled={!valid} onPress={() => { if (valid && paise !== null) onSave({ name: name.trim(), unit: unit.trim(), pricePaise: paise }); }} style={{ flex: 1 }} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: 20, paddingBottom: 28 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: 14 },
  title: { fontSize: 19, fontWeight: '900', color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 6, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '800', color: colors.ink2, marginTop: 12, marginBottom: 6 },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.bg, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  err: { fontSize: 12, color: colors.danger, marginTop: 6 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 10 },
  actions: { flexDirection: 'row', marginTop: 20 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 14, marginBottom: 8 },
  optionActive: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  optionText: { fontSize: 14, fontWeight: '700', color: colors.ink, marginLeft: 12, flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
});
