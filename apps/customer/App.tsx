/**
 * BEVER Customer App — Entry Point
 *
 * global.css must be the FIRST import so NativeWind's Metro transformer
 * processes Tailwind classes before any component renders.
 *
 * AppNavigator owns all routing logic: session initialisation, auth state,
 * and navigator selection. Nothing else lives here.
 */
import './global.css';
import React from 'react';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return <AppNavigator />;
}
