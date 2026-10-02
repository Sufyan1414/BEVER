/**
 * BEVER Customer App — Cart Screen (Placeholder)
 *
 * CURRENT STATE — Step 1 (Navigation/Session Foundation):
 *   Cart business logic is not yet implemented.
 *   This screen is a clean placeholder that communicates what is coming.
 *
 * Cart logic (products, quantities, checkout, payment) will be implemented
 * in Step 4 (Cart & Ordering).
 *
 * If the user is unauthenticated, they cannot have a cart (checkout requires
 * a real account). This screen reflects that state.
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

export function CartScreen() {
  const { session } = useAuthStore();
  const navigation = useNavigation<RootNav>();
  const isAuthenticated = session !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.title}>Cart</Text>

        {isAuthenticated ? (
          <PlaceholderNotice
            icon="🛒"
            heading="Your cart is empty"
            body="Browse stores and add products to your cart. Cart and checkout will be available in the next build step."
          />
        ) : (
          <View style={styles.authRequired}>
            <Text style={styles.authIcon}>🔐</Text>
            <Text style={styles.authHeading}>Sign in to use your cart</Text>
            <Text style={styles.authBody}>
              You need an account to save items, checkout, and track orders.
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => navigation.navigate('Auth')}
              accessibilityLabel="Sign in to access cart"
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function PlaceholderNotice({
  icon,
  heading,
  body,
}: {
  icon: string;
  heading: string;
  body: string;
}) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderIcon}>{icon}</Text>
      <Text style={styles.placeholderHeading}>{heading}</Text>
      <Text style={styles.placeholderBody}>{body}</Text>
    </View>
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
