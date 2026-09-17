(()=>{
'use strict';
/* Buddy Bonk physics: bounded 2D point-mass / distance-constraint solver.
   Only the room host steps this world. Guests render absolute snapshots.
   World units are pixels; velocity is pixels/second. No external physics runtime. */
const BB = Object.freeze({W:1280,H:720,FLOOR:646,LEFT:36,RIGHT:1244,TOP:66,HZ:120,SNAP_HZ:30,MAX_BALLS:32,MAX_PLAYERS:4,MAX_NODES:88,MAX_BOMBS:12,MAX_BALLOONS:16,MAX_DUCKS:12,MAX_BOWLING:8,MAX_CANDY:96,MAX_ROCKETS:16,MAX_PADS:8,MAX_STAINS:96,MAX_TETHERS:12,MAX_BUMPERS:8,MAX_SNAPSHOT:6144,SNAPSHOT_BPS:57344,VERSION:5});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const round=x=>Math.round(x*10)/10;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const PALETTE=['#ef6548','#42bbc3','#be80ef','#efc843'];
// These are game tools, not independent client-side effects. The host executes all uses.
const TOOLS=Object.freeze({
 grab:{name:'GRAB',key:'1',hint:'DRAG TO GRAB · RELEASE TO THROW',rate:0},
 poke:{name:'MALLET',key:'2',hint:'HOLD TO SWING · HIT BALLS, BOMBS OR BUDDY',rate:.46},
 blaster:{name:'BLASTER',key:'3',hint:'HOLD TO FIRE AT THE CROSSHAIR',rate:.105},
 bomb:{name:'BOMB',key:'4',hint:'CLICK TO DROP · RIGHT-DRAG TO THROW BEFORE IT BLOWS',rate:.48},
 rocket:{name:'ROCKET',key:'5',hint:'HOLD TO LAUNCH · ROCKETS FLY IN FROM THE SIDE',rate:.65},
 shock:{name:'TESLA',key:'6',hint:'HOLD TO ZAP · POP BALLOONS & DETONATE BOMBS',rate:.11},
 magnet:{name:'MAGNET',key:'7',hint:'HOLD TO PULL BUDDY, TOYS AND CANDY',rate:.08},
 ball:{name:'BASKETBALL',key:'8',hint:'CLICK TO DROP A BALL · RIGHT-DRAG TO THROW',rate:.35},
 balloon:{name:'BALLOON',key:'9',hint:'CLICK A LIMB OR TOY TO TIE ON A BALLOON',rate:.45},
 spring:{name:'SPRING',key:'0',hint:'CLICK TO PLACE A SPRING ON THE FLOOR',rate:.4},
 shotgun:{name:'SHOTGUN',key:'q',hint:'HOLD TO FIRE · SEVEN PELLETS, ONE BIG KICK',rate:.6,cost:35},
 saw:{name:'CHAINSAW',key:'w',hint:'HOLD AGAINST BUDDY · RIGHT-DRAG TO REPOSITION',rate:.085,cost:65},
 flame:{name:'FLAMETHROWER',key:'f',hint:'HOLD TO IGNITE · BURNS LINGER · CRYO EXTINGUISHES',rate:.10,cost:95},
 freeze:{name:'CRYO',key:'x',hint:'FREEZE HIM SOLID · HIT THE ICE TO SHATTER',rate:.14,cost:115},
 dart:{name:'DARTS',key:'t',hint:'CLICK TO THROW · DARTS STICK TO BUDDY',rate:.32,cost:45},
 air:{name:'AIR CANNON',key:'a',hint:'A WIDE AIR BLAST · LAUNCH BUDDY, TOYS AND CANDY',rate:.62,deck:'lab'},
 duck:{name:'RUBBER DUCK',key:'k',hint:'DROP A SQUEAKY DUCK · GRAB, THROW OR BALLOON IT',rate:.36,deck:'lab'},
 bowling:{name:'BOWLING BALL',key:'o',hint:'DROP A HEAVY BALL · THROW IT THROUGH THE CHAOS',rate:.48,deck:'lab'},
 rail:{name:'RAILGUN',key:'l',hint:'A PIERCING SHOT · LINE UP BUDDY AND HIS TOYS',rate:.82,cost:145,deck:'lab'},
 tether:{name:'TETHER GUN',key:'j',hint:'CLICK TWO ENDS: BUDDY, A PROP OR THE WALL · CLICK A ROPE TO CUT',rate:.12,deck:'lab'},
 bumper:{name:'BUMPER',key:'v',hint:'CLICK TO PLACE · CLICK AN EXISTING BUMPER TO REMOVE',rate:.24,deck:'lab'}

});
const TOOL_IDS=Object.keys(TOOLS);
const STARTER_MASK=((1<<10)-1)|(1<<15)|(1<<16)|(1<<17)|(1<<19)|(1<<20), ALL_TOOL_MASK=(1<<TOOL_IDS.length)-1;
const UPGRADES=[{id:'power',name:'HEAVY HANDS',info:'+15% knockback per level',prices:[70,150,300]},
 {id:'payout',name:'PAYDAY',info:'+25% hit payout per level',prices:[60,130,260]},
 {id:'pickup',name:'CANDY VAC',info:'+25% candy vacuum reach per level',prices:[45,100,200]}];
const DAMAGE=Object.freeze({bullet:1,blunt:2,burn:3,cut:4,dart:5});
// Shared seed -> local visual expansion. The host never creates blood rigidbodies.
function seeded(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};}
const TASKS=[{title:'AIR TIME',goal:4,unit:'s'},{title:'MAKE 2 BASKETS',goal:2,unit:''},{title:'POP 3 BALLOONS',goal:3,unit:''},{title:'BLAST BUDDY 3 TIMES',goal:3,unit:''}];
const BASE_POSE=[
 [640,341,43,1.4],[640,408,26,1.8],[640,480,23,1.8],
 [610,402,13,.65],[575,448,13,.65],[550,490,16,.65],
 [670,402,13,.65],[705,448,13,.65],[730,490,16,.65],
 [617,546,14,.85],[603,610,18,.95],[663,546,14,.85],[677,610,18,.95]
];
const LIMBS=[[3,4,13],[4,5,12],[6,7,13],[7,8,12],[2,9,15],[9,10,13],[2,11,15],[11,12,13]];
const JOINT_DEFS=[[0,1],[1,2],[1,3],[1,6],[3,6],[3,2],[6,2],[3,4],[4,5],[6,7],[7,8],[2,9],[9,10],[2,11],[11,12]];
// Bending limits and self-contact preserve a body silhouette, not a bag of points.
// Chord limits constrain the angle at the middle node without locking the pose.
const BEND_DEFS=[[0,1,2,128],[3,4,5,42],[6,7,8,42],[2,9,10,58],[2,11,12,58]];
const SELF_PAIRS=[];
for(let a=0;a<13;a++)for(let b=a+1;b<13;b++){
 if(JOINT_DEFS.some(j=>(j[0]===a&&j[1]===b)||(j[0]===b&&j[1]===a)))continue;
 const ra=BASE_POSE[a][2],rb=BASE_POSE[b][2],d=Math.hypot(BASE_POSE[a][0]-BASE_POSE[b][0],BASE_POSE[a][1]-BASE_POSE[b][1]);
 // Some torso masses overlap by construction. Keep only compatible contacts.
 if(d>=ra+rb+1)SELF_PAIRS.push([a,b]);
}
const PROP_CAPS={1:BB.MAX_BALLS,2:BB.MAX_BOMBS,3:BB.MAX_BALLOONS,4:BB.MAX_DUCKS,5:BB.MAX_BOWLING};
const PROP_NAMES={1:'Basketballs',2:'Bombs',3:'Balloons',4:'Rubber ducks',5:'Bowling balls'};
const segmentPoint=(x,y,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;const t=l?clamp(((x-a.x)*dx+(y-a.y)*dy)/l,0,1):0;return {x:a.x+dx*t,y:a.y+dy*t,t};};
// One mallet definition for BOTH animation and contact. No simulated hammer body.
// Times are seconds; action cues carry integer authority ticks, not rounded snapshot time.
const MALLET=Object.freeze({WIND:.100,ACTIVE:.108,CONTACT:.185,END:.46,HOLD:.027,FACE_R:3.5,REST:-.18,BACK:.48,STRIKE:-.98});
const smooth01=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function malletAngle(age,contactAge=null,cancelAge=null){
 const travel=a=>a<MALLET.WIND?lerp(MALLET.REST,MALLET.BACK,smooth01(a/MALLET.WIND)):
  lerp(MALLET.BACK,MALLET.STRIKE,Math.pow(clamp((a-MALLET.WIND)/(MALLET.CONTACT-MALLET.WIND),0,1),1.65));
 if(cancelAge!==null&&age>=cancelAge)return lerp(travel(cancelAge),MALLET.REST,smooth01((age-cancelAge)/.12));
 if(contactAge!==null&&age>=contactAge){
  const hit=travel(contactAge),d=age-contactAge;
  if(d<MALLET.HOLD)return hit;
  if(d<MALLET.HOLD+.085)return lerp(hit,hit+.36,smooth01((d-MALLET.HOLD)/.085));
  return lerp(hit+.36,MALLET.REST,smooth01((d-MALLET.HOLD-.085)/.16));
 }
 if(age<=MALLET.CONTACT)return travel(age);
 if(age<.250)return lerp(MALLET.STRIKE,-1.40,smooth01((age-MALLET.CONTACT)/(.250-MALLET.CONTACT)));
 return lerp(-1.40,MALLET.REST,smooth01((age-.250)/.18));
}
function malletPose(x,y,side,age,contactAge=null,cancelAge=null){
 const a=malletAngle(age,contactAge,cancelAge),c=Math.cos(a),sn=Math.sin(a),hit=MALLET.STRIKE;
 // The RED END of the barrel lands at the aim point, not the handle or centre.
 const px=x-side*(-33*Math.cos(hit)+73*Math.sin(hit)),py=y-(-33*Math.sin(hit)-73*Math.cos(hit));
 const point=(u,v)=>({x:px+side*(u*c-v*sn),y:py+u*sn+v*c});
 const f=point(-33,-73);
 return {a,px,py,side,face:f,A:point(-33,-89),B:point(-33,-57),point};
}
function segmentClosest(a,b,c,d){
 const ux=b.x-a.x,uy=b.y-a.y,vx=d.x-c.x,vy=d.y-c.y,den=ux*vy-uy*vx;
 if(Math.abs(den)>1e-8){const wx=c.x-a.x,wy=c.y-a.y,t=(wx*vy-wy*vx)/den,u=(wx*uy-wy*ux)/den;
  if(t>=0&&t<=1&&u>=0&&u<=1){const p={x:a.x+ux*t,y:a.y+uy*t};return {a:p,b:p,t:u,d:0};}}
 const choices=[];
 for(const p of [a,b]){const q=segmentPoint(p.x,p.y,c,d);choices.push({a:p,b:q,t:q.t,d:Math.hypot(p.x-q.x,p.y-q.y)});}
 for(const [p,t] of [[c,0],[d,1]]){const q=segmentPoint(p.x,p.y,a,b);choices.push({a:q,b:p,t,d:Math.hypot(p.x-q.x,p.y-q.y)});}
 return choices.reduce((p,q)=>q.d<p.d?q:p);
}
class BuddyWorld {
 constructor(onEvent=()=>{}){this.onEvent=onEvent;this.hands=new Map();this.nodes=[];this.joints=[];this.tick=0;this.time=0;this.gen=0;this.score=0;this.lowGravity=false;this.nextId=100;this.lastTouch=-10;this.impact=0;this.reset();}
 reset(){
  const workshop=this.workshopSnapshot?.();
  this.gen++;this.nodes=[];this.score=0;this.tick=0;this.time=0;this.lowGravity=false;this.nextId=100;this.lastTouch=-10;this.impact=0;
  this.projectiles=[];this.candies=[];this.pads=[];this.bonds=[];this.tethers=[];this.bumpers=[];this.hat=workshop?.hat??0;this.lastBumperFX=-10;this.swingSerial=0;this.lastSpring=-10;this.lastLimit=-10;this.lastToyHit=-10;
  this.injuries=Array.from({length:13},()=>({bruise:0,scorch:0,cuts:0,darts:0}));
  this.stains=[];this.stainEpoch=0;this.damageSerial=0;this.lastBlood=-10;
  this.burnUntil=0;this.frozenUntil=0;this.dazeUntil=0;this.hurtUntil=0;this.nextBurn=0;this.iceJoints=[];
  this.cash=workshop?.cash??40;this.earned=workshop?.earned??0;this.unlocked=workshop?.unlocked??STARTER_MASK;
  this.upgrades=workshop?.upgrades?.slice()||[0,0,0];this.sandbox=workshop?.sandbox??false;
  this.rewardRun=0;this.lastDamageWho='';this.nextOuch=0;
  this.candy=0;this.combo=0;this.bestCombo=0;this.comboUntil=0;this.lastReward=-10;
  this.lastRewarder='';this.lastTool='';this.shockUntil=0;this.skin=0;this.airtime=0;this.bestAir=0;
  this.taskIndex=0;this.taskProgress=0;this.taskDone=false;this.taskBaseScore=0;this.taskPops=0;this.taskBlasts=0;
  BASE_POSE.forEach(([x,y,r,m],id)=>this.nodes.push({id,x,y,vx:0,vy:0,r,m,im:1/m,kind:0,a:0,lastBounce:-1,lastScore:-5,ox:x,oy:y}));
  this.joints=JOINT_DEFS.map(([a,b])=>({a,b,l:dist(this.nodes[a],this.nodes[b])}));
  this.bends=BEND_DEFS.map(([a,b,c,angle])=>{const ab=dist(this.nodes[a],this.nodes[b]),bc=dist(this.nodes[b],this.nodes[c]);return {a,b:c,l:Math.sqrt(ab*ab+bc*bc-2*ab*bc*Math.cos(angle*Math.PI/180))};});
  for(const h of this.hands.values()){h.grip=null;h.down=false;h.seq=-1;h.blockDown=false;h.nextFire=0;h.cooldowns={};h.lastUse=-10;h.lastCmd=-10;h.mallet=null;h.tetherStart=null;}
  this.addBall(401,530,false);this.addBall(865,545,false);this.addBall(967,578,false);
 }
 node(id){return this.nodes.find(n=>n.id===id);}
 limit(text){if(this.time-this.lastLimit>.8){this.lastLimit=this.time;this.onEvent({type:'limit',text});}}
 reserve(kind,event=true){
  const cap=PROP_CAPS[kind];if(!cap)return false;
  if(this.nodes.filter(n=>n.kind===kind).length>=cap){if(event)this.limit(PROP_NAMES[kind]+' limit: '+cap+'. Clear toys to make room.');return false;}
  if(this.nodes.length>=BB.MAX_NODES){if(event)this.limit('Room body budget reached ('+BB.MAX_NODES+'). Clear some toys.');return false;}return true;
 }
 addBall(x=400,y=300,event=true){
  const n=this.makeProp(1,x,y,25,1,event);if(n){n.vy=-60;if(event)this.onEvent({type:'spawn',x:n.x,y:n.y,id:n.id});}return n;
 }
 addToy(kind,x,y,who=''){
  const n=this.makeProp(kind,x,y,kind===4?26:32,kind===4?.7:4.2);if(!n)return null;
  n.owner=who;n.vy=-55;n.spin=0;n.lastToyHit=-10;
  this.onEvent({type:'toy',kind,x:n.x,y:n.y,who});return n;
 }

 stand(){
  for(const h of this.hands.values())this.cancelMallet(h);
  for(const n of this.nodes.filter(n=>!n.kind)){const p=BASE_POSE[n.id];n.x=p[0];n.y=p[1];n.vx=0;n.vy=0;n.ox=n.x;n.oy=n.y;}
  for(const h of this.hands.values())if(h.grip&&this.node(h.grip.a)?.kind===0){this.forceRelease(h);}
  this.lastSpring=-10;this.lastTouch=this.time-5;this.onEvent({type:'stand',x:640,y:340});
 }
 upsertHand(id,name,color){
  let h=this.hands.get(id);
  if(!h&&this.hands.size>=BB.MAX_PLAYERS)return null;
  if(!h){h={id,name:String(name).slice(0,20),color,x:400,y:320,tx:400,ty:320,down:false,grip:null,blockDown:false,tool:'grab',seq:-1,seen:performance.now(),lastMove:0,dx:0,dy:0,lastCmd:-10,nextFire:0,lastUse:-10};this.hands.set(id,h);}
  h.name=String(name||h.name).slice(0,20);h.color=color||h.color;return h;
 }
 removeHand(id){const h=this.hands.get(id);if(h)this.cancelMallet(h);this.hands.delete(id);}
 pick(x,y){
  for(let i=this.nodes.length-1;i>=0;i--){const n=this.nodes[i];if(Math.hypot(x-n.x,y-n.y)<=n.r+10)return {a:n.id,b:n.id,t:0};}
  let best=null,bestD=Infinity;
  for(const [ai,bi,r] of [...LIMBS,[0,1,17],[1,2,27],[3,6,20]]){
   const a=this.node(ai),b=this.node(bi),q=segmentPoint(x,y,a,b),d=Math.hypot(q.x-x,q.y-y);
   if(d<r+10&&d<bestD){bestD=d;best={a:ai,b:bi,t:q.t};}
  }return best;
 }
 gripPoint(g){const a=this.node(g.a),b=this.node(g.b);if(!a||!b)return null;return {x:lerp(a.x,b.x,g.t),y:lerp(a.y,b.y,g.t)};}
 input(id,d){
  const h=this.hands.get(id);if(!h||!d||!finite(d.x)||!finite(d.y)||!Number.isInteger(d.s)||d.s<=h.seq)return;
  const now=performance.now(),elapsed=clamp((now-h.lastMove)/1000,.01,.1),nx=clamp(d.x,BB.LEFT,BB.RIGHT),ny=clamp(d.y,BB.TOP,BB.FLOOR);
  const changed=Math.hypot(nx-h.x,ny-h.y)>1;
  if(changed){h.dx=clamp((nx-h.x)/elapsed,-1800,1800);h.dy=clamp((ny-h.y)/elapsed,-1800,1800);h.lastMove=now;}
  h.x=nx;h.y=ny;h.seq=d.s;h.seen=now;if(d.cancel===true)this.cancelMallet(h);const tool=Object.hasOwn(TOOLS,d.tool)&&this.canUse(d.tool)?d.tool:'grab';if(tool!==h.tool){this.cancelMallet(h);h.tetherStart=null;h.grip=null;h.down=false;h.nextFire=h.cooldowns?.[tool]||0;}h.tool=tool;
  // A held object can disappear under another player. Wait for button-up before re-grabbing.
  if(h.blockDown){if(d.down)return;h.blockDown=false;}
  if(d.down&&!h.down){
   this.lastTouch=this.time;let g=null;
   // A client may name the rendered limb, but the host checks distance and IDs.
   if(d.g&&Number.isInteger(d.g.a)&&Number.isInteger(d.g.b)&&finite(d.g.t)){
    const candidate={a:d.g.a,b:d.g.b,t:clamp(d.g.t,0,1)},p=this.gripPoint(candidate);
    if(p&&Math.hypot(p.x-nx,p.y-ny)<95)g=candidate;
   }
   g=g||this.pick(nx,ny);
   if(h.tool!=='grab')this.useTool(h,g);
   else if(g){h.grip=g;h.tx=nx;h.ty=ny;this.onEvent({type:'grab',x:nx,y:ny,who:id});}
  }
  if(!d.down&&h.down){
   if(h.grip&&now-h.lastMove<120&&Math.hypot(h.dx,h.dy)>220){
    const a=this.node(h.grip.a),b=this.node(h.grip.b),g=h.grip;
    const another=[...this.hands.values()].some(o=>o!==h&&o.grip&&(o.grip.a===g.a||o.grip.b===g.b));
    if(!another){
     const power=.82;if(a){a.vx=lerp(a.vx,h.dx,power);a.vy=lerp(a.vy,h.dy,power);}
     if(b&&b!==a){b.vx=lerp(b.vx,h.dx,power);b.vy=lerp(b.vy,h.dy,power);}
    }
    this.onEvent({type:'throw',x:nx,y:ny,who:id});
   }h.grip=null;
  }
  h.down=!!d.down;
 }
 startMallet(h){
  if(h.mallet&&this.tick-h.mallet.at<MALLET.END*BB.HZ)return;
  const m={sid:++this.swingSerial,x:h.x,y:h.y,side:h.x<BB.W/2?-1:1,at:this.tick,resolved:false};h.mallet=m;
  this.onEvent({type:'swing',who:h.id,sid:m.sid,x:m.x,y:m.y,side:m.side,at:m.at});
 }
 cancelMallet(h){
  const m=h.mallet;if(!m)return;
  if(!m.resolved)this.onEvent({type:'swingCancel',who:h.id,sid:m.sid,at:this.tick});
  h.mallet=null;
 }
 malletSnapshot(){return [...this.hands.values()].filter(h=>h.mallet).map(h=>({type:'swing',who:h.id,...h.mallet}));}
 malletHit(p){
  let best=null;
  const consider=(a,b,t,q,r,kind)=>{
   const dx=p.face.x-q.x,dy=p.face.y-q.y,ll=Math.hypot(dx,dy)||1;
   const hit={a,b,t,kind,x:q.x+dx/ll*r,y:q.y+dy/ll*r,dist:ll};
   if(!best||hit.dist<best.dist)best=hit;
  };
  // Red striking face is a short capsule. Handles and empty space cannot hit.
  for(const n of this.nodes){const q=segmentPoint(n.x,n.y,p.A,p.B);
   if(Math.hypot(q.x-n.x,q.y-n.y)<=n.r+MALLET.FACE_R)consider(n.id,n.id,0,n,n.r,n.kind);
  }
  for(const [ai,bi,r] of [...LIMBS,[0,1,14],[1,2,25],[3,6,16]]){
   const a=this.node(ai),b=this.node(bi);if(!a||!b)continue;const q=segmentClosest(p.A,p.B,a,b);
   if(q.d<=r+MALLET.FACE_R)consider(ai,bi,q.t,q.b,r,0);
  }
  return best;
 }
 // Used by the single authoritative step and pure solver tests. No radial shove.
 poke(x,y,who,g=null,pose=null,cue=null){
  pose=pose||malletPose(x,y,x<BB.W/2?-1:1,MALLET.CONTACT);
  const hit=this.malletHit(pose);if(!hit)return null;
  const m=cue||{},n=this.node(hit.t<.5?hit.a:hit.b),boost=this.power();
  // Velocity tangent of the actual striking face: a bonk pushes WITH the swing.
  const ux=-33*Math.cos(pose.a)+73*Math.sin(pose.a),uy=-33*Math.sin(pose.a)-73*Math.cos(pose.a),ll=Math.hypot(ux,uy);
  const dx=pose.side*uy/ll,dy=-ux/ll;
  const event={type:'poke',who,x:hit.x,y:hit.y,hit:true,buddy:hit.kind===0,kind:hit.kind,...m};
  this.onEvent(event);
  if(hit.kind===3){this.popBalloon(n,who,m);return hit;}
  const a=this.node(hit.a),b=this.node(hit.b),u=1-hit.t,t=hit.t,w=hit.a===hit.b?a.im:a.im*u*u+b.im*t*t;
  const impulse=1020*boost;
  if(a===b){a.vx+=dx*impulse;a.vy+=dy*impulse;}
  else{a.vx+=dx*impulse*a.im*u/w;a.vy+=dy*impulse*a.im*u/w;b.vx+=dx*impulse*b.im*t/w;b.vy+=dy*impulse*b.im*t/w;}
  if(hit.kind===0){this.lastTouch=this.time;
   this.hurt(n,hit.x,hit.y,dx,dy,hit.a===0?.96:.74,DAMAGE.blunt,who,m);
   this.reward(hit.x,hit.y,who,'poke',3);
  }
  return hit;
 }
 updateMallet(h){
  const m=h.mallet;if(!m)return;const age=(this.tick-m.at)/BB.HZ;
  if(age>=MALLET.END){h.mallet=null;return;}
  if(m.resolved||age<MALLET.ACTIVE)return;
  // Sub-step the last portion of the downswing to avoid tunnelling past thin limbs.
  const from=Math.max(MALLET.ACTIVE,age-1/BB.HZ),to=Math.min(age,MALLET.CONTACT);
  for(let i=0;from<=to&&i<=4;i++){
   const phase=lerp(from,to,i/4),p=malletPose(m.x,m.y,m.side,phase);
   const cue={sid:m.sid,at:this.tick,ct:Math.round(phase*1000),mallet:1};
   if(this.poke(m.x,m.y,h.id,null,p,cue)){m.resolved=true;m.ct=cue.ct;return;}
  }
  if(age>=MALLET.CONTACT)m.resolved=true; // A whiff gets follow-through, NEVER hit FX.
 }

 command(id,d){
  const h=this.hands.get(id);if(!h||!d||typeof d.c!=='string')return;
  if(this.time-h.lastCmd<.15)return;h.lastCmd=this.time;
  if(d.c.startsWith('buy:')){this.buy(d.c.slice(4),id);return;}
  if(d.c==='heal'){this.repair();return;}
  if(d.c==='clean'){this.cleanStains();return;}
  if(d.c==='hat'){this.hat=(this.hat+1)%4;return;}
  if(d.c==='untie'){this.tethers=[];for(const hand of this.hands.values())hand.tetherStart=null;this.onEvent({type:'untie'});return;}
  if(d.c==='cancelTether'){h.tetherStart=null;this.onEvent({type:'tetherEnd',who:id});return;}
  if(d.c==='ball')this.addBall(h.x,h.y);
  if(d.c==='stand')this.stand();
  if(d.c==='clear')this.clearProps();
  if(d.c==='skin'){this.skin=(this.skin+1)%3;this.onEvent({type:'skin',skin:this.skin});}
  if(d.c==='challenge'){this.taskIndex=(this.taskIndex+1)%TASKS.length;this.taskProgress=0;this.taskDone=false;this.taskBaseScore=this.score;this.taskPops=0;this.taskBlasts=0;this.airtime=0;}

  if(d.c==='gravity'){this.lowGravity=!this.lowGravity;this.onEvent({type:'gravity',enabled:this.lowGravity});}
 }

 clearProps(){
  for(const n of [...this.nodes])if(n.kind)this.removeNode(n.id);
  this.projectiles=[];this.candies=[];this.pads=[];this.bonds=[];this.tethers=[];this.bumpers=[];for(const h of this.hands.values())h.tetherStart=null;
  this.onEvent({type:'clear',x:640,y:540});
 }
 forceRelease(h){this.cancelMallet(h);h.grip=null;h.down=false;h.blockDown=true;this.onEvent({type:'drop',who:h.id});}
 removeNode(id){
  this.nodes=this.nodes.filter(n=>n.id!==id);this.bonds=this.bonds.filter(b=>b[0]!==id&&b[1]!==id);this.tethers=this.tethers.filter(r=>r[1]!==id&&r[2]!==id);for(const h of this.hands.values())if(h.tetherStart?.id===id)h.tetherStart=null;
  for(const h of this.hands.values())if(h.grip&&(h.grip.a===id||h.grip.b===id)){this.forceRelease(h);}
 }
 makeProp(kind,x,y,r,m,event=true){
  if(!finite(x)||!finite(y)||!this.reserve(kind,event))return null;
  const n={id:this.nextId++,kind,x:clamp(x,BB.LEFT+r,BB.RIGHT-r),y:clamp(y,BB.TOP+r,BB.FLOOR-r),vx:0,vy:0,r,m,im:1/m,a:0,lastBounce:-1,lastScore:-5};n.ox=n.x;n.oy=n.y;this.nodes.push(n);return n;
 }
 useTool(h,g){
  if(!this.canUse(h.tool)||this.time<(h.cooldowns?.[h.tool]||0))return;
  h.nextFire=this.time+TOOLS[h.tool].rate;(h.cooldowns||(h.cooldowns={}))[h.tool]=h.nextFire;h.lastUse=this.time;
  const x=h.x,y=h.y,who=h.id;this.lastTouch=this.time;
  if(TOOLS[h.tool].cost){this.heavyTool(h,g);return;}
  if(h.tool==='poke'){this.startMallet(h);return;}
  if(h.tool==='ball'){this.addBall(x,y);return;}
  if(h.tool==='duck'||h.tool==='bowling'){this.addToy(h.tool==='duck'?4:5,x,y,who);return;}
  if(h.tool==='air'){this.airBlast(x,y,who);return;}
  if(h.tool==='tether'){this.tetherClick(h,g);return;}
  if(h.tool==='bumper'){this.placeBumper(x,y,who);return;}
  if(h.tool==='bomb'){
   const n=this.makeProp(2,x,y,19,1.2);if(n){n.fuse=this.time+2.4;n.owner=who;n.vx=0;n.vy=-80;this.onEvent({type:'bomb',x,y,who});}return;
  }
  if(h.tool==='balloon'){
   const grip=g||this.pick(x,y),anchor=grip?this.node(grip.a):null;
   const n=this.makeProp(3,x,y-74,24,.65);if(!n)return;n.owner=who;
   if(anchor)this.bonds.push([n.id,anchor.id,76]);
   this.onEvent({type:'balloon',x:n.x,y:n.y,who});return;
  }
  if(h.tool==='spring'){
   const nearby=this.pads.find(p=>Math.abs(p.x-x)<95);
   if(nearby){nearby.x=clamp(x,120,1160);return;}
   if(this.pads.length>=BB.MAX_PADS){this.limit('Spring limit: '+BB.MAX_PADS+'. Click an existing spring to reposition it.');return;}
   this.pads.push({id:this.nextId++,x:clamp(x,120,1160),kick:-10});this.onEvent({type:'place',x,y:BB.FLOOR-35,who});return;
  }
  if(h.tool==='magnet'){
   for(const n of this.nodes){const dx=x-n.x,dy=y-n.y,d=Math.hypot(dx,dy);if(d>390)continue;
    const k=(1-d/440)*.55;n.vx=lerp(n.vx,clamp(dx*6,-1150,1150),k);n.vy=lerp(n.vy,clamp(dy*6,-1150,1150)-180,k);
   }return;
  }
  if(h.tool==='shock'){
   const hit=this.nodes.filter(n=>Math.hypot(n.x-x,n.y-y)<180);
   if(hit.some(n=>!n.kind)){this.shockUntil=this.time+.2;this.impact=.6;this.reward(x,y,who,'shock',1);}
   for(const n of hit){if(n.kind===3){this.popBalloon(n,who);continue;}if(n.kind===2){n.fuse=Math.min(n.fuse,this.time+.06);continue;}
    n.vx=n.vx*.75+Math.sin(this.tick*2+n.id*4)*175*this.power();n.vy=n.vy*.82-85*this.power();
   }
   this.onEvent({type:'zap',x,y,who,targets:hit.filter(n=>n.kind<3).slice(0,7).map(n=>[n.x,n.y])});return;
  }
  let ox=x<640?BB.LEFT+18:BB.RIGHT-18,oy=clamp(y+105,BB.TOP+30,BB.FLOOR-45);
  if(h.tool==='blaster'){const gx=clamp(x-84,BB.LEFT+30,BB.RIGHT-30),gy=clamp(y+48,BB.TOP+35,BB.FLOOR-20),ll=Math.hypot(x-gx,y-gy)||1;ox=gx+(x-gx)/ll*35;oy=gy+(y-gy)/ll*35;}
  let dx=x-ox,dy=y-oy,l=Math.hypot(dx,dy)||1;dx/=l;dy/=l;
  if(h.tool==='rocket'){
   if(this.projectiles.length>=BB.MAX_ROCKETS)return;
   this.projectiles.push({id:this.nextId++,x:ox,y:oy,vx:dx*900,vy:dy*900,owner:who,life:2.6,tx:x,ty:y});
   this.onEvent({type:'launch',x:ox,y:oy,tx:x,ty:y,who});return;
  }
  if(h.tool==='blaster'){
   let best=null,near=Infinity;
   for(const n of this.nodes){const q=segmentPoint(n.x,n.y,{x:ox,y:oy},{x,y});if(Math.hypot(n.x-q.x,n.y-q.y)>n.r+8)continue;
    const d=Math.hypot(q.x-ox,q.y-oy);if(d<near){near=d;best=n;}
   }
   // A forgiving cursor radius also catches thin fabric between ragdoll masses.
   if(!best){const picked=this.pick(x,y);if(picked)best=this.node(picked.a);}
   let hx=x,hy=y;
   if(best){hx=best.x;hy=best.y;if(best.kind===3)this.popBalloon(best,who);else if(best.kind===2)best.fuse=Math.min(best.fuse,this.time+.08);else{
    best.vx+=dx*500*this.power();best.vy+=(dy*400-150)*this.power();
    if(!best.kind){this.impact=.5;this.hurt(best,hx,hy,dx,dy,.5,DAMAGE.bullet,who);this.reward(hx,hy,who,'blaster',1);}
   }}
   this.onEvent({type:'shot',x:ox,y:oy,tx:hx,ty:hy,hit:!!best,who});
  }
 }
 popBalloon(n,who,cue=null){
  if(!this.node(n.id))return;this.removeNode(n.id);this.taskPops++;
  this.dropCandy(n.x,n.y,2);this.onEvent({type:'pop',x:n.x,y:n.y,who,...(cue||{})});
 }
 explode(x,y,who,power=1){
  let hit=false,first=null;
  for(const n of [...this.nodes]){const dx=n.x-x,dy=n.y-y,d=Math.hypot(dx,dy),radius=245*power;if(d>=radius)continue;
   if(n.kind===3){this.popBalloon(n,who);continue;}
   if(n.kind===2){n.fuse=Math.min(n.fuse,this.time+.1);continue;}
   const k=(1-d/radius)*1300*power*this.power();
   n.vx+=dx/(d||1)*k;n.vy+=dy/(d||1)*k-300*power*this.power();if(n.kind===0){hit=true;first=first||n;this.injuries[n.id].scorch=Math.min(15,this.injuries[n.id].scorch+2);}
  }
  this.lastTouch=this.time;
  if(hit){this.taskBlasts++;this.hurt(first,first.x,first.y,first.x-x,first.y-y,1.25,DAMAGE.blunt,who);this.reward(x,y,who,'explosion',7);}
  this.onEvent({type:'explosion',x,y,who,power});
 }
 updateProjectiles(dt){
  for(const p of [...this.projectiles]){
   const ox=p.x,oy=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
   let impact=null;
   for(const n of this.nodes){const q=segmentPoint(n.x,n.y,{x:ox,y:oy},p);if(Math.hypot(n.x-q.x,n.y-q.y)<n.r+9){impact=q;break;}}
   if(!impact&&Math.hypot(p.x-p.tx,p.y-p.ty)<24)impact={x:p.x,y:p.y};
   if(!impact&&(p.x<BB.LEFT||p.x>BB.RIGHT||p.y<BB.TOP||p.y>BB.FLOOR))impact={x:clamp(p.x,BB.LEFT,BB.RIGHT),y:clamp(p.y,BB.TOP,BB.FLOOR)};
   if(impact){this.explode(impact.x,impact.y,p.owner,1.05);p.life=0;}
  }this.projectiles=this.projectiles.filter(p=>p.life>0);
 }
 reward(x,y,who,tool,amount){
  if(this.time-this.lastReward<.19)return;
  const alive=this.time<this.comboUntil,assist=alive&&who!==this.lastRewarder&&this.lastRewarder!=='';
  const varied=alive&&tool!==this.lastTool;
  this.rewardRun=alive&&!varied&&!assist?this.rewardRun+1:0;
  this.combo=alive?Math.min(30,this.combo+((varied||assist)?2:this.rewardRun<3?1:0)):1;
  const cash=Math.max(1,Math.round((1+amount*.8+(varied?3:0)+(assist?3:0))*(1+this.upgrades[1]*.25)/(this.rewardRun>5?2:1)));
  this.cash=Math.min(1e9,this.cash+cash);this.earned=Math.min(4e9,this.earned+cash);
  this.bestCombo=Math.max(this.bestCombo,this.combo);this.comboUntil=this.time+2.3;this.lastReward=this.time;this.lastRewarder=who;this.lastTool=tool;
  this.dropCandy(x,y,Math.min(12,amount+(assist?2:0)));
  if((varied||assist)&&this.time-(this.lastBonus||-10)>.65){this.lastBonus=this.time;this.onEvent({type:'bonus',x,y,text:assist?'TEAMWORK +$'+cash:'MIX IT UP +$'+cash});}
  if(this.combo===10||this.combo===20)this.onEvent({type:'combo',x,y,combo:this.combo});
 }
 dropCandy(x,y,count){
  for(let i=0;i<count&&this.candies.length<BB.MAX_CANDY;i++){
   const a=(this.nextId*.73)%(Math.PI*2),speed=100+(this.nextId%7)*33;
   this.candies.push({id:this.nextId++,x,y,vx:Math.cos(a)*speed,vy:-230+Math.sin(a)*speed,value:1+Math.floor(this.combo/10),color:i%4,life:12});
  }
 }
 updateCandy(dt){
  for(const c of this.candies){
   c.life-=dt;let collector=null,best=null,bestScore=Infinity;
   for(const h of this.hands.values()){
    const dx=h.x-c.x,dy=h.y-c.y,d=Math.hypot(dx,dy),active=h.down&&h.tool==='magnet';
    const range=(active?620:115)*(1+this.upgrades[2]*.25);
    // One collector field wins; opposing magnets cannot accelerate candy forever.
    const score=d/(active?2:1);if(d<range&&score<bestScore){bestScore=score;best={h,dx,dy,d,active};}
    if(d<(active?46:34)){collector=h;break;}
   }
   if(collector){this.candy+=c.value;this.cash=Math.min(1e9,this.cash+c.value);this.earned=Math.min(4e9,this.earned+c.value);c.life=0;
    if(this.time-(this.lastPickupEvent??-10)>.07){this.lastPickupEvent=this.time;this.onEvent({type:'collect',x:c.x,y:c.y,value:c.value,who:collector.id});}continue;}
   if(best){
    const speed=Math.min(best.active?1450:760,best.d*(best.active?10:8)),k=1-Math.exp(-(best.active?17:12)*dt);
    c.vx=lerp(c.vx,best.dx/(best.d||1)*speed,k);c.vy=lerp(c.vy,best.dy/(best.d||1)*speed,k);
    // Swept pickup prevents fast candy orbiting or tunnelling through the glove.
    const q=segmentPoint(best.h.x,best.h.y,c,{x:c.x+c.vx*dt,y:c.y+c.vy*dt});
    if(Math.hypot(q.x-best.h.x,q.y-best.h.y)<(best.active?46:34)){
     this.candy+=c.value;this.cash=Math.min(1e9,this.cash+c.value);this.earned=Math.min(4e9,this.earned+c.value);c.life=0;continue;
    }
   }else{c.vy+=640*dt;c.vx*=.996;}
   c.vx=clamp(c.vx,-1600,1600);c.vy=clamp(c.vy,-1600,1600);c.x+=c.vx*dt;c.y+=c.vy*dt;
   if(c.y<BB.TOP+7){c.y=BB.TOP+7;c.vy=Math.abs(c.vy)*.45;}
   if(c.y>BB.FLOOR-7){c.y=BB.FLOOR-7;c.vy=-Math.abs(c.vy)*.5;c.vx*=.93;}
   if(c.x<BB.LEFT+7||c.x>BB.RIGHT-7){c.x=clamp(c.x,BB.LEFT+7,BB.RIGHT-7);c.vx*=-.65;}
  }this.candies=this.candies.filter(c=>c.life>0);
 }

 workshopSnapshot(){return {cash:this.cash,earned:this.earned,unlocked:this.unlocked,upgrades:this.upgrades?.slice(),sandbox:this.sandbox,hat:this.hat};}
 loadWorkshop(s){
  if(!s||!Number.isSafeInteger(s.cash)||s.cash<0||s.cash>1e9||!Number.isSafeInteger(s.earned)||s.earned<0||s.earned>4e9||!Number.isInteger(s.unlocked)||s.unlocked<0||s.unlocked>ALL_TOOL_MASK||!Array.isArray(s.upgrades)||s.upgrades.length!==3||!s.upgrades.every(n=>Number.isInteger(n)&&n>=0&&n<=3))return false;
  this.cash=s.cash;this.earned=s.earned;this.unlocked=s.unlocked|STARTER_MASK;this.upgrades=s.upgrades.slice();this.sandbox=!!s.sandbox;this.hat=Number.isInteger(s.hat)&&s.hat>=0&&s.hat<4?s.hat:0;return true;
 }
 canUse(tool){const i=TOOL_IDS.indexOf(tool);return i>=0&&(this.sandbox||!!(this.unlocked&(1<<i)));}
 power(){return 1+this.upgrades[0]*.15;}
 buy(id,who){
  const i=TOOL_IDS.indexOf(id),u=UPGRADES.findIndex(u=>u.id===id);
  let price=0,name='';
  if(i>=0){if(this.unlocked&(1<<i))return;price=TOOLS[id].cost||0;name=TOOLS[id].name;}
  else if(u>=0){const level=this.upgrades[u];if(level>=3)return;price=UPGRADES[u].prices[level];name=UPGRADES[u].name+' '+(level+1);}
  else return;
  if(this.cash<price){this.onEvent({type:'purchaseDenied',who,text:'NEED $'+(price-this.cash)+' MORE'});return;}
  this.cash-=price;if(i>=0)this.unlocked|=1<<i;else this.upgrades[u]++;
  this.onEvent({type:'purchase',item:id,who,text:name+' UNLOCKED',x:640,y:220});
 }
 repair(){
  this.injuries.forEach(d=>{d.bruise=0;d.scorch=0;d.cuts=0;d.darts=0;});
  this.burnUntil=this.frozenUntil=this.dazeUntil=this.hurtUntil=0;this.iceJoints=[];this.stand();
  this.onEvent({type:'repair',x:640,y:370});
 }
 cleanStains(){this.stains=[];this.stainEpoch++;this.onEvent({type:'clean',epoch:this.stainEpoch});}
 stainSnapshot(){return {epoch:this.stainEpoch,marks:this.stains.map(s=>s.slice())};}
 hurt(n,x,y,dx,dy,power,kind,who='',cue=null){
  if(!n||n.kind)return;
  if(this.time<this.frozenUntil&&kind!==DAMAGE.burn){this.shatter(n.x,n.y,who,cue);power*=1.2;}
  const d=this.injuries[n.id];d.bruise=Math.min(15,d.bruise+power*2.2);
  if(kind===DAMAGE.burn)d.scorch=Math.min(15,d.scorch+power*3);
  else if(kind!==DAMAGE.blunt||power>.75)d.cuts=Math.min(15,d.cuts+power*2);
  if(kind===DAMAGE.dart)d.darts=Math.min(3,d.darts+1);
  this.hurtUntil=this.time+.32;this.lastDamageWho=who;this.impact=Math.max(this.impact,Math.min(1,power));
  if(power>.8)this.dazeUntil=this.time+1.25;
  // Limit emitted blood cues globally, not damage. Four saws cannot multiply the FX bandwidth.
  if(this.time-this.lastBlood<.067)return;this.lastBlood=this.time;
  const len=Math.hypot(dx,dy)||1;dx/=len;dy/=len;
  const serial=++this.damageSerial,seed=(Math.imul(serial,1597334677)^Math.imul(this.gen,3812015801))>>>0;
  const mark=[serial,Math.round(x),Math.round(y),Math.round(dx*100),Math.round(dy*100),Math.round(clamp(power,.12,1.6)*100),kind,seed,n.id];
  if(kind!==DAMAGE.burn){this.stains.push(mark);if(this.stains.length>BB.MAX_STAINS)this.stains.shift();}
  this.onEvent({type:'hurt',m:mark,epoch:this.stainEpoch,...(cue||{})});
 }
 shatter(x,y,who,cue=null){
  if(this.time>=this.frozenUntil)return;this.frozenUntil=0;this.iceJoints=[];this.dazeUntil=this.time+.9;
  this.reward(x,y,who,'shatter',6);this.onEvent({type:'shatter',x,y,seed:++this.damageSerial,...(cue||{})});
 }
 freezeBuddy(){
  if(this.time>=this.frozenUntil){
   this.iceJoints=[[5,8],[0,10],[0,12],[10,12],[4,7],[9,11],[3,9],[6,11]].map(([a,b])=>({a,b,l:dist(this.nodes[a],this.nodes[b])}));
  }this.frozenUntil=this.time+3.5;
 }
 updateDamage(dt){
  if(this.time>this.frozenUntil&&this.iceJoints.length)this.iceJoints=[];
  if(this.time<this.burnUntil&&this.time>=this.nextBurn){
   this.nextBurn=this.time+.35;const id=(this.tick%3);const n=this.nodes[id];
   this.hurt(n,n.x,n.y,0,-1,.2,DAMAGE.burn,this.lastDamageWho);
   n.vx+=Math.sin(this.time*13)*50;n.vy-=35;
  }
  if(this.time-this.lastTouch>6)for(const d of this.injuries)d.bruise=Math.max(0,d.bruise-dt*.35);
 }
 hitProp(n,who){
  if(n.kind===3){this.popBalloon(n,who);return true;}
  if(n.kind===2){n.fuse=Math.min(n.fuse,this.time+.08);return true;}
  return false;
 }
 aimNode(x,y,ox,oy,padding=8){
  let found=null,near=Infinity;
  for(const n of this.nodes){const q=segmentPoint(n.x,n.y,{x:ox,y:oy},{x,y});if(Math.hypot(q.x-n.x,q.y-n.y)>n.r+padding)continue;const dd=Math.hypot(q.x-ox,q.y-oy);if(dd<near){found=n;near=dd;}}
  return found;
 }
 heavyTool(h,g){
  const x=h.x,y=h.y,who=h.id,tool=h.tool;
  const ox=clamp(x-96,BB.LEFT+20,BB.RIGHT-20),oy=clamp(y+48,BB.TOP+20,BB.FLOOR-18),len=Math.hypot(x-ox,y-oy)||1,dx=(x-ox)/len,dy=(y-oy)/len;
  if(tool==='rail'){this.railShot(x,y,who);return;}
  if(tool==='shotgun'){
   const ends=[],hits=new Map();
   for(let i=-3;i<=3;i++){
    const a=Math.atan2(dy,dx)+i*.08,tx=x+Math.cos(a)*65+Math.sin(a)*i*3,ty=y+Math.sin(a)*65-Math.cos(a)*i*3;
    const n=this.aimNode(tx,ty,ox,oy,5);ends.push([Math.round(n?n.x:tx),Math.round(n?n.y:ty)]);
    if(n){hits.set(n.id,(hits.get(n.id)||0)+1);if(!n.kind||n.kind===1){n.vx+=Math.cos(a)*145*this.power();n.vy+=(Math.sin(a)*120-38)*this.power();}}
   }
   let hit=false;
   for(const [id,count] of hits){const n=this.node(id);if(!n)continue;if(this.hitProp(n,who))continue;if(!n.kind){this.hurt(n,n.x,n.y,dx,dy,.45+count*.13,DAMAGE.bullet,who);hit=true;}}
   if(hit)this.reward(x,y,who,tool,5);
   this.onEvent({type:'scatter',x:ox,y:oy,ends,who});return;
  }
  if(tool==='saw'){
   const n=this.aimNode(x+27,y-24,x-27,y+24,20)||(g?this.node(g.a):null);
   if(n&&!this.hitProp(n,who)){
    n.vx+=clamp(h.dx*.025+Math.sin(this.tick)*50,-110,110)*this.power();n.vy-=42*this.power();
    if(!n.kind){this.hurt(n,n.x,n.y,.8,-.45,.28,DAMAGE.cut,who);this.reward(n.x,n.y,who,tool,1);}
   }return;
  }
  if(tool==='dart'){
   const n=this.aimNode(x,y,ox,oy)||(g?this.node(g.a):null);let tx=x,ty=y;
   if(n){tx=n.x;ty=n.y;if(!this.hitProp(n,who)){n.vx+=dx*290*this.power();n.vy+=(dy*220-60)*this.power();if(!n.kind){this.hurt(n,n.x,n.y,dx,dy,.55,DAMAGE.dart,who);this.reward(x,y,who,tool,2);}}}
   this.onEvent({type:'dart',x:ox,y:oy,tx,ty,who});return;
  }
  if(tool==='flame'||tool==='freeze'){
   const end={x:x+dx*80,y:y+dy*80};let buddy=false;
   for(const n of [...this.nodes]){
    const q=segmentPoint(n.x,n.y,{x:ox,y:oy},end);if(Math.hypot(n.x-q.x,n.y-q.y)>n.r+12+q.t*25)continue;
    if(tool==='flame'){
     if(n.kind===3){this.popBalloon(n,who);continue;}if(n.kind===2){n.fuse=Math.min(n.fuse,this.time+.2);continue;}
     if(!n.kind){this.injuries[n.id].scorch=Math.min(15,this.injuries[n.id].scorch+.7);buddy=true;n.vx+=dx*38;n.vy-=30;}
    }else{
     if(n.kind===2)n.fuse=Math.max(n.fuse,this.time+1);if(n.kind===3)continue;
     n.vx*=.62;n.vy*=.62;if(!n.kind)buddy=true;
    }
   }
   if(buddy){
    if(tool==='flame'){
     if(this.time<this.frozenUntil){this.frozenUntil=0;this.iceJoints=[];this.onEvent({type:'steam',x,y});}
     this.burnUntil=this.time+2.8;this.lastDamageWho=who;
    }else{
     if(this.time<this.burnUntil){this.burnUntil=0;this.onEvent({type:'steam',x,y});}
     this.freezeBuddy();
    }
    this.reward(x,y,who,tool,1);
   }
  }
 }
 // Add COM velocity and rotation to all 13 masses. A launch moves a body,
 // instead of spending the whole kick stretching one foot against 12 masses.
 launchBuddy(vx,vy,x,y,spin=0){
  const body=this.nodes.slice(0,13),mass=body.reduce((a,n)=>a+n.m,0);
  const cx=body.reduce((a,n)=>a+n.x*n.m,0)/mass,cy=body.reduce((a,n)=>a+n.y*n.m,0)/mass;
  const omega=clamp(spin,-4.2,4.2);
  for(const n of body){n.vx=clamp(n.vx*.32+vx-omega*(n.y-cy),-1900,1900);n.vy=clamp(vy+omega*(n.x-cx),-1900,1900);}
  this.lastTouch=this.time;
 }
 airBlast(x,y,who){
  const ox=clamp(x-105,BB.LEFT+25,BB.RIGHT-25),oy=clamp(y+55,BB.TOP+30,BB.FLOOR-25),len=Math.hypot(x-ox,y-oy)||1,dx=(x-ox)/len,dy=(y-oy)/len;
  let touched=false;
  const inCone=n=>{const px=n.x-ox,py=n.y-oy,along=px*dx+py*dy,across=Math.abs(px*dy-py*dx);return along>10&&along<380+(n.r||0)&&across<32+along*.40+(n.r||0);};
  for(const n of this.nodes){if(!inCone(n))continue;if(!n.kind){touched=true;continue;}n.vx+=dx*900;n.vy+=dy*900-100;}
  for(const c of this.candies)if(inCone(c)){c.vx=dx*1100;c.vy=dy*1100-120;}
  if(touched){const n=this.node(1);this.launchBuddy(dx*770*this.power(),dy*840*this.power()-170,x,y,clamp((x-n.x)/90,-1.8,1.8));this.reward(x,y,who,'air',2);}
  this.onEvent({type:'air',x:ox,y:oy,dx,dy,who,hit:touched});
 }
 railShot(x,y,who){
  const ox=clamp(x-96,BB.LEFT+20,BB.RIGHT-20),oy=clamp(y+48,BB.TOP+20,BB.FLOOR-18),len=Math.hypot(x-ox,y-oy)||1,dx=(x-ox)/len,dy=(y-oy)/len;
  const end={x:ox+dx*1600,y:oy+dy*1600};let buddy=false,hitCount=0;
  for(const n of [...this.nodes]){const q=segmentPoint(n.x,n.y,{x:ox,y:oy},end);if(q.t<=0||Math.hypot(n.x-q.x,n.y-q.y)>n.r+4)continue;
   hitCount++;if(this.hitProp(n,who))continue;n.vx+=dx*1100*this.power()/Math.sqrt(n.m);n.vy+=dy*1000*this.power()/Math.sqrt(n.m)-120;
   if(!n.kind){buddy=true;this.hurt(n,q.x,q.y,dx,dy,.95,DAMAGE.bullet,who);}
  }
  if(buddy)this.reward(x,y,who,'rail',6);
  const hits=[];for(const [value,origin,dir] of [[BB.LEFT,ox,dx],[BB.RIGHT,ox,dx],[BB.TOP,oy,dy],[BB.FLOOR,oy,dy]]){const t=(value-origin)/dir;if(t>0&&finite(t))hits.push(t);}
  const reach=Math.min(1600,...hits);this.onEvent({type:'rail',x:ox,y:oy,tx:ox+dx*reach,ty:oy+dy*reach,who,hit:hitCount>0});
 }
 // Twelve endpoint constraints, not twelve chains of replicated rigidbodies.
 ropePoint(id,x,y){const n=id>=0?this.node(id):null;return n||{x,y,im:0};}
 tetherClick(h,g){
  const x=h.x,y=h.y;
  if(!h.tetherStart){
   // The tool can cut an existing rope by its middle, not by its attach point.
   const near=this.tethers.find(r=>{const a=this.ropePoint(r[1],r[3],r[4]),b=this.ropePoint(r[2],r[5],r[6]),q=segmentPoint(x,y,a,b);return q.t>.14&&q.t<.86&&Math.hypot(q.x-x,q.y-y)<11;});
   if(near){this.tethers=this.tethers.filter(r=>r!==near);this.onEvent({type:'ropeCut',x,y,who:h.id});return;}
  }
  const grip=g||this.pick(x,y),node=grip?this.node(grip.t<.5?grip.a:grip.b):null;
  const end={id:node?.id??-1,x:node?.x??x,y:node?.y??y};
  if(!h.tetherStart){
   if(this.tethers.length>=BB.MAX_TETHERS){this.limit('Tether limit: '+BB.MAX_TETHERS+'. Click a rope to cut it.');return;}
   h.tetherStart=end;this.onEvent({type:'tetherStart',who:h.id,id:end.id,x:end.x,y:end.y});return;
  }
  const start=h.tetherStart;h.tetherStart=null;this.onEvent({type:'tetherEnd',who:h.id});
  if(start.id===end.id){this.limit('Choose a different body or a wall point for the other end.');return;}
  if(start.id>=0&&!this.node(start.id))return;
  if(this.tethers.length>=BB.MAX_TETHERS){this.limit('Tether limit: '+BB.MAX_TETHERS+'. Click a rope to cut it.');return;}
  const a=this.ropePoint(start.id,start.x,start.y),b=this.ropePoint(end.id,end.x,end.y);
  const length=clamp(Math.hypot(a.x-b.x,a.y-b.y),36,1100);
  this.tethers.push([this.nextId++,start.id,end.id,round(a.x),round(a.y),round(b.x),round(b.y),round(length)]);
  this.lastTouch=this.time;this.onEvent({type:'tether',x:b.x,y:b.y,who:h.id});
 }
 solveTether(r){
  const a=this.ropePoint(r[1],r[3],r[4]),b=this.ropePoint(r[2],r[5],r[6]),w=a.im+b.im;
  if(w<=0)return;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d<=r[7]||d<.001)return;const move=Math.min(24,(d-r[7])*.64),nx=dx/d,ny=dy/d;
  if(a.im){a.x+=nx*move*a.im/w;a.y+=ny*move*a.im/w;}
  if(b.im){b.x-=nx*move*b.im/w;b.y-=ny*move*b.im/w;}
 }
 placeBumper(x,y,who){
  const found=this.bumpers.find(b=>Math.hypot(x-b.x,y-b.y)<36);
  if(found){this.bumpers=this.bumpers.filter(b=>b!==found);this.onEvent({type:'ropeCut',x,y,who});return;}
  if(this.bumpers.length>=BB.MAX_BUMPERS){this.limit('Bumper limit: '+BB.MAX_BUMPERS+'. Click an existing one to remove.');return;}
  x=clamp(x,68,1212);y=clamp(y,98,614);
  if(this.bumpers.some(b=>Math.hypot(x-b.x,y-b.y)<70)){this.limit('Give those bumpers a little space.');return;}
  this.bumpers.push({id:this.nextId++,x,y,kick:-10,lastKick:-10,who,hit:null});
  this.onEvent({type:'place',x,y,who});
 }
 collideBumpers(n){
  for(const b of this.bumpers){
   const dx=n.x-b.x,dy=n.y-b.y,d=Math.hypot(dx,dy),radius=n.r+30;
   if(d>=radius)continue;const nx=d>.001?dx/d:0,ny=d>.001?dy/d:-1;
   n.x=b.x+nx*radius;n.y=b.y+ny*radius;n.contacted=true;n.cnx=nx;n.cny=ny;
   const speed=-(n.ivx*nx+n.ivy*ny);
   if(speed>70&&this.time-b.lastKick>.20&&(!b.hit||speed>b.hit.speed))b.hit={id:n.id,nx,ny,speed};
  }
 }
 updateBumpers(){
  // Apply AFTER positional projection has reconstructed velocities. Applying
  // impulses inside the constraint loop silently discards the kick.
  let buddyLaunched=false;
  for(const b of this.bumpers){const hit=b.hit;if(!hit)continue;const n=this.node(hit.id);if(!n)continue;
   b.kick=b.lastKick=this.time;
   const speed=Math.min(1320,Math.max(790,hit.speed*1.12));
   if(!n.kind&&!buddyLaunched){this.launchBuddy(hit.nx*speed,hit.ny*speed-110,b.x,b.y,clamp(hit.nx*1.3,-1.3,1.3));buddyLaunched=true;}
   else if(n.kind){n.vx=clamp(hit.nx*speed,-1900,1900);n.vy=clamp(hit.ny*speed-45,-1900,1900);}
   if(this.time-this.lastBumperFX>.08){this.lastBumperFX=this.time;this.onEvent({type:'bumperHit',id:b.id,x:b.x,y:b.y,buddy:!n.kind});}
  }
 }

 solveBend(j){const a=this.nodes[j.a],b=this.nodes[j.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=j.l)return;const w=a.im+b.im,k=(j.l-d)*.65/(d||1);if(d<.001){a.x-=j.l*.2;b.x+=j.l*.2;return;}a.x-=dx*k*a.im/w;a.y-=dy*k*a.im/w;b.x+=dx*k*b.im/w;b.y+=dy*k*b.im/w;}
 updateSprings(){
  for(const pad of this.pads){const top=BB.FLOOR-43;let contact=null;
   for(const n of this.nodes){
    if(n.kind===3||Math.abs(n.x-pad.x)>54+n.r*.55||n.y+n.r<top-2||n.ivy<-90)continue;
    if(n.kind){if(this.time-(n.lastSpring??-10)<.22)continue;n.y=Math.min(n.y,top-n.r);n.vy=-Math.min(1500,Math.max(980,Math.abs(n.ivy)*1.10));n.vx+=(n.x-pad.x)*1.4;n.lastSpring=this.time;pad.kick=this.time;}
    else if(!contact||n.y+n.r>contact.y+contact.r)contact=n;
   }
   if(contact&&this.time-this.lastSpring>.32){
    const body=this.nodes.slice(0,13),avgVy=body.reduce((v,n)=>v+n.vy,0)/13;
    if(avgVy>-120){
     const correction=Math.min(48,Math.max(0,contact.y+contact.r-top));
     for(const n of body)n.y-=correction;
     this.launchBuddy((contact.x-pad.x)*3,-Math.min(1400,Math.max(1100,Math.abs(avgVy)*1.12)),contact.x,top,clamp((contact.x-pad.x)/40,-1.2,1.2));
     this.lastSpring=this.time;pad.kick=this.time;
    }
   }
   if(pad.kick===this.time&&this.time-(pad.lastEvent??-10)>.12){pad.lastEvent=this.time;this.onEvent({type:'spring',x:pad.x,y:top,buddy:!!contact});}
  }
 }
 solveJoint(j){
  const a=this.nodes[j.a],b=this.nodes[j.b],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||.001,w=a.im+b.im,k=(d-j.l)/d*.92;
  a.x+=dx*k*a.im/w;a.y+=dy*k*a.im/w;b.x-=dx*k*b.im/w;b.y-=dy*k*b.im/w;
 }
 solveGrab(h){
  if(!h.grip)return;const g=h.grip,a=this.node(g.a),b=this.node(g.b);if(!a||!b){h.grip=null;return;}
  const t=g.t,u=1-t;const x=lerp(a.x,b.x,t),y=lerp(a.y,b.y,t);let dx=h.tx-x,dy=h.ty-y,l=Math.hypot(dx,dy);const s=Math.min(1,30/(l||1))*.42;dx*=s;dy*=s;
  if(a===b){a.x+=dx;a.y+=dy;}else{const w=a.im*u*u+b.im*t*t;a.x+=dx*a.im*u/w;a.y+=dy*a.im*u/w;b.x+=dx*b.im*t/w;b.y+=dy*b.im*t/w;}
 }
 circleCollision(a,b){
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=a.r+b.r;if(d>=r)return;
  if(d<.001){dx=.01;dy=0;d=.01;}const nx=dx/d,ny=dy/d,w=a.im+b.im,depth=r-d;
  a.x-=nx*depth*a.im/w;a.y-=ny*depth*a.im/w;b.x+=nx*depth*b.im/w;b.y+=ny*depth*b.im/w;
  const prop=a.kind?a:b.kind?b:null,body=!a.kind?a:!b.kind?b:null;
  const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
  if(prop&&closing>180&&this.time-(prop.lastToyHit??-10)>.20){
   prop.lastToyHit=this.time;
   if(prop.kind===4&&this.time-this.lastToyHit>.12){this.lastToyHit=this.time;this.onEvent({type:'squeak',x:prop.x,y:prop.y});}
   if(prop.kind===5&&body&&closing>300){this.hurt(body,body.x,body.y,prop.vx,prop.vy,Math.min(1.1,closing/900),DAMAGE.blunt,prop.owner||'');this.reward(body.x,body.y,prop.owner||'','bowling',4);}
  }
 }
 staticCollision(n){
  const contact=(nx,ny)=>{n.cnx=nx;n.cny=ny;n.contacted=true;};
  if(n.x<BB.LEFT+n.r){n.x=BB.LEFT+n.r;contact(1,0);}if(n.x>BB.RIGHT-n.r){n.x=BB.RIGHT-n.r;contact(-1,0);}
  if(n.y<BB.TOP+n.r){n.y=BB.TOP+n.r;contact(0,1);}if(n.y>BB.FLOOR-n.r){n.y=BB.FLOOR-n.r;contact(0,-1);}
  // A narrow backboard and two physical rim tips; the net is decorative.
  const rx=1164,ry=199,rw=12,rh=136;
  const qx=clamp(n.x,rx,rx+rw),qy=clamp(n.y,ry,ry+rh);let dx=n.x-qx,dy=n.y-qy,d=Math.hypot(dx,dy);
  if(d<n.r){
   if(d<.0001){dx=n.x<rx+rw/2?-1:1;dy=0;d=1;}
   const px=n.x+dx/d*(n.r-d),py=n.y+dy/d*(n.r-d);
   if(px>BB.RIGHT-n.r||px<BB.LEFT+n.r){
    // Buddy's head cannot fit between the backboard and the wall. Resolve to a
    // valid exposed face instead of alternately pushing through each collider.
    const choices=[{x:rx-n.r,y:n.y,nx:-1,ny:0},{x:n.x,y:ry-n.r,nx:0,ny:-1},{x:n.x,y:ry+rh+n.r,nx:0,ny:1}];
    choices.sort((a,b)=>Math.hypot(a.x-n.x,a.y-n.y)-Math.hypot(b.x-n.x,b.y-n.y));
    const q=choices[0];n.x=q.x;n.y=q.y;contact(q.nx,q.ny);
   }else{n.x=px;n.y=py;contact(dx/d,dy/d);}
  }
  for(const [x,y,r] of [[1048,327,6],[1151,327,6]]){dx=n.x-x;dy=n.y-y;d=Math.hypot(dx,dy);if(d<n.r+r){if(d<.001){dx=1;dy=0;d=1;}n.x+=dx/d*(n.r+r-d);n.y+=dy/d*(n.r+r-d);contact(dx/d,dy/d);}}
 }
 capsuleCollision(ball,ai,bi,r){
  const a=this.nodes[ai],b=this.nodes[bi],q=segmentPoint(ball.x,ball.y,a,b);let dx=ball.x-q.x,dy=ball.y-q.y,d=Math.hypot(dx,dy),R=ball.r+r;
  if(d>=R||d<.001)return;
  const t=q.t,u=1-t,w=ball.im+a.im*u*u+b.im*t*t,k=(R-d)/d;
  ball.x+=dx*k*ball.im/w;ball.y+=dy*k*ball.im/w;a.x-=dx*k*a.im*u/w;a.y-=dy*k*a.im*u/w;b.x-=dx*k*b.im*t/w;b.y-=dy*k*b.im*t/w;
 }
 step(dt=1/BB.HZ){
  this.time+=dt;this.tick++;this.impact*=.983;this.updateDamage(dt);for(const b of this.bumpers)b.hit=null;
  const now=performance.now(),held=[...this.hands.values()].some(h=>h.grip&&this.node(h.grip.a)?.kind===0);
  for(const h of this.hands.values()){
   if(now-h.seen>1400){this.cancelMallet(h);h.grip=null;h.down=false;}
   if(h.grip){const dx=h.x-h.tx,dy=h.y-h.ty,d=Math.hypot(dx,dy),k=Math.min(1,3800*dt/(d||1));h.tx+=dx*k;h.ty+=dy*k;}
  }
  for(const h of this.hands.values())if(h.down&&h.tool!=='grab'&&h.tool!=='balloon'&&h.tool!=='ball'&&h.tool!=='bomb'&&h.tool!=='spring'&&h.tool!=='duck'&&h.tool!=='bowling'&&h.tool!=='tether'&&h.tool!=='bumper')this.useTool(h,null);
  for(const h of this.hands.values())this.updateMallet(h);
  this.updateProjectiles(dt);this.updateCandy(dt);
  for(const n of [...this.nodes])if(n.kind===2&&this.time>=n.fuse){this.removeNode(n.id);this.explode(n.x,n.y,n.owner,1);}
  if(this.time>this.comboUntil)this.combo=0;
  const idle=!held&&!this.tethers.some(r=>(r[1]>=0&&r[1]<13)||(r[2]>=0&&r[2]<13))&&!this.bonds.some(b=>this.node(b[1])?.kind===0)&&!this.lowGravity&&this.time-this.lastTouch>3.5&&this.time>=this.frozenUntil&&this.time>=this.dazeUntil;
  const center=clamp(this.nodes[2].x,270,970),gravity=this.lowGravity?245:1120;
  for(const n of this.nodes){
   n.ox=n.x;n.oy=n.y;n.ivx=n.vx;n.ivy=n.vy;n.contacted=false;
   // Gentle self-righting makes a quiet Buddy look alive. Switches off on touch.
   if(idle&&!n.kind){const pose=BASE_POSE[n.id];const gx=pose[0]-640+center,gy=pose[1]+17;
    n.vx+=(gx-n.x)*24*dt-n.vx*2.8*dt;n.vy+=(gy-n.y)*34*dt-n.vy*2.8*dt;
    n.vy-=gravity*.96*dt;
   }
   n.vx*=n.kind?.998:.9992;n.vy=n.vy*(n.kind?.998:.9992)+(n.kind===3?-gravity*8:gravity)*dt;if(n.kind===3)n.vx+=Math.sin(this.time*2+n.id)*8*dt;
   n.x+=n.vx*dt;n.y+=n.vy*dt;
  }
  for(let iter=0;iter<9;iter++){
   for(const j of this.joints)this.solveJoint(j);
   for(const j of this.bends)this.solveBend(j);
   for(const [a,b] of SELF_PAIRS)this.circleCollision(this.nodes[a],this.nodes[b]);
   if(this.time<this.frozenUntil)for(const j of this.iceJoints)this.solveJoint(j);
   for(const h of this.hands.values())this.solveGrab(h);
   for(const r of this.tethers)this.solveTether(r);
   for(const rope of this.bonds){const a=this.node(rope[0]),b=this.node(rope[1]);if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;if(d>rope[2]){const k=(d-rope[2])/d*.7,w=a.im+b.im;a.x+=dx*k*a.im/w;a.y+=dy*k*a.im/w;b.x-=dx*k*b.im/w;b.y-=dy*k*b.im/w;}}
   for(let i=0;i<this.nodes.length;i++)for(let j=i+1;j<this.nodes.length;j++){const a=this.nodes[i],b=this.nodes[j];if(!a.kind&&!b.kind)continue;if(iter%2===0)this.circleCollision(a,b);}
   if(iter%2===0)for(const id of [4,5,7,8,9,10,11,12])this.capsuleCollision(this.nodes[id],1,2,21);
   if(iter%3===0)for(const n of this.nodes)if(n.kind){for(const [a,b,r] of LIMBS)this.capsuleCollision(n,a,b,r);this.capsuleCollision(n,1,2,23);}
   for(const n of this.nodes){this.staticCollision(n);this.collideBumpers(n);}
  }
  for(const n of this.nodes){
   n.vx=clamp((n.x-n.ox)/dt,-1900,1900);n.vy=clamp((n.y-n.oy)/dt,-1900,1900);
   if(n.contacted){const old=n.ivx*n.cnx+n.ivy*n.cny,cur=n.vx*n.cnx+n.vy*n.cny;
    const bounce=old<-60?-old*(n.kind===5?.38:n.kind?.77:.24):0;
    if(cur<bounce){n.vx+=(bounce-cur)*n.cnx;n.vy+=(bounce-cur)*n.cny;}
    if(n.cny<-.5)n.vx*=n.kind===5?.989:n.kind?.992:this.time<this.frozenUntil?.997:.982;
    if(old<-200&&this.time-n.lastBounce>.13){n.lastBounce=this.time;
     if(!n.kind&&old<-650&&this.time>1){this.hurt(n,n.x,n.y,-n.cnx,-n.cny,clamp(-old/1600,.2,1),DAMAGE.blunt,this.lastDamageWho);}
this.impact=Math.max(this.impact,!n.kind?clamp(-old/1200,0,1):0);this.onEvent({type:'bounce',x:n.x,y:n.y+n.r,s:clamp(-old/1400,.05,1),ball:!!n.kind});}
   }
   if(n.kind===4||n.kind===5)n.a=(n.a+n.vx*dt/n.r)%(Math.PI*2);
   if(n.kind===1){
    n.a=(n.a+n.vx*dt/n.r)%(Math.PI*2);
    if(n.oy<331&&n.y>=331&&n.vy>30&&n.x>1073&&n.x<1126&&this.time-n.lastScore>1.3){
     n.lastScore=this.time;this.score++;this.onEvent({type:'basket',x:1100,y:325,score:this.score});this.dropCandy(1100,325,8);
    }
   }

   n.vx=clamp(n.vx,-1900,1900);n.vy=clamp(n.vy,-1900,1900);
   if(!finite(n.x)||!finite(n.y)||!finite(n.vx)||!finite(n.vy)){const p=n.kind?[450,300]:BASE_POSE[n.id];n.x=p[0];n.y=p[1];n.vx=n.vy=0;}
  }
  this.updateSprings();this.updateBumpers();
  for(const n of this.nodes){n.x=clamp(n.x,BB.LEFT+n.r,BB.RIGHT-n.r);n.y=clamp(n.y,BB.TOP+n.r,BB.FLOOR-n.r);n.vx=clamp(n.vx,-1900,1900);n.vy=clamp(n.vy,-1900,1900);}
  const airborne=this.nodes.slice(0,13).every(n=>n.y+n.r<BB.FLOOR-27)&&!held;
  this.airtime=airborne?this.airtime+dt:0;this.bestAir=Math.max(this.bestAir,this.airtime);
  if(!this.taskDone){
   this.taskProgress=[this.airtime,this.score-this.taskBaseScore,this.taskPops,this.taskBlasts][this.taskIndex];
   if(this.taskProgress>=TASKS[this.taskIndex].goal){this.taskDone=true;this.dropCandy(640,200,20);this.onEvent({type:'challenge',x:640,y:210});}
  }
 }
 snapshot(paused=false){
  return {hat:this.hat,ropes:this.tethers.map(r=>r.slice()),bumpers:this.bumpers.map(b=>[b.id,b.x,b.y,round(Math.max(0,1-(this.time-b.kick)*4))]),bank:this.cash,earned:this.earned,unlock:this.unlocked,upg:this.upgrades.slice(),free:this.sandbox,
   d:this.injuries.map(d=>clamp(Math.round(d.bruise),0,15)|(clamp(Math.round(d.scorch),0,15)<<4)|(clamp(Math.round(d.cuts),0,15)<<8)|(d.darts<<12)),
   mood:[this.hurtUntil>this.time?1:0,round(Math.max(0,this.dazeUntil-this.time)),round(Math.max(0,this.burnUntil-this.time)),round(Math.max(0,this.frozenUntil-this.time))],stain:this.stainEpoch,
   v:BB.VERSION,t:this.tick,time:round(this.time),gen:this.gen,score:this.score,low:this.lowGravity,paused,impact:round(this.impact),candy:this.candy,combo:this.combo,bestCombo:this.bestCombo,comboLeft:round(Math.max(0,this.comboUntil-this.time)),shock:this.time<this.shockUntil,skin:this.skin,bestAir:round(this.bestAir),
   task:[this.taskIndex,round(this.taskProgress),this.taskDone],
   p:this.projectiles.map(p=>[p.id,round(p.x),round(p.y),round(p.vx),round(p.vy),p.owner]),
   c:this.candies.map(c=>[c.id,round(c.x),round(c.y),c.value,c.color]),
   pads:this.pads.map(p=>[p.id,p.x,round(Math.max(0,1-(this.time-p.kick)*5))]),
   bonds:this.bonds.map(b=>b.slice()),
   props:this.nodes.filter(n=>n.kind===2).map(n=>[n.id,round(Math.max(0,n.fuse-this.time))]),
   n:this.nodes.map(n=>[n.id,round(n.x),round(n.y),round(n.vx),round(n.vy),n.r,n.kind,round(n.a)]),
   h:[...this.hands.values()].map(h=>[h.id,h.name,h.color,round(h.x),round(h.y),h.down,h.grip?[h.grip.a,h.grip.b,round(h.grip.t)]:null,h.tool,round(h.lastUse)])};
 }
}

