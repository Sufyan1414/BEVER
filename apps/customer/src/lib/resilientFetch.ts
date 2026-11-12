/**
 * Fetch wrapper for Supabase: 15 s timeout on every request, and up to 2 quick retries for
 * read-only requests (GET/HEAD) that fail on a bad connection or a 502/503/504.
 * Writes are never retried automatically, so an order can't be placed twice.
 */
const TIMEOUT_MS = 15000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')).toUpperCase();
  const canRetry = method === 'GET' || method === 'HEAD';
  const attempts = canRetry ? 3 : 1;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const outer = init?.signal;
    const onAbort = () => ctrl.abort();
    outer?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(input, { ...init, signal: ctrl.signal });
      if (canRetry && [502, 503, 504].includes(res.status) && i < attempts - 1) { await sleep(400 * (i + 1)); continue; }
      return res;
    } catch (e) {
      lastErr = e;
      if (outer?.aborted || !canRetry || i === attempts - 1) throw e;
      await sleep(400 * (i + 1));
    } finally {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
    }
  }
  throw lastErr;
}
