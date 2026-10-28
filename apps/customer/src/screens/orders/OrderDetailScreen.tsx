import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../services/supabase';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OrdersStackParamList } from '../../navigation/types';
import { TrackingPanel } from '../../components/TrackingPanel';
import { RateOrderCard } from '../../components/RateOrderCard';
import {
  fetchOrderDetail,
  formatOrderStatus,
  getOrderProgress,
  transitionCustomerOrder,
  type CustomerOrderDetail,
} from '../../services/order';

type Props = NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>;

const rupees = (paise: number) => `₹${Math.round(paise / 100)}`;

export function OrderDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Props['route']>();
  const { orderId } = route.params;
  const [order, setOrder] = useState<CustomerOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      setOrder(await fetchOrderDetail(orderId));
    } catch (e: any) {
      setError(e?.message ?? 'Could not load this order.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useFocusEffect(useCallback(() => {
    load();
    const channel = supabase
      .channel(`customer-order-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, () => load(true))
      .subscribe();
    const timer = setInterval(() => load(true), 30000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [load, orderId]));

  if (loading && !order) {
    return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.center}><ActivityIndicator size="large" color="#059669" /></View></SafeAreaView>;
  }

  if (error && !order) {
    return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.center}><Text style={styles.errorTitle}>We couldn't load this order</Text><Text style={styles.errorBody}>{error}</Text><TouchableOpacity style={styles.primary} onPress={() => load()}><Text style={styles.primaryText}>Try again</Text></TouchableOpacity></View></SafeAreaView>;
  }

  if (!order) return null;

  const progress = getOrderProgress(order.status);
  const canCancel = order.status === 'PENDING';
  const cancelOrder = async () => {
    try {
      await transitionCustomerOrder(order.id, 'CANCELLED', 'Customer cancelled before store confirmation.');
      await load(true);
    } catch (e: any) {
      setError(e?.message ?? 'Could not cancel this order.');
    }
  };
  const terminal = ['DELIVERED', 'REJECTED', 'CANCELLED', 'DELIVERY_FAILED', 'REFUND_PENDING', 'REFUNDED'].includes(order.status);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back"><Text style={styles.back}>‹</Text></TouchableOpacity>
        <View style={styles.headerCopy}><Text style={styles.title}>Order {order.orderNumber}</Text><Text style={styles.store}>{order.storeName}</Text></View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
      >
        <TrackingPanel orderId={order.id} status={order.status} />
        <View style={[styles.statusCard, terminal && styles.statusCardTerminal, order.status === 'DELIVERED' && styles.statusCardDone]}>
          <Text style={styles.statusEyebrow}>{terminal ? 'ORDER STATUS' : 'LIVE ORDER STATUS'}</Text>
          <Text style={styles.statusTitle}>{formatOrderStatus(order.status)}</Text>
          <Text style={styles.statusSub}>{order.status === 'DELIVERED' ? 'Delivered successfully.' : order.status === 'REJECTED' || order.status === 'CANCELLED' ? 'This order will not be delivered.' : order.status === 'DELIVERY_FAILED' ? (order.deliveryFailureReason ?? 'Delivery could not be completed. BEVER operations has been notified.') : 'We keep this screen updated while your order moves through the store and delivery.'}</Text>
        </View>

        {order.status === 'DELIVERED' ? <RateOrderCard orderId={order.id} storeName={order.storeName} /> : null}

        <Text style={styles.section}>Order progress</Text>
        <View style={styles.timeline}>
          {progress.map((step, index) => {
            const done = step.state === 'done';
            const active = step.state === 'active';
            return (
              <View key={step.key} style={styles.step}>
                <View style={styles.stepRail}>
                  <View style={[styles.dot, done && styles.dotDone, active && styles.dotActive]}>
                    {done ? <Text style={styles.tick}>✓</Text> : null}
                  </View>
                  {index < progress.length - 1 ? <View style={[styles.rail, done && styles.railDone]} /> : null}
                </View>
                <View style={styles.stepCopy}>
                  <Text style={[styles.stepTitle, (done || active) && styles.stepTitleStrong]}>{step.label}</Text>
                  <Text style={styles.stepSub}>{step.detail}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Text style={styles.section}>Items</Text>
        <View style={styles.card}>
          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemThumb}><Text style={styles.itemInitial}>{item.productNameSnapshot.charAt(0).toUpperCase()}</Text></View>
              <View style={styles.itemCopy}><Text style={styles.itemName}>{item.productNameSnapshot}</Text><Text style={styles.itemUnit}>{item.quantity} × {rupees(item.unitPrice)}</Text></View>
              <Text style={styles.itemTotal}>{rupees(item.totalPrice)}</Text>
            </View>
          ))}
        </View>

        {!terminal && order.deliveryOtp ? <View style={styles.otpCard}><Text style={styles.otpEyebrow}>YOUR ORDER CODE</Text><Text style={styles.otpTitle}>{order.deliveryOtp}</Text><Text style={styles.otpBody}>Tell this code to the delivery person only when your order is at your door. Never share it by phone or message.</Text></View> : null}

        <Text style={styles.section}>Delivery & payment</Text>
        <View style={styles.card}>
          <Text style={styles.addressLabel}>{order.deliveryAddress?.label ?? 'Delivery address'}</Text>
          {order.deliveryAddress ? <Text style={styles.address}>{order.deliveryAddress.address_line_1}{order.deliveryAddress.address_line_2 ? `, ${order.deliveryAddress.address_line_2}` : ''}{'\n'}{order.deliveryAddress.city}, {order.deliveryAddress.state} — {order.deliveryAddress.pincode}</Text> : null}
          <View style={styles.divider} />
          <View style={styles.row}><Text style={styles.muted}>Items</Text><Text style={styles.value}>{rupees(order.itemsTotal)}</Text></View>
          <View style={styles.row}><Text style={styles.muted}>Delivery</Text><Text style={styles.value}>{order.deliveryFee === 0 ? 'FREE' : rupees(order.deliveryFee)}</Text></View>
          <View style={styles.row}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{rupees(order.totalAmount)}</Text></View>
          <Text style={styles.payment}>Payment: {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'UPI'}</Text>
        </View>

        {order.deliveryFailureReason ? <><Text style={styles.section}>Delivery issue</Text><View style={styles.card}><Text style={styles.note}>{order.deliveryFailureReason}</Text></View></> : null}

        {order.specialInstructions ? <><Text style={styles.section}>Order note</Text><View style={styles.card}><Text style={styles.note}>{order.specialInstructions}</Text></View></> : null}

        {canCancel ? <TouchableOpacity style={styles.cancelButton} onPress={cancelOrder}><Text style={styles.cancelText}>Cancel order</Text></TouchableOpacity> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F3FBF7'},center:{flex:1,alignItems:'center',justifyContent:'center',padding:24},
  header:{height:66,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:18,borderBottomWidth:1,borderBottomColor:'#E7E5E4',backgroundColor:'#F3FBF7'},
  back:{fontSize:38,color:'#1C1917',lineHeight:40},headerCopy:{flex:1,paddingHorizontal:12},title:{fontSize:18,fontWeight:'800',color:'#1C1917'},store:{fontSize:11,color:'#78716C',marginTop:2},
  content:{padding:20,paddingBottom:48},statusCard:{backgroundColor:'#FFF7E6',borderWidth:1,borderColor:'#FDE68A',borderRadius:20,padding:18,marginBottom:24},statusCardTerminal:{backgroundColor:'#F5F5F4',borderColor:'#E7E5E4'},statusCardDone:{backgroundColor:'#ECFDF5',borderColor:'#A7F3D0'},
  statusEyebrow:{fontSize:10,fontWeight:'800',letterSpacing:1.2,color:'#A16207'},statusTitle:{fontSize:24,fontWeight:'900',color:'#1C1917',marginTop:5},statusSub:{fontSize:12,color:'#78716C',lineHeight:18,marginTop:5},
  section:{fontSize:16,fontWeight:'900',color:'#1C1917',marginBottom:10,marginTop:2},timeline:{backgroundColor:'#fff',borderWidth:1,borderColor:'#EEECE9',borderRadius:18,padding:16,marginBottom:24},
  step:{flexDirection:'row',minHeight:62},stepRail:{width:30,alignItems:'center'},dot:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:'#D6D3D1',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},dotDone:{backgroundColor:'#059669',borderColor:'#059669'},dotActive:{borderColor:'#059669'},tick:{fontSize:12,fontWeight:'900',color:'#fff'},rail:{width:2,flex:1,backgroundColor:'#E7E5E4',marginVertical:3},railDone:{backgroundColor:'#059669'},stepCopy:{flex:1,paddingLeft:10,paddingBottom:12},stepTitle:{fontSize:13,fontWeight:'600',color:'#78716C'},stepTitleStrong:{color:'#1C1917',fontWeight:'800'},stepSub:{fontSize:10,color:'#A8A29E',marginTop:3,lineHeight:15},
  card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#EEECE9',borderRadius:18,padding:16,marginBottom:24},itemRow:{flexDirection:'row',alignItems:'center',paddingVertical:8},itemThumb:{width:48,height:48,borderRadius:12,backgroundColor:'#F7F7F4',alignItems:'center',justifyContent:'center'},itemInitial:{fontSize:17,fontWeight:'800',color:'#059669'},itemCopy:{flex:1,paddingHorizontal:12},itemName:{fontSize:13,fontWeight:'700',color:'#1C1917'},itemUnit:{fontSize:11,color:'#78716C',marginTop:3},itemTotal:{fontSize:13,fontWeight:'800',color:'#1C1917'},
  addressLabel:{fontSize:12,fontWeight:'800',color:'#065F46'},address:{fontSize:12,color:'#57534E',lineHeight:19,marginTop:6},divider:{height:1,backgroundColor:'#F0EFED',marginVertical:14},row:{flexDirection:'row',justifyContent:'space-between',marginBottom:10},muted:{fontSize:12,color:'#78716C'},value:{fontSize:12,fontWeight:'700',color:'#1C1917'},totalLabel:{fontSize:15,fontWeight:'900',color:'#1C1917'},totalValue:{fontSize:15,fontWeight:'900',color:'#1C1917'},payment:{fontSize:11,color:'#78716C',marginTop:3},note:{fontSize:13,color:'#57534E',lineHeight:20},
  cancelButton:{minHeight:52,borderRadius:14,borderWidth:1,borderColor:'#FCA5A5',backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',marginTop:4},cancelText:{fontSize:14,fontWeight:'800',color:'#B91C1C'},
  otpCard:{backgroundColor:'#ECFDF5',borderWidth:1,borderColor:'#A7F3D0',borderRadius:18,padding:18,marginBottom:24,alignItems:'center'},otpEyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:'#047857'},otpTitle:{fontSize:30,fontWeight:'900',letterSpacing:6,color:'#065F46',marginTop:5},otpBody:{fontSize:11,color:'#047857',textAlign:'center',lineHeight:17,marginTop:5},errorTitle:{fontSize:18,fontWeight:'800',color:'#1C1917',textAlign:'center'},errorBody:{fontSize:13,color:'#78716C',textAlign:'center',lineHeight:20,marginTop:8,marginBottom:20},primary:{backgroundColor:'#059669',paddingHorizontal:26,paddingVertical:14,borderRadius:12},primaryText:{color:'#fff',fontSize:14,fontWeight:'800'}
});
