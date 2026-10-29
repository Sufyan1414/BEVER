/**
 * BEVER Customer App — App Tabs
 *
 * Bottom tab navigator for the customer experience.
 * Checkout is a hidden tab route so the existing navigation architecture
 * remains intact while allowing Cart → Checkout transitions.
 */

import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import type { AppTabParamList } from './types';
import { HomeNavigator } from './HomeNavigator';
import { CategoriesScreen } from '../screens/categories/CategoriesScreen';
import { CartScreen } from '../screens/cart/CartScreen';
import { OrdersNavigator } from './OrdersNavigator';
import { ProfileNavigator } from './ProfileNavigator';
import { CheckoutNavigator } from './CheckoutNavigator';
import { useCartStore } from '../stores/useCartStore';

const Tab = createBottomTabNavigator<AppTabParamList>();

const AMBER = '#059669';
const SURFACE = '#F7F7F3';
const MUTED = '#9A9A94';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof AppTabParamList, { active: IoniconName; inactive: IoniconName }> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Categories: { active: 'grid', inactive: 'grid-outline' },
  Cart: { active: 'cart', inactive: 'cart-outline' },
  Checkout: { active: 'card', inactive: 'card-outline' },
  Orders: { active: 'receipt', inactive: 'receipt-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export function AppTabs() {
  const { pendingCheckout, consumeCheckoutIntent } = useCartStore();

  // After guest authentication/profile setup, AppNavigator mounts a fresh
  // AppTabs tree. Start directly at Checkout when that was the user's intent.
  useEffect(() => {
    if (pendingCheckout) {
      consumeCheckoutIntent();
    }
  }, [pendingCheckout, consumeCheckoutIntent]);

  return (
    <Tab.Navigator
      initialRouteName={pendingCheckout ? 'Checkout' : 'Home'}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: AMBER,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: {
          backgroundColor: SURFACE,
          borderTopColor: '#E6E6E1',
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 68,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.active : icons.inactive;
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeNavigator} options={{ title: 'Home' }} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{ title: 'Cart', tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="Checkout"
        component={CheckoutNavigator}
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tab.Screen name="Orders" component={OrdersNavigator} options={{ title: 'Order Again' }} />
      <Tab.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Categories' }} />
      <Tab.Screen name="Profile" component={ProfileNavigator} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
