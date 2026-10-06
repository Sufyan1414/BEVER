import { supabase } from './supabase';

export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.length === 10 ? digits : digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : '';
  return /^[6-9]\d{9}$/.test(local) ? '+91' + local : null;
}

export function phoneEmail(phone: string) {
  return 'customer_' + phone.replace(/\D/g, '') + '@bever.app';
}

export async function signInMerchant(phone: string, pin: string) {
  const normalized = normalizeIndianPhone(phone);
  if (!normalized) return { ok:false, error:'Enter a valid 10-digit Indian mobile number.' };
  if (!/^\d{6}$/.test(pin)) return { ok:false, error:'PIN must be exactly 6 digits.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: phoneEmail(normalized), password: pin });
  if (error) return { ok:false, error: error.message };
  const { data: profile } = await supabase.from('profiles').select('role,full_name,is_active').eq('id', data.user.id).maybeSingle();
  if (!profile || profile.role !== 'merchant' || !profile.is_active) {
    await supabase.auth.signOut();
    return { ok:false, error:'This account is not an active BEVER merchant account.' };
  }
  return { ok:true };
}
