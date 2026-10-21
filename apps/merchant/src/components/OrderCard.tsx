import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Pill } from './ui';
import { colors } from '../theme';
import { STATUS_META, minutesSince, rupees, timeAgo } from '../lib/format';
import type { Order } from '../lib/types';

function itemsSummary(order: Order): string {
  const items = order.order_items;
  const count = items.reduce((n, i) => n + i.quantity, 0);
  const first = items[0]?.product_name_snapshot;
  if (!first) return `${count} item${count === 1 ? '' : 's'}`;
  const more = items.length - 1;
  return `${count} item${count === 1 ? '' : 's'} · ${first}${more > 0 ? ` +${more} more` : ''}`;
}

export function OrderCard({ order, now, busy, onOpen, onAccept, onReject }: {
  order: Order; now: number; busy: boolean;
  onOpen: () => void; onAccept: () => void; onReject: () => void;
}) {
  const meta = STATUS_META[order.status];
  const isNew = order.status === 'PENDING';
  const waiting = minutesSince(order.created_at, now);
  const late = isNew && waiting >= 5;
  return (
    <Card style={isNew ? styles.newCard : undefined}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Order ${order.order_number}`}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.number}>#{order.order_number}</Text>
            <Text style={[styles.age, late && { color: colors.danger, fontWeight: '800' }]}>
              {timeAgo(order.created_at, now)}{late ? ' · customer is waiting' : ''}
            </Text>
          </View>
          <Text style={styles.amount}>{rupees(order.total_amount)}</Text>
        </View>
        <Text style={styles.items} numberOfLines={1}>{itemsSummary(order)}</Text>
        <View style={styles.pills}>
          <Pill label={meta.label} tone={meta.tone} />
          <Pill label={order.payment_method === 'COD' ? 'Cash on delivery' : order.payment_method} tone="neutral" style={{ marginLeft: 8 }} />
        </View>
      </Pressable>
      {isNew ? (
        <View style={styles.actions}>
          <Button label="Reject" variant="danger" small onPress={onReject} disabled={busy} style={{ flex: 1, marginRight: 10 }} />
          <Button label="Accept" small icon="checkmark" onPress={onAccept} loading={busy} style={{ flex: 2 }} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  newCard: { borderColor: colors.brandLine, borderWidth: 1.5 },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  number: { fontSize: 16, fontWeight: '900', color: colors.ink },
  age: { fontSize: 12, color: colors.muted, marginTop: 3 },
  amount: { fontSize: 18, fontWeight: '900', color: colors.ink },
  items: { fontSize: 13, color: colors.ink2, marginTop: 10 },
  pills: { flexDirection: 'row', marginTop: 12 },
  actions: { flexDirection: 'row', marginTop: 14 },
});
