import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text } from './AppText';

const LETTERS = ['B', 'E', 'V', 'E', 'R'];
const MIN_SHOW_MS = 2300;

/**
 * Animated brand intro. Letters rise in one by one, an amber "rider dot" races along the
 * baseline and lands as the full stop, rings pulse behind like a delivery radar, then the
 * tagline fades in. Calls onDone after the animation AND once the app is ready.
 */
export function BeverSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const letters = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const line = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  const started = useRef(Date.now());
  const done = useRef(false);

  useEffect(() => {
    Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: true })).start();
    Animated.sequence([
      Animated.stagger(
        110,
        letters.map((v) => Animated.spring(v, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true })),
      ),
      Animated.parallel([
        Animated.timing(line, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(dot, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(tag, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [letters, line, dot, tag, ring]);

  useEffect(() => {
    if (!ready || done.current) return undefined;
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - started.current));
    const t = setTimeout(() => {
      done.current = true;
      Animated.timing(out, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => onDone());
    }, wait);
    return () => clearTimeout(t);
  }, [ready, onDone, out]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.6] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <Animated.View style={[s.root, { opacity: out }]}>
      <Animated.View pointerEvents="none" style={[s.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
      <View style={s.wordRow}>
        {LETTERS.map((ch, i) => (
          <Animated.Text
            key={`${ch}${i}`}
            style={[
              s.letter,
              {
                opacity: letters[i]!,
                transform: [{ translateY: letters[i]!.interpolate({ inputRange: [0, 1], outputRange: [34, 0] }) }],
              },
            ]}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>
      <View style={s.track}>
        <Animated.View style={[s.trackFill, { transform: [{ scaleX: line }] }]} />
        <Animated.View style={[s.rider, { transform: [{ translateX: dot.interpolate({ inputRange: [0, 1], outputRange: [0, 214] }) }] }]} />
      </View>
      <Animated.View style={{ opacity: tag, transform: [{ translateY: tag.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
        <Text style={s.tagline}>Your market. Minutes away.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#022C22', alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: '#6EE7B7' },
  wordRow: { flexDirection: 'row', alignItems: 'flex-end' },
  letter: { fontSize: 54, fontWeight: '800', color: '#A7F3D0', letterSpacing: 6, marginHorizontal: 2 },
  track: { width: 226, height: 12, marginTop: 10, justifyContent: 'center' },
  trackFill: { position: 'absolute', left: 0, right: 0, height: 3, borderRadius: 2, backgroundColor: 'rgba(167,243,208,0.35)' },
  rider: { position: 'absolute', left: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: '#F59E0B' },
  tagline: { marginTop: 22, fontSize: 13, letterSpacing: 2.2, color: 'rgba(209,250,229,0.8)', fontWeight: '600' },
});
