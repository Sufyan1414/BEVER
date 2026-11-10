import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { CartBar } from '../../components/CartBar';
import { ProductCard } from '../../components/ProductCard';
import { fetchProductsByIds, fetchStoreNames } from '../../services/store';
import { useFavouritesStore } from '../../stores/useFavouritesStore';
import type { Product } from '../../types/store';

const GAP = 12;
const CARD_W = Math.floor((Dimensions.get('window').width - 32 - GAP) / 2);

export function FavouritesScreen() {
  const navigation = useNavigation<any>();
  const ids = useFavouritesStore((s) => s.ids);
  const [products, setProducts] = useState<Product[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchProductsByIds(ids);
      setProducts(rows);
      setNames(await fetchStoreNames(rows.map((r) => r.store_id)));
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Back"><Text style={styles.backText}>‹</Text></TouchableOpacity>
        <View>
          <Text style={styles.title}>Favourites</Text>
          <Text style={styles.sub}>{ids.length} saved item{ids.length === 1 ? '' : 's'}</Text>
        </View>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#059669" /></View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyHeart}>♡</Text>
          <Text style={styles.emptyTitle}>No favourites yet</Text>
          <Text style={styles.emptyBody}>Tap the heart on any product to keep it here for quick reordering.</Text>
          <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('Home')}><Text style={styles.ctaText}>Browse shops</Text></TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(p) => p.id}
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16, marginBottom: GAP }}
          contentContainerStyle={{ paddingTop: 14, paddingBottom: 130 }}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={CARD_W}
              storeName={names[item.store_id] ?? 'Nearby shop'}
              onOpen={() => navigation.navigate('Home', { screen: 'HomeMain', params: { query: item.name } })}
            />
          )}
        />
      )}
      <CartBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F3FBF7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: '#064E3B', borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: '#ECFDF5', fontSize: 30, lineHeight: 34, marginTop: -3 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: '#A7F3D0', fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyHeart: { fontSize: 54, color: '#A7F3D0' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#064E3B', marginTop: 6 },
  emptyBody: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19, marginTop: 6, maxWidth: 260 },
  cta: { marginTop: 18, backgroundColor: '#059669', borderRadius: 14, paddingHorizontal: 26, paddingVertical: 13 },
  ctaText: { color: '#fff', fontWeight: '800' },
});