/* Original inline vector tool sprites. No icon library, CSS framework, fonts or art downloads. */
const TOOL_ART={
 tether:`<path d="M10 22h22v26H10z" fill="#e1ac6d"/><circle cx="28" cy="24" r="14" fill="#ecd795"/><circle cx="28" cy="24" r="7" fill="#7295a0"/><path d="M30 38c28 1 21-26 32-28" stroke="#ebd6a0" stroke-width="5"/><path d="M8 48h13v13H8z" fill="#5f7c89"/><path d="m56 4 7 5-6 7" fill="#b3d5ce"/>`,
 bumper:`<ellipse cx="32" cy="46" rx="26" ry="12" fill="#536d79"/><circle cx="32" cy="28" r="24" fill="#de7759"/><circle cx="32" cy="28" r="16" fill="#f2ce75"/><path d="m32 13 4 10 11 1-9 7 3 10-9-6-9 6 3-10-9-7 11-1z" fill="#fbefc6"/>`,
 air:`<g transform="rotate(-25 32 32)"><path d="m4 19 31-6v34L4 40z" fill="#76bcb6"/><path d="M34 10h13v41H34z" fill="#f4cf65"/><path d="M45 15h7v31h-7z" fill="#496676"/><path d="M12 38h11v21H12z" fill="#607583"/><path d="m54 21 6-5m-6 14h8m-8 8 6 5" fill="none" stroke="#c7ede0"/></g>`,
 duck:`<path d="M15 32 4 25l4 21 21 4" fill="#e1a34a"/><ellipse cx="30" cy="43" rx="24" ry="17" fill="#f4c958"/><circle cx="41" cy="24" r="16" fill="#f8d971"/><path d="m51 23 12 6-3 7-13-2" fill="#ef8b52"/><circle cx="43" cy="20" r="3" fill="#263842"/><ellipse cx="24" cy="43" rx="11" ry="7" fill="#dfaa44"/>`,
 bowling:`<circle cx="32" cy="32" r="27" fill="#605073"/><path d="m10 18 43 27m-37-31 41 21" stroke="#957aab" stroke-width="5"/><circle cx="27" cy="20" r="4" fill="#242b40"/><circle cx="39" cy="24" r="4" fill="#242b40"/><circle cx="31" cy="34" r="5" fill="#242b40"/>`,
 rail:`<g transform="rotate(-25 32 32)"><path d="M6 22h25v25H6z" fill="#8c6288"/><path d="M24 16h37v9H24zm0 22h37v9H24z" fill="#b1cfd4"/><path d="M28 21h5v21h-5zm11 0h5v21h-5zm11 0h5v21h-5z" fill="#f293bb"/><circle cx="17" cy="33" r="5" fill="#f6cf76"/><path d="M12 46h10v14H12z" fill="#61737c"/></g>`,
 shotgun:`<g transform="rotate(-23 32 32)"><path d="m4 34 21-5 7 15-28 12z" fill="#b77e51"/><path d="M24 23h36v8H24z" fill="#81959c"/><path d="M24 31h36v8H24z" fill="#556b78"/><path d="M35 25h10v17H35z" fill="#d89f61"/><path d="m25 39 6 10 9-6-2-5" fill="none"/><path d="m51 9 4 8m7-2-4 5" stroke="#f1cb6c"/></g>`,
 saw:`<g transform="rotate(-38 32 32)"><path d="M25 18h27q12 0 12 11t-12 11H25z" fill="#d2ddcb"/><path d="m29 16 4-5 3 6 5-6 3 6 5-5 4 5m-24 25 4 5 3-5 5 5 4-5 4 5 4-6" fill="none"/><path d="M3 13h29v33H3z" fill="#df8659"/><path d="M8 20h18v13H8z" fill="#efc17a"/><path d="M6 38h15v15H6z" fill="#596e79"/><path d="M33 29h19" stroke="#80969a"/></g>`,
 flame:`<path d="M7 28h18v31H7z" fill="#d17d51"/><path d="M9 20h14v10H9z" fill="#7d9090"/><path d="m20 36 31-12 5 12-31 12z" fill="#e0b773"/><path d="m16 39 7 15 10-4-6-15" fill="#4f6a78"/><path d="m47 25 10-4 5 13-10 4z" fill="#6d7d7e"/><path d="M51 18Q40 9 47 0q2 9 8 3-1 7 6 5-6 10-10 10z" fill="#f4a046"/><path d="m51 13 3-6 3 7" fill="#fff0b3"/>`,
 freeze:`<path d="M9 29h21v29H9z" fill="#7cacb6"/><path d="M12 22h15v10H12z" fill="#d5e9d8"/><path d="m27 31 27-10 6 14-29 11z" fill="#a2dbd4"/><path d="m21 42 3 15 11-3-6-17" fill="#5c839d"/><path d="m49 22 9-4 6 19-10 3z" fill="#6aafc5"/><path d="M39 2v16m-7-12 14 8m-14 0 14-8m-7-4-3 3m3-3 3 3m-3 13-3-3m3 3 3-3" stroke="#c8f9ea" stroke-width="2.5"/>`,
 dart:`<g transform="rotate(-40 32 32)"><path d="M18 30h31v5H18z" fill="#d8dfce"/><path d="m47 30 14 2-14 4" fill="#657c89"/><path d="M19 33 6 16l1 17-4 15z" fill="#d57059"/><path d="M14 33 5 27m12 9L7 42" stroke="#ecab77" stroke-width="2"/></g>` ,
 grab:`<path d="M19 37 8 27q-5-7 2-8l9 7V13q0-8 7-7l2 17V9q0-8 7-5l1 20 2-13q2-6 7-3l1 20 3-10q6-3 7 3l-4 24q-1 9-23 9z" fill="#faf0cf"/><path d="m24 32 1 8m10-9v10m9-8-1 6" fill="none" stroke="#c3b495" stroke-width="2"/><path d="M22 46h28v13H22z" fill="#ee704c"/><path d="M28 50h15" stroke="#fff1c7" stroke-width="2"/>`,
 poke:`<g transform="rotate(-34 32 32)"><path d="M27 23h10v35q-5 5-10 0z" fill="#d39a58"/><path d="m28 42 8 2m-8 5 8 2" stroke="#8e5f3c" stroke-width="2"/><path d="M9 7h45v22H9z" fill="#f7c84c"/><path d="M8 6h10v24H8zm37 0h11v24H45z" fill="#ed6848"/><path d="M21 12h18" stroke="#ffec9d" stroke-width="3"/></g>`,
 blaster:`<path d="m18 35-4 22h15l4-22" fill="#4e6877"/><path d="m18 41 10 1m-11 5 10 1" stroke="#24313b" stroke-width="2"/><path d="M9 20h40v19H9z" fill="#6dc5c5"/><path d="M46 17h10v20H46z" fill="#eb7750"/><path d="M7 23h11v13H7z" fill="#f5d26d"/><path d="M23 15h13v7H23z" fill="#f4ebd6"/><path d="M24 29h13m-6-4v8" stroke="#f4ead2" stroke-width="3"/><path d="m54 15 5-8m-1 18h5" stroke="#f6ca55" stroke-width="3"/>`,
 bomb:`<path d="M35 15q14-14 16 0" stroke="#a99061" fill="none"/><path d="m49 8 1-6m4 11 8-1m-9 5 5 5" stroke="#f8ca55" stroke-width="3"/><path d="M28 12h13v12H28z" fill="#9ca8a6"/><circle cx="30" cy="39" r="21" fill="#435765"/><path d="M17 37q-1-11 11-14" stroke="#e4e5cf" stroke-width="5" fill="none"/><path d="m40 42 5 4m-5 0 5-4" stroke="#f67e5a" stroke-width="2"/>`,
 rocket:`<g transform="rotate(37 32 32)"><path d="m25 44 7 19 7-19" fill="#f6bd4c"/><path d="M26 45 32 56l5-11" fill="#ef7650"/><path d="M24 23 13 47l13-5m15-19 10 24-13-5" fill="#e77453"/><path d="M23 38V17q2-12 9-15 9 4 10 16v20z" fill="#f5eed2"/><path d="M23 18q3-12 9-16 7 4 10 16z" fill="#ea704c"/><circle cx="32" cy="27" r="6" fill="#66c7d2"/><path d="M23 38h19v7H23z" fill="#748f99"/></g>`,
 shock:`<path d="m12 40 11-13 26 17-11 14z" fill="#526c81"/><path d="m20 38 5-7 16 11-5 7z" fill="#91cde3"/><path d="m26 29 6-12 16 10-7 13" fill="#879ba8"/><path d="m28 26 18 11m-16-17 18 11" stroke="#d3edda" stroke-width="3"/><path d="m40 21 5-8m-8 5 2-10" stroke="#f3efcc" stroke-width="4"/><path d="m25 4 8 9-7 5 9 7m20-19-7 6 7 6-5 4" fill="none" stroke="#f8d560" stroke-width="3"/>`,
 magnet:`<g transform="rotate(-15 32 32)"><path d="M11 10h13v26q8 12 16 0V10h13v27q-1 24-21 24-21 0-21-24z" fill="#ed6d53"/><path d="M11 10h13v15H11zm29 0h13v15H40z" fill="#eff0d8"/><path d="m7 3-4 8m25-9 4 7m27-7 4 7" stroke="#f5cb57" stroke-width="3" fill="none"/><path d="M17 37q0 17 15 17" stroke="#f79871" stroke-width="3" fill="none"/></g>`,
 ball:`<circle cx="32" cy="32" r="26" fill="#f29a4a"/><path d="M8 30q5-23 30-22" fill="none" stroke="#ffd789" stroke-width="4"/><path d="M6 32h52M32 6v52M13 14q28 17 0 36m38-36q-28 17 0 36" fill="none" stroke-width="2.5"/>`,
 balloon:`<path d="M32 39q-15 13 0 18t10 7" stroke="#efe2ba" stroke-width="2" fill="none"/><path d="m31 37-4 8h10l-4-8" fill="#ec7858"/><ellipse cx="32" cy="22" rx="18" ry="21" fill="#e77963"/><path d="M22 14q4-7 10-7" stroke="#ffe2b2" stroke-width="4" fill="none"/><path d="m26 45 7 1" stroke="#9c3e37" stroke-width="2"/>`,
 spring:`<path d="m20 19 27 7-26 9 26 8-26 7" stroke="#d6e5d8" stroke-width="6" fill="none"/><path d="m20 19 27 7-26 9 26 8-26 7" stroke="#546e7d" stroke-width="2" fill="none"/><path d="M6 9h52v12H6zm0 40h52v12H6z" fill="#edc458"/><path d="m13 10 8 10m3-10 8 10m3-10 8 10m3-10 8 10" stroke-width="3"/><path d="M9 53h45" stroke="#ffdf8c" stroke-width="2"/>`
};
function toolSVG(tool){return `<svg viewBox="0 0 64 66" aria-hidden="true" fill="none" stroke="#22313c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${TOOL_ART[tool]}</svg>`;}
const toolName=id=>id==='shock'?'Tesla':id==='freeze'?'Cryo':TOOLS[id].name.toLowerCase().replace(/^./,s=>s.toUpperCase());
const toolHelp=id=>TOOLS[id].hint.toLowerCase().replace(/buddy/g,'Buddy').replace(/tesla/g,'Tesla').replace(/^./,s=>s.toUpperCase());
for(const [id,def] of Object.entries(TOOLS)){
 const b=document.createElement('button');b.className='tool'+(id==='grab'?' selected':'');b.dataset.tool=id;b.id=id+'Btn';b.title=toolName(id)+' ('+def.key.toUpperCase()+') — '+toolHelp(id);b.setAttribute('aria-label',toolName(id));b.setAttribute('aria-pressed',id==='grab'?'true':'false');b.hidden=!!def.cost;b.innerHTML=toolSVG(id)+`<span>${toolName(id)}</span><kbd>${def.key.toUpperCase()}</kbd>`+(def.cost?`<em class=price>$${def.cost}</em>`:'');document.getElementById('toolrack').append(b);
}

