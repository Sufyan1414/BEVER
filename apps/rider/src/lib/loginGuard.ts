import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Client-side brake on PIN guessing. A 6-digit PIN has only 1,000,000 combinations,
 * so after 5 wrong tries the same number is locked for a growing delay (1, 2, 4 … up to 15 min).
 * This slows casual attacks on the device; the server-side rate limit (Supabase Auth settings)
 * is the real protection against scripted attacks.
 */
const MAX_FREE_TRIES = 5;
const MAX_LOCK_MS = 15 * 60 * 1000;

interface FailState { count: number; until: number }

const keyFor = (id: string) => `bever.loginfail.${id.replace(/\D/g, '')}`;

async function read(id: string): Promise<FailState> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(id));
    if (!raw) return { count: 0, until: 0 };
    const p = JSON.parse(raw) as Partial<FailState>;
    return { count: Number(p.count) || 0, until: Number(p.until) || 0 };
  } catch {
    return { count: 0, until: 0 };
  }
}

/** Returns a user-facing message when the number is locked, otherwise null. */
export async function loginLockMessage(id: string): Promise<string | null> {
  const s = await read(id);
  const left = s.until - Date.now();
  if (left <= 0) return null;
  const mins = Math.ceil(left / 60000);
  return `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
}

export async function recordLoginFailure(id: string): Promise<void> {
  const s = await read(id);
  const count = s.count + 1;
  const over = count - MAX_FREE_TRIES;
  const until = over >= 0 ? Date.now() + Math.min(MAX_LOCK_MS, 60000 * 2 ** over) : 0;
  try { await AsyncStorage.setItem(keyFor(id), JSON.stringify({ count, until })); } catch { /* ignore */ }
}

export async function clearLoginFailures(id: string): Promise<void> {
  try { await AsyncStorage.removeItem(keyFor(id)); } catch { /* ignore */ }
}
