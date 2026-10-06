import './global.css';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './services/supabase';
import { signInMerchant } from './services/auth';

type OrderStatus = 'PENDING'|'MERCHANT_ACCEPTED'|'PREPARING'|'READY_FOR_PICKUP'|'RIDER_ASSIGNED'|'RIDER_AT_STORE'|'PICKED_UP'|'OUT_FOR_DELIVERY'|'DELIVERED'|'REJECTED'|'CANCELLED'|'PAYMENT_FAILED'|'DELIVERY_FAILED'|'REFUND_PENDING'|'REFUNDED';
type Order = { id:string; order_number:string; status:OrderStatus; total_amount:number; items_total:number; delivery_fee:number; payment_method:string; special_instructions:string|null; created_at:string; customer_id:string; };
type Product = { id:string; name:string; price:number; unit:string; is_available:boolean; is_active:boolean; };
type Store = { id:string; name:string; category:string; is_open:boolean; is_verified:boolean; address_text:string; };

const rupees=(p:number)=>'₹'+Math.round(p/100);
const statusLabel=(s:OrderStatus)=>({PENDING:'New order',MERCHANT_ACCEPTED:'Accepted',PREPARING:'Preparing',READY_FOR_PICKUP:'Ready for pickup',RIDER_ASSIGNED:'Rider assigned',RIDER_AT_STORE:'Rider at store',PICKED_UP:'Picked up',OUT_FOR_DELIVERY:'Out for delivery',DELIVERED:'Delivered',REJECTED:'Rejected',CANCELLED:'Cancelled',PAYMENT_FAILED:'Payment failed',DELIVERY_FAILED:'Delivery failed',REFUND_PENDING:'Refund pending',REFUNDED:'Refunded'} as Record<OrderStatus,string>)[s];
const nextAction=(s:OrderStatus): {to:OrderStatus;label:string}|null => s==='PENDING'?{to:'MERCHANT_ACCEPTED',label:'Accept order'}:s==='MERCHANT_ACCEPTED'?{to:'PREPARING',label:'Start preparing'}:s==='PREPARING'?{to:'READY_FOR_PICKUP',label:'Mark ready'}:null;

