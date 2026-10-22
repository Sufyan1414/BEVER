/**
 * BEVER Customer App — Profile Screen
 *
 * Displays real authenticated customer profile information from public.profiles:
 *   - Full name (with in-line name editing)
 *   - Phone number from authenticated session
 *   - Delivery Addresses management link
 *   - Sign Out action
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/useAuthStore';

type ProfileNav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

export function ProfileScreen() {
  const { session, user, profile, updateProfileName, signOut } = useAuthStore();
  const navigation = useNavigation<ProfileNav>();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isAuthenticated = session !== null;
  const fullName = profile?.full_name || 'Customer';
  const phone = profile?.phone || user?.phone || 'Not available';
  const initialLetter = fullName.trim() ? fullName.trim().charAt(0).toUpperCase() : 'C';

  const handleOpenEditModal = () => {
    setEditNameValue(profile?.full_name || '');
    setEditError(null);
    setIsEditModalVisible(true);
  };

  const handleSaveName = async () => {
    const trimmed = editNameValue.trim();
    if (!trimmed) {
      setEditError('Please enter a valid full name.');
      return;
    }

    if (trimmed.length < 2) {
      setEditError('Name must be at least 2 characters.');
      return;
    }

    setEditError(null);
    setIsUpdatingName(true);

    try {
      const result = await updateProfileName(trimmed);
      if (!result.success) {
        setEditError(result.error || 'Failed to update name.');
      } else {
        setIsEditModalVisible(false);
      }
    } catch {
      setEditError('An unexpected error occurred. Please try again.');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await signOut();
          } catch {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          } finally {
            setIsSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <Text style={styles.title}>Account Profile</Text>

        {isAuthenticated ? (
          <>
            {/* Avatar Circle */}
            <View style={styles.avatarWrap}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>{initialLetter}</Text>
              </View>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.userRoleBadge}>Customer Account</Text>
            </View>

            {/* Menu List */}
            <View style={styles.menuCard}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => navigation.navigate('AddressList')}
                accessibilityLabel="Manage saved delivery addresses"
              >
                <View style={styles.menuRowLeft}>
                  <Text style={styles.menuIcon}>📍</Text>
                  <View>
                    <Text style={styles.menuText}>Delivery Addresses</Text>
                    <Text style={styles.menuSubtext}>Manage saved delivery locations</Text>
                  </View>
                </View>
                <Text style={styles.menuChevron}>→</Text>
              </TouchableOpacity>
            </View>

            {/* Profile Information Card */}
            <View style={styles.infoCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.infoLabel}>Profile Information</Text>
                <TouchableOpacity onPress={handleOpenEditModal} style={styles.editButton}>
                  <Text style={styles.editButtonText}>Edit Name</Text>
                </TouchableOpacity>
              </View>

              <InfoRow label="Full Name" value={fullName} />
              <InfoRow label="Phone Number" value={phone} />
              <InfoRow label="Account Type" value="Customer" />
              <InfoRow
                label="Member Since"
                value={
                  profile?.created_at
                    ? new Date(profile.created_at).toLocaleDateString()
                    : 'Recent'
                }
              />
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity
              style={[styles.signOutButton, isSigningOut && styles.signOutButtonDisabled]}
              onPress={handleSignOut}
              disabled={isSigningOut}
              accessibilityLabel="Sign out of your account"
            >
              <Text style={styles.signOutText}>
                {isSigningOut ? 'Signing Out…' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.authRequired}>
            <Text style={styles.authIcon}>👤</Text>
            <Text style={styles.authHeading}>Sign in to view your profile</Text>
            <Text style={styles.authBody}>
              Manage your account, addresses, track orders, and update details.
            </Text>
            <TouchableOpacity
              style={styles.signInButton}
              onPress={() => (navigation as any).navigate('Auth')}
              accessibilityLabel="Sign in to view profile"
            >
              <Text style={styles.signInText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Edit Name Modal */}
        <Modal
          visible={isEditModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEditModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Full Name</Text>
              <Text style={styles.modalSubtitle}>
                Update the name associated with your customer account.
              </Text>

              <TextInput
                value={editNameValue}
                onChangeText={(text) => {
                  setEditNameValue(text);
                  if (editError) setEditError(null);
                }}
                placeholder="Full Name"
                placeholderTextColor="#A8A29E"
                autoFocus
                maxLength={100}
                style={[styles.modalInput, editError ? styles.modalInputError : null]}
              />

              {editError ? <Text style={styles.modalErrorText}>{editError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setIsEditModalVisible(false)}
                  disabled={isUpdatingName}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSaveButton, isUpdatingName && styles.modalSaveDisabled]}
                  onPress={handleSaveName}
                  disabled={isUpdatingName}
                >
                  {isUpdatingName ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue} numberOfLines={1} ellipsizeMode="tail">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F3FBF7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 20,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#D1FAE5',
    borderWidth: 2.5,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '800',
    color: '#059669',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1917',
    marginBottom: 4,
  },
  userRoleBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    marginBottom: 16,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    fontSize: 22,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1917',
  },
  menuSubtext: {
    fontSize: 12,
    color: '#78716C',
    marginTop: 2,
  },
  menuChevron: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A8A29E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editButton: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F4',
  },
  infoRowLabel: {
    fontSize: 14,
    color: '#78716C',
    fontWeight: '500',
  },
  infoRowValue: {
    fontSize: 14,
    color: '#1C1917',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 16,
  },
  signOutButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 'auto',
    marginBottom: 24,
  },
  signOutButtonDisabled: {
    opacity: 0.5,
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
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
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1917',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#78716C',
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#F5F5F4',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1917',
    marginBottom: 12,
  },
  modalInputError: {
    borderColor: '#EF4444',
  },
  modalErrorText: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#78716C',
  },
  modalSaveButton: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalSaveDisabled: {
    backgroundColor: '#D6D3D1',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
