/**
 * BEVER splash — letters rise in one by one, a saffron "delivery streak" sweeps under the
 * wordmark, the tagline fades in, then the orbit loader runs until the app is ready.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Text } from './AppText';
import { BeverLoader } from './BeverLoader';

const LETTERS = ['B', 'E', 'V', 'E', 'R'];
const MIN_MS = 2600;
const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  /** True once auth + location state have resolved. */
  ready: boolean;
  onDone: () => void;
}

export function BeverSplash({ ready, onDone }: Props) {
  const letters = useMemo(() => LETTERS.map(() => new Animated.Value(0)), []);
  const streak = useRef(new Animated.Value(0)).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const loader = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const minElapsed = useRef(false);
  const doneRef = useRef(false);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  const tryFinish = useRef(() => {});
  tryFinish.current = () => {
    if (doneRef.current || !minElapsed.current || !readyRef.current) return;
    doneRef.current = true;
    Animated.timing(exit, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onDone());
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    ).start();
    Animated.sequence([
      Animated.stagger(
        90,
        letters.map((v) => Animated.spring(v, { toValue: 1, damping: 11, stiffness: 140, mass: 0.7, useNativeDriver: true })),
      ),
      Animated.parallel([
        Animated.timing(streak, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(tagline, { toValue: 1, duration: 600, delay: 150, useNativeDriver: true }),
      ]),
      Animated.timing(loader, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => { minElapsed.current = true; tryFinish.current(); }, MIN_MS);
    return () => clearTimeout(t);
  }, [letters, streak, tagline, loader, glow]);

  useEffect(() => { tryFinish.current(); }, [ready]);

  const streakX = streak.interpolate({ inputRange: [0, 1], outputRange: [-SCREEN_W * 0.5, 0] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });

  return (
    <Animated.View style={[styles.root, { opacity: exit }]}>
      <StatusBar style="light" />
      <Animated.View style={[styles.orbA, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <View style={styles.orbB} />
      <View style={styles.center}>
        <View style={styles.row}>
          {letters.map((v, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                i === 2 && styles.letterAccent,
                {
                  opacity: v,
                  transform: [
                    { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
                    { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                  ],
                },
              ]}
            >
              {LETTERS[i]}
            </Animated.Text>
          ))}
        </View>
        <View style={styles.streakTrack}>
          <Animated.View style={[styles.streak, { opacity: streak, transform: [{ translateX: streakX }] }]} />
        </View>
        <Animated.View style={{ opacity: tagline, transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
          <Text style={styles.tagline}>Everything nearby. In minutes.</Text>
        </Animated.View>
      </View>
      <Animated.View style={[styles.loaderWrap, { opacity: loader }]}>
        <BeverLoader size={40} light />
        <Text style={styles.loaderText}>Finding stores near you</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#064E3B', alignItems: 'center', justifyContent: 'center' },
  orbA: { position: 'absolute', top: -120, right: -100, width: 340, height: 340, borderRadius: 170, backgroundColor: '#047857' },
  orbB: { position: 'absolute', bottom: -140, left: -120, width: 320, height: 320, borderRadius: 160, backgroundColor: '#065F46', opacity: 0.7 },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row' },
  letter: { fontSize: 56, color: '#ECFDF5', fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: 3 },
  letterAccent: { color: '#FBBF24' },
  streakTrack: { width: 150, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10, marginBottom: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  streak: { width: 150, height: 4, borderRadius: 2, backgroundColor: '#F59E0B' },
  tagline: { color: '#A7F3D0', fontSize: 14, fontWeight: '500', letterSpacing: 0.6 },
  loaderWrap: { position: 'absolute', bottom: 72, alignItems: 'center', gap: 10 },
  loaderText: { color: '#6EE7B7', fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
});
