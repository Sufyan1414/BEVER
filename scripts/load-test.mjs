// Read-only load test with the PUBLIC anon key. 500 virtual customers browse the catalogue over ~60 s:
// each does: nearby shops -> shop products -> search -> deals. Writes nothing.
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const USERS = Number(process.env.LT_USERS ?? 500);
const RAMP_MS = Number(process.env.LT_RAMP_MS ?? 60000);
const lat = [];
const errs = {};
let total = 0;
const WORDS = ['milk', 'bread', 'tomato', 'rice', 'chips', 'soap', 'pen', 'tea'];

async function timed(name, fn) {
  const t0 = performance.now();
  total++;
  try {
    const r = await fn();
    if (!r.ok) throw new Error(`${name} HTTP ${r.status}`);
    const body = await r.json();
    lat.push(performance.now() - t0);
    return body;
  } catch (e) {
    lat.push(performance.now() - t0);
    errs[String(e.message).slice(0, 60)] = (errs[String(e.message).slice(0, 60)] ?? 0) + 1;
    return null;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.random() * (b - a);

async function user(i) {
  await sleep((i / USERS) * RAMP_MS);
  const stores = await timed('nearby', () => fetch(`${URL_}/rest/v1/rpc/get_nearby_stores`, { method: 'POST', headers: H, body: JSON.stringify({ customer_lat: 19.8762 + jitter(-0.01, 0.01), customer_lng: 75.3433 + jitter(-0.01, 0.01), limit_count: 20 }) }));
  await sleep(jitter(300, 1500));
  const sid = Array.isArray(stores) && stores.length ? stores[Math.floor(Math.random() * stores.length)].id : null;
  if (sid) await timed('products', () => fetch(`${URL_}/rest/v1/products?select=*&store_id=eq.${sid}&is_active=eq.true&limit=60`, { headers: H }));
  await sleep(jitter(300, 1500));
  const w = WORDS[i % WORDS.length];
  await timed('search', () => fetch(`${URL_}/rest/v1/products?select=*&name=ilike.*${w}*&is_active=eq.true&limit=40`, { headers: H }));
  await sleep(jitter(300, 1500));
  await timed('deals', () => fetch(`${URL_}/rest/v1/products?select=*&compare_at_price=not.is.null&is_active=eq.true&limit=60`, { headers: H }));
}

const t0 = performance.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => user(i)));
const secs = (performance.now() - t0) / 1000;
lat.sort((a, b) => a - b);
const q = (p) => Math.round(lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] ?? 0);
const failed = Object.values(errs).reduce((a, b) => a + b, 0);
console.log(`virtual customers: ${USERS}`);
console.log(`requests: ${total} in ${secs.toFixed(1)} s (${(total / secs).toFixed(1)} req/s)`);
console.log(`latency ms  p50=${q(0.5)}  p95=${q(0.95)}  p99=${q(0.99)}  max=${Math.round(lat.at(-1) ?? 0)}`);
console.log(`failed: ${failed} (${((failed / Math.max(1, total)) * 100).toFixed(2)} %)`);
if (failed) console.log('errors:', JSON.stringify(errs));
