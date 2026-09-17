import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),args=['--no-sandbox','--disable-dev-shm-usage']);pg=await b.new_page(viewport={'width':1440,'height':900});errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  await pg.evaluate('window.__BB_TEST_QUERY="local=1&test=1"');await pg.set_content((ROOT/'index.html').read_text());await pg.wait_for_function('!!window.__buddy');await pg.evaluate('__buddy.test.renderer.motion=false;__buddy.test.world().cash=5000')
  await pg.click('#shopBtn');await pg.screenshot(path=str(ROOT/'evidence/catalogue-weapons.png'))
  await pg.locator('[data-item="tool:revolver"]').click();await pg.screenshot(path=str(ROOT/'evidence/catalogue-new-guns.png'))
  await pg.locator('[data-category="buddy"]').click();await pg.locator('[data-item="body:2"]').click();await pg.screenshot(path=str(ROOT/'evidence/catalogue-bodies.png'));await pg.click('#catalogueAction');await pg.wait_for_timeout(250)
  await pg.locator('[data-sub="hat"]').click();await pg.locator('[data-item="hat:12"]').click();await pg.screenshot(path=str(ROOT/'evidence/catalogue-hats.png'));await pg.click('#catalogueAction');await pg.wait_for_timeout(250)
  await pg.locator('[data-category="hands"]').click();await pg.locator('[data-item="hand:2"]').click();await pg.screenshot(path=str(ROOT/'evidence/catalogue-hands.png'));await pg.click('#catalogueAction');await pg.wait_for_timeout(250)
  await pg.locator('[data-category="room"]').click();await pg.locator('[data-item="room:5"]').click();await pg.screenshot(path=str(ROOT/'evidence/catalogue-rooms.png'));await pg.click('#catalogueAction');await pg.wait_for_timeout(250);await pg.click('#closeShop')
  await pg.screenshot(path=str(ROOT/'evidence/gameplay-moon.png'));await pg.click('#sweepOptionsBtn');await pg.screenshot(path=str(ROOT/'evidence/cleanup.png'));await pg.click('#closeSweep')
  await pg.set_viewport_size({'width':390,'height':844});await pg.screenshot(path=str(ROOT/'evidence/mobile-game.png'));await pg.click('#shopBtn');await pg.locator('[data-category="buddy"]').click();await pg.locator('[data-sub="hat"]').click();await pg.screenshot(path=str(ROOT/'evidence/mobile-hats.png'));await pg.locator('[data-item="hat:5"]').click();await pg.screenshot(path=str(ROOT/'evidence/mobile-hat-selected.png'))
  print('ERRORS',errors);print('state',await pg.evaluate('({hat:__buddy.state.hat,skin:__buddy.state.skin,theme:__buddy.state.theme,styles:__buddy.state.h.map(h=>h[9])})'));await b.close()
asyncio.run(main())
