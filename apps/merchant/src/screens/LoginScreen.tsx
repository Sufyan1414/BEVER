import React, { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../components/AppText';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Button } from '../components/ui';
import { signInMerchant } from '../services/auth';
import { SignUpScreen } from './SignUpScreen';
import { colors, radius } from '../theme';

export function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      const r = await signInMerchant(phone, pin);
      if (!r.ok) setError(r.error ?? 'Could not sign in.');
    } catch {
      setError('No internet connection. Check your network and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'up') return <SignUpScreen onBack={() => setMode('in')} />;

  const ready = phone.length === 10 && pin.length === 6;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}><Ionicons name="storefront" size={28} color="#FFFFFF" /></View>
        <Text style={styles.brand}>BEVER Merchant</Text>
        <Text style={styles.heading}>Run your store,{'\n'}one order at a time.</Text>
        <Text style={styles.sub}>Sign in with your mobile number and 6-digit PIN.</Text>

        <Text style={styles.label}>Mobile number</Text>
        <View style={styles.phoneRow}>
          <View style={styles.prefix}><Text style={styles.prefixText}>+91</Text></View>
          <TextInput
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
            placeholder="98765 43210"
            placeholderTextColor={colors.faint}
            style={[styles.input, { flex: 1 }]}
            accessibilityLabel="Mobile number"
            autoComplete="tel"
          />
        </View>

        <Text style={styles.label}>6-digit PIN</Text>
        <TextInput
          value={pin}
          onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="••••••"
          placeholderTextColor={colors.faint}
          style={styles.input}
          accessibilityLabel="PIN"
          onSubmitEditing={() => { if (ready) void submit(); }}
        />

        {error ? <View style={{ marginTop: 18 }}><Banner message={error} tone="bad" onDismiss={() => setError(null)} /></View> : null}
        <Button label="Sign in" onPress={() => { void submit(); }} loading={busy} disabled={!ready} style={{ marginTop: 22 }} />
        <Text style={styles.switch} onPress={() => { setError(null); setMode('up'); }}>
          New store? Register your shop
        </Text>
        <Text style={styles.foot}>Store accounts are activated by BEVER after sign-up.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 24, paddingTop: 84, paddingBottom: 40 },
  logoBox: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 13, fontWeight: '900', letterSpacing: 2, color: colors.brandDark, marginTop: 18 },
  heading: { fontSize: 30, fontWeight: '900', color: colors.ink, lineHeight: 36, marginTop: 8 },
  sub: { fontSize: 14, color: colors.muted, lineHeight: 21, marginTop: 10, marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '800', color: colors.ink2, marginBottom: 6, marginTop: 14 },
  phoneRow: { flexDirection: 'row' },
  prefix: { height: 56, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: '#F5F5F4', borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  prefixText: { fontSize: 16, fontWeight: '800', color: colors.ink2 },
  input: { height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, paddingHorizontal: 16, fontSize: 17, color: colors.ink },
  switch: { fontSize: 14, fontWeight: '800', color: colors.brandDark, textAlign: 'center', marginTop: 22, padding: 8 },
  foot: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 18, lineHeight: 18 },
});
