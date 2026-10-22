/**
 * BEVER Customer App — Store Details & Product Catalogue Screen
 *
 * Displays store information (banner, logo, title, open status, distance)
 * and fetches the store's product categories and products from Supabase.
 *
 * Rules:
 *   - Price is stored in paise (₹1 = 100 paise) in database, displayed in Rupees.
 *   - Shows compare_at_price strikethrough if present.
 *   - Add button is rendered as non-interactive control (Task 1 scope restriction).
 *   - No fake/hardcoded products, ratings, or delivery estimates.
 *   - Safe handling of race conditions and unmounting.
 */

import { CartBar } from '../../components/CartBar';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Animated,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { StoreDetailProps } from '../../navigation/types';
import type { NearbyStore, ProductCategory, Product, StoreCategory } from '../../types/store';
import { STORE_CATEGORY_LABELS } from '../../types/store';
import { fetchStoreCategories, fetchStoreProducts } from '../../services/store';
import { useCartStore, computeCartSummary } from '../../stores/useCartStore';

const ALL_CATEGORY_KEY = 'ALL';

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

// ─── Skeleton Component ───────────────────────────────────────────────────────

function CatalogueSkeleton() {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.85] });

  return (
    <View style={skeletonStyles.container}>
      {[1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={[skeletonStyles.card, { opacity }]}>
          <View style={skeletonStyles.textGroup}>
            <View style={skeletonStyles.titleBar} />
            <View style={skeletonStyles.subBar} />
            <View style={skeletonStyles.priceBar} />
          </View>
          <View style={skeletonStyles.imgBox} />
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Component Implementation ─────────────────────────────────────────────────

// ─── Cross-Store Conflict Dialog ──────────────────────────────────────────────

function ConflictDialog({
  visible,
  existingStoreName,
  onKeep,
  onClear,
}: {
  visible: boolean;
  existingStoreName: string;
  onKeep: () => void;
  onClear: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeep}
    >
      <View style={conflictStyles.overlay}>
        <View style={conflictStyles.card}>
          <Text style={conflictStyles.icon}>🛒</Text>
          <Text style={conflictStyles.title}>Start a new cart?</Text>
          <Text style={conflictStyles.body}>
            Your cart has items from{' '}
            <Text style={conflictStyles.storeName}>{existingStoreName}</Text>.
            {' '}Adding this item will clear your current cart.
          </Text>
          <TouchableOpacity style={conflictStyles.clearBtn} onPress={onClear}>
            <Text style={conflictStyles.clearBtnText}>Clear cart & add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={conflictStyles.keepBtn} onPress={onKeep}>
            <Text style={conflictStyles.keepBtnText}>Keep current cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Component Implementation ─────────────────────────────────────────────────

export function StoreDetailScreen({ route, navigation }: StoreDetailProps) {
  const store: NearbyStore = route.params.store;

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_CATEGORY_KEY);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Cart ────────────────────────────────────────────────────────────────────
  const { items, addItem, clearCartAndAdd, incrementItem, decrementItem } = useCartStore();
  const summary = computeCartSummary(items);

  // Pending product when cross-store conflict is detected
  const [conflictProduct, setConflictProduct] = useState<Product | null>(null);
  const [conflictExistingStore, setConflictExistingStore] = useState<string>('');

  /** Quantity of a product currently in the cart (0 if not present). */
  const getQty = useCallback(
    (productId: string) => items.find((i) => i.productId === productId)?.quantity ?? 0,
    [items],
  );

  const handleAdd = useCallback(
    (product: Product) => {
      const result = addItem(product, { id: store.id, name: store.name });
      if (result.kind === 'conflict') {
        setConflictExistingStore(result.existingStoreName);
        setConflictProduct(product);
      }
    },
    [addItem, store.id, store.name],
  );

  const handleConflictKeep = useCallback(() => {
    setConflictProduct(null);
  }, []);

  const handleConflictClear = useCallback(() => {
    if (conflictProduct) {
      clearCartAndAdd(conflictProduct, { id: store.id, name: store.name });
    }
    setConflictProduct(null);
  }, [conflictProduct, clearCartAndAdd, store.id, store.name]);

  const isMounted = useRef(true);

  const loadStoreData = useCallback(async () => {
    if (!store?.id) return;
    setIsLoading(true);
    setError(null);

    try {
      const [catsData, prodsData] = await Promise.all([
        fetchStoreCategories(store.id),
        fetchStoreProducts(store.id),
      ]);

      if (isMounted.current) {
        setCategories(catsData);
        setProducts(prodsData);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err?.message || 'Could not load store menu. Please check your connection.');
        setIsLoading(false);
      }
    }
  }, [store?.id]);

  useEffect(() => {
    isMounted.current = true;
    loadStoreData();
    return () => {
      isMounted.current = false;
    };
  }, [loadStoreData]);

  // ── Filter Products ─────────────────────────────────────────────────────────

  const normalizedProductQuery = productSearchQuery.trim().toLocaleLowerCase();
  const visibleProducts = products.filter((product) => {
    const matchesCategory = selectedCategory === ALL_CATEGORY_KEY || product.category_id === selectedCategory;
    const matchesQuery = !normalizedProductQuery ||
      [product.name, product.description ?? '', product.unit ?? '']
        .some((value) => value.toLocaleLowerCase().includes(normalizedProductQuery));
    return matchesCategory && matchesQuery;
  });

  const cartItemCount = summary.totalItems;

  const categoryLabel = STORE_CATEGORY_LABELS[store.category as StoreCategory] ?? store.category;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* Cross-store conflict dialog */}
      <ConflictDialog
        visible={conflictProduct !== null}
        existingStoreName={conflictExistingStore}
        onKeep={handleConflictKeep}
        onClear={handleConflictClear}
      />

      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Back to stores"
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle} numberOfLines={1}>
          {store.name}
        </Text>
        {/* Cart badge / placeholder */}
        {cartItemCount > 0 ? (
          <TouchableOpacity
            style={styles.cartBadge}
            onPress={() => (navigation as any).navigate('Cart')}
            accessibilityLabel={`View cart — ${cartItemCount} items`}
          >
            <Text style={styles.cartBadgeText}>🛒 {cartItemCount}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner Section */}
        <View style={styles.bannerWrap}>
          {store.banner_url ? (
            <Image source={{ uri: store.banner_url }} style={styles.bannerImg} resizeMode="cover" />
          ) : (
            <View style={styles.bannerFallback}>
              <Text style={styles.bannerEmoji}>🏪</Text>
            </View>
          )}

          {/* Status Badge */}
          <View style={[styles.openBadge, store.is_open ? styles.openBg : styles.closedBg]}>
            <View style={[styles.openDot, store.is_open ? styles.openDotColor : styles.closedDotColor]} />
            <Text style={[styles.openText, store.is_open ? styles.openTextColor : styles.closedTextColor]}>
              {store.is_open ? 'Open' : 'Closed'}
            </Text>
          </View>
        </View>

        {/* Store Info Card */}
        <View style={styles.storeInfoCard}>
          <View style={styles.storeTitleRow}>
            <Text style={styles.storeName}>{store.name}</Text>
          </View>

          {store.description ? (
            <Text style={styles.storeDesc}>{store.description}</Text>
          ) : null}

          <View style={styles.metaRow}>
            <View style={styles.catChip}>
              <Text style={styles.catChipText}>{categoryLabel}</Text>
            </View>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.metaText}>{formatDistance(store.distance_meters)} away</Text>

            {store.estimated_delivery_minutes != null && (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.metaText}>~{store.estimated_delivery_minutes} mins</Text>
              </>
            )}

            {store.minimum_order_amount > 0 && (
              <>
                <Text style={styles.dot}>·</Text>
                <Text style={styles.metaText}>Min {formatRupees(store.minimum_order_amount)}</Text>
              </>
            )}
          </View>

          {store.address_text ? (
            <Text style={styles.addressText} numberOfLines={2}>
              📍 {store.address_text}
            </Text>
          ) : null}
        </View>

        {/* Search within this store's real catalogue */}
        <View style={{ marginHorizontal: 18, marginTop: 8, marginBottom: 12, minHeight: 46, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#E7E7E0', backgroundColor: '#FFFFFF', paddingHorizontal: 13 }}>
          <Text style={{ fontSize: 19, color: '#77776F', marginRight: 9 }}>⌕</Text>
          <TextInput
            value={productSearchQuery}
            onChangeText={setProductSearchQuery}
            placeholder={'Search ' + store.name + ' catalogue'}
            placeholderTextColor="#96968E"
            autoCapitalize="none"
            returnKeyType="search"
            style={{ flex: 1, color: '#20201C', fontSize: 14, paddingVertical: 10 }}
            accessibilityLabel="Search products in this store"
          />
          {productSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setProductSearchQuery('')} accessibilityLabel="Clear product search">
              <Text style={{ color: '#77776F', fontSize: 20, paddingHorizontal: 4 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills Bar */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === ALL_CATEGORY_KEY && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(ALL_CATEGORY_KEY)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === ALL_CATEGORY_KEY && styles.categoryChipTextActive,
                ]}
              >
                All Products
              </Text>
            </TouchableOpacity>

            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isActive && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Section Heading */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Catalogue</Text>
          {!isLoading && (
            <Text style={styles.sectionCount}>
              {visibleProducts.length} item{visibleProducts.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Loading State */}
        {isLoading && <CatalogueSkeleton />}

        {/* Error State */}
        {error && !isLoading && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={loadStoreData}>
              <Text style={styles.retryBtnText}>Retry Loading Menu</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && !error && visibleProducts.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>{normalizedProductQuery ? '⌕' : '📦'}</Text>
            <Text style={styles.emptyTitle}>{normalizedProductQuery ? 'No matching products' : 'No products available'}</Text>
            <Text style={styles.emptySub}>
              {normalizedProductQuery
                ? 'Try another product name, description, or pack size.'
                : 'This store has not added any products to this category yet.'}
            </Text>
            {normalizedProductQuery.length > 0 && (
              <TouchableOpacity onPress={() => setProductSearchQuery('')} style={{ marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#ECFDF5' }}>
                <Text style={{ color: '#047857', fontWeight: '700' }}>Clear search</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Products List */}
        {!isLoading &&
          !error &&
          visibleProducts.map((product) => {
            const qty = getQty(product.id);
            return (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>

                  {product.unit ? (
                    <Text style={styles.productUnit}>{product.unit}</Text>
                  ) : null}

                  {product.description ? (
                    <Text style={styles.productDesc} numberOfLines={2}>
                      {product.description}
                    </Text>
                  ) : null}

                  <View style={styles.priceRow}>
                    <Text style={styles.productPrice}>{formatRupees(product.price)}</Text>
                    {product.compare_at_price && product.compare_at_price > product.price ? (
                      <Text style={styles.comparePrice}>
                        {formatRupees(product.compare_at_price)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.productRight}>
                  {product.image_url ? (
                    <Image
                      source={{ uri: product.image_url }}
                      style={styles.productImg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.productImgFallback}>
                      <Text style={styles.productImgEmoji}>🛍️</Text>
                    </View>
                  )}

                  {/* Add / Stepper control */}
                  {product.is_available ? (
                    qty === 0 ? (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => handleAdd(product)}
                        accessibilityLabel={`Add ${product.name} to cart`}
                      >
                        <Text style={styles.addBtnText}>+ ADD</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => decrementItem(product.id)}
                          accessibilityLabel={`Decrease ${product.name} quantity`}
                        >
                          <Text style={styles.stepperBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperQty}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => incrementItem(product.id)}
                          accessibilityLabel={`Increase ${product.name} quantity`}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    )
                  ) : (
                    <View style={styles.outOfStockBadge}>
                      <Text style={styles.outOfStockText}>Out of Stock</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
      </ScrollView>
      <CartBar />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3FBF7',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
    backgroundColor: '#F3FBF7',
  },
  topHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
    flex: 1,
    textAlign: 'center',
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 8,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
  },
  backBtnPlaceholder: {
    width: 48,
  },

  scrollContent: {
    paddingBottom: 110,
  },

  // Banner
  bannerWrap: {
    height: 140,
    position: 'relative',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerEmoji: {
    fontSize: 54,
  },

  openBadge: {
    position: 'absolute',
    top: 12,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  openBg: { backgroundColor: 'rgba(16,185,129,0.9)' },
  closedBg: { backgroundColor: 'rgba(239,68,68,0.9)' },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  openDotColor: { backgroundColor: '#FFFFFF' },
  closedDotColor: { backgroundColor: '#FFFFFF' },
  openText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  openTextColor: { color: '#FFFFFF' },
  closedTextColor: { color: '#FFFFFF' },

  // Store Info Card
  storeInfoCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    marginBottom: 16,
  },
  storeTitleRow: {
    marginBottom: 4,
  },
  storeName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1917',
  },
  storeDesc: {
    fontSize: 13,
    color: '#78716C',
    lineHeight: 18,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  catChip: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  dot: {
    fontSize: 12,
    color: '#D6D3D1',
  },
  metaText: {
    fontSize: 12,
    color: '#78716C',
    fontWeight: '500',
  },
  addressText: {
    fontSize: 12,
    color: '#A8A29E',
    marginTop: 2,
  },

  // Categories Scroll
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
  },
  categoryChipActive: {
    backgroundColor: '#D1FAE5',
    borderColor: '#059669',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78716C',
  },
  categoryChipTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
  },
  sectionCount: {
    fontSize: 13,
    color: '#A8A29E',
    fontWeight: '500',
  },

  // Product Card
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F0EFEE',
    gap: 12,
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    gap: 3,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
  },
  productUnit: {
    fontSize: 12,
    color: '#A8A29E',
    fontWeight: '500',
  },
  productDesc: {
    fontSize: 12,
    color: '#78716C',
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
  },
  comparePrice: {
    fontSize: 13,
    color: '#A8A29E',
    textDecorationLine: 'line-through',
  },

  productRight: {
    alignItems: 'center',
    gap: 8,
  },
  productImg: {
    width: 72,
    height: 72,
    borderRadius: 12,
  },
  productImgFallback: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImgEmoji: {
    fontSize: 28,
  },

  addBtn: {
    backgroundColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Quantity stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#059669',
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#047857',
    lineHeight: 20,
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
    minWidth: 22,
    textAlign: 'center',
  },

  // Cart badge
  cartBadge: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 48,
    alignItems: 'center',
  },
  cartBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  outOfStockBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },

  // Error state
  errorBox: {
    marginHorizontal: 20,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  errorIcon: { fontSize: 32 },
  errorText: { fontSize: 14, color: '#991B1B', textAlign: 'center' },
  retryBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  retryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Empty state
  emptyBox: {
    marginHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#1C1917' },
  emptySub: { fontSize: 13, color: '#78716C', textAlign: 'center' },
});

const skeletonStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F4',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    height: 96,
  },
  textGroup: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  titleBar: { height: 14, backgroundColor: '#E7E5E4', borderRadius: 7, width: '60%' },
  subBar: { height: 10, backgroundColor: '#E7E5E4', borderRadius: 5, width: '40%' },
  priceBar: { height: 12, backgroundColor: '#E7E5E4', borderRadius: 6, width: '30%' },
  imgBox: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#E7E5E4' },
});

const conflictStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,25,23,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 12,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  icon: { fontSize: 40 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 22,
  },
  storeName: {
    fontWeight: '700',
    color: '#1C1917',
  },
  clearBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  clearBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  keepBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
  },
  keepBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#78716C',
  },
});
