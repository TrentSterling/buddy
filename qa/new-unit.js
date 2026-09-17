()=>{
 const {world:current,constants:BB,codec,validSnapshot}=__buddy.test,W=current().constructor,checks=[],metrics={},TOOLS=__buddy.test.tools;
 const check=(name,ok,details)=>checks.push({name,pass:!!ok,details});let events=[];
 const make=()=>{events=[];const w=new W(e=>events.push(e));w.time=5;w.tick=600;w.lastTouch=5;w.sandbox=true;w.authorityId='h';w.upsertHand('h','Tront','#ef6548');return w;};
 const input=(w,x,y,tool,down,cancel=false)=>{const h=w.hands.get('h');w.input('h',{x,y,tool,down,cancel,s:h.seq+1});};
 const run=(w,n)=>{for(let i=0;i<n;i++){for(const h of w.hands.values())h.seen=performance.now();w.step();}};
 const healthy=w=>w.nodes.every(n=>[n.x,n.y,n.vx,n.vy].every(Number.isFinite))&&w.nodes.length<=BB.MAX_NODES;
 let w=make(),h=w.hands.get('h');
 check('Protocol upgraded to 7 (v0.8 wire format: hand style, theme, looks)',BB.VERSION===7);check('Tool IDs preserve all 21 prior positions',Object.keys(TOOLS).slice(18,21).join(',')==='rail,tether,bumper');
 for(const tool of Object.keys(TOOLS)){
  w=make();input(w,642,393,tool,true);run(w,90);input(w,650,382,tool,false);run(w,150);
  check('Tool runs finite: '+tool,healthy(w),{nodes:w.nodes.length,events:[...new Set(events.map(e=>e.type))]});
 }
 // Confirm gun cadences and triggered hits, not just a mesh under the cursor.
 for(const tool of ['revolver','smg','burst','double','minigun']){
  w=make();input(w,640,340,tool,true);run(w,145);
  check(tool+' has authoritative bullets and damage',events.some(e=>e.type==='gunshot')&&events.some(e=>e.type==='hurt'),{shots:events.filter(e=>e.type==='gunshot').length});
 }
 w=make();input(w,1000,150,'burst',true);input(w,1000,150,'burst',false);run(w,28);check('Burst completes three rounds after a quick tap',events.filter(e=>e.type==='gunshot').length===3);
 w=make();input(w,1000,150,'burst',true);input(w,1000,150,'burst',false,true);run(w,28);check('UI cancel stops unresolved burst shots',events.filter(e=>e.type==='gunshot').length===1);
 w=make();input(w,1000,150,'minigun',true);run(w,30);check('Minigun genuinely spools before firing',!events.some(e=>e.type==='gunshot'));run(w,30);check('Minigun fires after spool',events.some(e=>e.type==='gunshot'));
 w=make();input(w,1000,150,'double',true);run(w,55);check('Double barrel empties two shots then reloads',events.filter(e=>e.type==='gunshot').length===2&&events.some(e=>e.type==='reload'));run(w,145);check('Double barrel resumes after reload',events.filter(e=>e.type==='gunshot').length>2);
 // Spear charge/release, stick, auto-recall and protected possessions.
 w=make();input(w,640,341,'spear',true);run(w,70);check('Charged spear does not spawn while held',!w.nodes.some(n=>n.kind===6));w.stand();input(w,640,341,'spear',false);check('Release throws one physical spear',w.nodes.filter(n=>n.kind===6).length===1);run(w,30);check('Spear embeds on a host-resolved hit',w.nodes.some(n=>n.kind===6&&n.stuck),w.nodes.filter(n=>n.kind===6).map(n=>({x:n.x,y:n.y,stuck:n.stuck})));check('Spear hit damages Buddy',events.some(e=>e.type==='hurt'));
 w=make();input(w,640,341,'spear',true);run(w,35);input(w,640,341,'spear',false,true);run(w,30);check('Cancelled spear charge does not throw',!w.nodes.some(n=>n.kind===6));
 w=make();h=w.hands.get('h');h.x=1000;h.y=220;w.throwSpear(h,.5);let a=w.nodes.find(n=>n.kind===6);run(w,40);w.throwSpear(h,.5);let b=w.nodes.filter(n=>n.kind===6).at(-1);run(w,40);w.throwSpear(h,.5);check('Third spear recycles oldest of two',w.nodes.filter(n=>n.kind===6).length===2&&!w.node(a.id)&&!!w.node(b.id));
 w=make();h=w.hands.get('h');h.x=1000;h.y=220;w.throwSpear(h,.5);a=w.nodes.find(n=>n.kind===6);run(w,40);w.throwSpear(h,.5);b=w.nodes.filter(n=>n.kind===6).at(-1);const other=w.upsertHand('g','Friend','#42bbc3');other.grip={a:a.id,b:a.id,t:0};w.tethers.push([999,b.id,-1,b.x,b.y,1050,140,100]);run(w,40);w.throwSpear(h,.5);check('Recycling does not steal a held or tethered spear',!!w.node(a.id)&&!!w.node(b.id)&&w.nodes.filter(n=>n.kind===6).length===2);
 w=make();h=w.hands.get('h');for(let i=0;i<120;i++){h.x=950;h.y=220;w.spawnOwner='h';w.addBall(180+(i%20)*44,240,false);}
 check('Basketballs recycle at 32 instead of refusing new toys',w.nodes.filter(n=>n.kind===1).length===32&&w.nextId>215,{lastId:w.nextId});
 a=w.nodes.find(n=>n.kind===1);h.grip={a:a.id,b:a.id,t:0};for(let i=0;i<45;i++)w.addBall(300,300,false);check('Held ball survives repeated automatic recycling',!!w.node(a.id));
 const protectedId=w.nodes.find(n=>n.kind===1&&n.id!==a.id).id;w.tethers.push([555,protectedId,-1,300,300,300,120,180]);w.spawnOwner='h';const bomb=w.makeProp(2,400,200,19,1);bomb.fuse=w.time+1.5;w.pads.push({id:99,x:640,kick:-10});w.placeBumper(200,500,'h');w.sweep();
 check('Sweep preserves held toys, tethers, bumpers and springs',w.node(a.id)&&w.node(protectedId)&&w.tethers.length===1&&w.pads.length===1&&w.bumpers.length===1);check('Sweep does not erase live explosives',!!w.node(bomb.id));check('Sweep actually removes loose clutter',w.nodes.filter(n=>n.kind===1).length===2);
 w=make();w.sandbox=false;w.cash=1000;w.earned=1000;w.lookCommand('h','buylook:body:2');w.lookCommand('h','buylook:hat:12');w.lookCommand('h','buylook:room:5');w.lookCommand('h','buylook:hand:2');check('Cosmetics purchase and equip with shared cash',w.skin===2&&w.hat===12&&w.theme===5&&w.hands.get('h').style===2&&w.cash===660,{cash:w.cash});
 w.upsertHand('g','Friend','#42bbc3');w.lookCommand('g','look:hand:2');check('Purchased hand is room-unlocked but individually equipped',w.hands.get('g').style===2);w.lookCommand('g','look:room:0');check('Guest cannot replace the shared room',w.theme===5);w.lookCommand('g','look:hat:11');check('Unbought cosmetic cannot be equipped for free',w.hat===12);
 let saved=w.workshopSnapshot();w.reset();check('Room cleanup/reset preserves hats, body, theme and unlocks',w.hat===12&&w.skin===2&&w.theme===5&&w.looks===saved.looks);let restored=new W();restored.loadWorkshop(saved);check('Cosmetic ownership and theme survive save/load',restored.theme===5&&restored.skin===2&&restored.hat===12&&restored.looks===saved.looks);
 const s={...w.snapshot(),q:123};let packed=codec.encode(s),decoded=codec.decode(packed);check('All cosmetic fields and per-player hand styles round-trip',decoded.looks===s.looks&&decoded.theme===5&&decoded.skin===2&&decoded.hat===12&&decoded.h[0][9]===2&&validSnapshot(decoded));metrics.smallSnapshotBytes=packed.length;
 // Corner-case bit31 (moon room) must survive unsigned packing.
 w=make();w.sandbox=false;w.cash=5000;for(const [type,count] of [['body',6],['hat',14],['hand',6],['room',6]])for(let i=0;i<count;i++)w.lookCommand('h','buylook:'+type+':'+i);
 check('All 32 cosmetic unlock bits fit unsigned field',w.looks===0xffffffff&&validSnapshot(codec.decode(codec.encode({...w.snapshot(),q:1}))));
 // Full-cap layouts always serialise below the hard cap, rejecting malicious state.
 w=make();for(let i=0;i<120;i++){w.spawnOwner='h';w.makeProp(1,200+(i%8)*100,250,25,1,false);}for(let i=0;i<30;i++)w.makeProp(4,250,300,26,.7,false);for(let i=0;i<30;i++)w.makeProp(5,350,300,32,4.2,false);for(let i=0;i<30;i++)w.makeProp(3,400,300,24,.65,false);for(let i=0;i<16;i++){const n=w.makeProp(2,450,300,19,1,false);if(n)n.fuse=999;}for(let i=0;i<4;i++){const who='guest'+i;w.upsertHand(who,'Guest Name','#42bbc3');w.spawnOwner=who;for(let j=0;j<2;j++)w.makeProp(6,500,220,8,.62,false);}for(let i=0;i<32;i++)w.makeProp(7,500,250,12,.32,false);
 w.dropCandy(600,300,150);for(let i=0;i<12;i++)w.tethers.push([w.nextId++,i,-1,640,400,200+i*60,150,400]);for(let i=0;i<8;i++){w.pads.push({id:w.nextId++,x:150+i*130,kick:-10});w.placeBumper(130+i*140,100,'h');}for(let i=0;i<16;i++)w.projectiles.push({id:w.nextId++,x:100,y:200,vx:500,vy:0,owner:'guest1',life:5});
 packed=codec.encode({...w.snapshot(),q:1});metrics.saturatedSnapshotBytes=packed.length;check('Saturated snapshot remains under 6144 bytes',packed.length<=BB.MAX_SNAPSHOT);check('Full-budget state validates',validSnapshot(codec.decode(packed)));check('Hard physics ceiling remains 88',w.nodes.length<=88);let bad=codec.decode(packed);bad.theme=255;check('Invalid room appearance rejected',!validSnapshot(bad));
 // Water only sends tiny clearing commands, not the full stain history.
 w=make();w.burnUntil=10;w.stains=[[1,640,341,10,0,70,1,555,0],[2,150,500,10,0,70,1,456,0]];h=w.hands.get('h');h.x=640;h.y=341;w.waterSpray(h);check('Water extinguishes Buddy and spot-cleans stains',w.burnUntil===0&&w.stains.length===1);let wash=events.find(e=>e.type==='washPatch');check('Water cleaning emits compact cue rather than stain snapshots',wash&&JSON.stringify(wash).length<100&&!events.some(e=>e.type==='stainSync'),wash);
 // Spear/pan/shuriken/guns survive mixed long-duration interactions.
 w=make();const tools=Object.keys(TOOLS);for(let i=0;i<9300;i++){if(i%300===0){w.clearProps();w.repair();h=w.hands.get('h');h.down=false;input(w,640+Math.sin(i*.6)*45,350+(i%4)*25,tools[(i/300)|0],true);}if(i%300===80&&h.tool==='spear')input(w,650,340,'spear',false);for(const hand of w.hands.values())hand.seen=performance.now();w.step();if(!healthy(w)){check('9300-step all-weapon soak',false,{step:i,tool:h.tool});return {checks,metrics};}}
 check('9300-step all-weapon soak',true);return {checks,metrics};
}
