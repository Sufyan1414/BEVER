/**
 * BEVER Customer App — Navigation Types
 *
 * Centralised React Navigation type definitions.
 * Import from here in all screens to get typed navigation props.
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CustomerAddress } from '../types/address';
import type { NearbyStore } from '../types/store';

// ─── Home Stack ───────────────────────────────────────────────────────────────

export type HomeStackParamList = {
  HomeMain: { query?: string; category?: string } | undefined;
  StoreDetail: { store: NearbyStore };
};

export type HomeMainProps = NativeStackScreenProps<HomeStackParamList, 'HomeMain'>;
export type StoreDetailProps = NativeStackScreenProps<HomeStackParamList, 'StoreDetail'>;

// ─── Auth Stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ProfileSetup: undefined;
};

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type SignupScreenProps = NativeStackScreenProps<AuthStackParamList, 'Signup'>;
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

export type CheckoutStackParamList = {
  CheckoutMain: undefined;
};

// ─── App Bottom Tabs ─────────────────────────────────────────────────────────

export type OrdersStackParamList = {
  OrdersMain: undefined;
  OrderDetail: { orderId: string };
};

export type AppTabParamList = {
  Home: undefined;
  Categories: undefined;
  Cart: undefined;
  Checkout: undefined;
  Orders: undefined;
  Profile: undefined;
};

export type HomeTabProps = BottomTabScreenProps<AppTabParamList, 'Home'>;
export type CartTabProps = BottomTabScreenProps<AppTabParamList, 'Cart'>;
export type OrdersTabProps = BottomTabScreenProps<AppTabParamList, 'Orders'>;
export type ProfileTabProps = BottomTabScreenProps<AppTabParamList, 'Profile'>;

