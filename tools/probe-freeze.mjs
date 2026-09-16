// Diagnose late-joiner stillness: host stirs via __buddy.input, guest samples snapshot flow.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {launch, sleep, until} from './cdp.mjs';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, {'content-type': 'text/html'}); res.end(fs.readFileSync(path.join(root, 'index.html'))); }).listen(0);
const port = server.address().port;
const base = `http://127.0.0.1:${port}/?test=1`;
const st = p => p.eval(`(!window.__buddy?{}:{role:__buddy.role,connected:__buddy.connected,rs:__buddy.stats.receivedSnapshots,rtt:__buddy.stats.rtt,net:{tx:__buddy.stats.net.tx,rx:__buddy.stats.net.rx,drops:__buddy.stats.net.drops,routes:__buddy.stats.net.routes,busy:[...( __buddy.test.net.onlineBusy||[])]},hz:__buddy.stats.snapshotHz,bytes:__buddy.stats.snapBytes,t:__buddy.renderState.t,head:[__buddy.renderState.n[0][1]|0,__buddy.renderState.n[0][2]|0],paused:__buddy.stats.paused,rp:__buddy.stats.remotePaused})`);
const A = await launch({port: 9421}); await A.goto(base); await sleep(3500);
const B = await launch({port: 9422}); await B.goto(base);
try{await until(async () => (await st(A)).connected && (await st(B)).connected, {timeout: 60000, label: 'pair'});}catch(e){console.log('PAIR TIMEOUT',await st(A),await st(B),A.logs.slice(-5),B.logs.slice(-5));A.kill();B.kill();process.exit(1);}
const host = (await st(A)).role === 'host' ? A : B, guest = host === A ? B : A;
console.log('host is', host === A ? 'A' : 'B');
// Stir with the API: grab the head node and yank it around.
const stir = async () => { for (let i = 0; i < 6; i++) { const s = await host.eval('__buddy.state.n[0].slice(1,3)'); await host.eval(`__buddy.input({x:${s[0]},y:${s[1]},down:true})`); for (let k = 1; k <= 8; k++) { await host.eval(`__buddy.input({x:${s[0] + (i % 2 ? 1 : -1) * 40 * k},y:${s[1] - 25 * k},down:true})`); await sleep(20); } await host.eval('__buddy.input({x:640,y:200,down:false})'); await sleep(150); } };
for (let round = 0; round < 4; round++) {
  await stir();
  const h = await st(host), g = await st(guest);
  console.log(`round ${round} host t=${h.t} head=${h.head} hz=${h.hz?.toFixed(1)} bytes=${h.bytes} drops=${h.net.drops} busy=${h.net.busy.length} routes=${JSON.stringify(h.net.routes)}`);
  console.log(`        guest t=${g.t} head=${g.head} rs=${g.rs} rx=${g.net.rx} rtt=${g.rtt|0} rp=${g.rp}`);
  await sleep(800);
}
console.log('host logs', host.logs.slice(-6)); console.log('guest logs', guest.logs.slice(-6));
A.kill(); B.kill(); process.exit(0);
