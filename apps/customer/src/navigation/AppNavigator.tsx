/**
 * BEVER Customer App — Root Navigator
 *
 * Single, authoritative navigation state machine.
 * Reads auth/profile state (useAuthStore) and browsing location state
 * (useLocationStore) to render the correct navigator tree.
 *
 * State machine (evaluated top-to-bottom, first match wins):
 *
 *   1. isLoading || (session && isProfileLoading) || isLocationLoading
 *      → SplashScreen: wait for all async state to resolve.
 *
 *   2. session !== null && !isProfileComplete
 *      → ProfileSetupGate: fullscreen, no dismiss, no tab bar.
 *        Saving profile triggers store update → re-renders.
 *
 *   3. needsLocationSetup
 *      → LocationSetupGate: fullscreen, show once.
 *        Confirming location triggers store update → re-renders.
 *        Works for both guests (session === null) and authenticated users.
 *
 *   4. session === null
 *      → Root modal stack: AppTabs (guest) + Auth modal slide-up.
 *
 *   5. session !== null && isProfileComplete
 *      → AppTabs: full authenticated experience.
 *
 * Important: location gate (3) is placed BEFORE the guest/auth split (4/5)
 * so that BOTH guests and authenticated users are asked for their location
 * once on first launch, and can change it later via the Home header.
 */

import React, { useEffect, useCallback } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { useLocationStore } from '../stores/useLocationStore';
import { useCartStore } from '../stores/useCartStore';
import { AppTabs } from './AppTabs';
import { AuthStack } from './AuthStack';
import { BrowsingLocationPickerScreen } from '../screens/location/BrowsingLocationPickerScreen';

// ─── Root stack (guest browse + Auth modal) ───────────────────────────────────

type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
};

const Root = createNativeStackNavigator<RootStackParamList>();


// ─── Splash ───────────────────────────────────────────────────────────────────

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashLogo}>BEVER</Text>
      <ActivityIndicator size="large" color="#059669" style={styles.splashSpinner} />
    </View>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────

export function AppNavigator() {
  const { isLoading, session, initialize } = useAuthStore();
  const { isLocationLoading, needsLocationSetup, loadPersistedLocation } = useLocationStore();
  const { loadPersistedCart } = useCartStore();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  useEffect(() => {
    loadPersistedLocation();
  }, [loadPersistedLocation]);

  useEffect(() => {
    loadPersistedCart();
  }, [loadPersistedCart]);

  // Stable callback so BrowsingLocationPickerScreen doesn't need to navigate imperatively
  const handleLocationSet = useCallback(() => {
    // useLocationStore.setBrowsingLocation already set needsLocationSetup = false
    // This re-render cascade happens automatically via Zustand subscription
  }, []);

  // ── 1. Loading gate ──────────────────────────────────────────────────────────
  if (isLoading || isLocationLoading) {
    return <SplashScreen />;
  }

  // (Name is collected at checkout, not as a blocking gate.)

  // ── 3. Location not yet set → location setup gate ────────────────────────────
  // Applies to BOTH guests and authenticated users.
  if (needsLocationSetup) {
    return (
      <View style={styles.fullScreen}>
        <BrowsingLocationPickerScreen onLocationSet={handleLocationSet} />
      </View>
    );
  }

  // ── 4. Unauthenticated + location set → guest browse + Auth modal ────────────
  if (session === null) {
    return (
      <NavigationContainer>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          <Root.Screen name="Main" component={AppTabs} />
          <Root.Screen
            name="Auth"
            component={AuthStack}
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Root.Navigator>
      </NavigationContainer>
    );
  }

  // ── 5. Authenticated + profile complete + location set → full app ─────────────
  return (
    <NavigationContainer>
      <AppTabs />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#F3FBF7',
  },
  splash: {
    flex: 1,
    backgroundColor: '#F3FBF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    fontSize: 42,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 4,
  },
  splashSpinner: {
    marginTop: 32,
  },
});
