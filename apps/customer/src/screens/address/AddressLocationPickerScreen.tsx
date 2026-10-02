/**
 * BEVER Customer App — Address Location Picker Screen
 *
 * OpenStreetMap manual pin picker for delivery addresses.
 *
 * Rules:
 *   - Displays OpenStreetMap tiles using react-native-maps + UrlTile.
 *   - No Google Maps, Google Places, Mapbox, or paid APIs.
 *   - No device GPS or location permissions required.
 *   - For existing addresses with coordinates: centers on saved location.
 *   - For new addresses: displays a neutral broad India viewport starting position.
 *   - Never invents customer coordinates or saves fallback viewport silently.
 *   - Requires customer to position the map before confirming new locations.
 */

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MapView, { UrlTile, Region } from 'react-native-maps';
import type { AddressLocationPickerProps } from '../../navigation/types';

// Neutral broad India map viewport (starting view only for new address, not a customer coordinate)
const INDIA_FALLBACK_LATITUDE = 20.5937;
const INDIA_FALLBACK_LONGITUDE = 78.9629;
const INDIA_FALLBACK_DELTA = 15.0;

// Focused zoom delta for saved address coordinates
const SAVED_LOCATION_DELTA = 0.015;

export function AddressLocationPickerScreen({
  route,
  navigation,
}: AddressLocationPickerProps) {
  const hasExistingCoords =
    typeof route.params?.initialLat === 'number' &&
    isFinite(route.params.initialLat) &&
    typeof route.params?.initialLng === 'number' &&
    isFinite(route.params.initialLng);

  const initialLat = hasExistingCoords
    ? (route.params!.initialLat as number)
    : INDIA_FALLBACK_LATITUDE;

  const initialLng = hasExistingCoords
    ? (route.params!.initialLng as number)
    : INDIA_FALLBACK_LONGITUDE;

  const initialDelta = hasExistingCoords ? SAVED_LOCATION_DELTA : INDIA_FALLBACK_DELTA;

  // Track if user has interacted with the map (always true if existing coords exist)
  const [hasMovedMap, setHasMovedMap] = useState<boolean>(hasExistingCoords);
  const isInitialMount = useRef(true);

  const [currentRegion, setCurrentRegion] = useState<Region>({
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: initialDelta,
    longitudeDelta: initialDelta,
  });

  const handleRegionChangeComplete = (region: Region) => {
    setCurrentRegion(region);
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!hasMovedMap) {
      setHasMovedMap(true);
    }
  };

  const handleConfirm = () => {
    if (!hasMovedMap) return;

    navigation.navigate('AddressForm', {
      selectedLocation: {
        latitude: currentRegion.latitude,
        longitude: currentRegion.longitude,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Cancel location picker"
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Delivery Location</Text>
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={!hasMovedMap}
          style={[styles.confirmHeaderButton, !hasMovedMap && styles.disabledHeaderButton]}
          accessibilityLabel="Confirm selected delivery location"
        >
          <Text style={[styles.confirmHeaderText, !hasMovedMap && styles.disabledHeaderText]}>
            Confirm
          </Text>
        </TouchableOpacity>
      </View>

      {/* Instructions Banner */}
      <View style={[styles.instructionBanner, !hasMovedMap && styles.instructionBannerWarning]}>
        <Text style={styles.instructionIcon}>{hasMovedMap ? '📍' : '🗺️'}</Text>
        <Text style={styles.instructionText}>
          {hasExistingCoords
            ? 'Move the pin to update your delivery location.'
            : hasMovedMap
            ? 'Move the pin to your exact delivery location.'
            : 'Zoom in & position the map over your delivery location.'}
        </Text>
      </View>

      {/* Map Container */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: initialLat,
            longitude: initialLng,
            latitudeDelta: initialDelta,
            longitudeDelta: initialDelta,
          }}
          onRegionChangeComplete={handleRegionChangeComplete}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* OpenStreetMap Tile Layer */}
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            tileSize={256}
            doubleTileSize={true}
          />
        </MapView>

        {/* Fixed Center Pin Overlay */}
        <View style={styles.markerFixed} pointerEvents="none">
          <View style={[styles.pinBubble, !hasMovedMap && styles.pinBubbleWarning]}>
            <Text style={styles.pinBubbleText}>
              {hasMovedMap ? 'Delivery Here' : 'Zoom & Position Pin'}
            </Text>
          </View>
          <Text style={styles.pinIcon}>📍</Text>
        </View>
      </View>

      {/* Bottom Floating Control */}
      <View style={styles.bottomCard}>
        <Text style={styles.bottomHelpText}>
          {hasMovedMap
            ? 'Position the map so the pin points to your building or entrance.'
            : 'Move the map underneath the pin to set your delivery location.'}
        </Text>

        <TouchableOpacity
          style={[styles.confirmPrimaryButton, !hasMovedMap && styles.confirmPrimaryButtonDisabled]}
          onPress={handleConfirm}
          disabled={!hasMovedMap}
          accessibilityLabel="Confirm location button"
        >
          <Text style={styles.confirmPrimaryText}>
            {hasMovedMap ? 'Confirm Location' : 'Position Map to Select Location'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

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
    borderBottomColor: '#E7E5E4',
    backgroundColor: '#FFFBF5',
    zIndex: 10,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 15,
    color: '#78716C',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
  },
  confirmHeaderButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  disabledHeaderButton: {
    opacity: 0.5,
  },
  confirmHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F59E0B',
  },
  disabledHeaderText: {
    color: '#A8A29E',
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  instructionBannerWarning: {
    backgroundColor: '#EFF6FF',
    borderBottomColor: '#BFDBFE',
  },
  instructionIcon: {
    fontSize: 16,
  },
  instructionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerFixed: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -24,
    marginTop: -48,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  pinBubble: {
    backgroundColor: '#1C1917',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 2,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  pinBubbleWarning: {
    backgroundColor: '#1E40AF',
  },
  pinBubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pinIcon: {
    fontSize: 32,
    lineHeight: 32,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: '#E7E5E4',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  bottomHelpText: {
    fontSize: 13,
    color: '#78716C',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 18,
  },
  confirmPrimaryButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmPrimaryButtonDisabled: {
    backgroundColor: '#D6D3D1',
  },
  confirmPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