/* Absolute snapshot codec, protocol 5. Little-endian, decipixel quantization.
   No baselines/deltas: an omitted packet cannot corrupt the next state.
   Headers include generation + sequence. Control/events remain small reliable JSON.
   The same Uint8Array is accepted by native WebRTC and Trystero actions. */
const SnapshotCodec={
 encode(s){
  const data=new Uint8Array(BB.MAX_SNAPSHOT),v=new DataView(data.buffer);let o=0;
  const u8=n=>v.setUint8(o++,n),u16=n=>{v.setUint16(o,n,true);o+=2;},i16=n=>{v.setInt16(o,n,true);o+=2;},u32=n=>{v.setUint32(o,n,true);o+=4;},i32=n=>{v.setInt32(o,n,true);o+=4;};
  const q=n=>i16(Math.round(clamp(n,-3276.7,3276.7)*10)),q32=n=>i32(Math.round(n*10));
  const text=t=>{const a=new TextEncoder().encode(String(t));if(a.length>240)throw Error('Snapshot string too large');u8(a.length);data.set(a,o);o+=a.length;};
  const pool=(a,write)=>{if(a.length>255)throw Error('Snapshot pool too large');u8(a.length);for(const n of a)write(n);};
  u8(66);u8(66);u8(BB.VERSION);u8(1);
  [s.q,s.t,s.gen].forEach(u32);q32(s.time);[s.score,s.candy,s.bank,s.earned].forEach(u32);
  u32(s.unlock);s.upg.forEach(u8);u8(s.combo);u8(s.bestCombo);q(s.comboLeft);u8(Math.round(s.impact*100));
  u8((s.low?1:0)|(s.paused?2:0)|(s.shock?4:0)|(s.free?8:0));u8(s.skin);q32(s.bestAir);u32(s.stain);
  s.d.forEach(u16);s.mood.forEach(q);u8(s.task[0]);q(s.task[1]);u8(s.task[2]?1:0);
  pool(s.n,n=>{u32(n[0]);for(let i=1;i<5;i++)q(n[i]);u8(n[5]);u8(n[6]);q32(n[7]);});
  pool(s.h,h=>{text(h[0]);text(h[1]);const color=parseInt(h[2].slice(1),16);u8(color>>16);u8(color>>8);u8(color);q(h[3]);q(h[4]);u8((h[5]?1:0)|(h[6]?2:0));u8(TOOL_IDS.indexOf(h[7]));q32(h[8]);if(h[6]){u32(h[6][0]);u32(h[6][1]);q(h[6][2]);}});
  pool(s.c,n=>{u32(n[0]);q(n[1]);q(n[2]);u8(n[3]);u8(n[4]);});
  pool(s.p,n=>{u32(n[0]);for(let i=1;i<5;i++)q(n[i]);text(n[5]);});
  pool(s.pads,n=>{u32(n[0]);q(n[1]);q(n[2]);});
  pool(s.bonds,n=>{u32(n[0]);u32(n[1]);q(n[2]);});
  pool(s.props,n=>{u32(n[0]);q(n[1]);});
  u8(s.hat||0);
  pool(s.ropes||[],r=>{u32(r[0]);i32(r[1]);i32(r[2]);for(let i=3;i<8;i++)q(r[i]);});
  pool(s.bumpers||[],b=>{u32(b[0]);q(b[1]);q(b[2]);q(b[3]);});
  return data.slice(0,o);
 },
 decode(input){
  const a=input instanceof ArrayBuffer?new Uint8Array(input):input;
  if(!(a instanceof Uint8Array)||a.byteLength<90||a.byteLength>BB.MAX_SNAPSHOT)throw Error('Invalid snapshot length');
  const v=new DataView(a.buffer,a.byteOffset,a.byteLength);let o=0;
  const u8=()=>v.getUint8(o++),u16=()=>{const n=v.getUint16(o,true);o+=2;return n;},i16=()=>{const n=v.getInt16(o,true);o+=2;return n;},u32=()=>{const n=v.getUint32(o,true);o+=4;return n;},i32=()=>{const n=v.getInt32(o,true);o+=4;return n;};
  const q=()=>i16()/10,q32=()=>i32()/10;
  const text=()=>{const l=u8();if(l>240||o+l>a.byteLength)throw Error('Invalid snapshot text');const t=new TextDecoder().decode(a.subarray(o,o+l));o+=l;return t;};
  const pool=(max,read)=>{const n=u8();if(n>max)throw Error('Snapshot pool overflow');return Array.from({length:n},read);};
  if(u8()!==66||u8()!==66||u8()!==BB.VERSION||u8()!==1)throw Error('Wrong binary protocol');
  const s={v:BB.VERSION,q:u32(),t:u32(),gen:u32(),time:q32(),score:u32(),candy:u32(),bank:u32(),earned:u32(),unlock:u32(),upg:[u8(),u8(),u8()],combo:u8(),bestCombo:u8(),comboLeft:q(),impact:u8()/100};
  const flags=u8();s.low=!!(flags&1);s.paused=!!(flags&2);s.shock=!!(flags&4);s.free=!!(flags&8);s.skin=u8();s.bestAir=q32();s.stain=u32();s.d=Array.from({length:13},u16);s.mood=Array.from({length:4},q);s.task=[u8(),q(),!!u8()];
  s.n=pool(BB.MAX_NODES,()=>[u32(),q(),q(),q(),q(),u8(),u8(),q32()]);
  s.h=pool(BB.MAX_PLAYERS,()=>{const id=text(),name=text(),color='#'+((u8()<<16)|(u8()<<8)|u8()).toString(16).padStart(6,'0'),x=q(),y=q(),f=u8(),tool=TOOL_IDS[u8()],at=q32();return [id,name,color,x,y,!!(f&1),f&2?[u32(),u32(),q()]:null,tool,at];});
  s.c=pool(BB.MAX_CANDY,()=>[u32(),q(),q(),u8(),u8()]);
  s.p=pool(BB.MAX_ROCKETS,()=>[u32(),q(),q(),q(),q(),text()]);
  s.pads=pool(BB.MAX_PADS,()=>[u32(),q(),q()]);s.bonds=pool(BB.MAX_BALLOONS,()=>[u32(),u32(),q()]);s.props=pool(BB.MAX_NODES-13,()=>[u32(),q()]);
  s.hat=u8();s.ropes=pool(BB.MAX_TETHERS,()=>[u32(),i32(),i32(),q(),q(),q(),q(),q()]);
  s.bumpers=pool(BB.MAX_BUMPERS,()=>[u32(),q(),q(),q()]);
  if(o!==a.byteLength)throw Error('Trailing snapshot bytes');return s;
 }
};

/* Transport layer. Public discovery: pinned Trystero 0.25.4 / Nostr.
   Same-origin tabs: BroadcastChannel carries ONLY offers/candidates, never game state.
   Direct-code fallback: native WebRTC without a signaling service.
   Native state channel is unordered/unreliable; controls are ordered/reliable. */
