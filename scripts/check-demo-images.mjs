// Verifies every http image URL used by the demo seed returns an image. Prints failures.
import fs from 'node:fs';
const sql = fs.readFileSync('packages/supabase/migrations/034_demo_stores_v2.sql', 'utf8');
const urls = [...new Set(sql.match(/https:\/\/(?:www\.themealdb\.com|images\.unsplash\.com)[^"\\\s$]+/g) ?? [])];
let bad = 0;
for (const u of urls) {
  try {
    const r = await fetch(u, { method: 'GET', redirect: 'follow' });
    const ok = r.ok && (r.headers.get('content-type') ?? '').startsWith('image/');
    if (!ok) bad++;
    console.log(ok ? 'OK  ' : 'FAIL', r.status, u);
  } catch (e) { bad++; console.log('FAIL', 'ERR', u, String(e)); }
}
console.log(`checked ${urls.length}, failed ${bad}`);
