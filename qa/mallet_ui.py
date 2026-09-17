import asyncio,json,traceback
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence';checks=[];errors=[]
def check(n,p,d=None): checks.append({'name':n,'pass':bool(p),'details':d});print('PASS' if p else 'FAIL',n,d or '',flush=True)
async def setup(page):
 await page.evaluate('''()=>{window.__BB_TEST_QUERY='local=1&test=1';window.timers=[];const si=setInterval;window.setInterval=(...a)=>{const id=si(...a);timers.push(id);return id}}''')
 await page.set_content((ROOT/'index.html').read_text(),wait_until='load');await page.wait_for_function('!!__buddy');await page.evaluate('timers.forEach(clearInterval);window.requestAnimationFrame=()=>0;__buddy.test.freeze(false)');await asyncio.sleep(.08)
 await page.evaluate('''()=>{window.advance=n=>{const b=__buddy,w=b.test.world(),r=b.test.renderer;for(let i=0;i<n;i++){w.step(1/120);r.last=performance.now()-1000/120;r.draw(w.snapshot(),b.hand,b.hostId,true)}}}''')
async def reset(page):
 await page.mouse.up();await page.evaluate('''()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();document.getElementById('chatwrap').hidden=true;__buddy.setTool('poke');const w=__buddy.test.world();w.reset();w.time=5;w.tick=600;w.lastTouch=5;window.ev=[];const r=__buddy.test.renderer;r.resetEffects();w.onEvent=e=>{ev.push({...e,tick:w.tick});r.event(e)};r.motion=false;r.draw(w.snapshot(),__buddy.hand,__buddy.hostId,true)}''')
 point=await page.evaluate('__buddy.screen(640,309)');await page.mouse.move(**point);return point
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=await browser.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)));page.set_default_timeout(8000)
  try:
   await setup(page)
   await reset(page);await page.mouse.down();await page.mouse.up();await page.evaluate('advance(24)')
   check('Real mouse quick tap commits exactly one mallet hit',await page.evaluate('ev.filter(e=>e.type==="poke").length===1'))
   check('System cursor remains visible and is never captured',await page.evaluate('__buddy.pointer.cursor!=="none"&&!__buddy.pointer.capture'))
   for name,action in [('Escape','escape'),('Menu crossing','menu'),('Canvas exit','exit'),('Window blur','blur'),('Tool shortcut','switch')]:
    pt=await reset(page);await page.mouse.down();await page.evaluate('advance(6)')
    if action=='escape':await page.keyboard.press('Escape')
    if action=='menu':
     r=await page.locator('#settingsBtn').bounding_box();await page.mouse.move(r['x']+5,r['y']+5)
    if action=='exit':await page.mouse.move(1,1)
    if action=='blur':await page.evaluate('window.dispatchEvent(new Event("blur"))')
    if action=='switch':await page.keyboard.press('1')
    await page.mouse.up();await page.evaluate('advance(30)')
    check(name+' cancels wind-up without a late hit',await page.evaluate('ev.some(e=>e.type==="swingCancel")&&!ev.some(e=>e.type==="poke"||e.type==="hurt")'))
    check(name+' leaves no active grab or hidden cursor',await page.evaluate('!__buddy.hand.down&&!__buddy.pointer.capture'))
   await reset(page);await page.mouse.down(button='right');await page.evaluate('advance(2)')
   check('Right-drag still grabs with the mallet equipped',await page.evaluate('__buddy.hand.tool==="grab"&&__buddy.test.world().hands.get(__buddy.id).grip!==null'))
   await page.mouse.up(button='right');check('Right release restores mallet without swinging it',await page.evaluate('__buddy.hand.tool==="poke"&&!ev.some(e=>e.type==="swing")'))
   await reset(page);await page.locator('#settingsBtn').click();
   if await page.evaluate('__buddy.pointer.mode')!='game':await page.locator('#cursorBtn').click()
   await page.keyboard.press('Escape');await page.wait_for_function('!document.querySelector("dialog[open]")');pt=await page.evaluate('__buddy.screen(640,309)');await page.mouse.move(**pt)
   await asyncio.sleep(.06)
   check('Optional game cursor hides only over the actual playfield',await page.evaluate('__buddy.pointer.cursor==="none"'),await page.evaluate('p=>({pointer:__buddy.pointer,element:document.elementFromPoint(p.x,p.y)?.id,modal:!!document.querySelector("dialog[open]")})',pt))
   r=await page.locator('#shopBtn').bounding_box();await page.mouse.move(r['x']+10,r['y']+10)
   check('Hovering Shop immediately restores OS cursor',await page.evaluate('__buddy.pointer.cursor!=="none"&&!__buddy.pointer.inside'))
   await page.locator('#toolsBtn').click();check('On-demand weapon drawer still opens',await page.locator('#shopDialog').is_visible())
   await page.locator('[data-item="tool:poke"]').click();check('Selecting mallet closes drawer',not await page.locator('#shopDialog').is_visible())
   await page.locator('#hideUIBtn').click();check('Quiet UI keeps its Show controls escape hatch',await page.locator('#showUIBtn').is_visible())
   await page.locator('#showUIBtn').click();await reset(page);await page.mouse.down();await page.evaluate('advance(22)');await page.screenshot(path=str(OUT/'mallet-desktop.png'));await page.mouse.up()
   mobile=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:errors.append(str(e)));await setup(mobile)
   await reset(mobile);await mobile.evaluate('''()=>{const r=__buddy.test.renderer;r._drawMallet=r.drawMallet;window.drawnMallets=0;r.drawMallet=function(...a){drawnMallets++;return this._drawMallet(...a)}}''');pt=await mobile.evaluate('__buddy.screen(640,309)');await mobile.touchscreen.tap(**pt);await mobile.evaluate('advance(24)')
   check('Touch tap completes a mallet strike',await mobile.evaluate('ev.some(e=>e.type==="poke")'))
   check('Committed touch swing remains visible after finger-up',await mobile.evaluate('drawnMallets>0&&!__buddy.test.renderer.localHandVisible'))
   check('Mobile has no horizontal page overflow',await mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'))
   await mobile.screenshot(path=str(OUT/'mallet-mobile.png'))
   check('No JavaScript errors during UI and touch regression',not errors,errors)
  except Exception:check('UI harness completed',False,traceback.format_exc())
  finally:
   (OUT/'mallet-ui.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2));await browser.close()
 print('CHECKS',len(checks),'FAILURES',sum(not x['pass'] for x in checks),flush=True)
if __name__=='__main__':asyncio.run(main())
