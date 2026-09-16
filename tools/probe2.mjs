import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {launch, sleep, until} from './cdp.mjs';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, {'content-type': 'text/html'}); res.end(fs.readFileSync(path.join(root, 'index.html'))); }).listen(0);
const base = `http://127.0.0.1:${server.address().port}/?test=1`;
const st = p => p.eval(`(!window.__buddy?{}:{role:__buddy.role,connected:__buddy.connected})`);
const A = await launch({port: 9441}); await A.goto(base); await sleep(3500);
const B = await launch({port: 9442}); await B.goto(base);
await until(async () => (await st(A)).connected && (await st(B)).connected, {timeout: 60000, label: 'pair'});
const host = (await st(A)).role === 'host' ? A : B, guest = host === A ? B : A;
// Instrument host send path.
await host.eval(`(()=>{const n=__buddy.test.net;window.__snd={calls:0,ok:0,fast:0,busyDrop:0,noRoute:0,kinds:{}};const o=n.send.bind(n);n.send=(id,k,d,fast)=>{__snd.calls++;if(fast)__snd.fast++;__snd.kinds[k]=(__snd.kinds[k]||0)+1;const r=o(id,k,d,fast);if(r)__snd.ok++;else if(fast&&n.onlineBusy.has(id))__snd.busyDrop++;else __snd.noRoute++;return r;};})()`);
await guest.eval(`(()=>{window.__rcv={snap:0,bin:0,json:0,kinds:{}};const n=__buddy.test.net;const o=n.onData;n.onData=(id,k,d)=>{__rcv.kinds[k]=(__rcv.kinds[k]||0)+1;return o(id,k,d);};})()`);
for (let i = 0; i < 6; i++) {
  await host.eval(`__buddy.input({x:${600 + i * 30},y:${300 + (i % 2) * 80},down:${i % 2 === 0}})`);
  await sleep(500);
  const h = await host.eval('({snd:__snd,peers:__buddy.test.net.peers().length,busy:[...__buddy.test.net.onlineBusy],err:__buddy.test.net.publicError,hz:__buddy.stats.snapshotHz,bytes:__buddy.stats.snapBytes})');
  const g = await guest.eval('({rcv:__rcv,rs:__buddy.stats.receivedSnapshots,rej:__buddy.stats.rejectedSnapshots,inv:__buddy.stats.invalidPackets,q:__buddy.state.q,t:__buddy.state.t,err:__buddy.test.net.publicError})');
  console.log(JSON.stringify(h)); console.log('   ', JSON.stringify(g));
}
A.kill(); B.kill(); process.exit(0);
