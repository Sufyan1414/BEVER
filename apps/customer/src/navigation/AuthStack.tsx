/**
 * BEVER Customer App — Auth Stack
 *
 * Stack navigator for the authentication flow (unauthenticated users).
 * Only contains Login and Signup screens.
 *
 * ProfileSetup is NOT here — it is rendered by AppNavigator as a
 * fullscreen gate when the customer is authenticated but profile is incomplete.
 * This prevents ProfileSetup from being dismissible by the user.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F3FBF7' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}
