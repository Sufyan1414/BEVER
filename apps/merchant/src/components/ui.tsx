import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from './AppText';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';
import type { Tone } from '../lib/format';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', loading = false, disabled = false, icon, small = false, style }: ButtonProps) {
  const inactive = disabled || loading;
  const textColor = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? colors.danger : colors.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        variant === 'ghost' && styles.btnGhost,
        inactive && { opacity: 0.55 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.btnRow}>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={textColor} style={{ marginRight: 6 }} /> : null}
          <Text style={[styles.btnText, small && { fontSize: 13 }, { color: textColor }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const toneColors: Record<Tone, { bg: string; fg: string; line: string }> = {
  warn: { bg: colors.brandSoft, fg: colors.brandDark, line: colors.brandLine },
  info: { bg: colors.infoSoft, fg: colors.info, line: colors.infoLine },
  ok: { bg: colors.successSoft, fg: colors.success, line: colors.successLine },
  bad: { bg: colors.dangerSoft, fg: colors.danger, line: colors.dangerLine },
  neutral: { bg: '#F5F5F4', fg: colors.ink2, line: colors.lineStrong },
};

export function Pill({ label, tone = 'neutral', style }: { label: string; tone?: Tone; style?: StyleProp<ViewStyle> }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.line }, style]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export function Chip({ label, active, count, onPress }: { label: string; active: boolean; count?: number | undefined; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {count !== undefined && count > 0 ? (
        <View style={[styles.chipCount, active && { backgroundColor: '#FFFFFF' }]}>
          <Text style={[styles.chipCountText, active && { color: colors.brandDark }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.brand} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export function Banner({ message, tone = 'warn', onRetry, onDismiss }: { message: string; tone?: Tone; onRetry?: (() => void) | undefined; onDismiss?: (() => void) | undefined }) {
  const c = toneColors[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: c.bg, borderColor: c.line }]}>
      <Text style={[styles.bannerText, { color: c.fg }]}>{message}</Text>
      {onRetry ? <Pressable onPress={onRetry} hitSlop={8}><Text style={[styles.bannerAction, { color: c.fg }]}>Retry</Text></Pressable> : null}
      {onDismiss ? <Pressable onPress={onDismiss} hitSlop={8}><Ionicons name="close" size={18} color={c.fg} /></Pressable> : null}
    </View>
  );
}

export function SectionTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Skeleton({ height = 90 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

const styles = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnSmall: { minHeight: 42, paddingHorizontal: 14, borderRadius: radius.sm },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.brand },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  btnDanger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.dangerLine },
  btnGhost: { backgroundColor: 'transparent' },
  btnText: { fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow.card },
  pill: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  chip: { flexDirection: 'row', alignItems: 'center', height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, marginRight: 8 },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
  chipTextActive: { color: '#FFFFFF' },
  chipCount: { marginLeft: 8, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chipCountText: { fontSize: 11, fontWeight: '900', color: colors.brandDark },
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  emptyIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: colors.ink, marginTop: 16, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: colors.muted, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18, marginRight: 10 },
  bannerAction: { fontSize: 13, fontWeight: '900', marginLeft: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '900', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10, marginTop: 6 },
  skeleton: { backgroundColor: '#F3F1EE', borderRadius: radius.lg, marginBottom: 12 },
});
