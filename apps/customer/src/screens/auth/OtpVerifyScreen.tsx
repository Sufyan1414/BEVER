/**
 * BEVER Customer App — OTP Verification Screen
 *
 * Receives the E.164 phone number via navigation parameters and verifies
 * the 6-digit SMS code against the real Supabase Auth backend.
 *
 * Post-verification routing:
 *   - If profile.full_name exists -> dismiss auth modal -> authenticated app.
 *   - If profile.full_name is missing -> navigate to ProfileSetupScreen.
 */

import React, { useState, useEffect, useRef } from 'react';
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
import type { OtpVerifyScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';
import { maskPhoneNumber } from '../../services/phone';

const INITIAL_COOLDOWN_SECONDS = 60;

export function OtpVerifyScreen({ route, navigation }: OtpVerifyScreenProps) {
  const { phone } = route.params;
  const maskedPhone = maskPhoneNumber(phone);

  const { verifyPhoneOtp, sendPhoneOtp, session, profile, isProfileLoading } = useAuthStore();

  const [otp, setOtp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(INITIAL_COOLDOWN_SECONDS);

  const inputRef = useRef<TextInput>(null);

  // Cooldown countdown effect
  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // Post-verification session & profile router
  useEffect(() => {
    if (session && !isProfileLoading) {
      if (profile?.full_name && profile.full_name.trim().length > 0) {
        navigation.getParent()?.goBack();
      } else {
        navigation.navigate('ProfileSetup');
      }
    }
  }, [session, profile, isProfileLoading, navigation]);

  const handleVerify = async () => {
    Keyboard.dismiss();
    const cleanOtp = otp.trim();

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setErrorMessage(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      const result = await verifyPhoneOtp(phone, cleanOtp);

      if (!result.success) {
        setErrorMessage(result.error || 'Verification failed. Please check the code.');
      }
      // On success, useEffect above handles routing to ProfileSetup or closing modal
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (cooldown > 0 || isResending) return;

    Keyboard.dismiss();
    setErrorMessage(null);
    setSuccessNotice(null);
    setIsResending(true);

    try {
      const result = await sendPhoneOtp(phone);

      if (!result.success) {
        setErrorMessage(result.error || 'Failed to resend OTP code.');
      } else {
        setSuccessNotice('A new verification code has been sent to your phone.');
        setCooldown(INITIAL_COOLDOWN_SECONDS);
        setOtp('');
        inputRef.current?.focus();
      }
    } catch {
      setErrorMessage('Failed to request new OTP code. Please check connection.');
    } finally {
      setIsResending(false);
    }
  };

  // Render 6-cell visual representation of OTP
  const renderDigits = () => {
    const digits = otp.split('');
    const boxes = [];

    for (let i = 0; i < 6; i++) {
      const digit = digits[i] || '';
      const isFocused = otp.length === i || (otp.length === 6 && i === 5);

      boxes.push(
        <View
          key={i}
          style={[
            styles.otpBox,
            digit ? styles.otpBoxFilled : null,
            isFocused ? styles.otpBoxFocused : null,
          ]}
        >
          <Text style={styles.otpDigitText}>{digit}</Text>
        </View>
      );
    }

    return boxes;
  };

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
              style={styles.backButton}
              accessibilityLabel="Back to login"
            >
              <Text style={styles.backButtonText}>← Change Number</Text>
            </TouchableOpacity>
          </View>

          {/* Main content */}
          <View style={styles.content}>
            <Text style={styles.title}>Enter Passcode</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code via SMS to{' '}
              <Text style={styles.phoneHighlight}>{maskedPhone}</Text>
            </Text>

            {/* Hidden TextInput for native keyboard entry */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={styles.otpInputContainer}
            >
              <View style={styles.otpBoxesRow}>{renderDigits()}</View>
              <TextInput
                ref={inputRef}
                value={otp}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '').slice(0, 6);
                  setOtp(cleaned);
                  if (errorMessage) setErrorMessage(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                style={styles.hiddenInput}
                accessibilityLabel="6-digit verification code input"
              />
            </TouchableOpacity>

            {/* Feedback messages */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successNotice ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successNotice}</Text>
              </View>
            ) : null}

            {/* Verify Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (otp.length !== 6 || isSubmitting) && styles.submitButtonDisabled,
              ]}
              onPress={handleVerify}
              disabled={otp.length !== 6 || isSubmitting}
              accessibilityLabel="Verify code and sign in"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Verify & Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Resend Cooldown Section */}
            <View style={styles.resendSection}>
              {cooldown > 0 ? (
                <Text style={styles.cooldownText}>
                  Resend code in <Text style={styles.cooldownSeconds}>{cooldown}s</Text>
                </Text>
              ) : (
                <TouchableOpacity
                  onPress={handleResendOtp}
                  disabled={isResending}
                  style={styles.resendButton}
                  accessibilityLabel="Resend verification code"
                >
                  {isResending ? (
                    <ActivityIndicator size="small" color="#F59E0B" />
                  ) : (
                    <Text style={styles.resendButtonText}>Resend Code via SMS</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Footer note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Didn't receive the SMS? Check your cellular signal or retry after the timer expires.
            </Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F59E0B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#57534E',
    lineHeight: 22,
    marginBottom: 32,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: '#1C1917',
  },
  otpInputContainer: {
    marginBottom: 24,
    position: 'relative',
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpBox: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: '#1C1917',
    backgroundColor: '#FFFFFF',
  },
  otpBoxFocused: {
    borderColor: '#F59E0B',
    borderWidth: 2,
  },
  otpDigitText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1917',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
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
  successBox: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  successText: {
    color: '#065F46',
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#D6D3D1',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendSection: {
    marginTop: 28,
    alignItems: 'center',
  },
  cooldownText: {
    fontSize: 14,
    color: '#78716C',
  },
  cooldownSeconds: {
    fontWeight: '700',
    color: '#1C1917',
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F59E0B',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 13,
    color: '#A8A29E',
    textAlign: 'center',
    lineHeight: 18,
  },
});
