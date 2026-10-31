import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from './AppText';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../stores/useAuthStore';

const SUPPORT_EMAIL = 'support@bever.app';

type Sheet = null | 'pin' | 'help' | 'about';

export function AccountActions() {
  const { signOut } = useAuthStore();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const close = () => { setSheet(null); setPin(''); setPin2(''); setErr(null); };

  const savePin = async () => {
    if (!/^\d{6}$/.test(pin)) { setErr('PIN must be exactly 6 digits.'); return; }
    if (pin !== pin2) { setErr('The two PINs do not match.'); return; }
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.updateUser({ password: pin });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    close();
    Alert.alert('PIN changed', 'Use your new PIN the next time you sign in.');
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'Your name, phone and saved addresses will be removed and you will be signed out. Past orders stay with the shops for their records. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_my_account');
            if (error) {
              Alert.alert(
                'Could not delete',
                /ACTIVE_ORDER_EXISTS/.test(error.message) ? 'You have an order in progress. Delete your account after it is delivered or cancelled.' : error.message,
              );
              return;
            }
            await signOut();
          },
        },
      ],
    );
  };

  const rows: Array<{ icon: string; title: string; sub: string; onPress: () => void }> = [
    { icon: '🔑', title: 'Change PIN', sub: 'Update your 6-digit sign-in PIN', onPress: () => setSheet('pin') },
    { icon: '💬', title: 'Help & support', sub: 'Orders, delivery and payments', onPress: () => setSheet('help') },
    { icon: 'ℹ️', title: 'About BEVER', sub: 'How BEVER works', onPress: () => setSheet('about') },
  ];

  return (
    <View style={styles.wrap}>
      {rows.map((r) => (
        <TouchableOpacity key={r.title} style={styles.row} activeOpacity={0.85} onPress={r.onPress} accessibilityLabel={r.title}>
          <Text style={styles.icon}>{r.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{r.title}</Text>
            <Text style={styles.sub}>{r.sub}</Text>
          </View>
          <Text style={styles.chev}>→</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity onPress={confirmDelete} style={styles.delete} accessibilityLabel="Delete my account">
        <Text style={styles.deleteText}>Delete my account</Text>
      </TouchableOpacity>

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            {sheet === 'pin' ? (
              <>
                <Text style={styles.cardTitle}>Change PIN</Text>
                <TextInput value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} placeholder="New 6-digit PIN" keyboardType="number-pad" secureTextEntry style={styles.input} placeholderTextColor="#A8A29E" />
                <TextInput value={pin2} onChangeText={(v) => setPin2(v.replace(/\D/g, '').slice(0, 6))} placeholder="Repeat new PIN" keyboardType="number-pad" secureTextEntry style={styles.input} placeholderTextColor="#A8A29E" />
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <TouchableOpacity style={styles.primary} onPress={savePin} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save PIN</Text>}
                </TouchableOpacity>
              </>
            ) : null}
            {sheet === 'help' ? (
              <>
                <Text style={styles.cardTitle}>Help & support</Text>
                <Text style={styles.body}>• Order not accepted? Shops have 15 minutes; after that the order is cancelled automatically.{'\n'}• Rider late? Open the order and tap Track to see the rider live, or call the shop.{'\n'}• Wrong or missing item? Call the shop from your order page right after delivery.{'\n'}• Payment is cash on delivery. Pay the rider only after you share your 4-digit code.</Text>
                <TouchableOpacity style={styles.primary} onPress={() => { void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=BEVER%20support`); }}>
                  <Text style={styles.primaryText}>Email support</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {sheet === 'about' ? (
              <>
                <Text style={styles.cardTitle}>About BEVER</Text>
                <Text style={styles.body}>BEVER connects you with shops in your own market and brings what you order to your door, usually in minutes. Shops confirm your order, a nearby rider picks it up, and you pay cash on delivery. Prices and delivery fees are confirmed by the server when you place an order. Free delivery above ₹199.</Text>
              </>
            ) : null}
            <TouchableOpacity style={styles.secondary} onPress={close}><Text style={styles.secondaryText}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EEECE9', padding: 14, marginBottom: 10, gap: 12 },
  icon: { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '700', color: '#1C1917' },
  sub: { fontSize: 12, color: '#78716C', marginTop: 2 },
  chev: { fontSize: 16, color: '#A8A29E' },
  delete: { alignItems: 'center', paddingVertical: 14 },
  deleteText: { fontSize: 13, fontWeight: '700', color: '#B91C1C' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34 },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#1C1917', marginBottom: 12 },
  body: { fontSize: 14, color: '#44403C', lineHeight: 22, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 14, paddingHorizontal: 14, height: 50, fontSize: 16, marginBottom: 10, color: '#1C1917' },
  err: { color: '#B91C1C', fontSize: 12, marginBottom: 8 },
  primary: { backgroundColor: '#059669', borderRadius: 14, minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondary: { alignItems: 'center', paddingVertical: 14 },
  secondaryText: { color: '#57534E', fontSize: 14, fontWeight: '700' },
});
