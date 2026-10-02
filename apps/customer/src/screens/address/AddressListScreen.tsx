/**
 * BEVER Customer App — Address List Screen
 *
 * Displays saved delivery addresses for the authenticated customer.
 *
 * Features:
 *   - Lists saved addresses with label badges, full text, and default indicator
 *   - Set address as default action
 *   - Edit address action (navigates to AddressFormScreen)
 *   - Delete address action with confirmation
 *   - Add new address action
 *   - Automatic refresh on focus
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';
import type { AddressListProps } from '../../navigation/types';
import type { CustomerAddress } from '../../types/address';
import {
  fetchMyAddresses,
  setDefaultAddress,
  deleteAddress,
  parseLocationPoint,
} from '../../services/address';

export function AddressListScreen({ navigation }: AddressListProps) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAddresses = async () => {
    setErrorMessage(null);
    try {
      const data = await fetchMyAddresses();
      setAddresses(data);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not load saved addresses.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAddresses();
  };

  const handleSetDefault = async (address: CustomerAddress) => {
    if (address.is_default) return;

    setActionId(address.id);
    setErrorMessage(null);

    try {
      await setDefaultAddress(address.id);
      await loadAddresses();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not set default address.');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = (address: CustomerAddress) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete "${address.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setActionId(address.id);
            try {
              await deleteAddress(address.id);
              await loadAddresses();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Could not delete address.');
            } finally {
              setActionId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: CustomerAddress }) => {
    const isBusy = actionId === item.id;
    const hasLocation = Boolean(parseLocationPoint(item.location));

    return (
      <View style={[styles.card, item.is_default ? styles.cardDefault : null]}>
        {/* Top bar: Label badge + Default pill */}
        <View style={styles.cardHeader}>
          <View style={styles.labelBadgeRow}>
            <View style={styles.labelBadge}>
              <Text style={styles.labelText}>{item.label}</Text>
            </View>
            <View
              style={[
                styles.locationBadge,
                hasLocation ? styles.locationPinnedBadge : styles.locationMissingBadge,
              ]}
            >
              <Text
                style={[
                  styles.locationBadgeText,
                  hasLocation ? styles.locationPinnedText : styles.locationMissingText,
                ]}
              >
                {hasLocation ? '📍 Location pinned' : '⚠️ Location not set'}
              </Text>
            </View>
          </View>

          {item.is_default ? (
            <View style={styles.defaultPill}>
              <Text style={styles.defaultPillText}>Default Delivery</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => handleSetDefault(item)}
              disabled={isBusy}
              style={styles.setDefaultButton}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color="#F59E0B" />
              ) : (
                <Text style={styles.setDefaultText}>Set as Default</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Address Body */}
        <Text style={styles.addressLine1}>{item.address_line_1}</Text>
        {item.address_line_2 ? (
          <Text style={styles.addressLine2}>{item.address_line_2}</Text>
        ) : null}
        <Text style={styles.cityStatePincode}>
          {item.city}, {item.state} — {item.pincode}
        </Text>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddressForm', { address: item })}
            style={styles.editActionButton}
            accessibilityLabel={`Edit address ${item.label}`}
          >
            <Text style={styles.editActionText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDelete(item)}
            disabled={isBusy}
            style={styles.deleteActionButton}
            accessibilityLabel={`Delete address ${item.label}`}
          >
            <Text style={styles.deleteActionText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Back to Profile"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Addresses</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AddressForm')}
          style={styles.addButtonHeader}
          accessibilityLabel="Add new address"
        >
          <Text style={styles.addButtonHeaderText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Content Body */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#F59E0B"
            />
          }
          ListHeaderComponent={
            errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📍</Text>
              <Text style={styles.emptyTitle}>No saved addresses yet</Text>
              <Text style={styles.emptySubtitle}>
                Add your delivery address to start browsing nearby beverages and stores.
              </Text>
              <TouchableOpacity
                style={styles.addPrimaryButton}
                onPress={() => navigation.navigate('AddressForm')}
                accessibilityLabel="Add first delivery address"
              >
                <Text style={styles.addPrimaryText}>Add Delivery Address</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
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
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
  },
  addButtonHeader: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  addButtonHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    marginBottom: 16,
  },
  cardDefault: {
    borderColor: '#F59E0B',
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  labelBadge: {
    backgroundColor: '#F5F5F4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#44403C',
  },
  locationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  locationPinnedBadge: {
    backgroundColor: '#D1FAE5',
  },
  locationMissingBadge: {
    backgroundColor: '#FEF3C7',
  },
  locationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  locationPinnedText: {
    color: '#065F46',
  },
  locationMissingText: {
    color: '#92400E',
  },
  defaultPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  setDefaultButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  setDefaultText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  addressLine1: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 4,
  },
  addressLine2: {
    fontSize: 14,
    color: '#57534E',
    marginBottom: 4,
  },
  cityStatePincode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#78716C',
    marginBottom: 16,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
    paddingTop: 12,
  },
  editActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  editActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  deleteActionButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  deleteActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  addPrimaryButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  addPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
