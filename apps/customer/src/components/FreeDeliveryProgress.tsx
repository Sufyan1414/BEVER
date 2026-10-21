import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

/** Matches the server rule in create_customer_order: merchandise subtotal >= ₹199 ships free. */
export const FREE_DELIVERY_THRESHOLD_PAISE = 19900;

const rupees = (paise: number) => `₹${Math.ceil(paise / 100)}`;

export function FreeDeliveryProgress({ subtotalPaise, style }: { subtotalPaise: number; style?: StyleProp<ViewStyle> | undefined }) {
  const unlocked = subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE;
  const pct = Math.min(100, Math.round((subtotalPaise / FREE_DELIVERY_THRESHOLD_PAISE) * 100));
  const remaining = FREE_DELIVERY_THRESHOLD_PAISE - subtotalPaise;
  return (
    <View
      style={[styles.box, unlocked && styles.boxDone, style]}
      accessible
      accessibilityLabel={unlocked ? 'Free delivery unlocked' : `Add ${rupees(remaining)} more for free delivery`}
    >
      <Text style={[styles.text, unlocked && styles.textDone]}>
        {unlocked ? 'Free delivery unlocked on this order' : `Add ${rupees(remaining)} more for free delivery`}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, unlocked && styles.fillDone, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFF7E6', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 14, padding: 14, marginBottom: 14 },
  boxDone: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  text: { fontSize: 12, fontWeight: '800', color: '#92400E' },
  textDone: { color: '#047857' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.07)', marginTop: 10, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  fillDone: { backgroundColor: '#10B981' },
});
