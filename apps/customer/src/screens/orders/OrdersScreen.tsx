/**
 * BEVER Customer App — Orders Screen (Placeholder)
 *
 * CURRENT STATE — Step 1 (Navigation/Session Foundation):
 *   Order fetching and display is not yet implemented.
 *   This screen shows auth-aware state only.
 *
 * Order history (fetching from Supabase, real-time status updates) will be
 * implemented in Step 5 (Orders & Tracking).
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/useAuthStore';

type RootNav = NativeStackNavigationProp<{ Auth: undefined }>;

export function OrdersScreen() {
  const { session } = useAuthStore();
  const navigation = useNavigation<RootNav>();
  const isAuthenticated = session !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.title}>My Orders</Text>

        {isAuthenticated ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📦</Text>
            <Text style={styles.placeholderHeading}>No orders yet</Text>
            <Text style={styles.placeholderBody}>
              Your order history will appear here once you place your first
              order. Real-time tracking is coming in the next step.
            </Text>
          </View>
        ) : (
          <View style={styles.authRequired}>
            <Text style={styles.authIcon}>📋</Text>
            <Text style={styles.authHeading}>Sign in to view orders</Text>
            <Text style={styles.authBody}>
              Your order history is tied to your account. Sign in to see
              past and active orders.
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => navigation.navigate('Auth')}
              accessibilityLabel="Sign in to view order history"
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 24,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  placeholderIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  placeholderHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderBody: {
    fontSize: 14,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  authRequired: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  authIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  authHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 8,
    textAlign: 'center',
  },
  authBody: {
    fontSize: 14,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: 24,
  },
  signInButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
