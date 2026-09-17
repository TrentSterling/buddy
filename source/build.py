from pathlib import Path
import re
ROOT=Path(__file__).parent
base=(ROOT/'baseline.html').read_text()
a=base.index('<script>(()=>{')+len('<script>'); b=base.rindex('</script>')
js=base[a:b];html=base[:a];tail=base[b:]
def replace(old,new,count=1):
 global js
 if old not in js: raise ValueError('JS missing '+old[:180])
 js=js.replace(old,new,count)
def section(start,end,new):
 global js
 i=js.index(start);j=js.index(end,i);js=js[:i]+new+js[j:]
# Version and capacities. Bodies stay at 88; eight reserved slots for transient weapons.
replace('VERSION:5','MAX_SPEARS:8,MAX_SHURIKEN:16,PROP_RESERVE:8,VERSION:6')
# Content arrays need helper definitions but are initialized before TOOLS.
replace('// These are game tools, not independent client-side effects.',(ROOT/'models.js').read_text()+'\n// These are game tools, not independent client-side effects.')
replace("rate:.24,deck:'lab'}\n\n});","rate:.24,deck:'lab'},\n ...NEW_TOOLS\n});")
replace('ALL_TOOL_MASK=(1<<TOOL_IDS.length)-1','ALL_TOOL_MASK=2**TOOL_IDS.length-1')
replace('|(1<<19)|(1<<20),','|(1<<19)|(1<<20)|(1<<27)|(1<<29)|(1<<30),')
replace("5:BB.MAX_BOWLING};","5:BB.MAX_BOWLING,6:BB.MAX_SPEARS,7:BB.MAX_SHURIKEN};")
replace("5:'Bowling balls'};","5:'Bowling balls',6:'Spears',7:'Shuriken'};")
# World lifecycle and cosmetics.
replace('this.hat=workshop?.hat??0;','this.hat=workshop?.hat??0;this.theme=workshop?.theme??0;this.looks=workshop?.looks??FREE_LOOKS;')
replace('this.shockUntil=0;this.skin=0;','this.shockUntil=0;this.skin=workshop?.skin??0;')
replace('h.mallet=null;h.tetherStart=null;','h.mallet=null;h.tetherStart=null;h.charge=null;h.burst=null;h.guns={};h.holdAt=-10;',1)
replace("skin:(this.skin", "skin:(this.skin") if 'skin:(this.skin' in js else None
# A real per-world owner for protection/host-only cosmetic scene changes.
replace("if(this.time-h.lastCmd<.15)return;h.lastCmd=this.time;", "if(this.time-h.lastCmd<.15)return;h.lastCmd=this.time;this.spawnOwner=id;\n  if(d.c.startsWith('look:')||d.c.startsWith('buylook:')){this.lookCommand(id,d.c);return;}\n  if(d.c==='sweep'){this.sweep();return;}\n  if(d.c==='clearall'){if(!this.authorityId||id===this.authorityId){this.clearProps();this.repair();this.cleanStains();}return;}")
replace("this.skin=(this.skin+1)%3;","this.skin=(this.skin+1)%SKINS.length;")
replace("this.hat=(this.hat+1)%4;","this.hat=(this.hat+1)%HATS.length;")
section(' reserve(kind,event=true){',' addBall(',''' reserve(kind,event=true,owner=this.spawnOwner||''){
  const cap=PROP_CAPS[kind];if(!cap)return false;
  if(kind===6&&this.nodes.filter(n=>n.kind===6&&n.owner===owner).length>=2){
   const old=this.recycleCandidate(6,owner,true);if(!old){if(event)this.limit('Both your spears are in use. Release one first.');return false;}this.removeNode(old.id);
  }
  if(this.nodes.filter(n=>n.kind===kind).length>=cap){
   const old=[1,4,5,6,7].includes(kind)?this.recycleCandidate(kind,owner):null;
   if(!old){if(event)this.limit(PROP_NAMES[kind]+' are all in use. Sweep or release one.');return false;}this.removeNode(old.id);
  }
  const ceiling=[1,3,4,5].includes(kind)?BB.MAX_NODES-BB.PROP_RESERVE:BB.MAX_NODES;
  if(this.nodes.length>=ceiling){const old=this.recycleCandidate(null,owner);if(!old){if(event)this.limit('The room is busy with protected toys. Sweep or cut a rope.');return false;}this.removeNode(old.id);}
  return true;
 }
''')
replace("vx:0,vy:0,r,m,im:1/m,a:0,lastBounce", "vx:0,vy:0,r,m,im:1/m,a:0,owner:this.spawnOwner||'',lastBounce")
# Preserve skin/hat/theme/unlocks in old browser save key. Old tool indices untouched.
section(' workshopSnapshot(){',' canUse(tool)', ''' workshopSnapshot(){return {cash:this.cash,earned:this.earned,unlocked:this.unlocked,upgrades:this.upgrades?.slice(),sandbox:this.sandbox,hat:this.hat,skin:this.skin,theme:this.theme,looks:this.looks};}
 loadWorkshop(s){
  if(!s||!Number.isSafeInteger(s.cash)||s.cash<0||s.cash>1e9||!Number.isSafeInteger(s.earned)||s.earned<0||s.earned>4e9||!Number.isInteger(s.unlocked)||s.unlocked<0||s.unlocked>ALL_TOOL_MASK||!Array.isArray(s.upgrades)||s.upgrades.length!==3||!s.upgrades.every(n=>Number.isInteger(n)&&n>=0&&n<=3))return false;
  this.cash=s.cash;this.earned=s.earned;this.unlocked=s.unlocked|STARTER_MASK;this.upgrades=s.upgrades.slice();this.sandbox=!!s.sandbox;
  this.looks=Number.isInteger(s.looks)&&s.looks>=0&&s.looks<=0xffffffff?(s.looks|FREE_LOOKS)>>>0:FREE_LOOKS;
  for(const [key,items] of [['hat',HATS],['skin',SKINS],['theme',ROOMS]])this[key]=Number.isInteger(s[key])&&s[key]>=0&&s[key]<items.length?s[key]:0;
  return true;
 }
''')
# Charged spear and burst cancellation. Single authoritative release.
replace('h.seen=now;if(d.cancel===true)this.cancelMallet(h);','h.seen=now;if(d.cancel===true){h.charge=null;h.burst=null;this.cancelMallet(h);}')
replace('if(tool!==h.tool){this.cancelMallet(h);','if(tool!==h.tool){h.charge=null;h.burst=null;this.cancelMallet(h);')
replace("this.lastTouch=this.time;let g=null;","this.spawnOwner=id;this.lastTouch=this.time;h.holdAt=this.time;let g=null;")
replace("if(h.tool!=='grab')this.useTool(h,g);", "if(h.tool==='spear'){h.charge={at:this.time};}\n   else if(h.tool!=='grab')this.useTool(h,g);")
replace("else if(g){h.grip=g;", "else if(g){const n=this.node(g.a);if(n?.stuck){n.stuck=null;n.im=1/n.m;}h.grip=g;")
replace('if(!d.down&&h.down){','if(!d.down&&h.down){\n   if(h.tool===\'spear\'&&h.charge&&!d.cancel){this.throwSpear(h,clamp(this.time-h.charge.at,0,1));h.charge=null;}')
replace('h.grip=null;h.down=false;}','h.grip=null;h.down=false;h.charge=null;h.burst=null;}',1) # timeout
replace("if(!this.canUse(h.tool)||this.time<(h.cooldowns?.[h.tool]||0))return;", "if(!this.canUse(h.tool))return;this.spawnOwner=h.id;\n  if(GUNS[h.tool]){this.fireGun(h);return;}\n  if(this.time<(h.cooldowns?.[h.tool]||0))return;")
replace("if(TOOLS[h.tool].cost){this.heavyTool(h,g);return;}","if(h.tool==='shuriken'){this.throwStar(h);return;}\n  if(h.tool==='water'){this.waterSpray(h);return;}\n  if(h.tool==='pan'){this.startMallet(h);return;}\n  if(TOOLS[h.tool].cost){this.heavyTool(h,g);return;}")
# Persistent player style is compact authoritative state, not a local global recolor.
replace("h.name=String(name||h.name).slice(0,20);h.color=color||h.color;return h;", "h.name=String(name||h.name).slice(0,20);h.color=color||h.color;h.style=h.style||0;return h;")
# Add geometry-sensitive spear / star simulation without simulating long segmented shafts.
replace("for(const h of this.hands.values())if(h.down&&h.tool!=='grab'&&h.tool!=='balloon'&&h.tool!=='ball'&&h.tool!=='bomb'&&h.tool!=='spring'&&h.tool!=='duck'&&h.tool!=='bowling'&&h.tool!=='tether'&&h.tool!=='bumper')this.useTool(h,null);", "for(const h of this.hands.values())if(h.down&&!ONE_SHOT.has(h.tool))this.useTool(h,null);\n  this.updateBursts();")
replace('this.updateProjectiles(dt);this.updateCandy(dt);','this.updateProjectiles(dt);this.updateCandy(dt);this.updateThrown(dt);')
replace('n.ox=n.x;n.oy=n.y;n.ivx=n.vx;n.ivy=n.vy;n.contacted=false;', 'n.ox=n.x;n.oy=n.y;n.ivx=n.vx;n.ivy=n.vy;n.contacted=false;\n   if(n.stuck){n.vx=n.vy=0;continue;}')
replace('for(const n of this.nodes){\n   n.vx=clamp((n.x-n.ox)/dt', 'for(const n of this.nodes){\n   if(n.stuck){n.vx=n.vy=0;continue;}\n   n.vx=clamp((n.x-n.ox)/dt')
replace('circleCollision(a,b){\n', 'circleCollision(a,b){\n  if(a.stuck||b.stuck||a.kind===6||a.kind===7||b.kind===6||b.kind===7)return;\n')
replace('staticCollision(n){\n', 'staticCollision(n){\n  if(n.stuck)return;\n')
replace('capsuleCollision(ball,ai,bi,r){\n', 'capsuleCollision(ball,ai,bi,r){\n  if(ball.stuck||ball.kind===6||ball.kind===7)return;\n')
replace('if(n.kind===3||Math.abs(n.x-pad.x)', 'if(n.stuck||n.kind===3||Math.abs(n.x-pad.x)')
replace('if(n.kind===4||n.kind===5)n.a=', 'if(n.kind===7)n.a=(n.a+dt*19)%(Math.PI*2);\n   if(n.kind===6&&!n.stuck&&Math.hypot(n.vx,n.vy)>40)n.a=Math.atan2(n.vy,n.vx);\n   if(n.kind===4||n.kind===5)n.a=')
replace('this.updateSprings();this.updateBumpers();','this.updateSprings();this.updateBumpers();this.syncAttachments();')
# Pan shares the tested temporal contact sequence and uses a pan face at that capsule.
replace('side:h.x<BB.W/2?-1:1,at:this.tick,resolved:false','side:h.x<BB.W/2?-1:1,tool:h.tool,at:this.tick,resolved:false')
replace("side:m.side,at:m.at}","side:m.side,tool:m.tool,at:m.at}")
replace('if(tool===\'poke\'){this.drawMallet(h,nowTime);return;}', "if(MELEE.has(tool)){this.drawMallet(h,nowTime);return;}")
replace("my[7]==='poke'&&ownSwing", "MELEE.has(my[7])&&ownSwing")
replace("tool==='poke'&&this.malletLabel", "MELEE.has(tool)&&this.malletLabel")
# Serialization: append metadata instead of changing existing 21 indices or body tuple.
replace('return {hat:this.hat,ropes:', 'return {looks:this.looks,theme:this.theme,hat:this.hat,ropes:')
replace("round(h.lastUse)])", "round(h.lastUse),h.style||0])")
replace("q32(h[8]);if(h[6])", "q32(h[8]);u8(h[9]||0);if(h[6])")
replace("at=q32();return [id,name,color,x,y,!!(f&1),f&2?[u32(),u32(),q()]:null,tool,at]", "at=q32(),style=u8();return [id,name,color,x,y,!!(f&1),f&2?[u32(),u32(),q()]:null,tool,at,style]")
replace('u8(s.hat||0);','u8(s.hat||0);u8(s.theme||0);u32(s.looks??FREE_LOOKS);')
replace('s.hat=u8();','s.hat=u8();s.theme=u8();s.looks=u32();')
replace('s.hat>=0&&s.hat<4&&','s.hat>=0&&s.hat<HATS.length&&Number.isInteger(s.theme)&&s.theme>=0&&s.theme<ROOMS.length&&Number.isInteger(s.looks)&&s.looks>=0&&s.looks<=0xffffffff&&')
replace('n[6]<=5','n[6]<=7')
replace("Array.isArray(h)&&typeof h[0]","Array.isArray(h)&&h.length===10&&typeof h[0]")
replace("Object.hasOwn(TOOLS,h[7])", "Object.hasOwn(TOOLS,h[7])&&Number.isInteger(h[9])&&h[9]>=0&&h[9]<HANDS.length")
# Versions: isolation with the same signalling mechanism and settings.
js=js.replace('prototype.v4','prototype.v6').replace('signal-v4:','signal-v6:').replace('This release changes presentation, not the protocol or existing save keys.','The catalogue extends protocol 6; existing purchase/save keys are retained.').replace("version:'0.5.0'","version:'0.6.0'")
replace('world=new BuddyWorld(emit);','world=new BuddyWorld(emit);world.authorityId=myId;')
# Cosmetics on join restored only when room owns that appearance.
replace("net.send(id,'hello',{name:local.name,x:local.x,y:local.y});", "net.send(id,'hello',{name:local.name,x:local.x,y:local.y,style:Number(readStore('buddybonk-hand','0'))||0});",99)
# In-world visual customization and optional preview scene state.
replace("const scheme=[['#f0c571','#dca656','#f2dfab','#f37e56'],['#a9d4d2','#72adb7','#e2e7cc','#eebf61'],['#bf9fc6','#947ab0','#eddbdc','#6ebdc8']][skin%3];", "const scheme=(SKINS[skin]||SKINS[0]).colors;")
replace("this.rect(-22,-20,44,41,7,'#f4e6c3',INK,2.5);this.circle(0,0,12,null,scheme[3],3);this.line(-16,0,16,0,scheme[3],2);this.line(0,-15,0,15,scheme[3],2);this.circle(0,0,3,INK);\n  this.rect(-21,38,42,8,2,'#496776',INK,2);this.rect(-7,37,14,10,1,'#d5ddc9',INK,1.5);c.restore();", "this.bodyMark(skin,scheme);c.restore();")
replace('this.drawHat(this.visualState?.hat||0,t,head);','this.faceDetail(skin);this.drawHat(this.visualState?.hat||0,t,head);')
replace('this.toolCursor(h,t,worldTime);', 'this.handStyle=h[9]||0;this.toolCursor(h,t,worldTime);this.handStyle=0;')
replace('this.background(t,!!s?.low);','this.sceneTheme=s?.theme||0;this.background(t,!!s?.low);')
replace('if(n[6]===4||n[6]===5)this.extraProp(n,t);','if(n[6]>=4)this.extraProp(n,t);')
# Reuse the SAME contact capsule for a pan face, not an instant radial attack.
replace("this.rect(-32,-90,66,34,5,'#f4c75f',INK,3);", "if(h[7]==='pan'){this.circle(-11,-73,27,'#4e6571',INK,3);this.circle(-11,-73,20,'#81969b','#a5b8b5',2);this.line(-30,-81,-22,-87,'#d5dfcf',3);}else{this.rect(-32,-90,66,34,5,'#f4c75f',INK,3);")
replace("this.circle(6,-73,5,null,'#bd8b3f',1.5);", "this.circle(6,-73,5,null,'#bd8b3f',1.5);}")
# New sounds. No audio assets or downloaded files.
replace("function playEvent(e){", """function playEvent(e){
 if(e.type==='gunshot'){const big=['double','revolver'].includes(e.tool);beep(big?145:380,big?.14:.055,big?.07:.028,0,big?45:110);noise(big?.13:.04,big?.13:.04,big?2300:3700);return;}
 if(e.type==='reload'){beep(350,.045,.018,0,170);beep(440,.045,.018,e.duration*.75,230);return;}
 if(e.type==='spearThrow'||e.type==='starThrow'){noise(.09,.027,2200);return;}
 if(e.type==='throwHit'){beep(220,.07,.03,0,95);return;}
 if(e.type==='launchGrenade'){beep(90,.2,.06,0,40);noise(.08,.06,1700);return;}
""")
replace("if(e.type==='purchase'){toast(e.text);shopKey='';}","if(e.type==='purchase'||e.type==='look'){toast(e.text);shopKey='';}\n if(e.type==='swept'){toast(e.text);}")
# Cosmetic ownership is validated on hello; saved hand preference never buys itself.
replace("h.name=String(d?.name||'Helping Hand').slice(0,20);sendWelcome(id);", "h.name=String(d?.name||'Helping Hand').slice(0,20);const style=Number(d?.style)||0;h.style=HANDS[style]&&ownsLook(world.snapshot(),'hand',style)?style:0;sendWelcome(id);")
replace('world.upsertHand(myId,local.name,local.color);',"world.upsertHand(myId,local.name,local.color);{const style=Number(readStore('buddybonk-hand','0'))||0;world.hands.get(myId).style=HANDS[style]&&ownsLook(world.snapshot(),'hand',style)?style:0;}")

