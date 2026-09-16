// Stage a playtest and capture 1200x630 OG candidates into tools/out/og-*.png
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {launch, sleep} from './cdp.mjs';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, {'content-type': 'text/html'}); res.end(fs.readFileSync(path.join(root, 'index.html'))); }).listen(0);
const out = path.join(root, 'tools', 'out'); fs.mkdirSync(out, {recursive: true});
const P = await launch({port: 9451, width: 1200, height: 720});
await P.goto(`http://127.0.0.1:${server.address().port}/#room=OGSHOT`); await sleep(2500); await P.eval("localStorage.setItem('buddybay-blood','0')"); await P.goto(`http://127.0.0.1:${server.address().port}/#room=OGSHOT`); // pinned room so no lobby peers wander in
await sleep(3500);
await P.eval("for(const s of ['.gamebar','.playdock','.showui','.makercredit'])document.querySelectorAll(s).forEach(e=>e.style.visibility='hidden')");
const head = () => P.eval('__buddy.state.n[0].slice(1,3)');
const grabThrow = async (dx, dy, steps = 12) => { const s = await head(); await P.eval(`__buddy.input({x:${s[0]},y:${s[1]},down:true})`); await sleep(40); for (let k = 1; k <= steps; k++) { await P.eval(`__buddy.input({x:${s[0] + dx * k / steps},y:${s[1] + dy * k / steps},down:true})`); await sleep(16); } await P.eval(`__buddy.input({x:${s[0] + dx},y:${s[1] + dy},down:false})`); };
// Warm up: a few throws so the room looks lived in.
for (let i = 0; i < 4; i++) { await grabThrow(i % 2 ? 380 : -380, -320); await sleep(700); }
let n = 0;
for (let i = 0; i < 12; i++) {
  await grabThrow(i % 2 ? 420 : -420, -360, 10);
  await sleep(90 + i * 25);
  await P.shot(path.join(out, `og-${n++}.png`));
  await sleep(900);
}
console.log('frames', n, 'logs', P.logs.filter(l => /EXCEPTION/.test(l)));
P.kill(); server.close(); process.exit(0);
