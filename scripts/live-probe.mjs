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
const near = await rpc('get_nearby_stores', { user_lat: 19.8762, user_lng: 75.3433, limit_count: 20 });
log('RPC get_nearby_stores', { status: near.s, result: Array.isArray(near.b) ? `${near.b.length} stores` : near.b });
const U = '00000000-0000-0000-0000-000000000000';
for (const [fn, args] of [
  ['create_customer_order', { p_store_id: U, p_delivery_address_id: U, p_items: [], p_payment_method: 'COD', p_special_instructions: null }],
  ['transition_order_status', { p_order_id: U, p_to_status: 'CONFIRMED', p_note: null }],
  ['complete_order_delivery', { p_order_id: U, p_delivery_otp: '0000', p_cod_collected: false, p_failure_note: null }],
  ['accept_delivery_assignment', { p_order_id: U }],
  ['ensure_my_profile', {}],
]) {
  const r = await rpc(fn, args);
  const code = r.b?.code;
  log(`RPC ${fn}`, code === 'PGRST202' ? `MISSING (${r.b?.message})` : `exists (status ${r.s}: ${String(r.b?.message ?? '').slice(0, 90)})`);
}
console.log(out.join('\n'));