class BuddyNet {
 constructor({room,hostId,id,offline=false,localSignal=true,onData,onOpen,onClose,onStatus,onMode}){
  Object.assign(this,{room,hostId,id,offline,localSignal,onData,onOpen,onClose,onStatus,onMode});
  this.links=new Map();this.onlineLinks=new Map();this.onlineIds=new Map();this.pendingIce=new Map();
  this.tx=0;this.rx=0;this.txByKind={};this.binaryPackets=0;this.binaryBytes=0;this.jsonSnapshotBytes=0;this.drops=0;this.messages=0;this.publicState='Not started';this.publicError='';this.relayCount=0;
  this.bc=null;this.tryRoom=null;this.generation=0;this.manualPending=new Map();this.onlineBusy=new Set();this.disposed=false;
  this.initLocal();this.heartbeat=setInterval(()=>this.announce(),1500);this.announce();
  if(!offline)this.startOnline();else this.setStatus('Local / direct WebRTC only');
 }
 get isHost(){return this.hostId===this.id;}
 setStatus(s){this.publicState=s;this.onStatus?.(s);}
 peers(){return [...new Set([...this.links].filter(([,l])=>l.control?.readyState==='open').map(([id])=>id).concat([...this.onlineLinks.keys()]))];}
 route(id){const l=this.links.get(id);return l?.control?.readyState==='open'?(window.__BB_TEST_ICE?'WebRTC / test TURN-TCP':l.mode==='local'?'local WebRTC':'direct WebRTC'):this.onlineLinks.has(id)?'Trystero / WebRTC':null;}
 initLocal(){
  if(!this.localSignal)return;
  try{this.bc=new BroadcastChannel('buddy-bay-signal-v4:'+this.room);this.bc.onmessage=e=>{this.localMessage(e.data).catch(e=>this.noteError(e));};}catch(e){this.bc=null;}
 }
 signal(data){try{this.bc?.postMessage({...data,from:this.id,room:this.room,host:this.hostId});}catch{}}
 announce(){if(this.disposed)return;this.signal({type:'presence',isHost:this.isHost});}
 async localMessage(m){
  if(!m||m.room!==this.room||m.from===this.id||(m.to&&m.to!==this.id)||typeof m.from!=='string')return;
  if(m.type==='presence'){
   if(this.links.size<12&&this.isHost&&!m.isHost&&m.host===this.id&&!this.links.has(m.from)&&this.peers().length<3){
    const l=this.createLink(m.from,true,'local');await l.pc.setLocalDescription(await l.pc.createOffer());this.signal({type:'offer',to:m.from,sdp:l.pc.localDescription});
   }return;
  }
  if(m.type==='offer'&&!this.isHost&&m.from===this.hostId){
   let l=this.links.get(m.from);if(l&&l.pc.signalingState!=='stable')return;if(l?.control?.readyState==='open')return;
   l=l||this.createLink(m.from,false,'local');await l.pc.setRemoteDescription(m.sdp);await this.flushIce(l);
   await l.pc.setLocalDescription(await l.pc.createAnswer());this.signal({type:'answer',to:m.from,sdp:l.pc.localDescription});return;
  }
  if(m.type==='answer'&&this.isHost){const l=this.links.get(m.from);if(l?.pc.signalingState==='have-local-offer'){await l.pc.setRemoteDescription(m.sdp);await this.flushIce(l);}return;}
  if(m.type==='ice'){
   if(this.pendingIce.size>=12&&!this.pendingIce.has(m.from))return;
   const l=this.links.get(m.from);
   if(l?.pc.remoteDescription)await l.pc.addIceCandidate(m.candidate).catch(()=>{});
   else{const q=this.pendingIce.get(m.from)||[];if(q.length<30)q.push(m.candidate);this.pendingIce.set(m.from,q);}
  }
  if(m.type==='bye'){const l=this.links.get(m.from);if(l?.mode==='local')this.closeLink(l);}
 }
 async flushIce(l){for(const c of this.pendingIce.get(l.remoteId)||[])await l.pc.addIceCandidate(c).catch(()=>{});this.pendingIce.delete(l.remoteId);}
 createLink(remoteId,initiator,mode){
  // A loopback TURN fixture can be injected by the offline verification harness.
  const testIce=window.__BB_TEST_ICE;
  const pc=new RTCPeerConnection({iceServers:testIce||(mode==='local'||this.offline?[]:[{urls:['stun:stun.l.google.com:19302','stun:stun.cloudflare.com:3478']}]),iceTransportPolicy:testIce?'relay':'all',bundlePolicy:'max-bundle'});
  const l={pc,remoteId,mode,control:null,state:null,opened:false,closing:false,created:performance.now()};
  if(this.links.size>=12){pc.close();throw Error('Too many pending connections. Wait for a connection to finish.');}this.links.set(remoteId,l);
  if(mode==='local')pc.onicecandidate=e=>{if(e.candidate)this.signal({type:'ice',to:l.remoteId,candidate:e.candidate.toJSON()});};
  pc.ondatachannel=e=>this.bindChannel(l,e.channel);
  pc.onconnectionstatechange=()=>{
   if(pc.connectionState==='failed'||pc.connectionState==='closed')this.closeLink(l);
   if(pc.connectionState==='disconnected'){clearTimeout(l.disconnectTimer);l.disconnectTimer=setTimeout(()=>{if(pc.connectionState==='disconnected')this.closeLink(l);},4000);}
   if(pc.connectionState==='connected')clearTimeout(l.disconnectTimer);
  };
  if(initiator){this.bindChannel(l,pc.createDataChannel('bb-control',{ordered:true}));this.bindChannel(l,pc.createDataChannel('bb-state',{ordered:false,maxRetransmits:0}));}
  l.connectTimer=setTimeout(()=>{if(!l.opened)this.closeLink(l);},mode==='manual'?180000:22000);
  return l;
 }
 bindChannel(l,ch){
  if(ch.label==='bb-control')l.control=ch;else if(ch.label==='bb-state')l.state=ch;else return;
  ch.onopen=()=>{
   if(ch.label==='bb-control'&&!l.opened){l.opened=true;clearTimeout(l.connectTimer);this.onOpen?.(l.remoteId,this.route(l.remoteId));}
  };
  ch.onclose=()=>{if(ch.label==='bb-control')this.closeLink(l);};
  ch.onerror=()=>{};
  ch.binaryType='arraybuffer';
  ch.onmessage=e=>{
   if(e.data instanceof ArrayBuffer){
    if(this.isHost||l.remoteId!==this.hostId)return;
    try{const s=SnapshotCodec.decode(e.data);this.rx+=e.data.byteLength;this.messages++;this.binaryPackets++;this.onData(l.remoteId,'snapshot',s);}catch(err){this.noteError(err);}return;
   }
   if(typeof e.data!=='string'||e.data.length>65536)return;this.rx+=e.data.length;this.messages++;
   try{const m=JSON.parse(e.data);if(m.v!==BB.VERSION||m.room!==this.room||m.from!==l.remoteId||typeof m.k!=='string')return;this.onData(l.remoteId,m.k,m.d);}catch(err){this.noteError(err);}
  };
 }
 closeLink(l){
  if(l.closing)return;l.closing=true;clearTimeout(l.connectTimer);clearTimeout(l.disconnectTimer);
  if(this.links.get(l.remoteId)===l)this.links.delete(l.remoteId);
  try{l.control?.close();l.state?.close();l.pc.close();}catch{}
  if(l.opened&&!this.onlineLinks.has(l.remoteId))this.onClose?.(l.remoteId);
 }
 send(id,k,d,fast=false){
  if(this.disposed)return false;
  const m={v:BB.VERSION,room:this.room,from:this.id,k,d};
  const binary=k==='snapshot';let s;try{s=binary?SnapshotCodec.encode(d):JSON.stringify(m);}catch(e){this.noteError(e);this.drops++;return false;}
  const size=binary?s.byteLength:new TextEncoder().encode(s).length;
  if(size>64000)return false;
  const count=()=>{this.tx+=size;this.txByKind[k]=(this.txByKind[k]||0)+size;if(binary){this.binaryBytes+=size;this.jsonSnapshotBytes+=JSON.stringify(m).length;}};
  const l=this.links.get(id);
  if(l?.control?.readyState==='open'){
   const ch=fast&&l.state?.readyState==='open'?l.state:l.control;
   if(ch.bufferedAmount>(fast?32768:131072)){this.drops++;return false;}
   try{ch.send(s);count();return true;}catch{return false;}
  }
  const peer=this.onlineLinks.get(id);
  if(peer&&this.ctrlAction){
   if(fast&&this.onlineBusy.has(id)){this.drops++;return false;}
   const act=fast?this.snapAction:this.ctrlAction;
   if(fast)this.onlineBusy.add(id);
   count();
   Promise.resolve(act.send(binary?s:m,{target:peer})).catch(e=>this.noteError(e)).finally(()=>{if(fast)this.onlineBusy.delete(id);});return true;
  }return false;
 }
 broadcast(k,d,fast=false){for(const id of this.peers())this.send(id,k,d,fast);}
 noteError(e){this.publicError=String(e?.message||e).slice(0,140);}
 async startOnline(){
  if(this.starting)return;this.starting=true;const generation=++this.generation;this.setStatus('Loading public discovery…');
  try{
   let mod,last;
   for(const url of ['https://esm.run/trystero@0.25.4','https://esm.sh/trystero@0.25.4?bundle']){
    try{mod=await Promise.race([import(url),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Discovery download timed out')),9000))]);break;}catch(e){last=e;}
   }
   if(!mod)throw last||new Error('Could not load public discovery');if(generation!==this.generation||this.disposed)return;
   this.tryModule=mod;
   this.tryRoom=mod.joinRoom({appId:'xyz.tront.buddybay.prototype.v4',password:this.room,relayConfig:{redundancy:3,warnOnRelayFailure:false}},this.room,{onJoinError:e=>{this.noteError(e.error||e);this.setStatus('Peer connection failed; try direct codes.');}});
   const r=this.tryRoom;this.helloAction=r.makeAction('bbhello');this.ctrlAction=r.makeAction('bbctrl');this.snapAction=r.makeAction('bbstate');
   const hello=peer=>this.helloAction.send({id:this.id,host:this.hostId,room:this.room,isHost:this.isHost,v:BB.VERSION},{target:peer}).catch(e=>this.noteError(e));
   r.onPeerJoin=peer=>hello(peer);
   this.helloAction.onMessage=(m,{peerId})=>{
    if(!m||m.v!==BB.VERSION||m.room!==this.room||typeof m.id!=='string'||m.id.length>80||m.id===this.id)return;
    if(this.isHost?(m.host!==this.id||m.isHost):(m.id!==this.hostId||!m.isHost))return;
    if(!this.onlineLinks.has(m.id)&&this.isHost&&this.peers().length>=3)return;
    const first=!this.onlineLinks.has(m.id);this.onlineIds.set(peerId,m.id);this.onlineLinks.set(m.id,peerId);
    if(first){hello(peerId);this.onOpen?.(m.id,this.route(m.id));}
   };
   const receive=(m,{peerId})=>{
    const id=this.onlineIds.get(peerId);
    if((m instanceof Uint8Array)||(m instanceof ArrayBuffer)){
     if(!id||this.isHost||id!==this.hostId||this.links.get(id)?.control?.readyState==='open')return;
     try{const s=SnapshotCodec.decode(m);this.rx+=m.byteLength;this.messages++;this.binaryPackets++;this.onData(id,'snapshot',s);}catch(e){this.noteError(e);}return;
    }
    if(!id||m?.v!==BB.VERSION||m.room!==this.room||m.from!==id)return;
    if(this.links.get(id)?.control?.readyState==='open')return;
    this.rx+=JSON.stringify(m).length;this.messages++;this.onData(id,m.k,m.d);
   };
   this.ctrlAction.onMessage=receive;this.snapAction.onMessage=receive;
   r.onPeerLeave=peer=>{const id=this.onlineIds.get(peer);this.onlineIds.delete(peer);if(id){this.onlineLinks.delete(id);if(!this.links.get(id)?.opened)this.onClose?.(id);}};
   for(const peer of Object.keys(r.getPeers()))hello(peer);
   this.setStatus('Discovering over Nostr…');
   clearInterval(this.relayTimer);this.relayTimer=setInterval(()=>{
    if(generation!==this.generation)return;
    try{const sockets=mod.getRelaySockets?.()||{};this.relayCount=Object.values(sockets).filter(s=>s.readyState===1).length;
     if(this.relayCount)this.setStatus(`Public discovery · ${this.relayCount} relay${this.relayCount===1?'':'s'} open`);
     else this.setStatus('Discovery waiting for a public relay…');
     for(const peer of Object.keys(r.getPeers()))if(!this.onlineIds.has(peer))hello(peer);
    }catch{}
   },2200);
  }catch(e){this.noteError(e);this.setStatus('Online discovery unavailable · direct/local still work');}
  finally{this.starting=false;}
 }
 async retryOnline(){this.tryRoom?.leave();this.tryRoom=null;this.onlineLinks.clear();this.onlineIds.clear();clearInterval(this.relayTimer);this.starting=false;await this.startOnline();}
 async gather(pc){
  if(pc.iceGatheringState==='complete')return;
  await new Promise(resolve=>{const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',f);resolve();};const f=()=>{if(pc.iceGatheringState==='complete')done();};const timer=setTimeout(done,this.offline?1800:6000);pc.addEventListener('icegatheringstatechange',f);});
 }
 encode(m){return 'BB2.'+btoa(JSON.stringify(m));}
 decode(s){
  if(typeof s!=='string'||s.length>100000||!s.trim().startsWith('BB2.'))throw new Error('This is not a Buddy Bonk connection code.');
  const m=JSON.parse(atob(s.trim().slice(4)));if(m.v!==BB.VERSION||!m.sdp?.sdp||typeof m.from!=='string'||typeof m.room!=='string'||typeof m.host!=='string')throw new Error('Incomplete connection code.');return m;
 }
 async offer(){
  for(const [token,l] of this.manualPending)if(l.closing||l.opened)this.manualPending.delete(token);
  if(this.manualPending.size>=3)throw Error('Three offers are already pending. Finish or wait for them to expire.');
  if(!this.isHost)throw new Error('Only the host creates an offer.');if(this.peers().length>=3)throw new Error('This playroom already has four hands.');
  const token=uid(),l=this.createLink('pending-'+token,true,'manual');l.token=token;this.manualPending.set(token,l);
  await l.pc.setLocalDescription(await l.pc.createOffer());await this.gather(l.pc);
  return this.encode({v:BB.VERSION,room:this.room,host:this.id,from:this.id,token,sdp:l.pc.localDescription.toJSON()});
 }
 async answer(code){
  const m=this.decode(code);if(m.sdp.type!=='offer')throw new Error('Paste the host’s OFFER, not an answer.');if(m.from===this.id)throw new Error('Open the offer in a second browser.');
  if(this.peers().length)throw new Error('Leave your current room before answering another offer.');
  if(this.room!==m.room||this.hostId!==m.host){
   this.generation++;this.tryRoom?.leave();this.tryRoom=null;clearInterval(this.relayTimer);this.bc?.close();this.room=m.room;this.hostId=m.host;this.onlineLinks.clear();this.onlineIds.clear();
   this.initLocal();this.onMode?.({room:this.room,hostId:this.hostId});
  }
  const existing=this.links.get(m.from);if(existing)this.closeLink(existing);
  const l=this.createLink(m.from,false,'manual');await l.pc.setRemoteDescription(m.sdp);await l.pc.setLocalDescription(await l.pc.createAnswer());await this.gather(l.pc);
  return this.encode({v:BB.VERSION,room:this.room,host:this.hostId,from:this.id,token:m.token,sdp:l.pc.localDescription.toJSON()});
 }
 async finish(code){
  const m=this.decode(code);if(m.sdp.type!=='answer'||m.host!==this.id||m.room!==this.room)throw new Error('That answer is for a different host or room.');
  const l=this.manualPending.get(m.token);if(!l||l.closing)throw new Error('Offer expired. Create a new offer and exchange codes again.');
  this.links.delete(l.remoteId);l.remoteId=m.from;this.links.set(m.from,l);this.manualPending.delete(m.token);await l.pc.setRemoteDescription(m.sdp);return true;
 }
 drop(id){const l=this.links.get(id);if(l)this.closeLink(l);const peer=this.onlineLinks.get(id);if(peer){this.onlineLinks.delete(id);this.onlineIds.delete(peer);try{this.tryRoom?.getPeers()[peer]?.close();}catch{}this.onClose?.(id);}}
 async rtcStats(){const out=[];for(const [id,l] of this.links){const st=await l.pc.getStats();out.push({id,connection:l.pc.connectionState,channels:[l.control,l.state].filter(Boolean).map(c=>({label:c.label,state:c.readyState,ordered:c.ordered,maxRetransmits:c.maxRetransmits})),reports:[...st.values()].filter(s=>['candidate-pair','local-candidate','remote-candidate','data-channel'].includes(s.type))});}return out;}
 stats(){return {peers:this.peers().length,routes:this.peers().map(id=>({id,route:this.route(id)})),tx:this.tx,rx:this.rx,txByKind:{...this.txByKind},binaryPackets:this.binaryPackets,binaryBytes:this.binaryBytes,jsonSnapshotBytes:this.jsonSnapshotBytes,dropped:this.drops,received:this.messages,public:this.publicState,relayCount:this.relayCount,error:this.publicError};}
 dispose(){
  if(this.disposed)return;
  // Best effort graceful leave: let the reliable goodbye drain before closing SCTP.
  // Abrupt process/network loss is still handled by the authority's input lease.
  if(this.isHost)this.broadcast('end',{});else this.send(this.hostId,'goodbye',{});
  this.signal({type:'bye'});this.disposed=true;this.generation++;
  clearInterval(this.heartbeat);clearInterval(this.relayTimer);this.bc?.close();
  const links=[...this.links.values()];setTimeout(()=>{this.tryRoom?.leave();for(const l of links)this.closeLink(l);this.manualPending.clear();this.pendingIce.clear();this.onlineBusy.clear();},100);
 }
}

/* Bounded local blood renderer. Each authoritative cue expands into seeded droplets
   and cached wall/floor paint. No particle positions enter a network snapshot.
   Only the last 96 cue records are sent once when a peer joins. */
class BloodFX {
 constructor(){
  this.level=1;this.epoch=0;this.marks=[];this.seen=new Set();this.drops=[];this.spawned=0;
  this.layer=document.createElement('canvas');this.layer.width=BB.W;this.layer.height=BB.H;this.ctx=this.layer.getContext('2d');
 }
 clear(epoch=0){this.epoch=epoch;this.marks=[];this.seen.clear();this.drops=[];this.ctx.clearRect(0,0,BB.W,BB.H);}
 setLevel(level){this.level=clamp(level|0,0,2);if(!this.level)this.drops=[];this.repaint();}
 restore(fx){
  if(!fx||!Number.isInteger(fx.epoch)||!Array.isArray(fx.marks)||fx.marks.length>BB.MAX_STAINS||fx.epoch<this.epoch)return;
  if(fx.epoch>this.epoch)this.clear(fx.epoch);
  for(const mark of fx.marks)this.hit(mark,fx.epoch,false);
 }
 valid(m){return Array.isArray(m)&&m.length===9&&m.every(finite)&&Number.isInteger(m[0])&&m[0]>0&&m[1]>-100&&m[1]<1400&&m[2]>-100&&m[2]<800&&m[5]>0&&m[5]<=160&&m[6]>=1&&m[6]<=5&&m[8]>=0&&m[8]<13;}
 hit(m,epoch,animate=true){
  if(!this.valid(m)||epoch<this.epoch)return;
  if(epoch>this.epoch)this.clear(epoch);
  if(this.seen.has(m[0]))return;
  this.seen.add(m[0]);if(this.seen.size>256){const keep=this.marks.map(m=>m[0]);this.seen=new Set([...keep,m[0]]);}
  if(m[6]===DAMAGE.burn)return;
  this.marks.push(m);
  if(this.marks.length>BB.MAX_STAINS){this.marks.shift();this.repaint();}else if(this.level)this.stamp(m);
  if(!this.level||!animate)return;
  const rng=seeded(m[7]),power=m[5]/100,angle=Math.atan2(m[4],m[3]),count=Math.round((8+power*14)*(this.level===2?1.8:1));
  for(let i=0;i<count;i++){
   const a=angle+(rng()-.5)*2.0,speed=100+rng()*380*power;
   const p={x:m[1]+(rng()-.5)*12,y:m[2]+(rng()-.5)*12,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-90,life:.55+rng()*.65,r:1.8+rng()*3.2,color:i%3?'#ad2941':'#742033'};
   if(this.drops.length>=360)this.drops.shift();this.drops.push(p);this.spawned++;
  }
 }
 repaint(){this.ctx.clearRect(0,0,BB.W,BB.H);if(this.level)for(const m of this.marks)this.stamp(m);}
 stamp(m){
  const c=this.ctx,rng=seeded(m[7]),power=m[5]/100,dx=m[3]/100,dy=m[4]/100,level=this.level===2?1.25:1;
  c.save();c.beginPath();c.rect(BB.LEFT,BB.TOP,BB.RIGHT-BB.LEFT,BB.H-BB.TOP);c.clip();
  const splat=(x,y,r,flat=false)=>{
   c.save();c.translate(x,y);if(flat)c.scale(1,.22);c.rotate(rng()*6.28);
   c.fillStyle='#88233a';c.strokeStyle='#612133';c.lineWidth=.65;c.beginPath();
   const n=15;for(let j=0;j<n;j++){const a=j/n*Math.PI*2,rr=r*(.48+rng()*.6);if(j)c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);else c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.stroke();
   c.globalAlpha=.43;c.fillStyle='#c4444d';c.beginPath();c.ellipse(-r*.1,-r*.2,r*.27,r*.18,-.5,0,Math.PI*2);c.fill();c.restore();
  };
  const wallX=clamp(m[1]+dx*(16+rng()*55),BB.LEFT+15,BB.RIGHT-15),wallY=clamp(m[2]+dy*(10+rng()*35),BB.TOP+15,BB.FLOOR-12),radius=(5+power*15)*level;
  c.globalAlpha=.88;splat(wallX,wallY,radius);
  for(let i=0;i<6;i++){const spread=16+rng()*radius*2.8;splat(wallX+(rng()-.5)*spread*2,wallY+(rng()-.5)*spread,1.3+rng()*radius*.24);}
  // Drip lengths are seeded, not accumulated every frame; staining remains cheap.
  for(let i=0;i<2;i++){
   const x=wallX+(rng()-.5)*radius,y=wallY+radius*.25,l=Math.min(BB.FLOOR-y,7+rng()*24*power);
   c.strokeStyle='#92273c';c.lineWidth=1.4+rng()*1.6;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(x+.6,y+l);c.stroke();splat(x,y+l,2);
  }
  const floorX=clamp(m[1]+dx*(30+rng()*120),BB.LEFT+15,BB.RIGHT-15);
  splat(floorX,BB.FLOOR+5+rng()*13,10+radius*1.2,true);
  for(let i=0;i<3;i++)splat(floorX+(rng()-.5)*100,BB.FLOOR+3+rng()*22,2+rng()*5,true);
  c.restore();
 }
 drawBack(c){if(this.level)c.drawImage(this.layer,0,0);}
 drawFront(c,dt){
  if(!this.level)return;
  for(const p of this.drops){
   p.life-=dt;p.vy+=830*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
   if(p.y>BB.FLOOR+14||p.x<BB.LEFT||p.x>BB.RIGHT){p.life=0;continue;}
   c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(p.vy,p.vx));c.globalAlpha=clamp(p.life*4,0,1);
   c.fillStyle=p.color;c.strokeStyle='#662338';c.lineWidth=.6;c.beginPath();c.ellipse(0,0,p.r*(1+Math.min(1,Math.hypot(p.vx,p.vy)/500)),p.r*.65,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
  }
  this.drops=this.drops.filter(p=>p.life>0);
 }
 stats(){return {bloodParticles:this.drops.length,stainRecords:this.marks.length,spawnedParticles:this.spawned,level:this.level,epoch:this.epoch};}
}

/* Hand-built cartoon test chamber. All scene artwork is local Canvas2D.
   Cosmetic particles are event-driven; toys, candy, rockets and tethers use host snapshots. */
const INK='#263842',PAPER='#f4e9cc';
class BuddyRenderer {
 constructor(canvas){
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.particles=[];this.rings=[];this.beams=[];this.blasts=[];this.trails=new Map();this.speech=new Map();this.scuffs=[];this.blood=new BloodFX();this.flyingDarts=[];this.motion=true;this.localHandVisible=false;this.mallets=new Map();this.timeline=0;this.airwaves=[];this.tetherPreviews=new Map();this.shells=[];this.bumperPulses=new Map();
  this.last=performance.now();this.frame=0;this.fps=60;this.shake=0;this.rimKick=0;this.flash=0;
  this.resize();new ResizeObserver(()=>this.resize()).observe(canvas);
 }
 resetEffects(){this.tetherPreviews.clear();this.shells=[];this.bumperPulses.clear();this.airwaves=[];this.mallets.clear();this.blood.clear();this.flyingDarts=[];this.particles=[];this.rings=[];this.beams=[];this.blasts=[];this.scuffs=[];this.trails.clear();this.shake=0;this.flash=0;this.rimKick=0;}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);this.dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);this.scale=Math.min(this.w/BB.W,this.h/BB.H);this.ox=(this.w-BB.W*this.scale)/2;this.oy=(this.h-BB.H*this.scale)/2;}
 toWorld(x,y){const r=this.canvas.getBoundingClientRect();return {x:clamp((x-r.left-this.ox)/this.scale,BB.LEFT,BB.RIGHT),y:clamp((y-r.top-this.oy)/this.scale,BB.TOP,BB.FLOOR)};}
 toScreen(x,y){return {x:this.ox+x*this.scale,y:this.oy+y*this.scale};}
 line(x,y,xx,yy,color,width=1){const c=this.ctx;c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
 circle(x,y,r,fill,stroke=null,lw=1){const c=this.ctx;c.beginPath();c.arc(x,y,Math.max(0,r),0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
 rect(x,y,w,h,r,fill,stroke=null,lw=1){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}}
 poly(points,fill,stroke=null,width=2){const c=this.ctx;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
 text(text,x,y,size,color,font='700',align='left'){const c=this.ctx;c.fillStyle=color;c.font=`${font} ${size}px "Arial", sans-serif`;c.textAlign=align;c.fillText(String(text),x,y);}
 mono(text,x,y,size,color,align='left'){const c=this.ctx;c.fillStyle=color;c.font=`bold ${size}px "Courier New",monospace`;c.textAlign=align;c.fillText(String(text),x,y);}
 star(x,y,r,color,rotation=0){const points=[];for(let i=0;i<10;i++){const a=rotation+i*Math.PI/5-Math.PI/2,rr=i%2?r*.43:r;points.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr]);}this.poly(points,color,INK,1.2);}
 bolt(x1,y1,x2,y2,color,width=3,phase=0){const c=this.ctx,dx=x2-x1,dy=y2-y1,d=Math.hypot(dx,dy)||1;c.beginPath();c.moveTo(x1,y1);for(let i=1;i<8;i++){const t=i/8,noise=Math.sin(i*21+phase)*13*Math.sin(t*Math.PI);c.lineTo(lerp(x1,x2,t)-dy/d*noise,lerp(y1,y2,t)+dx/d*noise);}c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.lineJoin='miter';c.stroke();}
 particle(x,y,color,speed=200,life=.7,kind='chip'){if(this.particles.length>=420)this.particles.shift();const a=Math.random()*Math.PI*2;this.particles.push({x,y,vx:Math.cos(a)*speed*(.3+Math.random()*.7),vy:Math.sin(a)*speed-75,life,max:life,r:kind==='smoke'?9+Math.random()*13:2+Math.random()*4,color,kind,angle:Math.random()*6});}
 event(e){
  if(e.type==='swing'){this.rememberMallet(e);return;}
  if(e.type==='swingCancel'){const m=this.mallets.get(e.who);if(m&&m.sid===e.sid)m.cancelAge=Math.max(0,(e.at-m.at)/BB.HZ);return;}
  if(e.type==='poke'&&e.sid){const m=this.mallets.get(e.who);if(m&&m.sid===e.sid)m.ct=e.ct;}
  this.polishEvent(e);this.capEffects();
  const now=performance.now();
  if(e.type==='chat'){this.speech.set(e.who,{text:String(e.text).slice(0,90),until:now+5000});return;}
  if(e.type==='clear'||e.type==='stand'){this.trails.clear();if(e.type==='clear'){this.scuffs=[];this.particles=[];}for(let i=0;i<15;i++)this.particle(e.x,e.y,'#f4efd6',170,.5,'smoke');}
  if(e.type==='basket'){this.rimKick=1;this.shake=2;for(let i=0;i<38;i++)this.particle(e.x,e.y,['#f5cb55','#ed714e','#eef0d6','#69c7c9'][i%4],280,1);this.rings.push({x:e.x,y:e.y-40,r:0,life:1,max:1,color:'#f2d276',text:'SWISH!'});}
  if(e.type==='poke'&&e.hit){this.shake=Math.max(this.shake,e.buddy?2.5:1);this.rings.push({x:e.x,y:e.y,r:10,life:.16,max:.16,color:'#fff0b5'});for(let i=0;i<(e.buddy?7:4);i++)this.particle(e.x,e.y,i%2?'#f6d887':'#ee7854',160,.23,'chip');}
  if(e.type==='shot'){this.beams.push({...e,life:.1,max:.1});if(e.hit){for(let i=0;i<4;i++)this.particle(e.tx,e.ty,'#f5cf70',180,.2);this.shake=Math.max(this.shake,1.2);}this.particle(e.x,e.y,'#ecd89a',180,.5);}
  if(e.type==='explosion'){
   this.shake=8;this.flash=.08;
   const cluster=this.blasts.find(b=>b.life>.30&&Math.hypot(b.x-e.x,b.y-e.y)<75);
   if(cluster){cluster.life=Math.max(cluster.life,.40);cluster.power=Math.max(cluster.power,e.power||1);}else this.blasts.push({x:e.x,y:e.y,life:.48,max:.48,power:e.power||1});
   this.scuffs.push({x:e.x,y:e.y,r:30+Math.random()*25});if(this.scuffs.length>12)this.scuffs.shift();
   for(let i=0;i<28;i++)this.particle(e.x,e.y,['#ed7350','#f8c35c','#f8e3a2','#455f69'][i%4],420,.65+i*.015,i%3?'chip':'smoke');
   for(let i=0;i<6;i++)this.particle(e.x,e.y,'#f8d168',400,.8,'star');
  }
  if(e.type==='launch'){for(let i=0;i<9;i++)this.particle(e.x,e.y,'#eee3c5',160,.45,'smoke');}
  if(e.type==='zap'){this.beams.push({...e,life:.14,max:.14});}
  if(e.type==='pop'){for(let i=0;i<14;i++)this.particle(e.x,e.y,['#ef7659','#f4d175','#76c9c7'][i%3],240,.5);this.rings.push({x:e.x,y:e.y,r:12,life:.25,max:.25,color:PAPER});}
  if(e.type==='spring'){this.rings.push({x:e.x,y:e.y-30,r:0,life:.45,max:.45,color:'#f4d571',text:'BOING'});for(let i=0;i<5;i++)this.particle(e.x,e.y,'#efe6c9',90,.35,'smoke');}
  if(['spawn','bomb','balloon','place'].includes(e.type)){for(let i=0;i<9;i++)this.particle(e.x,e.y,PAPER,140,.32);}
  if(e.type==='bounce'&&e.s>.35){for(let i=0;i<4;i++)this.particle(e.x,e.y,'#bdc9b9',80,.35,'smoke');}
  if(e.type==='grab')this.rings.push({x:e.x,y:e.y,r:12,life:.18,max:.18,color:PAPER});
  if(e.type==='collect'){this.rings.push({x:e.x,y:e.y-10,r:0,life:.45,max:.45,color:'#fce8a2',text:'+'+e.value,small:true});}
  if(e.type==='combo'||e.type==='challenge'){
   this.rings.push({x:e.x,y:e.y-25,r:0,life:1.3,max:1.3,color:'#f6d56d',text:e.type==='challenge'?'STUNT COMPLETE!':e.combo+' HIT COMBO!'});
   for(let i=0;i<20;i++)this.particle(e.x,e.y,['#ee8059','#eccc65','#59b7c4'][i%3],250,.85,'star');
  }
  this.capEffects();
 }
 background(t,low){
  const c=this.ctx;
  c.fillStyle='#abc3c8';c.fillRect(-3000,-2000,7000,6000);
  c.fillStyle='#b9cdd0';c.fillRect(36,55,1208,590);
  c.fillStyle='#b1c7ca';c.fillRect(36,382,1208,265);
  // Big, quiet wall panels and real physical boundary pads.
  for(const x of [36,337,638,939,1244]){this.line(x,64,x,628,'#95b0b7',2);this.line(x+2,64,x+2,628,'#cbd9d6',1);}
  this.line(36,380,1244,380,'#8da8b0',3);this.line(36,386,1244,386,'#c8d6d1',2);
  for(const y of [116,355,407,594])for(const x of [50,323,652,925,1230]){this.circle(x,y,2.4,'#809ca7');this.line(x-1,y,x+1,y,'#d0ded8',1);}
  // Ceiling rail, suspended fluorescent fixture and a small cable run.
  this.rect(35,48,1210,17,1,'#445e6a',INK,2);this.line(36,66,1244,66,'#cbd5c8',3);
  this.line(515,66,515,98,'#526c75',3);this.line(759,66,759,98,'#526c75',3);
  this.rect(486,99,302,17,3,'#778d91',INK,3);this.rect(497,114,280,10,2,'#f5eecb','#839c9c',2);
  c.globalAlpha=.12;this.poly([[506,126],[768,126],[940,475],[328,475]],'#fcf4d7');c.globalAlpha=1;
  // A stencilled bay number, not a web-page headline.
  c.save();c.globalAlpha=.21;this.text('03',354,322,113,'#63828d','900');c.restore();
  // Pegboard with a few spare objects on the left. No decorative UI cards.
  this.rect(103,274,154,174,3,'#bfb397','#879c9e',2);this.rect(110,281,140,159,2,'#d3c6a0');
  for(let x=121;x<245;x+=17)for(let y=291;y<435;y+=18)this.circle(x,y,1.5,'#b0a382');
  c.save();c.translate(147,342);c.rotate(-.22);this.rect(-5,0,10,60,3,'#bd8858',INK,2);this.rect(-28,-13,56,25,5,'#e5ad55',INK,3);this.rect(-31,-13,11,25,2,'#e58259',INK,2);c.restore();
  this.circle(215,321,15,null,'#527c8c',8);this.line(203,333,192,361,'#527c8c',7);
  this.rect(110,434,140,13,1,'#778a8b',INK,2);this.mono('SPARES',178,466,10,'#6a8590','center');
  // Breaker box and conduit.
  this.line(851,66,851,160,'#66828d',6);this.line(853,66,853,160,'#cbd4c9',2);
  this.rect(812,159,80,100,3,'#8da6aa','#647f87',2);this.rect(822,169,60,71,1,'#c7d2c8','#597c89',2);
  this.poly([[850,181],[837,206],[849,206],[844,226],[863,198],[852,198]],'#edc764',INK,1.5);this.circle(876,249,3,low?'#70d4b8':'#ec7656',INK,1.5);
  for(const x of [41,1199]){this.rect(x,392,40,250,5,'#617d85',INK,3);this.rect(x+6,398,28,237,3,'#e0b95f',INK,2);for(let y=414;y<628;y+=42){this.poly([[x+7,y],[x+33,y+15],[x+33,y+33],[x+7,y+18]],'#536976');}this.circle(x+20,404,2,INK);this.circle(x+20,629,2,INK);}
  // Floor slab: simple material changes, stripes, inked silhouettes.
  c.fillStyle='#607d86';c.fillRect(-3000,646,7000,2500);this.rect(36,630,1208,16,0,'#e8cc7b',INK,2);
  c.save();c.beginPath();c.rect(36,632,1208,12);c.clip();for(let x=10;x<1280;x+=46)this.poly([[x,632],[x+20,632],[x+8,646],[x-12,646]],'#435e6d');c.restore();
  this.line(-2000,648,3000,648,INK,4);this.line(36,653,1244,653,'#8ca5a5',3);
  c.strokeStyle='#9eb6b2';c.lineWidth=2;c.beginPath();c.ellipse(640,727,132,42,0,0,Math.PI*2);c.stroke();this.line(640,657,640,820,'#91aba9',2);
  for(const [x,dx] of [[85,-45],[380,-12],[906,18],[1200,60]])this.line(x,655,x+dx,770,'#536f7b',2);
  this.line(80,695,1200,695,'#739097',1);
  for(let i=0;i<13;i++){const x=220+i*67,y=495+(i*17)%125;this.line(x,y,x+4+(i%3)*4,y-2,'#93afb5',1);}
  if(low){c.globalAlpha=.14;c.fillStyle='#4564be';c.fillRect(36,67,1208,562);c.globalAlpha=1;for(let i=0;i<15;i++)this.star(135+i*69,170+(i*61)%360+Math.sin(t+i)*8,2.6,'#e3e1b9',t*.2);this.mono('LOW G',849,280,10,'#50668a','center');}
 }
 hoop(t,score){
  const c=this.ctx;
  this.line(1178,230,1220,230,'#6c8790',13);this.line(1220,226,1220,310,'#6c8790',12);
  this.rect(1163,198,15,137,2,'#ece8cf',INK,3);this.line(1167,204,1167,324,'#faf5db',3);
  this.rect(1048,173,92,60,2,'#59727c',INK,3);this.rect(1055,179,78,45,1,'#233b48');
  this.mono('HOOPS',1094,191,8,'#92afb2','center');this.mono(String(score).padStart(2,'0'),1094,216,25,'#f4d17b','center');
  const kick=this.rimKick*Math.sin(t*18)*7;
  for(let i=0;i<=7;i++){
   const x=1048+i*103/7,xx=1065+i*68/7;
   this.line(x,330,xx+kick,396,'#e8e9d0',2.7);
   if(i<7)this.line(x,330,1065+(i+1)*68/7+kick,396,'#c8d6cb',1.4);
  }
  for(let j=1;j<5;j++){const y=330+j*13,inset=j*3.5;this.line(1048+inset+kick*j/5,y,1151-inset+kick*j/5,y,'#e8e9d0',1.5);}
  this.line(1048,328,1151,328,INK,11);this.line(1048,325,1151,325,'#eb7854',7);this.line(1052,323,1147,323,'#ffc488',2);
  this.circle(1048,327,6,'#ed8158',INK,2);this.circle(1151,327,6,'#ed8158',INK,2);
 }
 shadows(nodes){const c=this.ctx;for(const n of nodes){if(n[6]===0&&![0,1,2,10,12].includes(n[0]))continue;const h=BB.FLOOR-n[2];c.beginPath();c.ellipse(n[1]+h*.06,650,n[5]*(1.2+h/900),Math.max(3,n[5]*.19),0,0,Math.PI*2);c.fillStyle=`rgba(25,50,63,${clamp(.16-h/4000,.035,.15)})`;c.fill();}}
 buddy(nodes,hands,t,impact,shock,skin=0){
  const c=this.ctx,by=new Map(nodes.map(n=>[n[0],n])),p=id=>{const n=by.get(id);return n?{x:n[1],y:n[2],r:n[5],vx:n[3],vy:n[4]}:null;};if(!p(12))return;
  const scheme=[['#f0c571','#dca656','#f2dfab','#f37e56'],['#a9d4d2','#72adb7','#e2e7cc','#eebf61'],['#bf9fc6','#947ab0','#eddbdc','#6ebdc8']][skin%3];
  const held=hands.some(h=>h[6]&&h[6][0]<13),head=p(0),chest=p(1),hip=p(2),ls=p(3),rs=p(6);
  // Broad seams are drawn on the same deforming segments as the physics rig.
  for(const [ai,bi,r] of LIMBS){const a=p(ai),b=p(bi);this.fabricLimb(a,b,r,scheme[0],scheme[2],scheme[1]);}
  this.line(head.x,head.y,chest.x,chest.y,INK,35);this.line(head.x,head.y,chest.x,chest.y,scheme[1],27);
  for(const id of [4,7,9,11]){const a=p(id);this.circle(a.x,a.y,8,scheme[1],INK,1.8);this.line(a.x-4,a.y,a.x+4,a.y,'#775f4d',1.4);}
  // Torso outline lives in the torso's rotating frame. World-axis hip offsets
  // made sideways falls look like the fabric imploded even with intact bones.
  const tl=Math.hypot(hip.x-chest.x,hip.y-chest.y)||1,ax=(hip.x-chest.x)/tl,ay=(hip.y-chest.y)/tl,rx=ay,ry=-ax;
  const left={x:ls.x-rx*12-ax*6,y:ls.y-ry*12-ay*6},right={x:rs.x+rx*12-ax*6,y:rs.y+ry*12-ay*6};
  const hl={x:hip.x-rx*28+ax*5,y:hip.y-ry*28+ay*5},hr={x:hip.x+rx*28+ax*5,y:hip.y+ry*28+ay*5};
  c.beginPath();c.moveTo(left.x,left.y);c.quadraticCurveTo(chest.x-ax*30,chest.y-ay*30,right.x,right.y);c.bezierCurveTo(right.x+ax*30+rx*5,right.y+ay*30+ry*5,hr.x+rx*9-ax*20,hr.y+ry*9-ay*20,hr.x,hr.y);c.quadraticCurveTo(hip.x+ax*30,hip.y+ay*30,hl.x,hl.y);c.bezierCurveTo(hl.x-rx*9-ax*20,hl.y-ry*9-ay*20,left.x+ax*30-rx*5,left.y+ay*30-ry*5,left.x,left.y);c.closePath();c.fillStyle=scheme[0];c.fill();c.strokeStyle=INK;c.lineWidth=3.5;c.stroke();
  c.save();c.setLineDash([4,5]);this.line(ls.x-rx*5+ax*6,ls.y-ry*5+ay*6,hip.x-rx*21+ax*5,hip.y-ry*21+ay*5,'#c08e51',1.5);this.line(rs.x+rx*5+ax*6,rs.y+ry*5+ay*6,hip.x+rx*21+ax*5,hip.y+ry*21+ay*5,'#c08e51',1.5);c.restore();
  const angle=Math.atan2(hip.y-chest.y,hip.x-chest.x)-Math.PI/2;
  c.save();c.translate(lerp(chest.x,hip.x,.38),lerp(chest.y,hip.y,.38));c.rotate(angle);
  this.rect(-22,-20,44,41,7,'#f4e6c3',INK,2.5);this.circle(0,0,12,null,scheme[3],3);this.line(-16,0,16,0,scheme[3],2);this.line(0,-15,0,15,scheme[3],2);this.circle(0,0,3,INK);
  this.rect(-21,38,42,8,2,'#496776',INK,2);this.rect(-7,37,14,10,1,'#d5ddc9',INK,1.5);c.restore();
  for(const id of [5,8])this.mitten(p(id),p(id-1),scheme[3],id===5?-1:1);
  for(const id of [10,12])this.sneaker(p(id),p(id-1),id===10?-1:1,'#66899a');
  // Face tracks hands, recoils under impact and blinks in the quiet moments.
  const faceAngle=Math.atan2(chest.y-head.y,chest.x-head.x)-Math.PI/2;
  c.save();c.translate(head.x,head.y);c.rotate(faceAngle);c.scale(1+impact*.09,1-impact*.07);
  this.circle(-40,7,8,scheme[1],INK,2.5);this.circle(40,7,8,scheme[1],INK,2.5);
  this.circle(0,0,44,scheme[2],INK,3.5);
  c.save();c.beginPath();c.arc(0,0,43,0,Math.PI*2);c.clip();c.fillStyle=scheme[0];c.beginPath();c.ellipse(22,31,41,15,-.1,0,Math.PI*2);c.fill();c.restore();
  c.save();c.setLineDash([3,4]);c.beginPath();c.arc(0,0,39,3.6,5.65);c.strokeStyle='#af9772';c.lineWidth=1.5;c.stroke();c.restore();
  this.line(-9,-42,-6,-48,INK,2.5);this.line(-2,-43,2,-48,INK,2.5);this.line(7,-42,12,-46,INK,2.5);
  let lx=0,ly=0,nearest=Infinity;for(const h of hands){const dx=h[3]-head.x,dy=h[4]-head.y,d=Math.hypot(dx,dy);if(d<nearest){nearest=d;lx=clamp((dx*Math.cos(faceAngle)+dy*Math.sin(faceAngle))/100,-1,1)*3.2;ly=clamp((-dx*Math.sin(faceAngle)+dy*Math.cos(faceAngle))/110,-1,1)*3;}}
  const mood=this.visualState?.mood||[],dam=this.visualState?.d?.[0]||0,bruised=(dam&15)>7;
  const threatened=hands.some(h=>!['grab','ball','balloon','spring','magnet','duck','bowling','air','tether','bumper'].includes(h[7])&&Math.hypot(h[3]-head.x,h[4]-head.y)<165); 
  const speed=Math.hypot(head.vx,head.vy),panic=held||speed>580||threatened||mood[2]>0,blink=Math.sin(t*.87+1)>.995;
  for(const x of [-16,16]){
   if(shock||impact>.8||mood[1]>.1){this.line(x-7,-13,x+6,-1,INK,3);this.line(x+6,-13,x-7,-1,INK,3);}
   else if(bruised&&x<0){this.circle(x,-7,13,'#946574');this.line(x-8,-6,x+7,-4,INK,3);}
   else if(blink){this.line(x-9,-5,x+8,-5,INK,3);}
   else{c.beginPath();c.ellipse(x,-7,panic?11:10,panic?15:13,0,0,Math.PI*2);c.fillStyle='#fff9de';c.fill();c.strokeStyle=INK;c.lineWidth=2;c.stroke();c.beginPath();c.ellipse(x+lx,-5+ly,4.8,7.3,0,0,Math.PI*2);c.fillStyle=INK;c.fill();this.circle(x+lx-1.5,-8+ly,1.5,'#fff9df');}
   this.line(x-7,-26+(panic?3:0),x+6,-27-(panic?1:0),INK,2.8);
  }
  if(panic||impact>.5||shock){c.beginPath();c.ellipse(0,20,panic?9:11,panic?11:6,0,0,Math.PI*2);c.fillStyle=INK;c.fill();this.rect(-5,22,10,4,2,'#e99477');}
  else{c.beginPath();c.moveTo(-14,13);c.quadraticCurveTo(0,23,14,13);c.quadraticCurveTo(10,32,-2,29);c.quadraticCurveTo(-10,27,-14,13);c.fillStyle=INK;c.fill();this.rect(-8,15,16,5,1,'#fff4d4');}
  this.circle(-29,12,5,'#dd9b74');this.circle(29,12,5,'#dd9b74');
  this.rect(17,28,21,9,2,'#f4e8bd','#a08e69',1);this.line(24,29,24,36,'#ccbe99',1);this.line(28,29,28,36,'#ccbe99',1);
  this.drawHat(this.visualState?.hat||0,t,head);
  c.restore();
  if(mood[1]>.1){for(let i=0;i<3;i++){const a=t*6+i*2.1;this.star(head.x+Math.cos(a)*64,head.y-44+Math.sin(a)*12,6,'#f7d471',a);}}
  if(shock){for(const [a,b] of LIMBS){const aa=p(a),bb=p(b);this.line(aa.x,aa.y,bb.x,bb.y,'#cafcfa',5);this.circle(aa.x,aa.y,5,'#cafcfa');}this.bolt(ls.x-25,ls.y-50,hip.x+25,hip.y+45,'#eafec7',3,t*50);}
 }
 ball(n){
  const c=this.ctx,x=n[1],y=n[2],r=n[5];let trail=this.trails.get(n[0]);if(!trail){trail=[];this.trails.set(n[0],trail);}trail.push({x,y});if(trail.length>7)trail.shift();
  if(Math.hypot(n[3],n[4])>450){for(let i=0;i<trail.length-1;i++){c.globalAlpha=i/trail.length*.12;this.circle(trail[i].x,trail[i].y,r*.9,'#f4b85e');}c.globalAlpha=1;}
  c.save();c.translate(x,y);c.rotate(n[7]);this.circle(0,0,r,'#ed984e',INK,3);
  c.save();c.beginPath();c.arc(0,0,r-2,0,Math.PI*2);c.clip();this.circle(-r*.32,-r*.4,r*.75,'#f6bf70');
  this.line(-r,0,r,0,'#865837',2);this.line(0,-r,0,r,'#865837',2);
  for(const s of [-1,1]){c.beginPath();c.moveTo(s*r*.73,-r);c.bezierCurveTo(-s*r*.25,-r*.3,-s*r*.25,r*.3,s*r*.73,r);c.strokeStyle='#865837';c.lineWidth=2;c.stroke();}
  for(let i=0;i<14;i++){const x=(i*13)%36-18,y=(i*19)%36-18;if(x*x+y*y<r*r-20)this.circle(x,y,.9,'#bc763f66');}c.restore();c.restore();
 }
 bomb(n,fuse,t){const c=this.ctx;c.save();c.translate(n[1],n[2]);const pulse=fuse<.8?1+Math.sin(t*36)*.06:1;c.scale(pulse,pulse);this.line(5,-17,12,-27,'#bd9b66',3);this.star(13,-28,4+Math.sin(t*36)*2,'#ffd677',t*9);this.rect(-5,-23,14,10,2,'#7c9198',INK,2);this.circle(0,0,n[5],fuse<.6&&Math.sin(t*30)>0?'#e7805b':'#435e6c',INK,3);c.beginPath();c.arc(-2,-2,11,3.35,4.45);c.strokeStyle='#b4c4c4';c.lineWidth=4;c.stroke();this.mono(fuse.toFixed(1),1,7,11,'#f7d274','center');c.restore();}
 balloon(n,t){const c=this.ctx;c.save();c.translate(n[1],n[2]);c.rotate(Math.sin(t*2+n[0])*.07);const colors=['#eb8265','#76cbd0','#c59cc8','#edc462'],color=colors[n[0]%4];this.poly([[-4,25],[0,20],[5,26]],color,INK,2);c.beginPath();c.ellipse(0,0,24,28,0,0,Math.PI*2);c.fillStyle=color;c.fill();c.strokeStyle=INK;c.lineWidth=2.5;c.stroke();c.beginPath();c.ellipse(-8,-9,5,10,.5,0,Math.PI*2);c.fillStyle='#f6e4c4aa';c.fill();c.restore();}
 spring(p,t,ghost=false){const c=this.ctx,[id,x,kick]=p;const phase=(1-(kick||0))*.2;const height=21+(kick>0?(-12*Math.exp(-phase*40)+Math.sin(phase*32)*8)*kick:0);const y=BB.FLOOR;
  c.save();if(ghost)c.globalAlpha=.45;
  for(const off of [-34,34]){c.beginPath();c.moveTo(x+off-8,y-12);for(let i=0;i<5;i++)c.lineTo(x+off+(i%2?8:-8),y-12-i*height/4);c.strokeStyle=INK;c.lineWidth=7;c.stroke();c.strokeStyle='#c9d8d0';c.lineWidth=4;c.stroke();}
  this.rect(x-64,y-15-height,128,12,3,'#edc565',INK,3);this.line(x-60,y-12-height,x+60,y-12-height,'#ffebb1',2);
  this.rect(x-68,y-10,136,9,2,'#556f7a',INK,3);for(const off of [-55,55])this.circle(x+off,y-5,2,'#e3d4a7');c.restore();
 }
 rocket(p,t){const c=this.ctx,[id,x,y,vx,vy]=p;c.save();c.translate(x,y);c.rotate(Math.atan2(vy,vx));this.poly([[-17,-5],[-37-Math.sin(t*55)*9,0],[-17,6]],'#f5b648',INK,1.5);this.poly([[-18,-3],[-30,0],[-18,3]],'#fff2bb');this.poly([[-8,-7],[-17,-17],[-16,-3],[-16,3],[-17,17],[-8,7]],'#e56d4c',INK,2);this.rect(-16,-7,30,14,5,'#ece7ce',INK,2);this.poly([[8,-7],[20,0],[8,7]],'#ed7751',INK,2);this.circle(-1,0,4,'#78becb',INK,1);c.restore();}
 candy(n,t){const c=this.ctx,[id,x,y,value,color]=n;const colors=['#ed8162','#f7d077','#74c9c6','#c398c6'];c.save();c.translate(x,y);c.rotate((id*.7+t)*.8);this.poly([[-4,-4],[-10,-6],[-8,0],[-10,6],[-4,4]],PAPER,INK,1);this.poly([[4,-4],[10,-6],[8,0],[10,6],[4,4]],PAPER,INK,1);this.rect(-5,-6,10,12,3,colors[color%4],INK,1.5);this.line(-2,-4,2,4,'#fff6d2',2);c.restore();}
 gloveShape(x,y,color,down,scale=1){const c=this.ctx;c.save();c.translate(x,y);c.rotate(-.2);c.scale(scale,scale);c.fillStyle='#faf0cf';c.strokeStyle=INK;c.lineWidth=2.8;c.lineJoin='round';c.beginPath();
  if(down){c.moveTo(-10,2);c.bezierCurveTo(-17,2,-16,13,-11,21);c.lineTo(-4,33);c.quadraticCurveTo(11,38,24,29);c.lineTo(28,11);c.quadraticCurveTo(28,2,19,3);c.quadraticCurveTo(17,-4,10,-2);c.quadraticCurveTo(4,-8,-2,-3);c.quadraticCurveTo(-11,-7,-10,2);}
  else{c.moveTo(-7,23);c.lineTo(-18,12);c.bezierCurveTo(-22,6,-17,2,-13,6);c.lineTo(-5,12);c.lineTo(-5,-9);c.bezierCurveTo(-5,-17,3,-17,3,-9);c.lineTo(4,7);c.lineTo(5,-15);c.bezierCurveTo(5,-22,13,-22,13,-14);c.lineTo(13,7);c.lineTo(15,-9);c.bezierCurveTo(15,-16,22,-15,22,-8);c.lineTo(22,11);c.lineTo(25,0);c.bezierCurveTo(27,-6,33,-4,32,3);c.lineTo(29,24);c.quadraticCurveTo(24,35,6,35);c.quadraticCurveTo(-3,32,-7,23);}
  c.closePath();c.fill();c.stroke();for(const xx of [3,12,21])this.line(xx,down?4:15,xx,down?13:24,'#cfbc93',1.5);this.rect(-3,31,29,12,2,color,INK,2.5);this.line(2,35,21,35,'#f2e7ceaa',1.5);c.restore();
 }
 rememberMallet(e){
  if(!e||typeof e.who!=='string'||!Number.isInteger(e.sid)||!Number.isInteger(e.at)||!finite(e.x)||!finite(e.y))return;
  const old=this.mallets.get(e.who);if(old&&old.sid>=e.sid)return;
  if(this.mallets.size>=BB.MAX_PLAYERS&&!old)this.mallets.delete(this.mallets.keys().next().value);
  this.mallets.set(e.who,{...e,side:e.side===-1?-1:1,ct:finite(e.ct)?e.ct:null,cancelAge:null});
 }
 drawMallet(h,worldTime){
  const c=this.ctx,[id,name,color,x,y]=h,m=this.mallets.get(id),age=m?worldTime-m.at/BB.HZ:99;
  const active=m&&age>=0&&age<MALLET.END,side=active?m.side:(x<BB.W/2?-1:1);
  const contact=active&&m.ct!==null?m.ct/1000:null,cancel=active?m.cancelAge:null;
  let ax=active?m.x:x,ay=active?m.y:y;
  // Let the last part of recovery return to the live cursor. The strike itself stays planted.
  if(active&&age>.33){const k=smooth01((age-.33)/.13);ax=lerp(ax,x,k);ay=lerp(ay,y,k);}
  const p=malletPose(ax,ay,side,active?age:0,contact,cancel);
  // Two restrained speed arcs only on a REAL downswing, not on wind-up/recovery.
  if(active&&cancel===null&&age>MALLET.WIND&&age<(contact??MALLET.CONTACT)){
   c.save();c.globalAlpha=.5;
   for(let j=0;j<2;j++){
    c.beginPath();for(let i=0;i<=9;i++){const q=malletPose(ax,ay,side,Math.max(MALLET.WIND,age-.036)+i*.036/9);const point=q.point(-12+j*23,-94-j*5);i?c.lineTo(point.x,point.y):c.moveTo(point.x,point.y);}
    c.strokeStyle=j?'#fff5d4':color;c.lineWidth=j?2:4;c.lineCap='round';c.stroke();
   }c.restore();
  }
  c.save();c.translate(p.px,p.py);c.scale(side,1);c.rotate(p.a);
  // Weighted barrel, visible red impact face, neck collar and one closed glove.
  this.rect(-5,-72,10,84,3,'#c9955e',INK,2.5);this.line(-2,-48,-2,-7,'#efc087',2);
  for(let i=0;i<4;i++)this.line(-4,-9+i*5,4,-7+i*5,'#926440',1.5);
  this.rect(-9,-61,18,11,2,'#87654a',INK,2);
  this.rect(-32,-90,66,34,5,'#f4c75f',INK,3);
  this.rect(-35,-91,12,36,3,'#e57752',INK,2.5);this.line(-32,-85,-32,-62,'#ffb28a',2.5);
  this.rect(25,-91,11,36,3,'#d96747',INK,2.5);
  this.line(-16,-84,17,-84,'#ffebb0',3);this.line(-14,-61,19,-61,'#c58d40',2);
  this.circle(6,-73,5,null,'#bd8b3f',1.5);
  this.gloveShape(-4,0,color,true,.6);c.restore();this.malletLabel={x:p.px,y:p.py+34};
  // A small aim mark keeps the promised contact point legible while cocked.
  if(!active||age<MALLET.WIND){this.circle(x,y,4,null,color,1.4);}
 }
 toolCursor(h,t,nowTime){
  const c=this.ctx,[id,name,color,x,y,down,g,tool,act=-10]=h;const age=nowTime-act;
  if(tool==='grab'){this.gloveShape(x,y,color,down,.85);return;}
  if(tool==='poke'){this.drawMallet(h,nowTime);return;}
  if(tool==='blaster'||tool==='rocket'){
   this.circle(x,y,11,null,color,2);for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])this.line(x+dx*14,y+dy*14,x+dx*21,y+dy*21,color,2);
   const xx=tool==='rocket'?(x<640?BB.LEFT+18:BB.RIGHT-18):clamp(x-84,BB.LEFT+30,BB.RIGHT-30),yy=tool==='rocket'?clamp(y+105,BB.TOP+30,BB.FLOOR-45):clamp(y+48,BB.TOP+35,BB.FLOOR-20);
   c.save();c.translate(xx,yy);c.rotate(Math.atan2(y-yy,x-xx));if(age<.09)c.translate(-5,0);
   this.rect(-13,3,12,27,3,'#557582',INK,2.5);this.rect(-27,-13,56,22,4,tool==='rocket'?'#6f927e':'#78c3c7',INK,3);this.rect(24,-16,11,27,2,'#ef8159',INK,2);this.rect(-31,-9,12,15,2,'#edd18a',INK,2);this.rect(-9,-20,18,8,1,'#e1e4c9',INK,2);this.gloveShape(-8,17,color,true,.5);c.restore();return;
  }
  if(tool==='magnet'){
   if(down){c.save();c.setLineDash([5,12]);for(let i=0;i<3;i++){const r=50+(((620-t*310+i*180)%560+560)%560);this.circle(x,y,r,null,color+'55',1.6);}c.restore();}
   c.save();c.translate(x,y);c.rotate(Math.PI*.25);c.scale(.72,.72);c.beginPath();c.moveTo(-22,-25);c.lineTo(-22,5);c.bezierCurveTo(-22,36,22,36,22,5);c.lineTo(22,-25);c.strokeStyle=INK;c.lineWidth=18;c.stroke();c.strokeStyle='#ed795b';c.lineWidth=12;c.stroke();this.line(-22,-25,-22,-13,PAPER,12);this.line(22,-25,22,-13,PAPER,12);c.restore();this.gloveShape(x+14,y+26,color,true,.5);return;
  }
  if(tool==='shock'){
   this.circle(x,y,7,null,color,2);c.save();c.translate(x+12,y+17);c.rotate(.55);this.rect(-11,-7,22,33,4,'#567387',INK,2.5);this.rect(-8,-29,16,25,2,'#a1cbd0',INK,2);for(let i=0;i<4;i++)this.line(-11,-25+i*6,11,-25+i*6,'#e2ecd4',3);this.line(-5,-30,-8,-40,INK,3);this.line(5,-30,8,-40,INK,3);this.gloveShape(0,15,color,true,.5);c.restore();return;
  }
  if(tool==='bomb'){this.bomb([-1,x,y,0,0,15,2,0],2.4,t);this.gloveShape(x+12,y+14,color,true,.55);return;}
  if(tool==='ball'){c.save();c.globalAlpha=.85;this.ball([-1,x,y,0,0,18,1,t]);c.restore();this.gloveShape(x+13,y+15,color,true,.55);return;}
  if(tool==='balloon'){c.save();c.globalAlpha=.6;this.balloon([-2,x,y-50],t);this.line(x,y,x,y-22,PAPER,1.5);c.restore();this.gloveShape(x,y,color,false,.7);return;}
  if(tool==='spring'){this.spring([-1,x,0],t,true);this.circle(x,y,9,null,color,2);this.gloveShape(x+13,y+14,color,true,.6);}
 }
 glove(h,mine,t,by,hostId,worldTime){
  const c=this.ctx,[id,name,color,x,y,down,g,tool]=h;
  if(g&&tool==='grab'){const a=by.get(g[0]),b=by.get(g[1]);if(a&&b){const gx=lerp(a[1],b[1],g[2]),gy=lerp(a[2],b[2],g[2]);this.line(x,y,gx,gy,INK,4);this.line(x,y,gx,gy,color,2);this.circle(gx,gy,5,PAPER,INK,1.5);}}
  this.toolCursor(h,t,worldTime);
  const text=String(name).slice(0,20);c.font='bold 10px "Courier New",monospace';const w=c.measureText(text).width;
  const label=tool==='poke'&&this.malletLabel?this.malletLabel:{x:x+8,y:y+65};
  const lx=clamp(label.x,BB.LEFT+w/2+6,BB.RIGHT-w/2-6),ly=Math.min(label.y,BB.FLOOR+35);
  this.line(lx-w/2-5,ly-4,lx-w/2-5,ly+3,color,3);c.lineWidth=3;c.strokeStyle='#203643';c.textAlign='center';c.strokeText(text,lx+2,ly+3);c.fillStyle=mine?'#fcf0ce':'#cddfd8';c.fillText(text,lx+2,ly+3);
  const speech=this.speech.get(id);if(speech&&speech.until>performance.now()){
   const lines=[];let line='';for(const word of speech.text.split(' ')){if((line+' '+word).length>28){lines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)lines.push(line);
   const shown=lines.slice(0,4),sw=clamp(Math.max(...shown.map(s=>s.length))*6+24,80,215),sh=shown.length*16+18,xx=clamp(x,BB.LEFT+sw/2,BB.RIGHT-sw/2),yy=Math.max(BB.TOP+sh,y-38);
   this.rect(xx-sw/2+3,yy-sh+4,sw,sh,3,'#253d4866');this.rect(xx-sw/2,yy-sh,sw,sh,3,PAPER,INK,2.5);this.poly([[xx-5,yy-1],[xx+6,yy-1],[xx,yy+7]],PAPER,INK,1.5);shown.forEach((s,i)=>this.mono(s,xx,yy-sh+19+i*16,11,INK,'center'));
  }
 }
 blastSprite(){
  if(this._blastSprite)return this._blastSprite;
  const a=document.createElement('canvas');a.width=a.height=384;const c=a.getContext('2d');
  c.translate(192,192);c.beginPath();for(let i=0;i<24;i++){const t=i*Math.PI/12,r=(i%2?.66:1)*186;i?c.lineTo(Math.cos(t)*r,Math.sin(t)*r):c.moveTo(Math.cos(t)*r,Math.sin(t)*r);}c.closePath();c.fillStyle='#e97850';c.fill();c.strokeStyle=INK;c.lineWidth=2;c.stroke();
  for(const [x,y,r,color] of [[0,0,114,'#f6c961'],[-5,-6,64,'#fff0bd']]){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
  this._blastSprite=a;return a;
 }
 effects(dt,t){
  const c=this.ctx;
  for(const b of this.blasts){b.life-=dt;const age=1-b.life/b.max,rad=(25+age*180)*b.power;c.globalAlpha=clamp(b.life/b.max*1.6,0,1);c.drawImage(this.blastSprite(),b.x-rad-2,b.y-rad-2,rad*2+4,rad*2+4);}
  c.globalAlpha=1;this.blasts=this.blasts.filter(b=>b.life>0);
  for(const b of this.beams){b.life-=dt;c.globalAlpha=clamp(b.life/b.max,0,1);if(b.type==='rail'){this.line(b.x,b.y,b.tx,b.ty,'#cf567b',12);this.line(b.x,b.y,b.tx,b.ty,'#ffa7c8',6);this.line(b.x,b.y,b.tx,b.ty,'#fff8df',2);}else if(b.type==='shot'){this.line(b.x,b.y,b.tx,b.ty,'#f3c052',5);this.line(b.x,b.y,b.tx,b.ty,'#fff5cf',2);this.star(b.tx,b.ty,b.hit?13:5,'#f8d870',t*20);}else{for(const q of b.targets||[]){this.bolt(b.x,b.y,q[0],q[1],'#64e4e3',8,t*40);this.bolt(b.x,b.y,q[0],q[1],'#f5ffd8',2.5,t*40);}if(!b.targets?.length)this.bolt(b.x,b.y,b.x+Math.sin(t*21)*40,b.y+Math.cos(t*17)*40,'#eafdca',2,t*50);}}
  c.globalAlpha=1;this.beams=this.beams.filter(b=>b.life>0);
  for(const d of this.flyingDarts){d.life-=dt;const a=1-clamp(d.life/d.max,0,1),x=lerp(d.x,d.tx,a),y=lerp(d.y,d.ty,a);c.save();c.translate(x,y);c.rotate(Math.atan2(d.ty-d.y,d.tx-d.x));this.line(-17,0,6,0,'#e7eedb',2);this.poly([[-12,0],[-21,-6],[-18,0],[-21,6]],'#d66c56',INK,1);c.restore();}this.flyingDarts=this.flyingDarts.filter(d=>d.life>0);
  for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.kind==='smoke'?-90:660)*dt;const a=clamp(p.life/p.max,0,1);c.globalAlpha=a;c.save();c.translate(p.x,p.y);c.rotate(p.angle+p.life*3);
   if(p.kind==='star')this.star(0,0,p.r*1.4,p.color);
   else if(p.kind==='flame'){this.poly([[0,-p.r*2],[p.r*.8,p.r*.3],[p.r*.4,p.r],[-p.r*.7,p.r*.5]],p.color);this.circle(0,p.r*.4,p.r*.35,'#ffe8ae');}
   else if(p.kind==='ice')this.poly([[0,-p.r*1.8],[p.r,p.r*.2],[0,p.r],[-p.r*.7,0]],p.color,'#d7f5e2',.7);
   else if(p.kind==='plus'){this.line(-p.r,0,p.r,0,p.color,3);this.line(0,-p.r,0,p.r,p.color,3);}
   else if(p.kind==='smoke')this.circle(0,0,p.r*(2-a),p.color);
   else this.rect(-p.r,-p.r*.5,p.r*2,p.r,1,p.color);
   c.restore();}
  c.globalAlpha=1;this.particles=this.particles.filter(p=>p.life>0);
  for(const r of this.rings){r.life-=dt;const age=1-r.life/r.max;c.globalAlpha=clamp(r.life/r.max*2,0,1);if(r.r){r.r+=170*dt;this.circle(r.x,r.y,r.r,null,r.color,3*(1-age));}if(r.text){const yy=r.y-age*40;c.save();c.translate(r.x,yy);c.rotate(r.small?0:-.08);c.font=`900 ${r.small?15:24}px Arial`;c.textAlign='center';c.lineWidth=5;c.strokeStyle=INK;c.strokeText(r.text,0,0);c.fillStyle=r.color;c.fillText(r.text,0,0);c.restore();}}
  c.globalAlpha=1;this.rings=this.rings.filter(r=>r.life>0);
 }
 draw(s,local,hostId,connected){
  const now=performance.now(),dt=clamp((now-this.last)/1000,.001,.05),t=now/1000;this.fps=lerp(this.fps,1/dt,.04);this.last=now;this.frame++;
  const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#abc3c8';c.fillRect(0,0,this.w,this.h);c.translate(this.ox,this.oy);c.scale(this.scale,this.scale);
  if(!this.motion){this.shake=0;this.flash=0;}this.shake*=Math.exp(-dt*16);this.rimKick*=Math.exp(-dt*4);c.translate(Math.sin(now*.07)*this.shake,Math.cos(now*.059)*this.shake*.6);
  this.background(t,!!s?.low);if(!s)return;this.visualState=s;this.timeline=s.t/BB.HZ;if(s.stain>this.blood.epoch)this.blood.clear(s.stain);this.blood.drawBack(c);
  for(const sc of this.scuffs){c.globalAlpha=.07;this.circle(sc.x,sc.y,sc.r,INK);c.globalAlpha=1;}
  this.shadows(s.n);this.hoop(t,s.score||0);
  const by=new Map(s.n.map(n=>[n[0],n])),props=new Map(s.props||[]),hands=s.h.map(h=>h.slice());let my=hands.find(h=>h[0]===local.id);
  if(!my){my=[local.id,local.name,local.color,local.x,local.y,local.down,null,local.tool,-10];hands.push(my);}
  Object.assign(my,{1:local.name,2:local.color,3:local.x,4:local.y,5:local.down,7:local.tool});
  if(local.down&&local.tool==='grab'&&!my[6]&&local.grip)my[6]=[local.grip.a,local.grip.b,local.grip.t];if(!local.down||local.tool!=='grab')my[6]=null;
  for(const rope of s.bonds||[]){const a=by.get(rope[0]),b=by.get(rope[1]);if(!a||!b)continue;const mx=(a[1]+b[1])/2,myy=(a[2]+b[2])/2+Math.max(0,rope[2]-Math.hypot(a[1]-b[1],a[2]-b[2]))*.7;c.beginPath();c.moveTo(a[1],a[2]+23);c.quadraticCurveTo(mx,myy,b[1],b[2]);c.strokeStyle=INK;c.lineWidth=3;c.stroke();c.strokeStyle='#f2e2b7';c.lineWidth=1.5;c.stroke();}
  for(const pad of s.pads||[])this.spring(pad,t);
  this.drawContraptions(s,hands,by,t);
  this.buddy(s.n,hands,t,s.impact||0,s.shock,s.skin||0);this.drawInjuries(s,t);this.updateEmitters(s,hands,dt,t);
  for(const n of s.n){if(n[6]===1)this.ball(n);if(n[6]===2)this.bomb(n,props.get(n[0])||0,t);if(n[6]===3)this.balloon(n,t);if(n[6]===4||n[6]===5)this.extraProp(n,t);}
  for(const p of s.p||[])this.rocket(p,t);for(const candy of s.c||[])this.candy(candy,t);
  this.capEffects();this.drawAirwaves(dt);this.effects(dt,t);this.blood.drawFront(c,dt);
  for(const h of hands)if(h[0]!==local.id)this.glove(h,false,t,by,hostId,this.timeline);
  const ownSwing=this.mallets.get(local.id),ownAge=ownSwing?this.timeline-ownSwing.at/BB.HZ:Infinity;
  if(this.localHandVisible)this.glove(my,true,t,by,hostId,this.timeline);
  // Touch has no hovering cursor. A committed tap still needs its ACTUAL hammer
  // visible through contact/recoil, otherwise Buddy appears to get hit by air.
  else if(my[7]==='poke'&&ownSwing&&ownSwing.cancelAge===null&&ownAge>=0&&ownAge<MALLET.END)this.drawMallet(my,this.timeline);
  if(this.flash>0){c.globalAlpha=this.flash;c.fillStyle='#fff6d4';c.fillRect(0,0,BB.W,BB.H);c.globalAlpha=1;this.flash=Math.max(0,this.flash-dt*.6);}
  for(const [id,m] of this.mallets)if(this.timeline-m.at/BB.HZ>MALLET.END+.2||!hands.some(h=>h[0]===id))this.mallets.delete(id);
  for(const id of this.trails.keys())if(id>=0&&!by.has(id))this.trails.delete(id);
  for(const [id,speech] of this.speech)if(speech.until<now)this.speech.delete(id);
 }
}

/* Extra presentation methods for the existing cartoon chamber.
   All random emission and weapon trails below are client cosmetics. */
BuddyRenderer.prototype.polishEvent=function(e){
 if(e.type==='air'){this.airwaves.push({...e,life:.42,max:.42});for(let i=0;i<8;i++)this.particle(e.x+e.dx*50,e.y+e.dy*50,'#e6f3da',110,.28,'smoke');}
 if(e.type==='rail'){this.beams.push({...e,life:.22,max:.22});if(this.motion)this.shake=Math.max(this.shake,3);for(let i=0;i<8;i++)this.particle(e.x,e.y,'#f8c3c8',170,.28,'chip');}
 if(e.type==='squeak'){this.rings.push({x:e.x,y:e.y-38,life:.48,max:.48,color:'#f7d776',text:'SQUEAK',small:true});}
 if(e.type==='toy'){for(let i=0;i<7;i++)this.particle(e.x,e.y,'#eee9c5',110,.28,'smoke');}
 if(e.type==='hurt'){
  this.blood.hit(e.m,e.epoch);
  if(e.m[6]===DAMAGE.burn){for(let i=0;i<3;i++)this.particle(e.m[1],e.m[2],'#5b5357',40,.6,'smoke');}
  if(this.motion)this.shake=Math.max(this.shake,Math.min(4,e.m[5]/24));return;
 }
 if(e.type==='clean'){this.blood.clear(e.epoch);this.scuffs=[];return;}
 if(e.type==='repair'){for(let i=0;i<20;i++)this.particle(e.x+(Math.random()-.5)*80,e.y+(Math.random()-.5)*130,'#a6dac5',130,.85,'plus');this.rings.push({x:e.x,y:e.y-50,life:1,max:1,color:'#c4f0cd',text:'GOOD AS NEW'});}
 if(e.type==='scatter'){
  for(const p of e.ends)this.beams.push({type:'shot',x:e.x,y:e.y,tx:p[0],ty:p[1],hit:true,life:.13,max:.13});
  for(let i=0;i<9;i++)this.particle(e.x,e.y,'#f3c96b',150,.5,i%3?'chip':'smoke');if(this.motion)this.shake=Math.max(this.shake,5);
 }
 if(e.type==='dart')this.flyingDarts.push({...e,life:.13,max:.13});
 if(e.type==='steam'){for(let i=0;i<14;i++)this.particle(e.x,e.y,'#edf1d4',100,.8,'smoke');}
 if(e.type==='shatter'){
  const rng=seeded(e.seed);for(let i=0;i<30;i++)this.particle(e.x+(rng()-.5)*65,e.y+(rng()-.5)*90,['#dbfbeb','#90d5dc','#77b4d5'][i%3],330,.55+rng()*.4,'ice');
  this.rings.push({x:e.x,y:e.y-45,life:.9,max:.9,color:'#c3f1e7',text:'ICE BREAKER!'});if(this.motion)this.shake=Math.max(this.shake,6);
 }
 if(e.type==='purchase'){
  this.rings.push({x:640,y:200,life:1.5,max:1.5,color:'#ffe2a2',text:e.text});
  for(let i=0;i<20;i++)this.particle(640,250,['#edd075','#ee8267','#b5ddd1'][i%3],240,.8,'star');
 }
 if(e.type==='bonus')this.rings.push({x:e.x,y:e.y-45,life:.8,max:.8,color:'#f9e3ab',text:e.text,small:true});
};
BuddyRenderer.prototype.drawInjuries=function(s,t){
 const c=this.ctx;const map=new Map(s.n.map(n=>[n[0],n]));
 for(let id=0;id<13;id++){
  const n=map.get(id),damage=s.d?.[id]||0;if(!n||!damage)continue;
  const bruise=damage&15,scorch=(damage>>4)&15,cuts=(damage>>8)&15,darts=(damage>>12)&3,rng=seeded(id*10351+93),r=n[5];
  c.save();c.translate(n[1],n[2]);
  const parentId=[1,2,1,1,3,4,1,6,7,2,9,2,11][id],parent=map.get(parentId);
  if(parent)c.rotate(id===0?Math.atan2(parent[2]-n[2],parent[1]-n[1])-Math.PI/2:Math.atan2(n[2]-parent[2],n[1]-parent[1])-Math.PI/2);
  // Imperfect patches, not gaping wounds: the indestructible Buddy stays intact.
  if(bruise>2){c.save();c.globalAlpha=bruise/15*.42;c.fillStyle='#775071';c.beginPath();c.ellipse(-r*.34,r*.16,r*.3,r*.23,-.4,0,Math.PI*2);c.fill();c.restore();}
  if(scorch>1){c.save();c.globalAlpha=scorch/15*.65;for(let j=0;j<3;j++)this.circle((rng()-.5)*r,(rng()-.5)*r,3+rng()*r*.38,'#51464c');c.restore();}
  if(this.blood.level&&cuts>0){
   for(let j=0;j<Math.min(4,Math.ceil(cuts/4));j++){
    const x=(rng()-.5)*r*.9,y=(rng()-.5)*r*.85+(id===0?16:0);
    this.circle(x,y,1.8+cuts*.2,'#89243c','#632237',.75);this.line(x,y+2,x+.7,y+4+cuts*.32,'#9f2940',1.3);
   }
  }
  for(let j=0;j<darts;j++){
   const a=-.7+rng()*1.7,xx=(rng()-.5)*r,yy=(rng()-.5)*r;
   c.save();c.translate(xx,yy);c.rotate(a);this.line(-2,0,-23,0,'#546975',2.5);this.line(-3,-1,-23,-1,'#e7e7d1',1);this.poly([[-22,0],[-31,-7],[-29,1],[-33,8]],'#d76754',INK,1.5);c.restore();
  }c.restore();
 }
 if((s.mood?.[3]||0)>0){
  const head=map.get(0),chest=map.get(1);c.save();c.globalAlpha=.26;
  for(const [a,b,r] of LIMBS){const aa=map.get(a),bb=map.get(b);this.line(aa[1],aa[2],bb[1],bb[2],'#97e5e1',r*2+8);}
  for(const id of [0,1,2]){const n=map.get(id);this.circle(n[1],n[2],n[5]+6,'#b0f1e8','#e0fff2',2);}
  c.globalAlpha=.85;for(let i=0;i<5;i++){const x=head[1]+Math.sin(i*13)*30,y=head[2]+i*35;this.line(x-6,y-8,x+6,y+8,'#e3fff6',2);this.line(x+6,y-8,x-6,y+8,'#e3fff6',2);}c.restore();
  this.mono('FROZEN',chest[1],head[2]-65,11,'#d9fff0','center');
 }
};
BuddyRenderer.prototype.updateEmitters=function(s,hands,dt,t){
 // dt based emission, globally capped. More visual intensity never increases host traffic.
 this.emissionBudget=Math.min(12,(this.emissionBudget||0)+dt*95);
 const add=(x,y,vx,vy,kind,color,r,life)=>{
  if(this.emissionBudget<1||this.particles.length>=420)return;this.emissionBudget--;
  this.particles.push({x,y,vx,vy,kind,color,r,life,max:life,angle:Math.random()*6});
 };
 for(const h of hands){
  if(!h[5])continue;const x=h[3],y=h[4],tool=h[7];
  if(tool==='flame'||tool==='freeze'){
   const ox=clamp(x-96,BB.LEFT+20,BB.RIGHT-20),oy=clamp(y+48,BB.TOP+20,BB.FLOOR-18),a=Math.atan2(y-oy,x-ox),sp=tool==='flame'?460:580;
   for(let i=0;i<Math.ceil(dt*48);i++){const an=a+(Math.random()-.5)*.24;add(ox+Math.cos(a)*38,oy+Math.sin(a)*38,Math.cos(an)*sp,Math.sin(an)*sp,tool==='flame'?'flame':'ice',tool==='flame'?['#fce19a','#f4ac50','#e66b4d'][i%3]:'#b5efeb',tool==='flame'?5+Math.random()*8:2+Math.random()*3,.24+Math.random()*.15);}
  }
  if(tool==='saw'){const n=s.n.find(n=>Math.hypot(n[1]-x,n[2]-y)<n[5]+35);if(n){add(x,y,(Math.random()-.5)*260,-100-Math.random()*150,'chip',n[6]===0?'#c79d69':'#ffc65c',2,.23);}}
 }
 if((s.mood?.[2]||0)>0){
  const n=s.n[(this.frame>>1)%3];for(let i=0;i<2;i++){add(n[1]+(Math.random()-.5)*40,n[2]-8,(Math.random()-.5)*35,-80-Math.random()*95,'flame',i?'#f0a349':'#e96b46',5+Math.random()*6,.55);}
 }
};
const basicCursor=BuddyRenderer.prototype.toolCursor;
BuddyRenderer.prototype.toolCursor=function(h,t,nowTime){
 const c=this.ctx,[id,name,color,x,y,down,g,tool,at=-10]=h;
 if(tool==='duck'||tool==='bowling'){c.save();c.globalAlpha=.72;this.extraProp([-1,x,y,0,0,tool==='duck'?22:28,tool==='duck'?4:5,0],t);c.restore();this.gloveShape(x+18,y+24,color,true,.55);return;}
 if(tool==='air'||tool==='rail'){
  const ox=clamp(x-105,BB.LEFT+25,BB.RIGHT-25),oy=clamp(y+55,BB.TOP+30,BB.FLOOR-25),age=nowTime-at,a=Math.atan2(y-oy,x-ox);
  this.circle(x,y,tool==='air'?21:10,null,color,1.6);if(tool==='rail'){this.line(x-22,y,x+22,y,color,1.3);this.line(x,y-22,x,y+22,color,1.3);}
  c.save();c.translate(ox,oy);c.rotate(a);if(age<.18)c.translate(-9*(1-age/.18),0);
  if(tool==='air'){this.poly([[-30,-17],[18,-23],[30,-19],[30,19],[18,23],[-30,17]],'#72b7b0',INK,3);this.rect(-36,-13,12,26,4,'#e2ce8c',INK,3);this.rect(19,-25,14,50,5,'#f3d371',INK,3);this.rect(27,-19,8,38,2,'#344f61',INK,2);this.line(-15,-12,7,-15,'#cce3c6',3);this.rect(-20,17,12,20,3,'#566c7a',INK,2);}
  else{this.rect(-30,-11,42,23,4,'#826181',INK,3);this.rect(2,-15,53,9,2,'#b5ccd0',INK,2);this.rect(2,6,53,9,2,'#b5ccd0',INK,2);for(let i=0;i<4;i++)this.rect(i*10+4,-11,4,22,1,'#ee93b6',INK,1.4);this.circle(-16,0,6,'#ffd882',INK,2);this.rect(-24,12,12,21,3,'#4b6474',INK,2);}
  this.gloveShape(-15,27,color,true,.5);c.restore();return;
 }
 if(!TOOLS[tool]?.cost)return basicCursor.call(this,h,t,nowTime);
 if(tool==='saw'){
  c.save();c.translate(x,y);c.rotate(-Math.PI/4);
  this.rect(-17,-11,65,22,10,'#dee1ce',INK,3);this.line(-7,0,34,0,'#657e89',3);
  for(let i=0;i<8;i++){const xx=-10+i*7+(down?(t*110)%7:0);this.poly([[xx,-11],[xx+4,-16],[xx+5,-10]],'#8b9897',INK,1);this.poly([[xx,11],[xx+4,16],[xx+5,10]],'#8b9897',INK,1);}
  this.rect(-39,-19,31,38,6,'#d97850',INK,3);this.rect(-33,-12,18,14,2,'#f0bc6b',INK,2);this.rect(-45,-9,11,29,3,'#56707a',INK,2);this.gloveShape(-33,17,color,true,.5);c.restore();return;
 }
 if(tool==='dart'){
  this.circle(x,y,8,null,color,2);c.save();c.translate(x+15,y+18);c.rotate(-.7);this.line(-17,0,11,0,'#e7e9d8',3);this.poly([[11,-2],[18,0],[11,2]],INK);this.poly([[-13,0],[-25,-10],[-22,0],[-25,10]],'#dc7559',INK,2);this.gloveShape(-14,8,color,true,.45);c.restore();return;
 }
 this.circle(x,y,tool==='shotgun'?18:11,null,color,1.8);
 if(tool==='shotgun')for(let i=0;i<3;i++)this.circle(x+(i-1)*8,y,1.5,color);
 else{this.line(x-17,y,x-8,y,color,2);this.line(x+8,y,x+17,y,color,2);}
 const ox=clamp(x-96,BB.LEFT+20,BB.RIGHT-20),oy=clamp(y+48,BB.TOP+20,BB.FLOOR-18),angle=Math.atan2(y-oy,x-ox);
 c.save();c.translate(ox,oy);c.rotate(angle);if(nowTime-at<.12&&tool==='shotgun')c.translate(-7,0);
 if(tool==='shotgun'){
  this.poly([[-44,-4],[-13,-8],[-9,9],[-46,17]],'#a36e4a',INK,3);this.rect(-15,-11,49,9,2,'#687f87',INK,3);this.rect(-15,-1,49,9,2,'#495f6d',INK,2);this.rect(4,-7,14,17,2,'#cd9260',INK,2);this.gloveShape(-13,16,color,true,.52);
 }else{
  const flame=tool==='flame';this.rect(-31,-19,24,35,6,flame?'#d78359':'#84c1c8',INK,3);this.rect(-33,-6,9,19,2,'#586f7b',INK,2);this.rect(-6,-9,34,17,3,flame?'#e5b25d':'#b4e5d8',INK,3);this.rect(25,-14,13,28,2,flame?'#6e6b67':'#6ba2bb',INK,2);this.line(-15,-11,-15,7,'#eaf0d6',3);this.gloveShape(-7,17,color,true,.5);
  if(down){this.circle(40,0,flame?5:4,flame?'#ffdc79':'#d4fff3');}
 }c.restore();
};

// Local-only artwork and limits for the experimental shelf.
BuddyRenderer.prototype.extraProp=function(n,t){
 const c=this.ctx,[id,x,y,vx,vy,r,kind,a]=n;c.save();c.translate(x,y);c.rotate(a||0);
 if(kind===5){
  this.circle(0,0,r,'#514664',INK,3);c.save();c.beginPath();c.arc(0,0,r-1,0,Math.PI*2);c.clip();
  this.line(-r,-r*.8,r,r*.45,'#76618b',r*.26);this.line(-r,-r*.35,r,r*.9,'#866c97',r*.11);c.restore();
  for(const [xx,yy,rr] of [[-8,-9,4.2],[5,-12,4.2],[4,1,5.2]]){this.circle(xx,yy,rr,'#1f263b','#9b83a7',1);}
  this.line(-19,-18,-11,-23,'#aa94b8',3);
 }else{
  c.scale(r/26,r/26);
  this.poly([[-22,5],[-33,-7],[-28,14],[-12,21]],'#eab44d',INK,2.7);
  c.beginPath();c.ellipse(-3,8,27,18,0,0,Math.PI*2);c.fillStyle='#f3cc55';c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();
  this.circle(12,-11,17,'#f8d768',INK,3);this.poly([[23,-13],[36,-7],[34,0],[21,1]],'#f18a4e',INK,2.5);
  this.circle(16,-15,3.4,INK);this.circle(17,-16,1,'#fff6d4');
  c.beginPath();c.ellipse(-7,9,14,8,-.3,0,Math.PI*2);c.fillStyle='#e5ae46';c.fill();c.strokeStyle='#b98a42';c.lineWidth=1.8;c.stroke();
  this.line(-14,5,-3,2,'#ffe397',2);this.line(8,-23,14,-25,'#fff0b0',2.5);
 }c.restore();
};
BuddyRenderer.prototype.capEffects=function(){
 for(const [name,max] of Object.entries({particles:420,rings:40,beams:96,blasts:8,scuffs:12,flyingDarts:32,airwaves:16}))if(this[name].length>max)this[name].splice(0,this[name].length-max);
};
BuddyRenderer.prototype.drawAirwaves=function(dt){
 const c=this.ctx;
 for(const w of this.airwaves){w.life-=dt;const age=1-w.life/w.max,a=Math.atan2(w.dy,w.dx),travel=40+age*330;
  c.save();c.translate(w.x+w.dx*travel,w.y+w.dy*travel);c.rotate(a);c.globalAlpha=Math.max(0,(1-age)*.65);
  for(let i=0;i<3;i++){c.beginPath();c.ellipse(-i*23,0,12+age*17,28+age*90+i*5,0,-Math.PI*.55,Math.PI*.55);c.strokeStyle=i?'#c2e4df':'#f5f8dc';c.lineWidth=i?3:5;c.stroke();}c.restore();
 }this.airwaves=this.airwaves.filter(w=>w.life>0);
};

/* Local presentation, deliberately separate from authoritative body geometry. */
BuddyRenderer.prototype.fabricLimb=function(a,b,r,base,light,shade){
 const c=this.ctx,dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,nx=-dy/l,ny=dx/l;
 c.beginPath();c.moveTo(a.x+nx*r*.8,a.y+ny*r*.8);
 c.bezierCurveTo(a.x+dx*.25+nx*r*1.03,a.y+dy*.25+ny*r*1.03,a.x+dx*.75+nx*r*.98,a.y+dy*.75+ny*r*.98,b.x+nx*r*.72,b.y+ny*r*.72);
 c.quadraticCurveTo(b.x+dx/l*r*.85,b.y+dy/l*r*.85,b.x-nx*r*.72,b.y-ny*r*.72);
 c.bezierCurveTo(a.x+dx*.75-nx*r*.98,a.y+dy*.75-ny*r*.98,a.x+dx*.25-nx*r*1.03,a.y+dy*.25-ny*r*1.03,a.x-nx*r*.8,a.y-ny*r*.8);
 c.quadraticCurveTo(a.x-dx/l*r*.8,a.y-dy/l*r*.8,a.x+nx*r*.8,a.y+ny*r*.8);
 c.fillStyle=base;c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();
 this.line(a.x+nx*r*.38,a.y+ny*r*.38,b.x+nx*r*.38,b.y+ny*r*.38,light,r*.35);
 c.save();c.setLineDash([2,5]);this.line(a.x-nx*r*.6,a.y-ny*r*.6,b.x-nx*r*.6,b.y-ny*r*.6,shade,1.3);c.restore();
};
BuddyRenderer.prototype.mitten=function(a,b,color,flip){
 const c=this.ctx;c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(a.y-b.y,a.x-b.x)-Math.PI/2);c.scale(flip,1);
 this.rect(-13,-20,26,12,3,'#f0dcac',INK,2.5);
 c.beginPath();c.moveTo(-13,-10);c.bezierCurveTo(-18,-3,-20,16,-9,23);c.bezierCurveTo(5,31,24,18,21,4);c.quadraticCurveTo(20,-14,7,-14);c.quadraticCurveTo(-4,-16,-13,-10);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();
 c.beginPath();c.ellipse(-15,1,8,11,.3,0,Math.PI*2);c.fillStyle=color;c.fill();c.strokeStyle=INK;c.lineWidth=2.7;c.stroke();
 this.line(-7,17,9,18,'#9b5147',1.8);this.line(-4,-8,8,-7,'#ffc6a0',3.8);this.line(-8,-16,8,-16,'#fff1ce',2);
 c.restore();
};
BuddyRenderer.prototype.sneaker=function(a,knee,flip,accent){
 const c=this.ctx;c.save();c.translate(a.x,a.y);c.rotate(Math.atan2(a.y-knee.y,a.x-knee.x)-Math.PI/2);c.scale(flip,1);
 this.rect(-11,-22,20,12,3,'#efdfb5',INK,2);
 c.beginPath();c.moveTo(-21,9);c.lineTo(-20,-12);c.quadraticCurveTo(-20,-19,-11,-18);c.lineTo(6,-17);c.quadraticCurveTo(12,-5,24,-4);c.quadraticCurveTo(33,-2,31,11);c.lineTo(-21,11);c.fillStyle=accent;c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();
 this.rect(-23,9,57,10,4,'#f6eccc',INK,2.3);this.line(-18,15,28,15,'#a8b9b4',1.4);
 c.beginPath();c.moveTo(16,-6);c.quadraticCurveTo(29,-4,30,9);c.lineTo(16,9);c.quadraticCurveTo(19,2,16,-6);c.fillStyle='#f0e3c6';c.fill();c.strokeStyle=INK;c.lineWidth=1.6;c.stroke();
 for(let i=0;i<3;i++)this.line(-4+i*3,-11+i*5,8+i*3,-10+i*5,'#fff1d1',2.5);
 this.circle(-13,-6,5,'#eac568',INK,1.5);this.star(-13,-6,3.2,'#fff2c8');c.restore();
};
BuddyRenderer.prototype.drawHat=function(hat,t,head){
 const c=this.ctx;if(!hat)return;c.save();c.translate(0,-39);c.rotate(clamp(-head.vx*.00008,-.12,.12)+Math.sin(t*3)*.012);
 if(hat===1){
  this.rect(-35,-2,70,9,4,'#e6b747',INK,2.8);
  c.beginPath();c.moveTo(-29,0);c.bezierCurveTo(-33,-43,31,-43,29,0);c.closePath();c.fillStyle='#f1c85e';c.fill();c.strokeStyle=INK;c.lineWidth=2.8;c.stroke();
  this.rect(-4,-32,8,32,3,'#ffe59b','#b28b42',1.5);this.line(-20,-5,-20,-14,'#dba640',2);this.line(20,-5,20,-14,'#dba640',2);
 }else if(hat===2){
  this.poly([[-31,1],[-36,-30],[-17,-19],[0,-40],[17,-19],[36,-30],[31,1]],'#f1c35f',INK,2.6);this.rect(-32,-4,64,11,3,'#e99558',INK,2.4);
  for(const x of [-20,0,20])this.circle(x,-9,x?3:5,x?'#6dbac3':'#d67170',INK,1.5);
 }else{
  this.poly([[-29,2],[4,-62],[30,2]],'#76b9c0',INK,2.7);
  c.save();c.beginPath();c.moveTo(-29,2);c.lineTo(4,-62);c.lineTo(30,2);c.clip();
  for(let i=0;i<4;i++)this.line(-30,-8-i*14,30,-28-i*14,i%2?'#e3bd72':'#e68c74',8);c.restore();this.circle(4,-64,6,'#f4d17d',INK,2);this.rect(-28,0,57,7,3,'#f2e5c3',INK,2);
 }c.restore();
};
// Ink thickness and warm contact shadow distinguish the moving actors from the set.
BuddyRenderer.prototype.shadows=function(nodes){
 const c=this.ctx;
 for(const n of nodes){if(!n[6]&&![0,1,2,5,8,10,12].includes(n[0]))continue;
  const gap=Math.max(0,BB.FLOOR-n[2]-n[5]),near=Math.exp(-gap/160);
  c.beginPath();c.ellipse(n[1]+gap*.055,BB.FLOOR+3,n[5]*(1.03+gap/800),3+n[5]*.17,0,0,Math.PI*2);c.fillStyle=`rgba(26,49,59,${.025+.19*near})`;c.fill();
 }
};
const baseGlove=BuddyRenderer.prototype.gloveShape;
BuddyRenderer.prototype.gloveShape=function(x,y,color,down,scale=1){
 baseGlove.call(this,x,y,color,down,scale);const c=this.ctx;
 c.save();c.translate(x,y);c.rotate(-.2);c.scale(scale,scale);
 this.line(-1,40,23,40,'#182f4266',2);const slot=Math.max(0,PALETTE.indexOf(color));
 for(let i=0;i<=slot;i++)this.circle(4+i*5,37,1.15,'#fff5d5');
 c.restore();
};
BuddyRenderer.prototype.drawContraptions=function(s,hands,by,t){
 const c=this.ctx,end=(id,x,y)=>{const n=by.get(id);return n?{x:n[1],y:n[2]}:{x,y};};
 for(const r of s.ropes||[]){const a=end(r[1],r[3],r[4]),b=end(r[2],r[5],r[6]);
  const d=Math.hypot(a.x-b.x,a.y-b.y),sag=Math.min(110,Math.max(0,r[7]-d)*.65),mx=(a.x+b.x)/2,my=(a.y+b.y)/2+sag;
  c.beginPath();c.moveTo(a.x,a.y);c.quadraticCurveTo(mx,my,b.x,b.y);c.strokeStyle=INK;c.lineWidth=5;c.stroke();c.strokeStyle='#e5c58d';c.lineWidth=2.7;c.stroke();c.setLineDash([3,6]);c.strokeStyle='#a67d51';c.lineWidth=1;c.stroke();c.setLineDash([]);
  for(const [id,p] of [[r[1],a],[r[2],b]]){this.circle(p.x,p.y,id<0?9:5,id<0?'#72939c':'#efddb0',INK,2);if(id<0)this.line(p.x-4,p.y,p.x+4,p.y,'#dce4d4',2);}
 }
 for(const h of hands){if(h[7]!=='tether'){this.tetherPreviews.delete(h[0]);continue;}const p=this.tetherPreviews.get(h[0]);if(!p)continue;
  if(performance.now()-p.time>15000){this.tetherPreviews.delete(h[0]);continue;}
  const a=end(p.id,p.x,p.y);c.save();c.setLineDash([5,7]);this.line(a.x,a.y,h[3],h[4],h[2],2);c.restore();this.circle(a.x,a.y,8,null,h[2],2);
 }
 for(const b of s.bumpers||[])this.drawBumper(b,t);
};
BuddyRenderer.prototype.drawBumper=function(b,t,ghost=false){
 const c=this.ctx,[id,x,y,kick]=b;const pulse=kick>0?Math.sin((1-kick)*15)*kick*.15:0;
 c.save();c.translate(x,y);if(ghost)c.globalAlpha=.5;
 c.beginPath();c.ellipse(3,7,34,29,0,0,Math.PI*2);c.fillStyle='#34526040';c.fill();
 this.circle(0,3,32,'#597581',INK,3);this.circle(0,0,28*(1+pulse),'#e58565',INK,3);this.circle(0,-2,21*(1+pulse),'#f3cc79',INK,2);
 this.circle(0,-2,14,'#f9eab6','#c39148',1.5);this.star(0,-2,10,'#e77855',Math.sin(t)*.03);
 c.beginPath();c.arc(0,-2,24,3.7,5);c.strokeStyle='#ffddad';c.lineWidth=3;c.stroke();
 for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;this.circle(Math.cos(a)*29,Math.sin(a)*29,2,'#d8e4d5');}c.restore();
};
const previousPolish=BuddyRenderer.prototype.polishEvent;
BuddyRenderer.prototype.polishEvent=function(e){
 previousPolish.call(this,e);
 if(e.type==='tetherStart'){this.tetherPreviews.set(e.who,{...e,time:performance.now()});if(this.tetherPreviews.size>4)this.tetherPreviews.delete(this.tetherPreviews.keys().next().value);}
 if(e.type==='tetherEnd'||e.type==='tether')this.tetherPreviews.delete(e.who);
 if(e.type==='untie'||e.type==='clear')this.tetherPreviews.clear();
 if(e.type==='bumperHit'){this.rings.push({x:e.x,y:e.y,r:22,life:.24,max:.24,color:'#f5d685'});for(let i=0;i<5;i++)this.particle(e.x,e.y,'#f3ce80',120,.22,'chip');}
 if(e.type==='tether'||e.type==='ropeCut')for(let i=0;i<6;i++)this.particle(e.x,e.y,'#e3c68c',100,.25,'chip');
 if(e.type==='scatter'){this.shells.push({x:e.x-7,y:e.y+9,vx:-100,vy:-160,a:0,life:.65});if(this.shells.length>16)this.shells.shift();}
};
const earlierCursor=BuddyRenderer.prototype.toolCursor;
BuddyRenderer.prototype.toolCursor=function(h,t,nowTime){
 const c=this.ctx,[id,name,color,x,y,down,g,tool,at]=h;
 if(tool==='bumper'){this.drawBumper([-1,x,y,0],t,true);this.gloveShape(x+20,y+22,color,true,.58);return;}
 if(tool==='tether'){
  this.circle(x,y,7,null,color,2);c.save();c.translate(x-33,y+24);c.rotate(-.5);
  this.rect(-20,-11,39,23,5,'#dba565',INK,2.5);this.circle(-2,-10,14,'#f0d49b',INK,2.6);this.circle(-2,-10,7,'#718e99',INK,2);
  this.rect(17,-5,17,10,2,'#b9d5ce',INK,2);this.line(23,0,38,0,'#f0d8a3',2);this.gloveShape(-14,15,color,true,.55);c.restore();return;
 }
 if(tool==='shotgun'){
  const age=nowTime-at,ox=clamp(x-96,BB.LEFT+20,BB.RIGHT-20),oy=clamp(y+48,BB.TOP+20,BB.FLOOR-18),a=Math.atan2(y-oy,x-ox);
  this.circle(x,y,16,null,color,1.5);for(let i=0;i<3;i++)this.circle(x+(i-1)*7,y,1.2,color);
  c.save();c.translate(ox,oy);c.rotate(a);const recoil=age>=0&&age<.18?Math.sin(Math.min(1,age/.045)*Math.PI/2)*(1-age/.18)*10:0;c.translate(-recoil,0);
  this.poly([[-43,-3],[-15,-8],[-7,8],[-44,19]],'#b27e50',INK,3);this.line(-36,3,-19,0,'#e0b782',2.4);
  this.rect(-15,-11,52,9,2,'#758c93',INK,2.8);this.rect(-15,-1,52,9,2,'#4c6776',INK,2);this.line(-11,-8,31,-8,'#bfcfce',1.8);
  const pump=age>.17&&age<.50?Math.sin((age-.17)/.33*Math.PI)*13:0;
  this.rect(6-pump,-4,17,15,3,'#d2985b',INK,2);for(let i=0;i<3;i++)this.line(10-pump+i*4,-1,10-pump+i*4,8,'#895a38',1.2);
  this.gloveShape(-16,15,color,true,.53);this.gloveShape(5-pump,13,color,true,.36);c.restore();return;
 }
 earlierCursor.call(this,h,t,nowTime);
};
const oldEffects=BuddyRenderer.prototype.effects;
BuddyRenderer.prototype.effects=function(dt,t){
 oldEffects.call(this,dt,t);const c=this.ctx;
 for(const shell of this.shells){shell.life-=dt;shell.vy+=620*dt;shell.x+=shell.vx*dt;shell.y+=shell.vy*dt;shell.a+=dt*12;c.save();c.translate(shell.x,shell.y);c.rotate(shell.a);c.globalAlpha=clamp(shell.life*4,0,1);this.rect(-5,-2,10,4,1,'#d47850',INK,1);this.rect(2,-2,3,4,0,'#efd284');c.restore();}
 this.shells=this.shells.filter(s=>s.life>0);
};

