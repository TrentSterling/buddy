// First-run welcome dialog screenshots at desktop and phone widths, plus a face close-up.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {launch, sleep} from './cdp.mjs';
const root = path.resolve(import.meta.dirname, '..');
const server = http.createServer((req, res) => { res.writeHead(200, {'content-type': 'text/html'}); res.end(fs.readFileSync(path.join(root, 'index.html'))); }).listen(0);
const out = path.join(root, 'tools', 'out');
for (const [w, h, name] of [[1280, 800, 'about-desktop'], [390, 780, 'about-phone']]) {
  const P = await launch({port: 9461 + w % 7, width: w, height: h});
  await P.goto(`http://127.0.0.1:${server.address().port}/#room=ABOUTSHOT`); await sleep(3500);
  const open = await P.eval("document.getElementById('creditsDialog').open");
  const errs = P.logs.filter(l => /EXCEPTION/.test(l));
  console.log(name, 'dialog open on first run:', open, 'errors:', errs);
  await P.shot(path.join(out, name + '.png'));
  if (w > 1000) {
    await P.eval("document.getElementById('creditsDialog').close()"); await sleep(300);
    console.log('welcomed flag:', await P.eval("localStorage.getItem('buddybay-welcomed')"));
    // Click empty space repeatedly: Buddy must stay standing.
    const before = await P.eval('__buddy.state.n[0][2]');
    for (let i = 0; i < 6; i++) { await P.eval('__buddy.input({x:200,y:200,down:true})'); await sleep(80); await P.eval('__buddy.input({x:200,y:200,down:false})'); await sleep(400); }
    await sleep(2500);
    const after = await P.eval('__buddy.state.n[0][2]');
    console.log('head y before empty clicks', before | 0, 'after', after | 0, (after - before < 40) ? 'STANDING' : 'COLLAPSED');
    await P.eval("for(const s of ['.gamebar','.playdock'])document.querySelectorAll(s).forEach(e=>e.style.visibility='hidden')");
    await P.shot(path.join(out, 'face.png'));
  }
  P.kill();
}
server.close(); process.exit(0);
