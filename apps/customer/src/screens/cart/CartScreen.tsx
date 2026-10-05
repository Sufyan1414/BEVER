/**
 * BEVER Customer App — Cart Screen
 *
 * Displays the customer's active shopping cart powered by useCartStore.
 *
 * Features:
 *   - Shows store header, line items with quantity steppers, subtotal.
 *   - Empty-cart state with navigation back to Home.
 *   - Clear-cart action with confirmation dialog.
 *   - "Continue to Checkout" CTA — navigation placeholder only.
 *     Order creation is Task 4; this button is disabled until the
 *     Checkout screen exists.
 *   - Available to guests and authenticated users alike (Task 2 scope).
 *     Authentication gate comes in Task 3.
 *   - Prices displayed in rupees (paise ÷ 100, no decimals for whole values).
 *   - No fake data, no hardcoded products, prices, or fees.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useCartStore, computeCartSummary } from '../../stores/useCartStore';
import type { CartItem } from '../../stores/useCartStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupees(paise: number): string {
  return `₹${Math.round(paise / 100)}`;
}

// ─── Clear-cart confirmation dialog ──────────────────────────────────────────

function ClearCartDialog({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={dialogStyles.overlay}>
        <View style={dialogStyles.card}>
          <Text style={dialogStyles.icon}>🗑️</Text>
          <Text style={dialogStyles.title}>Clear your cart?</Text>
          <Text style={dialogStyles.body}>
            All items in your cart will be removed. This cannot be undone.
          </Text>
          <TouchableOpacity style={dialogStyles.confirmBtn} onPress={onConfirm}>
            <Text style={dialogStyles.confirmBtnText}>Yes, clear cart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dialogStyles.cancelBtn} onPress={onCancel}>
            <Text style={dialogStyles.cancelBtnText}>Keep my cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Cart Line Item ───────────────────────────────────────────────────────────

function CartLineItem({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const lineTotal = item.unitPricePaise * item.quantity;

  return (
    <View style={itemStyles.row}>
      {/* Product image */}
      {item.productImageUrl ? (
        <Image
          source={{ uri: item.productImageUrl }}
          style={itemStyles.img}
          resizeMode="cover"
        />
      ) : (
        <View style={itemStyles.imgFallback}>
          <Text style={itemStyles.imgEmoji}>🛍️</Text>
        </View>
      )}

      {/* Product details */}
      <View style={itemStyles.info}>
        <Text style={itemStyles.name} numberOfLines={2}>
          {item.productName}
        </Text>
        {item.unit ? (
          <Text style={itemStyles.unit}>{item.unit}</Text>
        ) : null}
        <Text style={itemStyles.unitPrice}>{formatRupees(item.unitPricePaise)} each</Text>
      </View>

      {/* Right column: stepper + line total */}
      <View style={itemStyles.right}>
        <Text style={itemStyles.lineTotal}>{formatRupees(lineTotal)}</Text>

        <View style={itemStyles.stepper}>
          <TouchableOpacity
            style={itemStyles.stepperBtn}
            onPress={item.quantity === 1 ? onRemove : onDecrement}
            accessibilityLabel={
              item.quantity === 1 ? `Remove ${item.productName}` : `Decrease ${item.productName}`
            }
          >
            <Text style={itemStyles.stepperBtnText}>{item.quantity === 1 ? '🗑' : '−'}</Text>
          </TouchableOpacity>

          <Text style={itemStyles.stepperQty}>{item.quantity}</Text>

          <TouchableOpacity
            style={itemStyles.stepperBtn}
            onPress={onIncrement}
            accessibilityLabel={`Increase ${item.productName}`}
          >
            <Text style={itemStyles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Empty Cart ───────────────────────────────────────────────────────────────

function EmptyCart({ onGoHome }: { onGoHome: () => void }) {
  return (
    <View style={emptyStyles.wrap}>
      <Text style={emptyStyles.icon}>🛒</Text>
      <Text style={emptyStyles.title}>Your cart is empty</Text>
      <Text style={emptyStyles.body}>
        Browse nearby stores and add items to get started.
      </Text>
      <TouchableOpacity style={emptyStyles.btn} onPress={onGoHome}>
        <Text style={emptyStyles.btnText}>Browse Stores</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Cart Screen ─────────────────────────────────────────────────────────────

export function CartScreen() {
  const navigation = useNavigation<any>();
  const { session } = require('../../stores/useAuthStore').useAuthStore();
  const { storeName, items, incrementItem, decrementItem, removeItem, clearCart } =
    useCartStore();
  const summary = computeCartSummary(items);

  const [showClearDialog, setShowClearDialog] = useState(false);

  const handleGoHome = () => {
    navigation.navigate('Home');
  };

  const handleClearConfirm = () => {
    clearCart();
    setShowClearDialog(false);
  };

  const isEmpty = items.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* Clear-cart confirmation */}
      <ClearCartDialog
        visible={showClearDialog}
        onCancel={() => setShowClearDialog(false)}
        onConfirm={handleClearConfirm}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cart</Text>
        {!isEmpty && (
          <TouchableOpacity
            style={styles.clearBtn}
            onPress={() => setShowClearDialog(true)}
            accessibilityLabel="Clear cart"
          >
            <Text style={styles.clearBtnText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {isEmpty ? (
        <EmptyCart onGoHome={handleGoHome} />
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Store name header */}
            {storeName && (
              <View style={styles.storeHeader}>
                <Text style={styles.storeLabel}>From</Text>
                <Text style={styles.storeName}>{storeName}</Text>
              </View>
            )}

            {/* Line items */}
            <View style={styles.itemsCard}>
              {items.map((item, index) => (
                <React.Fragment key={item.productId}>
                  <CartLineItem
                    item={item}
                    onIncrement={() => incrementItem(item.productId)}
                    onDecrement={() => decrementItem(item.productId)}
                    onRemove={() => removeItem(item.productId)}
                  />
                  {index < items.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>

            {/* Subtotal */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  Items ({summary.totalItems})
                </Text>
                <Text style={styles.summaryValue}>
                  {formatRupees(summary.subtotalPaise)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Item Total</Text>
                <Text style={styles.totalValue}>
                  {formatRupees(summary.subtotalPaise)}
                </Text>
              </View>

              <Text style={styles.feesNote}>
                Delivery fee and taxes calculated at checkout.
              </Text>
            </View>
          </ScrollView>

          {/* Sticky CTA */}
          <View style={styles.ctaWrap}>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => {
                if (!session) {
                  navigation.navigate('Auth');
                  return;
                }
                navigation.navigate('Checkout');
              }}
              accessibilityLabel="Continue to Checkout"
            >
              <View style={styles.ctaInner}>
                <View style={styles.ctaBadge}>
                  <Text style={styles.ctaBadgeText}>{summary.totalItems}</Text>
                </View>
                <Text style={styles.ctaText}>Continue to Checkout</Text>
                <Text style={styles.ctaPrice}>{formatRupees(summary.subtotalPaise)}</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.ctaNote}>{session ? 'Final price and delivery fee are verified at order placement.' : 'Sign in to continue to checkout.'}</Text>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E7E5E4',
    backgroundColor: '#FFFBF5',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1C1917',
    letterSpacing: 0.5,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78716C',
  },

  scrollContent: {
    paddingBottom: 24,
  },

  // Store header
  storeHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  storeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A8A29E',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
  },

  // Items card
  itemsCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EFEE',
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },

  divider: {
    height: 1,
    backgroundColor: '#F5F5F4',
    marginHorizontal: 16,
  },

  // Summary card
  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F0EFEE',
    padding: 18,
    gap: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#78716C',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1C1917',
    fontWeight: '600',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C1917',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1C1917',
  },
  feesNote: {
    fontSize: 11,
    color: '#A8A29E',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Sticky CTA
  ctaWrap: {
    backgroundColor: '#FFFBF5',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E7E5E4',
    gap: 8,
  },
  ctaBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 18,
    overflow: 'hidden',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  ctaBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 26,
    alignItems: 'center',
  },
  ctaBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ctaText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ctaPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ctaNote: {
    fontSize: 11,
    color: '#A8A29E',
    textAlign: 'center',
  },
});

const itemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'center',
  },
  img: {
    width: 60,
    height: 60,
    borderRadius: 10,
    flexShrink: 0,
  },
  imgFallback: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F5F5F4',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  imgEmoji: { fontSize: 24 },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1917',
    lineHeight: 20,
  },
  unit: {
    fontSize: 11,
    color: '#A8A29E',
    fontWeight: '500',
  },
  unitPrice: {
    fontSize: 12,
    color: '#78716C',
    fontWeight: '500',
  },
  right: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1917',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#D97706',
    lineHeight: 19,
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1C1917',
    minWidth: 22,
    textAlign: 'center',
  },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 80,
    gap: 12,
  },
  icon: { fontSize: 64, marginBottom: 4 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    backgroundColor: '#F59E0B',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

const dialogStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,25,23,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    gap: 12,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  icon: { fontSize: 40 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1917',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#78716C',
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E7E5E4',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#78716C',
  },
});
