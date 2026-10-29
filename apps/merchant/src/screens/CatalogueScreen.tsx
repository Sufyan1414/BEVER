import React, { useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Chip, EmptyState, Skeleton } from '../components/ui';
import { rupees, timeAgo } from '../lib/format';
import { colors, radius } from '../theme';
import type { Product } from '../lib/types';

type Filter = 'all' | 'unavailable';
const STALE_DAYS = 7;

export function CatalogueScreen({ products, loading, refreshing, now, busyIds, onRefresh, onToggle, onEditPrice, onAdd, onEditPhoto }: {
  products: Product[]; loading: boolean; refreshing: boolean; now: number; busyIds: ReadonlySet<string>;
  onRefresh: () => void; onToggle: (p: Product, available: boolean) => void; onEditPrice: (p: Product) => void; onAdd: () => void; onEditPhoto?: (p: Product) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const unavailableCount = products.filter((p) => !p.is_available).length;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => (filter === 'all' || !p.is_available) && (!q || p.name.toLowerCase().includes(q)));
  }, [products, query, filter]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search your products" placeholderTextColor={colors.faint} style={styles.searchInput} accessibilityLabel="Search products" />
          {query ? <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
        </View>
        <Pressable onPress={onAdd} style={styles.add} accessibilityRole="button" accessibilityLabel="Add product"><Ionicons name="add" size={26} color="#FFFFFF" /></Pressable>
      </View>

      <View style={styles.chipRow}>
        <Chip label="All products" active={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Out of stock" active={filter === 'unavailable'} count={unavailableCount} onPress={() => setFilter('unavailable')} />
      </View>

      {loading ? (
        <><Skeleton height={76} /><Skeleton height={76} /><Skeleton height={76} /></>
      ) : products.length === 0 ? (
        <EmptyState icon="cube-outline" title="No products yet" body="Add the items you sell, or ask BEVER staff to list them from your photos and messages." action={<Button label="Add a product" icon="add" onPress={onAdd} />} />
      ) : shown.length === 0 ? (
        <EmptyState icon="search-outline" title={filter === 'unavailable' ? 'Everything is in stock' : 'No matching products'} body={filter === 'unavailable' ? 'Items you mark as out of stock will be listed here.' : 'Try a different spelling or clear the search.'} />
      ) : (
        shown.map((p) => {
          const ageDays = Math.floor((now - new Date(p.updated_at).getTime()) / 86400000);
          const stale = ageDays >= STALE_DAYS;
          return (
            <Card key={p.id} style={!p.is_available ? styles.off : undefined}>
              <View style={styles.row}>
                <Pressable onPress={() => onEditPhoto?.(p)} style={styles.thumb} accessibilityRole="button" accessibilityLabel={`Change photo of ${p.name}`}>
                  {p.image_url ? <Image source={{ uri: p.image_url }} style={styles.thumbImg} /> : <Ionicons name="camera-outline" size={22} color={colors.faint} />}
                </Pressable>
                <View style={{ flex: 1, paddingRight: 10, marginLeft: 12 }}>
                  <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
                  <Text style={styles.unit}>{p.unit}</Text>
                  <Pressable onPress={() => onEditPrice(p)} style={styles.priceBtn} accessibilityRole="button" accessibilityLabel={`Edit price of ${p.name}`}>
                    <Text style={styles.price}>{rupees(p.price)}</Text>
                    <Ionicons name="pencil" size={13} color={colors.brandDark} style={{ marginLeft: 6 }} />
                  </Pressable>
                  <Text style={[styles.updated, stale && { color: colors.brandDark, fontWeight: '800' }]}>
                    {stale ? `Not updated in ${ageDays} days · check price` : `Updated ${timeAgo(p.updated_at, now).toLowerCase()}`}
                  </Text>
                </View>
                <View style={styles.switchCol}>
                  <Switch
                    value={p.is_available}
                    onValueChange={(v) => onToggle(p, v)}
                    disabled={busyIds.has(p.id)}
                    trackColor={{ false: '#D6D3D1', true: colors.brand }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel={`${p.name} availability`}
                  />
                  <Text style={[styles.avail, !p.is_available && { color: colors.danger }]}>{p.is_available ? 'In stock' : 'Out of stock'}</Text>
                </View>
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  search: { flex: 1, height: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink, marginLeft: 8, paddingVertical: 0 },
  add: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  chipRow: { flexDirection: 'row', marginBottom: 14 },
  off: { backgroundColor: '#FAFAF9' },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 60, height: 60, borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 60, height: 60 },
  name: { fontSize: 15, fontWeight: '800', color: colors.ink },
  unit: { fontSize: 12, color: colors.muted, marginTop: 2 },
  priceBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 8, paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: colors.brandLine },
  price: { fontSize: 14, fontWeight: '900', color: colors.brandDark },
  updated: { fontSize: 11, color: colors.faint, marginTop: 8 },
  switchCol: { alignItems: 'center' },
  avail: { fontSize: 11, fontWeight: '800', color: colors.success, marginTop: 4 },
});
