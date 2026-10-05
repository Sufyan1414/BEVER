import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { CheckoutStackParamList } from './types';
import { CheckoutScreen } from '../screens/checkout/CheckoutScreen';

const Stack = createNativeStackNavigator<CheckoutStackParamList>();

export function CheckoutNavigator() {
  return <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="CheckoutMain" component={CheckoutScreen} /></Stack.Navigator>;
}
