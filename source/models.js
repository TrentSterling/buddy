/* Toybox content is data. Existing tool indices NEVER move: workshop saves stay valid. */
const NEW_TOOLS={
 revolver:{name:'REVOLVER',key:'z',hint:'SIX HEAVY SHOTS · AUTOMATIC CYLINDER RELOAD',rate:.32,cost:45,deck:'guns'},
 smg:{name:'SMG',key:'s',hint:'HOLD FOR A QUICK MAGAZINE · AUTOMATIC RELOAD',rate:.075,cost:70,deck:'guns'},
 burst:{name:'BURST RIFLE',key:'i',hint:'THREE SHOTS PER TAP · KEEP HOLDING FOR MORE',rate:.48,cost:90,deck:'guns'},
 double:{name:'DOUBLE BARREL',key:'p',hint:'TWO BIG SHOTS · BREAK-OPEN RELOAD',rate:.24,cost:110,deck:'guns'},
 minigun:{name:'MINIGUN',key:'n',hint:'HOLD TO SPIN UP · SHORT MAGAZINE COOLDOWNS',rate:.055,cost:180,deck:'guns'},
 grenade:{name:'GRENADE LAUNCHER',key:';',hint:'BOUNCING GRENADES · GRAB THEM BEFORE THE FUSE ENDS',rate:.7,cost:125,deck:'guns'},
 spear:{name:'SPEAR',key:',',hint:'HOLD TO CHARGE · RELEASE TO THROW · TWO PER PLAYER, OLDEST RECYCLES',rate:.25,deck:'guns',charge:true},
 shuriken:{name:'SHURIKEN',key:'y',hint:'HOLD TO THROW · THREE RICOCHETS · OLD STARS RECYCLE',rate:.17,cost:55,deck:'guns'},
 pan:{name:'FRYING PAN',key:'.',hint:'HOLD TO SWING · THE PAN FACE DOES THE BONKING',rate:.46,deck:'guns'},
 water:{name:'WATER PISTOL',key:']',hint:'HOLD TO EXTINGUISH, WASH STAINS AND PUSH CANDY',rate:.095,deck:'lab'}
};
const SKINS=[
 {name:'Stitched original',cost:0,colors:['#efc779','#d7a758','#f3dfad','#ed7859'],kind:'cloth'},
 {name:'Crash-test dummy',cost:0,colors:['#edae49','#ce8935','#ffce6d','#363e48'],kind:'dummy'},
 {name:'Tin robot',cost:80,colors:['#a7c4ca','#668b98','#d4e4df','#d67854'],kind:'robot'},
 {name:'Patchwork zombie',cost:90,colors:['#abc38a','#708b66','#d4d6aa','#b67a96'],kind:'zombie'},
 {name:'Cartoon skeleton',cost:100,colors:['#ddd9c3','#91998e','#f8eed2','#5a6674'],kind:'skeleton'},
 {name:'Office dummy',cost:80,colors:['#e6e5d3','#b8c5bd','#efdcaf','#5f7890'],kind:'office'}
];
const HATS=[
 {name:'No hat',cost:0},{name:'Hard hat',cost:0},{name:'Crown',cost:0},{name:'Party hat',cost:0},
 {name:'Top hat',cost:45},{name:'Cowboy',cost:55},{name:'Wizard',cost:75},{name:'Chef',cost:50},
 {name:'Propeller beanie',cost:60},{name:'Pirate',cost:70},{name:'Traffic cone',cost:35},
 {name:'Headphones',cost:50},{name:'Fish hat',cost:85},{name:'Viking',cost:80}
];
const HANDS=[
 {name:'Classic glove',cost:0},{name:'Boxing glove',cost:0},{name:'Robot hand',cost:55},
 {name:'Skeleton hand',cost:60},{name:'Oven mitt',cost:35},{name:'Foam finger',cost:50}
];
const ROOMS=[
 {name:'Workshop',cost:0,info:'The original test chamber.'},
 {name:'Garage',cost:0,info:'Warm brick, painted beams and an open garage door.'},
 {name:'Carnival',cost:100,info:'Striped canvas, carnival bulbs and questionable prizes.'},
 {name:'Padded room',cost:75,info:'Quilted walls. Definitely a responsible facility.'},
 {name:'Gym',cost:80,info:'Brick walls, court markings and after-school chaos.'},
 {name:'Moon lab',cost:120,info:'A lunar window. Gravity changes only when you choose it.'}
];
// 32 cosmetic entries; unsigned masks are isolated from the tool mask.
const LOOKS={body:SKINS,hat:HATS,hand:HANDS,room:ROOMS},LOOK_OFFSET={body:0,hat:6,hand:20,room:26};
const LOOK_BIT=(type,i)=>(2**(LOOK_OFFSET[type]+i))>>>0;
let FREE_LOOKS=0;for(const [type,items] of Object.entries(LOOKS))items.forEach((v,i)=>{if(!v.cost)FREE_LOOKS=(FREE_LOOKS|LOOK_BIT(type,i))>>>0;});
const ownsLook=(s,type,i)=>!!s.free||!!((s.looks??FREE_LOOKS)&LOOK_BIT(type,i));
const GUNS={
 revolver:{muzzle:55,mag:6,reload:1.12,rate:.32,pellets:1,spread:.008,power:740,hurt:.85},
 smg:{muzzle:54,mag:24,reload:1.04,rate:.075,pellets:1,spread:.07,power:210,hurt:.27},
 burst:{muzzle:72,mag:18,reload:1.08,rate:.48,pellets:1,spread:.022,power:340,hurt:.38},
 double:{muzzle:61,mag:2,reload:1.24,rate:.24,pellets:9,spread:.18,power:150,hurt:.14},
 minigun:{muzzle:70,mag:45,reload:.86,rate:.055,pellets:1,spread:.055,power:200,hurt:.24},
 grenade:{mag:4,reload:1.22,rate:.7,pellets:0},
};
const TOY_SET=new Set(['grab','magnet','ball','balloon','spring','air','duck','bowling','tether','bumper','water']);
const MELEE=new Set(['poke','pan']);
const ONE_SHOT=new Set(['grab','balloon','ball','bomb','spring','duck','bowling','tether','bumper','spear']);
