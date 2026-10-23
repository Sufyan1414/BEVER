import React,{useState} from 'react';
import {ActivityIndicator,Keyboard,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,TouchableOpacity,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {signInRider,signUpRider,submitRiderApplication} from '../services/auth';

const VEHICLES:Array<[string,string]>=[['BIKE','Motorbike'],['SCOOTER','Scooter'],['EV','Electric'],['CYCLE','Bicycle']];
const G='#059669',GD='#065F46';

function Field(p:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;num?:boolean;secure?:boolean;error?:string|undefined;caps?:boolean}){
  return<View style={{marginTop:14}}><Text style={s.label}>{p.label}</Text><TextInput value={p.value} onChangeText={p.onChange} placeholder={p.placeholder} placeholderTextColor="#A8A29E" keyboardType={p.num?'number-pad':'default'} secureTextEntry={p.secure??false} autoCapitalize={p.caps?'characters':p.num?'none':'words'} style={[s.input,p.error?s.bad:null]} accessibilityLabel={p.label}/>{p.error?<Text style={s.err}>{p.error}</Text>:null}</View>;
}

export function RiderAuth({existingPhone,onSignOut}:{existingPhone?:string;onSignOut?:()=>void}={}){
  const existing=existingPhone!==undefined;
  const[mode,setMode]=useState<'in'|'up'>(existing?'up':'in');
  const[phone,setPhone]=useState(''),[pin,setPin]=useState(''),[pin2,setPin2]=useState('');
  const[name,setName]=useState(''),[city,setCity]=useState('Chhatrapati Sambhajinagar'),[area,setArea]=useState('');
  const[vehicle,setVehicle]=useState('BIKE'),[vno,setVno]=useState(''),[lic,setLic]=useState('');
  const[en,setEn]=useState(''),[ep,setEp]=useState('');
  const[agree,setAgree]=useState(false);
  const[errors,setErrors]=useState<Record<string,string>>({});
  const[top,setTop]=useState<string|null>(null);
  const[busy,setBusy]=useState(false);
  const motor=vehicle!=='CYCLE';

  const validate=()=>{
    const e:Record<string,string>={};
    if(!existing){
      if(!/^[6-9]\d{9}$/.test(phone))e['phone']='Enter a valid 10-digit mobile number.';
      if(!/^\d{6}$/.test(pin))e['pin']='PIN must be exactly 6 digits.';
    }
    if(mode==='up'){
      if(!existing&&pin2!==pin)e['pin2']='PINs do not match.';
      if(name.trim().length<3)e['name']='Enter your full name as on your ID.';
      if(!city.trim())e['city']='Enter your city.';
      if(area.trim().length<3)e['area']='Enter the area you can deliver in.';
      if(motor&&!/^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{4}$/.test(vno.toUpperCase().trim()))e['vno']='Enter the vehicle number, e.g. MH20AB1234.';
      if(motor&&lic.trim().length<8)e['lic']='Enter your driving licence number.';
      if(en.trim().length<3)e['en']='Enter an emergency contact name.';
      if(!/^[6-9]\d{9}$/.test(ep))e['ep']='Enter a valid 10-digit emergency number.';
      if(ep&&ep===(existing?existingPhone:phone))e['ep']='Emergency number must be different from yours.';
      if(!agree)e['agree']='Please accept the rider agreement to continue.';
    }
    setErrors(e);return Object.keys(e).length===0;
  };

  const submit=async()=>{
    Keyboard.dismiss();setTop(null);
    if(!validate()){setTop('Please fix the highlighted fields.');return}
    setBusy(true);
    try{
      const appData={full_name:name.trim(),city:city.trim(),area:area.trim(),vehicle_type:vehicle,vehicle_number:motor?vno.toUpperCase().replace(/\s/g,''):'',licence_number:motor?lic.trim():'',emergency_name:en.trim(),emergency_phone:ep};
      const r=existing?await submitRiderApplication(appData):mode==='in'?await signInRider(phone,pin):await signUpRider(phone,pin,appData);
      if(!r.ok)setTop(r.error??'Something went wrong.');
    }catch{setTop('No internet connection. Check your network and try again.')}
    finally{setBusy(false)}
  };

  return<KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}><StatusBar style="dark"/>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.logo}>BEVER</Text><Text style={s.role}>Rider</Text>
      <Text style={s.heading}>{mode==='in'?'Your deliveries':'Register as a rider'}</Text>
      <Text style={s.sub}>{mode==='in'?'Sign in with your mobile number and 6-digit PIN.':'Fill these once. BEVER verifies your details and activates your account.'}</Text>

      {!existing?<><Field label="Mobile number *" value={phone} onChange={v=>setPhone(v.replace(/\D/g,'').slice(0,10))} num placeholder="98765 43210" error={errors['phone']}/>
      <Field label={mode==='in'?'6-digit PIN *':'Create 6-digit PIN *'} value={pin} onChange={v=>setPin(v.replace(/\D/g,'').slice(0,6))} num secure placeholder="••••••" error={errors['pin']}/></>:null}
      {mode==='up'?<>
        {!existing?<Field label="Confirm PIN *" value={pin2} onChange={v=>setPin2(v.replace(/\D/g,'').slice(0,6))} num secure placeholder="••••••" error={errors['pin2']}/>:null}
        <Text style={s.section}>Your details</Text>
        <Field label="Full name *" value={name} onChange={setName} placeholder="As on your ID" error={errors['name']}/>
        <Field label="City *" value={city} onChange={setCity} error={errors['city']}/>
        <Field label="Area you can deliver in *" value={area} onChange={setArea} placeholder="e.g. Shahganj, Gulmandi" error={errors['area']}/>
        <Text style={s.section}>Vehicle</Text>
        <View style={s.chips}>{VEHICLES.map(([k,l])=><Pressable key={k} onPress={()=>setVehicle(k)} style={[s.chip,vehicle===k&&s.chipOn]} accessibilityRole="button"><Text style={[s.chipText,vehicle===k&&s.chipTextOn]}>{l}</Text></Pressable>)}</View>
        {motor?<><Field label="Vehicle number *" value={vno} onChange={v=>setVno(v.toUpperCase().slice(0,13))} placeholder="MH20AB1234" caps error={errors['vno']}/><Field label="Driving licence number *" value={lic} onChange={v=>setLic(v.toUpperCase().slice(0,20))} placeholder="MH2020XXXXXXXXX" caps error={errors['lic']}/></>:null}
        <Text style={s.section}>Emergency contact</Text>
        <Field label="Contact name *" value={en} onChange={setEn} error={errors['en']}/>
        <Field label="Contact mobile number *" value={ep} onChange={v=>setEp(v.replace(/\D/g,'').slice(0,10))} num placeholder="98765 43210" error={errors['ep']}/>
        <Pressable style={s.agreeRow} onPress={()=>setAgree(!agree)} accessibilityRole="checkbox" accessibilityState={{checked:agree}}><View style={[s.box,agree&&s.boxOn]}>{agree?<Text style={s.tick}>✓</Text>:null}</View><Text style={s.agreeText}>I confirm these details are true and I agree to BEVER’s rider agreement.</Text></Pressable>
        {errors['agree']?<Text style={s.err}>{errors['agree']}</Text>:null}
      </>:null}

      {top?<View style={s.banner}><Text style={s.bannerText}>{top}</Text></View>:null}
      <TouchableOpacity style={[s.primary,busy&&{opacity:0.7}]} disabled={busy} onPress={()=>{void submit()}}>{busy?<ActivityIndicator color="#fff"/>:<Text style={s.primaryText}>{mode==='in'?'Sign in':'Submit for activation'}</Text>}</TouchableOpacity>
      <Text style={s.switch} onPress={()=>{if(existing){onSignOut?.();return}setErrors({});setTop(null);setMode(mode==='in'?'up':'in')}}>{existing?'Sign out':mode==='in'?'New rider? Register here':'Already registered? Sign in'}</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}

