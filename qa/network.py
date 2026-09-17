import asyncio,json,traceback
from pathlib import Path
from playwright.async_api import async_playwright
from local_turn import start,COUNTS
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence';HTML=(ROOT/'index.html').read_text();ICE=[{'urls':'turn:127.0.0.1:34780?transport=tcp','username':'buddy','credential':'local-only'}]
checks=[];errors=[];records={}
def check(n,v,d=None):checks.append({'name':n,'pass':bool(v),'details':d});print('PASS' if v else 'FAIL',n,d or '',flush=True)
async def boot(b,hid=None,name='Guest'):
 ctx=await b.new_context(viewport={'width':1440,'height':900});pg=await ctx.new_page();pg.set_default_timeout(12000);pg.on('pageerror',lambda e:errors.append(str(e)))
 await pg.evaluate('c=>{window.__BB_TEST_QUERY="test=1&local=1";window.__BB_TEST_HASH=c.h;window.__BB_TEST_ICE=c.ice;}',{'h':'room=CATALOG'+('&host='+hid if hid else ''),'ice':ICE});await pg.set_content(HTML);await pg.wait_for_function('!!window.__buddy');await pg.evaluate('__buddy.test.renderer.motion=false');await pg.evaluate('document.querySelector("#roomDialog").showModal()');await pg.locator('#nameInput').fill(name);await pg.locator('#saveName').click();await pg.evaluate('document.querySelector("#roomDialog").close()');return pg
async def connect(h,g):
 o=await h.evaluate('__buddy.offer()');a=await g.evaluate('s=>__buddy.answer(s)',o);await h.evaluate('s=>__buddy.finish(s)',a);await g.wait_for_function('__buddy.connected&&__buddy.stats.receivedSnapshots>3')
