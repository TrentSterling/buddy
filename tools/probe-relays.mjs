// Subscribe-latency probe over Trystero's default relay list plus extras. Usage: node tools/probe-relays.mjs relays.txt
// A relay that answers here can still reject publishes; confirm the final pick in-game with warnOnRelayFailure on.
import fs from 'node:fs';
const defaults=fs.readFileSync(process.argv[2],'utf8').split('\n').map(s=>s.trim()).filter(Boolean);
const extras=['relay.damus.io','relay.nostr.band','relay.primal.net','nostr.wine','relay.snort.social','purplepag.es','nostr.mom','relay.nostr.bg','nostr.oxtr.dev','relay.nostr.wirednet.jp','nostr.bitcoiner.social','relay.nostrplebs.com'];
const urls=[...new Set([...defaults,...extras])];
const probe=url=>new Promise(res=>{
  const t0=Date.now();let out={url,connect:null,eose:null,auth:false,notice:null,err:null};
  const timer=setTimeout(()=>{out.err=out.err||'timeout';try{ws.close()}catch{};res(out)},6000);
  let ws;try{ws=new WebSocket('wss://'+url);}catch(e){out.err=String(e);clearTimeout(timer);return res(out);}
  ws.onopen=()=>{out.connect=Date.now()-t0;ws.send(JSON.stringify(['REQ','probe',{kinds:[29333],limit:1}]));};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}
    if(m[0]==='EOSE'){out.eose=Date.now()-t0;clearTimeout(timer);ws.close();res(out);}
    if(m[0]==='AUTH')out.auth=true;
    if(m[0]==='NOTICE')out.notice=String(m[1]).slice(0,60);
    if(m[0]==='CLOSED'){out.err='closed: '+String(m[2]).slice(0,60);clearTimeout(timer);ws.close();res(out);}};
  ws.onerror=e=>{out.err=out.err||'socket error';};
  ws.onclose=()=>{if(out.eose===null){out.err=out.err||'closed early';clearTimeout(timer);res(out);}};
});
const results=await Promise.all(urls.map(probe));
results.sort((a,b)=>(a.eose??9e9)-(b.eose??9e9));
for(const r of results)console.log((r.eose!==null&&!r.auth?'OK  ':'BAD ')+r.url.padEnd(34),'connect',String(r.connect??'-').padStart(5),'eose',String(r.eose??'-').padStart(5),r.auth?'AUTH':'',r.notice||'',r.err||'');
console.log('healthy:',results.filter(r=>r.eose!==null&&!r.auth).length,'of',results.length);
