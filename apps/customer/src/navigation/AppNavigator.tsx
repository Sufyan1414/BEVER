/**
 * BEVER Customer App — Root Navigator
 *
 * Decides which navigator to render based on the real Supabase session and profile:
 *   - isLoading || isProfileLoading → SplashScreen
 *   - session exists → AppTabs (authenticated experience)
 *   - no session → AppTabs with Home access (unauthenticated browse)
 *
 * AuthStack is presented modally when the user explicitly taps "Sign In", or
 * when an authenticated session lacks a completed customer profile name.
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { AppTabs } from './AppTabs';
import { AuthStack } from './AuthStack';

type RootStackParamList = {
  Main: undefined;
  Auth: undefined;
};

const Root = createNativeStackNavigator<RootStackParamList>();

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashLogo}>BEVER</Text>
      <ActivityIndicator size="large" color="#F59E0B" style={styles.splashSpinner} />
    </View>
  );
}

export function AppNavigator() {
  const { isLoading, isProfileLoading, initialize } = useAuthStore();

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  if (isLoading || isProfileLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {/* Main tab navigator — always present */}
        <Root.Screen name="Main" component={AppTabs} />
        {/* Auth stack — presented modally */}
        <Root.Screen
          name="Auth"
          component={AuthStack}
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Root.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#FFFBF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    fontSize: 42,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 4,
  },
  splashSpinner: {
    marginTop: 32,
  },
});
