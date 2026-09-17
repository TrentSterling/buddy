import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding'])
  page=await b.new_page(viewport={'width':1440,'height':900});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.evaluate('window.__BB_TEST_QUERY="test=1&local=1";window.__BB_TEST_HASH="room=BONKQA"')
  await page.set_content((ROOT/'index.html').read_text());await page.wait_for_timeout(1200)
  print('errors',errors);print(await page.evaluate('({ready:!!window.__buddy,frames:window.__frames,body:document.body.innerText.slice(-1600)})'))
  await page.screenshot(path=str(ROOT/'evidence/boot.png'))
  if await page.evaluate('!!window.__buddy'):
   await page.click('#shopBtn');await page.wait_for_timeout(200);await page.screenshot(path=str(ROOT/'evidence/boot-shop.png'))
   print('shop',await page.locator('#shopDialog').inner_text());print('errors',errors)
  await b.close()
asyncio.run(main())
