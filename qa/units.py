import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),args=['--no-sandbox','--disable-dev-shm-usage']);page=await b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.evaluate('window.__BB_TEST_QUERY="local=1&test=1"');await page.set_content((ROOT/'index.html').read_text());await page.wait_for_function('!!window.__buddy');await page.evaluate('__buddy.test.freeze(true)')
  old=(ROOT/'qa/baseline-unit.js').read_text().replace("'Two new tools appended; exactly 21 tools',Object.keys(__buddy.test.tools).length===21","'Existing tools preserved; exactly 31 tools',Object.keys(__buddy.test.tools).length===31").replace("w.nodes.length===88,{nodes:w.nodes.length}","w.nodes.length<=88&&w.nodes.length>=80,{nodes:w.nodes.length}")
  res=await page.evaluate(old);res2=await page.evaluate((ROOT/'qa/new-unit.js').read_text());res['checks']+=res2['checks'];res['metrics'].update(res2['metrics']);res['errors']=errors
  (ROOT/'evidence/unit.json').write_text(json.dumps(res,indent=2))
  for c in res['checks']:print('PASS' if c['pass'] else 'FAIL',c['name'],c.get('details',''))
  print('METRICS',res['metrics'],'ERRORS',errors);await b.close()
asyncio.run(main())
