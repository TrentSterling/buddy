// Stage a beating and capture 1200x630 OG candidates into tools/out/og-*.png, Buddy centered and airborne.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {launch, sleep} from './cdp.mjs';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, {'content-type': 'text/html'}); res.end(fs.readFileSync(path.join(root, 'index.html'))); }).listen(0);
const out = path.join(root, 'tools', 'out'); fs.mkdirSync(out, {recursive: true});
const P = await launch({port: 9451, width: 1200, height: 720});
const url = `http://127.0.0.1:${server.address().port}/#room=OGSHOT`;
await P.goto(url); await sleep(3500);
await P.eval("for(const s of ['.gamebar','.playdock','.showui','.makercredit','.toast'])document.querySelectorAll(s).forEach(e=>e.style.visibility='hidden')");
await P.eval("document.getElementById('modeBtn').click();document.getElementById('shopDialog').close()"); // sandbox: every tool open
const head = () => P.eval('__buddy.state.n[0].slice(1,3)');
const torso = () => P.eval('__buddy.state.n[2].slice(1,3)');
const use = async (tool, n, gap = 140) => { for (let i = 0; i < n; i++) { const s = await torso(); await P.eval(`__buddy.setTool('${tool}');__buddy.input({x:${s[0] + (i % 2 ? 60 : -60)},y:${s[1] - 40},down:true,tool:'${tool}'})`); await sleep(40); await P.eval(`__buddy.input({x:${s[0]},y:${s[1]},down:false,tool:'${tool}'})`); await sleep(gap); } };
const grabThrow = async (dx, dy, steps = 10) => { const s = await head(); await P.eval(`__buddy.setTool('grab');__buddy.input({x:${s[0]},y:${s[1]},down:true,tool:'grab'})`); await sleep(40); for (let k = 1; k <= steps; k++) { await P.eval(`__buddy.input({x:${s[0] + dx * k / steps},y:${s[1] + dy * k / steps},down:true,tool:'grab'})`); await sleep(16); } await P.eval(`__buddy.input({x:${s[0] + dx},y:${s[1] + dy},down:false,tool:'grab'})`); };
// The beating.
for (const [tool, n] of [['poke', 6], ['revolver', 6], ['shotgun', 4], ['blaster', 5], ['bomb', 2], ['poke', 6]]) { await use(tool, n); await sleep(500); }
for (let i = 0; i < 6; i++) { await grabThrow(i % 2 ? 420 : -420, -340); await sleep(900); }
await P.eval("document.querySelectorAll('.toast').forEach(e=>e.style.visibility='hidden')");
// Throws aimed at the middle, snap when the head is centered and airborne.
let n = 0;
for (let i = 0; i < 40 && n < 10; i++) {
  const s = await head(); const dx = 640 - s[0], dir = Math.sign(dx) || 1;
  await grabThrow(dir * 300 + dx * 0.4, -360, 8);
  for (let t = 0; t < 40; t++) { const h = await head(); if (h[0] > 470 && h[0] < 810 && h[1] > 160 && h[1] < 420) { await P.shot(path.join(out, `og-${n++}.png`)); break; } await sleep(30); }
  await sleep(700);
}
console.log('frames', n, 'logs', P.logs.filter(l => /EXCEPTION/.test(l)));
P.kill(); server.close(); process.exit(0);
