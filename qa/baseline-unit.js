()=>{
 const {world:current,constants:BB,codec,validSnapshot}=__buddy.test,W=current().constructor,checks=[],metrics={};
 const check=(name,ok,data)=>checks.push({name,pass:!!ok,...(data===undefined?{}:{details:data})});
 let events=[];
 const make=()=>{events=[];const w=new W(e=>events.push(e));w.time=5;w.tick=600;w.lastTouch=5;w.sandbox=true;w.upsertHand('h','Tester','#ef6548');return w;};
 const input=(w,x,y,tool,down)=>{const h=w.hands.get('h');w.input('h',{x,y,tool,down,s:h.seq+1});};
 const run=(w,n)=>{for(let i=0;i<n;i++){for(const h of w.hands.values())h.seen=performance.now();w.step();}};
 const healthy=w=>w.nodes.every(n=>[n.x,n.y,n.vx,n.vy].every(Number.isFinite))&&w.nodes.length<=BB.MAX_NODES;
 const wire=w=>{const s={...w.snapshot(),q:1};return codec.decode(codec.encode(s));};
 let w=make();check('Original railgun index / unlock bit preserved',Object.keys(__buddy.test.tools).indexOf('rail')===18);
 check('Two new tools appended; exactly 21 tools',Object.keys(__buddy.test.tools).length===21);
 check('New controls do not create extra physics bodies',w.nodes.length===16);
 check('Clean snapshot round-trips / validates',validSnapshot(wire(w)));
 // Bumper contact: real falling prop must reverse velocity, not simply emit an effect.
 w=make();w.placeBumper(320,500,'h');const ball=w.addBall(320,420,false);ball.vy=750;run(w,12);
 check('Bumper reverses incoming basketball velocity',ball.vy<-400,{vy:ball.vy,events:events.map(e=>e.type)});
 check('Bumper collision produces bounded contact cue',events.some(e=>e.type==='bumperHit'));
 check('Bumper does not add a dynamic/static physics node',w.nodes.length===17);
 check('Bumper shot does not hurt untouched Buddy',w.injuries.every(d=>d.bruise===0));
 check('Bumper click toggles remove',!!w.bumpers.length);w.placeBumper(320,500,'h');check('Bumper removed without stale collider',w.bumpers.length===0);
 w=make();w.placeBumper(640,598,'h');w.lastTouch=5;for(const n of w.nodes.slice(0,13)){n.y-=130;n.vy=600;}
 run(w,24);const avg=w.nodes.slice(0,13).reduce((v,n)=>v+n.vy,0)/13;
 check('Bumper launches Buddy as a connected body',avg<-300,{meanVy:avg});check('Body stays finite on bumper launch',healthy(w));
 // Tether two clicks, cancellation, owner independence, deletion and cap.
 w=make();input(w,640,341,'tether',true);input(w,640,341,'tether',false);run(w,16);input(w,670,160,'tether',true);input(w,670,160,'tether',false);
 check('Two clicks create Buddy-to-wall rope',w.tethers.length===1&&w.tethers[0][1]===0&&w.tethers[0][2]===-1,w.tethers);
 const count=w.nodes.length;run(w,240);
 let r=w.tethers[0],a=w.node(r[1]);let stretch=Math.hypot(a.x-r[5],a.y-r[6])-r[7];
 check('Wall rope restrains the endpoint',stretch<8,{excess:stretch});check('Rope has no segments or anchor bodies',w.nodes.length===count);
 check('Tether snapshot round-trip',JSON.stringify(wire(w).ropes)===JSON.stringify(w.snapshot().ropes));
 w=make();const aBall=w.nodes[13],bBall=w.nodes[14];input(w,aBall.x,aBall.y,'tether',true);input(w,aBall.x,aBall.y,'tether',false);run(w,16);input(w,bBall.x,bBall.y,'tether',true);input(w,bBall.x,bBall.y,'tether',false);
 check('Prop-to-prop tether creates correct endpoints',w.tethers.length===1&&w.tethers[0][1]===aBall.id&&w.tethers[0][2]===bBall.id);
 const nodesBefore=w.nodes.length;w.removeNode(aBall.id);check('Removing a prop removes its ropes',!w.tethers.length&&w.nodes.length===nodesBefore-1);
 w=make();const h=w.hands.get('h');h.x=640;h.y=341;w.tetherClick(h,{a:0,b:0,t:0});w.command('h',{c:'cancelTether'});check('Cancel clears pending tether',!h.tetherStart);
 w=make();for(let i=0;i<20;i++){const h=w.hands.get('h');h.x=640;h.y=341;w.tetherClick(h,{a:0,b:0,t:0});h.x=100+i*45;h.y=115;w.tetherClick(h,null);}
 check('Tethers capped at 12',w.tethers.length===BB.MAX_TETHERS,{count:w.tethers.length});
 w=make();for(let i=0;i<16;i++)w.placeBumper(120+(i%8)*140,125+Math.floor(i/8)*100,'h');check('Bumpers capped at 8',w.bumpers.length===BB.MAX_BUMPERS);
 w.clearProps();check('Clear removes bumpers, ropes, toys, springs and candy',!w.tethers.length&&!w.bumpers.length&&!w.candies.length&&!w.pads.length&&w.nodes.length===13);
 // Workshop saves and cosmetic hat generation.
 w=make();w.hat=3;w.unlocked|=1<<18;const saved=w.workshopSnapshot();w.reset();check('Reset preserves railgun unlock and shared hat',w.hat===3&&!!(w.unlocked&(1<<18)));
 const other=new W();other.loadWorkshop(saved);check('Workshop save/load preserves hat and purchases',other.hat===3&&other.unlocked===saved.unlocked);
 check('Hat round-trip',wire(w).hat===3);
 // All nineteen old tools still have effects; empty mallet must be truly empty.
 w=make();input(w,950,220,'poke',true);input(w,950,220,'poke',false);run(w,60);
 check('Empty mallet has no wound, dizzy state or bonk cue',w.injuries.every(d=>d.bruise===0)&&w.dazeUntil<w.time&&!events.some(e=>e.type==='poke'));
 w=make();input(w,640,309,'poke',true);input(w,640,309,'poke',false);
 check('Mallet causes no button-down damage',!events.some(e=>e.type==='hurt'));run(w,60);check('Mallet lands exactly once after wind-up',events.filter(e=>e.type==='poke').length===1);
 // Full physical budget still enforced.
 w=make();for(let i=0;i<48;i++)w.addBall(110+(i%8)*90,200+Math.floor(i/8)*50,false);
 check('Basketball cap preserved',w.nodes.filter(n=>n.kind===1).length===32);
 for(const kind of [2,3,4,5])for(let i=0;i<45;i++)w.makeProp(kind,200+(i%10)*80,170+(i%5)*65,kind===5?32:22,1,false);
 check('Combined body ceiling preserved',w.nodes.length===88,{nodes:w.nodes.length});
 w.dropCandy(600,200,200);check('Candy cap preserved',w.candies.length===96);
 for(let i=0;i<8;i++)w.placeBumper(110+i*150,105,'h');
 for(let i=0;i<12;i++)w.tethers.push([w.nextId++,i,-1,w.nodes[i].x,w.nodes[i].y,110+i*90,95,700]);
 const encoded=codec.encode({...w.snapshot(),q:10});metrics.fullSnapshotBytes=encoded.byteLength;
 check('Full-cap snapshot under hard byte limit',encoded.byteLength<BB.MAX_SNAPSHOT,{bytes:encoded.byteLength});check('Full-cap snapshot validates',validSnapshot(codec.decode(encoded)));
 // Worst contact overlap has no static/static division by zero.
 run(w,360);check('Full-cap collision/rope/bumper scene stays finite',healthy(w));
 // Fixed seed broad weapon soak with repeatedly repaired Buddy.
 w=make();let maxError=0;const tools=['poke','blaster','bomb','rocket','shock','magnet','ball','balloon','spring','shotgun','saw','flame','freeze','dart','air','duck','bowling','rail'];
 for(let i=0;i<3600;i++){
  if(i%180===0){w.clearProps();w.repair();w.hands.get('h').down=false;const tool=tools[(i/180)%tools.length|0];input(w,640+Math.sin(i)*50,400,tool,true);}
  for(const h of w.hands.values())h.seen=performance.now();w.step();
  if(!healthy(w)){check('3600-step mixed weapon soak stays finite',false,{step:i});return {checks,metrics};}
  if(i%30===0)maxError=Math.max(maxError,...w.joints.map(j=>Math.abs(Math.hypot(w.nodes[j.a].x-w.nodes[j.b].x,w.nodes[j.a].y-w.nodes[j.b].y)-j.l)));
 }
 check('3600-step mixed weapon soak stays finite',true);metrics.maxJointError=maxError;
 return {checks,metrics};
}
