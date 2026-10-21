import {useCallback,useEffect,useState} from 'react';
import {supabase} from './lib/supabase';
import {signInAdmin} from './auth';

type Order={id:string;order_number:string;status:string;total_amount:number;created_at:string;store_id:string;stores?:{name:string}|null};
type Rider={id:string;full_name:string;phone:string;is_active:boolean};
type Store={id:string;name:string;category:string;is_open:boolean;is_verified:boolean;merchant_id:string};

const rupees=(p:number)=>'₹'+Math.round(p/100);
const status=(s:string)=>s.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());

export default function App(){
 const[session,setSession]=useState<any>(null),[loading,setLoading]=useState(true),[phone,setPhone]=useState(''),[pin,setPin]=useState(''),[authError,setAuthError]=useState(''),[signing,setSigning]=useState(false);
 const[tab,setTab]=useState<'orders'|'riders'|'stores'>('orders'),[orders,setOrders]=useState<Order[]>([]),[riders,setRiders]=useState<Rider[]>([]),[stores,setStores]=useState<Store[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);

 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);setLoading(false)});const{data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[]);
 const load=useCallback(async()=>{if(!session)return;setNotice('');try{const[o,r,s]=await Promise.all([supabase.from('orders').select('id,order_number,status,total_amount,created_at,store_id,stores(name)').order('created_at',{ascending:false}).limit(100),supabase.from('profiles').select('id,full_name,phone,is_active').eq('role','rider').order('full_name'),supabase.from('stores').select('id,name,category,is_open,is_verified,merchant_id').order('created_at',{ascending:false})]);if(o.error)throw o.error;if(r.error)throw r.error;if(s.error)throw s.error;setOrders((o.data??[]) as unknown as Order[]);setRiders((r.data??[]) as Rider[]);setStores((s.data??[]) as Store[])}catch(e:any){setNotice(e?.message??'Could not load admin data.')}},[session]);
 useEffect(()=>{load()},[load]);

 useEffect(()=>{
  if(!session) return;
  const channel=supabase
   .channel('admin-operations')
   .on('postgres_changes',{event:'*',schema:'public',table:'orders'},()=>load())
   .on('postgres_changes',{event:'*',schema:'public',table:'delivery_assignments'},()=>load())
   .on('postgres_changes',{event:'*',schema:'public',table:'stores'},()=>load())
   .subscribe();
  const timer=setInterval(()=>load(),30000);
  return()=>{clearInterval(timer);supabase.removeChannel(channel)};
 },[session?.user?.id,load]);
 const assign=async(order:Order,riderId:string)=>{setBusy(true);setNotice('');try{const{error}=await supabase.rpc('assign_order_to_rider',{p_order_id:order.id,p_rider_id:riderId});if(error)throw error;await load()}catch(e:any){setNotice(e?.message??'Could not assign rider.')}finally{setBusy(false)}};
 const transition=async(order:Order,to:string)=>{setBusy(true);setNotice('');try{const{error}=await supabase.rpc('transition_order_status',{p_order_id:order.id,p_to_status:to,p_note:null});if(error)throw error;await load()}catch(e:any){setNotice(e?.message??'Could not update order.')}finally{setBusy(false)}};

 if(loading)return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
 if(!session)return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6"><div className="w-full max-w-md bg-white rounded-2xl shadow p-8"><div className="text-2xl font-black text-amber-500 tracking-widest">BEVER</div><div className="text-sm text-slate-500 mt-1">Operations console</div><h1 className="text-2xl font-bold mt-8">Admin sign in</h1><input className="w-full mt-5 border rounded-xl p-3" placeholder="Mobile number" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}/><input className="w-full mt-3 border rounded-xl p-3" placeholder="6-digit PIN" type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/>{authError?<div className="mt-3 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{authError}</div>:null}<button disabled={signing} className="w-full mt-4 bg-amber-500 text-white rounded-xl p-3 font-bold" onClick={async()=>{setSigning(true);setAuthError('');const r=await signInAdmin(phone,pin);if(!r.ok)setAuthError(r.error!);setSigning(false)}}>{signing?'Signing in…':'Sign in'}</button></div></div>;

 return <div className="min-h-screen bg-slate-100 text-slate-900"><header className="bg-white border-b px-6 py-4 flex items-center justify-between"><div><div className="font-black tracking-widest text-amber-500">BEVER OPS</div><div className="text-xs text-slate-500">Orders • Riders • Stores</div></div><button className="text-sm font-bold text-slate-600" onClick={()=>supabase.auth.signOut()}>Sign out</button></header><main className="max-w-6xl mx-auto p-6"><nav className="flex gap-2 mb-6">{(['orders','riders','stores'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={'px-4 py-2 rounded-xl text-sm font-bold '+(tab===t?'bg-slate-900 text-white':'bg-white text-slate-600')}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}</nav>{notice?<div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 text-sm">{notice}</div>:null}
 {tab==='orders'?<div className="space-y-3">{orders.map(o=><div key={o.id} className="bg-white rounded-2xl border p-5"><div className="flex justify-between gap-4"><div><div className="font-bold">#{o.order_number}</div><div className="text-sm text-slate-500">{o.stores?.name??'Store'} • {new Date(o.created_at).toLocaleString('en-IN')}</div></div><div className="font-black">{rupees(o.total_amount)}</div></div><div className="mt-4 flex items-center gap-3"><span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-bold">{status(o.status)}</span>{o.status==='PENDING'?<><button disabled={busy} onClick={()=>transition(o,'MERCHANT_ACCEPTED')} className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold">Accept</button><button disabled={busy} onClick={()=>transition(o,'REJECTED')} className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-bold">Reject</button></>:null}{o.status==='READY_FOR_PICKUP'?<select disabled={busy} defaultValue="" onChange={e=>e.target.value&&assign(o,e.target.value)} className="ml-auto border rounded-lg px-3 py-2 text-xs"><option value="">Assign rider…</option>{riders.filter(r=>r.is_active).map(r=><option key={r.id} value={r.id}>{r.full_name||r.phone}</option>)}</select>:null}</div></div>)}</div>:null}
 {tab==='riders'?<div className="grid md:grid-cols-2 gap-4">{riders.map(r=><div key={r.id} className="bg-white rounded-2xl border p-5"><div className="font-bold">{r.full_name||'Unnamed rider'}</div><div className="text-sm text-slate-500">{r.phone}</div><div className="mt-3 text-xs font-bold">{r.is_active?'ACTIVE':'INACTIVE'}</div></div>)}</div>:null}
 {tab==='stores'?<div className="grid md:grid-cols-2 gap-4">{stores.map(s=><div key={s.id} className="bg-white rounded-2xl border p-5"><div className="font-bold">{s.name}</div><div className="text-sm text-slate-500">{s.category}</div><div className="mt-3 flex gap-2"><span className="text-xs font-bold">{s.is_open?'OPEN':'PAUSED'}</span><span className="text-xs font-bold">{s.is_verified?'VERIFIED':'UNVERIFIED'}</span></div></div>)}</div>:null}
 </main></div>;
}
