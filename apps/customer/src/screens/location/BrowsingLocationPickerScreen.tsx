/**
 * BEVER Customer App — Search-Only Location & Delivery Details Onboarding
 *
 * Product Requirement:
 *   BEVER uses SEARCH-ONLY location selection.
 *
 *   Flow:
 *     Step 1: Search location → Select result
 *     Step 2: Enter Delivery details (House No., Floor, Building, Landmark, Instructions)
 *     Step 3: Save & Continue → Home screen opens
 *
 * Rules:
 *   - NO GPS / current location option
 *   - NO location permission request
 *   - NO map or pin confirmation UI
 *   - NO fake frontend service areas or mock results
 *   - Fast, calm, premium consumer startup visual language
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView, Keyboard, Animated } from 'react-native';
import { Text, TextInput } from '../../components/AppText';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BeverLoader } from '../../components/BeverLoader';
import { useLocationStore, BrowsingLocation } from '../../stores/useLocationStore';

// ─── Nominatim API Config ─────────────────────────────────────────────────────

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_HEADERS = {
  'User-Agent': 'BEVERApp/1.0 (hyperlocal delivery; contact@bever.in)',
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    city_district?: string;
    state?: string;
    state_district?: string;
    postcode?: string;
  };
}

interface ParsedLocationResult {
  placeId: number;
  areaTitle: string;
  citySubtitle: string;
  fullDisplayName: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  pincode: string;
}

// ─── Screen Props ─────────────────────────────────────────────────────────────

interface Props {
  /** Callback fired after location + delivery details are saved */
  onLocationSet: () => void;
  /** True when launched from "Change location" chip on Home */
  isChanging?: boolean;
}

type Step = 'SEARCH' | 'DELIVERY_DETAILS';

// ─── Helper Functions ─────────────────────────────────────────────────────────

function parseNominatimResult(item: NominatimResult): ParsedLocationResult {
  const parts = item.display_name.split(',').map((p) => p.trim());
  const areaTitle = parts.slice(0, 2).join(', ');
  const citySubtitle = parts.slice(2).join(', ');

  const address = item.address ?? {};
  const city = address.city || address.town || address.village || address.municipality || '';
  const state = address.state || address.state_district || '';
  const pincode = address.postcode || '';

  return {
    placeId: item.place_id,
    areaTitle: areaTitle || item.display_name,
    citySubtitle: citySubtitle || '',
    fullDisplayName: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    city,
    state,
    pincode,
  };
}

// ─── Drawn icons (no emoji) ───────────────────────────────────────────────────

function PinIcon({ small = false }: { small?: boolean }) {
  const d = small ? 34 : 44;
  return (
    <View style={{ width: d, height: d, borderRadius: d * 0.34, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: d * 0.4, height: d * 0.4, borderRadius: d * 0.2, borderBottomRightRadius: 0, backgroundColor: '#059669', transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: d * 0.14, height: d * 0.14, borderRadius: d * 0.07, backgroundColor: '#fff' }} />
      </View>
    </View>
  );
}

