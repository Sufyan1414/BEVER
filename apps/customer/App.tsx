/**
 * BEVER Customer App — Entry Point
 *
 * AppNavigator owns all routing logic: session initialisation, auth state,
 * and navigator selection. Nothing else lives here.
 */
import React from 'react';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return <AppNavigator />;
}
