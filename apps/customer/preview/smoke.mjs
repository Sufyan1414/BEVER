// CI-only render smoke test of the REAL customer app (guest flow) with a MOCKED Supabase backend.
// All data below is sample data for screenshots; it never ships in the app.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [dist, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  let f = path.join(dist, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/html' });
  fs.createReadStream(f).pipe(res);
}).listen(4174);

const storeId = '11111111-1111-4111-8111-111111111111';
const stores = [{
  id: storeId, name: 'Sharma Kirana & General Store', description: 'Daily groceries and household essentials', logo_url: null, banner_url: null,
  category: 'GROCERY', is_open: true, average_rating: 0, total_ratings: 0, estimated_delivery_minutes: null, minimum_order_amount: 0,
  address_text: 'Gulmandi Road, Chhatrapati Sambhajinagar', distance_meters: 850, service_radius_meters: 3000,
}];
const cats = [{ id: 'c1', store_id: storeId, name: 'Staples', sort_order: 1, is_active: true, created_at: '2026-10-01T00:00:00Z' }];
const mk = (id, name, unit, price, avail = true) => ({ id, store_id: storeId, category_id: 'c1', name, description: null, image_url: null, price, compare_at_price: null, unit, is_available: avail, is_active: true, sort_order: 0, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-20T00:00:00Z' });
const products = [mk('p1', 'Toor Dal', '1 kg', 15500), mk('p2', 'Farm Eggs', '12 pcs', 8400), mk('p3', 'Sunflower Oil', '1 L', 15500), mk('p4', 'Basmati Rice', '5 kg', 64000, false)];

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
const json = (route, body, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(({ storeId }) => {
  localStorage.setItem('@bever/browsing_location', JSON.stringify({ lat: 19.8762, lng: 75.3433, label: 'Gulmandi', city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', pincode: '431001', setAt: new Date().toISOString() }));
  localStorage.setItem('@bever/cart', JSON.stringify({ storeId, storeName: 'Sharma Kirana & General Store', items: [
    { productId: 'p1', storeId, productName: 'Toor Dal', productImageUrl: null, unit: '1 kg', unitPricePaise: 15500, quantity: 1 },
    { productId: 'p2', storeId, productName: 'Farm Eggs', productImageUrl: null, unit: '12 pcs', unitPricePaise: 8400, quantity: 2 },
  ] }));
}, { storeId });

await ctx.route('**/example.supabase.co/**', async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (url.pathname.includes('/rpc/get_nearby_stores')) return json(route, stores);
  if (url.pathname.endsWith('/product_categories')) return json(route, cats);
  if (url.pathname.endsWith('/products')) return json(route, products);
  if (url.pathname.includes('/auth/v1/')) return json(route, { error: 'no session' }, 401);
  return json(route, []);
});

const errors = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e)}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
const shot = async (name) => { await page.waitForTimeout(1800); await page.screenshot({ path: path.join(out, `${name}.png`) }); };
const step = async (name, fn) => { try { await fn(); } catch (e) { errors.push(`step ${name}: ${String(e).slice(0, 300)}`); } };

await page.goto('http://localhost:4174/');
await shot('c-home');
await step('open store', async () => { await page.getByText('Sharma Kirana & General Store').first().click({ timeout: 8000 }); await shot('c-store'); });
await step('add item', async () => { await page.getByLabel('Add Sunflower Oil to cart').click({ timeout: 5000 }); await shot('c-store-added'); });
await step('cart', async () => { await page.goto('http://localhost:4174/'); await page.waitForTimeout(1500); await page.getByText('View cart').first().click({ timeout: 8000 }); await shot('c-cart'); });
await step('orders tab', async () => { await page.goto('http://localhost:4174/'); await page.waitForTimeout(1500); await page.getByText('Order Again', { exact: true }).last().click({ timeout: 8000 }); await shot('c-orders-guest'); });
await step('categories tab', async () => { await page.goto('http://localhost:4174/'); await page.waitForTimeout(1500); await page.getByText('Categories', { exact: true }).last().click({ timeout: 8000 }); await shot('c-categories'); });
await step('profile tab', async () => { await page.getByText('Profile', { exact: true }).last().click({ timeout: 8000 }); await shot('c-profile-guest'); });
await step('checkout->login', async () => { await page.goto('http://localhost:4174/'); await page.waitForTimeout(1500); await page.getByText('View cart').first().click({ timeout: 8000 }); await page.waitForTimeout(800); await page.getByText('Continue to Checkout').first().click({ timeout: 5000 }); await shot('c-login'); });


// ---- Signed-in flow: checkout -> order tracking (all backend responses are SAMPLE data) ----
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const uid = '22222222-2222-4222-8222-222222222222';
const fakeJwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', aud: 'authenticated', exp: 4102444800 })}.sig`;
const user = { id: uid, aud: 'authenticated', role: 'authenticated', email: 'customer_919876543210@bever.app', app_metadata: {}, user_metadata: { phone: '+919876543210' }, created_at: '2026-10-01T00:00:00Z' };
const profile = { id: uid, role: 'customer', full_name: 'Test Customer', phone: '+919876543210', avatar_url: null, fcm_token: null, is_active: true, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const address = { id: '33333333-3333-4333-8333-333333333333', customer_id: uid, label: 'Home', address_line_1: 'Flat 12, Gulmandi Apartments', address_line_2: '2nd floor - near Ganesh temple', city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', pincode: '431001', location: null, is_default: true, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const orderId = '44444444-4444-4444-8444-444444444444';
const orderRow = { id: orderId, order_number: 'BVR-20261022-0007', status: 'PENDING', payment_method: 'COD', total_amount: 32300, items_total: 32300, delivery_fee: 0, discount_amount: 0, special_instructions: 'Please call at the gate.', delivered_at: null, delivery_otp: '4826', rejection_reason: null, cancellation_reason: null, created_at: new Date().toISOString(), estimated_delivery_at: null, delivery_address_snapshot: { label: 'Home', address_line_1: address.address_line_1, address_line_2: address.address_line_2, city: address.city, state: address.state, pincode: address.pincode }, delivery_failure_reason: null, stores: { name: 'Sharma Kirana & General Store' }, order_items: [{ quantity: 1 }, { quantity: 2 }] };
const orderItems = [
  { id: 'oi1', product_name_snapshot: 'Toor Dal', unit_price: 15500, quantity: 1, total_price: 15500, unit_snapshot: '1 kg' },
  { id: 'oi2', product_name_snapshot: 'Farm Eggs', unit_price: 8400, quantity: 2, total_price: 16800, unit_snapshot: '12 pcs' },
];

const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx2.addInitScript(({ storeId, fakeJwt, user }) => {
  localStorage.setItem('@bever/browsing_location', JSON.stringify({ lat: 19.8762, lng: 75.3433, label: 'Gulmandi', city: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', pincode: '431001', setAt: new Date().toISOString(), houseNo: '12', floor: '2' }));
  localStorage.setItem('@bever/cart', JSON.stringify({ storeId, storeName: 'Sharma Kirana & General Store', items: [
    { productId: 'p1', storeId, productName: 'Toor Dal', productImageUrl: null, unit: '1 kg', unitPricePaise: 15500, quantity: 1 },
    { productId: 'p2', storeId, productName: 'Farm Eggs', productImageUrl: null, unit: '12 pcs', unitPricePaise: 8400, quantity: 2 },
  ] }));
  localStorage.setItem('sb-example-auth-token', JSON.stringify({ access_token: fakeJwt, refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600000, expires_at: 4102444800, user }));
}, { storeId, fakeJwt, user });
await ctx2.route('**/example.supabase.co/**', async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
  const pick = (rows) => (single ? json(route, rows[0] ?? null, rows[0] ? 200 : 406) : json(route, rows));
  const p = url.pathname;
  if (p.includes('/auth/v1/user')) return json(route, user);
  if (p.includes('/auth/v1/')) return json(route, { error: 'unsupported in preview' }, 400);
  if (p.includes('/rpc/get_nearby_stores')) return json(route, stores);
  if (p.includes('/rpc/create_customer_order')) return json(route, [{ order_id: orderId, order_number: orderRow.order_number, items_total: 32300, delivery_fee: 0, total_amount: 32300 }]);
  if (p.endsWith('/profiles')) return pick([profile]);
  if (p.endsWith('/customer_addresses')) return req.method() === 'GET' ? pick([address]) : json(route, [address], 201);
  if (p.endsWith('/order_items')) return json(route, orderItems);
  if (p.endsWith('/orders')) return single ? json(route, orderRow) : json(route, [orderRow]);
  if (p.endsWith('/product_categories')) return json(route, cats);
  if (p.endsWith('/products')) return json(route, products);
  return json(route, []);
});
const page2 = await ctx2.newPage();
page2.on('pageerror', (e) => errors.push(`[signed-in] pageerror: ${String(e)}`));
page2.on('console', (m) => { if (m.type() === 'error' && !/WebSocket|realtime|ERR_/i.test(m.text())) errors.push(`[signed-in] console: ${m.text().slice(0, 300)}`); });
const shot2 = async (name) => { await page2.waitForTimeout(1800); await page2.screenshot({ path: path.join(out, `${name}.png`) }); };
const step2 = async (name, fn) => { try { await fn(); } catch (e) { errors.push(`[signed-in] step ${name}: ${String(e).slice(0, 300)}`); } };
await page2.goto('http://localhost:4174/');
await shot2('s-home');
await step2('checkout', async () => { await page2.getByText('View cart').first().click({ timeout: 8000 }); await page2.waitForTimeout(800); await page2.getByText('Continue to Checkout').first().click({ timeout: 5000 }); await shot2('s-checkout'); });
await step2('place order', async () => { await page2.getByText('Place order', { exact: true }).first().click({ timeout: 5000 }); await shot2('s-order-detail'); });
await step2('orders tab', async () => { await page2.goto('http://localhost:4174/'); await page2.waitForTimeout(1200); await page2.getByText('Order Again', { exact: true }).last().click({ timeout: 8000 }); await shot2('s-orders'); });
await step2('profile tab', async () => { await page2.getByText('Profile', { exact: true }).last().click({ timeout: 8000 }); await shot2('s-profile'); });

fs.writeFileSync(path.join(out, 'customer-errors.txt'), errors.join('\n'));
await browser.close();
server.close();
