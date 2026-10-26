import { supabase } from './supabase';

function normalizePhone(input:string){
  const d=input.replace(/\D/g,'');
  const local=d.length===10?d:d.length===12&&d.startsWith('91')?d.slice(2):d.length===11&&d.startsWith('0')?d.slice(1):'';
  return /^[6-9]\d{9}$/.test(local)?'+91'+local:null;
}
function email(phone:string){return 'customer_'+phone.replace(/\D/g,'')+'@bever.app';}

function friendly(m:string){
  if(/invalid login credentials/i.test(m))return'Wrong number or PIN. New here? Tap "Register as a rider".';
  if(/already registered|already exists/i.test(m))return'This number already has an account. Use Sign in.';
  return m;
}
export async function signInRider(phone:string,pin:string){
  const normalized=normalizePhone(phone);
  if(!normalized)return{ok:false,error:'Enter a valid 10-digit Indian mobile number.'};
  if(!/^\d{6}$/.test(pin))return{ok:false,error:'PIN must be exactly 6 digits.'};
  const {error}=await supabase.auth.signInWithPassword({email:email(normalized),password:pin});
  if(error)return{ok:false,error:friendly(error.message)};
  return{ok:true};
}

export interface RiderApplication{
  full_name:string;city:string;area:string;vehicle_type:string;vehicle_number:string;
  licence_number:string;emergency_name:string;emergency_phone:string;
}
export async function signUpRider(phone:string,pin:string,app:RiderApplication){
  const normalized=normalizePhone(phone);
  if(!normalized)return{ok:false,error:'Enter a valid 10-digit Indian mobile number.'};
  if(!/^\d{6}$/.test(pin))return{ok:false,error:'PIN must be exactly 6 digits.'};
  const {data,error}=await supabase.auth.signUp({email:email(normalized),password:pin,options:{data:{phone:normalized,full_name:app.full_name,rider_application:{...app,submitted_at:new Date().toISOString()}}}});
  if(error){
    if(/already registered|already exists/i.test(error.message)){
      // The number already has a BEVER login (e.g. from the customer app). If the PIN matches, sign in and attach the rider application.
      const si=await signInRider(phone,pin);
      if(!si.ok)return{ok:false,error:'This number already has a BEVER account with a different PIN. Enter that PIN to continue.'};
      return submitRiderApplication(app);
    }
    return{ok:false,error:friendly(error.message)};
  }
  if(!data.session)return signInRider(phone,pin);
  return{ok:true};
}

export async function submitRiderApplication(app:RiderApplication){
  const {error}=await supabase.auth.updateUser({data:{full_name:app.full_name,rider_application:{...app,submitted_at:new Date().toISOString()}}});
  if(error)return{ok:false,error:error.message};
  return{ok:true};
}
