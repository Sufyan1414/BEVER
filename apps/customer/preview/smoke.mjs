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
await step('add item', async () => { await page.getByText('Add', { exact: true }).first().click({ timeout: 5000 }); await shot('c-store-added'); });
await step('cart', async () => { await page.goto('http://localhost:4174/'); await page.waitForTimeout(1500); await page.getByText('Cart', { exact: true }).last().click({ timeout: 8000 }); await shot('c-cart'); });
await step('checkout->login', async () => { await page.getByText('Continue to Checkout').first().click({ timeout: 5000 }); await shot('c-login'); });

fs.writeFileSync(path.join(out, 'customer-errors.txt'), errors.join('\n'));
await browser.close();
server.close();
