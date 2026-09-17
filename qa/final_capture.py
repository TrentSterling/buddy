import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
R=Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),args=['--no-sandbox','--disable-dev-shm-usage']);pg=await b.new_page(viewport={'width':1440,'height':900})
  await pg.evaluate('window.__BB_TEST_QUERY="test=1&local=1"');await pg.set_content((R/'index.html').read_text());await pg.wait_for_function('!!window.__buddy');await pg.evaluate('__buddy.test.world().cash=500;__buddy.test.world().skin=2;__buddy.test.renderer.motion=false')
  await pg.click('#shopBtn');await pg.locator('[data-category="buddy"]').click();await pg.locator('[data-sub="hat"]').click();await pg.locator('[data-item="hat:5"]').click();await pg.evaluate('document.querySelector("#catalogueGrid").scrollTop=0');await pg.locator('#shopDialog').screenshot(path=str(R/'evidence/toybox-hats-final.png'))
  await pg.locator('[data-category="weapons"]').click();await pg.locator('[data-item="tool:minigun"]').click();await pg.locator('#shopDialog').screenshot(path=str(R/'evidence/toybox-weapons-final.png'))
  await pg.locator('[data-category="room"]').click();await pg.locator('[data-item="room:2"]').click();await pg.locator('#shopDialog').screenshot(path=str(R/'evidence/toybox-rooms-final.png'))
  await b.close()
asyncio.run(main())
