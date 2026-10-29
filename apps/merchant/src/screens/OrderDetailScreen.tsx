import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Pill, SectionTitle } from '../components/ui';
import { STATUS_META, nextAction, rupees, timeAgo, timeOfDay } from '../lib/format';
import { colors, radius } from '../theme';
import type { Order } from '../lib/types';

export function OrderDetailScreen({ order, now, busy, onBack, onAdvance, onReject }: {
  order: Order; now: number; busy: boolean;
  onBack: () => void; onAdvance: (to: Order['status']) => void; onReject: () => void;
}) {
  const meta = STATUS_META[order.status];
  const action = nextAction(order.status);
  const itemCount = order.order_items.reduce((n, i) => n + i.quantity, 0);

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to orders" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Order #{order.order_number}</Text>
          <Text style={styles.sub}>{timeOfDay(order.created_at)} · {timeAgo(order.created_at, now)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statusCard}>
          <Pill label={meta.label} tone={meta.tone} />
          <Text style={styles.hint}>{meta.hint}</Text>
          {order.status === 'REJECTED' && order.rejection_reason ? <Text style={styles.reason}>Reason: {order.rejection_reason}</Text> : null}
        </Card>

        <SectionTitle>Items to pack ({itemCount})</SectionTitle>
        <Card>
          {order.order_items.map((item, idx) => (
            <View key={item.id} style={[styles.itemRow, idx > 0 && styles.itemDivider]}>
              <View style={styles.qty}><Text style={styles.qtyText}>{item.quantity}×</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.product_name_snapshot}</Text>
                <Text style={styles.itemMeta}>{item.unit_snapshot ? `${item.unit_snapshot} · ` : ''}{rupees(item.unit_price)} each</Text>
              </View>
              <Text style={styles.itemTotal}>{rupees(item.total_price)}</Text>
            </View>
          ))}
        </Card>

        {order.special_instructions ? (
          <>
            <SectionTitle>Customer note</SectionTitle>
            <Card><Text style={styles.note}>{order.special_instructions}</Text></Card>
          </>
        ) : null}

        <SectionTitle>Payment</SectionTitle>
        <Card>
          <View style={styles.row}><Text style={styles.muted}>Items</Text><Text style={styles.value}>{rupees(order.items_total)}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Delivery fee</Text><Text style={styles.value}>{order.delivery_fee === 0 ? 'Free' : rupees(order.delivery_fee)}</Text></View>
          <View style={[styles.row, styles.totalRow]}><Text style={styles.totalLabel}>Customer pays</Text><Text style={styles.totalValue}>{rupees(order.total_amount)}</Text></View>
          <Text style={styles.payNote}>
            {order.payment_method === 'COD' ? 'Cash on delivery. The delivery partner collects the cash.' : `Paid via ${order.payment_method}.`}
          </Text>
        </Card>
      </ScrollView>

      {action || order.status === 'PENDING' ? (
        <View style={styles.footer}>
          {order.status === 'PENDING' ? (
            <Button label="Reject" variant="danger" onPress={onReject} disabled={busy} style={{ flex: 1, marginRight: 10 }} />
          ) : null}
          {action ? (
            <Button label={action.label} onPress={() => onAdvance(action.to)} loading={busy} style={{ flex: 2 }} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900', color: colors.ink },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  content: { padding: 16, paddingBottom: 24 },
  statusCard: { backgroundColor: colors.brandSoft, borderColor: colors.brandLine },
  hint: { fontSize: 14, color: colors.ink2, lineHeight: 20, marginTop: 10 },
  reason: { fontSize: 13, color: colors.danger, marginTop: 8, fontWeight: '700' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  qty: { minWidth: 40, height: 32, borderRadius: radius.sm, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  qtyText: { fontSize: 14, fontWeight: '900', color: colors.brandDark },
  itemName: { fontSize: 14, fontWeight: '800', color: colors.ink },
  itemMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '800', color: colors.ink },
  note: { fontSize: 14, color: colors.ink2, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  muted: { fontSize: 13, color: colors.muted },
  value: { fontSize: 13, fontWeight: '700', color: colors.ink },
  totalRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12, marginBottom: 4 },
  totalLabel: { fontSize: 15, fontWeight: '900', color: colors.ink },
  totalValue: { fontSize: 17, fontWeight: '900', color: colors.ink },
  payNote: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 18 },
  footer: { flexDirection: 'row', padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.line },
});
