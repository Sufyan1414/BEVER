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
        <TouchableOpacity activeOpacity={0.9} style={styles.search} onPress={() => navigation.navigate('Home')} accessibilityLabel="Search products">
          <Ionicons name="search" size={22} color="#111827" />
          <Text style={styles.searchText}>Search for atta, dal, milk and more</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
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
  top: { backgroundColor: '#ECFDF5', paddingHorizontal: 14, paddingVertical: 10 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#D1FAE5', paddingHorizontal: 14, height: 50, gap: 10 },
  searchText: { color: '#9A9A94', fontSize: 14 },
  content: { paddingHorizontal: 14, paddingBottom: 40 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1C1917', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  tileWrap: { width: '25%', paddingHorizontal: 5, marginBottom: 14, alignItems: 'center' },
  tile: { width: '100%', aspectRatio: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 34 },
  label: { fontSize: 12, fontWeight: '600', color: '#1C1917', textAlign: 'center', marginTop: 6, lineHeight: 15 },
});
