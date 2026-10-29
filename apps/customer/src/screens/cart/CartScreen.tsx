/**
 * BEVER Customer App — Cart Screen
 *
 * Displays the customer's active shopping cart powered by useCartStore.
 *
 * Features:
 *   - Shows store header, line items with quantity steppers, subtotal.
 *   - Empty-cart state with navigation back to Home.
 *   - Clear-cart action with confirmation dialog.
 *   - Real "Continue to Checkout" CTA.
 *   - Guests are asked to authenticate only when they proceed to checkout;
 *     their checkout intent is preserved and they land directly on Checkout
 *     after authentication/profile completion.
 *   - Prices displayed in rupees (paise ÷ 100, no decimals for whole values).
 *   - No fake data, no hardcoded products, prices, or fees.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, Image, Modal } from 'react-native';
import { Text } from '../../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCartStore, computeCartSummary } from '../../stores/useCartStore';
import type { CartItem } from '../../stores/useCartStore';
import { FreeDeliveryProgress } from '../../components/FreeDeliveryProgress';

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
  const { session } = useAuthStore();
  const {
    storeName,
    items,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
    requestCheckout,
  } = useCartStore();
  const summary = computeCartSummary(items);

  const [showClearDialog, setShowClearDialog] = useState(false);

  const handleGoHome = () => {
    navigation.navigate('Home');
  };

  const handleClearConfirm = () => {
    clearCart();
    setShowClearDialog(false);
  };

  const handleCheckout = () => {
    if (!session) {
      requestCheckout();
      navigation.navigate('Auth');
      return;
    }
    navigation.navigate('Checkout');
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

            <FreeDeliveryProgress subtotalPaise={summary.subtotalPaise} style={{ marginHorizontal: 20 }} />

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
                Delivery is free from ₹199. Below that, the fee is ₹20 plus ₹7 per started km, shown on your order.
              </Text>
            </View>
          </ScrollView>

          {/* Sticky CTA */}
          <View style={styles.ctaWrap}>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={handleCheckout}
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
            <Text style={styles.ctaNote}>
              {session
                ? 'Final price and delivery fee are verified at order placement.'
                : 'Secure sign-in is required before placing your order.'}
            </Text>
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
    backgroundColor: '#F7F7F3',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6E1',
    backgroundColor: '#F7F7F3',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#171717',
    letterSpacing: 0.5,
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E6E6E1',
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B6B67',
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
    color: '#9A9A94',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  storeName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171717',
  },

  // Items card
  itemsCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E4DE',
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
    backgroundColor: '#EFEFEB',
    marginHorizontal: 16,
  },

  // Summary card
  summaryCard: {
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E4E4DE',
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
    color: '#6B6B67',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#171717',
    fontWeight: '600',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#171717',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#171717',
  },
  feesNote: {
    fontSize: 11,
    color: '#9A9A94',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Sticky CTA
  ctaWrap: {
    backgroundColor: '#F7F7F3',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E6E6E1',
    gap: 8,
  },
  ctaBtn: {
    backgroundColor: '#059669',
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
    color: '#9A9A94',
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
    backgroundColor: '#EFEFEB',
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
    color: '#171717',
    lineHeight: 20,
  },
  unit: {
    fontSize: 11,
    color: '#9A9A94',
    fontWeight: '500',
  },
  unitPrice: {
    fontSize: 12,
    color: '#6B6B67',
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
    color: '#171717',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#059669',
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
    color: '#059669',
    lineHeight: 19,
  },
  stepperQty: {
    fontSize: 14,
    fontWeight: '800',
    color: '#171717',
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
    color: '#171717',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#6B6B67',
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    backgroundColor: '#059669',
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
    color: '#171717',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#6B6B67',
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
    borderColor: '#E6E6E1',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B6B67',
  },
});
