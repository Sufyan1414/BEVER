import { supabase } from './supabase';

export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.length === 10 ? digits : digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : '';
  return /^[6-9]\d{9}$/.test(local) ? '+91' + local : null;
}

export function phoneEmail(phone: string) {
  return 'customer_' + phone.replace(/\D/g, '') + '@bever.app';
}

function validate(phone: string, pin: string) {
  const normalized = normalizeIndianPhone(phone);
  if (!normalized) return { error: 'Enter a valid 10-digit Indian mobile number.' } as const;
  if (!/^\d{6}$/.test(pin)) return { error: 'PIN must be exactly 6 digits.' } as const;
  return { normalized } as const;
}

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'Wrong number or PIN. New here? Tap "Create account" below.';
  if (/already registered|already exists/i.test(message)) return 'This number already has an account. Tap "Sign in" instead.';
  if (/email not confirmed/i.test(message)) return 'This account is not confirmed yet. Ask BEVER support.';
  return message;
}

/** Signs in. Role is checked by the app shell: a non-merchant lands on the "waiting for approval" screen. */
export async function signInMerchant(phone: string, pin: string) {
  const v = validate(phone, pin);
  if ('error' in v) return { ok: false, error: v.error };
  const { error } = await supabase.auth.signInWithPassword({ email: phoneEmail(v.normalized), password: pin });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  return { ok: true };
}

/** Creates a login (always a plain customer role). BEVER staff then activate it as a merchant. */
export interface MerchantApplication {
  owner_name: string;
  store_name: string;
  category: string;
  address: string;
  pincode: string;
  city: string;
  opens_at: string;
  closes_at: string;
  fssai?: string;
  gstin?: string;
}

export async function signUpMerchant(phone: string, pin: string, application?: MerchantApplication) {
  const v = validate(phone, pin);
  if ('error' in v) return { ok: false, error: v.error };
  const { data, error } = await supabase.auth.signUp({
    email: phoneEmail(v.normalized), password: pin, options: { data: { phone: v.normalized, full_name: application?.owner_name, merchant_application: application ? { ...application, submitted_at: new Date().toISOString() } : undefined } },
  });
  if (error) return { ok: false, error: friendlyAuthError(error.message) };
  if (!data.session) return signInMerchant(phone, pin);
  return { ok: true };
}