const s=StyleSheet.create({
  flex:{flex:1,backgroundColor:'#F3FBF7'},content:{padding:24,paddingTop:64,paddingBottom:60},
  logo:{fontSize:32,fontWeight:'900',letterSpacing:3,color:G},role:{fontSize:12,color:'#78716C',marginTop:2},
  heading:{fontSize:26,fontWeight:'900',color:'#1C1917',marginTop:24},sub:{fontSize:14,color:'#78716C',lineHeight:21,marginTop:8,marginBottom:6},
  section:{fontSize:13,fontWeight:'900',letterSpacing:1,color:GD,marginTop:28,textTransform:'uppercase'},
  label:{fontSize:12,fontWeight:'800',color:'#44403C',marginBottom:6},
  input:{height:54,borderRadius:14,borderWidth:1,borderColor:'#E7E5E4',backgroundColor:'#fff',paddingHorizontal:16,fontSize:16,color:'#1C1917'},
  bad:{borderColor:'#B91C1C'},err:{color:'#B91C1C',fontSize:12,marginTop:5},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:12},
  chip:{paddingHorizontal:16,paddingVertical:9,borderRadius:999,borderWidth:1,borderColor:'#E7E5E4',backgroundColor:'#fff'},chipOn:{backgroundColor:G,borderColor:G},
  chipText:{fontSize:13,fontWeight:'800',color:'#44403C'},chipTextOn:{color:'#fff'},
  agreeRow:{flexDirection:'row',alignItems:'center',marginTop:24},
  box:{width:24,height:24,borderRadius:7,borderWidth:2,borderColor:'#D6D3D1',alignItems:'center',justifyContent:'center',marginRight:12,backgroundColor:'#fff'},boxOn:{backgroundColor:G,borderColor:G},
  tick:{color:'#fff',fontWeight:'900',fontSize:15},agreeText:{flex:1,fontSize:13,color:'#44403C',lineHeight:19},
  banner:{marginTop:16,padding:12,borderRadius:12,backgroundColor:'#FEE2E2'},bannerText:{color:'#991B1B',fontSize:13,lineHeight:19},
  primary:{backgroundColor:G,borderRadius:16,minHeight:54,alignItems:'center',justifyContent:'center',marginTop:18},primaryText:{color:'#fff',fontSize:15,fontWeight:'800'},
  switch:{fontSize:14,fontWeight:'800',color:GD,textAlign:'center',marginTop:22,padding:8},
});