/* Application / authority boundary. No guest ever steps BuddyWorld.
   An invite pins the room host by its per-tab ID. No authority election or migration. */
const $=id=>document.getElementById(id);
// Optional harness config lets offline browser runners load the exact HTML with set_content.
const query=new URLSearchParams(window.__BB_TEST_QUERY??location.search),hash=new URLSearchParams(window.__BB_TEST_HASH??location.hash.slice(1));
const newRoom=()=>Array.from(crypto.getRandomValues(new Uint8Array(4)),x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
const uid=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(12)),x=>x.toString(16).padStart(2,'0')).join('');
const readStore=(k,fallback)=>{try{return localStorage.getItem(k)||fallback;}catch{return fallback;}};
const saveStore=(k,v)=>{try{localStorage.setItem(k,v);}catch{}};
let roomCode=(hash.get('room')||newRoom()).replace(/[^A-Za-z0-9-]/g,'').slice(0,32)||newRoom();
const myId=uid();let hostId=(hash.get('host')||myId).replace(/[^A-Za-z0-9-]/g,'').slice(0,80)||myId;
let isHost=hostId===myId;
const local={id:myId,name:readStore('buddybay-name',isHost?'Captain Grab':'Helping Hand'),color:isHost?PALETTE[0]:PALETTE[1],x:447,y:399,down:false,tool:'grab',grip:null,seq:0};
const renderer=new BuddyRenderer($('game'));
let bloodLevel=Number(readStore('buddybay-blood','1'));if(![0,1,2].includes(bloodLevel))bloodLevel=1;renderer.blood.setLevel(bloodLevel);
renderer.motion=readStore('buddybay-motion',matchMedia('(prefers-reduced-motion: reduce)').matches?'off':'on')==='on';
let toolDeck='classic',pendingEquip='',shopKey='',saveKey='',lastSave=0,rateAt=performance.now(),rateTx=0,rateRx=0;
let pendingEvents=[],timedMalletEvents=[],lastEventFlush=0;const perfSamples={render:[],physics:[]};
let net=null,world=null,latest=null,renderState=null,buffer=[],welcomed=isHost,hostGone=false,remotePaused=false,paused=false;
let lastSnapshot=0,lastInput=0,lastFrame=performance.now(),simAccum=0,eventSeq=0,lastEvent=0,receivedSnapshots=0,lastAuthorityTick=-1,authoritativeGen=-1;
let snapshotSequence=0,lastSnapshotSequence=-1;
let rtt=0,lastPing=0,toastTimer=0,rosterKey='',lastScore=-1,lastBounceEvent=0,interacted=false,debugVisible=false,activePointer=null;
let selectedTool='grab',temporaryGrab=false;
let soundOn=readStore('buddybay-sound','on')==='on',audio=null,lastSound=0,lastVoice=0,noiseBuffer=null;
const stats={txRate:0,rxRate:0,eventBatches:0,steps:0,frames:0,invalidPackets:0,commands:0,hostInputs:0,assertErrors:[],snapBytes:0,events:{},started:performance.now(),rejectedSnapshots:0};
const sentChatTimes=new Map();
function toast(text){$('toast').textContent=String(text);$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2800);}
function audioInit(){try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function beep(freq,duration,volume=.06,delay=0,end=null){if(!soundOn)return;audioInit();if(!audio)return;const t=audio.currentTime+delay,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+duration+.02);}
function noise(duration,volume=.1,cutoff=1000){
 if(!soundOn)return;audioInit();if(!audio)return;
 if(!noiseBuffer){noiseBuffer=audio.createBuffer(1,audio.sampleRate,audio.sampleRate);const data=noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;}const buf=noiseBuffer;
 const src=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();src.buffer=buf;filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);src.connect(filter);filter.connect(gain);gain.connect(audio.destination);src.start(0,Math.random()*.25,duration);src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect();};
}
function playEvent(e){
 if(e.type==='hurt'&&e.m){
  const now=performance.now();if(now-lastVoice>480){lastVoice=now;const f=210+(e.m[7]%130);beep(f,.12,.028,0,f*.55);beep(f*1.8,.085,.012,.02,f*.8);if(e.m[6]!==DAMAGE.burn)noise(.07,.055,1100);}return;
 }
 if(e.type==='scatter'){noise(.15,.16,2500);beep(125,.18,.065,0,40);beep(210,.06,.03,.21,130);return;}
 if(e.type==='shatter'){noise(.24,.12,6300);[1800,2800,3900].forEach((f,i)=>beep(f,.17,.018,i*.025,f*.6));return;}
 if(e.type==='repair'||e.type==='purchase'){[440,660,880].forEach((f,i)=>beep(f,.17,.035,i*.08));return;}
 if(e.type==='steam'){noise(.3,.055,3200);return;}
 if(e.type==='air'){noise(.23,.13,1800);beep(100,.22,.06,0,35);return;}
 if(e.type==='rail'){beep(1480,.20,.045,0,110);noise(.085,.10,5100);return;}
 if(e.type==='toy'||e.type==='squeak'){if(e.kind===4||e.type==='squeak'){beep(720,.11,.05,0,430);beep(920,.07,.025,.075,600);}else beep(110,.1,.04,0,50);return;}
 if(e.type==='dart'){beep(520,.065,.023,0,110);return;}
 if(e.type==='basket'||e.type==='challenge'){[523,659,784,1047].forEach((f,i)=>beep(f,.17,.045,i*.07));return;}
 const now=performance.now();if(now-lastSound<45)return;lastSound=now;
 if(e.type==='explosion'){beep(115,.38,.1,0,27);noise(.34,.2,900);}
 if(e.type==='swing'){noise(.08,.025,2300);}
 if(e.type==='poke'&&e.hit){beep(e.buddy?135:190,.12,.085,0,48);noise(.045,.12,e.buddy?1150:2000);}
 if(e.type==='shot'){beep(620,.06,.035,0,140);noise(.045,.07,3500);}
 if(e.type==='launch'){noise(.24,.10,2400);beep(140,.22,.025,0,410);}
 if(e.type==='zap'){beep(1750,.04,.018,0,200);noise(.035,.045,4700);}
 if(e.type==='spring'){beep(150,.30,.075,0,780);beep(620,.16,.028,.12,270);}
 if(e.type==='pop'){noise(.055,.16,2600);beep(450,.06,.03,0,95);}
 if(e.type==='bumperHit'){beep(470,.15,.06,0,920);beep(690,.12,.03,.04,350);return;}
 if(e.type==='tether'||e.type==='ropeCut'){noise(.045,.04,2100);beep(350,.09,.03,0,160);return;}
 if(e.type==='collect')beep(980+e.value*140,.07,.026,0,1450);
 if(e.type==='bounce')beep(e.ball?160:95,.09,e.s*.035,0,60);
 if(e.type==='grab')beep(460,.055,.025,0,220);
 if(e.type==='throw')beep(210,.09,.024,0,490);
 if(['spawn','bomb','balloon','place'].includes(e.type))beep(360,.1,.033,0,660);
}
function showEvent(e){
 if(e.type==='purchaseDenied'){if(e.who===myId)toast(e.text);return;}
 if(e.type==='purchase'){toast(e.text);shopKey='';}
 if(e.type==='clean')toast('ROOM WASHED');
 if(e.type==='drop'&&e.who===myId)releasePointer();
 stats.events[e.type]=(stats.events[e.type]||0)+1;renderer.event(e);playEvent(e);
 if(e.type==='gravity')toast(e.enabled?'LOW GRAVITY ON':'NORMAL GRAVITY');
 if(e.type==='limit')toast(e.text);
 if(e.type==='basket')$('score').textContent=String(e.score||0).padStart(2,'0');
}
function emit(e){
 if(e.type==='bounce'){const now=performance.now();if(now-lastBounceEvent<80)return;lastBounceEvent=now;}
 // Coordinates are not allowed to inflate JSON into 16-digit floats per target.
 const clean=JSON.parse(JSON.stringify(e,(_,v)=>typeof v==='number'?Math.round(v*10)/10:v));
 const data={...clean,eid:++eventSeq,gen:world?.gen||1};showEvent(data);
 if(net?.peers().length){pendingEvents.push(data);if(pendingEvents.length>=32)flushEvents();}
}
function flushEvents(){
 if(!pendingEvents.length)return;const batch=pendingEvents.filter(e=>e.gen===world.gen);pendingEvents=[];lastEventFlush=performance.now();
 if(batch.length){net?.broadcast('events',batch,false);stats.eventBatches++;}
}
function receiveEvent(d){
 if(d?.gen!==authoritativeGen||!Number.isInteger(d?.eid)||d.eid<=lastEvent)return;
 lastEvent=d.eid;
 if(d.type==='swing'){showEvent(d);return;}
 if((d.mallet||d.type==='swingCancel')&&Number.isInteger(d.at)){timedMalletEvents.push(d);if(timedMalletEvents.length>96)timedMalletEvents.shift();return;}
 showEvent(d);
}

