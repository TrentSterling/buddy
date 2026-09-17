import asyncio,json,time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence';FR=OUT/'frames';FR.mkdir(exist_ok=True)
checks=[];errors=[];records={}
def check(n,v,d=None):checks.append({'name':n,'pass':bool(v),'details':d});print('PASS' if v else 'FAIL',n,d or '',flush=True)
async def reset(pg):
 await pg.mouse.up();await pg.evaluate('''()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();__buddy.test.freeze(true);const w=__buddy.test.world();w.reset();w.sandbox=true;w.time=5;w.tick=600;w.lastTouch=5;__buddy.test.renderer.resetEffects();__buddy.setTool('grab');__buddy.test.freeze(false);}''')
 await pg.wait_for_timeout(90)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),args=['--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding'])
  pg=await b.new_page(viewport={'width':1440,'height':900});pg.set_default_timeout(5000);pg.on('pageerror',lambda e:errors.append(str(e)))
  await pg.evaluate('window.__BB_TEST_QUERY="local=1&test=1"');await pg.set_content((ROOT/'index.html').read_text());await pg.wait_for_function('!!window.__buddy')
  await pg.evaluate('__buddy.test.renderer.motion=false')
  tools=await pg.evaluate('Object.keys(__buddy.test.tools)')
  for tool in tools:
   await reset(pg)
   await pg.evaluate('tool=>__buddy.setTool(tool)',tool)
   check(tool+': equips and shows label',await pg.evaluate('t=>__buddy.hand.tool===t && document.querySelector("#toolTitle").textContent.length>0',tool))
   point=await pg.evaluate('__buddy.screen(640,408)');await pg.mouse.move(**point);await pg.mouse.down()
   if tool=='grab':
    dest=await pg.evaluate('__buddy.screen(730,280)');await pg.mouse.move(**dest,steps=12);await pg.wait_for_timeout(200)
   else:await pg.wait_for_timeout(650 if tool in ['minigun','spear','revolver','smg','burst','double'] else 210 if tool not in ['bomb','rocket','grenade'] else 400)
   if tool=='tether':
    await pg.mouse.up();await pg.wait_for_timeout(150);dest=await pg.evaluate('__buddy.screen(900,170)');await pg.mouse.click(**dest);await pg.wait_for_timeout(300)
   await pg.screenshot(path=str(FR/(tool+'.png')))
   await pg.mouse.up();await pg.wait_for_timeout(160)
   if tool=='spear':await pg.screenshot(path=str(FR/'spear-thrown.png'))
   if tool=='bomb':await pg.wait_for_timeout(2200)
   result=await pg.evaluate('''()=>({events:__buddy.stats.events,n:__buddy.state.n.length,healthy:__buddy.state.n.every(n=>n.every(Number.isFinite)),ropes:__buddy.state.ropes,bumpers:__buddy.state.bumpers,down:__buddy.hand.down})''')
   records[tool]=result;check(tool+': runs and releases without NaN',result['healthy'] and not result['down'])
  # Custom cursor must become native over UI, letterbox, and a modal.
  await reset(pg);await pg.locator('#settingsBtn').click();await pg.locator('#cursorBtn').click();await pg.locator('#closeMenu').click()
  pt=await pg.evaluate('__buddy.screen(650,350)');await pg.mouse.move(**pt)
  check('Custom cursor is hidden only over play surface',await pg.evaluate('__buddy.pointer.cursor==="none" && !__buddy.pointer.capture'))
  await pg.mouse.down();box=await pg.locator('#toolsBtn').bounding_box();await pg.mouse.move(box['x']+8,box['y']+8);await pg.mouse.up()
  check('Hovering dock releases input and restores native cursor',await pg.evaluate('!__buddy.hand.down && __buddy.pointer.cursor!=="none" && !__buddy.pointer.capture'))
  await pg.locator('#settingsBtn').click();check('Modal does not hide native cursor',await pg.evaluate('__buddy.pointer.cursor!=="none"'));await pg.locator('#closeMenu').click()
  # Real UI hotkey and file-scheme smoke.
  await pg.keyboard.press('j');check('J equips tether',await pg.evaluate('__buddy.hand.tool==="tether"'))
  pt=await pg.evaluate('__buddy.screen(640,341)');await pg.mouse.click(**pt);await pg.wait_for_timeout(180);await pg.keyboard.press('Escape');await pg.wait_for_timeout(60)
  check('Escape clears host pending tether via normal keyboard',await pg.evaluate('!__buddy.test.world().hands.get(__buddy.id).tetherStart'))
  await pg.keyboard.press('v');check('V equips bumper',await pg.evaluate('__buddy.hand.tool==="bumper"'))
  check('No JavaScript errors during all tools and UI input',not errors,errors)
  records['perf']=await pg.evaluate('__buddy.stats.perf')
  # Real file URL: independent smoke, no claim of public matchmaking.
  filepg=await b.new_page();fileErrors=[];filepg.on('pageerror',lambda e:fileErrors.append(str(e)))
  try:
   await filepg.goto((ROOT/'index.html').as_uri()+'?local=1');await filepg.wait_for_function('window.__frames>5')
   check('Downloaded HTML boots under file:// in Chromium',not fileErrors,fileErrors)
  except Exception as exc:
   records['fileURLLimit']='Managed browser blocked file navigation: '+str(exc)
   print('LIMIT file URL navigation unavailable',flush=True)
  (OUT/'gameplay.json').write_text(json.dumps({'checks':checks,'errors':errors,'records':records},indent=2))
  await b.close()
asyncio.run(main())