function CrosshairIcon() {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FBBF24' }} />
      </View>
      <View style={{ position: 'absolute', top: 0, width: 2, height: 5, backgroundColor: '#ECFDF5' }} />
      <View style={{ position: 'absolute', bottom: 0, width: 2, height: 5, backgroundColor: '#ECFDF5' }} />
      <View style={{ position: 'absolute', left: 0, height: 2, width: 5, backgroundColor: '#ECFDF5' }} />
      <View style={{ position: 'absolute', right: 0, height: 2, width: 5, backgroundColor: '#ECFDF5' }} />
    </View>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  const c = active ? '#059669' : '#6B7280';
  return (
    <View style={{ width: 20, height: 20 }}>
      <View style={{ width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: c }} />
      <View style={{ position: 'absolute', right: 1, bottom: 2, width: 7, height: 2, borderRadius: 1, backgroundColor: c, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

// ─── Component Implementation ─────────────────────────────────────────────────

export function BrowsingLocationPickerScreen({ onLocationSet, isChanging = false }: Props) {
  const { browsingLocation, setBrowsingLocation } = useLocationStore();

  // ── Step State ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('SEARCH');
  const [selectedResult, setSelectedResult] = useState<ParsedLocationResult | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const useCurrentLocation = useCallback(async () => {
    setGpsBusy(true); setGpsError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Allow location access in your phone settings, or search for your area below.');
      if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on your phone’s location (GPS) and try again.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      let city = ''; let state = ''; let pin = ''; let label = '';
      try {
        const [g] = await Location.reverseGeocodeAsync(pos.coords);
        if (g) {
          city = (g.city ?? g.subregion ?? '') as string;
          state = (g.region ?? '') as string;
          pin = g.postalCode && /^\d{6}$/.test(g.postalCode) ? g.postalCode : '';
          label = [g.district ?? g.name ?? g.street, city].filter(Boolean).join(', ');
        }
      } catch { /* label is optional */ }
      await setBrowsingLocation({
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        label: label || 'Current location',
        ...(city ? { city } : {}), ...(state ? { state } : {}), ...(pin ? { pincode: pin } : {}),
        setAt: new Date().toISOString(),
      });
      onLocationSet();
    } catch (e: any) { setGpsError(e?.message ?? 'Could not get your location.'); }
    finally { setGpsBusy(false); }
  }, [setBrowsingLocation, onLocationSet]);

  // ── Search State ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ParsedLocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Delivery Details Form State ─────────────────────────────────────────────
  const [houseNo, setHouseNo] = useState(browsingLocation?.houseNo || '');
  const [floor, setFloor] = useState(browsingLocation?.floor || '');
  const [building, setBuilding] = useState(browsingLocation?.building || '');
  const [landmark, setLandmark] = useState(browsingLocation?.landmark || '');
  const [instructions, setInstructions] = useState(browsingLocation?.instructions || '');
  const [pincode, setPincode] = useState(browsingLocation?.pincode || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Animations ──────────────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const transitionToStep = useCallback(
    (nextStep: Step) => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setStep(nextStep);
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      });
    },
    [fadeAnim]
  );

  // ── Search Logic ────────────────────────────────────────────────────────────

  const executeSearch = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '6',
        addressdetails: '1',
        countrycodes: 'in',
      });

      const res = await fetch(`${NOMINATIM_BASE}?${params}`, {
        headers: NOMINATIM_HEADERS,
      });

      if (!res.ok) throw new Error(`Search HTTP error ${res.status}`);

      const data: NominatimResult[] = await res.json();
      const parsed = data.map(parseNominatimResult);
      setResults(parsed);

      if (parsed.length === 0) {
        setSearchError(`No locations found for "${q}". Please check the spelling or try another area.`);
      }
    } catch {
      setSearchError('Could not reach search service. Please check your internet connection.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (searchQuery.trim().length >= 3) {
      debounceTimer.current = setTimeout(() => executeSearch(searchQuery), 550);
    } else {
      setResults([]);
      setSearchError(null);
    }
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [searchQuery, executeSearch]);

  const handleSelectResult = useCallback(
    (item: ParsedLocationResult) => {
      Keyboard.dismiss();
      setSelectedResult(item);
      transitionToStep('DELIVERY_DETAILS');
    },
    [transitionToStep]
  );

  // ── Save Logic ──────────────────────────────────────────────────────────────

  const needsPincode = Boolean(selectedResult && !selectedResult.pincode);
  const isFormValid = Boolean(
    houseNo.trim() &&
    (!needsPincode || /^\d{6}$/.test(pincode.trim()))
  );

  const handleSaveAndContinue = useCallback(async () => {
    if (!selectedResult || !isFormValid || isSubmitting) return;

    setIsSubmitting(true);

    const locationData: BrowsingLocation = {
      lat: selectedResult.lat,
      lng: selectedResult.lng,
      label: selectedResult.areaTitle,
      ...(selectedResult.city ? { city: selectedResult.city } : {}),
      ...(selectedResult.state ? { state: selectedResult.state } : {}),
      ...((selectedResult.pincode || pincode.trim()) ? { pincode: (selectedResult.pincode || pincode.trim()) } : {}),
      setAt: new Date().toISOString(),
      houseNo: houseNo.trim(),
      floor: floor.trim(),
      ...(building.trim() ? { building: building.trim() } : {}),
      ...(landmark.trim() ? { landmark: landmark.trim() } : {}),
      ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
    };

    await setBrowsingLocation(locationData);
    setIsSubmitting(false);
    onLocationSet();
  }, [
    selectedResult,
    isFormValid,
    isSubmitting,
    houseNo,
    floor,
    building,
    landmark,
    instructions,
    setBrowsingLocation,
    onLocationSet,
  ]);

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER STEP 1: SEARCH LOCATION
  // ────────────────────────────────────────────────────────────────────────────

  if (step === 'SEARCH') {
    const showHelper = results.length === 0 && !isSearching && !searchError && searchQuery.length < 3;
    return (
      <View style={styles.safe}>
        <StatusBar style="light" />
        <Animated.View style={[styles.flex1, { opacity: fadeAnim }]}>
          {/* Hero */}
          <View style={styles.hero}>
            <SafeAreaView edges={['top']}>
              <View style={styles.heroTop}>
                <Text style={styles.heroWordmark}>BEVER</Text>
              </View>
              <Text style={styles.heroTitle}>{isChanging ? 'Change your\ndelivery spot' : 'Your neighbourhood,\ndelivered in minutes.'}</Text>
              <Text style={styles.heroSub}>{isChanging ? 'Shops and delivery time update for the new spot.' : 'Pick where to deliver. We show only the shops that actually reach your door.'}</Text>
            </SafeAreaView>
          </View>

          {/* Sheet */}
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.gpsCard} onPress={() => { void useCurrentLocation(); }} disabled={gpsBusy} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Use my current location">
              <View style={styles.gpsIconWrap}>
                {gpsBusy ? <BeverLoader size={34} light /> : <CrosshairIcon />}
              </View>
              <View style={styles.flex1}>
                <Text style={styles.gpsTitle}>{gpsBusy ? 'Finding your exact spot…' : 'Use my current location'}</Text>
                <Text style={styles.gpsSub}>Pins your door so the rider finds you fast</Text>
              </View>
              <Text style={styles.gpsChevron}>›</Text>
            </TouchableOpacity>
            {gpsError ? <View style={styles.errorBox}><Text style={styles.errorText}>{gpsError}</Text></View> : null}

            <View style={styles.orRow}><View style={styles.orLine} /><Text style={styles.orText}>OR SEARCH</Text><View style={styles.orLine} /></View>

            <View style={[styles.searchBox, isFocused && styles.searchBoxFocused]}>
              <SearchIcon active={isFocused} />
              <TextInput
                style={styles.searchInput}
                placeholder="Area, society or landmark"
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                returnKeyType="search"
                onSubmitEditing={() => executeSearch(searchQuery)}
                accessibilityLabel="Search delivery area"
              />
              {isSearching ? <ActivityIndicator size="small" color="#059669" /> : searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setResults([]); setSearchError(null); }} style={styles.clearBtn} accessibilityLabel="Clear search text">
                  <Text style={styles.clearBtnText}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {searchError && !isSearching ? <View style={styles.errorBox}><Text style={styles.errorText}>{searchError}</Text></View> : null}

            {results.length > 0 && !isSearching ? (
              <ScrollView style={styles.resultsScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {results.map((item, idx) => (
                  <TouchableOpacity key={item.placeId} style={[styles.resultItem, idx === results.length - 1 && styles.resultItemLast]} onPress={() => handleSelectResult(item)} activeOpacity={0.7} accessibilityLabel={`Select ${item.areaTitle}`}>
                    <PinIcon small />
                    <View style={styles.resultTextWrap}>
                      <Text style={styles.resultAreaTitle} numberOfLines={1}>{item.areaTitle}</Text>
                      {item.citySubtitle ? <Text style={styles.resultCitySubtitle} numberOfLines={1}>{item.citySubtitle}</Text> : null}
                    </View>
                    <Text style={styles.resultChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            {showHelper ? (
              <View style={styles.infoCard}>
                <Text style={styles.infoHead}>HOW DELIVERY WORKS</Text>
                {[
                  ['1', 'Shops that reach you', 'Each shop sets its own delivery radius, so you only see what can arrive.'],
                  ['2', 'One shop, one rider', 'Groceries and electronics are separate baskets and arrive separately.'],
                  ['3', 'Pay at your door', 'Cash on delivery. No card or UPI needed.'],
                ].map(([n, t, d]) => (
                  <View key={n} style={styles.infoRow}>
                    <View style={styles.infoNum}><Text style={styles.infoNumText}>{n}</Text></View>
                    <View style={styles.flex1}>
                      <Text style={styles.helperTitle}>{t}</Text>
                      <Text style={styles.helperBody}>{d}</Text>
                    </View>
                  </View>
                ))}
                <View style={styles.feeBox}>
                  <Text style={styles.feeText}>Delivery ₹20 + ₹7 per km · Free above ₹199</Text>
                </View>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER STEP 2: DELIVERY DETAILS
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
          {/* Top Bar with Back Button */}
          <View style={styles.detailsTopBar}>
            <TouchableOpacity
              onPress={() => transitionToStep('SEARCH')}
              style={styles.backBtn}
              accessibilityLabel="Change area search"
            >
              <Text style={styles.backBtnText}>← Change area</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.detailsScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Selected Location Banner */}
            <View style={styles.selectedLocationCard}>
              <PinIcon />
              <View style={styles.selectedLocationTextWrap}>
                <Text style={styles.selectedLocationLabel}>DELIVERING TO</Text>
                <Text style={styles.selectedLocationTitle} numberOfLines={2}>
                  {selectedResult?.areaTitle}
                </Text>
                {selectedResult?.citySubtitle ? (
                  <Text style={styles.selectedLocationSub} numberOfLines={1}>
                    {selectedResult.citySubtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Title */}
            <Text style={styles.formHeadline}>Where exactly?</Text>
            <Text style={styles.formSubheadline}>
              Provide house and floor details so the delivery partner can locate your door.
            </Text>

            {/* House / Flat / Shop No. (Required) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>House / Flat / Shop No. *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Flat 302 / Shop 14"
                placeholderTextColor="#A8A29E"
                value={houseNo}
                onChangeText={setHouseNo}
                autoFocus
                accessibilityLabel="House, flat, or shop number"
              />
            </View>

            {/* Floor (optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Floor (optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. 3rd Floor / Ground Floor"
                placeholderTextColor="#A8A29E"
                value={floor}
                onChangeText={setFloor}
                accessibilityLabel="Floor level"
              />
            </View>

            {/* Building / Society (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Building / Society Name (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Royal Heights / Green Park"
                placeholderTextColor="#A8A29E"
                value={building}
                onChangeText={setBuilding}
                accessibilityLabel="Building or society name"
              />
            </View>

            {/* Landmark (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Landmark (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Near City Hospital"
                placeholderTextColor="#A8A29E"
                value={landmark}
                onChangeText={setLandmark}
                accessibilityLabel="Landmark"
              />
            </View>

            {/* Pincode — only when the selected place did not provide one */}
            {needsPincode ? (
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>6-Digit Pincode *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 431001"
                  placeholderTextColor="#A8A29E"
                  value={pincode}
                  onChangeText={(text) => setPincode(text.replace(/\\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  accessibilityLabel="Delivery pincode"
                />
                <Text style={styles.fieldHint}>We only ask this when the selected area does not include a postal code.</Text>
              </View>
            ) : null}

            {/* Delivery Instructions (Optional) */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Delivery Instructions (Optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMulti]}
                placeholder="e.g. Ring bell twice / Leave at security"
                placeholderTextColor="#A8A29E"
                value={instructions}
                onChangeText={setInstructions}
                multiline
                numberOfLines={2}
                accessibilityLabel="Delivery instructions"
              />
            </View>

            {/* Save & Continue CTA */}
            <TouchableOpacity
              style={[styles.submitCta, !isFormValid && styles.submitCtaDisabled]}
              onPress={handleSaveAndContinue}
              disabled={!isFormValid || isSubmitting}
              accessibilityLabel="Save location and continue to home"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitCtaText}>Save & Continue</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  hero: { backgroundColor: '#0B0B0C', paddingHorizontal: 24, paddingBottom: 56, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' },
  heroOrbA: { position: 'absolute', top: -90, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: '#047857', opacity: 0.8 },
  heroOrbB: { position: 'absolute', bottom: -80, left: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: '#065F46' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14, marginBottom: 26 },
  logoBadge: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  logoBadgeText: { color: '#064E3B', fontSize: 19, fontWeight: '800' },
  heroWordmark: { color: '#ECFDF5', fontSize: 20, fontWeight: '800', letterSpacing: 3 },
  heroTitle: { color: '#FFFFFF', fontSize: 30, lineHeight: 37, fontWeight: '800', letterSpacing: -0.6 },
  heroSub: { color: '#B8B8B2', fontSize: 14, lineHeight: 20, marginTop: 12, maxWidth: 300 },
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E6E6E1', padding: 16, gap: 14 },
  infoHead: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4, color: '#A3A39C' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0B0B0C', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  infoNumText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  feeBox: { backgroundColor: '#FFF4DB', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
  feeText: { fontSize: 12.5, fontWeight: '800', color: '#B45309' },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  heroChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FBBF24' },
  heroChipText: { color: '#D1FAE5', fontSize: 11.5, fontWeight: '600' },
  sheet: { flex: 1, marginTop: -32, marginHorizontal: 16 },
  gpsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#059669', borderRadius: 20, padding: 14, shadowColor: '#064E3B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 14, elevation: 8 },
  gpsIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  gpsTitle: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '800' },
  gpsSub: { color: '#D1FAE5', fontSize: 12, marginTop: 2 },
  gpsChevron: { color: '#D1FAE5', fontSize: 26, fontWeight: '600', paddingRight: 4 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: '#D1E7DD' },
  orText: { color: '#6B7280', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  helperRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, padding: 14, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3F1EA' },
  resultItemLast: { borderBottomWidth: 0 },
  safe: {
    flex: 1,
    backgroundColor: '#F3FBF7',
  },
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },

  // Branding
  brandingHeader: {
    marginBottom: 20,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '900',
    color: '#059669',
    letterSpacing: 4,
  },
  wordmarkTagline: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A8A29E',
    letterSpacing: 1.5,
    marginTop: 2,
  },

  // Headline
  headlineWrap: {
    marginBottom: 24,
  },
  mainHeadline: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1917',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subHeadline: {
    fontSize: 14,
    color: '#78716C',
    lineHeight: 20,
    fontWeight: '400',
  },

  // Search Box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D9E8E0',
    paddingHorizontal: 16,
    height: 54,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    marginBottom: 12,
  },
  searchBoxFocused: {
    borderColor: '#059669',
    backgroundColor: '#FFFFFF',
  },
  searchIcon: {
    fontSize: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1917',
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#A8A29E',
    fontWeight: '700',
  },

  // Searching Row
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  searchingText: {
    fontSize: 14,
    color: '#78716C',
    fontWeight: '500',
  },

  // Error Box
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },

  // Results
  resultsScroll: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3F1EA',
  },
  resultsHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A8A29E',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF5F1',
    gap: 12,
  },
  resultPinBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPinEmoji: {
    fontSize: 18,
  },
  resultTextWrap: {
    flex: 1,
    gap: 2,
  },
  resultAreaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
  },
  resultCitySubtitle: {
    fontSize: 12,
    color: '#78716C',
  },
  resultChevron: {
    fontSize: 20,
    color: '#D6D3D1',
    fontWeight: '600',
  },

  // Search Helper state
  searchHelperState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  helperIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  helperIconEmoji: {
    fontSize: 28,
  },
  helperTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#064E3B',
    marginBottom: 2,
  },
  helperBody: {
    fontSize: 12.5,
    color: '#6B7280',
    lineHeight: 17,
  },

  // ── Delivery Details Screen ──
  detailsTopBar: {
    marginBottom: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },

  detailsScrollContent: {
    paddingBottom: 40,
  },

  selectedLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    gap: 12,
    marginBottom: 20,
  },
  selectedLocationIcon: {
    fontSize: 24,
  },
  selectedLocationTextWrap: {
    flex: 1,
  },
  selectedLocationLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 1,
    marginBottom: 2,
  },
  selectedLocationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#064E3B',
  },
  selectedLocationSub: {
    fontSize: 12,
    color: '#065F46',
    marginTop: 2,
  },

  formHeadline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 6,
  },
  formSubheadline: {
    fontSize: 13,
    color: '#78716C',
    lineHeight: 18,
    marginBottom: 24,
  },

  inputGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403C',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  formInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1917',
  },
  formInputMulti: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  submitCta: {
    backgroundColor: '#059669',
    borderRadius: 16,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    elevation: 3,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  submitCtaDisabled: {
    backgroundColor: '#D6D3D1',
    shadowOpacity: 0,
    elevation: 0,
  },
  fieldHint: {
    fontSize: 11,
    color: '#A8A29E',
    marginTop: 6,
    lineHeight: 16,
  },

  submitCtaText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
