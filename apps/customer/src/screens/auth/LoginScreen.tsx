/**
 * BEVER Customer App — Login Screen
 *
 * Phone number entry screen for real Supabase SMS OTP authentication.
 *
 * Flow:
 *   1. User enters 10-digit Indian mobile number (+91).
 *   2. Validates number before sending request.
 *   3. Calls `useAuthStore.sendPhoneOtp(phone)`.
 *   4. Navigates to `OtpVerifyScreen` on success.
 *   5. Shows clear error messages for invalid inputs or server errors.
 */

import React, { useState, useEffect } from 'react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { sendPhoneOtp, session } = useAuthStore();

  // If already authenticated, dismiss the modal
  useEffect(() => {
    if (session) {
      navigation.getParent()?.goBack();
    }
  }, [session, navigation]);

  const handleSendOtp = async () => {
    Keyboard.dismiss();

    const validation = validateAndFormatIndianPhone(localNumber);
    if (!validation.isValid) {
      setErrorMessage(validation.error || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await sendPhoneOtp(validation.formattedPhone);

      if (!result.success) {
        setErrorMessage(
          result.error || 'Failed to send verification code. Please try again.'
        );
      } else {
        // Successfully requested OTP; navigate to verification screen
        navigation.navigate('OtpVerify', { phone: validation.formattedPhone });
      }
    } catch {
      setErrorMessage('An unexpected network error occurred. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = localNumber.replace(/\D/g, '').length === 10;

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

          {/* Main Content */}
          <View style={styles.content}>
            <Text style={styles.wordmark}>BEVER</Text>
            <Text style={styles.tagline}>Hyperlocal Beverage Marketplace</Text>

            <View style={styles.headerSpacing} />

            <Text style={styles.heading}>Sign in to BEVER</Text>
            <Text style={styles.subheading}>
              Enter your mobile number to receive a 6-digit verification passcode via SMS.
            </Text>

            {/* Phone Number Input Group */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Mobile Number</Text>
              <View style={[styles.inputRow, errorMessage ? styles.inputRowError : null]}>
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

            {/* Error banner */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleSendOtp}
              disabled={!isFormValid || isSubmitting}
              accessibilityLabel="Send OTP verification code"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Send Passcode</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimerText}>
              By continuing, you agree to receive SMS verification codes from BEVER. Standard carrier rates may apply.
            </Text>
          </View>

          {/* Bottom browse button */}
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
    height: 24,
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
    marginBottom: 28,
  },
  inputSection: {
    marginBottom: 20,
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
  inputRowError: {
    borderColor: '#EF4444',
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
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
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
  disclaimerText: {
    fontSize: 12,
    color: '#A8A29E',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
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