world=new BuddyWorld(emit);if(query.get('test')!=='1'){try{world.loadWorkshop(JSON.parse(readStore('buddybay-workshop-v3','null')));}catch{}}world.upsertHand(myId,local.name,local.color);
world.input(myId,{x:local.x,y:local.y,s:++local.seq,down:false,tool:local.tool});
latest=world.snapshot();renderState=latest;
function writeLocation(){try{const u=new URL(location.href);u.hash=new URLSearchParams(isHost?{room:roomCode}:{room:roomCode,host:hostId}).toString();history.replaceState(null,'',u);}catch{}$('roomCode').textContent=roomCode;}
function inviteURL(){const u=new URL(location.href);u.searchParams.delete('pair');u.searchParams.delete('test');u.hash=new URLSearchParams({room:roomCode,host:hostId}).toString();return u.toString();}
writeLocation();
function admit(id){
 if(!isHost||world.hands.has(id))return true;
 if(world.hands.size>=BB.MAX_PLAYERS){net.send(id,'reject',{reason:'Four hands already! Open another playroom.'});return false;}
 const used=new Set([...world.hands.values()].map(h=>h.color));const color=PALETTE.find(c=>!used.has(c))||PALETTE[3];world.upsertHand(id,'A new hand',color);return true;
}
function authoritySnapshot(){return {...world.snapshot(paused),q:++snapshotSequence};}
function sendWelcome(id){if(!admit(id))return;net.send(id,'welcome',{host:hostId,you:id,color:world.hands.get(id).color,s:authoritySnapshot(),fx:world.stainSnapshot(),swings:world.malletSnapshot()});}
function onOpen(id,route){
 if(isHost){if(!admit(id))return;sendWelcome(id);}
 else if(id===hostId){net.send(id,'hello',{name:local.name,x:local.x,y:local.y});}
 updateUI();
}
function onClose(id){
 sentChatTimes.delete(id);
 if(isHost){const h=world.hands.get(id);if(h){toast(h.name+' DISCONNECTED');world.removeHand(id);}sendSnapshot(true);}
 else if(id===hostId){hostGone=true;welcomed=false;local.down=false;local.grip=null;toast('The host disconnected. This session has ended.');}
 updateUI();
}
function validSnapshot(s){
 const tuples=(a,max,len)=>Array.isArray(a)&&a.length<=max&&a.every(v=>Array.isArray(v)&&v.length===len&&v.every(finite));
 return !!s&&Number.isInteger(s.hat)&&s.hat>=0&&s.hat<4&&
  tuples(s.ropes,BB.MAX_TETHERS,8)&&s.ropes.every(r=>Number.isInteger(r[0])&&Number.isInteger(r[1])&&Number.isInteger(r[2])&&r[1]>=-1&&r[2]>=-1&&r[1]!==r[2]&&r[7]>=36&&r[7]<=1100&&r.slice(3,7).every(v=>v>=0&&v<=1280))&&
  tuples(s.bumpers,BB.MAX_BUMPERS,4)&&s.bumpers.every(b=>Number.isInteger(b[0])&&b[1]>=68&&b[1]<=1212&&b[2]>=98&&b[2]<=614&&b[3]>=0&&b[3]<=1)&&Number.isSafeInteger(s.bank)&&s.bank>=0&&s.bank<=1e9&&Number.isSafeInteger(s.earned)&&s.earned>=0&&s.earned<=4e9&&Number.isInteger(s.unlock)&&s.unlock>=0&&s.unlock<=ALL_TOOL_MASK&&
  Array.isArray(s.d)&&s.d.length===13&&s.d.every(n=>Number.isInteger(n)&&n>=0&&n<=16383)&&Array.isArray(s.upg)&&s.upg.length===3&&s.upg.every(n=>Number.isInteger(n)&&n>=0&&n<=3)&&
  Array.isArray(s.mood)&&s.mood.length===4&&s.mood.every(n=>finite(n)&&n>=0&&n<20)&&Number.isInteger(s.stain)&&s.stain>=0&&s.v===BB.VERSION&&Number.isInteger(s.q)&&Number.isInteger(s.t)&&Number.isInteger(s.gen)&&finite(s.time)&&finite(s.score)&&finite(s.candy)&&finite(s.combo)&&finite(s.skin)&&
  tuples(s.n,BB.MAX_NODES,8)&&s.n.length>=13&&s.n.slice(0,13).every((n,i)=>n[0]===i&&n[6]===0)&&s.n.slice(13).every(n=>n[6]>0)&&Object.entries(PROP_CAPS).every(([kind,cap])=>s.n.filter(n=>n[6]===Number(kind)).length<=cap)&&new Set(s.n.map(n=>n[0])).size===s.n.length&&s.n.every(n=>Number.isInteger(n[0])&&n[5]>0&&n[5]<100&&Number.isInteger(n[6])&&n[6]>=0&&n[6]<=5)&&
  Array.isArray(s.h)&&s.h.length<=BB.MAX_PLAYERS&&s.h.every(h=>Array.isArray(h)&&typeof h[0]==='string'&&h[0].length<=64&&typeof h[1]==='string'&&h[1].length<=20&&/^#[0-9a-f]{6}$/i.test(h[2])&&finite(h[3])&&finite(h[4])&&Object.hasOwn(TOOLS,h[7])&&finite(h[8])&&(!h[6]||(Array.isArray(h[6])&&h[6].length===3&&h[6].every(finite))))&&
  tuples(s.c,BB.MAX_CANDY,5)&&tuples(s.pads,BB.MAX_PADS,3)&&tuples(s.bonds,BB.MAX_BALLOONS,3)&&tuples(s.props,BB.MAX_NODES-13,2)&&
  Array.isArray(s.p)&&s.p.length<=BB.MAX_ROCKETS&&s.p.every(p=>Array.isArray(p)&&p.length===6&&p.slice(0,5).every(finite)&&typeof p[5]==='string')&&
  Array.isArray(s.task)&&s.task.length===3&&Number.isInteger(s.task[0])&&s.task[0]>=0&&s.task[0]<TASKS.length&&finite(s.task[1]);
}
function acceptSnapshot(s,initial=false){
 if(!validSnapshot(s)){stats.invalidPackets++;return false;}
 if(s.gen<authoritativeGen||s.q<=lastSnapshotSequence){stats.rejectedSnapshots++;return false;}
 if(s.gen!==authoritativeGen){buffer=[];timedMalletEvents=[];renderer.resetEffects();if(authoritativeGen>=0)releasePointer();}
 authoritativeGen=s.gen;lastAuthorityTick=s.t;lastSnapshotSequence=s.q;latest=s;lastSnapshot=performance.now();receivedSnapshots++;remotePaused=!!s.paused;
 const own=s.h.find(h=>h[0]===myId);if(own)local.color=own[2];
 buffer.push({at:lastSnapshot,s});if(buffer.length>12)buffer.shift();return true;
}
function onData(id,k,d){
 if(isHost){
  if(k==='hello'){
   if(!admit(id))return;const h=world.hands.get(id);h.name=String(d?.name||'Helping Hand').slice(0,20);sendWelcome(id);toast(h.name+' CONNECTED');return;
  }
  if(!world.hands.has(id))return;
  if(k==='input'){if(d?.gen!==world.gen)return;world.input(id,d);stats.hostInputs++;return;}
  if(k==='cmd'){if(d?.gen!==world.gen)return;world.command(id,d);stats.commands++;return;}
  if(k==='name'){world.hands.get(id).name=String(d?.name||'Helping Hand').slice(0,20);return;}
  if(k==='ping'){if(finite(d?.at))net.send(id,'pong',{at:d.at});return;}
  if(k==='chat'){chatFrom(id,d?.text);return;}
  if(k==='goodbye'){world.removeHand(id);sendSnapshot(true);return;}
 }else{
  if(id!==hostId){stats.invalidPackets++;return;}
  if(k==='welcome'){
   if(d?.host!==hostId||d.you!==myId)return;
   if(!validSnapshot(d.s))return;const was=welcomed;welcomed=true;hostGone=false;local.color=/^#[0-9a-f]{6}$/i.test(d.color)?d.color:PALETTE[1];if(acceptSnapshot(d.s,true)){renderer.blood.restore(d.fx);if(Array.isArray(d.swings))for(const m of d.swings.slice(0,BB.MAX_PLAYERS))renderer.rememberMallet(m);}sendInput(true);if(!was)toast('CONNECTED — GRAB SOMETHING');updateUI();return;
  }
  if(k==='snapshot'&&welcomed){acceptSnapshot(d);return;}
  if(k==='event'&&welcomed){receiveEvent(d);return;}
  if(k==='events'&&welcomed){if(Array.isArray(d)&&d.length<=32)for(const e of d)receiveEvent(e);return;}
  if(k==='pong'&&finite(d?.at)){rtt=performance.now()-d.at;return;}
  if(k==='reject'){welcomed=false;hostGone=true;toast(d?.reason||'Playroom is full.');return;}
  if(k==='end'){hostGone=true;welcomed=false;local.down=false;local.grip=null;updateUI();return;}
 }
}
function onMode({room,hostId:h}){
 roomCode=room;hostId=h;isHost=hostId===myId;welcomed=isHost;hostGone=false;buffer=[];lastAuthorityTick=-1;lastSnapshotSequence=-1;authoritativeGen=-1;local.down=false;local.grip=null;writeLocation();updateUI();
}
net=new BuddyNet({room:roomCode,hostId,id:myId,offline:query.get('local')==='1',localSignal:!query.get('pair'),onData,onOpen,onClose,onStatus:()=>updateUI(),onMode});
function sendInput(reliable=false,cancel=false){
 const d={x:round(local.x),y:round(local.y),s:++local.seq,down:local.down,tool:local.tool,g:local.grip,gen:isHost?world.gen:latest.gen,...(cancel?{cancel:true}:{})};lastInput=performance.now();
 if(isHost)world.input(myId,d);else if(welcomed&&!hostGone)net.send(hostId,'input',d,!reliable);
}
function pickRendered(x,y){
 const s=renderState;if(!s)return null;const nodes=s.n,by=new Map(nodes.map(n=>[n[0],{x:n[1],y:n[2],r:n[5]}]));
 for(let i=nodes.length-1;i>=0;i--){const n=nodes[i];if(Math.hypot(x-n[1],y-n[2])<=n[5]+10)return {a:n[0],b:n[0],t:0};}
 let best=null,bd=Infinity;for(const [a,b,r] of [...LIMBS,[0,1,17],[1,2,27],[3,6,20]]){if(!by.has(a)||!by.has(b))continue;const q=segmentPoint(x,y,by.get(a),by.get(b)),d=Math.hypot(q.x-x,q.y-y);if(d<r+10&&d<bd){bd=d;best={a,b,t:q.t};}}return best;
}
function canAct(){if(!isHost&&!welcomed){toast(hostGone?'This session ended. Start a new playroom.':'Waiting for the host. Invite links must match.');return false;}if(!isHost&&remotePaused){toast('The host tab is paused. Ask them to return.');return false;}return true;}
function markInteraction(){if(!interacted){interacted=true;$('welcome').classList.add('dim');}}
// Input is deliberately not captured by the canvas and never pointer-locked.
// System cursor is the default. An optional game cursor is scoped to a real
// hit-test in the playable world, NOT the letterbox or a UI rectangle above it.
const canvas=$('game');
let cursorMode=readStore('buddybonk-cursor','system')==='game'?'game':'system';
let pointerInside=false,pointerType='mouse',pressedMask=0,waitForRelease=false;
let pointerClient={x:-1,y:-1};
const modalOpen=()=>!!document.querySelector('dialog[open]');
function gameHit(x,y){
 if(!finite(x)||!finite(y)||document.hidden||modalOpen()||!$('chatwrap').hidden)return false;
 if(document.elementFromPoint(x,y)!==canvas)return false;
 const r=canvas.getBoundingClientRect(),wx=(x-r.left-renderer.ox)/renderer.scale,wy=(y-r.top-renderer.oy)/renderer.scale;
 return wx>=BB.LEFT&&wx<=BB.RIGHT&&wy>=BB.TOP&&wy<=BB.FLOOR;
}
function setPointerHover(inside){
 pointerInside=!!inside;renderer.localHandVisible=pointerInside;
 const custom=pointerInside&&pointerType==='mouse'&&cursorMode==='game';
 canvas.classList.toggle('game-cursor',custom);
 canvas.classList.toggle('native-grab',pointerInside&&!custom&&local.tool==='grab'&&!local.down);
 canvas.classList.toggle('native-grabbing',pointerInside&&!custom&&local.tool==='grab'&&local.down);
 canvas.classList.toggle('native-aim',pointerInside&&!custom&&local.tool!=='grab');
}
function releasePointer(e){
 if(e&&activePointer!==null&&e.pointerId!==undefined&&e.pointerId!==activePointer)return;
 const swing=renderer.mallets.get(myId),abort=!e||e.type!=='pointerup'||!gameHit(e.clientX,e.clientY);
 const pending=swing&&swing.ct===null&&swing.cancelAge===null&&renderer.timeline-swing.at/BB.HZ<MALLET.CONTACT;
 const changed=local.down||local.grip!==null||temporaryGrab||(abort&&pending);
 if(abort&&pending)swing.cancelAge=Math.max(0,renderer.timeline-swing.at/BB.HZ);
 // The release packet contains the last VALID point: UI pixels must not become
 // a final throw target clamped to the far wall or floor.
 if(e&&local.down&&gameHit(e.clientX,e.clientY))Object.assign(local,renderer.toWorld(e.clientX,e.clientY));
 const pointer=activePointer;activePointer=null;pressedMask=0;local.down=false;local.grip=null;
 if(temporaryGrab){temporaryGrab=false;local.tool=selectedTool;}
 if(pointer!==null&&canvas.hasPointerCapture(pointer)){try{canvas.releasePointerCapture(pointer);}catch{}}
 if(changed)sendInput(true,abort); // Reliable release/cancel in the existing input message.
 setPointerHover(pointerInside);
}
function suspendPointer(){
 if(local.down||activePointer!==null)waitForRelease=true;
 releasePointer();setPointerHover(false);
}
window.addEventListener('pointerdown',e=>{
 if(activePointer!==null&&activePointer!==e.pointerId)return;
 // Dismiss equipment without also shooting what was behind the drawer.
 if(!$('toolDrawer').hidden&&!$('toolDrawer').contains(e.target)&&!$('toolsBtn').contains(e.target)){
  closeTools();if(e.target===canvas){e.preventDefault();e.stopPropagation();suspendPointer();return;}
 }
 if(e.target!==canvas)suspendPointer();
},true);
canvas.addEventListener('pointerdown',e=>{
 if(e.isPrimary===false||![0,2].includes(e.button)||activePointer!==null||waitForRelease||!gameHit(e.clientX,e.clientY)||!canAct())return;
 e.preventDefault();pointerType=e.pointerType||'mouse';pointerClient={x:e.clientX,y:e.clientY};activePointer=e.pointerId;pressedMask=e.button===2?2:1;
 // Touch browsers may implicitly capture. Release that as well; global up/move
 // handles the gesture while elementFromPoint keeps UI hittable.
 if(canvas.hasPointerCapture(e.pointerId)){try{canvas.releasePointerCapture(e.pointerId);}catch{}}
 if(e.button===2){temporaryGrab=true;local.tool='grab';}
 canvas.focus({preventScroll:true});Object.assign(local,renderer.toWorld(e.clientX,e.clientY));local.down=true;local.grip=pickRendered(local.x,local.y);
 setPointerHover(true);markInteraction();sendInput(true);if(soundOn)audioInit();
});
window.addEventListener('pointermove',e=>{
 if(activePointer!==null&&e.pointerId!==activePointer)return;if(e.isPrimary===false)return;
 pointerType=e.pointerType||'mouse';pointerClient={x:e.clientX,y:e.clientY};
 if(e.buttons===0)waitForRelease=false;
 const hit=gameHit(e.clientX,e.clientY);
 if(!hit){if(local.down||activePointer!==null)waitForRelease=!!e.buttons;releasePointer();setPointerHover(false);return;}
 // Recover a missed mouse-up (e.g. released outside the browser).
 if(local.down&&pointerType!=='touch'&&(e.buttons&pressedMask)===0)releasePointer();
 Object.assign(local,renderer.toWorld(e.clientX,e.clientY));setPointerHover(true);
 if(isHost||performance.now()-lastInput>=1000/60)sendInput(false);
},{passive:true});
window.addEventListener('pointerup',e=>{
 if(activePointer!==null&&e.pointerId!==activePointer)return;
 releasePointer(e);waitForRelease=!!e.buttons;
 setPointerHover(e.pointerType!=='touch'&&gameHit(e.clientX,e.clientY));
},true);
window.addEventListener('pointercancel',e=>{if(activePointer===null||activePointer===e.pointerId){suspendPointer();waitForRelease=false;}},true);
// OS chrome / another application is not a game input surface.
window.addEventListener('blur',suspendPointer);
window.addEventListener('pagehide',suspendPointer);
// A successful touch-up synthesizes leave/out events because the finger no
// longer hovers. Hide its hand, but do not revoke that already-committed tap.
// Real drags leaving the game (including touch) still cancel immediately.
function leavePlaySurface(e){
 if(e.pointerType==='touch'&&activePointer===null&&!local.down){setPointerHover(false);return;}
 suspendPointer();
}
window.addEventListener('pointerout',e=>{if(e.relatedTarget===null)leavePlaySurface(e);});
canvas.addEventListener('pointerleave',leavePlaySurface);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('dragstart',e=>e.preventDefault());
document.addEventListener('focusin',e=>{if(e.target!==canvas)suspendPointer();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)suspendPointer();paused=isHost&&document.hidden;if(isHost)sendSnapshot(true);updateUI();
});
function setTool(tool){
 if(!Object.hasOwn(TOOLS,tool))return;
 renderer.tetherPreviews.delete(myId);
 const current=isHost?world.snapshot():latest;if(!current.free&&!(current.unlock&(1<<TOOL_IDS.indexOf(tool)))){pendingEquip=tool;openShop();return;}
 setDeck(TOOLS[tool].deck||(TOOLS[tool].cost?'heavy':'classic'));releasePointer();selectedTool=tool;local.tool=tool;
 document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('selected',b.dataset.tool===tool);b.setAttribute('aria-pressed',b.dataset.tool===tool?'true':'false');});
 $('toolTitle').textContent=toolName(tool);$('selectedIcon').innerHTML=toolSVG(tool);$('toolHint').textContent=toolHelp(tool);$('toolsBtn').setAttribute('aria-label','Choose a tool. Current: '+toolName(tool));closeTools();sendInput(true);setPointerHover(false);
}
function command(c){if(!canAct())return;markInteraction();if(isHost){world.command(myId,{c});stats.commands++;}else{sendInput(true);net.send(hostId,'cmd',{c,gen:latest.gen});}}
for(const button of document.querySelectorAll('[data-tool]'))button.onclick=()=>setTool(button.dataset.tool);
$('quickRepairBtn').onclick=()=>{suspendPointer();command('heal');};
$('standBtn').onclick=()=>command('stand');$('gravityBtn').onclick=()=>command('gravity');
$('healBtn').onclick=()=>command('heal');$('cleanBtn').onclick=()=>command('clean');
$('skinBtn').onclick=()=>command('skin');$('hatBtn').onclick=()=>command('hat');$('untieBtn').onclick=()=>command('untie');$('clearBtn').onclick=()=>command('clear');$('challengeBtn').onclick=()=>command('challenge');
$('resetBtn').onclick=()=>{if(!isHost){toast('Only the host can reset the room.');return;}releasePointer();world.reset();renderer.resetEffects();world.input(myId,{x:local.x,y:local.y,s:++local.seq,down:false,tool:local.tool});sendSnapshot(true);toast('ROOM RESET');};
// This release changes presentation, not the protocol or existing save keys.
$('creditsLogo').src=$('brandLogo').src;
const logoFallback=()=>{$('brandLogo').hidden=true;$('brand').querySelector('.brand-fallback').hidden=false;};
$('brandLogo').addEventListener('error',logoFallback);
if($('brandLogo').complete&&!$('brandLogo').naturalWidth)logoFallback();
function showDialog(id){
 suspendPointer();closeTools();closeChat();for(const d of document.querySelectorAll('dialog[open]'))if(d.id!==id)d.close();
 if(!$(id).open)$(id).showModal();
}
function openCredits(){showDialog('creditsDialog');}
$('brand').onclick=openCredits;$('creditsBtn').onclick=openCredits;$('roomCreditsBtn').onclick=openCredits;
$('closeCredits').onclick=()=>$('creditsDialog').close();$('backToGame').onclick=()=>$('creditsDialog').close();
$('settingsBtn').onclick=()=>showDialog('menuDialog');$('closeMenu').onclick=()=>$('menuDialog').close();
for(const d of document.querySelectorAll('dialog')){
 d.addEventListener('close',()=>{if(!modalOpen()&&$('chatwrap').hidden&&$('toolDrawer').hidden)canvas.focus({preventScroll:true});const hit=pointerType!=='touch'&&gameHit(pointerClient.x,pointerClient.y);if(hit)Object.assign(local,renderer.toWorld(pointerClient.x,pointerClient.y));setPointerHover(hit);});
 d.addEventListener('cancel',()=>suspendPointer());
 // A real outside click closes a sheet; clicking its own padding does not.
 d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
}
// Links open separately so visiting the creator never navigates the host away.
for(const a of document.querySelectorAll('a[target="_blank"]'))a.addEventListener('click',()=>releasePointer());
function setDeck(deck){
 toolDeck=['heavy','lab'].includes(deck)?deck:'classic';$('toolrack').dataset.deck=toolDeck;
 document.querySelectorAll('[data-deck]').forEach(b=>{if(b.tagName==='BUTTON'){b.classList.toggle('active',b.dataset.deck===toolDeck);b.setAttribute('aria-pressed',b.dataset.deck===toolDeck?'true':'false');}});
 for(const b of document.querySelectorAll('[data-tool]'))b.hidden=(TOOLS[b.dataset.tool].deck||(TOOLS[b.dataset.tool].cost?'heavy':'classic'))!==toolDeck;
}
for(const b of document.querySelectorAll('button[data-deck]'))b.onclick=()=>setDeck(b.dataset.deck);
function openShop(){suspendPointer();updateWorkshop(isHost?world.snapshot():latest,true);showDialog('shopDialog');}
$('shopBtn').onclick=openShop;$('closeShop').onclick=()=>$('shopDialog').close();
$('shopDialog').addEventListener('close',()=>{pendingEquip='';});
for(const [id,tool] of Object.entries(TOOLS))if(tool.cost){
 const el=document.createElement('div');el.className='stock';el.id='stock-'+id;
 el.innerHTML='<i>'+tool.key.toUpperCase()+'</i>'+toolSVG(id)+'<b>'+toolName(id)+'</b><button data-buy="'+id+'">$'+tool.cost+'</button>';
 el.querySelector('button').onclick=()=>{const s=isHost?world.snapshot():latest;if(s.free||(s.unlock&(1<<TOOL_IDS.indexOf(id)))){$('shopDialog').close();setTool(id);}else{pendingEquip=id;command('buy:'+id);}};
 $('shopTools').append(el);
}
UPGRADES.forEach((def,i)=>{
 const el=document.createElement('div');el.className='upgrade';el.innerHTML='<b>'+def.name+'</b><p>'+def.info+'</p><div class="pips"><i></i><i></i><i></i></div><button data-upgrade="'+def.id+'">$'+def.prices[0]+'</button>';
 el.querySelector('button').onclick=()=>command('buy:'+def.id);$('upgradeRack').append(el);
});
$('modeBtn').onclick=()=>{if(!isHost){toast('Only the host chooses workshop or sandbox mode.');return;}releasePointer();world.sandbox=!world.sandbox;if(!world.canUse(selectedTool))setTool('grab');shopKey='';sendSnapshot(true);updateWorkshop(world.snapshot(),true);toast(world.sandbox?'SANDBOX: EVERY TOOL IS OPEN':'WORKSHOP: EARN YOUR UNLOCKS');};
function updateWorkshop(s,force=false){
 if(!s)return;const key=[s.bank,s.earned,s.unlock,s.free,...s.upg].join('/');if(key===shopKey&&!force)return;shopKey=key;
 $('shopCash').textContent='$'+s.bank.toLocaleString();$('shopEarned').textContent='TOTAL EARNED $'+s.earned.toLocaleString();
 $('floorhint').textContent=s.free?'SANDBOX · ALL TOOLS OPEN':'HIT → CASH → NEW TOYS';$('budgetHint').textContent=s.free?'SANDBOX':'SHARED BUDGET';
 $('modeBtn').textContent=s.free?'Sandbox: all open':'Earn unlocks';$('modeBtn').classList.toggle('free',s.free);$('modeBtn').disabled=!isHost;
 for(const [id,tool] of Object.entries(TOOLS)){
  const own=s.free||!!(s.unlock&(1<<TOOL_IDS.indexOf(id))),b=$(id+'Btn');b.classList.toggle('locked',!own);b.classList.toggle('owned',own);
  if(!tool.cost)continue;const stock=$('stock-'+id),buy=stock.querySelector('button');stock.classList.toggle('owned',own);buy.textContent=own?'EQUIP':'BUY $'+tool.cost;buy.disabled=!own&&s.bank<tool.cost;
 }
 document.querySelectorAll('[data-upgrade]').forEach((b,i)=>{const level=s.upg[i];b.textContent=level>=3?'MAXED':'UPGRADE $'+UPGRADES[i].prices[level];b.disabled=level>=3||s.bank<UPGRADES[i].prices[level];b.parentElement.querySelectorAll('.pips i').forEach((p,j)=>p.classList.toggle('on',j<level));});
 if(pendingEquip&&(s.free||(s.unlock&(1<<TOOL_IDS.indexOf(pendingEquip))))){const tool=pendingEquip;pendingEquip='';$('shopDialog').close();setTool(tool);}
 // Switching out of sandbox must not leave a guest visually firing a locked gun.
 if(!s.free&&!(s.unlock&(1<<TOOL_IDS.indexOf(selectedTool)))&&!pendingEquip)setTool('grab');
}
// Export actual game pixels. Crop the renderer's letterbox instead of stretching
// a portrait canvas into a landscape postcard. No screenshot is sent to peers.
function savePostcard(){
 suspendPointer();
 const shot=document.createElement('canvas'),c=shot.getContext('2d');shot.width=1280;shot.height=800;
 const sx=renderer.ox*renderer.dpr,sy=renderer.oy*renderer.dpr,sw=1280*renderer.scale*renderer.dpr,sh=720*renderer.scale*renderer.dpr;
 c.drawImage(canvas,sx,sy,sw,sh,0,0,1280,720);
 c.fillStyle='#203841';c.fillRect(0,720,1280,80);
 const logo=$('brandLogo');if(logo.complete&&logo.naturalWidth)c.drawImage(logo,26,736,212,52);
 else{c.fillStyle='#f8cf69';c.font='900 28px Arial';c.fillText('BUDDY BONK',25,770);}
 c.fillStyle='#f3e7ca';c.font='700 22px Arial';c.fillText('Good friends. Terrible ideas.',272,766);
 c.textAlign='right';c.font='700 22px Arial';c.fillStyle='#f7ce75';c.fillText('tront.xyz/buddy',1252,754);
 c.font='16px Arial';c.fillStyle='#c4d3cf';c.fillText('by Trent Sterling (Tront)',1252,780);
 shot.toBlob(blob=>{
  if(!blob){toast('Image export failed. Please try again.');return;}
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.download='buddy-bonk-postcard.png';a.href=url;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  toast('Postcard exported.');
 },'image/png');
}
$('postcardBtn').onclick=savePostcard;

