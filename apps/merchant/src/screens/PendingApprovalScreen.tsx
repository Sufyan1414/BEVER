import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/ui';
import { supabase } from '../services/supabase';
import { colors, radius } from '../theme';

export function PendingApprovalScreen({ phone, onCheck }: { phone: string; onCheck: () => void }) {
  return (
    <View style={styles.wrap}>
      <StatusBar style="dark" />
      <View style={styles.icon}><Ionicons name="time-outline" size={34} color={colors.brandDark} /></View>
      <Text style={styles.title}>Account created</Text>
      <Text style={styles.body}>
        {phone ? `+91 ${phone} is signed up.` : 'Your number is signed up.'} BEVER now links this number to your store.
        Once that is done, tap the button below and your orders will appear.
      </Text>
      <View style={styles.box}>
        <Text style={styles.boxText}>Tell BEVER support your registered mobile number so we can activate your store.</Text>
      </View>
      <Button label="I have been activated – check again" onPress={onCheck} style={{ marginTop: 24, alignSelf: 'stretch' }} />
      <Button label="Sign out" variant="ghost" onPress={() => { void supabase.auth.signOut(); }} style={{ marginTop: 10, alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 28, justifyContent: 'center', alignItems: 'center' },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '900', color: colors.ink, marginTop: 20 },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22, marginTop: 10 },
  box: { marginTop: 20, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  boxText: { fontSize: 13, color: colors.ink2, textAlign: 'center', lineHeight: 19 },
});
