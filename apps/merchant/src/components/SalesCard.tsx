import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { Card } from './ui';
import { supabase } from '../services/supabase';
import { rupees } from '../lib/format';
import { colors } from '../theme';

type Summary = { todayOrders: number; todayRevenue: number; weekOrders: number; weekRevenue: number };

export function SalesCard({ storeId }: { storeId: string }) {
  const [sum, setSum] = useState<Summary | null>(null);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc('merchant_sales_summary').then(({ data, error }) => {
      if (!alive || error) return;
      const r = Array.isArray(data) ? data[0] : null;
      if (r) setSum({ todayOrders: r.today_orders, todayRevenue: r.today_revenue, weekOrders: r.week_orders, weekRevenue: r.week_revenue });
    });
    supabase.from('stores').select('average_rating,total_ratings').eq('id', storeId).maybeSingle().then(({ data }) => {
      if (!alive || !data) return;
      const count = Number((data as { total_ratings: number }).total_ratings ?? 0);
      if (count > 0) setRating({ avg: Number((data as { average_rating: number }).average_rating), count });
    });
    return () => { alive = false; };
  }, [storeId]);

  if (!sum) return null;
  return (
    <Card>
      <Text style={styles.title}>Sales</Text>
      <View style={styles.row}>
        <View style={styles.cell}><Text style={styles.num}>{rupees(sum.todayRevenue)}</Text><Text style={styles.lab}>Today · {sum.todayOrders} orders</Text></View>
        <View style={styles.cell}><Text style={styles.num}>{rupees(sum.weekRevenue)}</Text><Text style={styles.lab}>7 days · {sum.weekOrders} orders</Text></View>
      </View>
      {rating ? <Text style={styles.rating}>★ {rating.avg.toFixed(1)} · {rating.count} rating{rating.count === 1 ? '' : 's'} from customers</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: colors.ink, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 12 },
  cell: { flex: 1, backgroundColor: '#ECFDF5', borderRadius: 14, padding: 12 },
  num: { fontSize: 20, fontWeight: '900', color: '#065F46' },
  lab: { fontSize: 11, color: '#57534E', marginTop: 3 },
  rating: { marginTop: 10, fontSize: 13, fontWeight: '700', color: '#B45309' },
});
