/**
 * BEVER Customer App — Shop page
 *
 * Shop header, in-shop search, product-category chips (wrapped, not scrolling) and a
 * two-column product grid. Opening a product from anywhere passes `focusProductId`:
 * the shop selects that product's category and opens its product page, so a tap on
 * "Almonds" always lands on almonds.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CartBar } from '../../components/CartBar';
import { ProductCard } from '../../components/ProductCard';
import { ProductDetailSheet } from '../../components/ProductDetailSheet';
import type { StoreDetailProps } from '../../navigation/types';
import type { NearbyStore, Product, ProductCategory } from '../../types/store';
import { fetchStoreCategories, fetchStoreProducts } from '../../services/store';
import { C, CATEGORY_STYLE, rupees } from '../../theme';

const ALL = 'ALL';

const distance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

export function StoreDetailScreen({ route, navigation }: StoreDetailProps) {
  const store: NearbyStore = route.params.store;
  const focusProductId = route.params.focusProductId;
  const { width: winW } = useWindowDimensions();
  const cs = CATEGORY_STYLE[store.category] ?? CATEGORY_STYLE.OTHER!;

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const focused = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cats, prods] = await Promise.all([fetchStoreCategories(store.id), fetchStoreProducts(store.id)]);
      setCategories(cats); setProducts(prods);
    } catch (e: any) {
      setError(e?.message ?? 'Could not load this shop. Check your connection.');
    } finally { setLoading(false); }
  }, [store.id]);

  useEffect(() => { void load(); }, [load]);

  // Jump straight to the tapped product (right category + product page).
  useEffect(() => {
    if (!focusProductId || focused.current || products.length === 0) return;
    const hit = products.find((p) => p.id === focusProductId);
    focused.current = true;
    if (hit) {
      if (hit.category_id) setSelected(hit.category_id);
      setSheetProduct(hit);
    }
  }, [focusProductId, products]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => products.filter((p) => {
    const inCat = selected === ALL || p.category_id === selected;
    const inQuery = !q || [p.name, p.description ?? '', p.unit ?? ''].some((v) => v.toLowerCase().includes(q));
    return inCat && inQuery;
  }), [products, selected, q]);

  const usedCategories = useMemo(() => {
    const ids = new Set(products.map((p) => p.category_id));
    return categories.filter((c) => ids.has(c.id));
  }, [categories, products]);
  const countIn = (id: string) => products.filter((p) => p.category_id === id).length;

  const gutter = 16;
  const cardW = Math.floor((winW - gutter * 2 - 12) / 2);
  const eta = store.estimated_delivery_minutes ?? Math.round(10 + (store.distance_meters / 1000) * 4);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="dark" />
      <ProductDetailSheet
        product={sheetProduct ? products.find((p) => p.id === sheetProduct.id) ?? sheetProduct : null}
        store={{ id: store.id, name: store.name, category: store.category, etaMinutes: eta }}
        onClose={() => setSheetProduct(null)}
      />

      <View style={s.top}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.round} accessibilityLabel="Back" accessibilityRole="button"><Text style={s.roundText}>‹</Text></TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>{store.name}</Text>
        <View style={s.round} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={[s.banner, { backgroundColor: cs.bg, marginHorizontal: gutter }]}>
          {store.banner_url ? <Image source={{ uri: store.banner_url }} style={s.bannerImg} resizeMode="cover" /> : <Text style={{ fontSize: 56 }}>{cs.icon}</Text>}
          <View style={[s.status, { backgroundColor: store.is_open ? C.mint : C.ink2 }]}>
            <Text style={s.statusText}>{store.is_open ? 'OPEN' : 'CLOSED'}</Text>
          </View>
        </View>

        <View style={s.info}>
          <Text style={s.name}>{store.name}</Text>
          {store.description ? <Text style={s.desc} numberOfLines={2}>{store.description}</Text> : null}
          <View style={s.facts}>
            <View style={[s.fact, { backgroundColor: cs.bg }]}><Text style={[s.factText, { color: cs.fg }]}>{cs.label}</Text></View>
            <View style={s.fact}><Text style={s.factText}>⚡ {eta} min</Text></View>
            <View style={s.fact}><Text style={s.factText}>{distance(store.distance_meters)}</Text></View>
            {store.total_ratings > 0 ? <View style={s.fact}><Text style={s.factText}>★ {store.average_rating.toFixed(1)}</Text></View> : null}
            {store.minimum_order_amount > 0 ? <View style={s.fact}><Text style={s.factText}>Min {rupees(store.minimum_order_amount)}</Text></View> : null}
          </View>
          {store.address_text ? <Text style={s.addr} numberOfLines={2}>📍 {store.address_text}</Text> : null}
          <Text style={s.basketNote}>Items from this shop go in their own basket and arrive with their own rider.</Text>
        </View>

        <View style={s.search}>
          <Text style={{ fontSize: 18, color: C.muted }}>⌕</Text>
          <TextInput value={query} onChangeText={setQuery} placeholder={`Search in ${store.name}`} placeholderTextColor={C.faint} style={s.searchInput} returnKeyType="search" accessibilityLabel="Search in this shop" />
          {query ? <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Clear search"><Text style={{ fontSize: 16, color: C.muted }}>✕</Text></TouchableOpacity> : null}
        </View>

        {usedCategories.length > 0 ? (
          <View style={s.chips}>
            {[{ id: ALL, name: 'All', n: products.length }, ...usedCategories.map((c) => ({ id: c.id, name: c.name, n: countIn(c.id) }))].map((c) => {
              const on = selected === c.id;
              return (
                <TouchableOpacity key={c.id} onPress={() => setSelected(c.id)} style={[s.chip, on && s.chipOn]} activeOpacity={0.85} accessibilityLabel={`Show ${c.name}`}>
                  <Text style={[s.chipText, on && s.chipTextOn]}>{c.name}</Text>
                  <Text style={[s.chipCount, on && s.chipTextOn]}>{c.n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={C.ink} /> : null}
        {error ? (
          <View style={s.msg}><Text style={s.msgTitle}>Couldn't load this shop</Text><Text style={s.msgBody}>{error}</Text>
            <TouchableOpacity style={s.btn} onPress={() => void load()}><Text style={s.btnText}>Try again</Text></TouchableOpacity></View>
        ) : null}
        {!loading && !error && visible.length === 0 ? (
          <View style={s.msg}><Text style={{ fontSize: 36 }}>🔍</Text><Text style={s.msgTitle}>{q ? `Nothing matches “${query.trim()}”` : 'No items here yet'}</Text></View>
        ) : null}

        <View style={[s.grid, { paddingHorizontal: gutter }]}>
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} width={cardW} storeName={store.name} storeCategory={store.category} etaMinutes={eta} hideStore onOpen={() => setSheetProduct(p)} />
          ))}
        </View>
      </ScrollView>
      <CartBar />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center' },
  roundText: { fontSize: 28, color: C.ink, marginTop: -4, fontWeight: '600' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.ink },
  banner: { height: 150, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  bannerImg: { width: '100%', height: '100%' },
  status: { position: 'absolute', left: 12, top: 12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#fff', fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  info: { paddingHorizontal: 20, paddingTop: 16 },
  name: { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  desc: { fontSize: 13.5, color: C.muted, marginTop: 4, lineHeight: 19 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  fact: { backgroundColor: C.canvas, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  factText: { fontSize: 11.5, fontWeight: '800', color: C.ink2 },
  addr: { fontSize: 12.5, color: C.muted, marginTop: 10, lineHeight: 18 },
  basketNote: { fontSize: 11.5, color: C.sky, backgroundColor: C.skySoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 12, lineHeight: 16, fontWeight: '600', overflow: 'hidden' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 16, height: 48, borderRadius: 16, backgroundColor: C.canvas, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 14, color: C.ink, paddingVertical: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  chipOn: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 12.5, fontWeight: '700', color: C.ink },
  chipCount: { fontSize: 11, fontWeight: '800', color: C.faint },
  chipTextOn: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12, marginTop: 16 },
  msg: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 36, gap: 8 },
  msgTitle: { fontSize: 16, fontWeight: '800', color: C.ink, textAlign: 'center' },
  msgBody: { fontSize: 13.5, color: C.muted, textAlign: 'center', lineHeight: 20 },
  btn: { marginTop: 8, backgroundColor: C.ink, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