export default function App(){
  const [session,setSession]=useState<any>(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [phone,setPhone]=useState('');
  const [pin,setPin]=useState('');
  const [authError,setAuthError]=useState<string|null>(null);
  const [signing,setSigning]=useState(false);
  const [store,setStore]=useState<Store|null>(null);
  const [orders,setOrders]=useState<Order[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [tab,setTab]=useState<'orders'|'products'|'store'>('orders');
  const [selectedOrder,setSelectedOrder]=useState<Order|null>(null);
  const [refreshing,setRefreshing]=useState(false);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<string|null>(null);

  useEffect(()=>{ supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false);}); const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>data.subscription.unsubscribe();},[]);

  const load=useCallback(async(refresh=false)=>{
    if(!session) return;
    if(refresh) setRefreshing(true);
    setNotice(null);
    try{
      const {data:st,error:se}=await supabase.from('stores').select('id,name,category,is_open,is_verified,address_text').eq('merchant_id',session.user.id).maybeSingle();
      if(se) throw se;
      setStore(st);
      if(!st){setOrders([]);setProducts([]);return;}
      const [{data:os,error:oe},{data:ps,error:pe}]=await Promise.all([
        supabase.from('orders').select('id,order_number,status,total_amount,items_total,delivery_fee,payment_method,special_instructions,created_at,customer_id').eq('store_id',st.id).order('created_at',{ascending:false}).limit(50),
        supabase.from('products').select('id,name,price,unit,is_available,is_active').eq('store_id',st.id).eq('is_active',true).order('sort_order',{ascending:true}).limit(100),
      ]);
      if(oe) throw oe;if(pe) throw pe;
      setOrders((os??[]) as Order[]);setProducts((ps??[]) as Product[]);
    }catch(e:any){setNotice(e?.message??'Could not load merchant data.');}
    finally{setRefreshing(false);}
  },[session]);

  useEffect(()=>{load();},[load]);

  const transition=async(order:Order,to:OrderStatus)=>{
    setBusy(true);setNotice(null);
    try{
      const {error}=await supabase.rpc('transition_order_status',{p_order_id:order.id,p_to_status:to,p_note:null});
      if(error) throw error;
      setSelectedOrder(null);await load(true);
    }catch(e:any){setNotice(e?.message??'Could not update order.');}
    finally{setBusy(false);}
  };

  const reject=async(order:Order)=>{
    setBusy(true);setNotice(null);
    try{
      const {error}=await supabase.rpc('transition_order_status',{p_order_id:order.id,p_to_status:'REJECTED',p_note:'Merchant declined the order.'});
      if(error) throw error;
      setSelectedOrder(null);await load(true);
    }catch(e:any){setNotice(e?.message??'Could not reject order.');}
    finally{setBusy(false);}
  };

  const toggleProduct=async(product:Product,value:boolean)=>{
    setBusy(true);setNotice(null);
    try{
      const {error}=await supabase.from('products').update({is_available:value}).eq('id',product.id);
      if(error) throw error;
      setProducts(prev=>prev.map(p=>p.id===product.id?{...p,is_available:value}:p));
    }catch(e:any){setNotice(e?.message??'Could not update availability.');}
    finally{setBusy(false);}
  };

  const toggleStore=async(value:boolean)=>{
    if(!store)return;setBusy(true);setNotice(null);
    try{
      const {error}=await supabase.from('stores').update({is_open:value}).eq('id',store.id);
      if(error) throw error;setStore({...store,is_open:value});
    }catch(e:any){setNotice(e?.message??'Could not update store status.');}
    finally{setBusy(false);}
  };

  if(authLoading)return <View style={styles.center}><ActivityIndicator size="large" color="#F59E0B"/></View>;
  if(!session)return <View style={styles.auth}><StatusBar style="dark"/><Text style={styles.logo}>BEVER</Text><Text style={styles.role}>Merchant console</Text><Text style={styles.heading}>Manage your store</Text><Text style={styles.sub}>Sign in with the merchant account created for your store.</Text><Text style={styles.label}>Mobile number</Text><TextInput value={phone} onChangeText={v=>setPhone(v.replace(/\D/g,'').slice(0,10))} keyboardType="number-pad" placeholder="98765 43210" style={styles.input}/><Text style={styles.label}>6-digit PIN</Text><TextInput value={pin} onChangeText={v=>setPin(v.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" secureTextEntry style={styles.input}/>{authError?<Text style={styles.error}>{authError}</Text>:null}<TouchableOpacity style={styles.primary} disabled={signing} onPress={async()=>{setSigning(true);setAuthError(null);const r=await signInMerchant(phone,pin);if(!r.ok)setAuthError(r.error!);setSigning(false);}}>{signing?<ActivityIndicator color="#fff"/>:<Text style={styles.primaryText}>Sign in</Text>}</TouchableOpacity></View>;

  if(!store)return <View style={styles.center}><Text style={styles.heading}>No merchant store linked</Text><Text style={styles.sub}>Your account is signed in, but BEVER has not linked a store to it yet.</Text><TouchableOpacity style={styles.secondary} onPress={()=>supabase.auth.signOut()}><Text style={styles.secondaryText}>Sign out</Text></TouchableOpacity></View>;

  const pending=orders.filter(o=>['PENDING','MERCHANT_ACCEPTED','PREPARING'].includes(o.status)).length;
  const active=selectedOrder;

  return <View style={styles.safe}><StatusBar style="dark"/>
    <View style={styles.header}><View style={{flex:1}}><Text style={styles.brand}>BEVER Merchant</Text><Text style={styles.storeName}>{store.name} • {store.is_open?'OPEN':'PAUSED'}</Text></View><Switch value={store.is_open} onValueChange={toggleStore} disabled={busy}/></View>
    {notice?<View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View>:null}
    {active?<ScrollView contentContainerStyle={styles.content}><TouchableOpacity onPress={()=>setSelectedOrder(null)}><Text style={styles.back}>‹ Back to orders</Text></TouchableOpacity><Text style={styles.pageTitle}>Order #{active.order_number}</Text><View style={styles.card}><Text style={styles.status}>{statusLabel(active.status)}</Text><Text style={styles.amount}>{rupees(active.total_amount)}</Text><Text style={styles.meta}>{new Date(active.created_at).toLocaleString('en-IN')} • {active.payment_method==='COD'?'Cash on Delivery':'UPI'}</Text>{active.special_instructions?<Text style={styles.note}>Note: {active.special_instructions}</Text>:null}</View>{nextAction(active.status)?<TouchableOpacity style={styles.primary} disabled={busy} onPress={()=>transition(active,nextAction(active.status)!.to)}><Text style={styles.primaryText}>{nextAction(active.status)!.label}</Text></TouchableOpacity>:null}{active.status==='PENDING'?<TouchableOpacity style={styles.reject} disabled={busy} onPress={()=>reject(active)}><Text style={styles.rejectText}>Reject order</Text></TouchableOpacity>:null}</ScrollView>:
    <><View style={styles.tabs}><TouchableOpacity onPress={()=>setTab('orders')}><Text style={[styles.tab,tab==='orders'&&styles.tabActive]}>Orders {pending>0?'• '+pending:''}</Text></TouchableOpacity><TouchableOpacity onPress={()=>setTab('products')}><Text style={[styles.tab,tab==='products'&&styles.tabActive]}>Products</Text></TouchableOpacity><TouchableOpacity onPress={()=>setTab('store')}><Text style={[styles.tab,tab==='store'&&styles.tabActive]}>Store</Text></TouchableOpacity></View>
    {tab==='orders'?<ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}/>}><Text style={styles.pageTitle}>Orders</Text>{orders.length===0?<Text style={styles.empty}>No orders yet. New customer orders will appear here.</Text>:orders.map(o=><TouchableOpacity key={o.id} style={styles.card} onPress={()=>setSelectedOrder(o)}><View style={styles.row}><View style={{flex:1}}><Text style={styles.cardTitle}>#{o.order_number}</Text><Text style={styles.meta}>{new Date(o.created_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} • {o.payment_method==='COD'?'COD':'UPI'}</Text></View><Text style={styles.amount}>{rupees(o.total_amount)}</Text></View><Text style={styles.status}>{statusLabel(o.status)}</Text></TouchableOpacity>)}</ScrollView>:null}
    {tab==='products'?<ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>load(true)}/>}><Text style={styles.pageTitle}>Availability</Text><Text style={styles.sub}>Keep stock visibility accurate without editing your catalogue.</Text>{products.map(p=><View key={p.id} style={styles.card}><View style={styles.row}><View style={{flex:1}}><Text style={styles.cardTitle}>{p.name}</Text><Text style={styles.meta}>{rupees(p.price)} • {p.unit}</Text></View><Switch value={p.is_available} onValueChange={v=>toggleProduct(p,v)} disabled={busy}/></View></View>)}</ScrollView>:null}
    {tab==='store'?<ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Store settings</Text><View style={styles.card}><Text style={styles.cardTitle}>{store.name}</Text><Text style={styles.meta}>{store.category} • {store.is_verified?'Verified':'Verification pending'}</Text><Text style={styles.address}>{store.address_text}</Text><Text style={styles.meta}>Store status</Text><Switch value={store.is_open} onValueChange={toggleStore} disabled={busy}/></View><TouchableOpacity style={styles.secondary} onPress={()=>supabase.auth.signOut()}><Text style={styles.secondaryText}>Sign out</Text></TouchableOpacity></ScrollView>:null}
    </>}
  </View>;
}

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:'#FFFBF5'},center:{flex:1,alignItems:'center',justifyContent:'center',padding:28,backgroundColor:'#FFFBF5'},auth:{flex:1,padding:24,paddingTop:70,backgroundColor:'#FFFBF5'},logo:{fontSize:32,fontWeight:'900',letterSpacing:3,color:'#F59E0B'},role:{fontSize:12,color:'#78716C',marginTop:2},heading:{fontSize:25,fontWeight:'900',color:'#1C1917',marginTop:28},sub:{fontSize:13,color:'#78716C',lineHeight:20,marginTop:6,marginBottom:20},label:{fontSize:12,fontWeight:'800',color:'#44403C',marginBottom:6,marginTop:8},input:{height:54,borderRadius:14,borderWidth:1,borderColor:'#E7E5E4',backgroundColor:'#fff',paddingHorizontal:15,fontSize:16,marginBottom:8},primary:{backgroundColor:'#F59E0B',borderRadius:14,minHeight:54,alignItems:'center',justifyContent:'center',marginTop:10},primaryText:{color:'#fff',fontSize:15,fontWeight:'800'},secondary:{borderWidth:1,borderColor:'#D6D3D1',borderRadius:14,minHeight:48,alignItems:'center',justifyContent:'center',paddingHorizontal:20},secondaryText:{color:'#44403C',fontWeight:'800'},error:{color:'#991B1B',backgroundColor:'#FEE2E2',padding:12,borderRadius:10,marginTop:8},header:{paddingHorizontal:18,paddingTop:48,paddingBottom:14,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#E7E5E4'},brand:{fontSize:17,fontWeight:'900',color:'#1C1917'},storeName:{fontSize:11,color:'#78716C',marginTop:2},notice:{margin:12,padding:12,borderRadius:12,backgroundColor:'#FEF3C7'},noticeText:{fontSize:12,color:'#92400E'},tabs:{height:52,flexDirection:'row',alignItems:'center',justifyContent:'space-around',backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#E7E5E4'},tab:{fontSize:13,color:'#78716C',fontWeight:'700'},tabActive:{color:'#D97706'},content:{padding:18,paddingBottom:40},pageTitle:{fontSize:23,fontWeight:'900',color:'#1C1917',marginBottom:12},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#EEECE9',borderRadius:16,padding:16,marginBottom:12},cardTitle:{fontSize:14,fontWeight:'800',color:'#1C1917'},meta:{fontSize:11,color:'#78716C',marginTop:4},status:{fontSize:12,fontWeight:'800',color:'#D97706',marginTop:10},amount:{fontSize:16,fontWeight:'900',color:'#1C1917'},row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},note:{fontSize:12,color:'#57534E',backgroundColor:'#F7F7F4',padding:12,borderRadius:10,marginTop:12},address:{fontSize:13,color:'#57534E',lineHeight:19,marginVertical:12},back:{fontSize:13,fontWeight:'800',color:'#D97706',marginBottom:14},reject:{borderWidth:1,borderColor:'#FCA5A5',borderRadius:14,minHeight:50,alignItems:'center',justifyContent:'center',marginTop:10},rejectText:{color:'#B91C1C',fontWeight:'800'},empty:{fontSize:13,color:'#78716C',lineHeight:20,marginTop:20}
});
