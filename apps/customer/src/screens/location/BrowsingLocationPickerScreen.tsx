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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LocationHero } from '../../components/LocationHero';
import { useLocationStore, BrowsingLocation } from '../../stores/useLocationStore';

// ─── Nominatim API Config ─────────────────────────────────────────────────────

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_HEADERS = {
  'User-Agent': 'BEVERApp/1.0 (hyperlocal delivery)',
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

// ─── Component Implementation ─────────────────────────────────────────────────

export function BrowsingLocationPickerScreen({ onLocationSet, isChanging = false }: Props) {
  const { browsingLocation, setBrowsingLocation } = useLocationStore();
  const insets = useSafeAreaInsets();

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
    return (
      <View style={premium.root}>
        <StatusBar style="light" />
        <View style={{ backgroundColor: '#022C22', paddingTop: insets.top }}>
          <LocationHero height={250} />
        </View>
        <KeyboardAvoidingView style={premium.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[premium.sheet, { opacity: fadeAnim }]}>
            <Text style={premium.title}>{isChanging ? 'Change delivery area' : 'Where should we deliver?'}</Text>
            <Text style={premium.sub}>Groceries, medicines and more from shops in your own market, at your door in minutes.</Text>

            <TouchableOpacity style={premium.cta} onPress={() => { void useCurrentLocation(); }} disabled={gpsBusy} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel="Use my current location">
              {gpsBusy ? <ActivityIndicator color="#fff" /> : (
                <>
                  <View style={premium.ctaIcon}><Ionicons name="locate" size={20} color="#064E3B" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={premium.ctaTitle}>Use my current location</Text>
                    <Text style={premium.ctaSub}>Most accurate for a quick delivery</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
            {gpsError ? <View style={styles.errorBox}><Text style={styles.errorText}>{gpsError}</Text></View> : null}

            <View style={premium.orRow}><View style={premium.orLine} /><Text style={premium.orText}>OR</Text><View style={premium.orLine} /></View>

            <View style={[premium.search, isFocused && premium.searchFocused]}>
              <Ionicons name="search" size={20} color={isFocused ? '#059669' : '#78716C'} />
              <TextInput
                style={premium.searchInput}
                placeholder="Search area, locality or pincode"
                placeholderTextColor="#A8A29E"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                returnKeyType="search"
                onSubmitEditing={() => executeSearch(searchQuery)}
                accessibilityLabel="Search delivery area"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setResults([]); setSearchError(null); }} accessibilityLabel="Clear search text" hitSlop={10}>
                  <Ionicons name="close-circle" size={20} color="#A8A29E" />
                </TouchableOpacity>
              )}
            </View>

            {isSearching && (
              <View style={styles.searchingRow}>
                <ActivityIndicator size="small" color="#059669" />
                <Text style={styles.searchingText}>Searching areas…</Text>
              </View>
            )}
            {searchError && !isSearching && (
              <View style={styles.errorBox}><Text style={styles.errorText}>{searchError}</Text></View>
            )}

            {results.length > 0 && !isSearching ? (
              <ScrollView style={{ flex: 1, marginTop: 8 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {results.map((item) => (
                  <TouchableOpacity key={item.placeId} style={premium.row} onPress={() => handleSelectResult(item)} activeOpacity={0.7} accessibilityLabel={`Select ${item.areaTitle}`}>
                    <View style={premium.rowIcon}><Ionicons name="location-outline" size={20} color="#047857" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={premium.rowTitle} numberOfLines={1}>{item.areaTitle}</Text>
                      {item.citySubtitle ? <Text style={premium.rowSub} numberOfLines={1}>{item.citySubtitle}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#D6D3D1" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              !isSearching && !searchError && (
                <View style={premium.hint}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#047857" />
                  <Text style={premium.hintText}>We only use your location to show shops that can deliver to you.</Text>
                </View>
              )
            )}
          </Animated.View>
        </KeyboardAvoidingView>
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
              <Text style={styles.selectedLocationIcon}>📍</Text>
              <View style={styles.selectedLocationTextWrap}>
                <Text style={styles.selectedLocationLabel}>SELECTED AREA</Text>
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

const premium = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#022C22' },
  sheetWrap: { flex: 1, marginTop: -26 },
  sheet: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 26 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F2A22', letterSpacing: -0.4 },
  sub: { fontSize: 14, color: '#57534E', lineHeight: 21, marginTop: 8, marginBottom: 20 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#059669', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, shadowColor: '#059669', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  ctaIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#A7F3D0', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ctaSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E7E5E4' },
  orText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, color: '#A8A29E' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: '#E7E5E4', backgroundColor: '#FAFAF9', paddingHorizontal: 14 },
  searchFocused: { borderColor: '#059669', backgroundColor: '#fff' },
  searchInput: { flex: 1, fontSize: 15, color: '#1C1917', paddingVertical: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#1C1917' },
  rowSub: { fontSize: 12, color: '#78716C', marginTop: 2 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14 },
  hintText: { flex: 1, fontSize: 12, color: '#166534', lineHeight: 18 },
});

const styles = StyleSheet.create({
  gpsPrimary: { height: 54, borderRadius: 16, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gpsPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  orText: { textAlign: 'center', color: '#78716C', fontSize: 12, fontWeight: '700', marginVertical: 8 },
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
    borderColor: '#E7E5E4',
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    marginBottom: 16,
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E7E5E4',
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
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 6,
  },
  helperBody: {
    fontSize: 13,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 18,
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
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 16,
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
    color: '#78350F',
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
