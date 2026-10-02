/**
 * BEVER Customer App — Home Screen
 *
 * Step 3B.1: Store discovery state machine.
 *
 * This screen resolves one of five mutually exclusive states on every render:
 *
 *   A  SIGNED_OUT          — user is not authenticated.
 *                            No address service or store service is called.
 *   B  LOADING             — async operations are in-flight.
 *   C  NO_ADDRESS          — authenticated, but no saved default address.
 *   D  NO_COORDINATES      — default address exists but location is NULL.
 *                            The address form does not yet capture coordinates,
 *                            so no actionable CTA is shown (see Step 3B.2).
 *   E  NO_STORES           — coordinate is known; RPC returned zero results.
 *   F  STORE_LIST          — coordinate is known; one or more stores returned.
 *
 * Coordinate source rule:
 *   Coordinates come ONLY from the authenticated user's default address
 *   (public.customer_addresses.location, stored as a PostGIS WKT string).
 *   No GPS, no hardcoded city centre, no invented values.
 *
 * Navigation:
 *   The Home tab lives inside AppTabs (a BottomTabNavigator inside a root
 *   NativeStackNavigator).  To navigate to the Auth modal the screen reaches
 *   up to the root navigator via useNavigation().
 *   To send the user to address management the screen switches to the Profile
 *   tab — AddressList lives inside ProfileNavigator, which is the Profile tab.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import { fetchDefaultAddress, parseLocationPoint } from '../../services/address';
import { fetchNearbyStores } from '../../services/store';
import type { CustomerAddress } from '../../types/address';
import type { NearbyStore, StoreCategory } from '../../types/store';
import { STORE_CATEGORY_LABELS } from '../../types/store';
import type { AppTabParamList } from '../../navigation/types';

// ─── Navigation typing ────────────────────────────────────────────────────────
// Home lives inside AppTabs (bottom tabs) which lives inside the root stack.
// We need access to both navigators: root for Auth modal, tabs for Profile tab.

type RootStackParamList = { Main: undefined; Auth: undefined };

type HomeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<AppTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ─── Screen states ────────────────────────────────────────────────────────────

type HomeState =
  | { kind: 'SIGNED_OUT' }
  | { kind: 'LOADING' }
  | { kind: 'NO_ADDRESS' }
  | { kind: 'NO_COORDINATES'; address: CustomerAddress }
  | { kind: 'NO_STORES';   lat: number; lng: number; address: CustomerAddress }
  | { kind: 'STORE_LIST';  lat: number; lng: number; address: CustomerAddress; stores: NearbyStore[] };

// ─── Category filter options ──────────────────────────────────────────────────

const ALL_CATEGORY = 'ALL' as const;
type CategoryFilter = StoreCategory | typeof ALL_CATEGORY;

const CATEGORY_PILLS: Array<{ key: CategoryFilter; label: string }> = [
  { key: ALL_CATEGORY, label: 'All' },
  { key: 'GROCERY',    label: STORE_CATEGORY_LABELS['GROCERY'] },
  { key: 'RESTAURANT', label: STORE_CATEGORY_LABELS['RESTAURANT'] },
  { key: 'PHARMACY',   label: STORE_CATEGORY_LABELS['PHARMACY'] },
  { key: 'BAKERY',     label: STORE_CATEGORY_LABELS['BAKERY'] },
  { key: 'OTHER',      label: 'Other' },
];

// ─── Distance formatting ──────────────────────────────────────────────────────

function formatDistance(metres: number): string {
  if (metres < 1000) {
    return `${Math.round(metres)} m`;
  }
  return `${(metres / 1000).toFixed(1)} km`;
}

// ─── Paise to rupee ──────────────────────────────────────────────────────────

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

// ─── Category icon fallback ───────────────────────────────────────────────────

const CATEGORY_ICONS: Record<StoreCategory, string> = {
  GROCERY:     '🛒',
  RESTAURANT:  '🍽️',
  PHARMACY:    '💊',
  BAKERY:      '🥐',
  ELECTRONICS: '📱',
  CLOTHING:    '👗',
  HARDWARE:    '🔧',
  STATIONERY:  '✏️',
  PET_SUPPLIES: '🐾',
  OTHER:       '🏪',
};

// ─── StoreCard ────────────────────────────────────────────────────────────────

interface StoreCardProps {
  store: NearbyStore;
}

function StoreCard({ store }: StoreCardProps) {
  const icon = CATEGORY_ICONS[store.category] ?? '🏪';
  const categoryLabel = STORE_CATEGORY_LABELS[store.category] ?? store.category;

  return (
    <View style={cardStyles.card}>
      {/* Icon / logo placeholder */}
      <View style={cardStyles.iconWrap}>
        <Text style={cardStyles.icon}>{icon}</Text>
      </View>

      {/* Main content */}
      <View style={cardStyles.content}>
        {/* Name row */}
        <View style={cardStyles.nameRow}>
          <Text style={cardStyles.name} numberOfLines={1}>{store.name}</Text>
          <View style={[cardStyles.openBadge, store.is_open ? cardStyles.open : cardStyles.closed]}>
            <Text style={[cardStyles.openBadgeText, store.is_open ? cardStyles.openText : cardStyles.closedText]}>
              {store.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        {/* Category + distance */}
        <View style={cardStyles.metaRow}>
          <Text style={cardStyles.category}>{categoryLabel}</Text>
          <Text style={cardStyles.dot}>·</Text>
          <Text style={cardStyles.distance}>{formatDistance(store.distance_meters)}</Text>
        </View>

        {/* Address */}
        <Text style={cardStyles.address} numberOfLines={1}>{store.address_text}</Text>

        {/* Rating + delivery info */}
        <View style={cardStyles.footerRow}>
          {store.total_ratings > 0 && (
            <View style={cardStyles.ratingChip}>
              <Text style={cardStyles.ratingText}>
                ⭐ {store.average_rating.toFixed(1)} ({store.total_ratings})
              </Text>
            </View>
          )}
          {store.estimated_delivery_minutes != null && (
            <View style={cardStyles.infoChip}>
              <Text style={cardStyles.infoChipText}>
                🕐 {store.estimated_delivery_minutes} min
              </Text>
            </View>
          )}
          {store.minimum_order_amount > 0 && (
            <View style={cardStyles.infoChip}>
              <Text style={cardStyles.infoChipText}>
                Min {formatRupees(store.minimum_order_amount)}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { session } = useAuthStore();
  const navigation = useNavigation<HomeNavProp>();

  const isAuthenticated = session !== null;

  const [homeState, setHomeState] = useState<HomeState>({ kind: 'LOADING' });
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(ALL_CATEGORY);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Prevent stale-closure issues when the component unmounts mid-fetch
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadStores = useCallback(async () => {
    // STATE A: unauthenticated — do not call any authenticated service
    if (!isAuthenticated) {
      if (isMounted.current) setHomeState({ kind: 'SIGNED_OUT' });
      return;
    }

    if (isMounted.current) setHomeState({ kind: 'LOADING' });

    try {
      // Fetch the customer's default delivery address (requires session)
      const address = await fetchDefaultAddress();

      if (!isMounted.current) return;

      if (!address) {
        // STATE C: authenticated but no saved default address
        setHomeState({ kind: 'NO_ADDRESS' });
        return;
      }

      // Try to extract coordinates from the PostGIS WKT location string
      const coords = parseLocationPoint(address.location);

      if (!coords) {
        // STATE D: address exists but has no coordinate
        // The address form does not yet support coordinate capture (Step 3B.2).
        // Show an informational state only — no actionable pin CTA.
        setHomeState({ kind: 'NO_COORDINATES', address });
        return;
      }

      // We have a valid coordinate — call the RPC
      const stores = await fetchNearbyStores(coords.lat, coords.lng);

      if (!isMounted.current) return;

      if (stores.length === 0) {
        // STATE E: coordinate known, but no stores service this location
        setHomeState({ kind: 'NO_STORES', lat: coords.lat, lng: coords.lng, address });
      } else {
        // STATE F: stores available
        setHomeState({ kind: 'STORE_LIST', lat: coords.lat, lng: coords.lng, address, stores });
      }
    } catch {
      // Network or database error — fall back to signed-out / error state
      // without crashing. Keep the last state if already loaded once.
      if (isMounted.current) {
        setHomeState(prev =>
          prev.kind === 'STORE_LIST' || prev.kind === 'NO_STORES' ? prev : { kind: 'SIGNED_OUT' }
        );
      }
    }
  }, [isAuthenticated]);

  // Run on mount and whenever auth state changes
  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadStores();
    setIsRefreshing(false);
  }, [loadStores]);

  // ── Filtered store list (in-memory) ─────────────────────────────────────────

  const visibleStores: NearbyStore[] =
    homeState.kind === 'STORE_LIST'
      ? selectedCategory === ALL_CATEGORY
        ? homeState.stores
        : homeState.stores.filter(s => s.category === selectedCategory)
      : [];

  // ── Delivery address label (shown in header chip when known) ────────────────

  const addressChipLabel: string | null =
    homeState.kind === 'STORE_LIST' ||
    homeState.kind === 'NO_STORES' ||
    homeState.kind === 'NO_COORDINATES'
      ? (homeState as { address: CustomerAddress }).address.label +
        ' · ' +
        (homeState as { address: CustomerAddress }).address.city
      : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.wordmark}>BEVER</Text>
          {addressChipLabel && (
            <TouchableOpacity
              style={styles.addressChip}
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Change delivery address"
            >
              <Text style={styles.addressChipIcon}>📍</Text>
              <Text style={styles.addressChipText} numberOfLines={1}>
                {addressChipLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {!isAuthenticated && (
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => navigation.navigate('Auth')}
            accessibilityLabel="Sign in to your BEVER account"
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── State-specific body ── */}
      {homeState.kind === 'SIGNED_OUT' && (
        <StateSignedOut onSignIn={() => navigation.navigate('Auth')} />
      )}

      {homeState.kind === 'LOADING' && !isRefreshing && (
        <StateLoading />
      )}

      {homeState.kind === 'NO_ADDRESS' && (
        <StateNoAddress onGoToProfile={() => navigation.navigate('Profile')} />
      )}

      {homeState.kind === 'NO_COORDINATES' && (
        <StateNoCoordinates
          address={homeState.address}
          onGoToProfile={() => navigation.navigate('Profile')}
        />
      )}

      {(homeState.kind === 'NO_STORES' || homeState.kind === 'STORE_LIST') && (
        <FlatList
          data={visibleStores}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <StoreCard store={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#F59E0B"
            />
          }
          ListHeaderComponent={
            <>
              {/* Category filter pills */}
              {homeState.kind === 'STORE_LIST' && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.pillsScroll}
                  contentContainerStyle={styles.pillsContent}
                >
                  {CATEGORY_PILLS.map(({ key, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.pill,
                        selectedCategory === key && styles.pillSelected,
                      ]}
                      onPress={() => setSelectedCategory(key)}
                      accessibilityLabel={`Filter by ${label}`}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          selectedCategory === key && styles.pillTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Delivery address info strip */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {homeState.kind === 'STORE_LIST'
                    ? 'Stores near you'
                    : 'No stores available'}
                </Text>
                {homeState.kind === 'STORE_LIST' && (
                  <Text style={styles.sectionCount}>
                    {visibleStores.length} store{visibleStores.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            </>
          }
          ListEmptyComponent={
            homeState.kind === 'STORE_LIST' && selectedCategory !== ALL_CATEGORY ? (
              <EmptyCategory
                category={STORE_CATEGORY_LABELS[selectedCategory as StoreCategory] ?? selectedCategory}
                onClear={() => setSelectedCategory(ALL_CATEGORY)}
              />
            ) : (
              <StateNoStores address={homeState.address} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── State sub-components ─────────────────────────────────────────────────────

function StateSignedOut({ onSignIn }: { onSignIn: () => void }) {
  return (
    <View style={emptyStyles.wrap}>
      <Text style={emptyStyles.icon}>🛍️</Text>
      <Text style={emptyStyles.heading}>Discover local stores</Text>
      <Text style={emptyStyles.body}>
        Sign in and add a delivery address to see stores that deliver to you.
      </Text>
      <TouchableOpacity
        style={emptyStyles.primaryButton}
        onPress={onSignIn}
        accessibilityLabel="Sign in or create a BEVER account"
      >
        <Text style={emptyStyles.primaryButtonText}>Sign In / Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

function StateLoading() {
  return (
    <View style={emptyStyles.wrap}>
      <ActivityIndicator size="large" color="#F59E0B" />
      <Text style={emptyStyles.loadingText}>Finding stores near you…</Text>
    </View>
  );
}

function StateNoAddress({ onGoToProfile }: { onGoToProfile: () => void }) {
  return (
    <View style={emptyStyles.wrap}>
      <Text style={emptyStyles.icon}>📍</Text>
      <Text style={emptyStyles.heading}>Add a delivery address</Text>
      <Text style={emptyStyles.body}>
        We need to know where you want your order delivered before we can show you
        nearby stores.
      </Text>
      <TouchableOpacity
        style={emptyStyles.primaryButton}
        onPress={onGoToProfile}
        accessibilityLabel="Go to profile to add a delivery address"
      >
        <Text style={emptyStyles.primaryButtonText}>Add Delivery Address</Text>
      </TouchableOpacity>
    </View>
  );
}

function StateNoCoordinates({
  address,
  onGoToProfile,
}: {
  address: CustomerAddress;
  onGoToProfile: () => void;
}) {
  return (
    <View style={emptyStyles.wrap}>
      <Text style={emptyStyles.icon}>🗺️</Text>
      <Text style={emptyStyles.heading}>Location not yet pinned</Text>
      <Text style={emptyStyles.body}>
        Your saved address{address.label ? ` "${address.label}"` : ''} doesn't
        have a precise location pin yet. Move the pin on the map to discover nearby stores.
      </Text>
      <TouchableOpacity
        style={emptyStyles.primaryButton}
        onPress={onGoToProfile}
        accessibilityLabel="Set delivery location on map"
      >
        <Text style={emptyStyles.primaryButtonText}>Set Location on Map</Text>
      </TouchableOpacity>
    </View>
  );
}

function StateNoStores({ address }: { address: CustomerAddress }) {
  return (
    <View style={emptyStyles.innerWrap}>
      <Text style={emptyStyles.icon}>🏪</Text>
      <Text style={emptyStyles.heading}>No stores deliver here yet</Text>
      <Text style={emptyStyles.body}>
        No stores currently deliver to{address.label ? ` "${address.label}"` : ''}{' '}
        in {address.city}. Check back soon — new stores are joining BEVER regularly.
      </Text>
    </View>
  );
}

function EmptyCategory({ category, onClear }: { category: string; onClear: () => void }) {
  return (
    <View style={emptyStyles.innerWrap}>
      <Text style={emptyStyles.icon}>🔍</Text>
      <Text style={emptyStyles.heading}>No {category} stores nearby</Text>
      <Text style={emptyStyles.body}>
        No {category.toLowerCase()} stores deliver to your address yet.
      </Text>
      <TouchableOpacity style={emptyStyles.secondaryButton} onPress={onClear}>
        <Text style={emptyStyles.secondaryButtonText}>Show all stores</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F4',
    backgroundColor: '#FFFBF5',
  },
  headerLeft: {
    flex: 1,
    gap: 6,
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 2,
  },
  addressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  addressChipIcon: {
    fontSize: 12,
  },
  addressChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    maxWidth: 200,
  },
  signInButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 12,
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 32,
  },
  pillsScroll: {
    marginTop: 14,
  },
  pillsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  pill: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
  },
  pillSelected: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78716C',
  },
  pillTextSelected: {
    color: '#92400E',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
  },
  sectionCount: {
    fontSize: 13,
    color: '#A8A29E',
    fontWeight: '500',
  },
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
  },
  openBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  open: {
    backgroundColor: '#D1FAE5',
  },
  closed: {
    backgroundColor: '#FEE2E2',
  },
  openBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  openText: {
    color: '#065F46',
  },
  closedText: {
    color: '#991B1B',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  category: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  dot: {
    fontSize: 12,
    color: '#D6D3D1',
  },
  distance: {
    fontSize: 12,
    color: '#78716C',
    fontWeight: '500',
  },
  address: {
    fontSize: 12,
    color: '#A8A29E',
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F4',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: {
    fontSize: 11,
    color: '#44403C',
    fontWeight: '500',
  },
  infoChip: {
    backgroundColor: '#F5F5F4',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  infoChipText: {
    fontSize: 11,
    color: '#78716C',
    fontWeight: '500',
  },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 60,
  },
  innerWrap: {
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingVertical: 48,
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#A8A29E',
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
  },
});
