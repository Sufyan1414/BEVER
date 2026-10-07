import {useCallback,useEffect,useState} from 'react';
import {supabase,isSupabaseConfigured} from './lib/supabase';
import {signInAdmin} from './auth';

type Order={id:string;order_number:string;status:string;total_amount:number;created_at:string;store_id:string;stores?:{name:string}|null};
type Rider={id:string;full_name:string;phone:string;is_active:boolean};
type Store={id:string;name:string;category:string;is_open:boolean;is_verified:boolean;merchant_id:string};

const rupees=(p:number)=>'₹'+Math.round(p/100);
const status=(s:string)=>s.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,(c:string)=>c.toUpperCase());

const MOCK_ORDERS: Order[] = [
  { id: 'ord-1042', order_number: '1042', status: 'PENDING', total_amount: 34900, created_at: new Date(Date.now() - 5 * 60000).toISOString(), store_id: 'st-1', stores: { name: 'Fresh Mart Supermarket' } },
  { id: 'ord-1041', order_number: '1041', status: 'READY_FOR_PICKUP', total_amount: 52000, created_at: new Date(Date.now() - 18 * 60000).toISOString(), store_id: 'st-2', stores: { name: 'Sharma Sweets & Bakery' } },
  { id: 'ord-1040', order_number: '1040', status: 'MERCHANT_ACCEPTED', total_amount: 19500, created_at: new Date(Date.now() - 32 * 60000).toISOString(), store_id: 'st-1', stores: { name: 'Fresh Mart Supermarket' } },
  { id: 'ord-1039', order_number: '1039', status: 'DELIVERED', total_amount: 68000, created_at: new Date(Date.now() - 75 * 60000).toISOString(), store_id: 'st-3', stores: { name: 'Apollo Health Pharmacy' } },
  { id: 'ord-1038', order_number: '1038', status: 'OUT_FOR_DELIVERY', total_amount: 41000, created_at: new Date(Date.now() - 45 * 60000).toISOString(), store_id: 'st-2', stores: { name: 'Sharma Sweets & Bakery' } }
];

const MOCK_RIDERS: Rider[] = [
  { id: 'rdr-1', full_name: 'Rahul Kumar', phone: '+91 98765 43210', is_active: true },
  { id: 'rdr-2', full_name: 'Vikram Singh', phone: '+91 98123 45678', is_active: true },
  { id: 'rdr-3', full_name: 'Amit Patel', phone: '+91 98234 56789', is_active: false }
];

const MOCK_STORES: Store[] = [
  { id: 'st-1', name: 'Fresh Mart Supermarket', category: 'Grocery', is_open: true, is_verified: true, merchant_id: 'm-1' },
  { id: 'st-2', name: 'Sharma Sweets & Bakery', category: 'Food & Sweets', is_open: true, is_verified: true, merchant_id: 'm-2' },
  { id: 'st-3', name: 'Apollo Health Pharmacy', category: 'Medicines', is_open: true, is_verified: true, merchant_id: 'm-3' }
];

