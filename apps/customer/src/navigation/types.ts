/**
 * BEVER Customer App — Navigation Types
 *
 * Centralised React Navigation type definitions.
 * Import from here in all screens to get typed navigation props.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CustomerAddress } from '../types/address';

// ─── Auth Stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  OtpVerify: { phone: string };
  ProfileSetup: undefined;
};

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type OtpVerifyScreenProps = NativeStackScreenProps<AuthStackParamList, 'OtpVerify'>;
export type ProfileSetupScreenProps = NativeStackScreenProps<AuthStackParamList, 'ProfileSetup'>;

// ─── Profile Stack ────────────────────────────────────────────────────────────

export type ProfileStackParamList = {
  ProfileMain: undefined;
  AddressList: undefined;
  AddressForm: {
    address?: CustomerAddress;
    selectedLocation?: { latitude: number; longitude: number };
  } | undefined;
  AddressLocationPicker: {
    initialLat?: number | null;
    initialLng?: number | null;
  };
};

export type ProfileMainProps = NativeStackScreenProps<ProfileStackParamList, 'ProfileMain'>;
export type AddressListProps = NativeStackScreenProps<ProfileStackParamList, 'AddressList'>;
export type AddressFormProps = NativeStackScreenProps<ProfileStackParamList, 'AddressForm'>;
export type AddressLocationPickerProps = NativeStackScreenProps<
  ProfileStackParamList,
  'AddressLocationPicker'
>;

// ─── App Bottom Tabs ─────────────────────────────────────────────────────────

export type AppTabParamList = {
  Home: undefined;
  Cart: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type HomeTabProps = BottomTabScreenProps<AppTabParamList, 'Home'>;
export type CartTabProps = BottomTabScreenProps<AppTabParamList, 'Cart'>;
export type OrdersTabProps = BottomTabScreenProps<AppTabParamList, 'Orders'>;
export type ProfileTabProps = BottomTabScreenProps<AppTabParamList, 'Profile'>;
