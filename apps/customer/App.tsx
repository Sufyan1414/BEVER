/**
 * BEVER Customer App — Entry Point
 *
 * AppNavigator owns all routing logic: session initialisation, auth state,
 * and navigator selection. Fonts load first so no screen flashes the system font.
 */
import React from 'react';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useAppFonts } from './src/fonts';

export default function App() {
  const fontsReady = useAppFonts();
  if (!fontsReady) return null;
  return <AppNavigator />;
}
