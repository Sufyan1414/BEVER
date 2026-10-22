import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, Chip, EmptyState, Skeleton } from '../components/ui';
import { OrderCard } from '../components/OrderCard';
import { ACTIVE_STATUSES, NEW_STATUSES, isToday, rupees } from '../lib/format';
import { colors } from '../theme';
import type { Order } from '../lib/types';

type Filter = 'new' | 'active' | 'history';

export function OrdersScreen({ orders, loading, refreshing, now, busyId, onRefresh, onOpen, onAccept, onReject }: {
  orders: Order[]; loading: boolean; refreshing: boolean; now: number; busyId: string | null;
  onRefresh: () => void; onOpen: (o: Order) => void; onAccept: (o: Order) => void; onReject: (o: Order) => void;
}) {
  const [filter, setFilter] = useState<Filter>('new');

  const groups = useMemo(() => ({
    new: orders.filter((o) => NEW_STATUSES.includes(o.status)),
    active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
    history: orders.filter((o) => !NEW_STATUSES.includes(o.status) && !ACTIVE_STATUSES.includes(o.status)),
  }), [orders]);

  const deliveredToday = useMemo(
    () => orders.filter((o) => o.status === 'DELIVERED' && isToday(o.created_at, now)),
    [orders, now],
  );
  const salesToday = deliveredToday.reduce((sum, o) => sum + o.items_total, 0);

  const list = groups[filter];

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.stats}>
        <Card style={styles.stat}><Text style={styles.statNum}>{groups.new.length}</Text><Text style={styles.statLabel}>New</Text></Card>
        <Card style={styles.stat}><Text style={styles.statNum}>{groups.active.length}</Text><Text style={styles.statLabel}>In progress</Text></Card>
        <Card style={styles.stat}><Text style={styles.statNum}>{rupees(salesToday)}</Text><Text style={styles.statLabel}>Sold today</Text></Card>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <Chip label="New" active={filter === 'new'} count={groups.new.length} onPress={() => setFilter('new')} />
        <Chip label="In progress" active={filter === 'active'} count={groups.active.length} onPress={() => setFilter('active')} />
        <Chip label="History" active={filter === 'history'} onPress={() => setFilter('history')} />
      </ScrollView>

      {loading ? (
        <><Skeleton /><Skeleton /><Skeleton /></>
      ) : list.length === 0 ? (
        <EmptyState
          icon={filter === 'new' ? 'notifications-outline' : filter === 'active' ? 'bag-handle-outline' : 'time-outline'}
          title={filter === 'new' ? 'No new orders right now' : filter === 'active' ? 'Nothing in progress' : 'No past orders yet'}
          body={filter === 'new' ? 'Keep this app open. New orders appear here the moment a customer places one.' : filter === 'active' ? 'Accepted orders you are preparing or handing over will show up here.' : 'Delivered, cancelled and rejected orders are listed here.'}
        />
      ) : (
        list.map((o) => (
          <OrderCard key={o.id} order={o} now={now} busy={busyId === o.id} onOpen={() => onOpen(o)} onAccept={() => onAccept(o)} onReject={() => onReject(o)} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  stats: { flexDirection: 'row', marginBottom: 6 },
  stat: { flex: 1, marginRight: 8, height: 74, justifyContent: 'center', alignItems: 'center', marginBottom: 6, padding: 8 },
  statNum: { fontSize: 19, fontWeight: '900', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 3, fontWeight: '700' },
  chips: { marginBottom: 14, marginTop: 4, flexGrow: 0 },
});
