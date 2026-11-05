import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './AppText';

const DOTS = 9;
const WIDTH = 168;

/** BEVER's loader: a rider dot rides from the shop to your door along a dotted route. */
export function BeverLoader({ label = 'Finding shops near you' }: { label?: string }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  const x = t.interpolate({ inputRange: [0, 1], outputRange: [0, WIDTH - 14] });
  const bob = t.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -4, 0, -4, 0] });
  return (
    <View style={s.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={s.row}>
        <View style={[s.endpoint, { backgroundColor: '#D1FAE5' }]}><Ionicons name="storefront" size={18} color="#047857" /></View>
        <View style={s.route}>
          {Array.from({ length: DOTS }).map((_, i) => <View key={i} style={s.routeDot} />)}
          <Animated.View style={[s.rider, { transform: [{ translateX: x }, { translateY: bob }] }]} />
        </View>
        <View style={[s.endpoint, { backgroundColor: '#FEF3C7' }]}><Ionicons name="home" size={18} color="#B45309" /></View>
      </View>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  endpoint: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  route: { width: WIDTH, height: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#A7F3D0' },
  rider: { position: 'absolute', left: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#F59E0B', borderWidth: 2, borderColor: '#fff' },
  label: { marginTop: 14, fontSize: 13, fontWeight: '600', color: '#57534E', letterSpacing: 0.3 },
});
