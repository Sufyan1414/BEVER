/**
 * BEVER Customer App — Profile Setup Screen
 *
 * Presented to newly authenticated customers whose profile is incomplete
 * (full_name is empty or missing).
 *
 * Flow:
 *   1. Prompts for customer's full name.
 *   2. Validates non-emptiness (2–100 characters).
 *   3. Calls updateProfileName() → saves to public.profiles.
 *   4. Store sets isProfileComplete = true → AppNavigator re-renders to AppTabs.
 *
 * This screen does NOT navigate imperatively. AppNavigator is the state machine.
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
import { useAuthStore } from '../../stores/useAuthStore';

export function ProfileSetupScreen() {
  const { profile, updateProfileName, isProfileLoading } = useAuthStore();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // NOTE: No useEffect navigation here.
  // AppNavigator observes isProfileComplete and re-renders to AppTabs
  // automatically when the profile save succeeds. This screen must never
  // call navigate() or goBack() — it has no parent navigator in the
  // profile-gate branch.

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const trimmed = fullName.trim();

    if (!trimmed) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (trimmed.length < 2) {
      setErrorMessage('Name must be at least 2 characters long.');
      return;
    }

    if (trimmed.length > 100) {
      setErrorMessage('Name must be 100 characters or less.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await updateProfileName(trimmed);
      if (!result.success) {
        setErrorMessage(result.error || 'Failed to save profile. Please try again.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please check connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = fullName.trim().length >= 2;

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
            <Text style={styles.wordmark}>BEVER</Text>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.heading}>Tell us your name</Text>
            <Text style={styles.subheading}>
              Your name will be used for order delivery and merchant receipts.
            </Text>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. Rahul Sharma"
                placeholderTextColor="#A8A29E"
                autoCapitalize="words"
                autoCorrect={false}
                autoFocus
                maxLength={100}
                style={[styles.input, errorMessage ? styles.inputError : null]}
                accessibilityLabel="Full name input"
              />
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid || isSubmitting || isProfileLoading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isFormValid || isSubmitting || isProfileLoading}
              accessibilityLabel="Save name and complete setup"
            >
              {isSubmitting || isProfileLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Complete Setup & Continue</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerNote}>
              You can update your name anytime in your Account Profile settings.
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: '#57534E',
    lineHeight: 22,
    marginBottom: 32,
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
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
    borderRadius: 14,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1917',
  },
  inputError: {
    borderColor: '#EF4444',
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
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  footerNote: {
    fontSize: 13,
    color: '#A8A29E',
    textAlign: 'center',
    lineHeight: 18,
  },
});
