// Two real Chromes, real Trystero discovery over the internet, bare link only (no #room).
// Checks: auto lobby forms 1 host + 1 guest; late guest sees motion; host death re-hosts.
// Usage: node tools/verify-lobby.mjs [baseUrl]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {launch, sleep, until} from './cdp.mjs';

const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req, res) => {
  const p = path.join(root, req.url.split('?')[0].split('#')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  try { res.writeHead(200, {'content-type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream'}); res.end(fs.readFileSync(p)); } catch { res.writeHead(404); res.end(); }
}).listen(8090);
const base = process.argv[2] || 'http://127.0.0.1:8090/';
const out = path.join(root, 'tools', 'out'); fs.mkdirSync(out, {recursive: true});
const state = p => p.eval(`(!window.__buddy?{}:{role:__buddy.role,id:__buddy.id,host:__buddy.hostId,room:__buddy.room,connected:__buddy.connected,peers:window.__peers,hash:location.hash,n:__buddy.renderState&&__buddy.renderState.n.slice(0,13).map(n=>[n[1]|0,n[2]|0])})`);
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const A = await launch({port: 9411, width: 1280, height: 800});
await A.goto(base + '?test=1');
await sleep(4000);
let a = await state(A);
// A real player may already be hosting the public lobby; joining them as a guest is the same success.
check(a.room === 'LOBBY' && a.hash === '' && (a.role === 'host' || a.connected), `A lands in LOBBY with bare URL as ${a.role}${a.role === 'guest' ? ' (someone was already hosting)' : ''} (hash='${a.hash}')`);

// Host makes a mess so a late joiner has motion to see.
await A.front();
const drag = async (P, x0, y0, x1, y1, steps = 14) => { await P.mouse('mousePressed', x0, y0); for (let i = 1; i <= steps; i++) { await P.mouse('mouseMoved', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await sleep(16); } await P.mouse('mouseReleased', x1, y1); };
const shake = async (P, n = 6) => { for (let i = 0; i < n; i++) { await drag(P, 640 + (i % 2 ? 200 : -200), 380, 640 - (i % 2 ? 200 : -200), 200 + i * 20); await sleep(120); } };
await shake(A);
console.log('A logs:', A.logs.slice(0, 8));

const B = await launch({port: 9412, width: 1280, height: 800});
await B.goto(base + '?test=1');
const t0 = Date.now();
let pair;
try {
  pair = await until(async () => { const [x, y] = [await state(A), await state(B)]; const ok = x.host === y.host && ((x.role === 'host' && y.connected) || (y.role === 'host' && x.connected)); return ok && {x, y}; }, {timeout: 60000, label: 'lobby pairing'});
  check(true, `auto lobby paired in ${((Date.now() - t0) / 1000).toFixed(1)}s: A=${pair.x.role} B=${pair.y.role}`);
} catch (e) { check(false, 'auto lobby pairing: ' + e.message); console.log(await state(A), await state(B)); console.log('B logs', B.logs.slice(-10)); }

if (pair) {
  // Roles can still flip for a moment after both report connected (tie-break). Settle on distinct roles.
  const roles = await until(async () => { const [x, y] = [await state(A), await state(B)]; return x.role !== y.role && x.connected && y.connected && {x, y}; }, {timeout: 20000, label: 'distinct roles'});
  const host = roles.x.role === 'host' ? A : B, guest = host === A ? B : A;
  console.log('settled: host is', host === A ? 'A' : 'B');
  // Stir the ragdoll through the game input API: grab the head node where it actually is and yank it.
  const stir = async (P, n = 6) => { for (let i = 0; i < n; i++) { const s = await P.eval('__buddy.state.n[0].slice(1,3)'); await P.eval(`__buddy.input({x:${s[0]},y:${s[1]},down:true})`); for (let k = 1; k <= 10; k++) { await P.eval(`__buddy.input({x:${s[0] + (i % 2 ? 1 : -1) * 45 * k},y:${Math.max(120, s[1] - 30 * k)},down:true})`); await sleep(16); } await P.eval('__buddy.input({x:640,y:160,down:false})'); await sleep(200); } };
  await stir(host, 6);
  const s1 = (await state(guest)).n; await stir(host, 3); const s2 = (await state(guest)).n;
  const moved = s1.reduce((m, p, i) => Math.max(m, Math.abs(p[0] - s2[i][0]) + Math.abs(p[1] - s2[i][1])), 0);
  check(moved > 20, `late joiner sees host-driven ragdoll motion (max node delta ${moved}px)`);
  // Passive guest over a longer window: keep stirring on the host, guest never touches.
  const seq = []; for (let i = 0; i < 5; i++) { await stir(host, 1); seq.push((await state(guest)).n[0]); }
  const spread = Math.max(...seq.map(p => p[0])) - Math.min(...seq.map(p => p[0])) + Math.max(...seq.map(p => p[1])) - Math.min(...seq.map(p => p[1]));
  check(spread > 40, `guest keeps receiving motion without touching (head spread ${spread}px over 5 samples)`);
  const gs = await guest.eval('({rs:__buddy.stats.receivedSnapshots,rej:__buddy.stats.rejectedSnapshots,inv:__buddy.stats.invalidPackets,rp:__buddy.stats.remotePaused,fps:__buddy.stats.fps|0})');
  console.log('guest snapshot stats:', JSON.stringify(gs));
  await host.shot(path.join(out, 'host.png')); await guest.shot(path.join(out, 'guest.png'));

  // Host death: guest should re-host within ~15s.
  const guestId = (await state(guest)).id;
  host.kill();
  try {
    const t1 = Date.now();
    const st = await until(async () => { const s = await state(guest); return s.role === 'host' && s.host === guestId && s; }, {timeout: 30000, label: 'guest re-host'});
    check(true, `guest re-hosted ${((Date.now() - t1) / 1000).toFixed(1)}s after host died (hash='${st.hash}')`);
  } catch (e) { check(false, 'guest re-host: ' + e.message); console.log(await state(guest)); }
  console.log('guest logs:', guest.logs.filter(l => /EXCEPTION|error/i.test(l)).slice(0, 10));
  guest.kill();
} else { A.kill(); B.kill(); }
server.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL GREEN');
process.exit(fails ? 1 : 0);
