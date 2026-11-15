import { supabase } from './lib/supabase';
import { loginLockMessage, recordLoginFailure, clearLoginFailures } from './loginGuard';

function normalizePhone(input:string){
  const d=input.replace(/\D/g,'');
  const local=d.length===10?d:d.length===12&&d.startsWith('91')?d.slice(2):d.length===11&&d.startsWith('0')?d.slice(1):'';
  return /^[6-9]\d{9}$/.test(local)?'+91'+local:null;
}
function email(phone:string){return 'customer_'+phone.replace(/\D/g,'')+'@bever.app';}

export async function signInAdmin(phone:string,pin:string){
  const normalized=normalizePhone(phone);
  if(!normalized)return{ok:false,error:'Enter a valid 10-digit Indian mobile number.'};
  if(pin.length<6||pin.length>72)return{ok:false,error:'Enter your admin password (6 to 72 characters).'};
  const locked=await loginLockMessage(normalized);
  if(locked)return{ok:false,error:locked};
  const {data,error}=await supabase.auth.signInWithPassword({email:email(normalized),password:pin});
  if(error){if(/invalid login credentials/i.test(error.message))await recordLoginFailure(normalized);return{ok:false,error:'Wrong number or password.'};}
  await clearLoginFailures(normalized);
  const {data:profile}=await supabase.from('profiles').select('role,full_name,is_active').eq('id',data.user.id).maybeSingle();
  if(!profile||profile.role!=='admin'||!profile.is_active){await supabase.auth.signOut();return{ok:false,error:'This account is not an active BEVER admin account.'};}
  return{ok:true};
}
