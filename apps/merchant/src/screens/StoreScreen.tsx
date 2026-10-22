import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Card, Pill } from '../components/ui';
import { colors } from '../theme';
import type { Store } from '../lib/types';

export function StoreScreen({ store, busy, activeOrders, onToggleOpen, onSignOut }: {
  store: Store; busy: boolean; activeOrders: number; onToggleOpen: (open: boolean) => void; onSignOut: () => void;
}) {
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
        <Text style={styles.name}>{store.name}</Text>
        <View style={{ flexDirection: 'row', marginTop: 8 }}>
          <Pill label={store.category} tone="neutral" />
          <Pill label={store.is_verified ? 'Verified' : 'Verification pending'} tone={store.is_verified ? 'ok' : 'warn'} style={{ marginLeft: 8 }} />
        </View>
        {store.address_text ? <Text style={styles.address}>{store.address_text}</Text> : null}
        <Text style={styles.footnote}>To change your address, hours or documents, contact BEVER support.</Text>
      </Card>

      <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={onSignOut} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  row: { flexDirection: 'row', alignItems: 'center' },
  big: { fontSize: 17, fontWeight: '900', color: colors.ink },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 19, marginTop: 4 },
  warn: { fontSize: 12, color: colors.brandDark, backgroundColor: colors.brandSoft, padding: 10, borderRadius: 10, marginTop: 12, lineHeight: 18 },
  name: { fontSize: 18, fontWeight: '900', color: colors.ink },
  address: { fontSize: 13, color: colors.ink2, lineHeight: 20, marginTop: 12 },
  footnote: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 12 },
});
