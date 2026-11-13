/**
 * Full-screen search: recent + trending when empty, live shops and products when typing.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, FlatList, Keyboard, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CartBar } from '../../components/CartBar';
import { ProductCard } from '../../components/ProductCard';
import { ProductDetailSheet } from '../../components/ProductDetailSheet';
import { searchProductsFull } from '../../services/store';
import { STORE_CATEGORY_LABELS, type NearbyStore, type Product } from '../../types/store';

const RECENT_KEY = 'bever.recentSearches.v1';
const TRENDING = ['Milk', 'Bread', 'Eggs', 'Tomato', 'Paneer', 'Chips', 'Cold drink', 'Ice cream', 'Paracetamol', 'Notebook'];
const GAP = 12;
const CARD_W = Math.floor((Dimensions.get('window').width - 16 * 2 - GAP) / 2);

export function SearchScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const stores: NearbyStore[] = route.params?.stores ?? [];
  const [query, setQuery] = useState<string>(route.params?.query ?? '');
  const [recent, setRecent] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sheet, setSheet] = useState<{ product: Product; store: NearbyStore } | null>(null);

  const storeById = useMemo(() => new Map(stores.map((s) => [s.id, s])), [stores]);
  const q = query.trim();

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((v) => { if (v) setRecent(JSON.parse(v) as string[]); }).catch(() => undefined);
  }, []);

  const remember = useCallback((term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  useEffect(() => {
    if (q.length < 2) { setProducts([]); setBusy(false); return; }
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      searchProductsFull(stores.map((s) => s.id), q)
        .then((rows) => { if (alive) setProducts(rows); })
        .catch(() => { if (alive) setProducts([]); })
        .finally(() => { if (alive) setBusy(false); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q, stores]);

  const matchedStores = useMemo(() => {
    const l = q.toLowerCase();
    if (l.length < 2) return [];
    return stores.filter((s) => [s.name, s.description ?? '', STORE_CATEGORY_LABELS[s.category] ?? ''].some((v) => v.toLowerCase().includes(l)));
  }, [q, stores]);

  const shownProducts = products.filter((p) => !onlyOpen || storeById.get(p.store_id)?.is_open);
  const searching = q.length >= 2;

  const header = (
    <View>
      {matchedStores.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Shops</Text>
          {matchedStores.slice(0, 4).map((s) => (
            <TouchableOpacity key={s.id} style={styles.shopRow} onPress={() => { remember(q); navigation.navigate('StoreDetail', { store: s }); }} activeOpacity={0.85}>
              <View style={styles.shopIcon}><Ionicons name="storefront-outline" size={20} color="#26262A" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>{s.name}</Text>
                <Text style={styles.shopMeta} numberOfLines={1}>{STORE_CATEGORY_LABELS[s.category]} · {s.estimated_delivery_minutes ?? 15} min{s.is_open ? '' : ' · Closed'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {searching && products.length > 0 ? (
        <View style={[styles.block, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <Text style={styles.blockTitle}>{shownProducts.length} product{shownProducts.length === 1 ? '' : 's'}</Text>
          <TouchableOpacity onPress={() => setOnlyOpen((v) => !v)} style={[styles.filter, onlyOpen && styles.filterOn]} accessibilityLabel="Show only open shops">
            <Text style={[styles.filterText, onlyOpen && styles.filterTextOn]}>Open now</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.top}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Back"><Ionicons name="arrow-back" size={22} color="#0B0B0C" /></TouchableOpacity>
        <View style={styles.bar}>
          <Ionicons name="search" size={18} color="#26262A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Search milk, atta, medicines…"
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            onSubmitEditing={() => { remember(q); Keyboard.dismiss(); }}
            style={styles.input}
            accessibilityLabel="Search"
          />
          {query.length > 0 ? <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear"><Ionicons name="close-circle" size={18} color="#9CA3AF" /></TouchableOpacity> : null}
        </View>
      </View>

      {!searching ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {recent.length > 0 ? (
            <View style={{ marginBottom: 22 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.blockTitle}>Recent searches</Text>
                <TouchableOpacity onPress={() => { setRecent([]); AsyncStorage.removeItem(RECENT_KEY).catch(() => undefined); }}><Text style={styles.link}>Clear</Text></TouchableOpacity>
              </View>
              <View style={styles.chips}>
                {recent.map((r) => (
                  <TouchableOpacity key={r} style={styles.chip} onPress={() => setQuery(r)}>
                    <Ionicons name="time-outline" size={14} color="#6B7280" /><Text style={styles.chipText}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          <Text style={styles.blockTitle}>Trending near you</Text>
          <View style={styles.chips}>
            {TRENDING.map((t) => (
              <TouchableOpacity key={t} style={[styles.chip, styles.chipHot]} onPress={() => setQuery(t)}>
                <Text style={[styles.chipText, { color: '#26262A' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.blockTitle, { marginTop: 24 }]}>Browse shops</Text>
          {stores.slice(0, 6).map((s) => (
            <TouchableOpacity key={s.id} style={styles.shopRow} onPress={() => navigation.navigate('StoreDetail', { store: s })} activeOpacity={0.85}>
              <View style={styles.shopIcon}><Ionicons name="storefront-outline" size={20} color="#26262A" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>{s.name}</Text>
                <Text style={styles.shopMeta}>{STORE_CATEGORY_LABELS[s.category]} · {s.estimated_delivery_minutes ?? 15} min</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={shownProducts}
          keyExtractor={(p) => p.id}
          numColumns={2}
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={{ gap: GAP, paddingHorizontal: 16, marginBottom: GAP }}
          contentContainerStyle={{ paddingBottom: 130 }}
          ListHeaderComponent={header}
          renderItem={({ item }) => {
            const st = storeById.get(item.store_id);
            return (
              <ProductCard
                product={item}
                width={CARD_W}
                storeName={st?.name ?? 'Nearby shop'}
                storeCategory={st?.category}
                etaMinutes={st?.estimated_delivery_minutes ?? null}
                onOpen={() => { if (st) { remember(q); setSheet({ product: item, store: st }); } }}
              />
            );
          }}
          ListEmptyComponent={busy ? <Text style={styles.empty}>Searching nearby shops…</Text> : matchedStores.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 36 }}>
              <Ionicons name="search-outline" size={42} color="#E6E6E1" />
              <Text style={styles.emptyTitle}>Nothing found for “{q}”</Text>
              <Text style={styles.empty}>Try a shorter word or check the spelling. Shops near you may not stock it yet.</Text>
            </View>
          ) : null}
        />
      )}
      <ProductDetailSheet
        product={sheet?.product ?? null}
        store={sheet ? { id: sheet.store.id, name: sheet.store.name, category: sheet.store.category, etaMinutes: sheet.store.estimated_delivery_minutes } : null}
        onClose={() => setSheet(null)}
        onViewShop={sheet ? () => { const cur = sheet; setSheet(null); navigation.navigate('StoreDetail', { store: cur.store, focusProductId: cur.product.id }); } : undefined}
      />
      <CartBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E6E6E1' },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F2' },
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 14, paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E6E6E1' },
  input: { flex: 1, fontSize: 14.5, color: '#111827', paddingVertical: 0 },
  block: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  blockTitle: { fontSize: 15, fontWeight: '800', color: '#0B0B0C', marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: '#26262A', fontWeight: '700', fontSize: 12.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E6E6E1' },
  chipHot: { backgroundColor: '#F5F5F2', borderColor: '#E6E6E1' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E6E6E1' },
  shopIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F5F2', alignItems: 'center', justifyContent: 'center' },
  shopName: { fontSize: 14, fontWeight: '800', color: '#111827' },
  shopMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  filter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#E6E6E1', backgroundColor: '#fff' },
  filterOn: { backgroundColor: '#0B0B0C', borderColor: '#0B0B0C' },
  filterText: { fontSize: 12, fontWeight: '700', color: '#26262A' },
  filterTextOn: { color: '#fff' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0B0B0C', marginTop: 10 },
  empty: { textAlign: 'center', color: '#6B7280', fontSize: 13, lineHeight: 19, marginTop: 8, paddingHorizontal: 20 },
});
