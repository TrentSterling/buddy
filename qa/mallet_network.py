import asyncio,json,traceback
from pathlib import Path
from playwright.async_api import async_playwright
from local_turn import start,COUNTS
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'evidence'; HTML=(ROOT/'index.html').read_text()
ICE=[{'urls':'turn:127.0.0.1:34780?transport=tcp','username':'buddy','credential':'local-only'}]
checks=[];errors=[];records={}
def check(name,ok,details=None):
 checks.append({'name':name,'pass':bool(ok),'details':details});print('PASS' if ok else 'FAIL',name,details or '',flush=True)
async def boot(browser,hostid=None):
 ctx=await browser.new_context(viewport={'width':1440,'height':1000},device_scale_factor=1)
 pg=await ctx.new_page();pg.set_default_timeout(8000);pg.on('pageerror',lambda e:errors.append(str(e)))
 await pg.evaluate('c=>{window.__BB_TEST_QUERY="local=1&test=1";window.__BB_TEST_HASH=c.h;window.__BB_TEST_ICE=c.ice;}',{'h':'room=BONKFRAME'+('&host='+hostid if hostid else ''),'ice':ICE})
 await pg.set_content(HTML,wait_until='load');await pg.wait_for_function('!!window.__buddy')
 await pg.evaluate('''()=>{const b=__buddy,r=b.test.renderer;r.motion=false;window.trace=[];const draw=r.draw.bind(r);r.draw=function(s,...a){const m=[...this.mallets.values()];trace.push({tick:s.t,mood:s.mood,impact:s.impact,hurt:s.d.some(x=>x>0),m:m.map(m=>({sid:m.sid,at:m.at,ct:m.ct,age:s.t/120-m.at/120,who:m.who})),events:{...b.stats.events}});if(trace.length>600)trace.shift();return draw(s,...a)};}''')
 return pg
async def connect(h,g):
 offer=await h.evaluate('__buddy.offer()');answer=await g.evaluate('c=>__buddy.answer(c)',offer);await h.evaluate('c=>__buddy.finish(c)',answer)
 await g.wait_for_function('__buddy.connected && __buddy.stats.receivedSnapshots>3',timeout=15000)
async def prepare(host,guests):
 for pg in [host,*guests]: await pg.evaluate('__buddy.input({x:1100,y:95,down:false,tool:"grab"})')
 await host.evaluate('''()=>{__buddy.test.freeze(true);const w=__buddy.test.world();w.reset();w.time=5;w.tick=600;w.lastTouch=5;__buddy.test.renderer.resetEffects();window.ev=[];if(!w._emit)w._emit=w.onEvent;w.onEvent=e=>{ev.push({...e,tick:w.tick});w._emit(e)};__buddy.test.freeze(true);}''')
 await asyncio.sleep(.18)
 for pg in [host,*guests]:await pg.evaluate('trace=[]')