function refreshBlood(){renderer.blood.setLevel(bloodLevel);$('bloodBtn').textContent='Blood: '+['off','classic','extra'][bloodLevel];$('bloodBtn').classList.toggle('off',bloodLevel===0);$('bloodBtn').setAttribute('aria-label','Blood effects: '+['Off','Classic','Extra'][bloodLevel]);}
$('bloodBtn').onclick=()=>{bloodLevel=(bloodLevel+1)%3;saveStore('buddybay-blood',String(bloodLevel));refreshBlood();};refreshBlood();
function refreshMotion(){$('motionBtn').textContent='Shake: '+(renderer.motion?'on':'off');}
$('motionBtn').onclick=()=>{renderer.motion=!renderer.motion;saveStore('buddybay-motion',renderer.motion?'on':'off');refreshMotion();};refreshMotion();

function fillRoomDialog(){$('nameInput').value=local.name;$('inviteInput').value=inviteURL();$('connectionDetail').textContent=connectionText();}
function openRoom(){suspendPointer();fillRoomDialog();showDialog('roomDialog');}
$('playersBtn').onclick=openRoom;$('menuRoomBtn').onclick=openRoom;$('closeRoom').onclick=()=>$('roomDialog').close();
async function copy(text,field){try{await navigator.clipboard.writeText(text);toast('INVITE COPIED');return true;}catch{if(field){field.focus();field.select();try{if(document.execCommand('copy')){toast('Copied.');return true;}}catch{}}toast('Copy the selected link manually.');return false;}}
$('inviteBtn').onclick=async()=>{if(location.protocol==='file:'){openRoom();toast('Upload this HTML to GitHub Pages first, then share its link.');return;}fillRoomDialog();if(!await copy(inviteURL(),$('inviteInput')))openRoom();};
$('copyLink').onclick=()=>copy(inviteURL(),$('inviteInput'));
// A deliberate two-window self-test uses direct SDP via a nonce-bound opener.
// It also works from file://: no BroadcastChannel origin assumption is required.
let testPopup=null,pairToken='',pairBusy=false;
$('testTabBtn').onclick=()=>{
 if(!isHost){toast('Only the host can open a test player.');return;}
 $('roomDialog').close();suspendPointer();
 pairBusy=false;pairToken=uid();const u=new URL(inviteURL());u.searchParams.set('local','1');u.searchParams.set('pair',pairToken);
 testPopup=window.open(u.toString(),'buddy-test-'+pairToken,'popup,width=920,height=730,left=480,top=80');
 if(!testPopup){toast('Allow popups to open a test player.');return;}toast('Opening player 2 in a separate window…');
};
window.addEventListener('message',async e=>{
 const m=e.data;if(!m||m.tag!=='buddy-pair-v2')return;
 try{
  if(isHost&&testPopup&&e.source===testPopup&&m.token===pairToken){
   if(m.kind==='ready'&&!pairBusy){pairBusy=true;const token=pairToken,target=testPopup,code=await net.offer();if(token!==pairToken||target.closed)return;target.postMessage({tag:'buddy-pair-v2',token,kind:'offer',code},'*');}
   if(m.kind==='answer'){await net.finish(m.code);pairBusy=false;toast('Connecting player 2…');}
  }else if(!isHost&&window.opener&&e.source===window.opener&&m.token===query.get('pair')&&m.kind==='offer'){
   const code=await net.answer(m.code);window.opener.postMessage({tag:'buddy-pair-v2',token:m.token,kind:'answer',code},'*');
  }
 }catch(err){pairBusy=false;toast('Test connection failed. Use the direct codes in the room menu.');console.warn('Buddy local pair:',err);}
});
if(!isHost&&query.get('pair')&&window.opener){window.opener.postMessage({tag:'buddy-pair-v2',token:query.get('pair'),kind:'ready'},'*');}


