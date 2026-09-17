/* Shared state: recycling, cosmetic purchases and the expanded weapon family.
   Attached spears use ONE existing node slot, not a chain or replicated joint rig. */
BuddyWorld.prototype.isProtected=function(n){
 return [...this.hands.values()].some(h=>h.grip&&(h.grip.a===n.id||h.grip.b===n.id)||h.tetherStart?.id===n.id)||
 this.tethers.some(r=>r[1]===n.id||r[2]===n.id)||this.bonds.some(b=>b[0]===n.id||b[1]===n.id);
};
BuddyWorld.prototype.recycleCandidate=function(kind,owner='',onlyMine=false){
 const candidates=this.nodes.filter(n=>n.kind&&(!kind||n.kind===kind)&&[1,4,5,6,7].includes(n.kind)&&!this.isProtected(n)&&(!onlyMine||n.owner===owner));
 candidates.sort((a,b)=>(a.owner===owner?0:1)-(b.owner===owner?0:1)||a.id-b.id);return candidates[0]||null;
};
BuddyWorld.prototype.sweep=function(){
 let count=0;for(const n of [...this.nodes])if([1,4,5,6,7].includes(n.kind)&&!this.isProtected(n)){this.removeNode(n.id);count++;}
 this.candies=[];this.cleanStains();this.onEvent({type:'swept',text:count?'Swept '+count+' loose toys. Setups kept.':'Room washed. Held toys and setups kept.'});
};
BuddyWorld.prototype.lookCommand=function(id,code){
 const [action,type,raw]=code.split(':'),items=LOOKS[type],i=Number(raw);if(!items||!Number.isInteger(i)||!items[i])return;
 if(type==='room'&&this.authorityId&&id!==this.authorityId){this.onEvent({type:'purchaseDenied',who:id,text:'Only the host changes the room.'});return;}
 const bit=LOOK_BIT(type,i),def=items[i];
 if(!this.sandbox&&!(this.looks&bit)){
  if(action!=='buylook')return;
  if(this.cash<def.cost){this.onEvent({type:'purchaseDenied',who:id,text:'Need $'+(def.cost-this.cash)+' more.'});return;}
  this.cash-=def.cost;this.looks=(this.looks|bit)>>>0;
 }
 if(type==='body')this.skin=i;else if(type==='hat')this.hat=i;else if(type==='room')this.theme=i;else{const h=this.hands.get(id);if(h)h.style=i;}
 this.onEvent({type:'look',who:id,kind:type,item:i,text:def.name+(type==='room'?' ready.':' equipped.')});
};
BuddyWorld.prototype.gunOrigin=function(h){
 const x=clamp(h.x-100,BB.LEFT+24,BB.RIGHT-24),y=clamp(h.y+48,BB.TOP+26,BB.FLOOR-24),a=Math.atan2(h.y-y,h.x-x);
 return {x,y,a,dx:Math.cos(a),dy:Math.sin(a)};
};
BuddyWorld.prototype.reloadGun=function(h,gun){
 const conf=GUNS[h.tool];gun.reload=this.time+conf.reload;gun.next=gun.reload;
 this.onEvent({type:'reload',who:h.id,tool:h.tool,at:this.tick,duration:conf.reload});
};
BuddyWorld.prototype.fireGun=function(h){
 const cfg=GUNS[h.tool];if(!cfg)return;
 const guns=h.guns||(h.guns={}),g=guns[h.tool]||(guns[h.tool]={ammo:cfg.mag,next:-1,reload:0});
 if(g.reload&&this.time>=g.reload){g.ammo=cfg.mag;g.reload=0;}
 if(g.reload||this.time<g.next)return;
 if(h.tool==='minigun'&&this.time-(h.holdAt??this.time)<.34)return;
 if(g.ammo<=0){this.reloadGun(h,g);return;}
 g.ammo--;g.next=this.time+cfg.rate;h.lastUse=this.time;
 if(h.tool==='grenade'){
  this.spawnOwner=h.id;const o=this.gunOrigin(h),n=this.makeProp(2,o.x+o.dx*58,o.y+o.dy*58,17,1.1);
  if(n){n.vx=o.dx*720;n.vy=o.dy*720-130;n.fuse=this.time+2.15;n.owner=h.id;this.onEvent({type:'launchGrenade',x:n.x,y:n.y,who:h.id,at:this.tick});}
 }else{
  this.gunShot(h,cfg);
  if(h.tool==='burst')h.burst={left:Math.min(2,g.ammo),next:this.time+.075,tool:h.tool};
 }
 if(g.ammo<=0&&h.tool!=='burst')this.reloadGun(h,g);
};
BuddyWorld.prototype.updateBursts=function(){
 for(const h of this.hands.values()){
  const b=h.burst;if(!b)continue;if(h.tool!==b.tool){h.burst=null;continue;}
  if(this.time<b.next)continue;
  const cfg=GUNS[b.tool],g=h.guns?.[b.tool];if(!g||g.ammo<=0||b.left<=0){h.burst=null;if(g&&g.ammo<=0)this.reloadGun(h,g);continue;}
  g.ammo--;b.left--;b.next+=.075;h.lastUse=this.time;this.gunShot(h,cfg);
  if(b.left<=0){h.burst=null;if(g.ammo<=0)this.reloadGun(h,g);}
 }
};
BuddyWorld.prototype.gunShot=function(h,cfg){
 const o=this.gunOrigin(h),sx=o.x+o.dx*(cfg.muzzle||55),sy=o.y+o.dy*(cfg.muzzle||55),rng=seeded(this.tick*179+h.seq*67),ends=[],hitNodes=new Map();
 for(let i=0;i<cfg.pellets;i++){
  const angle=o.a+(cfg.pellets>1?(i-(cfg.pellets-1)/2)/(cfg.pellets-1)*cfg.spread*2:(rng()-.5)*cfg.spread),dx=Math.cos(angle),dy=Math.sin(angle),tx=sx+dx*1500,ty=sy+dy*1500;
  const n=this.aimNode(tx,ty,sx,sy,2),reach=n?Math.hypot(n.x-sx,n.y-sy):Math.min(1500,(dx>0?BB.RIGHT-sx:BB.LEFT-sx)/(dx||1),(dy>0?BB.FLOOR-sy:BB.TOP-sy)/(dy||1));
  const hx=n?n.x:sx+dx*reach,hy=n?n.y:sy+dy*reach;ends.push([Math.round(hx),Math.round(hy),n?1:0]);
  if(n){hitNodes.set(n.id,(hitNodes.get(n.id)||0)+1);if(n.stuck){n.stuck=null;n.im=1/n.m;}n.vx+=dx*cfg.power*this.power()/Math.sqrt(n.m);n.vy+=dy*cfg.power*this.power()/Math.sqrt(n.m)-32;}
 }
 let hit=false;for(const [id,count] of hitNodes){const n=this.node(id);if(!n||this.hitProp(n,h.id))continue;if(!n.kind){this.hurt(n,n.x,n.y,o.dx,o.dy,Math.min(1.5,cfg.hurt*count),DAMAGE.bullet,h.id);hit=true;}}
 if(hit){this.lastTouch=this.time;this.reward(h.x,h.y,h.id,h.tool,cfg.pellets>1?5:cfg.power>500?3:1);}
 this.onEvent({type:'gunshot',who:h.id,tool:h.tool,x:round(sx),y:round(sy),ends,at:this.tick,hit});
};
BuddyWorld.prototype.throwSpear=function(h,charge){
 if(this.time<(h.cooldowns?.spear||0)||!this.canUse('spear'))return;
 this.spawnOwner=h.id;const o=this.gunOrigin(h),n=this.makeProp(6,o.x+o.dx*(53-charge*28),o.y+o.dy*(53-charge*28),8,.62);if(!n)return;
 const speed=740+charge*1050;n.vx=o.dx*speed;n.vy=o.dy*speed;n.a=o.a;n.owner=h.id;n.hitAt=-10;n.spawnAt=this.time;
 h.lastUse=this.time;(h.cooldowns||(h.cooldowns={})).spear=this.time+.25;
 this.onEvent({type:'spearThrow',who:h.id,x:n.x,y:n.y,at:this.tick});
};
BuddyWorld.prototype.throwStar=function(h){
 this.spawnOwner=h.id;const o=this.gunOrigin(h),n=this.makeProp(7,o.x+o.dx*36,o.y+o.dy*36,12,.32);if(!n)return;
 n.vx=o.dx*1050;n.vy=o.dy*1050;n.a=o.a;n.owner=h.id;n.ricochets=0;n.hitAt=-10;n.spawnAt=this.time;
 this.onEvent({type:'starThrow',who:h.id,x:n.x,y:n.y,at:this.tick});
};
BuddyWorld.prototype.bodyFrame=function(id){
 const n=this.node(id),parent=this.node([1,2,1,1,3,4,1,6,7,2,9,2,11][id]);
 if(!n)return null;return {x:n.x,y:n.y,a:parent?Math.atan2(n.y-parent.y,n.x-parent.x):n.a||0};
};
BuddyWorld.prototype.syncAttachments=function(){
 for(const n of this.nodes)if(n.stuck){
  const d=n.stuck;if(d.id<0){n.vx=n.vy=0;continue;}
  const frame=this.bodyFrame(d.id);if(!frame){n.stuck=null;n.im=1/n.m;continue;}
  const co=Math.cos(frame.a),si=Math.sin(frame.a);n.x=clamp(frame.x+co*d.x-si*d.y,BB.LEFT+n.r,BB.RIGHT-n.r);n.y=clamp(frame.y+si*d.x+co*d.y,BB.TOP+n.r,BB.FLOOR-n.r);n.a=frame.a+d.a;n.vx=n.vy=0;
 }
};
BuddyWorld.prototype.updateThrown=function(dt){
 this.syncAttachments();
 for(const n of [...this.nodes]){
  if(![6,7].includes(n.kind)||n.stuck||this.isProtected(n))continue;
  const speed=Math.hypot(n.vx,n.vy);if(n.kind===7&&this.time-(n.spawnAt||0)>8){this.removeNode(n.id);continue;}
  if(speed<180)continue;
  const to={x:n.x+n.vx*dt,y:n.y+n.vy*dt};let best=null;
  for(const b of this.nodes){if(b===n||b.kind===6||b.kind===7)continue;const q=segmentPoint(b.x,b.y,n,to);if(Math.hypot(q.x-b.x,q.y-b.y)<b.r+n.r&&(!best||q.t<best.t))best={node:b,x:q.x,y:q.y,t:q.t};}
  if(best&&this.time-(n.hitAt||-10)>.15){
   const b=best.node,dx=n.vx/(speed||1),dy=n.vy/(speed||1);n.hitAt=this.time;
   if(this.hitProp(b,n.owner)){if(n.kind===7){n.vx*=-.68;n.vy*=-.68;}continue;}
   b.vx+=dx*(n.kind===6?speed*.45:340)/Math.sqrt(b.m);b.vy+=dy*(n.kind===6?speed*.45:340)/Math.sqrt(b.m)-70;
   if(!b.kind){this.hurt(b,best.x,best.y,dx,dy,n.kind===6?.92:.4,DAMAGE.cut,n.owner);this.reward(best.x,best.y,n.owner,n.kind===6?'spear':'shuriken',n.kind===6?4:1);}
   if(n.kind===6){const f=this.bodyFrame(b.id),co=Math.cos(f.a),si=Math.sin(f.a),ox=best.x-b.x,oy=best.y-b.y;n.x=best.x;n.y=best.y;n.a=Math.atan2(n.vy,n.vx);n.stuck={id:b.id,x:ox*co+oy*si,y:-ox*si+oy*co,a:n.a-f.a};n.im=0;n.vx=n.vy=0;}
   else{n.vx=-n.vx*.74;n.vy=-n.vy*.74-60;n.ricochets++;if(n.ricochets>=3){this.removeNode(n.id);continue;}}
   this.onEvent({type:'throwHit',x:best.x,y:best.y,who:n.owner,kind:n.kind});
  }
  if(n.kind===6&&!n.stuck&&(to.x<=BB.LEFT+n.r||to.x>=BB.RIGHT-n.r||to.y<=BB.TOP+n.r||to.y>=BB.FLOOR-n.r)){
   n.x=clamp(to.x,BB.LEFT+n.r,BB.RIGHT-n.r);n.y=clamp(to.y,BB.TOP+n.r,BB.FLOOR-n.r);n.stuck={id:-1};n.im=0;n.vx=n.vy=0;
   this.onEvent({type:'throwHit',x:n.x,y:n.y,who:n.owner,kind:n.kind});
  }else if(n.kind===7&&(to.x<=BB.LEFT+n.r||to.x>=BB.RIGHT-n.r||to.y<=BB.TOP+n.r||to.y>=BB.FLOOR-n.r)&&this.time-n.hitAt>.08){n.hitAt=this.time;n.ricochets++;if(n.ricochets>=3)this.removeNode(n.id);}
 }
};
BuddyWorld.prototype.waterSpray=function(h){
 const o=this.gunOrigin(h),end={x:o.x+o.dx*300,y:o.y+o.dy*300};let wet=false;
 for(const n of this.nodes){const q=segmentPoint(n.x,n.y,o,end);if(Math.hypot(q.x-n.x,q.y-n.y)>n.r+8+q.t*20)continue;
  if(!n.kind)wet=true;if(n.kind===2)n.fuse=Math.min(n.fuse+.11,this.time+2.8);if(!n.stuck){n.vx+=o.dx*34;n.vy+=o.dy*34-12;}}
 for(const c of this.candies){const q=segmentPoint(c.x,c.y,o,end);if(Math.hypot(q.x-c.x,q.y-c.y)<35){c.vx+=o.dx*90;c.vy+=o.dy*90-30;}}
 if(wet&&this.burnUntil>this.time){this.burnUntil=0;this.onEvent({type:'steam',x:h.x,y:h.y});}
 if(this.time-(this.lastWashAt??-10)>.28){
  const old=this.stains.length;this.stains=this.stains.filter(m=>Math.hypot(m[1]-h.x,m[2]-h.y)>105);
  if(old!==this.stains.length){this.onEvent({type:'washPatch',epoch:this.stainEpoch,x:Math.round(h.x),y:Math.round(h.y),radius:105});}this.lastWashAt=this.time;
 }
};
