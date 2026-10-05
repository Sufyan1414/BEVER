/**
 * BEVER Customer App — Signup Screen
 *
 * Phone number + 6-digit PIN account creation screen using Supabase Auth.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { SignupScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { validateAndFormatIndianPhone } from '../../services/phone';

export function SignupScreen({ navigation }: SignupScreenProps) {
  const [localNumber, setLocalNumber] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { signUpWithPhonePin } = useAuthStore();

  // No useEffect navigation.
  // After signUpWithPhonePin() succeeds, the store sets session + isProfileComplete.
  // AppNavigator detects the state change and re-renders to the correct branch
  // (ProfileSetupGate or AppTabs). No navigate() call is needed here.

  const handleSignup = async () => {
    Keyboard.dismiss();

    const validation = validateAndFormatIndianPhone(localNumber);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setErrorMessage('PIN must be exactly 6 digits.');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMessage('PINs do not match. Please check and try again.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signUpWithPhonePin(validation.formattedPhone, pin);

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to create account. Please try again.');
      }
    } catch {
      setErrorMessage('An unexpected network error occurred. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    localNumber.replace(/\D/g, '').length === 10 &&
    pin.length === 6 &&
    confirmPin.length === 6;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.closeButton}
              accessibilityLabel="Close sign up screen"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.wordmark}>BEVER</Text>
            <Text style={styles.tagline}>Hyperlocal Beverage Marketplace</Text>

            <View style={styles.headerSpacing} />

            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subheading}>
              Sign up with your 10-digit mobile number and create a 6-digit PIN for quick sign-in.
            </Text>

            {/* Phone Number Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={styles.inputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.flag}>🇮🇳</Text>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  value={localNumber}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '').slice(0, 10);
                    setLocalNumber(digits);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="98765 43210"
                  placeholderTextColor="#A8A29E"
                  keyboardType="number-pad"
                  maxLength={10}
                  style={styles.phoneInput}
                  accessibilityLabel="10-digit mobile number input"
                  autoFocus
                />
              </View>
            </View>

            {/* Create PIN Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Create 6-Digit PIN</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={pin}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '').slice(0, 6);
                    setPin(digits);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter 6-digit PIN"
                  placeholderTextColor="#A8A29E"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  style={styles.fullInput}
                  accessibilityLabel="6-digit PIN input"
                />
              </View>
            </View>

            {/* Confirm PIN Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Confirm 6-Digit PIN</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={confirmPin}
                  onChangeText={(text) => {
                    const digits = text.replace(/\D/g, '').slice(0, 6);
                    setConfirmPin(digits);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Re-enter 6-digit PIN"
                  placeholderTextColor="#A8A29E"
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={6}
                  style={styles.fullInput}
                  accessibilityLabel="Confirm 6-digit PIN input"
                />
              </View>
            </View>

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSignup}
              disabled={!isFormValid || isSubmitting}
              accessibilityLabel="Create account button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Switch to Sign In */}
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => navigation.navigate('Login')}
              accessibilityLabel="Already have an account? Sign in"
            >
              <Text style={styles.switchButtonText}>
                Already have an account? <Text style={styles.switchHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Continue browsing without signing in"
            >
              <Text style={styles.browseButtonText}>Continue Browsing Without Sign-In</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 16,
    color: '#44403C',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 2,
  },
  headerSpacing: {
    height: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: '#57534E',
    lineHeight: 18,
    marginBottom: 20,
  },
  inputSection: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#44403C',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 14,
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: '#E7E5E4',
    gap: 6,
  },
  flag: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1917',
  },
  phoneInput: {
    flex: 1,
    height: '100%',
    paddingLeft: 14,
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1917',
  },
  fullInput: {
    flex: 1,
    height: '100%',
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1917',
    letterSpacing: 2,
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#D6D3D1',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 14,
    color: '#78716C',
  },
  switchHighlight: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 8,
  },
  browseButton: {
    backgroundColor: '#1C1917',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
