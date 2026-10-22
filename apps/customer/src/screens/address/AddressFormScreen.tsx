/**
 * BEVER Customer App — Address Form Screen
 *
 * Form to create a new delivery address or update an existing one.
 *
 * Validation:
 *   - Label pill selection (Home / Work / Other)
 *   - Address Line 1 (Required)
 *   - City (Required)
 *   - State (Required)
 *   - Pincode (Required, exactly 6 digits)
 *   - Default toggle switch
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { AddressFormProps } from '../../navigation/types';
import {
  createAddress,
  updateAddress,
  validateIndianAddress,
  parseLocationPoint,
} from '../../services/address';

const LABELS = ['Home', 'Work', 'Other'];

export function AddressFormScreen({ route, navigation }: AddressFormProps) {
  const existingAddress = route.params?.address;
  const isEditing = Boolean(existingAddress);

  const initialCoords = parseLocationPoint(existingAddress?.location);

  const [label, setLabel] = useState(existingAddress?.label || 'Home');
  const [line1, setLine1] = useState(existingAddress?.address_line_1 || '');
  const [line2, setLine2] = useState(existingAddress?.address_line_2 || '');
  const [city, setCity] = useState(existingAddress?.city || '');
  const [state, setState] = useState(existingAddress?.state || '');
  const [pincode, setPincode] = useState(existingAddress?.pincode || '');
  const [latitude, setLatitude] = useState<number | null>(initialCoords?.lat ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialCoords?.lng ?? null);
  const [isDefault, setIsDefault] = useState(existingAddress?.is_default || false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Update location state when returning from AddressLocationPicker
  useEffect(() => {
    if (route.params?.selectedLocation) {
      setLatitude(route.params.selectedLocation.latitude);
      setLongitude(route.params.selectedLocation.longitude);
    }
  }, [route.params?.selectedLocation]);

  const handleSave = async () => {
    const payload = {
      label,
      address_line_1: line1,
      address_line_2: line2,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default: isDefault,
    };

    const validation = validateIndianAddress(payload);
    setFieldErrors(validation.errors);

    if (!validation.isValid) {
      setServerError('Please fix the errors highlighted below.');
      return;
    }

    setServerError(null);
    setIsSubmitting(true);

    try {
      if (isEditing && existingAddress) {
        await updateAddress(existingAddress.id, payload);
      } else {
        await createAddress(payload);
      }
      navigation.goBack();
    } catch (err: any) {
      setServerError(err?.message || 'Could not save address. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Cancel address form"
          >
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Address' : 'Add Delivery Address'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSubmitting}
            style={styles.saveHeaderButton}
            accessibilityLabel="Save address"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#059669" size="small" />
            ) : (
              <Text style={styles.saveHeaderButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.formContent}>
          {/* Global Server Error Banner */}
          {serverError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{serverError}</Text>
            </View>
          ) : null}

          {/* Label Selector */}
          <Text style={styles.fieldLabel}>Address Type</Text>
          <View style={styles.labelPillsRow}>
            {LABELS.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.pill, label === item ? styles.pillSelected : null]}
                onPress={() => setLabel(item)}
              >
                <Text style={[styles.pillText, label === item ? styles.pillTextSelected : null]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Address Line 1 */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Flat / Building / Street Address *</Text>
            <TextInput
              value={line1}
              onChangeText={(text) => {
                setLine1(text);
                if (fieldErrors['address_line_1']) {
                  setFieldErrors((prev) => ({ ...prev, address_line_1: '' }));
                }
              }}
              placeholder="e.g. Flat 302, Green Valley Apartments"
              placeholderTextColor="#A8A29E"
              style={[styles.input, fieldErrors['address_line_1'] ? styles.inputError : null]}
              accessibilityLabel="Address line 1"
            />
            {fieldErrors['address_line_1'] ? (
              <Text style={styles.fieldErrorText}>{fieldErrors['address_line_1']}</Text>
            ) : null}
          </View>

          {/* Address Line 2 */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Landmark / Area (Optional)</Text>
            <TextInput
              value={line2}
              onChangeText={setLine2}
              placeholder="e.g. Near Indiranagar Metro Station"
              placeholderTextColor="#A8A29E"
              style={styles.input}
              accessibilityLabel="Address line 2"
            />
          </View>

          {/* City & State Row */}
          <View style={styles.rowTwo}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>City *</Text>
              <TextInput
                value={city}
                onChangeText={(text) => {
                  setCity(text);
                  if (fieldErrors['city']) {
                    setFieldErrors((prev) => ({ ...prev, city: '' }));
                  }
                }}
                placeholder="e.g. Bengaluru"
                placeholderTextColor="#A8A29E"
                style={[styles.input, fieldErrors['city'] ? styles.inputError : null]}
                accessibilityLabel="City"
              />
              {fieldErrors['city'] ? (
                <Text style={styles.fieldErrorText}>{fieldErrors['city']}</Text>
              ) : null}
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>State *</Text>
              <TextInput
                value={state}
                onChangeText={(text) => {
                  setState(text);
                  if (fieldErrors['state']) {
                    setFieldErrors((prev) => ({ ...prev, state: '' }));
                  }
                }}
                placeholder="e.g. Karnataka"
                placeholderTextColor="#A8A29E"
                style={[styles.input, fieldErrors['state'] ? styles.inputError : null]}
                accessibilityLabel="State"
              />
              {fieldErrors['state'] ? (
                <Text style={styles.fieldErrorText}>{fieldErrors['state']}</Text>
              ) : null}
            </View>
          </View>

          {/* Pincode */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>6-Digit Pincode *</Text>
            <TextInput
              value={pincode}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 6);
                setPincode(digits);
                if (fieldErrors['pincode']) {
                  setFieldErrors((prev) => ({ ...prev, pincode: '' }));
                }
              }}
              placeholder="e.g. 560038"
              placeholderTextColor="#A8A29E"
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.input, fieldErrors['pincode'] ? styles.inputError : null]}
              accessibilityLabel="6-digit pincode"
            />
            {fieldErrors['pincode'] ? (
              <Text style={styles.fieldErrorText}>{fieldErrors['pincode']}</Text>
            ) : null}
          </View>

          {/* Delivery Location Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Map Delivery Location</Text>
            <View style={styles.locationCard}>
              <View style={styles.locationCardLeft}>
                <Text style={styles.locationIcon}>
                  {latitude !== null && longitude !== null ? '📍' : '🗺️'}
                </Text>
                <View style={styles.locationTextWrap}>
                  <Text style={styles.locationTitle}>
                    {latitude !== null && longitude !== null
                      ? 'Location Selected'
                      : 'Location Not Selected'}
                  </Text>
                  <Text style={styles.locationSubtext}>
                    {latitude !== null && longitude !== null
                      ? 'Pin position saved for delivery discovery'
                      : 'Move the pin on the map to set location'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.locationButton}
                onPress={() =>
                  navigation.navigate('AddressLocationPicker', {
                    initialLat: latitude,
                    initialLng: longitude,
                  })
                }
                accessibilityLabel="Select location on map"
              >
                <Text style={styles.locationButtonText}>
                  {latitude !== null && longitude !== null ? 'Change' : 'Pin on Map'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Default Switch */}
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={styles.switchLabel}>Set as Default Address</Text>
              <Text style={styles.switchSubtext}>
                Use this address by default for store delivery calculations
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: '#E7E5E4', true: '#A7F3D0' }}
              thumbColor={isDefault ? '#059669' : '#F5F5F4'}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.savePrimaryButton, isSubmitting && styles.savePrimaryButtonDisabled]}
            onPress={handleSave}
            disabled={isSubmitting}
            accessibilityLabel="Save delivery address"
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.savePrimaryText}>
                {isEditing ? 'Update Address' : 'Save Address'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3FBF7',
  },
  keyboardContainer: {
    flex: 1,
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
    paddingHorizontal: 4,
  },
  backButtonText: {
    fontSize: 15,
    color: '#78716C',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
  },
  saveHeaderButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  saveHeaderButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  formContent: {
    padding: 24,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#44403C',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelPillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
  },
  pillSelected: {
    backgroundColor: '#D1FAE5',
    borderColor: '#059669',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78716C',
  },
  pillTextSelected: {
    color: '#065F46',
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 20,
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1917',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  fieldErrorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
  },
  locationCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    paddingRight: 8,
  },
  locationIcon: {
    fontSize: 24,
  },
  locationTextWrap: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 2,
  },
  locationSubtext: {
    fontSize: 12,
    color: '#78716C',
    lineHeight: 16,
  },
  locationButton: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  locationButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    marginBottom: 28,
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 2,
  },
  switchSubtext: {
    fontSize: 12,
    color: '#78716C',
  },
  savePrimaryButton: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  savePrimaryButtonDisabled: {
    backgroundColor: '#D6D3D1',
  },
  savePrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
