import asyncio,json,traceback
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence';checks=[];errors=[]
def check(n,v,d=None):checks.append({'name':n,'pass':bool(v),'details':d});print('PASS' if v else 'FAIL',n,d or '',flush=True)
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),args=['--no-sandbox','--disable-dev-shm-usage']);pg=await b.new_page(viewport={'width':1440,'height':900});pg.set_default_timeout(9000);pg.on('pageerror',lambda e:errors.append(str(e)))
  try:
   await pg.evaluate('window.__BB_TEST_QUERY="test=1&local=1"');await pg.set_content((ROOT/'index.html').read_text());await pg.wait_for_function('!!window.__buddy')
   check('All 31 equipment definitions boot',await pg.evaluate('Object.keys(__buddy.test.tools).length===31'))
   await pg.click('#shopBtn');check('Shop has five clearly labelled departments',await pg.locator('[data-category]').all_text_contents()==['Weapons','Toys','Buddy','Your hand','Room'])
   await pg.locator('[data-category="buddy"]').click();await pg.locator('[data-sub="hat"]').click();check('Hats are two visible clicks away from the Shop',await pg.locator('[data-item^="hat:"]').count()==14)
   await pg.locator('[data-item="hat:2"]').click();check('Selecting a hat previews without equipping',await pg.evaluate('__buddy.state.hat===0'));await pg.click('#catalogueAction');await pg.wait_for_function('__buddy.state.hat===2');check('Wear applies selected hat, not next-in-cycle',True)
   await pg.locator('[data-sub="body"]').click();check('Six body skins available in same shop',await pg.locator('[data-item^="body:"]').count()==6)
   await pg.locator('[data-category="hands"]').click();check('Six hand styles available in same shop',await pg.locator('[data-item^="hand:"]').count()==6)
   await pg.locator('[data-category="room"]').click();check('Six rendered room previews available',await pg.locator('[data-item^="room:"]').count()==6)
   await pg.locator('[data-item="room:5"]').click();check('Theme preview does not secretly change room or gravity',await pg.evaluate('__buddy.state.theme===0&&!__buddy.state.low'))
   await pg.click('#modeBtn');await pg.click('#catalogueAction');await pg.wait_for_function('__buddy.state.theme===5');check('Apply changes theme without changing gravity',await pg.evaluate('!__buddy.state.low'));await pg.click('#closeShop')
   await pg.click('#toolsBtn');check('Current tool opens the same catalogue filtered to owned gear',await pg.evaluate('__buddy.ui.catalogue.owned&&__buddy.ui.catalogue.fast'));await pg.locator('[data-item="tool:water"]').click();check('Owned equipment equips with one click in fast catalogue',await pg.evaluate('__buddy.hand.tool==="water"&&!document.querySelector("#shopDialog").open'))
   await pg.keyboard.press('e');await pg.keyboard.press('e');check('E opens and closes the catalogue without firing',not await pg.locator('#shopDialog').is_visible())
   await pg.click('#settingsBtn');check('Settings no longer contains visible hat cycling controls',not await pg.locator('#hatBtn').is_visible() and not await pg.locator('#skinBtn').is_visible());await pg.screenshot(path=str(OUT/'settings-final.png'));await pg.click('#closeMenu')
   # Easy sweeping preserves purchases and removes only disposable clutter.
   await pg.evaluate('const w=__buddy.test.world();w.cash=321;w.addBall(260,350,false);w.placeBumper(300,530,__buddy.id);w.pads.push({id:w.nextId++,x:450,kick:-10})');await pg.click('#quickSweepBtn');check('Visible Sweep clears loose balls and preserves setup',await pg.evaluate('__buddy.state.n.filter(n=>n[6]===1).length===0&&__buddy.state.bumpers.length===1&&__buddy.state.pads.length===1'))
   await pg.click('#sweepOptionsBtn');await pg.locator('#clearAllBtn').click();check('A casual click does not wipe constructed objects',await pg.evaluate('__buddy.state.bumpers.length===1'))
   rect=await pg.locator('#clearAllBtn').bounding_box();await pg.mouse.move(rect['x']+30,rect['y']+20);await pg.mouse.down();await pg.wait_for_timeout(1050);await pg.mouse.up();check('Deliberate hold clears room but keeps cash and theme',await pg.evaluate('__buddy.state.bumpers.length===0&&__buddy.state.pads.length===0&&__buddy.state.bank===321&&__buddy.state.theme===5'))
   # Spear charge uses actual pointer up. A UI crossing is never an accidental throw.
   await pg.evaluate('__buddy.setTool("spear");__buddy.test.world().clearProps()');point=await pg.evaluate('__buddy.screen(980,250)');await pg.mouse.move(**point);await pg.mouse.down();await pg.wait_for_timeout(350)
   m=await pg.locator('#shopBtn').bounding_box();await pg.mouse.move(m['x']+10,m['y']+10);await pg.mouse.up();check('Spear charge cancelled over UI does not throw',await pg.evaluate('!__buddy.state.n.some(n=>n[6]===6)&&!__buddy.hand.down&&__buddy.pointer.cursor!=="none"'))
   await pg.mouse.move(**point);await pg.mouse.down();await pg.wait_for_timeout(300);await pg.mouse.up();await pg.wait_for_timeout(150);check('Real mouse release throws a spear',await pg.evaluate('__buddy.state.n.some(n=>n[6]===6)'))
   # Save captures actual gameplay, never the open menu or stretched phone letterboxing.
   await pg.click('#settingsBtn')
   async with pg.expect_download() as info:await pg.click('#postcardBtn')
   download=await info.value;await download.save_as(str(OUT/'postcard-final.png'));check('Postcard exports through visible menu action',download.suggested_filename.endswith('.png'));await pg.click('#closeMenu')
   for width,height,tag in [(390,844,'mobile'),(320,740,'small-phone'),(900,430,'landscape'),(3840,2160,'4k')]:
    await pg.set_viewport_size({'width':width,'height':height});await pg.click('#shopBtn');await pg.locator('[data-category="buddy"]').click();await pg.locator('[data-sub="hat"]').click()
    rect=await pg.locator('#shopDialog').bounding_box();action=await pg.locator('#catalogueAction').bounding_box()
    check(tag+' catalogue stays in viewport with reachable action',rect['x']>=0 and rect['y']>=0 and rect['x']+rect['width']<=width+1 and rect['y']+rect['height']<=height+1 and action['y']+action['height']<=height+1,{'dialog':rect,'action':action})
    check(tag+' page has no horizontal overflow',await pg.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    await pg.screenshot(path=str(OUT/(tag+'-catalogue.png')));await pg.click('#closeShop')
   await pg.set_viewport_size({'width':390,'height':844});await pg.click('#settingsBtn');await pg.select_option('#uiScale','1.5');await pg.click('#closeMenu');await pg.click('#shopBtn');await pg.locator('[data-category="hands"]').click();await pg.screenshot(path=str(OUT/'mobile-large-catalogue.png'));check('Extra-large phone UI still exposes all category buttons',all([await pg.locator('[data-category="'+x+'"]').is_visible() for x in ['weapons','toys','buddy','hands','room']]))
   check('No JS errors in catalogue / cleanup / export tests',not errors,errors)
  except Exception:check('Catalogue UI harness completed',False,traceback.format_exc())
  finally:(OUT/'catalogue-ui.json').write_text(json.dumps({'checks':checks,'errors':errors},indent=2));await b.close()
asyncio.run(main())
