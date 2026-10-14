'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repos='voxelheroes biomass fellswoop inkride senddudes buddy vixels ballpit threejs-volumetric-beam vibesand vibewater vibeduders vibevoxelprobes vibestar vibebounce vibecar wolfenstein sudoku pachinko vibepong critters orcflow'.split(' ');
const out='.about-live-evidence';fs.mkdirSync(out,{recursive:true});
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),report=[];
(async()=>{const browser=await chromium.launch({channel:'chrome',args:['--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const repo of repos){const row={repo,url:'https://tront.xyz/'+repo+'/',status:'running'};report.push(row);
let context;try{let html;for(let attempt=0;attempt<1;attempt++){const response=await fetch(row.url+'?three-card-check='+Date.now(),{signal:AbortSignal.timeout(30000)});assert.ok(response.ok);html=(await response.text()).replace(/\r\n/g,'\n');if(html.includes('fcda637550b9237140c89f9e42465ddd1cb07bf0'))break;await new Promise(r=>setTimeout(r,15000));}
row.htmlSha256=sha(html);assert.ok(html.includes('fcda637550b9237140c89f9e42465ddd1cb07bf0'),'shared pin served: '+html.slice(0,500));
for(const type of (repo==='voxelheroes'?['js']:['css','js'])){const match=html.match(new RegExp('<'+(type==='css'?'style':'script')+' data-tront-discovery-'+type+'>\\n([\\s\\S]*?)<\\/'));assert.ok(match,'inline '+type+' '+html.slice(html.indexOf('tront-about:start'),html.indexOf('tront-about:start')+400));row[type+'Sha256']=sha(match[1]);assert.equal(row[type+'Sha256'],type==='css'?'70723556209736cc1d9e8dff2aa2fb5e68157d6ab0de2983406376baad85a8d0':'cb5935a8e19c692c26fb8df302396138393528b0272d4cf00d72a906019248f0');}
context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});const page=await context.newPage();
await page.goto(row.url+'?three-card-render='+Date.now(),{waitUntil:'domcontentloaded',timeout:90000});await page.waitForSelector('#trontAbout',{state:'attached'});if(repo==='buddy'){await page.locator('#creditsDialog[open]').waitFor({state:'visible',timeout:30000});await page.locator('#closeCredits').click();await page.waitForFunction(()=>!document.getElementById('creditsDialog').open);}
await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.getElementById('trontAbout').open=true;});
await page.waitForFunction(()=>document.querySelectorAll('#trontAbout [data-tront-discovery-game]').length===3,null,{timeout:30000});
row.cards=await page.locator('#trontAbout [data-tront-discovery-game]').evaluateAll(es=>es.map(e=>e.dataset.trontDiscoveryGame));assert.ok(row.cards.includes('craftmine')&&row.cards.includes('smear'));assert.ok(!row.cards.includes(repo));
row.domJsSha256=sha(await page.locator('script[data-tront-discovery-js]').textContent().then(s=>s.replace(/^\n/,'')));assert.equal(row.domJsSha256,row.jsSha256);
await page.locator('#trontAbout .tront-about-panel').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(500);try{await page.screenshot({path:out+'/'+repo+'.png',timeout:5000});}catch(e){row.screenshotWarning=e.message;}
if(repo==='buddy'){await page.setViewportSize({width:320,height:568});await page.evaluate(()=>document.getElementById('trontAbout').open=false);await page.waitForTimeout(100);row.bounds=await page.evaluate(()=>{const r=s=>document.querySelector(s).getBoundingClientRect().toJSON();return {about:r('#trontAbout>summary'),dock:r('#playDock')};});const {about:a,dock:d}=row.bounds;assert.ok(a.bottom<=d.top||a.right<=d.left||a.left>=d.right);await page.locator('#shopBtn').click();assert.ok(await page.locator('#shopDialog').evaluate(e=>e.open));await page.locator('#closeShop').click();await page.screenshot({path:out+'/buddy-320.png'});}
await context.close();row.status='passed';console.log('PASS '+repo+' '+JSON.stringify(row));}catch(e){row.status='failed';row.error=e.stack;console.error('FAIL '+repo,e);}finally{if(context)await context.close();}
fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}
assert.equal(report.filter(r=>r.status!=='passed').length,0,'all 22 public pages pass');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
