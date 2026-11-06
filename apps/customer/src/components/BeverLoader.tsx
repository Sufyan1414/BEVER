/**
 * BEVER loader — a rider's dot orbiting a pulsing "B" badge.
 * Pure RN Animated (native driver), no extra dependencies.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text } from './AppText';

interface Props {
  size?: number;
  /** Light variant for dark backgrounds. */
  light?: boolean;
}

export function BeverLoader({ size = 44, light = false }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    b.start();
    return () => { a.stop(); b.stop(); };
  }, [spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.06] });
  const core = size * 0.62;
  const dot = Math.max(6, size * 0.2);
  const ring = light ? 'rgba(255,255,255,0.22)' : '#A7F3D0';
  const coreBg = light ? '#ECFDF5' : '#059669';
  const coreFg = light ? '#064E3B' : '#FFFFFF';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: ring }]} />
      <Animated.View style={[styles.orbit, { width: size, height: size, transform: [{ rotate }] }]}>
        <View style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2, top: -dot / 2 + 1 }]} />
      </Animated.View>
      <Animated.View
        style={{ width: core, height: core, borderRadius: core * 0.32, backgroundColor: coreBg, alignItems: 'center', justifyContent: 'center', transform: [{ scale }] }}
      >
        <Text style={{ color: coreFg, fontSize: core * 0.5, fontWeight: '800' }}>B</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 2 },
  orbit: { position: 'absolute', alignItems: 'center' },
  dot: { position: 'absolute', backgroundColor: '#F59E0B' },
});