# Point projectiles remain pickable along their shaft and detach from an anchor on grab.
replace("for(let i=this.nodes.length-1;i>=0;i--){const n=this.nodes[i];if(Math.hypot(x-n.x,y-n.y)<=n.r+10)return {a:n.id,b:n.id,t:0};}","for(let i=this.nodes.length-1;i>=0;i--){const n=this.nodes[i];if(n.kind===6){const q=segmentPoint(x,y,n,{x:n.x-Math.cos(n.a)*110,y:n.y-Math.sin(n.a)*110});if(Math.hypot(x-q.x,y-q.y)<12)return {a:n.id,b:n.id,t:0};}if(Math.hypot(x-n.x,y-n.y)<=n.r+10)return {a:n.id,b:n.id,t:0};}")
replace("for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(Math.hypot(x-n[1],y-n[2])<=n[5]+10)return {a:n[0],b:n[0],t:0};}","for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(n[6]===6){const q=segmentPoint(x,y,{x:n[1],y:n[2]},{x:n[1]-Math.cos(n[7])*110,y:n[2]-Math.sin(n[7])*110});if(Math.hypot(x-q.x,y-q.y)<12)return {a:n[0],b:n[0],t:0};}if(Math.hypot(x-n[1],y-n[2])<=n[5]+10)return {a:n[0],b:n[0],t:0};}")
replace("if(p&&Math.hypot(p.x-nx,p.y-ny)<95)g=candidate;","if(p&&Math.hypot(p.x-nx,p.y-ny)<(this.node(candidate.a)?.kind===6?125:95))g=candidate;")
replace("forceRelease(h){this.cancelMallet(h);", "forceRelease(h){h.charge=null;h.burst=null;this.cancelMallet(h);")
replace("if(skin===", "if(skin===") if False else None
replace("finite(s.combo)&&finite(s.skin)&&", "finite(s.combo)&&Number.isInteger(s.skin)&&s.skin>=0&&s.skin<SKINS.length&&")
replace("const end={id:node?.id??-1,x:node?.x??x,y:node?.y??y};", "if(node?.stuck){node.stuck=null;node.im=1/node.m;}const end={id:node?.id??-1,x:node?.x??x,y:node?.y??y};")
replace("\'air\',\'tether\',\'bumper\'].includes(h[7])", "\'air\',\'tether\',\'bumper\',\'water\'].includes(h[7])")
# More patches and modules are applied in later part of build script.
# hook for local debugging source no user artifacts until final
if (ROOT/'world.js').exists(): replace('/* Original inline vector tool sprites.',(ROOT/'world.js').read_text()+'\n/* Original inline vector tool sprites.')
if (ROOT/'render.js').exists(): replace('/* Application / authority boundary.',(ROOT/'render.js').read_text()+'\n/* Application / authority boundary.')
# Further application/UI patch is loaded as python with access to replace/section/js/html.
if (ROOT/'ui_patch.py').exists(): exec((ROOT/'ui_patch.py').read_text())
full=html+js+tail
full=full.replace('v0.5.0','v0.6.0').replace('"softwareVersion":"0.5.0"','"softwareVersion":"0.6.0"').replace('Protocol 05','Protocol 06').replace('Twenty-one tools','Thirty-one tools').replace('Twenty-one','Thirty-one')
(ROOT/'index.html').write_text(full)
(ROOT/'build.js').write_text(js)
print('built',len(full),'characters',len(js.splitlines()),'JS lines')
