import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type Tile = { label: string; emoji: string; tint: string; query: string };
type Section = { title: string; tiles: Tile[] };

const SECTIONS: Section[] = [
  {
    title: 'Grocery & Kitchen',
    tiles: [
      { label: 'Vegetables & Fruits', emoji: '🥦', tint: '#DCFCE7', query: 'vegetable' },
      { label: 'Atta, Rice & Dal', emoji: '🌾', tint: '#FEF3C7', query: 'atta' },
      { label: 'Oil, Ghee & Masala', emoji: '🫙', tint: '#FFEDD5', query: 'oil' },
      { label: 'Dairy, Bread & Eggs', emoji: '🥛', tint: '#E0F2FE', query: 'milk' },
      { label: 'Bakery & Biscuits', emoji: '🍪', tint: '#FEF3C7', query: 'biscuit' },
      { label: 'Dry Fruits & Cereals', emoji: '🥜', tint: '#FFEDD5', query: 'dry fruit' },
      { label: 'Chicken, Meat & Fish', emoji: '🍗', tint: '#FEE2E2', query: 'chicken' },
      { label: 'Kitchenware', emoji: '🍳', tint: '#E5E7EB', query: 'steel' },
    ],
  },
  {
    title: 'Snacks & Drinks',
    tiles: [
      { label: 'Chips & Namkeen', emoji: '🥔', tint: '#FEF3C7', query: 'chips' },
      { label: 'Sweets & Chocolates', emoji: '🍫', tint: '#F5E6DA', query: 'chocolate' },
      { label: 'Drinks & Juices', emoji: '🥤', tint: '#FFEDD5', query: 'juice' },
      { label: 'Tea, Coffee & Milk Drinks', emoji: '🍵', tint: '#DCFCE7', query: 'tea' },
      { label: 'Instant Food', emoji: '🍜', tint: '#FEF3C7', query: 'noodles' },
      { label: 'Sauces & Spreads', emoji: '🍯', tint: '#FEE2E2', query: 'sauce' },
      { label: 'Paan Corner', emoji: '🌿', tint: '#DCFCE7', query: 'paan' },
      { label: 'Ice Creams & More', emoji: '🍦', tint: '#FCE7F3', query: 'ice cream' },
    ],
  },
  {
    title: 'Home & Personal Care',
    tiles: [
      { label: 'Cleaning Essentials', emoji: '🧴', tint: '#E0F2FE', query: 'cleaner' },
      { label: 'Bath & Body', emoji: '🧼', tint: '#FCE7F3', query: 'soap' },
      { label: 'Hair Care', emoji: '💆', tint: '#EDE9FE', query: 'shampoo' },
      { label: 'Medicines', emoji: '💊', tint: '#DBEAFE', query: 'tablet' },
    ],
  },
];

export function CategoriesScreen() {
  const navigation = useNavigation<any>();
  const open = (query: string) => navigation.navigate('Home', { screen: 'HomeMain', params: { query } });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.top}>
        <Text style={styles.heading}>Categories</Text>
        <Text style={styles.headingSub}>Find anything from shops around you</Text>
        <TouchableOpacity activeOpacity={0.9} style={styles.search} onPress={() => navigation.navigate('Home', { screen: 'HomeMain', params: { search: true } })} accessibilityLabel="Search products">
          <Ionicons name="search" size={20} color="#26262A" />
          <Text style={styles.searchText}>Search atta, dal, milk and more</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHead}><View style={styles.sectionBar} /><Text style={styles.sectionTitle}>{section.title}</Text></View>
            <View style={styles.grid}>
              {section.tiles.map((t) => (
                <TouchableOpacity key={t.label} style={styles.tileWrap} activeOpacity={0.85} onPress={() => open(t.query)} accessibilityLabel={t.label}>
                  <View style={[styles.tile, { backgroundColor: t.tint }]}>
                    <Text style={styles.emoji}>{t.emoji}</Text>
                  </View>
                  <Text style={styles.label} numberOfLines={2}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  top: { backgroundColor: '#0B0B0C', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  heading: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headingSub: { fontSize: 12.5, color: '#E6E6E1', marginTop: 2, marginBottom: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: '#F59E0B' },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, height: 48, gap: 10 },
  searchText: { color: '#6B7280', fontSize: 14 },
  content: { paddingHorizontal: 14, paddingBottom: 40 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0B0B0C' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tileWrap: { width: '25%', paddingHorizontal: 5, marginBottom: 14, alignItems: 'center' },
  tile: { width: '100%', aspectRatio: 1, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(6,78,59,0.08)', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 34 },
  label: { fontSize: 11.5, fontWeight: '700', color: '#0B0B0C', textAlign: 'center', marginTop: 6, lineHeight: 15 },
});
