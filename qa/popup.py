import asyncio,json,traceback
from pathlib import Path
from playwright.async_api import async_playwright
from local_turn import start
R=Path(__file__).resolve().parents[1];checks=[];errors=[]
async def main():
 srv=await start()
 async with async_playwright() as p:
  b=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),args=['--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding']);ctx=await b.new_context(viewport={'width':1200,'height':800})
  await ctx.add_init_script('window.__BB_TEST_ICE=[{urls:"turn:127.0.0.1:34780?transport=tcp",username:"buddy",credential:"local-only"}]')
  await ctx.route('http://127.0.0.1:8765/**',lambda route:route.fulfill(status=200,content_type='text/html',body=(R/'index.html').read_text()))
  def opened(pg):pg.on('pageerror',lambda e:errors.append(str(e)))
  ctx.on('page',opened);pg=await ctx.new_page()
  try:
   await pg.goto('http://127.0.0.1:8765/index.html?local=1&test=1#room=POPUPQA');await pg.wait_for_function('!!window.__buddy');await pg.click('#playersBtn')
   async with pg.expect_popup() as info:await pg.click('#testTabBtn')
   other=await info.value;await other.wait_for_function('window.__buddy?.connected&&__buddy.state.h.length===2',timeout=20000)
   checks.append({'name':'Test 2P popup auto-pairs using generated invitation and real WebRTC','pass':True})
   checks.append({'name':'Popup invitation pins the same authority','pass':await pg.evaluate('__buddy.id')==await other.evaluate('__buddy.hostId')})
   await other.click('#shopBtn');await other.locator('[data-category="buddy"]').click();await other.locator('[data-sub="hat"]').click();await other.locator('[data-item="hat:3"]').click();await other.click('#catalogueAction');await pg.wait_for_function('__buddy.state.hat===3')
   checks.append({'name':'Second-window catalogue edits shared Buddy','pass':True})
   checks.append({'name':'Popup run has no script errors','pass':not errors,'details':errors})
  except Exception:checks.append({'name':'Popup harness completed','pass':False,'details':traceback.format_exc()})
  finally:(R/'evidence/popup.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2));print(json.dumps(checks,indent=2));await b.close();srv.close();await srv.wait_closed()
asyncio.run(main())
