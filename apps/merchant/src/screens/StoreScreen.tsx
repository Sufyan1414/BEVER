import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { Button, Card, Pill } from '../components/ui';
import { colors } from '../theme';
import type { Store } from '../lib/types';

export function StoreScreen({ store, busy, activeOrders, onToggleOpen, onSaveDetails, onSignOut }: {
  store: Store; busy: boolean; activeOrders: number; onToggleOpen: (open: boolean) => void; onSaveDetails: (name: string, phone: string) => Promise<void>; onSignOut: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(store.name);
  const [phone, setPhone] = useState(store.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const n = name.trim(); const ph = phone.replace(/[^\d+]/g, '');
    if (n.length < 2) { setErr('Enter your shop name.'); return; }
    if (ph.replace(/\D/g, '').length < 10) { setErr('Enter a valid 10-digit shop phone.'); return; }
    setSaving(true); setErr(null);
    try { await onSaveDetails(n, ph); setEditing(false); } catch { setErr('Could not save. Check your connection and try again.'); }
    finally { setSaving(false); }
  };
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.big}>{store.is_open ? 'Store is open' : 'Store is paused'}</Text>
            <Text style={styles.muted}>
              {store.is_open ? 'Customers can place new orders with you.' : 'Customers cannot place new orders until you open again.'}
            </Text>
          </View>
          <Switch value={store.is_open} onValueChange={onToggleOpen} disabled={busy} trackColor={{ false: '#D6D3D1', true: colors.brand }} thumbColor="#FFFFFF" accessibilityLabel="Store open" />
        </View>
        {!store.is_open && activeOrders > 0 ? <Text style={styles.warn}>You still have {activeOrders} order{activeOrders === 1 ? '' : 's'} in progress. Pausing does not cancel them.</Text> : null}
      </Card>

      <Card>
        {editing ? (
          <View>
            <Text style={styles.label}>Shop name</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} accessibilityLabel="Shop name" />
            <Text style={styles.label}>Shop phone (customers and riders call this)</Text>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} accessibilityLabel="Shop phone" />
            {err ? <Text style={styles.warn}>{err}</Text> : null}
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <Button label="Save" onPress={() => { void save(); }} loading={saving} small style={{ flex: 1 }} />
              <Button label="Cancel" variant="secondary" onPress={() => { setEditing(false); setName(store.name); setPhone(store.phone ?? ''); setErr(null); }} small style={{ flex: 1, marginLeft: 8 }} />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <Text style={[styles.name, { flex: 1 }]}>{store.name}</Text>
            <Button label="Edit" variant="secondary" icon="create-outline" small onPress={() => setEditing(true)} />
          </View>
        )}
        {!editing && store.phone ? <Text style={styles.address}>Phone: {store.phone}</Text> : null}
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <Pill label={store.category} tone="neutral" />
          <Pill label={store.is_verified ? 'Verified' : 'Verification pending'} tone={store.is_verified ? 'ok' : 'warn'} style={{ marginLeft: 8 }} />
        </View>
        {store.address_text ? <Text style={styles.address}>{store.address_text}</Text> : null}
        <Text style={styles.footnote}>To change your address, location or documents, contact BEVER support.</Text>
      </Card>

      <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={onSignOut} style={{ marginTop: 8 }} />
      <Text style={styles.footnote}>Build: store settings + name fix</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center' },
  big: { fontSize: 17, fontWeight: '900', color: colors.ink },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
  warn: { fontSize: 12, color: colors.brandDark, backgroundColor: colors.brandSoft, padding: 10, borderRadius: 10, marginTop: 12, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  name: { fontSize: 18, fontWeight: '900', color: colors.ink },
  address: { fontSize: 13, color: colors.ink2, lineHeight: 20, marginTop: 12 },
  footnote: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 12 },
});
