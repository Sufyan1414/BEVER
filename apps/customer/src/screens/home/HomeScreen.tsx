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
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Modal,
  Animated,
  Image,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLocationStore } from '../../stores/useLocationStore';
import { fetchNearbyStores, searchProducts, type ProductHit } from '../../services/store';
import { supabase } from '../../services/supabase';
import { BrowsingLocationPickerScreen } from '../location/BrowsingLocationPickerScreen';
import type { NearbyStore, StoreCategory } from '../../types/store';
import { STORE_CATEGORY_LABELS } from '../../types/store';
import type { AppTabParamList } from '../../navigation/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
};

const CATEGORIES: CategoryItem[] = [
  { key: ALL_KEY,      label: 'All',         emoji: '✨', color: '#059669' },
  { key: 'RESTAURANT', label: 'Food',        emoji: '🍽️',  color: '#EF4444' },
  { key: 'GROCERY',    label: 'Grocery',     emoji: '🛒', color: '#10B981' },
  { key: 'PHARMACY',   label: 'Pharmacy',    emoji: '💊', color: '#3B82F6' },
  { key: 'BAKERY',     label: 'Bakery',      emoji: '🥐', color: '#F97316' },
  { key: 'ELECTRONICS',label: 'Electronics', emoji: '📱', color: '#8B5CF6' },
  { key: 'CLOTHING',   label: 'Fashion',     emoji: '👗', color: '#EC4899' },
  { key: 'OTHER',      label: 'More',        emoji: '🏪', color: '#6B7280' },
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

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
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

function StoreCard({ store, onPress }: { store: NearbyStore; onPress: () => void }) {
  const icon = CATEGORY_ICONS[store.category] ?? '🏪';
  const categoryLabel = STORE_CATEGORY_LABELS[store.category] ?? store.category;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      accessibilityLabel={`Open ${store.name}`}
    >
      <Animated.View style={[cardStyles.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Banner / Logo area */}
        <View style={cardStyles.bannerWrap}>
          {store.banner_url ? (
            <Image source={{ uri: store.banner_url }} style={cardStyles.banner} resizeMode="cover" />
          ) : (
            <View style={[cardStyles.bannerFallback]}>
              <Text style={cardStyles.bannerEmoji}>{icon}</Text>
            </View>
          )}
          {/* Open/Closed badge */}
          <View style={[cardStyles.openBadge, store.is_open ? cardStyles.openBg : cardStyles.closedBg]}>
            <View style={[cardStyles.openDot, store.is_open ? cardStyles.openDotColor : cardStyles.closedDotColor]} />
            <Text style={[cardStyles.openText, store.is_open ? cardStyles.openTextColor : cardStyles.closedTextColor]}>
              {store.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        {/* Info area */}
        <View style={cardStyles.info}>
          {/* Logo overlay */}
          <View style={cardStyles.logoCircle}>
            {store.logo_url ? (
              <Image source={{ uri: store.logo_url }} style={cardStyles.logoImg} />
            ) : (
              <Text style={cardStyles.logoEmoji}>{icon}</Text>
            )}
          </View>

          <View style={cardStyles.infoContent}>
            <Text style={cardStyles.name} numberOfLines={1}>{store.name}</Text>

            <View style={cardStyles.metaRow}>
              <View style={cardStyles.catChip}>
                <Text style={cardStyles.catChipText}>{categoryLabel}</Text>
              </View>
              <Text style={cardStyles.dot}>·</Text>
              <Text style={cardStyles.distance}>
                {formatDistance(store.distance_meters)}
              </Text>
              {store.estimated_delivery_minutes != null && (
                <>
                  <Text style={cardStyles.dot}>·</Text>
                  <Text style={cardStyles.deliveryTime}>
                    ~{store.estimated_delivery_minutes} min
                  </Text>
                </>
              )}
            </View>

            {store.description ? (
              <Text style={cardStyles.description} numberOfLines={1}>
                {store.description}
              </Text>
            ) : null}

            <View style={cardStyles.footerRow}>
              {store.total_ratings > 0 && (
                <View style={cardStyles.ratingChip}>
                  <Text style={cardStyles.ratingStar}>⭐</Text>
                  <Text style={cardStyles.ratingValue}>
                    {store.average_rating.toFixed(1)}
                  </Text>
                  <Text style={cardStyles.ratingCount}>({store.total_ratings})</Text>
                </View>
              )}
              {store.minimum_order_amount > 0 && (
                <Text style={cardStyles.minOrder}>
                  Min {formatRupees(store.minimum_order_amount)}
                </Text>
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

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
            {imgs[n] ? <Image source={{ uri: imgs[n] }} style={mosaic.img} resizeMode="cover" /> : <Text style={{ fontSize: 22, opacity: n === 0 ? 1 : 0.35 }}>{n === 0 ? icon : '🛍️'}</Text>}
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
  card: { width: '48%', backgroundColor: '#ECFDF5', borderRadius: 22, padding: 8, marginBottom: 14, borderWidth: 1, borderColor: '#D1FAE5' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '48.5%', aspectRatio: 1, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  more: { position: 'absolute', alignSelf: 'center', left: '50%', bottom: 0, marginLeft: -34, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#D1FAE5' },
  moreText: { fontSize: 11, fontWeight: '800', color: '#57534E' },
  name: { fontSize: 15, fontWeight: '900', color: '#064E3B', textAlign: 'center', marginTop: 6, lineHeight: 20 },
  meta: { fontSize: 11, color: '#57534E', textAlign: 'center', marginTop: 2, marginBottom: 4, fontWeight: '600' },
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={catStyles.scrollContent}
    >
      {CATEGORIES.map((c) => {
        const isActive = selected === c.key;
        return (
          <TouchableOpacity
            key={c.key}
            style={[catStyles.chip, isActive && { borderColor: c.color, backgroundColor: `${c.color}15` }]}
            onPress={() => onSelect(c.key)}
            accessibilityLabel={`Filter by ${c.label}`}
          >
            <Text style={catStyles.chipEmoji}>{c.emoji}</Text>
            <Text style={[catStyles.chipLabel, isActive && { color: c.color, fontWeight: '700' }]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { session } = useAuthStore();
  const { browsingLocation } = useLocationStore();
  const navigation = useNavigation<HomeNavProp>();

  const isAuthenticated = session !== null;
  const insets = useSafeAreaInsets();

  const [homeState, setHomeState] = useState<HomeState>({ kind: 'LOADING' });
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(ALL_KEY);
  const [storeSearchQuery, setStoreSearchQuery] = useState('');
  const [productHits, setProductHits] = useState<ProductHit[]>([]);
  const [productSearching, setProductSearching] = useState(false);
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
    const q = storeSearchQuery.trim();
    const ids = homeState.kind === 'STORE_LIST' ? homeState.stores.map((st) => st.id) : [];
    if (q.length < 2 || ids.length === 0) { setProductHits([]); setProductSearching(false); return; }
    let alive = true;
    setProductSearching(true);
    const t = setTimeout(() => {
      searchProducts(ids, q)
        .then((hits) => { if (alive) setProductHits(hits); })
        .catch(() => { if (alive) setProductHits([]); })
        .finally(() => { if (alive) setProductSearching(false); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [storeSearchQuery, homeState]);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  const normalizedSearchQuery = storeSearchQuery.trim().toLocaleLowerCase();
  const categoryStores: NearbyStore[] =
    selectedCategory === ALL_KEY
      ? allStores
      : allStores.filter((s) => s.category === selectedCategory);
  const visibleStores: NearbyStore[] = categoryStores.filter((store) => {
    if (!normalizedSearchQuery) return true;
    const category = STORE_CATEGORY_LABELS[store.category] ?? store.category;
    return [store.name, store.description ?? '', store.address_text ?? '', category]
      .some((value) => value.toLocaleLowerCase().includes(normalizedSearchQuery));
  });
  const nearestOpen = visibleStores.find((st) => st.is_open) ?? null;
  const heroEta = nearestOpen ? (nearestOpen.estimated_delivery_minutes ?? Math.round(10 + (nearestOpen.distance_meters / 1000) * 4)) : 0;

  // Header location label
  const locationLabel: string =
    (homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES')
      ? homeState.locationLabel
      : (browsingLocation?.label ?? '');

  // ── Render ────────────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View>
      {/* Category row */}
      {homeState.kind === 'STORE_LIST' && (
        <View style={styles.catWrap}>
          <CategoryRow selected={selectedCategory} onSelect={setSelectedCategory} />
        </View>
      )}

      {/* Welcome banner + real offers only */}
      <View style={styles.banner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Fresh from your{'\n'}neighbourhood shops</Text>
          <Text style={styles.bannerSub}>Order now, pay cash on delivery</Text>
        </View>
        <Text style={{ fontSize: 64 }}>🛍️</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerRow}>
        <View style={styles.offerCard}><Text style={styles.offerIcon}>🛵</Text><View><Text style={styles.offerTitle}>FREE delivery</Text><Text style={styles.offerSub}>On orders of ₹199 and above</Text></View></View>
        <View style={styles.offerCard}><Text style={styles.offerIcon}>💵</Text><View><Text style={styles.offerTitle}>Pay on delivery</Text><Text style={styles.offerSub}>Cash when your order arrives</Text></View></View>
        <View style={styles.offerCard}><Text style={styles.offerIcon}>📍</Text><View><Text style={styles.offerTitle}>Live tracking</Text><Text style={styles.offerSub}>Watch your rider on the map</Text></View></View>
      </ScrollView>

      {/* Product search results (real products from nearby stores) */}
      {normalizedSearchQuery.length >= 2 && productHits.length > 0 && (
        <View style={{ paddingHorizontal: 20, marginTop: 6, marginBottom: 6 }}>
          <Text style={styles.sectionTitle}>Products</Text>
          {productHits.map((hit) => {
            const hitStore = allStores.find((st) => st.id === hit.store_id);
            return (
              <TouchableOpacity
                key={hit.id}
                activeOpacity={0.85}
                onPress={() => { if (hitStore) (navigation as any).navigate('StoreDetail', { store: hitStore }); }}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#E7E5E4' }}
                accessibilityLabel={`${hit.name} at ${hitStore?.name ?? 'store'}`}
              >
                <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {hit.image_url ? <Image source={{ uri: hit.image_url }} style={{ width: 52, height: 52 }} /> : <Text style={{ fontSize: 22 }}>🛍️</Text>}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#1C1917' }} numberOfLines={1}>{hit.name}{hit.unit ? ` · ${hit.unit}` : ''}</Text>
                  <Text style={{ fontSize: 12, color: '#78716C', marginTop: 2 }} numberOfLines={1}>{hitStore?.name ?? 'Nearby store'}</Text>
                </View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#047857' }}>₹{Math.round(hit.price / 100)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {normalizedSearchQuery.length >= 2 && productSearching && productHits.length === 0 && (
        <Text style={{ paddingHorizontal: 20, marginTop: 10, color: '#78716C', fontSize: 12 }}>Searching products…</Text>
      )}

      {/* Section heading */}
      {(homeState.kind === 'STORE_LIST' || homeState.kind === 'NO_STORES') && (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {homeState.kind === 'STORE_LIST' ? 'Stores near you' : 'No stores found'}
          </Text>
          {homeState.kind === 'STORE_LIST' && (
            <Text style={styles.sectionCount}>
              {visibleStores.length} store{visibleStores.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      )}
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

      {/* ── Top Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {nearestOpen ? (
            <>
              <Text style={styles.heroLabel}>BEVER delivers in</Text>
              <View style={styles.heroRow}>
                <Text style={styles.heroEta}>{heroEta} minutes</Text>
                <View style={styles.heroChip}><Text style={styles.heroChipText}>{formatDistance(nearestOpen.distance_meters)} away</Text></View>
              </View>
            </>
          ) : <Text style={styles.wordmark}>BEVER</Text>}
          {locationLabel ? (
            <TouchableOpacity
              style={styles.locationChip}
              onPress={handleChangeLocation}
              accessibilityLabel="Change browsing location"
            >
              <Text style={styles.locationChipPin}>📍</Text>
              <Text style={styles.locationChipText} numberOfLines={1}>
                {locationLabel}
              </Text>
              <Text style={styles.locationChipCaret}>›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.locationChip, styles.locationChipEmpty]}
              onPress={handleChangeLocation}
              accessibilityLabel="Set browsing location"
            >
              <Text style={styles.locationChipPin}>📍</Text>
              <Text style={[styles.locationChipText, styles.locationChipTextEmpty]}>
                Set your location
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!isAuthenticated && (
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={() => navigation.navigate('Auth')}
            accessibilityLabel="Sign in"
          >
            <Text style={styles.signInBtnText}>Sign In</Text>
          </TouchableOpacity>
        )}
        </View>
        <View style={styles.headerSearch}>

        <View style={searchStyles.bar}>
          <Text style={searchStyles.icon}>⌕</Text>
          <TextInput
            value={storeSearchQuery}
            onChangeText={setStoreSearchQuery}
            placeholder="Search stores and products"
            placeholderTextColor="#9A9A94"
            returnKeyType="search"
            autoCapitalize="none"
            style={{ flex: 1, color: '#20201C', fontSize: 14, paddingVertical: 0 }}
            accessibilityLabel="Search stores and products"
          />
          {storeSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setStoreSearchQuery('')} accessibilityLabel="Clear store search">
              <Text style={{ color: '#77776F', fontSize: 20, paddingHorizontal: 4 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>
        </View>
      </View>

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
          data={visibleStores}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 16, justifyContent: 'space-between' }}
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
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={
            storeSearchQuery.trim().length > 0 && homeState.kind === 'STORE_LIST' ? (
              <View style={{ alignItems: 'center', paddingHorizontal: 30, paddingTop: 44, paddingBottom: 60 }}>
                <Text style={{ fontSize: 32, marginBottom: 12 }}>⌕</Text>
                <Text style={{ fontSize: 17, fontWeight: '800', color: '#20201C', marginBottom: 7 }}>{productHits.length > 0 ? 'No matching stores' : `Nothing found for “${storeSearchQuery.trim()}”`}</Text>
                <Text style={{ fontSize: 13, color: '#77776F', lineHeight: 20, textAlign: 'center' }}>{productHits.length > 0 ? 'The products above match your search.' : 'Nearby shops do not list this yet. Try another word, or ask your local shop to add it to BEVER.'}</Text>
                <TouchableOpacity onPress={() => setStoreSearchQuery('')} style={{ marginTop: 16, backgroundColor: '#ECFDF5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: '#047857', fontWeight: '700' }}>Clear search</Text>
                </TouchableOpacity>
              </View>
            ) : selectedCategory !== ALL_KEY && homeState.kind === 'STORE_LIST' ? (
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
  heroLabel: { fontSize: 13, fontWeight: '800', color: '#A7F3D0' },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: 6 },
  heroEta: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  heroChip: { marginLeft: 10, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  heroChipText: { fontSize: 12, fontWeight: '800', color: '#fff' },
  safe: { flex: 1, backgroundColor: '#F7F7F3' },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#064E3B',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingBottom: 18,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSearch: { marginTop: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 14, padding: 18, borderRadius: 24, backgroundColor: '#059669' },
  bannerTitle: { fontSize: 22, fontWeight: '900', color: '#fff', lineHeight: 28 },
  bannerSub: { fontSize: 13, color: '#D1FAE5', marginTop: 6, fontWeight: '600' },
  offerRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  offerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF7E6', borderRadius: 18, borderWidth: 1, borderColor: '#FDE68A', paddingVertical: 12, paddingHorizontal: 14, minWidth: 220 },
  offerIcon: { fontSize: 26 },
  offerTitle: { fontSize: 14, fontWeight: '900', color: '#92400E' },
  offerSub: { fontSize: 12, color: '#B45309', marginTop: 1 },
  shopsTitle: { fontSize: 20, fontWeight: '900', color: '#064E3B', marginHorizontal: 18, marginTop: 6, marginBottom: 12 },
  headerLeft: { flex: 1, gap: 5 },
  wordmark: {
    fontSize: 26,
    fontWeight: '900',
    color: '#6EE7B7',
    letterSpacing: 3,
    lineHeight: 30,
  },

  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    maxWidth: SCREEN_WIDTH * 0.55,
  },
  locationChipEmpty: { backgroundColor: 'rgba(255,255,255,0.14)' },
  locationChipPin: { fontSize: 11 },
  locationChipText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF', flexShrink: 1 },
  locationChipTextEmpty: { color: '#D1FAE5' },
  locationChipCaret: { fontSize: 14, color: '#6EE7B7', fontWeight: '700' },

  signInBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 12,
  },
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
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#171717' },
  sectionCount: { fontSize: 13, color: '#9A9A94', fontWeight: '500' },

  // ── List ──
  listContent: { paddingBottom: 110 },

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
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E6E6E1',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  icon: { fontSize: 16 },
  placeholder: { fontSize: 14, color: '#9A9A94', fontWeight: '500' },
});

const catStyles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 20, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E6E6E1',
    backgroundColor: '#FFFFFF',
  },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 13, fontWeight: '600', color: '#6B6B67' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E4E4DE',
    elevation: 2,
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  // Banner
  bannerWrap: { height: 110, position: 'relative' },
  banner: { width: '100%', height: '100%' },
  bannerFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerEmoji: { fontSize: 48 },

  openBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  openBg: { backgroundColor: 'rgba(16,185,129,0.15)' },
  closedBg: { backgroundColor: 'rgba(239,68,68,0.12)' },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  openDotColor: { backgroundColor: '#10B981' },
  closedDotColor: { backgroundColor: '#EF4444' },
  openText: { fontSize: 11, fontWeight: '700' },
  openTextColor: { color: '#0F5E58' },
  closedTextColor: { color: '#991B1B' },

  // Info section
  info: { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'flex-start' },
  logoCircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexShrink: 0,
  },
  logoImg: { width: 48, height: 48, borderRadius: 12 },
  logoEmoji: { fontSize: 24 },

  infoContent: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '800', color: '#171717' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  catChip: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catChipText: { fontSize: 11, color: '#065F46', fontWeight: '600' },
  dot: { fontSize: 12, color: '#D6D3D1' },
  distance: { fontSize: 12, color: '#6B6B67', fontWeight: '500' },
  deliveryTime: { fontSize: 12, color: '#6B6B67' },
  description: { fontSize: 12, color: '#9A9A94', lineHeight: 16 },

  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  ratingChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingStar: { fontSize: 12 },
  ratingValue: { fontSize: 12, fontWeight: '700', color: '#171717' },
  ratingCount: { fontSize: 11, color: '#9A9A94' },
  minOrder: { fontSize: 11, color: '#6B6B67', fontWeight: '500' },
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
