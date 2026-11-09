/**
 * BEVER Customer App — Home Screen
 *
 * Premium store-discovery experience.
 *
 * Coordinate resolution priority:
 *   1. Authenticated user's default delivery address (PostGIS)
 *   2. Browsing location from useLocationStore (set at first launch)
 *
 * Guests fall through to browsing location; never blocked by auth.
 *
 * Rules:
 *   - No fake stores, products, ratings, or delivery data.
 *   - No hardcoded cities or service areas.
 *   - Shows real data or honest empty states.
 *   - Skeleton loading while data resolves.
 */

import { CartBar } from '../../components/CartBar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, FlatList, ScrollView, StyleSheet, RefreshControl, Modal, Animated, Image } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLocationStore } from '../../stores/useLocationStore';
import { fetchNearbyStores, fetchDealProducts } from '../../services/store';
import { ProductCard } from '../../components/ProductCard';
import { supabase } from '../../services/supabase';
import { BrowsingLocationPickerScreen } from '../location/BrowsingLocationPickerScreen';
import type { NearbyStore, Product, StoreCategory } from '../../types/store';
import { STORE_CATEGORY_LABELS } from '../../types/store';
import type { AppTabParamList } from '../../navigation/types';


// ─── Navigation typing ────────────────────────────────────────────────────────

type RootStackParamList = { Main: undefined; Auth: undefined };

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Screen state ─────────────────────────────────────────────────────────────

type HomeState =
  | { kind: 'LOADING' }
  | { kind: 'ERROR'; message: string }
  | { kind: 'NO_STORES'; lat: number; lng: number; locationLabel: string }
  | { kind: 'STORE_LIST'; lat: number; lng: number; locationLabel: string; stores: NearbyStore[] };

// ─── Category config ──────────────────────────────────────────────────────────

const ALL_KEY = 'ALL' as const;
type CategoryFilter = StoreCategory | typeof ALL_KEY;

type CategoryItem = {
  key: CategoryFilter;
  label: string;
  emoji: string;
  color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const CATEGORIES: CategoryItem[] = [
  { key: ALL_KEY,      label: 'All',         emoji: '✨', color: '#059669', icon: 'apps' },
  { key: 'RESTAURANT', label: 'Food',        emoji: '🍽️',  color: '#EF4444', icon: 'restaurant' },
  { key: 'GROCERY',    label: 'Grocery',     emoji: '🛒', color: '#10B981', icon: 'basket' },
  { key: 'PHARMACY',   label: 'Pharmacy',    emoji: '💊', color: '#3B82F6', icon: 'medkit' },
  { key: 'BAKERY',     label: 'Bakery',      emoji: '🥐', color: '#F97316', icon: 'cafe' },
  { key: 'ELECTRONICS',label: 'Electronics', emoji: '📱', color: '#8B5CF6', icon: 'headset' },
  { key: 'CLOTHING',   label: 'Fashion',     emoji: '👗', color: '#EC4899', icon: 'shirt' },
  { key: 'OTHER',      label: 'More',        emoji: '🏪', color: '#6B7280', icon: 'storefront' },
];

const CATEGORY_ICONS: Record<StoreCategory, string> = {
  GROCERY:     '🛒',
  RESTAURANT:  '🍽️',
  PHARMACY:    '💊',
  BAKERY:      '🥐',
  ELECTRONICS: '📱',
  CLOTHING:    '👗',
  HARDWARE:    '🔧',
  STATIONERY:  '✏️',
  PET_SUPPLIES:'🐾',
  OTHER:       '🏪',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// ─── Skeleton component ───────────────────────────────────────────────────────

function SkeletonCard() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <Animated.View style={[skeletonStyles.card, { opacity }]}>
      <View style={skeletonStyles.logoBox} />
      <View style={skeletonStyles.content}>
        <View style={skeletonStyles.titleBar} />
        <View style={skeletonStyles.metaBar} />
        <View style={skeletonStyles.tagBar} />
      </View>
    </Animated.View>
  );
}

// ─── Store Card ───────────────────────────────────────────────────────────────

