/* Unified catalogue: local previews never change the shared room until Apply. */
const catState={tab:'weapons',sub:'all',owned:false,fast:false,item:null,key:'',previewKey:''};
const catItems=[];
for(const [id,tool] of Object.entries(TOOLS))catItems.push({key:'tool:'+id,type:'tool',id,tab:TOY_SET.has(id)?'toys':'weapons',sub:'all',name:id==='smg'?'SMG':toolName(id),price:tool.cost||0,description:toolHelp(id),fresh:!!NEW_TOOLS[id]});
for(const [type,items] of Object.entries(LOOKS))items.forEach((v,i)=>catItems.push({key:type+':'+i,type,id:i,tab:type==='body'||type==='hat'?'buddy':type==='hand'?'hands':'room',sub:type,name:v.name,price:v.cost,description:type==='room'?v.info:type==='hat'?'Preview it on Buddy, then wear it. Everyone sees the same hat.':type==='body'?'A different look for the same indestructible Buddy. Hats work with every outfit.':'Your glove, your choice. Your player color stays visible.'}));
UPGRADES.forEach((v,i)=>catItems.push({key:'upgrade:'+i,type:'upgrade',id:i,tab:'toys',sub:'upgrades',name:v.name.toLowerCase().replace(/^./,x=>x.toUpperCase()),price:v.prices[0],description:v.info}));
function catWorld(){return isHost?world.snapshot(paused):latest;}
function catOwned(item,s){return item.type==='tool'?s.free||!!(s.unlock&(1<<TOOL_IDS.indexOf(item.id))):item.type==='upgrade'?true:ownsLook(s,item.type,item.id);}
function catEquipped(item,s){if(item.type==='tool')return item.id===selectedTool;if(item.type==='body')return item.id===s.skin;if(item.type==='hat')return item.id===s.hat;if(item.type==='room')return item.id===s.theme;if(item.type==='hand')return item.id===(s.h.find(h=>h[0]===myId)?.[9]||0);return s.upg[item.id]>=3;}
function catPrice(item,s){return item.type==='upgrade'?UPGRADES[item.id].prices[s.upg[item.id]]||0:item.price;}
function chooseCategory(tab){$('catalogueGrid').scrollTop=0;catState.tab=tab;catState.sub=tab==='buddy'?'body':'all';catState.item=null;catState.key='';renderCatalogue(true);}
function openCatalogue({owned=false,tab=null,item=null,fast=false}={}){
 catState.owned=owned;catState.fast=fast;
 if(tab)catState.tab=tab;else if(item)catState.tab=catItems.find(i=>i.key===item)?.tab||'weapons';
 if(catState.tab==='buddy'&&!['body','hat'].includes(catState.sub))catState.sub='body';else if(catState.tab!=='buddy'&&!['all','upgrades'].includes(catState.sub))catState.sub='all';
 if(item){const selected=catItems.find(i=>i.key===item);if(selected){catState.item=item;catState.sub=selected.sub;}}
 catState.key='';$('ownedOnly').checked=owned;showDialog('shopDialog');renderCatalogue(true);
}
function renderCatalogue(force=false){
 if(!$('shopDialog').open)return;const s=catWorld();if(!s)return;
 $('shopCash').textContent='$'+s.bank.toLocaleString();$('modeBtn').textContent=s.free?'Sandbox':'Earn unlocks';$('modeBtn').classList.toggle('free',s.free);$('modeBtn').disabled=!isHost;
 const key=[catState.tab,catState.sub,catState.owned,s.unlock,s.looks,s.free,s.skin,s.hat,s.theme,...s.upg,selectedTool,s.h.find(h=>h[0]===myId)?.[9]||0].join('/');
 if(!force&&catState.key===key){updateCatalogueAction(s);return;}catState.key=key;
 document.querySelectorAll('[data-category]').forEach(b=>{b.classList.toggle('active',b.dataset.category===catState.tab);b.setAttribute('aria-pressed',String(b.dataset.category===catState.tab));});
 const subtabs=$('catalogueSubtabs');subtabs.replaceChildren();
 const subs=catState.tab==='buddy'?[['body','Bodies'],['hat','Hats']]:catState.tab==='toys'?[['all','Equipment'],['upgrades','Upgrades']]:[];
 for(const [id,label] of subs){const b=document.createElement('button');b.textContent=label;b.dataset.sub=id;b.classList.toggle('active',id===catState.sub);b.onclick=()=>{$('catalogueGrid').scrollTop=0;catState.sub=id;catState.item=null;renderCatalogue(true);};subtabs.append(b);}
 const items=catItems.filter(i=>i.tab===catState.tab&&(catState.tab==='buddy'?i.sub===catState.sub:catState.tab==='toys'?catState.sub==='upgrades'?i.type==='upgrade':i.type!=='upgrade':true)&&(!catState.owned||catOwned(i,s)));
 if(!items.some(i=>i.key===catState.item))catState.item=items.find(i=>catEquipped(i,s))?.key||items[0]?.key||null;
 const grid=$('catalogueGrid'),scroll=grid.scrollTop;grid.replaceChildren();
 if(!items.length){const p=document.createElement('p');p.id='catalogueEmpty';p.textContent='No items here yet. Turn off “Owned only” to browse the whole shelf.';grid.append(p);}
 for(const item of items){
  const b=document.createElement('button');b.className='catalogue-item';b.dataset.item=item.key;b.dataset.kind=item.type;b.setAttribute('aria-label',item.name);b.classList.toggle('selected',item.key===catState.item);b.setAttribute('aria-pressed',String(item.key===catState.item));
  const art=document.createElement('canvas');art.width=360;art.height=item.type==='body'?320:220;b.append(art);paintCatalogueItem(art,item,s,false);
  const name=document.createElement('b');name.textContent=item.name;b.append(name);const state=document.createElement('small');state.textContent=catEquipped(item,s)?'Equipped':item.type==='upgrade'?'Level '+s.upg[item.id]+' / 3':catOwned(item,s)?'Owned':'';b.append(state);
  if(!catOwned(item,s)){const tag=document.createElement('span');tag.className='catalogue-price';tag.textContent='$'+catPrice(item,s);b.append(tag);}
  if(item.fresh){const fresh=document.createElement('span');fresh.className='new-tag';fresh.textContent='NEW';b.append(fresh);}
  b.onclick=()=>{catState.item=item.key;grid.querySelectorAll('[data-item]').forEach(el=>{el.classList.toggle('selected',el.dataset.item===item.key);el.setAttribute('aria-pressed',String(el.dataset.item===item.key));});renderCataloguePreview(s);if(catState.fast&&item.type==='tool'&&catOwned(item,s)){setTool(item.id);$('shopDialog').close();}};
  b.ondblclick=()=>{if(catState.item===item.key)activateCatalogueItem();};grid.append(b);
 }
 grid.scrollTop=scroll;renderCataloguePreview(s);
}
function renderCataloguePreview(s){
 const item=catItems.find(i=>i.key===catState.item);if(!item)return;
 $('itemTitle').textContent=item.name;$('itemDescription').textContent=item.description;
 $('itemScope').textContent=item.type==='tool'?item.id==='spear'?'Two per hand. Oldest unused spear recycles.':'Shared purchases · equipment stays yours to use':item.type==='hand'?'Room unlock · only your hand changes':item.type==='room'?'Shared room · applied by the host':'Shared appearance · applies to Buddy';
 paintCatalogueItem($('itemPreview'),item,s,true);updateCatalogueAction(s);
}
function updateCatalogueAction(s){
 const item=catItems.find(i=>i.key===catState.item),b=$('catalogueAction');if(!item){b.disabled=true;return;}
 const owned=catOwned(item,s),equipped=catEquipped(item,s),cost=catPrice(item,s),hostOnly=item.type==='room'&&!isHost;
 b.disabled=hostOnly||(equipped&&item.type!=='tool')||(!owned&&s.bank<cost)||(item.type==='upgrade'&&(equipped||s.bank<cost));
 b.textContent=hostOnly?'Host changes the room':item.type==='upgrade'?equipped?'Maxed out':'Upgrade · $'+cost:equipped?'Equipped':owned?item.type==='tool'?'Equip':item.type==='room'?'Use this room':'Wear it':s.bank<cost?'Need $'+(cost-s.bank)+' more':'Buy & '+(item.type==='room'?'use':item.type==='tool'?'equip':'wear')+' · $'+cost;
}
function activateCatalogueItem(){
 const item=catItems.find(i=>i.key===catState.item),s=catWorld();if(!item||$('catalogueAction').disabled)return;
 if(item.type==='tool'){
  if(catOwned(item,s)){setTool(item.id);$('shopDialog').close();}
  else{pendingEquip=item.id;command('buy:'+item.id);}
 }else if(item.type==='upgrade')command('buy:'+UPGRADES[item.id].id);
 else command((catOwned(item,s)?'look:':'buylook:')+item.type+':'+item.id);
 catState.key='';renderCatalogue(true);
}
function previewPainter(ctx){
 const p=Object.create(BuddyRenderer.prototype);Object.assign(p,{ctx,mallets:new Map(),tetherPreviews:new Map(),trails:new Map(),charges:new Map(),speech:new Map(),visualState:{mood:[0,0,0,0],d:[],hat:0},shells:[],roomCache:new Map(),handStyle:0,rimKick:0,particles:[],rings:[],beams:[],blasts:[],scuffs:[],airwaves:[]});return p;
}
const thumbnailCache=new Map();
function paintCatalogueItem(canvas,item,state,hero){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const p=previewPainter(ctx);const s={...state,impact:0,mood:[0,0,0,0],d:Array(13).fill(0),hat:state.hat||0};p.visualState=s;
 ctx.save();
 if(item.type==='room'){const scale=Math.min(w/1280,h/720);ctx.translate((w-1280*scale)/2,(h-720*scale)/2);ctx.scale(scale,scale);p.background(0,false,item.id);p.hoop(0,0);ctx.restore();return;}
 if(item.type==='body'||item.type==='hat'){
  if(!hero&&item.type==='hat'){ctx.translate(w/2,h*.81);ctx.scale(Math.min(w/125,h/106),Math.min(w/125,h/106));p.drawHat(item.id,0,{vx:0});if(!item.id){p.circle(0,-38,28,null,'#8b9688',2);p.line(-20,-18,20,-58,'#b67757',3);}}
  else{const sc=Math.min(w/300,h/435),nodes=BASE_POSE.map(([x,y,r],id)=>[id,x,y,0,0,r,0,0]);ctx.translate(w/2-640*sc,(h-390*sc)/2-245*sc);ctx.scale(sc,sc);s.hat=item.type==='hat'?item.id:state.hat||0;s.skin=item.type==='body'?item.id:state.skin||0;p.buddy(nodes,[],1,0,false,s.skin);}
 }else if(item.type==='hand'){
  p.handStyle=item.id;const sc=Math.min(w/90,h/108);ctx.translate(w/2-5*sc,h/2-10*sc);ctx.scale(sc,sc);p.gloveShape(0,0,local.color,false,1);
 }else if(item.type==='upgrade'){
  ctx.translate(w/2,h/2);ctx.scale(Math.min(w,h)/100,Math.min(w,h)/100);if(item.id===0)p.gloveShape(-11,-10,'#d97651',true,1.1);else if(item.id===1){p.circle(0,0,28,'#edc165',INK,3);p.text('$',0,14,40,'#9d703b','900','center');}else{p.circle(0,0,28,'#89bdbb',INK,3);p.poly([[-12,5],[1,-12],[14,5],[7,5],[7,16],[-6,16],[-6,5]],'#f6e6b9',INK,2);}
 }else{
  const sprite=toolPortrait(item.id);const inset=hero?18:10,scale=Math.min((w-inset*2)/sprite.width,(h-inset*2)/sprite.height);
  ctx.drawImage(sprite,(w-sprite.width*scale)/2,(h-sprite.height*scale)/2,sprite.width*scale,sprite.height*scale);
 }
 ctx.restore();
}
// Render a tool once with the exact in-game painter, then alpha-crop the silhouette.
// This avoids tiny guns floating in huge cards and reticles pretending to be art.
const portraitCache=new Map();
function toolPortrait(id){
 if(portraitCache.has(id))return portraitCache.get(id);
 function paint(c){const p=previewPainter(c),circle=p.circle.bind(p),line=p.line.bind(p);
  p.circle=(x,y,r,...rest)=>{if(Math.abs(x-640)<10&&Math.abs(y-350)<2&&r<=23)return;circle(x,y,r,...rest);};
  p.line=(x,y,xx,yy,...rest)=>{if(Math.hypot(x-640,y-350)<26&&Math.hypot(xx-640,yy-350)<26)return;line(x,y,xx,yy,...rest);};
  if(NEW_TOOLS[id]){c.save();c.translate(640,390);c.rotate(-.22);p.drawNewTool(id,1,99,false);c.restore();}
  else if(id==='rocket')p.rocket([0,640,350,600,-300],1);
  else p.toolCursor(['preview','',local.color,640,350,false,null,id,-10],1,10);
 }
 const scratch=document.createElement('canvas');scratch.width=1280;scratch.height=850;const c=scratch.getContext('2d',{willReadFrequently:true});paint(c);
 const rgba=c.getImageData(0,0,1280,850).data;let minX=1280,minY=850,maxX=0,maxY=0;
 for(let y=0;y<850;y++)for(let x=0;x<1280;x++)if(rgba[(y*1280+x)*4+3]>4){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 const out=document.createElement('canvas');if(maxX<=minX){out.width=out.height=1;return out;}
 // Re-render the vector drawing at 4x inside its tight bounds; never enlarge a low-res icon.
 out.width=(maxX-minX+9)*4;out.height=(maxY-minY+9)*4;const oc=out.getContext('2d');oc.setTransform(4,0,0,4,-(minX-4)*4,-(minY-4)*4);paint(oc);portraitCache.set(id,out);return out;
}
function initCatalogue(){
 for(const b of document.querySelectorAll('[data-category]'))b.onclick=()=>chooseCategory(b.dataset.category);
 $('catalogueAction').onclick=activateCatalogueItem;$('ownedOnly').onchange=()=>{catState.owned=$('ownedOnly').checked;catState.fast=false;renderCatalogue(true);};
 $('closeShop').onclick=()=>{$('shopDialog').close();};$('shopDialog').addEventListener('close',()=>{pendingEquip='';$('toolsBtn').setAttribute('aria-expanded','false');});
 $('modeBtn').onclick=()=>{if(!isHost)return;suspendPointer();world.sandbox=!world.sandbox;shopKey='';sendSnapshot(true);updateWorkshop(world.snapshot(),true);catState.key='';renderCatalogue(true);};
 $('shopBtn').onclick=()=>openCatalogue({owned:false,fast:false});$('customizeBtn').onclick=()=>openCatalogue({tab:'buddy',owned:false});
 $('quickSweepBtn').onclick=()=>{suspendPointer();command('sweep');};$('sweepOptionsBtn').onclick=()=>{showDialog('sweepDialog');$('clearAllBtn').disabled=!isHost;};$('closeSweep').onclick=()=>$('sweepDialog').close();
 for(const b of document.querySelectorAll('[data-sweep]'))b.onclick=()=>{suspendPointer();command(b.dataset.sweep);$('sweepDialog').close();};
 const hold=$('clearAllBtn');let start=0,timer=0;
 const stop=()=>{clearInterval(timer);timer=0;hold.style.setProperty('--hold','0%');};
 const begin=()=>{if(!isHost||timer)return;start=performance.now();timer=setInterval(()=>{const f=clamp((performance.now()-start)/850,0,1);hold.style.setProperty('--hold',(f*100)+'%');if(f>=1){stop();command('clearall');$('sweepDialog').close();}},16);};
 hold.addEventListener('pointerdown',e=>{if(e.button===0){e.preventDefault();begin();}});hold.addEventListener('pointerleave',stop);hold.addEventListener('pointercancel',stop);window.addEventListener('pointerup',stop);window.addEventListener('blur',stop);hold.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();begin();}});hold.addEventListener('keyup',stop);$('sweepDialog').addEventListener('close',stop);
 // Legacy hidden hotkey buttons are refreshed only for compatibility with prior harnesses.
 for(const b of document.querySelectorAll('[data-tool]'))b.querySelector('svg')?.replaceWith(new DOMParser().parseFromString(toolSVG(b.dataset.tool),'image/svg+xml').documentElement);
}
