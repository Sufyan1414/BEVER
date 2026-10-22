// Read-only probe of the live BEVER Supabase project using the PUBLIC anon key.
// Writes nothing. Reports what a stranger (anon) can see and which server functions exist.
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const out = [];
const log = (k, v) => out.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
async function get(path) { const r = await fetch(URL_ + path, { headers: H }); let b; try { b = await r.json(); } catch { b = null; } return { s: r.status, b }; }
async function rpc(name, args) { const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, { method: 'POST', headers: H, body: JSON.stringify(args) }); let b; try { b = await r.json(); } catch { b = null; } return { s: r.status, b }; }

const settings = await get('/auth/v1/settings');
log('AUTH autoconfirm (email)', settings.b?.mailer_autoconfirm);
log('AUTH signup disabled', settings.b?.disable_signup);
log('AUTH external phone', settings.b?.external?.phone);

const stores = await get('/rest/v1/stores?select=id,name,category,is_open,is_verified,is_active,minimum_order_amount,service_radius_meters&limit=20');
log('STORES visible to anon', { status: stores.s, count: Array.isArray(stores.b) ? stores.b.length : stores.b, sample: Array.isArray(stores.b) ? stores.b.slice(0, 5) : null });
const prods = await get('/rest/v1/products?select=id,name,price,is_available,image_url&limit=50');
log('PRODUCTS visible to anon', { status: prods.s, count: Array.isArray(prods.b) ? prods.b.length : prods.b, withImages: Array.isArray(prods.b) ? prods.b.filter(p => p.image_url).length : null });
for (const t of ['orders', 'profiles', 'order_items', 'customer_addresses', 'delivery_assignments']) {
  const r = await get(`/rest/v1/${t}?select=id&limit=3`);
  log(`PRIVATE table ${t} (anon must see nothing)`, { status: r.s, rows: Array.isArray(r.b) ? r.b.length : r.b });
}
const near = await rpc('get_nearby_stores', { p_lat: 19.8762, p_lng: 75.3433 });
log('RPC get_nearby_stores', { status: near.s, result: Array.isArray(near.b) ? `${near.b.length} stores` : near.b });
for (const [fn, args] of [
  ['create_customer_order', {}], ['transition_order_status', {}], ['complete_order_delivery', {}],
  ['accept_delivery_assignment', {}], ['assign_order_to_rider', {}], ['ensure_profile', {}], ['quote_customer_order', {}],
]) {
  const r = await rpc(fn, args);
  const code = r.b?.code;
  log(`RPC ${fn}`, code === 'PGRST202' ? 'MISSING' : `exists (status ${r.s}, ${code ?? ''} ${String(r.b?.message ?? '').slice(0, 70)})`);
}
const buckets = await get('/storage/v1/bucket');
log('STORAGE buckets (anon)', { status: buckets.s, body: Array.isArray(buckets.b) ? buckets.b.map(b => b.name) : buckets.b });
console.log(out.join('\n'));