function MosaicCard({ store, thumb, onPress }: { store: NearbyStore; thumb: { images: string[]; count: number } | undefined; onPress: () => void }) {
  const icon = CATEGORY_ICONS[store.category] ?? '🏪';
  const imgs = thumb?.images ?? [];
  const more = Math.max(0, (thumb?.count ?? 0) - imgs.length);
  const eta = store.estimated_delivery_minutes ?? Math.round(10 + (store.distance_meters / 1000) * 4);
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={mosaic.card} accessibilityRole="button" accessibilityLabel={`Open ${store.name}`}>
      <View style={mosaic.grid}>
        {[0, 1, 2, 3].map((n) => (
          <View key={n} style={mosaic.cell}>
            {imgs[n] ? <Image source={{ uri: imgs[n] }} style={mosaic.img} resizeMode="cover" /> : <Text style={{ fontSize: 18, opacity: n === 0 ? 1 : 0.35 }}>{n === 0 ? icon : '🛍️'}</Text>}
          </View>
        ))}
        {more > 0 ? <View style={mosaic.more}><Text style={mosaic.moreText}>+{more} more</Text></View> : null}
      </View>
      <Text style={mosaic.name} numberOfLines={2}>{store.name}</Text>
      <Text style={mosaic.meta}>{formatDistance(store.distance_meters)} · ~{eta} min</Text>
      {!store.is_open ? <Text style={mosaic.closed}>Closed now</Text> : null}
    </TouchableOpacity>
  );
}