$('newRoomBtn').onclick=()=>{const u=new URL(location.href);u.searchParams.delete('pair');u.searchParams.delete('test');u.hash='room='+newRoom();window.open(u,'_blank','noopener');};
$('saveName').onclick=()=>{const name=$('nameInput').value.trim().slice(0,20)||'Helping Hand';local.name=name;saveStore('buddybay-name',name);if(isHost)world.hands.get(myId).name=name;else net.send(hostId,'name',{name});toast('NAME SAVED');};
$('retryBtn').onclick=()=>net.retryOnline();
async function signalAction(fn){$('signalStatus').textContent='Preparing WebRTC connection…';try{const result=await fn();if(typeof result==='string'){$('signalOut').value=result;$('signalStatus').textContent='Code ready. Send it to the other player.';}else $('signalStatus').textContent='Answer accepted. Connecting directly…';}catch(e){$('signalStatus').textContent=e.message;}}
$('offerBtn').onclick=()=>signalAction(()=>net.offer());$('answerBtn').onclick=()=>signalAction(()=>net.answer($('signalIn').value));$('finishBtn').onclick=()=>signalAction(()=>net.finish($('signalIn').value));$('copySignal').onclick=()=>copy($('signalOut').value,$('signalOut'));
function chatFrom(id,text){if(typeof text!=='string')return;const now=performance.now();if(now-(sentChatTimes.get(id)||0)<750)return;sentChatTimes.set(id,now);const clean=text.trim().slice(0,90);if(clean)emit({type:'chat',who:id,text:clean});}
function openChat(){suspendPointer();closeTools();for(const d of document.querySelectorAll('dialog[open]'))d.close();$('chatwrap').hidden=false;$('chatInput').focus();}
$('closeChatBtn').onclick=()=>{closeChat();canvas.focus({preventScroll:true});};
function closeChat(){$('chatwrap').hidden=true;$('chatInput').blur();}
$('chatBtn').onclick=()=>{$('chatwrap').hidden?openChat():closeChat();};
$('chatForm').onsubmit=e=>{e.preventDefault();const text=$('chatInput').value.trim();if(text&&canAct()){if(isHost)chatFrom(myId,text);else net.send(hostId,'chat',{text});}$('chatInput').value='';closeChat();};
$('soundBtn').onclick=()=>{soundOn=!soundOn;saveStore('buddybay-sound',soundOn?'on':'off');if(soundOn){audioInit();beep(523,.12);}$('soundBtn').textContent=soundOn?'Sound: on':'Sound: off';};$('soundBtn').textContent=soundOn?'Sound: on':'Sound: off';
function toggleDebug(){debugVisible=!debugVisible;$('diagnostics').hidden=!debugVisible;}
$('debugBtn').onclick=toggleDebug;
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){suspendPointer();if(local.tool==='tether'){renderer.tetherPreviews.delete(myId);command('cancelTether');}closeChat();closeTools();hideTooltip();return;}
 if(e.target.matches('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
 // Enter/Space must activate focused links and buttons rather than opening chat.
 if(['Enter',' '].includes(e.key)&&e.target.closest('a,button,summary'))return;
 if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key.toLowerCase()==='e'){e.preventDefault();toggleTools();return;}
 if(e.key.toLowerCase()==='u'){e.preventDefault();setQuiet(!uiQuiet);return;}
 if(e.key.toLowerCase()==='c'){openShop();return;}if(e.key.toLowerCase()==='h'){command('heal');return;}if(e.key.toLowerCase()==='m'){command('clean');return;}
 for(const [id,tool] of Object.entries(TOOLS))if(e.key.toLowerCase()===tool.key)setTool(id);if(e.key.toLowerCase()==='b')command('ball');if(e.key.toLowerCase()==='r')command('stand');if(e.key.toLowerCase()==='g')command('gravity');if(e.key.toLowerCase()==='d')toggleDebug();if(e.key==='Enter'){e.preventDefault();openChat();}
});
// UI is local-only. None of these preferences or hover states is serialized.
function closeTools(){
 const wasFocused=$('toolDrawer').contains(document.activeElement);
 $('toolDrawer').hidden=true;$('toolsBtn').setAttribute('aria-expanded','false');hideTooltip();if(wasFocused&&!modalOpen())canvas.focus({preventScroll:true});
}
function toggleTools(){
 if(!$('toolDrawer').hidden){closeTools();canvas.focus({preventScroll:true});return;}
 suspendPointer();closeChat();if(uiQuiet)setQuiet(false);$('toolDrawer').hidden=false;$('toolsBtn').setAttribute('aria-expanded','true');
 const selected=$('toolrack').querySelector('.selected:not([hidden])')||$('toolrack').querySelector('button:not([hidden])');selected?.focus({preventScroll:true});
}
$('toolsBtn').onclick=toggleTools;$('closeTools').onclick=()=>{closeTools();$('toolsBtn').focus({preventScroll:true});};
$('selectedIcon').innerHTML=toolSVG('grab');
let uiQuiet=false;
function setQuiet(quiet){
 uiQuiet=!!quiet;suspendPointer();closeTools();closeChat();
 document.querySelector('.gamebar').hidden=uiQuiet;$('playDock').hidden=uiQuiet;$('showUIBtn').hidden=!uiQuiet;
}
$('hideUIBtn').onclick=()=>setQuiet(true);$('showUIBtn').onclick=()=>setQuiet(false);
function refreshCursorPreference(){$('cursorBtn').textContent='Cursor: '+(cursorMode==='game'?'game hand':'system');$('cursorBtn').title=cursorMode==='game'?'Hidden only over the playable room. All menus use your normal mouse.':'Your native cursor stays visible, including during play.';}
$('cursorBtn').onclick=()=>{suspendPointer();cursorMode=cursorMode==='system'?'game':'system';saveStore('buddybonk-cursor',cursorMode);refreshCursorPreference();};refreshCursorPreference();
let uiFactor=Number(readStore('buddybonk-ui-scale','1'));if(![1,1.25,1.5].includes(uiFactor))uiFactor=1;
function applyUIScale(){document.documentElement.style.fontSize=(clamp(12+innerWidth*.0045,16,26)*uiFactor)+'px';document.documentElement.dataset.uiScale=String(uiFactor);$('uiScale').value=String(uiFactor);suspendPointer();}
$('uiScale').onchange=()=>{uiFactor=Number($('uiScale').value)||1;saveStore('buddybonk-ui-scale',String(uiFactor));applyUIScale();};
window.addEventListener('resize',()=>{applyUIScale();hideTooltip();});applyUIScale();
function hideTooltip(){$('toolTooltip').hidden=true;$('toolHint').textContent=toolHelp(selectedTool);}
function showToolTip(button){
 if(!button||button.hidden||$('toolDrawer').hidden)return;
 // Context belongs in the drawer's one hint line, not a second floating panel.
 $('toolHint').textContent=toolHelp(button.dataset.tool);
}
for(const b of document.querySelectorAll('[data-tool]')){
 b.addEventListener('pointerenter',()=>showToolTip(b));b.addEventListener('pointerleave',hideTooltip);b.addEventListener('focus',()=>showToolTip(b));b.addEventListener('blur',hideTooltip);
}
$('toolDrawer').addEventListener('scroll',hideTooltip);
function connectionText(){
 const s=net?.stats();if(!s)return 'Starting…';const paths=s.routes.map(r=>r.route);return `${isHost?'You are the physics host.':'You are a guest; the host owns physics.'} ${paths.length?paths.join(', ')+'. ':''}${s.public}.`;
}
function updateUI(){
 if(!net)return;const s=isHost?world.snapshot(paused):latest;const count=isHost?world.hands.size:(welcomed?s.h.length:1);
 $('headcount').innerHTML=count+'<span>/4</span>';$('roleLabel').textContent=isHost?'HOST':welcomed?'GUEST':hostGone?'ENDED':'JOINING';
 $('netLabel').textContent=isHost?(count>1?'CONNECTED':'SOLO'):welcomed?(net.route(hostId)||'WebRTC')+(rtt?' · '+Math.round(rtt)+' ms':''):hostGone?'Host left':'Connecting…';
 $('led').className='led '+(welcomed?'on':hostGone?'error':'');
 $('connectionDetail').textContent=connectionText();$('resetBtn').disabled=!isHost;
 const nscore=s?.score||0;if(lastScore!==nscore){lastScore=nscore;$('score').textContent=String(nscore).padStart(2,'0');}
 updateWorkshop(s);
 $('cashCount').textContent='$'+(s?.bank||0).toLocaleString();$('candyCount').textContent=String(s?.candy||0).padStart(3,'0');
 $('comboLabel').textContent=s?.combo>1?s.combo+' HIT':'';
 $('comboFill').style.width=clamp((s?.comboLeft||0)/2.3*100,0,100)+'%';
 const task=s?.task||[0,0,false],def=TASKS[task[0]]||TASKS[0];
 $('taskLabel').textContent=task[2]?'STUNT COMPLETE':def.title;
 $('taskValue').textContent=task[2]?'✓':(task[0]===0?task[1].toFixed(1):Math.floor(task[1]))+' / '+def.goal+def.unit;
 $('taskFill').style.width=clamp(task[1]/def.goal*100,0,100)+'%';$('challengeBtn').classList.toggle('complete',!!task[2]);
 if($('hatBtn'))$('hatBtn').textContent='Hat: '+['none','hard hat','crown','party'][s?.hat||0];
 if($('poolStats'))$('poolStats').textContent=`Toys ${Math.max(0,(s?.n.length||13)-13)}/${BB.MAX_NODES-13} · Candy ${s?.c.length||0}/${BB.MAX_CANDY} · Rockets ${s?.p.length||0}/${BB.MAX_ROCKETS} · Springs ${s?.pads.length||0}/${BB.MAX_PADS}`;
 $('gravityBtn').classList.toggle('active',!!s?.low);
 let notice='';if(hostGone)notice='The host disconnected. This session ended. Open room settings to start a new playroom.';else if(!isHost&&!welcomed)notice='Waiting for your host. They need this playroom open. Open the ☰ room menu for connection tools.';else if(remotePaused)notice='The host tab is paused. Ask them to bring Buddy Bonk back into view.';else if(!isHost&&performance.now()-lastSnapshot>2300)notice='Waiting for the host’s next snapshot…';
 $('pauseNotice').hidden=!notice;$('pauseNotice').textContent=notice;
 const players=isHost?world.snapshot().h:welcomed?s.h:[[myId,local.name,local.color,0,0,false,null,'grab']];
 const key=players.map(h=>h[0]+h[1]+h[2]).join('|');if(key!==rosterKey){rosterKey=key;$('roster').replaceChildren();for(const h of players){const el=document.createElement('div');el.className='person';el.style.setProperty('--color',h[2]);const dot=document.createElement('i');el.append(dot,document.createTextNode(h[1]));const small=document.createElement('small');small.textContent=h[0]===hostId?'HOST':h[0]===myId?'YOU':'FRIEND';el.append(small);$('roster').append(el);}}
 if(debugVisible){const ns=net.stats();$('diagnostics').textContent=[`BUDDY BONK / ${isHost?'AUTHORITY':'GUEST'}`,`render     ${Math.round(renderer.fps)} fps`,`simulation ${isHost?'120 Hz · local':'host snapshots only'}`,`snapshots  ${receivedSnapshots} received`,`players    ${count} / 4`,`bodies     ${s?.n.length||0} / ${BB.MAX_NODES}`,`candy      ${s?.c.length||0} / ${BB.MAX_CANDY}`,`rockets    ${s?.p.length||0} / ${BB.MAX_ROCKETS}`,`springs    ${s?.pads.length||0} / ${BB.MAX_PADS}`,`snapshotHz ${(stats.snapshotHz||30).toFixed(1)} target`, `grabs      ${s?.h.filter(h=>h[6]).length||0}`,`ping       ${Math.round(rtt)} ms`,`received   ${(ns.rx/1024).toFixed(1)} KiB`,`sent       ${(ns.tx/1024).toFixed(1)} KiB`,`wire/peer  ${(stats.txRate/Math.max(1,net.peers().length)/1024).toFixed(1)} KiB/s out`,`receive    ${(stats.rxRate/1024).toFixed(1)} KiB/s in`,`snapshot   ${stats.snapBytes} B · binary`,`local FX   ${renderer.particles.length+renderer.blood.drops.length} particles`,`stain cues ${renderer.blood.marks.length} / 96`,`skipped    ${ns.dropped} queued updates`,...ns.routes.map(r=>r.route),`${ns.public}`].join('\n');}
}
let lastStateSend=-Infinity,nextStateSend=0;
function sendSnapshot(force=false){
 if(!isHost)return;const now=performance.now();if(!force&&now<nextStateSend)return;
 latest=authoritySnapshot();
 if(net.peers().length){
  stats.snapBytes=SnapshotCodec.encode(latest).byteLength;
  const period=Math.max(1000/BB.SNAP_HZ,stats.snapBytes/BB.SNAPSHOT_BPS*1000);stats.snapshotHz=1000/period;
  net.broadcast('snapshot',latest,!force);lastStateSend=now;nextStateSend=force?now+period:Math.max(now+period-8,nextStateSend+period);
 }
}

function interpolate(now){
 if(!buffer.length)return latest;const target=now-Math.max(65,buffer.length>2?Math.min(125,(buffer[buffer.length-1].at-buffer[buffer.length-3].at)/2+22):65);let a=buffer[0],b=buffer[buffer.length-1];
 for(let i=0;i<buffer.length-1;i++){if(buffer[i].at<=target&&buffer[i+1].at>=target){a=buffer[i];b=buffer[i+1];break;}if(buffer[i].at<=target)a=buffer[i];}
 if(target>=b.at){
  const extra=clamp((target-b.at)/1000,0,.045);if(b.s.paused)return b.s;
  return {...b.s,t:b.s.t+extra*BB.HZ,n:b.s.n.map(n=>{const out=n.slice();out[1]=clamp(n[1]+n[3]*extra,BB.LEFT+n[5],BB.RIGHT-n[5]);out[2]=clamp(n[2]+n[4]*extra,BB.TOP+n[5],BB.FLOOR-n[5]);return out;})};
 }
 const t=clamp((target-a.at)/(b.at-a.at||1),0,1),oldN=new Map(a.s.n.map(n=>[n[0],n])),oldH=new Map(a.s.h.map(h=>[h[0],h]));
 const interpPool=(current,old)=>{const prev=new Map(old.map(n=>[n[0],n]));return current.map(n=>{const p=prev.get(n[0]);if(!p)return n;const out=n.slice();out[1]=lerp(p[1],n[1],t);out[2]=lerp(p[2],n[2],t);return out;});};
 // Discrete injury/status must come from the PAST sample. Using b.s here made
 // guests grow bruises/dizzy stars a snapshot BEFORE the mallet reached contact.
 return {...b.s,d:a.s.d,mood:a.s.mood,impact:a.s.impact,shock:a.s.shock,t:lerp(a.s.t,b.s.t,t),c:interpPool(b.s.c,a.s.c),p:interpPool(b.s.p,a.s.p),n:b.s.n.map(n=>{const p=oldN.get(n[0]);if(!p)return n;const v=n.slice();v[1]=lerp(p[1],n[1],t);v[2]=lerp(p[2],n[2],t);v[7]=p[7]+Math.atan2(Math.sin(n[7]-p[7]),Math.cos(n[7]-p[7]))*t;return v;}),h:b.s.h.map(h=>{const p=oldH.get(h[0]);if(!p)return h;const v=h.slice();v[3]=lerp(p[3],h[3],t);v[4]=lerp(p[4],h[4],t);return v;})};
}
let simLast=performance.now();
const simTimer=setInterval(()=>{
 const now=performance.now(),dt=Math.min((now-simLast)/1000,.08);simLast=now;const simStart=now;
 if(isHost&&!paused){simAccum+=dt;let steps=0;while(simAccum>=1/BB.HZ&&steps<10){world.step(1/BB.HZ);simAccum-=1/BB.HZ;stats.steps++;steps++;}}else simAccum=0;
 if(isHost){perfSamples.physics.push(performance.now()-simStart);if(perfSamples.physics.length>300)perfSamples.physics.shift();if(now-lastEventFlush>32)flushEvents();}
 if(now-lastInput>80)sendInput(false);
},8);
const snapshotTimer=setInterval(()=>sendSnapshot(),8);
const uiTimer=setInterval(()=>{
 const now=performance.now();
 // Abrupt tab/process death need not fire unload or immediately close ICE.
 // Explicit application leases prevent stale hands and forever-waiting guests.
 if(isHost){for(const [id,h] of [...world.hands])if(id!==myId&&now-h.seen>4200){world.removeHand(id);net.drop(id);toast(h.name+' DISCONNECTED');sendSnapshot(true);}}
 else if(welcomed&&now-lastSnapshot>6500){hostGone=true;welcomed=false;local.down=false;local.grip=null;net.drop(hostId);}
 const ns=net.stats(),elapsed=Math.max(.01,(now-rateAt)/1000);stats.txRate=lerp(stats.txRate,(ns.tx-rateTx)/elapsed,.4);stats.rxRate=lerp(stats.rxRate,(ns.rx-rateRx)/elapsed,.4);rateAt=now;rateTx=ns.tx;rateRx=ns.rx;
 if(isHost&&now-lastSave>800&&query.get('test')!=='1'){lastSave=now;const json=JSON.stringify(world.workshopSnapshot());if(json!==saveKey){saveKey=json;saveStore('buddybay-workshop-v3',json);}}
 if(soundOn){const active=(isHost?world.snapshot():latest).h.filter(h=>h[5]).map(h=>h[7]);if(active.includes('saw')){beep(75+Math.sin(now*.09)*16,.18,.016,0,65);noise(.16,.02,1200);}if(active.includes('flame'))noise(.19,.024,1900);if(active.includes('freeze'))noise(.17,.018,4400);}
 updateUI();if(!isHost&&welcomed&&now-lastPing>1200){lastPing=now;net.send(hostId,'ping',{at:now});}
},200);
function frame(now){stats.frames++;window.__frames=stats.frames;window.__peers=net.peers().length;renderState=isHost?world.snapshot(paused):interpolate(now);const renderStart=performance.now();if(!isHost){const ready=timedMalletEvents.filter(e=>e.gen===renderState.gen&&e.at<=renderState.t);timedMalletEvents=timedMalletEvents.filter(e=>e.gen===renderState.gen&&e.at>renderState.t);for(const e of ready)showEvent(e);}renderer.draw(renderState,local,hostId,welcomed);perfSamples.render.push(performance.now()-renderStart);if(perfSamples.render.length>300)perfSamples.render.shift();lastFrame=now;requestAnimationFrame(frame);}
requestAnimationFrame(frame);updateUI();
window.addEventListener('beforeunload',()=>{releasePointer();if(isHost)net.broadcast('end',{});else net.send(hostId,'goodbye',{});net.dispose();clearInterval(simTimer);clearInterval(snapshotTimer);clearInterval(uiTimer);});
// Read-only observability plus deliberate harness controls. These are not network APIs.
window.__buddy={
 title:'Buddy Bonk',version:'0.5.0',get role(){return isHost?'host':'guest';},get id(){return myId;},get hostId(){return hostId;},get room(){return roomCode;},
 get state(){return isHost?world.snapshot(paused):latest;},get renderState(){return renderState;},get hand(){return {...local};},get connected(){return welcomed&&!hostGone;},
 get pointer(){return {inside:pointerInside,activeId:activePointer,waiting:waitForRelease,mode:cursorMode,type:pointerType,cursor:getComputedStyle(canvas).cursor,capture:activePointer!==null&&canvas.hasPointerCapture(activePointer),localHandVisible:renderer.localHandVisible};},
 get ui(){return {quiet:uiQuiet,drawerOpen:!$('toolDrawer').hidden,scale:uiFactor};},
 get stats(){return {...stats,fx:{...renderer.blood.stats(),particles:renderer.particles.length,beams:renderer.beams.length,rings:renderer.rings.length},perf:{render:perfSamples.render.slice(),physics:perfSamples.physics.slice()},receivedSnapshots,rtt,paused,remotePaused,net:net.stats(),fps:renderer.fps};},
 screen:(x,y)=>{const p=renderer.toScreen(x,y),r=canvas.getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top};},
 invite:inviteURL,rtcStats:()=>net.rtcStats(),offer:()=>net.offer(),answer:code=>net.answer(code),finish:code=>net.finish(code),
 input:({x,y,down,tool='grab'})=>{renderer.localHandVisible=true;if(finite(x))local.x=clamp(x,BB.LEFT,BB.RIGHT);if(finite(y))local.y=clamp(y,BB.TOP,BB.FLOOR);local.tool=Object.hasOwn(TOOLS,tool)?tool:'grab';if(down&&!local.down)local.grip=pickRendered(local.x,local.y);local.down=!!down;sendInput(true);if(!down)local.grip=null;markInteraction();},
 setTool,command,disconnect:()=>{releasePointer();if(isHost)net.broadcast('end',{});else net.send(hostId,'goodbye',{});setTimeout(()=>net.dispose(),80);},debug:()=>{debugVisible=true;$('diagnostics').hidden=false;updateUI();},
 // Test-only physical setup is unavailable unless explicitly opted into ?test=1.
 test:query.get('test')==='1'?{
  placeBall:(x,y,vx=0,vy=0)=>{if(!isHost)throw new Error('Only host owns physics');const n=world.addBall(x,y,false);if(n){n.vx=vx;n.vy=vy;}return n?.id;},
  freeze:(v)=>{if(!isHost)throw new Error('Host only');paused=!!v;sendSnapshot(true);},
  setNode:(id,x,y,vx=0,vy=0)=>{if(!isHost)throw new Error('Host only');const n=world.node(id);if(n){Object.assign(n,{x,y,vx,vy});world.lastTouch=world.time;}},
  validSnapshot,constants:BB,tools:TOOLS,codec:SnapshotCodec,renderer,net,mallet:{config:MALLET,pose:malletPose},
  receive:(id,k,d)=>onData(id,k,d),world:()=>world
 }:undefined
};

})();