async def input(pg,x,y,tool,down=False):await pg.evaluate('d=>__buddy.input(d)',{'x':x,'y':y,'tool':tool,'down':down})
async def step(h,n=30):await h.evaluate('n=>{const w=__buddy.test.world();for(let i=0;i<n;i++){for(const h of w.hands.values())h.seen=performance.now();(w.realStep||w.step).call(w)}__buddy.test.freeze(false)}',n);await asyncio.sleep(.16)
async def main():
 srv=await start()
 async with async_playwright() as p:
  b=await p.chromium.launch(**({'executable_path':'/usr/bin/chromium'} if __import__('os').path.exists('/usr/bin/chromium') else {'channel':'chrome'}),args=['--no-sandbox','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-renderer-backgrounding'])
  try:
   h=await boot(b,name='Tront');await h.evaluate('window.__hold=v=>{const w=__buddy.test.world();w.realStep=w.realStep||w.step;w.step=v?()=>{}:w.realStep;__buddy.test.freeze(false)}');hid=await h.evaluate('__buddy.id');g=await boot(b,hid,'Spear department');await connect(h,g)
   check('Host and guest connected via actual WebRTC',await g.evaluate('__buddy.connected'),await g.evaluate('__buddy.stats.net.routes'))
   await h.evaluate('''()=>{__hold(true);const w=__buddy.test.world();w.reset();w.cash=5000;w.time=5;w.tick=600;w.lastTouch=5;__hold(true)}''');await asyncio.sleep(.18)
   # Guest purchases through the actual new catalogue, not injected ownership bits.
   await g.click('#shopBtn');await g.locator('[data-item="tool:revolver"]').click();await g.click('#catalogueAction');await g.wait_for_function('__buddy.hand.tool==="revolver"');await step(h)
   check('Guest can buy and equip a revolver through catalogue',await h.evaluate('(__buddy.state.unlock&(1<<21))!==0') and await g.evaluate('!document.querySelector("#shopDialog").open'))
   before=await h.evaluate('__buddy.state.bank');await g.click('#shopBtn');await g.locator('[data-category="buddy"]').click();await g.locator('[data-sub="hat"]').click();await g.locator('[data-item="hat:12"]').click()
   check('Guest hat preview is local until applied',await h.evaluate('__buddy.state.hat===0'))
   await g.click('#catalogueAction');await g.wait_for_function('__buddy.state.hat===12');await step(h)
   check('Guest cosmetic purchase updates shared hat and cash once',await h.evaluate('__buddy.state.bank')==before-85)
   await g.locator('[data-category="hands"]').click();await g.locator('[data-item="hand:2"]').click();await g.click('#catalogueAction');await step(h)
   gid=await g.evaluate('__buddy.id');check('Guest wears robot hand without changing host hand',await h.evaluate('id=>__buddy.state.h.find(h=>h[0]===id)[9]===2&&__buddy.state.h.find(h=>h[0]===__buddy.id)[9]===0',gid))
   await g.locator('[data-category="room"]').click();await g.locator('[data-item="room:5"]').click();check('Room action clearly disabled for guest',await g.locator('#catalogueAction').is_disabled());await g.click('#closeShop');await input(g,1000,100,'grab',False);await step(h)
   await h.evaluate('__buddy.command("buylook:room:5")');await step(h);await h.evaluate('__buddy.command("buylook:body:2")');await step(h)
   check('Host room and Buddy skin propagate to guest',await g.evaluate('__buddy.state.theme===5&&__buddy.state.skin===2'))
   # Late joins get all appearance and catalogue state without one-off replay requirements.
   third=await boot(b,hid,'Bonk department');await connect(h,third);fourth=await boot(b,hid,'Quality control');await connect(h,fourth);await step(h)
   check('Four isolated contexts are connected',await h.evaluate('__buddy.state.h.length===4'))
   check('Late join restores exact cosmetics and purchases',await fourth.evaluate('({hat:__buddy.state.hat,skin:__buddy.state.skin,theme:__buddy.state.theme,looks:__buddy.state.looks,unlock:__buddy.state.unlock})')==await h.evaluate('({hat:__buddy.state.hat,skin:__buddy.state.skin,theme:__buddy.state.theme,looks:__buddy.state.looks,unlock:__buddy.state.unlock})'))
   # Guest spear charge and release are inputs; only the host allocates the projectile.
   await h.evaluate('const w=__buddy.test.world();w.stand();w.lastTouch=w.time;__hold(true)');await asyncio.sleep(.2)
   await g.evaluate('__buddy.setTool("spear")');await input(g,640,341,'spear',True);await asyncio.sleep(.15);await step(h,45)
   check('Guest held charge creates no premature spear',await h.evaluate('!__buddy.state.n.some(n=>n[6]===6)'))
   target=await h.evaluate('({x:__buddy.state.n[0][1],y:__buddy.state.n[0][2]})');await input(g,target['x'],target['y'],'spear',False);await asyncio.sleep(.15);await step(h,24)
   check('Guest release creates one host-owned spear',await h.evaluate('__buddy.state.n.filter(n=>n[6]===6).length===1'))
   check('Spear and wounds match on late-joined client',await h.evaluate('__buddy.state.n.filter(n=>n[6]===6)')==await fourth.evaluate('__buddy.state.n.filter(n=>n[6]===6)'))
   # Automatic replacement order identical on wire.
   for i in range(4):
    await input(g,1000,200,'spear',True);await asyncio.sleep(.055);await step(h,45);await input(g,1000,200,'spear',False);await asyncio.sleep(.055);await step(h,22)
   check('Repeated guest spear throws recycle down to two',await h.evaluate('__buddy.state.n.filter(n=>n[6]===6).length===2'))
   check('Recycled spear IDs agree across all clients',all([await pg.evaluate('__buddy.state.n.filter(n=>n[6]===6).map(n=>n[0])')==await h.evaluate('__buddy.state.n.filter(n=>n[6]===6).map(n=>n[0])') for pg in [g,third,fourth]]))
   # Preserve contraptions and another player's held toy on normal Sweep.
   await h.evaluate('''()=>{const w=__buddy.test.world();w.clearProps();w.stand();w.lastTouch=w.time;w.placeBumper(330,510,__buddy.id);w.pads.push({id:w.nextId++,x:790,kick:-10});w.addBall(300,300,false);w.addBall(920,300,false);w.tethers.push([w.nextId++,0,-1,640,341,720,170,205]);__hold(true)}''');await asyncio.sleep(.2)
   await third.evaluate('__buddy.setTool("grab")');await input(third,300,300,'grab',True);await asyncio.sleep(.15);await g.click('#quickSweepBtn');await asyncio.sleep(.18);await h.evaluate('__hold(true)');await asyncio.sleep(.15)
   check('Guest Sweep preserves held ball and shared setup',await h.evaluate('__buddy.state.n.filter(n=>n[6]===1).length===1&&__buddy.state.h.some(h=>h[6])&&__buddy.state.ropes.length===1&&__buddy.state.bumpers.length===1&&__buddy.state.pads.length===1'))
   check('Sweep removals synchronise on every peer',await fourth.evaluate('__buddy.state.n.filter(n=>n[6]===1).length===1'))
   # Host-controlled clear cannot be invoked by a crafted guest command.
   await g.evaluate('__buddy.command("clearall")');await asyncio.sleep(.15);check('Guest clear-all is rejected by authority',await h.evaluate('__buddy.state.ropes.length===1'))
   await input(third,300,300,'grab',False);await h.evaluate('const w=__buddy.test.world();w.sandbox=true;w.clearProps();w.stand();w.placeBumper(350,565,__buddy.id);w.placeBumper(930,565,__buddy.id);w.hands.get(__buddy.id).style=1;__hold(true)');await asyncio.sleep(.15)
   await third.evaluate('__buddy.command("look:hand:4")');await fourth.evaluate('__buddy.command("look:hand:5")');await step(h)
   await h.evaluate('__hold(false)');await asyncio.sleep(.2)
   left=await h.evaluate('({x:__buddy.state.n[5][1],y:__buddy.state.n[5][2]})');right=await h.evaluate('({x:__buddy.state.n[8][1],y:__buddy.state.n[8][2]})');await h.evaluate('__buddy.setTool("grab")');await g.evaluate('__buddy.setTool("grab")');await input(h,**left,tool='grab',down=True);await input(g,**right,tool='grab',down=True)
   await input(h,410,360,'grab',True);await input(g,875,330,'grab',True);await third.evaluate('__buddy.setTool("minigun")');await fourth.evaluate('__buddy.setTool("pan")');await input(third,610,415,'minigun',False);await input(fourth,795,270,'pan',False)
   # Programmatic hand is hidden locally; the fourth client sees the three remote hands.
   await asyncio.sleep(.7);await fourth.screenshot(path=str(OUT/'multiplayer-moon.png'));check('Four-client mixed cosmetics render without errors',not errors,errors)
   check('Two simultaneous grabs survive new UI and cosmetics',await h.evaluate('__buddy.state.h.filter(h=>h[6]).length>=2'))
   # Measure active gun traffic; no replicated shell / shader / hat animation fields.
   before=await h.evaluate('__buddy.stats.net');await input(third,620,410,'minigun',True);await input(fourth,650,370,'pan',True);await asyncio.sleep(2.0);await fourth.screenshot(path=str(OUT/'multiplayer-guns.png'));after=await h.evaluate('__buddy.stats.net');records['active_before']=before;records['active_after']=after;records['durationSeconds']=2;records['snapshotBytes']=await h.evaluate('__buddy.stats.snapBytes');records['rtc']=await fourth.evaluate('__buddy.rtcStats()')
   await input(third,620,410,'minigun',False);await input(fourth,650,370,'pan',False);await g.evaluate('__buddy.disconnect()');await h.wait_for_function('id=>!__buddy.state.h.some(h=>h[0]===id)',arg=gid);check('Explicit disconnect releases and removes grabbing peer',await h.evaluate('__buddy.state.h.length===3'))
   await h.evaluate('''()=>{for(let i=0;i<70;i++)__buddy.test.world().explode(640+(i%7)*8,410+Math.floor(i/7)*7,__buddy.id,.4)}''');await asyncio.sleep(.25);check('Explosion stress renderer stays in capped pools',await fourth.evaluate('__buddy.test.renderer.blasts.length<=8&&__buddy.test.renderer.particles.length<=420&&__buddy.test.renderer.rings.length<=40'))
   await third.close();await h.wait_for_function('__buddy.state.h.length===2',timeout=10000);check('Abrupt page close removes guest lease',True);check('No JS errors during multiplayer run',not errors,errors);records['relay']=COUNTS
  except Exception:check('Network harness completed',False,traceback.format_exc())
  finally:
   (OUT/'network.json').write_text(json.dumps({'checks':checks,'errors':errors,'records':records},indent=2));await b.close();srv.close();await srv.wait_closed()
asyncio.run(main())