async def main():
 server=await start()
 async with async_playwright() as p:
  browser=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding'])
  try:
   host=await boot(browser);hid=await host.evaluate('__buddy.id');guest=await boot(browser,hid);await connect(host,guest)
   check('Two isolated browsers connect over real WebRTC',await host.evaluate('__buddy.state.h.length===2'))
   for name,x,y in [('hit',640,309),('miss',850,250),('near-miss',738,333),('ball',401,507)]:
    await prepare(host,[guest]);await guest.evaluate('p=>{__buddy.setTool("poke");__buddy.input({...p,down:true,tool:"poke"});}',{'x':x,'y':y})
    await host.wait_for_function('ev.some(e=>e.type==="swing")')
    await guest.evaluate('p=>__buddy.input({...p,down:false,tool:"poke"})',{'x':x,'y':y});await asyncio.sleep(.035)
    check(name+': start has no contact damage',await host.evaluate('!ev.some(e=>e.type==="poke"||e.type==="hurt")'))
    await host.evaluate('__buddy.test.freeze(false)');await asyncio.sleep(.62);await host.evaluate('__buddy.test.freeze(true)');await asyncio.sleep(.2)
    events=await host.evaluate('ev');tr=await guest.evaluate('trace');state=await guest.evaluate('__buddy.state');records[name]={'events':events,'trace':tr}
    pokes=[e for e in events if e['type']=='poke'];hurts=[e for e in events if e['type']=='hurt']
    check(name+': one contact only' if name in ('hit','ball') else name+': no phantom contact',len(pokes)==(1 if name in ('hit','ball') else 0),pokes)
    if name=='hit':
     check('Host damage starts during downswing, not button-down',len(hurts)==1 and 613<=pokes[0]['tick']<=623,{'hit_tick':pokes[0]['tick'] if pokes else None})
     early=[f for f in tr if f['tick']<pokes[0]['tick'] and (f['mood'][0] or f['mood'][1] or f['hurt'])]
     check('Guest injury and head stars do not lead rendered contact',not early,early[:3]);check('Guest receives confirmed hit effect',any(f['events'].get('poke',0) for f in tr))
     await guest.screenshot(path=str(OUT/'network-after-hit.png'))
    else:check(name+': no Buddy wound or daze',not hurts and all(v==0 for v in state['d']) and not state['mood'][1])
    check(name+': guest matches host injury state',state['d']==await host.evaluate('__buddy.state.d'))
   # Abort by moving onto real UI, while host is paused mid-windup.
   await prepare(host,[guest]);await guest.evaluate('__buddy.setTool("poke")');point=await guest.evaluate('__buddy.screen(640,309)');await guest.mouse.move(**point);await host.evaluate('__buddy.test.freeze(false)');await guest.wait_for_function('!__buddy.stats.remotePaused && document.querySelector("#pauseNotice").hidden');await guest.mouse.move(**point);await guest.mouse.down();await host.evaluate('__buddy.test.freeze(true)');await host.wait_for_function('ev.some(e=>e.type==="swing")')
   menu=await guest.locator('#settingsBtn').bounding_box();await guest.mouse.move(menu['x']+menu['width']/2,menu['y']+menu['height']/2);await guest.mouse.up();await asyncio.sleep(.08)
   await host.evaluate('__buddy.test.freeze(false)');await asyncio.sleep(.35);await host.evaluate('__buddy.test.freeze(true)')
   records['ui-abort']=await host.evaluate('ev');check('Guest crossing UI cancels pending host mallet',await host.evaluate('ev.some(e=>e.type==="swingCancel")&&!ev.some(e=>e.type==="poke"||e.type==="hurt")'),records['ui-abort'])
   check('UI hover restores OS cursor and releases input',await guest.evaluate('!__buddy.hand.down && __buddy.pointer.cursor!=="none" && !__buddy.pointer.capture'))
   # Add third client; begin a host swing while paused, and welcome fourth at that phase.
   third=await boot(browser,hid);await connect(host,third);await prepare(host,[guest,third]);fourth=await boot(browser,hid)
   await host.evaluate('__buddy.input({x:640,y:309,down:true,tool:"poke"});__buddy.input({x:640,y:309,down:false,tool:"poke"})');await connect(host,fourth)
   check('Four isolated clients join authoritative room',await host.evaluate('__buddy.state.h.length===4'))
   check('Late join restores the in-flight swing',await fourth.evaluate('!!__buddy.test.renderer.mallets.get(__buddy.hostId)'))
   await host.evaluate('__buddy.test.freeze(false)');await asyncio.sleep(.36);await host.evaluate('__buddy.test.freeze(true)');await asyncio.sleep(.15)
   check('Late join sees one resolved hit, not a replayed start',await host.evaluate('ev.filter(e=>e.type==="poke").length===1') and await fourth.evaluate('__buddy.state.d.some(v=>v>0)'))
   # Two simultaneous owners in empty air are distinct, no head feedback.
   await prepare(host,[guest,third,fourth]);await guest.evaluate('__buddy.input({x:340,y:230,down:true,tool:"poke"})');await third.evaluate('__buddy.input({x:920,y:230,down:true,tool:"poke"})');await asyncio.sleep(.05)
   for pg,x in [(guest,340),(third,920)]:await pg.evaluate('x=>__buddy.input({x,y:230,down:false,tool:"poke"})',x)
   await host.evaluate('__buddy.test.freeze(false)');await asyncio.sleep(.14)
   await fourth.screenshot(path=str(OUT/'network-two-mallets.png'))
   await asyncio.sleep(.4);await host.evaluate('__buddy.test.freeze(true)');await asyncio.sleep(.1)
   check('Concurrent hands have distinct swing ids',await host.evaluate('new Set(ev.filter(e=>e.type==="swing").map(e=>e.sid)).size===2'))
   check('Simultaneous misses do not stun Buddy on any client',all([await pg.evaluate('!__buddy.state.mood[1]&&!__buddy.state.d.some(x=>x)') for pg in [host,guest,third,fourth]]))
   # One peer holds Buddy, another strikes, with 80ms added to the striker's incoming packets.
   await guest.evaluate('''()=>{const n=__buddy.test.net;window.netOriginal=n.onData;n.onData=(...args)=>setTimeout(()=>netOriginal(...args),80)}''')
   await prepare(host,[guest,third,fourth]);await asyncio.sleep(.2)
   await third.evaluate('__buddy.input({x:640,y:341,down:true,tool:"grab"})')
   await guest.evaluate('__buddy.input({x:640,y:309,down:true,tool:"poke"});__buddy.input({x:640,y:309,down:false,tool:"poke"})')
   await host.wait_for_function('ev.some(e=>e.type==="swing")');await host.evaluate('__buddy.test.freeze(false)');await asyncio.sleep(.38);await host.evaluate('__buddy.test.freeze(true)');await asyncio.sleep(.3)
   heldEvents=await host.evaluate('ev');heldTrace=await guest.evaluate('trace');heldHits=[e for e in heldEvents if e['type']=='poke']
   records['delayed-held-hit']={'events':heldEvents,'trace':heldTrace}
   check('Guest mallet hits while another real peer holds Buddy',len(heldHits)==1 and heldHits[0]['buddy'])
   check('80ms delayed receiver still never shows injury before its contact tick',len(heldHits)==1 and not any(f['tick']<heldHits[0]['tick'] and (f['hurt'] or f['mood'][1]) for f in heldTrace))
   check('All four clients agree on injuries after held-hit with delay',all([await pg.evaluate('__buddy.state.d')==await host.evaluate('__buddy.state.d') for pg in [guest,third,fourth]]))
   await guest.evaluate('__buddy.test.net.onData=netOriginal');await asyncio.sleep(.15)
   # Disconnect while pending.
   await prepare(host,[guest,third,fourth]);await third.evaluate('__buddy.input({x:640,y:309,down:true,tool:"poke"})');await host.wait_for_function('ev.some(e=>e.type==="swing")');tid=await third.evaluate('__buddy.id');await third.evaluate('__buddy.disconnect()');await host.wait_for_function('id=>!__buddy.test.world().hands.has(id)',arg=tid,timeout=8000)
   await host.evaluate('__buddy.test.freeze(false)');await asyncio.sleep(.32);await host.evaluate('__buddy.test.freeze(true)')
   records['disconnect']=await host.evaluate('ev');check('Removed peer cannot leave a delayed mallet hit',await host.evaluate('!ev.some(e=>e.type==="poke"||e.type==="hurt")'),records['disconnect'])
   check('No page JavaScript errors',not errors,errors)
   records['rtc']=await guest.evaluate('__buddy.rtcStats()');records['relay']=COUNTS
  except Exception as e:
   check('Harness completed',False,traceback.format_exc())
  finally:
   (OUT/'mallet-network.json').write_text(json.dumps({'checks':checks,'errors':errors,'records':records},indent=2));await browser.close();server.close();await server.wait_closed()
 print('CHECKS',len(checks),'FAILURES',sum(not c['pass'] for c in checks),flush=True)
if __name__=='__main__':asyncio.run(main())
