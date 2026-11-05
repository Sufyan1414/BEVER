import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './AppText';

type Pin = { x: number; y: number; icon: React.ComponentProps<typeof Ionicons>['name']; tint: string; delay: number };
const PINS: Pin[] = [
  { x: 0.16, y: 0.42, icon: 'storefront', tint: '#10B981', delay: 0 },
  { x: 0.8, y: 0.3, icon: 'medkit', tint: '#3B82F6', delay: 400 },
  { x: 0.72, y: 0.74, icon: 'basket', tint: '#F59E0B', delay: 800 },
  { x: 0.24, y: 0.8, icon: 'cafe', tint: '#F97316', delay: 1200 },
];

/** Stylised neighbourhood radar: faint street grid, pulsing rings, floating shop pins. */
export function LocationHero({ height = 270 }: { height?: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const floats = useRef(PINS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
    PINS.forEach((p, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(floats[i]!, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floats[i]!, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
    });
  }, [pulse, floats]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.4] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const ring2 = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1.7] });

  return (
    <View style={[s.root, { height }]}>
      {/* street grid */}
      {[0.18, 0.4, 0.62, 0.84].map((p) => <View key={`h${p}`} style={[s.hLine, { top: `${p * 100}%` }]} />)}
      {[0.12, 0.35, 0.58, 0.8].map((p) => <View key={`v${p}`} style={[s.vLine, { left: `${p * 100}%` }]} />)}
      <View style={s.diag} />

      <View style={s.center}>
        <Animated.View style={[s.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
        <Animated.View style={[s.ring, { opacity: ringOpacity, transform: [{ scale: ring2 }] }]} />
        <View style={s.pinHalo}>
          <View style={s.pinCore}><Ionicons name="location" size={26} color="#064E3B" /></View>
        </View>
      </View>

      {PINS.map((p, i) => (
        <Animated.View
          key={p.icon}
          style={[
            s.shop,
            { left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: [{ translateY: floats[i]!.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
          ]}
        >
          <Ionicons name={p.icon} size={16} color={p.tint} />
        </Animated.View>
      ))}

      <View style={s.brand}>
        <Text style={s.brandText}>BEVER</Text>
        <View style={s.brandDot} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: '#022C22', overflow: 'hidden' },
  hLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(167,243,208,0.08)' },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(167,243,208,0.08)' },
  diag: { position: 'absolute', left: -40, right: -40, top: '55%', height: 14, backgroundColor: 'rgba(167,243,208,0.05)', transform: [{ rotate: '-18deg' }] },
  center: { ...{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: '#6EE7B7' },
  pinHalo: { width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(110,231,183,0.18)', alignItems: 'center', justifyContent: 'center' },
  pinCore: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#A7F3D0', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  shop: { position: 'absolute', width: 34, height: 34, marginLeft: -17, marginTop: -17, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  brand: { position: 'absolute', left: 22, top: 18, flexDirection: 'row', alignItems: 'flex-end' },
  brandText: { fontSize: 22, fontWeight: '800', letterSpacing: 4, color: '#A7F3D0' },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B', marginLeft: 3, marginBottom: 5 },
});
