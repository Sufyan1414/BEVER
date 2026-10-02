/**
 * BEVER Customer App — Profile Stack Navigator
 *
 * Houses profile and address management screens within the Profile bottom tab.
 * Screens:
 *   - ProfileMain: Account summary & details
 *   - AddressList: Saved delivery addresses
 *   - AddressForm: Add or edit delivery address
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from './types';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { AddressListScreen } from '../screens/address/AddressListScreen';
import { AddressFormScreen } from '../screens/address/AddressFormScreen';
import { AddressLocationPickerScreen } from '../screens/address/AddressLocationPickerScreen';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFBF5' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="AddressList" component={AddressListScreen} />
      <Stack.Screen name="AddressForm" component={AddressFormScreen} />
      <Stack.Screen name="AddressLocationPicker" component={AddressLocationPickerScreen} />
    </Stack.Navigator>
  );
}
