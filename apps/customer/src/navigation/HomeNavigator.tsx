/**
 * BEVER Customer App — Home Navigator
 *
 * Stack navigator for the Home tab.
 * Screens:
 *   - HomeMain: HomeScreen (Store discovery list)
 *   - StoreDetail: StoreDetailScreen (Store catalogue & products)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { HomeStackParamList } from './types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { StoreDetailScreen } from '../screens/store/StoreDetailScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F3FBF7' },
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
    </Stack.Navigator>
  );
}
