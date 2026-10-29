import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../services/supabase';
import { useCartStore } from '../../stores/useCartStore';
import type { Product } from '../../types/store';
import { fetchMyOrders, formatOrderStatus, type CustomerOrderSummary } from '../../services/order';

const CLOSED = ['DELIVERED', 'REJECTED', 'CANCELLED', 'PAYMENT_FAILED', 'DELIVERY_FAILED', 'REFUND_PENDING', 'REFUNDED'];

const rupees = (paise: number) => `₹${Math.round(paise / 100)}`;

const statusTone = (status: string) =>
  status === 'DELIVERED' ? { color: '#047857' }
  : ['REJECTED', 'CANCELLED', 'DELIVERY_FAILED'].includes(status) ? { color: '#B91C1C' }
  : { color: '#B45309' };

export function OrdersScreen() {
  const { session } = useAuthStore();
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<CustomerOrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!session) { setLoading(false); return; }
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try { setOrders(await fetchMyOrders()); }
    catch (e: any) { setError(e?.message ?? 'Could not load your orders.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [session]);

  useFocusEffect(useCallback(() => {
    load();
    if (!session) return undefined;
    // Realtime is best-effort; the database stays the source of truth, so also refresh on a timer.
    const channel = supabase
      .channel(`customer-orders-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${session.user.id}` }, () => load(true))
      .subscribe();
    const timer = setInterval(() => load(true), 30000);
    return () => { clearInterval(timer); void supabase.removeChannel(channel); };
  }, [load, session]));


  const reorder = async (order: CustomerOrderSummary) => {
    try {
      const { data: lines, error: lineErr } = await supabase.from('order_items').select('product_id,quantity').eq('order_id', order.id);
      if (lineErr) throw lineErr;
      const wanted = (lines ?? []).filter((l: any) => typeof l.product_id === 'string') as Array<{ product_id: string; quantity: number }>;
      if (wanted.length === 0) { Alert.alert('Not available', 'These items are no longer on sale.'); return; }
      const { data: prods, error: prodErr } = await supabase.from('products').select('*').in('id', wanted.map((w) => w.product_id)).eq('is_available', true).eq('is_active', true);
      if (prodErr) throw prodErr;
      const list = (prods ?? []) as Product[];
      if (list.length === 0) { Alert.alert('Not available', 'These items are out of stock right now.'); return; }
      const first = list[0];
      if (!first) return;
      const store = { id: first.store_id, name: order.storeName };
      const cart = useCartStore.getState();
      cart.clearCart();
      let added = 0;
      for (const prod of list) {
        const qty = wanted.find((w) => w.product_id === prod.id)?.quantity ?? 1;
        useCartStore.getState().addItem(prod, store);
        for (let i = 1; i < qty; i += 1) useCartStore.getState().incrementItem(prod.id);
        added += 1;
      }
      if (added < wanted.length) Alert.alert('Some items skipped', 'A few items are not available right now.');
      navigation.navigate('Cart');
    } catch (e: any) {
      Alert.alert('Could not reorder', e?.message ?? 'Please try again.');
    }
  };

  const active = orders.filter((o) => !CLOSED.includes(o.status));
  const past = orders.filter((o) => CLOSED.includes(o.status));

  if (!session) {
    return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.center}><Text style={styles.icon}>📋</Text><Text style={styles.heading}>Sign in to view orders</Text><Text style={styles.body}>Your order history is tied to your account.</Text><TouchableOpacity style={styles.primary} onPress={() => navigation.getParent()?.getParent()?.navigate('Auth')}><Text style={styles.primaryText}>Sign in</Text></TouchableOpacity></View></SafeAreaView>;
  }

  if (loading) {
    return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.center}><ActivityIndicator size="large" color="#059669" /><Text style={styles.loadingText}>Loading orders…</Text></View></SafeAreaView>;
  }

  const renderList = (list: CustomerOrderSummary[]) => list.map((order) => (
            <TouchableOpacity key={order.id} activeOpacity={0.86} style={styles.card} onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}>
              <View style={styles.cardTop}><View style={{flex:1}}><Text style={styles.store}>{order.storeName}</Text><Text style={styles.meta}>#{order.orderNumber} • {new Date(order.createdAt).toLocaleDateString('en-IN')}</Text></View><Text style={styles.amount}>{rupees(order.totalAmount)}</Text></View>
              <View style={styles.divider} />
              <View style={styles.cardBottom}><View><Text style={[styles.status, statusTone(order.status)]}>{formatOrderStatus(order.status)}</Text><Text style={styles.items}>{order.itemCount} item{order.itemCount === 1 ? '' : 's'} • {order.paymentMethod === 'COD' ? 'COD' : 'UPI'}</Text></View><View style={styles.arrow}><Text style={styles.arrowText}>›</Text></View></View>
              {order.status === 'DELIVERED' ? <TouchableOpacity style={styles.again} onPress={() => { void reorder(order); }} accessibilityLabel="Order again"><Text style={styles.againText}>Order again</Text></TouchableOpacity> : null}
            </TouchableOpacity>
  ));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}><View><Text style={styles.title}>Order Again</Text><Text style={styles.subtitle}>{orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'}` : 'Your order history'}</Text></View></View>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text><TouchableOpacity onPress={() => load()}><Text style={styles.retry}>Retry</Text></TouchableOpacity></View> : null}
      {orders.length === 0 && !error ? (
        <View style={styles.center}><Text style={styles.icon}>🛍️</Text><Text style={styles.heading}>No orders yet</Text><Text style={styles.body}>Your first BEVER order will appear here with live status and delivery details.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}>
          {active.length > 0 ? <Text style={styles.groupTitle}>In progress</Text> : null}
          {renderList(active)}
          {past.length > 0 ? <Text style={styles.groupTitle}>Past orders</Text> : null}
          {renderList(past)}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles=StyleSheet.create({
  again:{marginTop:12,minHeight:42,borderRadius:12,backgroundColor:'#059669',alignItems:'center',justifyContent:'center'},againText:{color:'#fff',fontSize:13,fontWeight:'800'},
  groupTitle:{fontSize:12,fontWeight:'900',letterSpacing:0.8,color:'#78716C',textTransform:'uppercase',marginBottom:10,marginTop:6},
  safe:{flex:1,backgroundColor:'#F3FBF7'},header:{paddingHorizontal:20,paddingTop:16,paddingBottom:14},title:{fontSize:25,fontWeight:'900',color:'#1C1917'},subtitle:{fontSize:12,color:'#78716C',marginTop:3},content:{padding:20,paddingTop:4,paddingBottom:40},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#EEECE9',borderRadius:18,padding:16,marginBottom:12},cardTop:{flexDirection:'row',alignItems:'flex-start'},store:{fontSize:15,fontWeight:'800',color:'#1C1917'},meta:{fontSize:11,color:'#A8A29E',marginTop:4},amount:{fontSize:15,fontWeight:'900',color:'#1C1917'},divider:{height:1,backgroundColor:'#F0EFED',marginVertical:13},cardBottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},status:{fontSize:12,fontWeight:'800',color:'#B45309'},items:{fontSize:11,color:'#78716C',marginTop:3},arrow:{width:32,height:32,borderRadius:16,backgroundColor:'#F7F7F4',alignItems:'center',justifyContent:'center'},arrowText:{fontSize:23,color:'#57534E',marginTop:-3},center:{flex:1,alignItems:'center',justifyContent:'center',padding:30},icon:{fontSize:48,marginBottom:15},heading:{fontSize:19,fontWeight:'800',color:'#1C1917',textAlign:'center'},body:{fontSize:13,color:'#78716C',lineHeight:20,textAlign:'center',maxWidth:280,marginTop:7,marginBottom:20},primary:{backgroundColor:'#059669',borderRadius:12,paddingHorizontal:28,paddingVertical:14},primaryText:{color:'#fff',fontSize:14,fontWeight:'800'},loadingText:{fontSize:12,color:'#78716C',marginTop:10},error:{marginHorizontal:20,marginBottom:10,backgroundColor:'#FEE2E2',borderWidth:1,borderColor:'#FCA5A5',borderRadius:12,padding:12,flexDirection:'row',justifyContent:'space-between'},errorText:{flex:1,fontSize:12,color:'#991B1B'},retry:{fontSize:12,fontWeight:'800',color:'#991B1B',marginLeft:10}
});