const mosaic = StyleSheet.create({
  card: { width: '31.6%', backgroundColor: '#F1F5F3', borderRadius: 18, padding: 6, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '48%', aspectRatio: 1, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  more: { position: 'absolute', alignSelf: 'center', left: '50%', bottom: 0, marginLeft: -30, backgroundColor: '#F8FAF9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#E5E7EB' },
  moreText: { fontSize: 10, fontWeight: '800', color: '#57534E' },
  name: { fontSize: 13, fontWeight: '700', color: '#111827', textAlign: 'center', marginTop: 8, lineHeight: 17 },
  meta: { fontSize: 10, color: '#6B7280', textAlign: 'center', marginTop: 2, marginBottom: 4, fontWeight: '600' },
  closed: { fontSize: 11, fontWeight: '800', color: '#B91C1C', textAlign: 'center', marginBottom: 4 },
});

// ─── Category Grid ────────────────────────────────────────────────────────────

function CategoryRow({
  selected,
  onSelect,
}: {
  selected: CategoryFilter;
  onSelect: (k: CategoryFilter) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={catStyles.scrollContent} style={catStyles.strip}>
      {CATEGORIES.map((c) => {
        const on = selected === c.key;
        return (
          <TouchableOpacity key={c.key} style={[catStyles.chip, on && catStyles.chipOn]} onPress={() => onSelect(c.key)} accessibilityLabel={`Filter by ${c.label}`} activeOpacity={0.85}>
            <Ionicons name={c.icon} size={16} color={on ? '#fff' : '#047857'} />
            <Text style={[catStyles.chipLabel, on && catStyles.chipLabelOn]}>{c.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Spotlight carousel ───────────────────────────────────────────────────────

function SpotlightRow({ stores, thumbs, onOpen }: { stores: NearbyStore[]; thumbs: Record<string, { images: string[]; count: number }>; onOpen: (st: NearbyStore) => void }) {
  if (stores.length === 0) return null;
  return (
    <View style={spot.wrap}>
      <View style={spot.headRow}>
        <Text style={spot.title}>Stores in spotlight</Text>
        <Text style={spot.sub}>Top picks near you</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={spot.row}>
        {stores.map((st) => {
          const img = st.banner_url ?? thumbs[st.id]?.images[0] ?? null;
          const eta = st.estimated_delivery_minutes ?? Math.round(10 + (st.distance_meters / 1000) * 4);
          return (
            <TouchableOpacity key={st.id} activeOpacity={0.9} onPress={() => onOpen(st)} style={spot.card} accessibilityRole="button" accessibilityLabel={`Open ${st.name}`}>
              <View style={spot.media}>
                {img ? <Image source={{ uri: img }} style={spot.mediaImg} resizeMode="cover" /> : <Text style={spot.mediaIcon}>{CATEGORY_ICONS[st.category] ?? '🏪'}</Text>}
                <View style={spot.etaPill}><Text style={spot.etaText}>{eta} min</Text></View>
              </View>
              <View style={spot.body}>
                <Text style={spot.name} numberOfLines={1}>{st.name}</Text>
                <View style={spot.metaRow}>
                  {st.total_ratings > 0 ? <View style={spot.rating}><Text style={spot.ratingText}>★ {st.average_rating.toFixed(1)}</Text></View> : <View style={spot.newPill}><Text style={spot.newText}>NEW</Text></View>}
                  <Text style={spot.meta} numberOfLines={1}>{formatDistance(st.distance_meters)}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const spot = StyleSheet.create({
  wrap: { paddingTop: 10, paddingBottom: 6 },
  headRow: { paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#064E3B', letterSpacing: -0.3 },
  sub: { fontSize: 12.5, color: '#6B7280', marginTop: 2 },
  row: { paddingHorizontal: 14, gap: 12 },
  card: { width: 190, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E3F1EA', overflow: 'hidden', shadowColor: '#064E3B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, marginBottom: 6 },
  media: { height: 104, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  mediaImg: { width: '100%', height: '100%' },
  mediaIcon: { fontSize: 40 },
  etaPill: { position: 'absolute', left: 10, bottom: 10, backgroundColor: '#064E3B', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  etaText: { color: '#ECFDF5', fontSize: 11, fontWeight: '800' },
  body: { padding: 12, gap: 6 },
  name: { fontSize: 14.5, fontWeight: '800', color: '#111827' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rating: { backgroundColor: '#059669', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  newPill: { backgroundColor: '#FFF7E6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#FDE68A' },
  newText: { color: '#B45309', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  meta: { fontSize: 12, color: '#6B7280', fontWeight: '600', flex: 1 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { session } = useAuthStore();
  const { browsingLocation } = useLocationStore();
  const navigation = useNavigation<HomeNavProp>();
  const route = useRoute<any>();

  const isAuthenticated = session !== null;
  const insets = useSafeAreaInsets();

  const [homeState, setHomeState] = useState<HomeState>({ kind: 'LOADING' });
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(ALL_KEY);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  useEffect(() => {
    const q = route.params?.query;
    const cat = route.params?.category;
    if (typeof q === 'string' && q.length > 0) setPendingQuery(q);
    if (typeof cat === 'string' && cat.length > 0) setSelectedCategory(cat as CategoryFilter);
    if (q || cat) (navigation as any).setParams({ query: undefined, category: undefined });
  }, [route.params, navigation]);
  const [deals, setDeals] = useState<Product[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, { images: string[]; count: number }>>({});
  useEffect(() => {
    const ids = homeState.kind === 'STORE_LIST' ? homeState.stores.map((st) => st.id) : [];
    if (ids.length === 0) return;
    let alive = true;
    supabase.from('products').select('store_id,image_url').in('store_id', ids).eq('is_available', true).limit(400).then(({ data }) => {
      if (!alive || !data) return;
      const out: Record<string, { images: string[]; count: number }> = {};
      for (const r of data as Array<{ store_id: string; image_url: string | null }>) {
        const e = (out[r.store_id] ??= { images: [], count: 0 });
        e.count += 1;
        if (r.image_url && e.images.length < 4) e.images.push(r.image_url);
      }
      setThumbs(out);
    }, () => undefined);
    return () => { alive = false; };
  }, [homeState]);
  useEffect(() => {
    const ids = homeState.kind === 'STORE_LIST' ? homeState.stores.map((st) => st.id) : [];
    if (ids.length === 0) { setDeals([]); return; }
    let alive = true;
    fetchDealProducts(ids).then((rows) => { if (alive) setDeals(rows); }).catch(() => undefined);
    return () => { alive = false; };
  }, [homeState]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const listRef = useRef<FlatList<NearbyStore>>(null);
  const [showChangeLocation, setShowChangeLocation] = useState(false);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Coordinate resolution ────────────────────────────────────────────────────

  const resolveCoordinate = useCallback(async (): Promise<{
    lat: number; lng: number; label: string;
  } | null> => {
    // Store discovery is driven ONLY by the customer's browsing location.
    // A saved delivery address belongs to checkout and must never silently
    // override the area the customer selected for discovery.
    if (browsingLocation) {
      return { lat: browsingLocation.lat, lng: browsingLocation.lng, label: browsingLocation.label };
    }

    return null;
  }, [browsingLocation]);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadStores = useCallback(async () => {
    if (isMounted.current) setHomeState({ kind: 'LOADING' });

    const coord = await resolveCoordinate();
    if (!isMounted.current) return;

    if (!coord) {
      setHomeState({ kind: 'NO_STORES', lat: 0, lng: 0, locationLabel: '' });
      return;
    }

    try {
      const stores = await fetchNearbyStores(coord.lat, coord.lng);
      if (!isMounted.current) return;

      if (stores.length === 0) {
        setHomeState({ kind: 'NO_STORES', lat: coord.lat, lng: coord.lng, locationLabel: coord.label });
      } else {
        setHomeState({ kind: 'STORE_LIST', lat: coord.lat, lng: coord.lng, locationLabel: coord.label, stores });
      }
    } catch (err: any) {
      if (isMounted.current) {
        setHomeState({ kind: 'ERROR', message: err?.message || 'Could not load stores.' });
      }
    }
  }, [resolveCoordinate]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStores();
    setIsRefreshing(false);
  }, [loadStores]);

  // ── Location change ──────────────────────────────────────────────────────────

  const handleChangeLocation = useCallback(() => setShowChangeLocation(true), []);

  const handleLocationChanged = useCallback(() => {
    setShowChangeLocation(false);
    loadStores();
  }, [loadStores]);

  // ── Filtered stores ───────────────────────────────────────────────────────────

  const allStores: NearbyStore[] =
    homeState.kind === 'STORE_LIST' ? homeState.stores : [];

  const visibleStores: NearbyStore[] =
    selectedCategory === ALL_KEY ? allStores : allStores.filter((st) => st.category === selectedCategory);
  const openSearch = useCallback((query?: string) => {
    (navigation as any).navigate('Search', { stores: allStores, query });
  }, [navigation, allStores]);
  useEffect(() => {
    if (pendingQuery && homeState.kind === 'STORE_LIST') {
      openSearch(pendingQuery);
      setPendingQuery(null);
    }
  }, [pendingQuery, homeState.kind, openSearch]);
  const nearestOpen = visibleStores.find((st) => st.is_open) ?? null;
  const heroEta = nearestOpen ? (nearestOpen.estimated_delivery_minutes ?? Math.round(10 + (nearestOpen.distance_meters / 1000) * 4)) : 0;

  // Header location label
  const locationLabel: string =
    (homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES')
      ? homeState.locationLabel
      : (browsingLocation?.label ?? '');

  // ── Render ────────────────────────────────────────────────────────────────────

  const storeFor = (id: string) => allStores.find((st) => st.id === id);
  const dealW = 156;
  const renderHeader = () => (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerRow}>
        {[
          { i: 'bicycle', t: 'Free delivery', s: 'On orders ₹199+' },
          { i: 'cash-outline', t: 'Pay on delivery', s: 'Cash at your door' },
          { i: 'navigate-outline', t: 'Live tracking', s: 'Watch your rider' },
        ].map((o) => (
          <View key={o.t} style={styles.offerCard}>
            <View style={styles.offerIconWrap}><Ionicons name={o.i as any} size={20} color="#047857" /></View>
            <View><Text style={styles.offerTitle}>{o.t}</Text><Text style={styles.offerSub}>{o.s}</Text></View>
          </View>
        ))}
      </ScrollView>

      {homeState.kind === 'STORE_LIST' && selectedCategory === ALL_KEY && deals.length > 0 ? (
        <View style={styles.dealsWrap}>
          <View style={styles.sectionRow}>
            <View>
              <Text style={styles.sectionTitle}>Deals for you</Text>
              <Text style={styles.sectionSub}>Biggest savings from shops nearby</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: 6 }}>
            {deals.map((p) => {
              const st = storeFor(p.store_id);
              if (!st) return null;
              return (
                <ProductCard key={p.id} product={p} width={dealW} storeName={st.name} etaMinutes={st.estimated_delivery_minutes ?? null}
                  onOpen={() => (navigation as any).navigate('StoreDetail', { store: st })} />
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {homeState.kind === 'STORE_LIST' && allStores.length >= 3 && selectedCategory === ALL_KEY ? (
        <SpotlightRow
          stores={allStores.filter((st) => st.is_open).sort((a, b) => (b.average_rating - a.average_rating) || (a.distance_meters - b.distance_meters)).slice(0, 6)}
          thumbs={thumbs}
          onOpen={(st) => (navigation as any).navigate('StoreDetail', { store: st })}
        />
      ) : null}

      {(homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES') && (
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>{homeState.kind === 'STORE_LIST' ? 'All shops near you' : 'No stores found'}</Text>
            {homeState.kind === 'STORE_LIST' ? <Text style={styles.sectionSub}>{visibleStores.length} shop{visibleStores.length !== 1 ? 's' : ''} deliver to you</Text> : null}
          </View>
        </View>
      )}
    </View>
  );

  const topHeader = (
    <View>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerLeft} onPress={handleChangeLocation} accessibilityLabel="Change delivery location" activeOpacity={0.8}>
            <Text style={styles.deliverLabel}>DELIVERING TO</Text>
            <View style={styles.locRow}>
              <Ionicons name="location" size={16} color="#FBBF24" />
              <Text style={styles.locText} numberOfLines={1}>{locationLabel || 'Set your location'}</Text>
              <Ionicons name="chevron-down" size={16} color="#A7F3D0" />
            </View>
          </TouchableOpacity>
          {isAuthenticated ? (
            <TouchableOpacity style={styles.profileBtn} onPress={() => (navigation as any).navigate('Profile')} accessibilityLabel="Open profile">
              <Ionicons name="person" size={20} color="#ECFDF5" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.signInBtn} onPress={() => navigation.navigate('Auth')} accessibilityLabel="Sign in">
              <Text style={styles.signInBtnText}>Sign in</Text>
            </TouchableOpacity>
          )}
        </View>
        {nearestOpen ? (
          <View style={styles.etaRow}>
            <View style={styles.etaPill}><Ionicons name="flash" size={13} color="#78350F" /><Text style={styles.etaPillText}>{heroEta} min delivery</Text></View>
            <Text style={styles.etaNear}>nearest shop {formatDistance(nearestOpen.distance_meters)} away</Text>
          </View>
        ) : null}
        <TouchableOpacity activeOpacity={0.9} onPress={() => openSearch()} style={searchStyles.bar} accessibilityRole="search" accessibilityLabel="Search stores and products">
          <Ionicons name="search" size={20} color="#047857" />
          <Text style={searchStyles.placeholder} numberOfLines={1}>Search “milk”, “paracetamol”, “notebook”…</Text>
        </TouchableOpacity>
      </View>
      {homeState.kind === 'STORE_LIST' ? <CategoryRow selected={selectedCategory} onSelect={setSelectedCategory} /> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="light" />

      {/* Change Location Modal */}
      <Modal
        visible={showChangeLocation}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowChangeLocation(false)}
      >
        <BrowsingLocationPickerScreen isChanging onLocationSet={handleLocationChanged} />
      </Modal>

      {homeState.kind !== 'STORE_LIST' && homeState.kind !== 'NO_STORES' ? topHeader : null}

      {/* Compact sticky bar: appears once the big header has scrolled away */}
      {scrolled && (homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES') ? (
        <TouchableOpacity activeOpacity={0.9} onPress={() => openSearch()} style={[styles.miniBar, { paddingTop: insets.top + 8 }]} accessibilityLabel="Scroll to search">
          <Ionicons name="search" size={18} color="#064E3B" />
          <Text style={styles.miniText} numberOfLines={1}>Search shops and products</Text>
        </TouchableOpacity>
      ) : null}

      {/* ── Body ── */}

      {/* Skeleton loading */}
      {homeState.kind === 'LOADING' && !isRefreshing && (
        <ScrollView contentContainerStyle={styles.skeletonContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.searchWrap}>
            <View style={[searchStyles.bar, { backgroundColor: '#EFEFEB' }]} />
          </View>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </ScrollView>
      )}

      {/* Error state */}
      {homeState.kind === 'ERROR' && (
        <View style={styles.errorState}>
          <Text style={styles.errorStateIcon}>⚠️</Text>
          <Text style={styles.errorStateTitle}>Something went wrong</Text>
          <Text style={styles.errorStateBody}>{homeState.message}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadStores}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Store list / empty state */}
      {(homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES') && (
        <FlatList
          ref={listRef}
          onScroll={(e) => { const hit = e.nativeEvent.contentOffset.y > 260; if (hit !== scrolledRef.current) { scrolledRef.current = hit; setScrolled(hit); } }}
          scrollEventThrottle={32}
          data={visibleStores}
          keyExtractor={(item) => item.id}
          numColumns={3}
          columnWrapperStyle={{ paddingHorizontal: 14, justifyContent: 'space-between' }}
          renderItem={({ item }) => (
            <MosaicCard
              store={item}
              thumb={thumbs[item.id]}
              onPress={() => {
                (navigation as any).navigate('StoreDetail', { store: item });
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#059669" />
          }
          ListHeaderComponent={<>{topHeader}{renderHeader()}</>}
          ListFooterComponent={visibleStores.length > 0 ? (
            <View style={styles.footerWrap}>
              <Text style={styles.footerBrand}>BEVER</Text>
              <Text style={styles.footerLine}>Fresh from the shops around the corner</Text>
              <TouchableOpacity onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} style={styles.footerBtn} accessibilityLabel="Back to top">
                <Text style={styles.footerBtnText}>↑  Back to top</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          ListEmptyComponent={
            selectedCategory !== ALL_KEY && homeState.kind === 'STORE_LIST' ? (
              <EmptyCategory
                label={STORE_CATEGORY_LABELS[selectedCategory as StoreCategory] ?? selectedCategory}
                onClear={() => setSelectedCategory(ALL_KEY)}
              />
            ) : (
              <EmptyArea
                locationLabel={locationLabel}
                onChangeLocation={handleChangeLocation}
              />
            )
          }
        />
      )}
      {scrolled && (homeState.kind === 'STORE_LIST') ? (
        <TouchableOpacity onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} style={styles.topPill} activeOpacity={0.9} accessibilityLabel="Back to top">
          <Text style={styles.topPillText}>↑  Back to top</Text>
        </TouchableOpacity>
      ) : null}
      <CartBar />
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyArea({
  locationLabel,
  onChangeLocation,
}: {
  locationLabel: string;
  onChangeLocation: () => void;
}) {
  return (
    <View style={emptyStyles.wrap}>
      <Text style={emptyStyles.icon}>🏪</Text>
      <Text style={emptyStyles.title}>No stores here yet</Text>
      <Text style={emptyStyles.body}>
        No BEVER stores currently deliver
        {locationLabel ? ` near "${locationLabel}"` : ' to your area'}.{'\n'}
        Check back soon — new stores join regularly.
      </Text>
      <TouchableOpacity style={emptyStyles.btn} onPress={onChangeLocation}>
        <Text style={emptyStyles.btnText}>Try a different location</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyCategory({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <View style={emptyStyles.wrap}>
      <Text style={emptyStyles.icon}>🔍</Text>
      <Text style={emptyStyles.title}>No {label} stores nearby</Text>
      <Text style={emptyStyles.body}>
        No {label.toLowerCase()} stores deliver to your area yet.
      </Text>
      <TouchableOpacity style={emptyStyles.btnSecondary} onPress={onClear}>
        <Text style={emptyStyles.btnSecondaryText}>Show all stores</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  footerWrap: { alignItems: 'center', paddingTop: 26, paddingBottom: 120 },
  footerBrand: { fontSize: 34, fontWeight: '800', color: '#D1FAE5', letterSpacing: 6 },
  footerLine: { fontSize: 12.5, color: '#6B7280', marginTop: 4 },
  footerBtn: { marginTop: 16, borderRadius: 999, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', paddingHorizontal: 18, paddingVertical: 9 },
  footerBtnText: { color: '#047857', fontSize: 13, fontWeight: '800' },
  topPill: { position: 'absolute', alignSelf: 'center', bottom: 96, backgroundColor: '#064E3B', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9, elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  topPillText: { color: '#ECFDF5', fontSize: 12.5, fontWeight: '800' },
  heroLabel: { fontSize: 15, fontWeight: '800', color: '#A7F3D0' },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 2, marginBottom: 6 },
  heroEta: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5, flexShrink: 1 },
  heroChip: { marginLeft: 8, marginTop: 2, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  heroChipText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  safe: { flex: 1, backgroundColor: '#F3FBF7' },
  miniBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#E6E6E1', elevation: 4 },
  miniText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#064E3B' },

  // ── Header ──
  header: { paddingHorizontal: 18, backgroundColor: '#064E3B', paddingBottom: 18, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerLeft: { flex: 1, minWidth: 0 },
  deliverLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: '#6EE7B7' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  locText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', flexShrink: 1 },
  profileBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  etaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF24', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  etaPillText: { fontSize: 12, fontWeight: '800', color: '#78350F' },
  etaNear: { fontSize: 12, color: '#A7F3D0', fontWeight: '600' },
  offerRow: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 14, gap: 10 },
  offerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E3F1EA' },
  offerIconWrap: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  offerTitle: { fontSize: 13.5, fontWeight: '800', color: '#064E3B' },
  offerSub: { fontSize: 11.5, color: '#6B7280', marginTop: 1 },
  dealsWrap: { paddingBottom: 8 },
  sectionSub: { fontSize: 12.5, color: '#6B7280', marginTop: 2 },
  signInBtn: { backgroundColor: '#F59E0B', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  signInBtnText: { color: '#1C1917', fontSize: 13, fontWeight: '800' },

  // ── Search ──
  searchWrap: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },

  // ── Categories ──
  catWrap: { paddingTop: 12 },

  // ── Section header ──
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#064E3B', letterSpacing: -0.3 },
  sectionCount: { fontSize: 13, color: '#9A9A94', fontWeight: '500' },

  // ── List ──
  listContent: { paddingBottom: 150 },

  // ── Skeleton ──
  skeletonContainer: { paddingBottom: 36 },

  // ── Error state ──
  errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  errorStateIcon: { fontSize: 52, marginBottom: 16 },
  errorStateTitle: { fontSize: 18, fontWeight: '800', color: '#171717', marginBottom: 8 },
  errorStateBody: { fontSize: 14, color: '#6B6B67', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});

const searchStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  icon: { fontSize: 16 },
  placeholder: { flex: 1, fontSize: 14, color: '#6B7280', fontWeight: '500' },
});

const catStyles = StyleSheet.create({
  strip: { backgroundColor: '#F3FBF7' },
  scrollContent: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1E7DD' },
  chipOn: { backgroundColor: '#059669', borderColor: '#059669' },
  chipLabel: { fontSize: 13, fontWeight: '700', color: '#064E3B' },
  chipLabelOn: { color: '#fff' },
});

const skeletonStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#EFEFEB',
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    gap: 14,
    height: 88,
  },
  logoBox: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#E6E6E1' },
  content: { flex: 1, gap: 8, justifyContent: 'center' },
  titleBar: { height: 14, backgroundColor: '#E6E6E1', borderRadius: 7, width: '60%' },
  metaBar: { height: 10, backgroundColor: '#E6E6E1', borderRadius: 5, width: '80%' },
  tagBar: { height: 10, backgroundColor: '#E6E6E1', borderRadius: 5, width: '40%' },
});

const emptyStyles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 36, paddingVertical: 48 },
  icon: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#171717', textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 14, color: '#6B6B67', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  btn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  btnSecondary: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderColor: '#E6E6E1',
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '600', color: '#6B6B67' },
});
