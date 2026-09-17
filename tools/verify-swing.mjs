// Mallet physics swing + hoop carry rule, in Chrome and Firefox (Playwright).
// Usage: PW_DIR=<dir with node_modules/playwright> node tools/verify-swing.mjs [chrome|firefox|both] [baseUrl]
// baseUrl defaults to a local server over this checkout; pass https://tront.xyz/buddy/ to test the live site.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require = createRequire(process.env.PW_DIR ? path.join(process.env.PW_DIR, 'package.json') : import.meta.url);
const {chromium, firefox} = require('playwright');
const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'tools', 'out'); fs.mkdirSync(out, {recursive: true});
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0].split('#')[0], p = path.join(root, u === '/' ? 'index.html' : u);
  try { res.writeHead(200, {'content-type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream'}); res.end(fs.readFileSync(p)); } catch { res.writeHead(404); res.end(); }
}).listen(8097);
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run(name) {
  const bt = name === 'firefox' ? firefox : chromium;
  const browser = await bt.launch(name === 'firefox' ? {} : {channel: 'chrome'});
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '?test=1#room=SW' + Math.random().toString(36).slice(2, 6));
  await sleep(2500);
  const W = () => page.evaluate(() => { const w = __buddy.test.world(); const h = w.hands.get(__buddy.id); const n0 = w.node(0); return {vx: n0.vx, vy: n0.vy, x: n0.x, y: n0.y, swungAt: n0.swungAt ?? null, mallet: !!h.mallet, sv: Math.hypot(h.svx, h.svy) | 0, score: w.score, time: w.time, cash: w.cash}; });
  const inp = (x, y, down, tool = 'poke') => page.evaluate(([x, y, down, tool]) => __buddy.input({x, y, down, tool}), [x, y, down, tool]);
  await page.evaluate(() => __buddy.setTool('poke'));
  const head = await W();
  console.log(`${name}: head at ${head.x | 0},${head.y | 0}`);

  // 1. Slow crawl through the head: no swing hit.
  for (let i = 0; i <= 40; i++) { await inp(head.x - 120 + i * 6, head.y - 30, false); await sleep(30); }
  const slow = await W();
  check(slow.swungAt === null, `${name}: slow crawl through head does not hit (glove speed ${slow.sv} px/s)`);

  // 2. Whip through the head: hit, velocity spike.
  // Walk to the start slowly (a jump across the head would itself be a swing, and jumps are ignored anyway).
  for (let i = 0; i <= 20; i++) { await inp(head.x + 120 - i * 17, head.y - 90, false); await sleep(40); }
  // A real teleport straight across the head (pointer re-entering the canvas elsewhere) must not hit.
  await inp(head.x - 220, head.y - 30, false); await sleep(120);
  await inp(head.x + 200, head.y - 20, false); await sleep(120);
  await inp(head.x - 220, head.y - 30, false); await sleep(250);
  const before = await W();
  check(before.swungAt === null, `${name}: teleporting the glove across the head does not hit (glove ${before.sv} px/s)`);
  let mid = null;
  for (let i = 1; i <= 8; i++) { await inp(head.x - 220 + i * 60, head.y - 30 + i * 4, false); if (i === 5) mid = page.screenshot({path: path.join(out, `swing-${name}.png`)}); await sleep(8); }
  await mid; await sleep(60);
  const after = await W();
  check(after.swungAt !== null && after.swungAt > before.time, `${name}: fast whip hits (glove ${after.sv} px/s, swungAt ${after.swungAt?.toFixed(2)})`);
  check(Math.hypot(after.vx, after.vy) > 250, `${name}: head velocity after whip ${Math.hypot(after.vx, after.vy) | 0} px/s`);
  check(!after.mallet, `${name}: whip did not plant a canned swing`);
  await sleep(900);

  // 3. Stationary click: canned tap still starts.
  const h2 = await W();
  await inp(h2.x + 30, h2.y - 40, false); await sleep(200);
  await inp(h2.x + 30, h2.y - 40, true); await sleep(40);
  const tap = await W();
  check(tap.mallet, `${name}: stationary click plants the canned tap swing`);
  await inp(h2.x + 30, h2.y - 40, false); await sleep(600);

  // 4. Hoop: legit drop scores.
  const s0 = (await W()).score;
  await page.evaluate(() => __buddy.test.placeBall(1100, 250, 0, 120));
  await sleep(1200);
  const s1 = (await W()).score;
  check(s1 === s0 + 1, `${name}: dropped ball scores (${s0} -> ${s1})`);

  // 5. Hoop: a carried ball wiggled through the rim does not score.
  const id = await page.evaluate(() => __buddy.test.placeBall(900, 420, 0, 0));
  await sleep(1500); // it settles on the floor; the 1.3s cooldown clears
  const s2 = (await W()).score;
  const ball = await page.evaluate(id => { const n = __buddy.test.world().node(id); return {x: n.x, y: n.y}; }, id);
  await inp(ball.x, ball.y, false, 'grab'); await sleep(60);
  await inp(ball.x, ball.y, true, 'grab'); await sleep(60);
  const gripped = await page.evaluate(() => { const h = __buddy.test.world().hands.get(__buddy.id); return h.grip && h.grip.a; });
  check(gripped === id, `${name}: harness gripped the placed ball (grip ${gripped}, ball ${id})`);
  // Carry it up to the hoop.
  for (let i = 1; i <= 24; i++) { await inp(ball.x + (1100 - ball.x) * i / 24, ball.y + (300 - ball.y) * i / 24, true, 'grab'); await sleep(16); }
  await sleep(1400);
  for (let k = 0; k < 4; k++) { for (let i = 0; i <= 10; i++) { await inp(1100, 300 + i * 6, true, 'grab'); await sleep(16); } for (let i = 10; i >= 0; i--) { await inp(1100, 300 + i * 6, true, 'grab'); await sleep(16); } await sleep(1400); }
  const s3 = (await W()).score;
  check(s3 === s2, `${name}: carried ball wiggled through rim 4x over 6s did not score (${s2} -> ${s3})`);
  // Let go above the rim: it falls through and scores like a dunk.
  await inp(1100, 290, true, 'grab'); await sleep(30); await inp(1100, 290, false, 'grab'); await sleep(1300);
  const s4 = (await W()).score;
  check(s4 === s3 + 1, `${name}: releasing above the rim still scores (${s3} -> ${s4})`);
  check(errors.length === 0, `${name}: no page errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ''}`);
  await page.screenshot({path: path.join(out, `swing-end-${name}.png`)});
  browser.close().catch(() => {});
}
const which = process.argv[2] || 'both', base = process.argv[3] || 'http://127.0.0.1:8097/';
console.log('target', base);
for (const b of which === 'both' ? ['chrome', 'firefox'] : [which]) { try { await run(b); } catch (e) { check(false, b + ': ' + e.message); } }
server.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
