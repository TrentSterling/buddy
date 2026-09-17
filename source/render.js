/* One renderer for catalogue previews AND game objects. No concept-art placeholders. */
const originalHat=BuddyRenderer.prototype.drawHat;
BuddyRenderer.prototype.drawHat=function(hat,t,head={vx:0}){
 if(hat<4)return originalHat.call(this,hat,t,head);
 const c=this.ctx;c.save();c.translate(0,-41);c.rotate(clamp(-(head.vx||0)*.00008,-.12,.12));
 if(hat===4){ // top hat
  this.rect(-37,-2,74,10,5,'#303644',INK,3);this.rect(-24,-47,48,47,5,'#3f4855',INK,3);this.rect(-24,-13,48,11,1,'#c6675b',INK,1.8);this.line(-17,-41,-17,-19,'#6f7d88',4);
 }else if(hat===5){
  c.beginPath();c.moveTo(-43,-9);c.quadraticCurveTo(-33,14,0,2);c.quadraticCurveTo(35,16,44,-10);c.quadraticCurveTo(33,-1,26,-7);c.lineTo(21,-31);c.quadraticCurveTo(5,-22,-9,-34);c.lineTo(-24,-29);c.lineTo(-28,-6);c.closePath();c.fillStyle='#b78454';c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();this.line(-25,-9,24,-9,'#684837',5);
 }else if(hat===6){
  this.poly([[-38,2],[-23,-19],[-7,-70],[11,-74],[5,-53],[26,-1]],'#7063a4',INK,3);this.rect(-39,-2,78,10,5,'#8f7ac1',INK,3);this.star(-7,-34,7,'#e8c566',.2);this.star(12,-14,4,'#f6dd98');
 }else if(hat===7){
  this.rect(-27,-22,54,29,5,'#eeeada',INK,3);for(const [x,y,r] of [[-25,-29,16],[-8,-40,19],[12,-40,19],[29,-28,15]])this.circle(x,y,r,'#faf3df',INK,2.7);this.rect(-25,-23,50,11,0,'#faf3df');this.line(-19,-11,-19,0,'#c0cdc8',2);this.line(0,-14,0,0,'#c0cdc8',2);this.line(19,-11,19,0,'#c0cdc8',2);
 }else if(hat===8){
  c.beginPath();c.ellipse(0,-4,32,26,0,Math.PI,Math.PI*2);c.fillStyle='#db7559';c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();this.rect(-33,-5,66,12,5,'#5aaeb6',INK,3);this.line(0,-29,0,-38,INK,3);c.save();c.translate(0,-38);c.scale(.85+Math.cos(t*9)*.15,1);this.poly([[-34,-3],[-3,-8],[33,1],[5,6]],'#f2cb65',INK,2);c.restore();this.circle(0,-38,4,'#e9e3c5',INK,2);
 }else if(hat===9){
  this.poly([[-43,1],[-32,-34],[-4,-25],[33,-35],[43,1]],'#39444d',INK,3);this.line(-38,-2,38,-2,'#daac54',5);this.circle(0,-17,8,'#eee8cf');this.circle(-3,-18,2,INK);this.circle(3,-18,2,INK);this.line(-5,-7,5,-8,'#eee8cf',2);
 }else if(hat===10){
  this.poly([[-26,0],[-12,-63],[11,-63],[26,0]],'#ef8350',INK,3);this.poly([[-21,-15],[-17,-32],[17,-32],[21,-15]],'#f7ebcb');this.rect(-38,-1,76,9,2,'#c56542',INK,3);
 }else if(hat===11){
  c.beginPath();c.arc(0,22,46,Math.PI,Math.PI*2);c.strokeStyle=INK;c.lineWidth=12;c.stroke();c.strokeStyle='#dc8c62';c.lineWidth=7;c.stroke();this.rect(-48,8,17,31,6,'#506578',INK,3);this.rect(31,8,17,31,6,'#506578',INK,3);this.line(-41,15,-41,31,'#8dbac6',3);this.line(41,15,41,31,'#8dbac6',3);
 }else if(hat===12){
  this.poly([[-20,-17],[-43,-34],[-41,-1]],'#779fa7',INK,2.8);c.beginPath();c.ellipse(4,-15,37,18,-.13,0,Math.PI*2);c.fillStyle='#91c8c0';c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();this.poly([[-6,-30],[4,-44],[15,-31]],'#d7b375',INK,2);this.circle(27,-22,7,'#f4eed2',INK,1.8);this.circle(29,-21,3,INK);this.line(31,-8,39,-9,INK,1.8);this.line(-9,-13,0,-8,'#5c8b94',2);
 }else{
  this.poly([[-27,-8],[-42,-16],[-52,-44],[-38,-37],[-29,-25]],'#e4dcc0',INK,3);this.poly([[27,-8],[42,-16],[52,-44],[38,-37],[29,-25]],'#e4dcc0',INK,3);c.beginPath();c.ellipse(0,-3,31,27,0,Math.PI,Math.PI*2);c.fillStyle='#899fa3';c.fill();c.strokeStyle=INK;c.lineWidth=3;c.stroke();this.rect(-32,-4,64,11,3,'#c59454',INK,3);this.rect(-4,-27,8,29,2,'#c3d3ce',INK,1.8);
 }
 c.restore();
};
BuddyRenderer.prototype.bodyMark=function(skin,scheme){
 const c=this.ctx,kind=SKINS[skin]?.kind||'cloth';
 if(kind==='robot'){
  this.rect(-29,-28,58,61,9,'#708f9b',INK,2.6);this.rect(-22,-21,44,22,3,'#223e4b',INK,2);for(let i=0;i<4;i++)this.line(-16+i*10,-13,-16+i*10,-6,['#84d3bd','#f1d175'][i%2],4);
  for(const x of [-20,20])for(const y of [-23,27])this.circle(x,y,2.4,'#dae9df',INK,1);this.circle(0,17,9,'#e3b358',INK,2);
 }else if(kind==='skeleton'){
  this.line(0,-28,0,40,'#6d7b78',7);for(let i=0;i<4;i++){c.beginPath();c.moveTo(-28,-24+i*14);c.quadraticCurveTo(-27,-11+i*14,0,-14+i*14);c.quadraticCurveTo(27,-11+i*14,28,-24+i*14);c.strokeStyle='#657a7b';c.lineWidth=8;c.stroke();c.strokeStyle='#f9eed4';c.lineWidth=4;c.stroke();}
 }else if(kind==='office'){
  this.poly([[-32,-34],[-3,-17],[-17,-6]],'#fff6dc',INK,2);this.poly([[32,-34],[3,-17],[17,-6]],'#fff6dc',INK,2);this.poly([[0,-21],[-8,-12],[-3,-4],[-9,34],[1,45],[11,32],[3,-4],[8,-12]],'#cc6f57',INK,2);this.rect(15,2,13,16,1,'#e5d5a4','#9c9b82',1.5);
 }else if(kind==='zombie'){
  this.poly([[-24,-24],[12,-27],[26,0],[6,25],[-22,17]],'#c7ad8c',INK,2);for(let y=-18;y<20;y+=8)this.line(-24,y,-17,y+2,'#654f57',2);this.line(-12,-12,14,12,'#8a6d72',2.6);this.circle(4,-4,7,'#9cb48c',INK,1.5);
 }else{
  this.rect(-22,-20,44,41,7,kind==='dummy'?'#2c3b44':'#f4e6c3',INK,2.5);this.circle(0,0,14,kind==='dummy'?'#efd178':null,scheme[3],2);
  if(kind==='dummy'){c.beginPath();c.moveTo(0,0);c.arc(0,0,12,0,Math.PI/2);c.lineTo(0,0);c.arc(0,0,12,Math.PI,Math.PI*1.5);c.closePath();c.fillStyle='#303943';c.fill();}
  else{this.line(-16,0,16,0,scheme[3],2);this.line(0,-15,0,15,scheme[3],2);this.circle(0,0,3,INK);}
 }
 this.rect(-21,38,42,8,2,'#496776',INK,2);this.rect(-7,37,14,10,1,'#d5ddc9',INK,1.5);
};
BuddyRenderer.prototype.faceDetail=function(skin){
 const kind=SKINS[skin]?.kind,c=this.ctx;
 if(kind==='robot'){
  this.rect(-23,-36,46,7,2,'#74939f',INK,1.5);for(const x of [-36,36])this.circle(x,2,3,'#668390',INK,1.4);this.line(-13,31,13,31,'#637e89',2.4);
 }else if(kind==='skeleton'){this.poly([[-4,6],[0,0],[4,6]],'#607071');for(const x of [-8,-2,4,10])this.line(x,28,x,34,'#667a79',1.7);}
 else if(kind==='zombie'){this.line(-33,-25,-16,-32,'#6e6057',2.4);for(let i=0;i<4;i++)this.line(-31+i*5,-30-i*2,-28+i*5,-22-i*2,'#51494a',1.4);}
 else if(kind==='dummy'){this.circle(32,-19,7,'#3a4548');this.circle(32,-19,3,'#f0c265');}
};
const patternedGlove=BuddyRenderer.prototype.gloveShape;
BuddyRenderer.prototype.gloveShape=function(x,y,color,down,scale=1){
 const style=this.handStyle||0,c=this.ctx;
 if(style===0)return patternedGlove.call(this,x,y,color,down,scale);
 if(style===2||style===3){
  const base=style===2?'#abc2c6':'#e9e1c5';c.save();c.translate(x,y);c.rotate(-.2);c.scale(scale,scale);
  this.rect(-9,9,38,27,9,base,INK,2.5);
  for(let i=0;i<4;i++){
   const xx=-3+i*9,tip=down?5:-11+(i===0?4:i===3?7:0);
   this.rect(xx-4,tip,7,down?13:30,style===2?2:4,base,INK,2);this.line(xx-2,tip+9,xx+2,tip+9,style===2?'#6c8f99':'#8b9487',2);
   if(style===3)this.circle(xx,tip+18,3,'#f5ebd2',INK,1);
  }
  this.rect(-17,12,12,19,5,base,INK,2);if(style===2){this.circle(10,21,7,color,INK,2);this.circle(10,21,3,'#e9f1d7');}else for(let i=0;i<3;i++)this.line(i*9,19,i*9+1,31,'#959d8e',2);
  this.rect(-7,33,36,12,3,color,INK,2.6);this.line(-2,38,23,38,'#fff3d2',2);c.restore();return;
 }
 c.save();c.translate(x,y);c.rotate(-.2);c.scale(scale,scale);
 if(style===1){this.rect(-7,28,34,16,4,'#f0dfb7',INK,3);this.rect(-13,-4,43,36,15,color,INK,3);this.rect(-23,6,16,22,7,color,INK,3);this.line(-4,1,15,-1,'#fff1cd',3);this.line(0,24,18,24,'#283c5066',2);}
 if(style===4){this.rect(-14,-12,45,47,16,'#d69b65',INK,3);this.rect(-24,10,17,22,7,'#d69b65',INK,3);c.save();c.beginPath();c.roundRect(-13,-11,43,44,15);c.clip();for(let i=-40;i<50;i+=12){this.line(i,-15,i+48,36,'#a26c4c',1.5);this.line(i,36,i+48,-15,'#f2c78d',1.5);}c.restore();this.rect(-10,30,40,13,3,color,INK,3);}
 if(style===5){this.rect(-13,4,42,34,9,color,INK,3);this.rect(-8,-38,14,49,7,color,INK,3);this.rect(5,-4,9,21,4,color,INK,2);this.rect(13,0,9,18,4,color,INK,2);this.rect(21,5,9,14,4,color,INK,2);this.text('1',9,31,23,'#fff0c7','900','center');this.rect(-13,33,43,11,2,'#f3deae',INK,3);}
 c.restore();
};
const oldRoom=BuddyRenderer.prototype.background;
BuddyRenderer.prototype.background=function(t,low,theme=this.sceneTheme||0){
 if(!theme)return oldRoom.call(this,t,low);
 const c=this.ctx;this.roomCache=this.roomCache||new Map();let cached=this.roomCache.get(theme);
 if(!cached){cached=document.createElement('canvas');cached.width=1280;cached.height=720;const rc=cached.getContext('2d'),old=this.ctx;this.ctx=rc;this.paintRoom(theme);this.ctx=old;this.roomCache.set(theme,cached);}
 c.fillStyle=['','#877766','#cabaa0','#b8c6bf','#b58964','#263c52'][theme]||'#a8bec3';c.fillRect(-3000,-2000,7000,6000);c.drawImage(cached,0,0);
 if(low){c.save();c.globalAlpha=.08;c.fillStyle='#6c77cb';c.fillRect(36,66,1208,580);c.restore();}
};
BuddyRenderer.prototype.paintRoom=function(theme){
 const c=this.ctx;
 const wall=['','#c5b097','#edd8b3','#d4ded2','#ba9177','#536b7d'][theme],floor=['','#847664','#b48166','#91aca6','#c9965d','#32485b'][theme];
 c.fillStyle=wall;c.fillRect(0,0,1280,720);
 if(theme===1){
  for(let y=90;y<630;y+=56){this.line(36,y,1244,y,'#ad957d',2);for(let x=36+(y%112?0:60);x<1244;x+=120)this.line(x,y,x,y+56,'#ad957d',2);}
  this.rect(420,88,440,242,3,'#71848a','#8e7e6d',9);c.fillStyle='#acc5c8';c.fillRect(432,100,416,218);this.poly([[432,290],[510,232],[587,276],[689,218],[848,280],[848,318],[432,318]],'#839f91');this.circle(767,160,29,'#e9d19c');
  for(let y=92;y<180;y+=19)this.rect(416,y,448,16,1,'#a5aca1','#737f7c',1);this.rect(91,373,131,142,3,'#a36e54','#816453',3);for(let y=399;y<510;y+=33){this.line(96,y,217,y,'#734f42',2);this.rect(139,y+7,30,4,1,'#e0c899');}
  this.line(80,62,80,628,'#7b6c59',16);this.line(1200,62,1200,628,'#7b6c59',16);
 }else if(theme===2){
  for(let x=36;x<1244;x+=120){c.fillStyle=(x/120|0)%2?'#edd9b9':'#d4a995';c.fillRect(x,66,60,580);}this.poly([[36,66],[1244,66],[1244,167],[36,106]],'#94565b');
  for(let x=70;x<1230;x+=65){this.circle(x,88,7,'#f1d795','#ae7856',2);}
  this.line(105,204,445,232,'#ae8370',2);for(let i=0;i<7;i++){const x=120+i*43;this.poly([[x,206+i*3.5],[x+32,208+i*3.5],[x+14,235+i*3.5]],['#739997','#d09c59','#b37068'][i%3]);}
  this.rect(96,363,137,161,5,'#b68466','#896457',3);for(let i=0;i<3;i++){this.circle(130+i*36,416,15,['#ddbd74','#78a8a2','#b2859c'][i],'#79594d',2);this.line(130+i*36,431,128+i*36,470,'#e9d4a8',1.5);}
  this.text('BONK!',166,499,19,'#f4ddb2','900','center');
 }else if(theme===3){
  for(let y=68;y<646;y+=94)for(let x=36;x<1244;x+=121){this.rect(x+2,y+2,116,89,14,'#c8d6c9','#a4b9ae',2);this.line(x+16,y+6,x+100,y+6,'#e0e9d8',2);this.circle(x+60,y+44,3,'#9eafa4');}
  this.rect(814,167,82,85,10,'#acc3ba','#92aaa4',3);this.text('+',855,225,40,'#e8e6ce','900','center');
 }else if(theme===4){
  c.fillStyle='#c5a18a';c.fillRect(36,66,1208,570);
  for(let y=82;y<410;y+=34){this.line(36,y,1244,y,'#b48e77',1.5);for(let x=36+(y%68?52:0);x<1244;x+=104)this.line(x,y,x,y+34,'#b48e77',1.5);}
  this.rect(36,420,1208,212,0,'#6b8e8c');this.line(36,419,1244,419,'#e5cca1',10);
  this.rect(397,86,450,181,1,'#e2ded0','#816f60',8);for(let x=398;x<847;x+=75)this.line(x,90,x,267,'#a4b4ad',5);this.line(400,178,845,178,'#a4b4ad',5);
  for(let i=0;i<4;i++){this.line(101+i*31,450,101+i*31,598,'#d6b083',7);}for(let y=462;y<590;y+=29)this.line(93,y,204,y,'#dbc198',7);
 }else{
  c.fillStyle='#4f697b';c.fillRect(36,66,1208,580);this.rect(315,98,636,285,30,'#83999e','#314759',8);this.rect(330,113,606,255,21,'#1d334a','#abc0ba',3);
  for(let i=0;i<62;i++){const x=347+(i*107)%570,y=124+(i*73)%225;this.circle(x,y,(i%4===0?2:1),'#d1dfdb');}
  this.circle(769,235,87,'#b4c5b6');this.circle(750,221,17,'#94aa9d');this.circle(805,258,24,'#94aa9d');this.circle(742,270,10,'#94aa9d');
  for(const x of [122,1129]){this.rect(x,430,50,179,5,'#7c959f','#395362',3);for(let y=454;y<579;y+=26){this.line(x+10,y,x+40,y,'#aec5c2',5);}}
  this.line(36,391,1244,391,'#77919e',3);
 }
 c.fillStyle=floor;c.fillRect(0,646,1280,74);this.rect(36,632,1208,14,0,theme===5?'#728c9c':'#d5b47a','#41555c',3);this.line(36,649,1244,649,INK,3);
 for(let x=40;x<1280;x+=118)this.line(x,652,x-30,730,theme===5?'#455f72':'#b39874',1.5);
 this.line(37,66,37,647,'#56666b',4);this.line(1243,66,1243,647,'#56666b',4);this.rect(34,51,1212,16,1,'#58686c',INK,2);
 this.line(515,67,515,100,'#65787e',3);this.line(759,67,759,100,'#65787e',3);this.rect(486,99,302,17,3,'#829b9d',INK,2);this.rect(497,114,280,9,2,'#f9ecc5','#9eac9f',2);
 if(theme===4){c.beginPath();c.ellipse(640,718,154,42,0,0,Math.PI*2);c.strokeStyle='#eed8ad';c.lineWidth=3;c.stroke();this.line(640,650,640,720,'#eed8ad',3);}
};
const priorProps=BuddyRenderer.prototype.extraProp;
BuddyRenderer.prototype.extraProp=function(n,t){
 if(n[6]<6)return priorProps.call(this,n,t);
 const c=this.ctx;c.save();c.translate(n[1],n[2]);c.rotate(n[7]||0);
 if(n[6]===6){
  this.line(-112,0,-12,0,INK,7);this.line(-111,-.6,-12,-.6,'#b98a58',4);this.line(-106,-1.5,-17,-1.5,'#e8c18a',1.5);
  this.poly([[-28,-8],[5,0],[-28,8],[-20,0]],'#b7d7d5',INK,2);this.line(-20,0,3,0,'#f1edd5',2);for(let i=0;i<5;i++)this.line(-40-i*3,-3,-41-i*3,3,'#744e3e',1.7);
 }else{for(let i=0;i<4;i++){c.rotate(Math.PI/2);this.poly([[0,-3],[17,-16],[9,4],[0,6]],'#b8ced0',INK,2);}this.circle(0,0,5,'#426473',INK,1.5);this.circle(0,0,2,'#e9dfb9');}
 c.restore();
};
BuddyRenderer.prototype.drawNewTool=function(tool,t=0,age=99,down=false){
 const c=this.ctx,metal='#809ba3',dark='#365260',wood='#bc8b59';
 if(tool==='spear'){this.extraProp([0,53,0,0,0,8,6,0],t);return;}
 if(tool==='shuriken'){this.extraProp([0,0,0,0,0,12,7,t*3],t);return;}
 if(tool==='pan'){this.line(24,0,67,0,INK,12);this.line(26,-1,65,-1,'#98705c',7);this.circle(0,0,30,'#475e67',INK,3);this.circle(0,0,23,'#697f86','#879b9a',2);c.beginPath();c.arc(0,0,18,3.5,5.15);c.strokeStyle='#a7bcb6';c.lineWidth=3;c.stroke();return;}
 if(tool==='water'){
  this.rect(-41,-16,27,28,10,'#a1dcd4',INK,3);this.rect(-17,-9,55,19,7,'#efa75b',INK,3);this.rect(-18,7,17,30,5,'#86becb',INK,2.5);this.rect(33,-12,11,23,2,'#d07858',INK,2.5);this.circle(-28,-4,7,'#d5f1dd');this.line(-10,-5,27,-5,'#fae4ad',3);return;
 }
 if(tool==='revolver'){
  this.poly([[-30,8],[-18,8],[-14,35],[-33,31]],wood,INK,3);this.rect(-25,-12,26,25,5,metal,INK,3);this.rect(-1,-11,54,12,2,metal,INK,3);this.line(3,-8,48,-8,'#cbe1d7',2);this.rect(-34,-4,12,8,2,wood,INK,2);this.circle(-9,0,12,'#526b77',INK,2);for(let i=0;i<6;i++)this.circle(-9+Math.cos(i*Math.PI/3+(age<.12?(1-age/.12)*Math.PI/3:0))*7,Math.sin(i*Math.PI/3+(age<.12?(1-age/.12)*Math.PI/3:0))*7,2.1,'#223845');this.rect(39,-16,7,5,1,INK);this.line(-23,19,-18,22,'#e4b67b',2);
 }else if(tool==='smg'){
  this.rect(-24,-13,58,24,3,'#5e7883',INK,3);this.rect(30,-6,22,11,2,metal,INK,2.5);this.poly([[-11,8],[5,8],[8,42],[-7,43]],'#3c4e5a',INK,3);this.rect(-28,7,13,24,2,wood,INK,2);this.line(-24,-10,25,-10,'#a8c2c4',2);for(let x=4;x<28;x+=7)this.line(x,-5,x,3,'#243d49',3);this.line(-42,-10,-42,18,metal,5);this.line(-43,-10,-24,-7,metal,5);
 }else if(tool==='burst'){
  this.poly([[-54,-8],[-29,-10],[-24,6],[-52,19]],'#797e55',INK,3);this.rect(-30,-15,58,27,4,'#8d956d',INK,3);this.rect(21,-10,33,17,2,'#607481',INK,2);this.line(52,-4,70,-4,metal,7);this.poly([[-11,10],[3,10],[10,32],[-2,35]],'#394f59',INK,2.5);this.rect(-26,10,12,25,3,wood,INK,2);this.rect(-9,-26,27,10,2,'#42626c',INK,2);this.circle(16,-21,5,'#9dccce',INK,2);
 }else if(tool==='double'){
  this.poly([[-60,-3],[-23,-10],[-13,10],[-57,23]],wood,INK,3);this.line(-51,6,-24,0,'#ebc18e',2);this.circle(-12,5,6,metal,INK,2);c.save();if(age>.29&&age<1.2)c.rotate(Math.sin((age-.29)/.91*Math.PI)*.5);this.rect(-15,-15,74,11,2,metal,INK,3);this.rect(-15,-2,74,11,2,'#587280',INK,3);this.rect(3,-8,24,21,4,'#9b6c4e',INK,2);this.line(-8,-11,53,-11,'#c9ddd6',2);c.restore();
 }else if(tool==='minigun'){
  this.rect(-44,-18,35,37,6,'#b78258',INK,3);this.rect(-18,-21,18,42,5,'#5b7480',INK,3);for(let i=0;i<3;i++){const yy=Math.sin(t*(down?25:3)+i*2.1)*10;this.rect(-1,yy-4,61,7,2,metal,INK,2);}this.rect(39,-20,11,40,2,'#536772',INK,2.5);this.rect(58,-17,9,34,3,'#4b6573',INK,3);this.rect(-40,16,15,25,3,'#486675',INK,2);this.circle(-30,0,9,'#edc16e',INK,2);this.line(-35,-13,-19,-13,'#edcc96',2);
 }else if(tool==='grenade'){
  this.poly([[-53,-2],[-22,-9],[-12,10],[-47,24]],wood,INK,3);this.rect(-19,-14,65,26,7,'#6c806c',INK,3);this.rect(39,-18,16,35,3,'#b4b7a2',INK,3);this.circle(48,0,10,'#314e58',INK,2);this.circle(-7,9,19,'#516877',INK,3);for(let i=0;i<5;i++)this.circle(-7+Math.cos(i*1.25)*12,9+Math.sin(i*1.25)*12,4,'#a7b5a5',INK,1.5);this.rect(-24,20,11,23,3,wood,INK,2);
 }
};
const fullOldCursor=BuddyRenderer.prototype.toolCursor;
BuddyRenderer.prototype.toolCursor=function(h,t,nowTime){
 const [id,name,color,x,y,down,g,tool,at=-10]=h,c=this.ctx;
 if(tool==='pan'){this.drawMallet(h,nowTime);return;}
 if(!NEW_TOOLS[tool])return fullOldCursor.call(this,h,t,nowTime);
 const ox=clamp(x-100,BB.LEFT+24,BB.RIGHT-24),oy=clamp(y+48,BB.TOP+26,BB.FLOOR-24),a=Math.atan2(y-oy,x-ox),age=nowTime-at;
 this.circle(x,y,tool==='double'?17:7,null,color,1.7);
 c.save();c.translate(ox,oy);c.rotate(a);
 const kick=age>=0&&age<.17?(1-age/.17)*(tool==='double'?15:tool==='revolver'?9:4):0;c.translate(-kick,0);
 if(tool==='spear'&&down){const start=this.charges?.get(id)||t;this.charges=this.charges||new Map();if(!this.charges.has(id))this.charges.set(id,t);const k=clamp(t-start,0,1);c.translate(-k*28,0);this.line(-60,25,-60+75*k,25,color,4);}else this.charges?.delete(id);
 this.drawNewTool(tool,t,age,down);if(tool!=='shuriken')this.gloveShape(tool==='spear'?-14:-28,14,color,true,.53);else this.gloveShape(-20,15,color,true,.7);
 c.restore();
};
const extendedEvent=BuddyRenderer.prototype.polishEvent;
BuddyRenderer.prototype.polishEvent=function(e){
 extendedEvent.call(this,e);
 if(e.type==='gunshot'){
  for(const end of e.ends)this.beams.push({type:'shot',x:e.x,y:e.y,tx:end[0],ty:end[1],hit:!!end[2],life:.065,max:.065});
  this.shells.push({x:e.x-34,y:e.y+15,vx:-90,vy:-130,a:0,life:.6});if(this.shells.length>16)this.shells.shift();
  if(e.hit&&this.motion)this.shake=Math.max(this.shake,e.tool==='double'?4:e.tool==='revolver'?1.8:.65);
  for(let i=0;i<3;i++)this.particle(e.x,e.y,'#f4c975',110,.13,'chip');
 }
 if(e.type==='throwHit')for(let i=0;i<5;i++)this.particle(e.x,e.y,'#e9c182',100,.24,'chip');
 if(e.type==='washPatch'&&e.epoch===this.blood.epoch){this.blood.marks=this.blood.marks.filter(m=>Math.hypot(m[1]-e.x,m[2]-e.y)>e.radius);this.blood.drops=this.blood.drops.filter(p=>Math.hypot(p.x-e.x,p.y-e.y)>e.radius);this.blood.repaint();}
};
const previousEmitters=BuddyRenderer.prototype.updateEmitters;
BuddyRenderer.prototype.updateEmitters=function(s,hands,dt,t){
 previousEmitters.call(this,s,hands,dt,t);
 for(const h of hands)if(h[5]&&h[7]==='water'){
  const x=clamp(h[3]-100,BB.LEFT+24,BB.RIGHT-24),y=clamp(h[4]+48,BB.TOP+26,BB.FLOOR-24),a=Math.atan2(h[4]-y,h[3]-x);
  const count=Math.min(4,Math.ceil(dt*70));for(let i=0;i<count&&this.particles.length<420;i++){const ang=a+(Math.random()-.5)*.11;this.particles.push({x:x+Math.cos(a)*45,y:y+Math.sin(a)*45,vx:Math.cos(ang)*650,vy:Math.sin(ang)*650,life:.35,max:.35,r:2.6,color:i%2?'#d9f4e3':'#85c4d4',kind:'chip',angle:ang});}
 }
};
// Distinct sprite silhouettes, reused by the catalogue and the currently-equipped control.
const moreArt={
 revolver:`<g transform="rotate(-20 32 32)"><path d="m13 32-5 25 15 2 5-23" fill="#b98453"/><path d="M9 18h24v24H9z" fill="#65818b"/><path d="M30 18h32v10H30z" fill="#99b6be"/><circle cx="25" cy="30" r="10" fill="#456271"/><circle cx="25" cy="30" r="4" fill="#a4bfc0"/><path d="M38 18v-6m-2 10h22" stroke="#d0e1d4"/></g>`,
 smg:`<g transform="rotate(-20 32 32)"><path d="M9 16h37v22H9z" fill="#728a96"/><path d="M44 21h17v10H44z" fill="#b5c7c4"/><path d="m25 36 4 27 14-2-4-25" fill="#455d69"/><path d="m10 34-4 21 11 2 5-21" fill="#ac885e"/><path d="M10 18 2 12v25l7-5m16-9h15m-15 6h15"/></g>`,
 burst:`<g transform="rotate(-18 32 32)"><path d="M1 26h17v17L1 48z" fill="#808365"/><path d="M16 20h31v21H16z" fill="#969d77"/><path d="M47 25h15v9H47z" fill="#738e95"/><path d="m24 40 6 18 13-4-8-15" fill="#435b68"/><path d="M25 11h20v9H25z" fill="#46636b"/><path d="m17 39-3 16 9 1 5-16" fill="#b58b5c"/></g>`,
 double:`<g transform="rotate(-22 32 32)"><path d="m2 37 20-8 11 15-27 16" fill="#b78958"/><path d="M24 20h39v9H24zm0 10h39v9H24z" fill="#8da9ae"/><path d="M38 25h14v21H38z" fill="#9b6b4b"/></g>`,
 minigun:`<g transform="rotate(-20 32 32)"><path d="M2 18h22v31H2z" fill="#b78c5b"/><path d="M22 16h13v34H22z" fill="#5a7680"/><path d="M34 20h27v7H34zm0 12h27v7H34zm0 12h27v7H34z" fill="#c0d3cc"/><path d="M49 16h9v40h-9z" fill="#80959b"/><circle cx="12" cy="33" r="5" fill="#edc976"/></g>`,
 grenade:`<g transform="rotate(-25 32 32)"><path d="M1 30h22v18L1 56z" fill="#b98a59"/><path d="M18 15h37v24H18z" fill="#8c997a"/><path d="M51 11h11v31H51z" fill="#c0c7b1"/><circle cx="32" cy="40" r="15" fill="#5e7881"/><circle cx="32" cy="40" r="7" fill="#a5b6ab"/></g>`,
 spear:`<path d="m8 59 40-43" stroke="#283e46" stroke-width="8"/><path d="m8 59 40-43" stroke="#c9945e" stroke-width="4"/><path d="m33 25 4-17 23-7-5 24-12 10 2-15z" fill="#b2d2cf"/><path d="m21 43 6 4m-2-8 6 4" stroke="#715044"/>`,
 shuriken:`<g transform="translate(32 32)"><path d="m0-8 24-19-9 25 15 19-27-8-21 20 7-28-20-20z" fill="#b2cbd0"/><circle r="8" fill="#4d7181"/><circle r="3" fill="#efe3b9"/></g>`,
 pan:`<path d="m38 37 22 25" stroke="#22313c" stroke-width="12"/><path d="m39 38 21 24" stroke="#a2795b" stroke-width="7"/><circle cx="24" cy="23" r="21" fill="#597782"/><circle cx="24" cy="23" r="15" fill="#87a1a4"/><path d="M12 24q0-13 13-13" stroke="#d5e3d4"/>`,
 water:`<path d="M7 20h14v20H7z" fill="#b4e5d3"/><path d="M16 28h39v13H16z" fill="#eeaf6a"/><path d="M50 24h11v18H50z" fill="#cd7c58"/><path d="m22 38-6 20 14 1 6-21" fill="#79bacb"/><circle cx="14" cy="18" r="12" fill="#b5e8de"/><path d="M9 14h7" stroke="#eef7db"/>`
};
Object.assign(TOOL_ART,moreArt);
