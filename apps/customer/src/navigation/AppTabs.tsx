/**
 * BEVER Customer App — App Tabs (Authenticated)
 *
 * Bottom tab navigator shown to customers.
 * Tabs: Home | Cart | Orders | Profile
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { AppTabParamList } from './types';
import { HomeNavigator } from './HomeNavigator';
import { CartScreen } from '../screens/cart/CartScreen';
import { OrdersScreen } from '../screens/orders/OrdersScreen';
import { ProfileNavigator } from './ProfileNavigator';
import { CheckoutNavigator } from './CheckoutNavigator';
import { useCartStore, computeCartSummary } from '../stores/useCartStore';

const Tab = createBottomTabNavigator<AppTabParamList>();

// BEVER brand colours used in the tab bar
const AMBER = '#F59E0B';
const SURFACE = '#FFFBF5';
const MUTED = '#A8A29E';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof AppTabParamList, { active: IoniconName; inactive: IoniconName }> = {
  Home:    { active: 'home',          inactive: 'home-outline' },
  Cart:    { active: 'cart',          inactive: 'cart-outline' },
  Orders:  { active: 'receipt',       inactive: 'receipt-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export function AppTabs() {
  const { items } = useCartStore();
  const summary = computeCartSummary(items);
  const cartCount = summary.totalItems;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: AMBER,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: '#E7E5E4',
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home"    component={HomeNavigator}    options={{ title: 'Home' }} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          title: 'Cart',
          ...(cartCount > 0 ? {
            tabBarBadge: cartCount,
            tabBarBadgeStyle: {
              backgroundColor: '#F59E0B',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: '700' as const,
            },
          } : {}),
        }}
      />
      <Tab.Screen name="Checkout" component={CheckoutNavigator} options={{
        tabBarButton: () => null,
        tabBarItemStyle: { display: 'none' },
      }} />
      <Tab.Screen name="Orders"  component={OrdersScreen}     options={{ title: 'Orders' }} />
      <Tab.Screen name="Profile" component={ProfileNavigator} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
