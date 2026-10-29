import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from './AppText';
import { supabase } from '../services/supabase';

type Props = { orderId: string; storeName: string };

export function RateOrderCard({ orderId, storeName }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc('my_order_rating', { p_order_id: orderId }).then(({ data }) => {
      if (!alive) return;
      if (typeof data === 'number') {
        setRating(data);
        setSaved(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [orderId]);

  const submit = async (value: number) => {
    if (saved || busy) return;
    setRating(value);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('rate_order', { p_order_id: orderId, p_rating: value });
    setBusy(false);
    if (err) {
      setError('Could not save your rating. Try again.');
      setRating(null);
      return;
    }
    setSaved(true);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{saved ? 'Thanks for rating!' : `How was ${storeName}?`}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity key={n} disabled={saved || busy} onPress={() => submit(n)} accessibilityLabel={`${n} star`}>
            <Text style={[styles.star, rating !== null && n <= rating && styles.starOn]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#EEECE9', borderRadius: 18, padding: 16, marginBottom: 24, alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '800', color: '#1C1917' },
  stars: { flexDirection: 'row', gap: 8, marginTop: 10 },
  star: { fontSize: 34, color: '#D6D3D1' },
  starOn: { color: '#F59E0B' },
  error: { fontSize: 12, color: '#B91C1C', marginTop: 8 },
});
