import { AppState } from 'react-native';

/**
 * setInterval that only ticks while the app is in the foreground, and refreshes once when the
 * app comes back. Saves battery, mobile data and server load. Returns a stop function.
 */
export function activeInterval(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setInterval> | null = null;
  const start = () => { if (!timer) timer = setInterval(fn, ms); };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  if (AppState.currentState === 'active') start();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') { fn(); start(); } else stop();
  });
  return () => { stop(); sub.remove(); };
}
