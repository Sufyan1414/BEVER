// Full-flow test on the live backend: customer orders -> merchant prepares -> rider claims,
// picks up and delivers with the delivery code. Uses dedicated test logins and a test store that
// is open only while this runs. Requires packages/supabase/field-trial/test_accounts.sql once.
const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL, KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const lines = []; let failed = 0;
const step = (name, ok, detail) => { lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); if (!ok) failed++; };
const call = async (method, path, token, body, extra = {}) => {
  const r = await fetch(URL_ + path, { method, headers: { apikey: KEY, Authorization: `Bearer ${token ?? KEY}`, 'Content-Type': 'application/json', ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  let b; try { b = await r.json(); } catch { b = null; } return { s: r.status, b };
};
async function login(phone, label) {
  const email = `customer_${phone}@bever.app`, pin = '123456';
  let a = await call('POST', '/auth/v1/token?grant_type=password', null, { email, password: pin });
  if (a.s !== 200) { await call('POST', '/auth/v1/signup', null, { email, password: pin, data: { phone: '+' + phone } }); a = await call('POST', '/auth/v1/token?grant_type=password', null, { email, password: pin }); }
  if (a.s !== 200) throw new Error(`cannot sign in ${label}: ${JSON.stringify(a.b)}`);
  await call('POST', '/rest/v1/rpc/ensure_my_profile', a.b.access_token, {});
  return { tok: a.b.access_token, uid: a.b.user.id };
}
const rpc = (fn, tok, args) => call('POST', `/rest/v1/rpc/${fn}`, tok, args);
const status = async (tok, id) => (await call('GET', `/rest/v1/orders?id=eq.${id}&select=status,delivery_otp`, tok)).b?.[0];
let merchant;
try {
  merchant = await login('919000000002', 'merchant');
  const rider = await login('919000000003', 'rider');
  const cust = await login('919000000001', 'customer');
  const roles = await Promise.all([merchant, rider].map(x => call('GET', `/rest/v1/profiles?id=eq.${x.uid}&select=role`, x.tok)));
  if (roles[0].b?.[0]?.role !== 'merchant' || roles[1].b?.[0]?.role !== 'rider') {
    lines.push('SETUP NEEDED: run packages/supabase/field-trial/test_accounts.sql once in the Supabase SQL editor (test logins now exist), then push any commit.');
    throw new Error('setup');
  }
  step('Test merchant and rider have the right roles', true);

  const store = (await call('GET', `/rest/v1/stores?merchant_id=eq.${merchant.uid}&select=id,is_open,name`, merchant.tok)).b?.[0];
  step('Merchant can see own store', !!store, store?.name);
  const open = await call('PATCH', `/rest/v1/stores?id=eq.${store.id}`, merchant.tok, { is_open: true }, { Prefer: 'return=representation' });
  step('Merchant opens store', open.b?.[0]?.is_open === true, open.s);
  const prod = (await call('GET', `/rest/v1/products?store_id=eq.${store.id}&select=id,price&limit=1`, merchant.tok)).b?.[0];
  const addr = (await call('GET', `/rest/v1/customer_addresses?customer_id=eq.${cust.uid}&select=id&limit=1`, cust.tok)).b?.[0];

  const o = await rpc('create_customer_order', cust.tok, { p_store_id: store.id, p_delivery_address_id: addr?.id, p_items: [{ product_id: prod.id, quantity: 1 }], p_payment_method: 'COD', p_special_instructions: 'AUTOMATED FULL-FLOW TEST' });
  const row = Array.isArray(o.b) ? o.b[0] : o.b;
  step('Customer places order', !!row?.order_id, row ? { number: row.order_number, total: row.total_amount } : o.b);
  const id = row.order_id;

  const seen = await call('GET', `/rest/v1/orders?id=eq.${id}&select=status`, merchant.tok);
  step('Merchant sees the order', seen.b?.[0]?.status === 'PENDING', seen.b);
  const wrong = await rpc('transition_order_status', rider.tok, { p_order_id: id, p_to_status: 'MERCHANT_ACCEPTED' });
  step('Rider CANNOT accept an order as merchant', wrong.s >= 400, wrong.b?.message);
  for (const to of ['MERCHANT_ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP']) {
    const r = await rpc('transition_order_status', merchant.tok, { p_order_id: id, p_to_status: to });
    step(`Merchant -> ${to}`, r.s === 200, r.s === 200 ? 'ok' : r.b);
  }
  const avail = await rpc('list_available_deliveries', rider.tok, {});
  step('Rider sees order in "ready for pickup"', Array.isArray(avail.b) && avail.b.some(x => x.order_id === id), avail.s === 200 ? `${avail.b.length} available` : avail.b);
  const noClaim = await rpc('claim_delivery', cust.tok, { p_order_id: id });
  step('Customer CANNOT claim a delivery', noClaim.s >= 400, noClaim.b?.message);
  const claim = await rpc('claim_delivery', rider.tok, { p_order_id: id });
  step('Rider claims delivery', claim.s === 200, claim.s === 200 ? 'ok' : claim.b);
  const again = await rpc('claim_delivery', rider.tok, { p_order_id: id });
  step('Second claim is rejected', again.s >= 400, again.b?.message);
  for (const to of ['RIDER_AT_STORE', 'PICKED_UP', 'OUT_FOR_DELIVERY']) {
    const r = await rpc('transition_order_status', rider.tok, { p_order_id: id, p_to_status: to });
    step(`Rider -> ${to}`, r.s === 200, r.s === 200 ? 'ok' : r.b);
  }
  const mine = await status(cust.tok, id);
  const otp = mine?.delivery_otp;
  step('Customer sees delivery code', /^\d{4}$/.test(otp ?? ''), mine?.status);
  const bad = await rpc('complete_order_delivery', rider.tok, { p_order_id: id, p_delivery_otp: otp === '0000' ? '1111' : '0000', p_cod_collected: true, p_failure_note: null });
  step('Wrong delivery code is rejected', bad.s >= 400, bad.b?.message);
  const noCash = await rpc('complete_order_delivery', rider.tok, { p_order_id: id, p_delivery_otp: otp, p_cod_collected: false, p_failure_note: null });
  step('Delivery needs cash collected for COD', noCash.s >= 400, noCash.b?.message);
  const done = await rpc('complete_order_delivery', rider.tok, { p_order_id: id, p_delivery_otp: otp, p_cod_collected: true, p_failure_note: null });
  step('Rider completes delivery with the code', done.s === 200, done.s === 200 ? 'ok' : done.b);
  const fin = await status(cust.tok, id);
  step('Customer sees DELIVERED', fin?.status === 'DELIVERED', fin?.status);
} catch (e) { if (String(e.message) !== 'setup') step('Test aborted', false, String(e.message ?? e)); }
finally {
  if (merchant) {
    const st = (await call('GET', `/rest/v1/stores?merchant_id=eq.${merchant.uid}&select=id`, merchant.tok)).b?.[0];
    if (st) await call('PATCH', `/rest/v1/stores?id=eq.${st.id}`, merchant.tok, { is_open: false });
  }
}
console.log(lines.join('\n') + `\n\n${failed === 0 ? 'ALL PASSED' : failed + ' FAILED'}`);
