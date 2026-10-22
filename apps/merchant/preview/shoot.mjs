// CI-only: screenshots the preview build. Usage: node shoot.mjs <distDir> <outDir>
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
  const f = path.join(dist, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(4173);

const views = ['orders', 'detail', 'catalogue', 'store', 'login', 'empty', 'reject', 'price', 'add'];
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
for (const v of views) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:4173/#${v}`);
  await page.reload();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `${v}.png`) });
  if (errors.length) fs.appendFileSync(path.join(out, 'errors.txt'), `${v}: ${errors.join(' | ')}\n`);
  await page.close();
}
await browser.close();
server.close();
