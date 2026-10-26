import * as Location from 'expo-location';

export interface ExactFix { lat: number; lng: number; accuracy: number }

/** Asks for permission and returns the phone's best GPS fix. Throws a human-readable Error. */
export async function captureExactLocation(): Promise<ExactFix> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('Allow location access in your phone settings, then try again.');
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Turn on your phone’s location (GPS) and try again.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy ?? 0) };
}
