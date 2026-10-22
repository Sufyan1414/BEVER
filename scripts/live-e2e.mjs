// Customer-side end-to-end test against the live BEVER backend (public anon key only).
// Uses ONE dedicated test account (+919000000001) and cancels the order it places.
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL, KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const PHONE = '919000000001', PIN = '123456', EMAIL = `customer_${PHONE}@bever.app`;
const lines = []; let failed = 0;
const step = (name, ok, detail) => { lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!ok) failed++; };
const call = async (method, path, token, body, extra = {}) => {
  const r = await fetch(URL_ + path, { method, headers: { apikey: KEY, Authorization: `Bearer ${token ?? KEY}`, 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  let b; try { b = await r.json(); } catch { b = null; } return { s: r.status, b };
};
try {
  let auth = await call('POST', '/auth/v1/token?grant_type=password', null, { email: EMAIL, password: PIN });
  if (auth.s !== 200) {
    const up = await call('POST', '/auth/v1/signup', null, { email: EMAIL, password: PIN, data: { phone: '+' + PHONE } });
    step('Sign up new test customer', up.s === 200, up.s === 200 ? 'created' : up.b);
    auth = await call('POST', '/auth/v1/token?grant_type=password', null, { email: EMAIL, password: PIN });
  }
  step('Sign in with phone+PIN pseudo-email', auth.s === 200, auth.s === 200 ? 'ok' : auth.b);
  const tok = auth.b?.access_token, uid = auth.b?.user?.id;
  if (!tok) throw new Error('no token');

  const prof = await call('POST', '/rest/v1/rpc/ensure_my_profile', tok, {});
  step('ensure_my_profile', prof.s < 300, prof.s < 300 ? 'ok' : prof.b);
  const role = await call('GET', `/rest/v1/profiles?id=eq.${uid}&select=role,full_name,phone`, tok);
  step('Profile created with role customer', role.b?.[0]?.role === 'customer', role.b?.[0]);
  await call('PATCH', `/rest/v1/profiles?id=eq.${uid}`, tok, { full_name: 'BEVER Test Customer' });

  const stores = await call('POST', '/rest/v1/rpc/get_nearby_stores', tok, { customer_lat: 19.8762, customer_lng: 75.3433, limit_count: 20 });
  step('get_nearby_stores returns stores', stores.s === 200 && stores.b?.length > 0, stores.s === 200 ? `${stores.b.length} stores: ${stores.b.map(x => x.name).join(', ')}` : stores.b);
  const store = stores.b?.[0];
  if (!store) throw new Error('no nearby store (check store coordinates / radius)');

  const prods = await call('GET', `/rest/v1/products?store_id=eq.${store.id}&is_available=eq.true&select=id,name,price&limit=3`, tok);
  step('Store has purchasable products', prods.b?.length > 0, prods.b);
  const p = prods.b?.[0];

  let addr = (await call('GET', `/rest/v1/customer_addresses?customer_id=eq.${uid}&select=id&limit=1`, tok)).b?.[0];
  if (!addr) {
    const a = await call('POST', '/rest/v1/customer_addresses', tok, { customer_id: uid, label: 'Home', address_line_1: 'Test flat 1, Test street', city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', pincode: '431001', location: 'POINT(75.3433 19.8762)', is_default: true }, { Prefer: 'return=representation' });
    step('Create delivery address', a.s === 201, a.s === 201 ? 'ok' : a.b);
    addr = a.b?.[0];
  } else step('Delivery address exists', true);

  const order = await call('POST', '/rest/v1/rpc/create_customer_order', tok, { p_store_id: store.id, p_delivery_address_id: addr?.id, p_items: [{ product_id: p.id, quantity: 1 }], p_payment_method: 'COD', p_special_instructions: 'AUTOMATED TEST ORDER - please ignore' });
  const row = Array.isArray(order.b) ? order.b[0] : order.b;
  step('create_customer_order (server pricing)', order.s === 200 && !!row?.order_id, order.s === 200 ? { number: row.order_number, items: row.items_total, fee: row.delivery_fee, total: row.total_amount, productPrice: p.price } : order.b);
  if (row?.items_total !== undefined) step('Server item total equals product price', row.items_total === p.price, { server: row.items_total, product: p.price });
  if (row?.order_id) {
    const mine = await call('GET', `/rest/v1/orders?id=eq.${row.order_id}&select=status,delivery_otp,payment_method,total_amount`, tok);
    step('Customer can read own order', mine.b?.length === 1, mine.b?.[0]);
    const bad = await call('PATCH', `/rest/v1/orders?id=eq.${row.order_id}`, tok, { status: 'DELIVERED', total_amount: 1 });
    const after = await call('GET', `/rest/v1/orders?id=eq.${row.order_id}&select=status,total_amount`, tok);
    step('Customer CANNOT directly edit order status/total', after.b?.[0]?.status !== 'DELIVERED' && after.b?.[0]?.total_amount !== 1, { patchStatus: bad.s, order: after.b?.[0] });
    const cancel = await call('POST', '/rest/v1/rpc/transition_order_status', tok, { p_order_id: row.order_id, p_to_status: 'CANCELLED', p_note: 'automated test cleanup' });
    step('Customer can cancel own order (cleanup)', cancel.s === 200, cancel.s === 200 ? 'cancelled' : cancel.b);
  }
  const sec = await call('PATCH', `/rest/v1/profiles?id=eq.${uid}`, tok, { role: 'admin' });
  const chk = await call('GET', `/rest/v1/profiles?id=eq.${uid}&select=role`, tok);
  step('Customer CANNOT promote self to admin', chk.b?.[0]?.role === 'customer', { patch: sec.s, role: chk.b?.[0]?.role });
  const sv = await call('PATCH', `/rest/v1/stores?id=eq.${store.id}`, tok, { is_verified: false, name: 'HACKED' });
  const sv2 = await call('GET', `/rest/v1/stores?id=eq.${store.id}&select=name,is_verified`, tok);
  step('Customer CANNOT edit a store', sv2.b?.[0]?.name !== 'HACKED', { patch: sv.s, store: sv2.b?.[0] });
} catch (e) { step('Test aborted', false, String(e.message ?? e)); }
console.log(lines.join('\n') + `\n\n${failed === 0 ? 'ALL PASSED' : failed + ' FAILED'}`);
