import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCartStore, computeCartSummary } from '../../stores/useCartStore';
import { ensureDefaultAddressFromBrowsingLocation } from '../../services/address';
import { useLocationStore } from '../../stores/useLocationStore';
import { createCustomerOrder, type CheckoutPaymentMethod } from '../../services/order';
import type { CustomerAddress } from '../../types/address';
import { FreeDeliveryProgress, FREE_DELIVERY_THRESHOLD_PAISE } from '../../components/FreeDeliveryProgress';

const formatRupees = (paise: number) => `₹${Math.round(paise / 100)}`;

export function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { storeId, storeName, items, clearCart } = useCartStore();
  const { browsingLocation } = useLocationStore();
  const summary = computeCartSummary(items);
  const [address, setAddress] = useState<CustomerAddress | null>(null);
  const paymentMethod: CheckoutPaymentMethod = 'COD';
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const placementInFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const materialized = browsingLocation
        ? await ensureDefaultAddressFromBrowsingLocation(browsingLocation)
        : null;
      setAddress(materialized);
      if (!materialized) {
        setError('Your saved delivery area is missing a complete postal address. Please add the pincode once in Address settings.');
      }
    } catch (e: any) { setError(e?.message ?? 'Could not load your delivery address.'); }
    finally { setLoading(false); }
  }, [browsingLocation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const placeOrder = async () => {
    if (placementInFlight.current) return;
    if (!storeId || !items.length) { setError('Your cart is empty.'); return; }
    if (!address) { setError('Please add a delivery address first.'); return; }
    placementInFlight.current = true;
    setPlacing(true); setError(null);
    try {
      const result = await createCustomerOrder({ storeId, addressId: address.id, items, paymentMethod, specialInstructions: instructions });
      clearCart();
      navigation.navigate('Orders', { screen: 'OrderDetail', params: { orderId: result.orderId } });
    } catch (e: any) { setError(e?.message ?? 'Could not place your order.'); }
    finally { placementInFlight.current = false; setPlacing(false); }
  };

  if (loading) return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.center}><ActivityIndicator size="large" color="#F59E0B" /></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top']}>
    <StatusBar style="dark" />
    <View style={styles.header}><TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.title}>Checkout</Text><View style={{ width: 32 }} /></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      <Text style={styles.eyebrow}>DELIVERING FROM</Text><Text style={styles.store}>{storeName ?? 'Store'}</Text>
      <Text style={styles.section}>Delivery address</Text>
      {address ? <View style={styles.card}><View style={styles.addressTop}><Text style={styles.addressLabel}>{address.label}</Text><Text style={styles.default}>DEFAULT</Text></View><Text style={styles.addressMain}>{address.address_line_1}</Text>{address.address_line_2 ? <Text style={styles.addressSub}>{address.address_line_2}</Text> : null}<Text style={styles.addressSub}>{address.city}, {address.state} — {address.pincode}</Text><TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.change}>Change address</Text></TouchableOpacity></View> : <View style={styles.card}><Text style={styles.addressMain}>No delivery address saved</Text><TouchableOpacity onPress={() => navigation.navigate('Profile')}><Text style={styles.change}>Add delivery address</Text></TouchableOpacity></View>}
      <FreeDeliveryProgress subtotalPaise={summary.subtotalPaise} />
      <Text style={styles.section}>Review your items</Text>
      <View style={styles.card}>
        {items.map((item, index) => (
          <View key={item.productId}>
            {index > 0 ? <View style={styles.line} /> : null}
            <View style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                {item.unit ? <Text style={styles.itemUnit}>{item.unit}</Text> : null}
                <Text style={styles.itemQuantity}>Qty {item.quantity} × {formatRupees(item.unitPricePaise)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatRupees(item.unitPricePaise * item.quantity)}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.section}>Payment</Text>
      <View style={styles.card}><View style={styles.paymentRow}><View style={[styles.radio, styles.radioSelected]}><View style={styles.radioDot} /></View><View><Text style={styles.paymentTitle}>Cash on Delivery</Text><Text style={styles.paymentSub}>Pay when your order arrives</Text></View></View></View>
      <Text style={styles.section}>Order notes <Text style={styles.optional}>OPTIONAL</Text></Text>
      <TextInput value={instructions} onChangeText={setInstructions} placeholder="Anything the store should know?" placeholderTextColor="#A8A29E" style={styles.notes} multiline maxLength={250} />
      <View style={styles.card}>
        <View style={styles.row}><Text style={styles.muted}>Items ({summary.totalItems})</Text><Text style={styles.value}>{formatRupees(summary.subtotalPaise)}</Text></View>
        <View style={styles.row}><Text style={styles.muted}>Delivery</Text><Text style={styles.value}>{summary.subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE ? 'Free' : '₹20 + ₹7 per km'}</Text></View>
        <View style={styles.line} /><View style={styles.row}><Text style={styles.total}>Final total</Text><Text style={styles.totalValue}>{summary.subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE ? formatRupees(summary.subtotalPaise) : 'Items + delivery'}</Text></View>
      </View>
    </ScrollView>
    <View style={styles.footer}><TouchableOpacity disabled={placing || !address || !items.length} onPress={placeOrder} style={[styles.place, (placing || !address || !items.length) && styles.disabled]}>{placing ? <ActivityIndicator color="#fff" /> : <Text style={styles.placeText}>Place order</Text>}</TouchableOpacity><Text style={styles.footerNote}>Final price and delivery fee are verified when you place the order.</Text></View>
  </SafeAreaView>;
}

const styles=StyleSheet.create({safe:{flex:1,backgroundColor:'#FFFBF5'},center:{flex:1,alignItems:'center',justifyContent:'center'},header:{height:60,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:'#E7E5E4'},back:{fontSize:36,color:'#1C1917',lineHeight:40},title:{fontSize:20,fontWeight:'800',color:'#1C1917'},content:{padding:20,paddingBottom:180},eyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1.2,color:'#A8A29E',marginTop:4},store:{fontSize:20,fontWeight:'800',color:'#1C1917',marginTop:5,marginBottom:22},section:{fontSize:15,fontWeight:'800',color:'#1C1917',marginBottom:10,marginTop:8},optional:{fontSize:10,fontWeight:'700',color:'#A8A29E'},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#EEECE9',borderRadius:18,padding:17,marginBottom:18},addressTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:10},addressLabel:{fontSize:12,fontWeight:'800',color:'#92400E',backgroundColor:'#FEF3C7',paddingHorizontal:8,paddingVertical:4,borderRadius:8},default:{fontSize:9,fontWeight:'800',letterSpacing:1,color:'#A8A29E'},addressMain:{fontSize:15,fontWeight:'700',color:'#1C1917',lineHeight:21},addressSub:{fontSize:13,color:'#78716C',marginTop:3,lineHeight:19},change:{fontSize:13,fontWeight:'800',color:'#D97706',marginTop:12},paymentRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,gap:12},radio:{width:20,height:20,borderRadius:10,borderWidth:2,borderColor:'#D6D3D1',alignItems:'center',justifyContent:'center'},radioSelected:{borderColor:'#F59E0B'},radioDot:{width:10,height:10,borderRadius:5,backgroundColor:'#F59E0B'},paymentTitle:{fontSize:14,fontWeight:'700',color:'#1C1917'},paymentSub:{fontSize:12,color:'#78716C',marginTop:2},notes:{minHeight:82,maxHeight:120,backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E5E4',borderRadius:16,padding:14,fontSize:14,color:'#1C1917',textAlignVertical:'top',marginBottom:18},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:11},muted:{fontSize:13,color:'#78716C'},value:{fontSize:13,fontWeight:'600',color:'#1C1917',maxWidth:'55%',textAlign:'right'},line:{height:1,backgroundColor:'#F5F5F4',marginVertical:4},total:{fontSize:16,fontWeight:'900',color:'#1C1917'},totalValue:{fontSize:19,fontWeight:'900',color:'#1C1917'},error:{backgroundColor:'#FEE2E2',borderWidth:1,borderColor:'#FCA5A5',borderRadius:14,padding:13,marginBottom:14},errorText:{fontSize:13,color:'#991B1B',lineHeight:19},footer:{position:'absolute',left:0,right:0,bottom:0,backgroundColor:'#FFFBF5',borderTopWidth:1,borderTopColor:'#E7E5E4',paddingHorizontal:20,paddingTop:12,paddingBottom:18},place:{backgroundColor:'#F59E0B',borderRadius:17,minHeight:56,alignItems:'center',justifyContent:'center'},disabled:{backgroundColor:'#D6D3D1'},placeText:{color:'#fff',fontSize:16,fontWeight:'800'},itemRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10,gap:12},itemInfo:{flex:1,gap:3},itemName:{fontSize:14,fontWeight:'700',color:'#1C1917'},itemUnit:{fontSize:12,color:'#78716C'},itemQuantity:{fontSize:12,color:'#78716C'},itemTotal:{fontSize:14,fontWeight:'800',color:'#1C1917'},footerNote:{fontSize:10,color:'#A8A29E',textAlign:'center',marginTop:7}});