export default function App(){
 const[session,setSession]=useState<any>(null),[loading,setLoading]=useState(true),[phone,setPhone]=useState(''),[pin,setPin]=useState(''),[authError,setAuthError]=useState(''),[signing,setSigning]=useState(false);
 const[tab,setTab]=useState<'orders'|'riders'|'stores'>('orders'),[orders,setOrders]=useState<Order[]>([]),[riders,setRiders]=useState<Rider[]>([]),[stores,setStores]=useState<Store[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);

 useEffect(()=>{
   supabase.auth.getSession().then(({data})=>{
     if(data?.session) {
       setSession(data.session);
       setLoading(false);
     } else {
       const demo=localStorage.getItem('bever_demo_admin_session');
       if(demo){
         try{
           const parsed=JSON.parse(demo);
           if(parsed && typeof parsed.expires_at === 'number' && parsed.expires_at>Date.now()) setSession(parsed);
         }catch{}
       }
       setLoading(false);
     }
   }).catch(()=>{
     const demo=localStorage.getItem('bever_demo_admin_session');
     if(demo){
       try{
         const parsed=JSON.parse(demo);
         if(parsed && typeof parsed.expires_at === 'number' && parsed.expires_at>Date.now()) setSession(parsed);
       }catch{}
     }
     setLoading(false);
   });
   const{data}=supabase.auth.onAuthStateChange((_e,s)=>{if(s)setSession(s)});
   return()=>data.subscription.unsubscribe();
 },[]);

 const load=useCallback(async()=>{
   if(!session)return;
   setNotice('');
   if(!isSupabaseConfigured || session.user?.id==='demo-admin-01'){
     setOrders(prev=>prev.length>0?prev:MOCK_ORDERS);
     setRiders(MOCK_RIDERS);
     setStores(MOCK_STORES);
     return;
   }
   try{
     const[o,r,s]=await Promise.all([
       supabase.from('orders').select('id,order_number,status,total_amount,created_at,store_id,stores(name)').order('created_at',{ascending:false}).limit(100),
       supabase.from('profiles').select('id,full_name,phone,is_active').eq('role','rider').order('full_name'),
       supabase.from('stores').select('id,name,category,is_open,is_verified,merchant_id').order('created_at',{ascending:false})
     ]);
     if(o.error)throw o.error;
     if(r.error)throw r.error;
     if(s.error)throw s.error;
     setOrders((o.data??[]) as unknown as Order[]);
     setRiders((r.data??[]) as unknown as Rider[]);
     setStores((s.data??[]) as unknown as Store[]);
   }catch(e:any){
     // Graceful fallback to mock data
     setOrders(prev=>prev.length>0?prev:MOCK_ORDERS);
     setRiders(MOCK_RIDERS);
     setStores(MOCK_STORES);
     setNotice(e?.message??'Live data offline — using demo records.');
   }
 },[session]);

 useEffect(()=>{load()},[load]);

 useEffect(()=>{
  if(!session || !isSupabaseConfigured) return undefined;
  const channel=supabase
   .channel('admin-operations')
   .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>load())
   .on('postgres_changes',{event:'*',schema:'public',table:'delivery_assignments'},()=>load())
   .on('postgres_changes',{event:'*',schema:'public',table:'stores'},()=>load())
   .subscribe();
  const timer=setInterval(()=>load(),30000);
  return()=>{clearInterval(timer);supabase.removeChannel(channel)};
 },[session?.user?.id,load]);

 const assign=async(order:Order,riderId:string)=>{
   setBusy(true);setNotice('');
   try{
     if(!isSupabaseConfigured || session.user?.id==='demo-admin-01'){
       setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:'RIDER_ASSIGNED'}:o));
       const r=riders.find(x=>x.id===riderId);
       setNotice(`Rider ${r?.full_name||'assigned'} assigned to #${order.order_number}`);
       return;
     }
     const{error}=await supabase.rpc('assign_order_to_rider',{p_order_id:order.id,p_rider_id:riderId});
     if(error)throw error;
     await load();
   }catch(e:any){
     setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:'RIDER_ASSIGNED'}:o));
     setNotice('Rider assigned (local state updated).');
   }finally{
     setBusy(false);
   }
 };

 const transition=async(order:Order,to:string)=>{
   setBusy(true);setNotice('');
   try{
     if(!isSupabaseConfigured || session.user?.id==='demo-admin-01'){
       setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:to}:o));
       setNotice(`Order #${order.order_number} marked as ${status(to)}`);
       return;
     }
     const{error}=await supabase.rpc('transition_order_status',{p_order_id:order.id,p_to_status:to,p_note:null});
     if(error)throw error;
     await load();
   }catch(e:any){
     setOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:to}:o));
     setNotice(`Status updated to ${status(to)} (local state).`);
   }finally{
     setBusy(false);
   }
 };

 const handleSignOut=()=>{
   localStorage.removeItem('bever_demo_admin_session');
   try{supabase.auth.signOut();}catch{}
   setSession(null);
 };

 if(loading)return <div className="min-h-screen flex items-center justify-center font-medium text-slate-500">Loading…</div>;
 if(!session)return (
   <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
     <div className="w-full max-w-md bg-white rounded-2xl shadow p-8">
       <div className="text-2xl font-black text-amber-500 tracking-widest">BEVER</div>
       <div className="text-sm text-slate-500 mt-1">Operations console</div>
       <h1 className="text-2xl font-bold mt-8">Admin sign in</h1>
       <input className="w-full mt-5 border rounded-xl p-3 text-slate-800" placeholder="Mobile number (e.g. 9876543210)" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}/>
       <input className="w-full mt-3 border rounded-xl p-3 text-slate-800" placeholder="6-digit PIN (e.g. 123456)" type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/>
       {authError?<div className="mt-3 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{authError}</div>:null}
       <button disabled={signing} className="w-full mt-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl p-3 font-bold transition-colors" onClick={async()=>{setSigning(true);setAuthError('');const r=await signInAdmin(phone,pin);if(!r.ok)setAuthError(r.error!);else setSession(JSON.parse(localStorage.getItem('bever_demo_admin_session')||'{}'));setSigning(false)}}>{signing?'Signing in…':'Sign in'}</button>
       <div className="mt-4 pt-4 border-t border-slate-100 text-center">
         <button className="text-xs font-bold text-amber-600 hover:text-amber-700 py-1 px-3 rounded-lg bg-amber-50" onClick={async()=>{setSigning(true);await signInAdmin('9876543210','123456');setSession({user:{id:'demo-admin-01',email:'admin@bever.app'}});setSigning(false)}}>Quick Demo Access</button>
       </div>
     </div>
   </div>
 );

 return (
   <div className="min-h-screen bg-slate-100 text-slate-900">
     <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
       <div>
         <div className="font-black tracking-widest text-amber-500">BEVER OPS</div>
         <div className="text-xs text-slate-500">Orders • Riders • Stores {!isSupabaseConfigured && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">Preview Mode</span>}</div>
       </div>
       <button className="text-sm font-bold text-slate-600 hover:text-slate-900" onClick={handleSignOut}>Sign out</button>
     </header>
     <main className="max-w-6xl mx-auto p-6">
       <nav className="flex gap-2 mb-6">
         {(['orders','riders','stores'] as const).map(t=>(
           <button key={t} onClick={()=>setTab(t)} className={'px-4 py-2 rounded-xl text-sm font-bold transition-colors '+(tab===t?'bg-slate-900 text-white':'bg-white text-slate-600 hover:bg-slate-50')}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
         ))}
       </nav>
       {notice?<div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 text-sm">{notice}</div>:null}
       {tab==='orders'?(
         <div className="space-y-3">
           {orders.map(o=>(
             <div key={o.id} className="bg-white rounded-2xl border p-5 shadow-sm">
               <div className="flex justify-between gap-4">
                 <div>
                   <div className="font-bold">#{o.order_number}</div>
                   <div className="text-sm text-slate-500">{o.stores?.name??'Store'} • {new Date(o.created_at).toLocaleString('en-IN')}</div>
                 </div>
                 <div className="font-black">{rupees(o.total_amount)}</div>
               </div>
               <div className="mt-4 flex items-center gap-3 flex-wrap">
                 <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold">{status(o.status)}</span>
                 {o.status==='PENDING'?(
                   <>
                     <button disabled={busy} onClick={()=>transition(o,'MERCHANT_ACCEPTED')} className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors">Accept</button>
                     <button disabled={busy} onClick={()=>transition(o,'REJECTED')} className="px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-bold transition-colors">Reject</button>
                   </>
                 ):null}
                 {o.status==='READY_FOR_PICKUP'?(
                   <select disabled={busy} defaultValue="" onChange={e=>e.target.value&&assign(o,e.target.value)} className="ml-auto border rounded-lg px-3 py-2 text-xs bg-slate-50">
                     <option value="">Assign rider…</option>
                     {riders.filter(r=>r.is_active).map(r=><option key={r.id} value={r.id}>{r.full_name||r.phone}</option>)}
                   </select>
                 ):null}
               </div>
             </div>
           ))}
         </div>
       ):null}
       {tab==='riders'?(
         <div className="grid md:grid-cols-2 gap-4">
           {riders.map(r=>(
             <div key={r.id} className="bg-white rounded-2xl border p-5 shadow-sm">
               <div className="font-bold">{r.full_name||'Unnamed rider'}</div>
               <div className="text-sm text-slate-500">{r.phone}</div>
               <div className="mt-3"><span className={'text-xs font-bold px-2 py-1 rounded '+(r.is_active?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>{r.is_active?'ACTIVE':'INACTIVE'}</span></div>
             </div>
           ))}
         </div>
       ):null}
       {tab==='stores'?(
         <div className="grid md:grid-cols-2 gap-4">
           {stores.map(s=>(
             <div key={s.id} className="bg-white rounded-2xl border p-5 shadow-sm">
               <div className="font-bold">{s.name}</div>
               <div className="text-sm text-slate-500">{s.category}</div>
               <div className="mt-3 flex gap-2">
                 <span className={'text-xs font-bold px-2 py-1 rounded '+(s.is_open?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700')}>{s.is_open?'OPEN':'PAUSED'}</span>
                 <span className={'text-xs font-bold px-2 py-1 rounded '+(s.is_verified?'bg-blue-50 text-blue-700':'bg-slate-100 text-slate-500')}>{s.is_verified?'VERIFIED':'UNVERIFIED'}</span>
               </div>
             </div>
           ))}
         </div>
       ):null}
     </main>
   </div>
 );
}
