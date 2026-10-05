/**
 * BEVER Customer App — Login Screen
 *
 * Phone number + 6-digit PIN sign in screen using Supabase Auth.
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
import type { LoginScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { validateAndFormatIndianPhone } from '../../services/phone';

export function LoginScreen({ navigation }: LoginScreenProps) {
  const [localNumber, setLocalNumber] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { signInWithPhonePin } = useAuthStore();

  // No useEffect navigation.
  // After signInWithPhonePin() succeeds, the store sets session + isProfileComplete.
  // AppNavigator detects the state change and re-renders to the correct branch
  // (ProfileSetupGate if profile incomplete, AppTabs if complete).

  const handleSignIn = async () => {
    Keyboard.dismiss();

    const validation = validateAndFormatIndianPhone(localNumber);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setErrorMessage('Please enter your 6-digit PIN.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signInWithPhonePin(validation.formattedPhone, pin);

      if (!result.success) {
        setErrorMessage(
          result.error || 'Invalid mobile number or PIN. Please check your credentials.'
        );
      }
    } catch {
      setErrorMessage('An unexpected network error occurred. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = localNumber.replace(/\D/g, '').length === 10 && pin.length === 6;

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
              accessibilityLabel="Close sign in screen"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.wordmark}>BEVER</Text>
            <Text style={styles.tagline}>Hyperlocal Beverage Marketplace</Text>

            <View style={styles.headerSpacing} />

            <Text style={styles.heading}>Sign in to BEVER</Text>
            <Text style={styles.subheading}>
              Enter your registered mobile number and 6-digit PIN to sign in.
            </Text>

            {/* Phone Input */}
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

            {/* PIN Input */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>6-Digit PIN</Text>
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

            {/* Error Banner */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Sign In Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={!isFormValid || isSubmitting}
              accessibilityLabel="Sign in button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Switch to Create Account */}
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => navigation.navigate('Signup')}
              accessibilityLabel="New to BEVER? Create account"
            >
              <Text style={styles.switchButtonText}>
                New to BEVER? <Text style={styles.switchHighlight}>Create Account</Text>
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
    paddingTop: 12,
  },
  wordmark: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 3,
  },
  tagline: {
    fontSize: 13,
    color: '#78716C',
    marginTop: 2,
  },
  headerSpacing: {
    height: 20,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 6,
  },
  subheading: {
    fontSize: 14,
    color: '#57534E',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#44403C',
    marginBottom: 8,
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
    height: 56,
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
    padding: 14,
    marginBottom: 18,
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
    paddingVertical: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 15,
    color: '#78716C',
  },
  switchHighlight: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
  browseButton: {
    backgroundColor: '#1C1917',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
