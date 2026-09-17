# Build-time surgery: a single catalogue replaces both equipment and shop screens.
html=html.replace('</style>',(ROOT/'catalogue.css').read_text()+'\n</style>',1)
i=html.index('<dialog id="shopDialog"');j=html.index('</dialog>',i)+len('</dialog>');html=html[:i]+(ROOT/'shop.html').read_text()+html[j:]
# Legacy actions stay hidden for scripted controls, no longer a user-facing landfill.
start=html.index('<div class="menu-actions">');end=html.index('</div>',start)+6
html=html[:start]+html[start:end].replace('<div class="menu-actions">','<div class="menu-actions" hidden>')+html[end:]
html=html.replace('<button id="postcardBtn">','<button id="customizeBtn">Hats, skins &amp; rooms</button><button id="postcardBtn">')
# Give actual labels to the permanent controls; tiny icon-only controls are not a feature.
# preserve attributes while replacing contents
html=re.sub(r'(<button id="settingsBtn"[^>]*>).*?</button>',r'\1Menu</button>',html,flags=re.S)
html=re.sub(r'(<button id="hideUIBtn"[^>]*>).*?</button>',r'\1Hide</button>',html,flags=re.S)
index=html.index('<button id="hideUIBtn"')
html=html[:index]+'<button id="quickSweepBtn" class="docksweep" title="Remove loose clutter, keep held toys and contraptions">Sweep</button><button id="sweepOptionsBtn" class="dockmore" title="More cleanup options">More</button>\n '+html[index:]
# Accessible room actions no longer buried with visual customization.
html=html.replace('<h3>Your settings</h3>','<div class="dialogbuttons"><button id="menuCleanBtn">Cleanup</button><button id="menuGravityBtn">Gravity</button></div><h3>Your settings</h3>')
# Same existing Tront credits, accurate feature count.
html=html.replace('Twenty-one tools','Thirty-one tools').replace('Twenty-one','Thirty-one').replace('twenty-one','thirty-one')
replace("$('settingsBtn').onclick=()=>showDialog('menuDialog');$('closeMenu').onclick=()=>$('menuDialog').close();", "$('settingsBtn').onclick=()=>showDialog('menuDialog');$('closeMenu').onclick=()=>$('menuDialog').close();\n$('menuCleanBtn').onclick=()=>{showDialog('sweepDialog');$('clearAllBtn').disabled=!isHost;};$('menuGravityBtn').onclick=()=>{command('gravity');$('menuGravityBtn').textContent=catWorld().low?'Gravity: low':'Gravity: normal';};")
# Rewrite entire workshop wiring, rather than layering another UI on top of the old one.
section('function openShop(){','function refreshBlood(){', '''function openShop(){openCatalogue({owned:false,fast:false,item:pendingEquip?'tool:'+pendingEquip:null});}
function updateWorkshop(s,force=false){
 if(!s)return;
 const own=s.h.find(h=>h[0]===myId);if(own&&local.style!==own[9]){local.style=own[9]||0;saveStore('buddybonk-hand',String(local.style));}
 if(pendingEquip&&(s.free||!!(s.unlock&(1<<TOOL_IDS.indexOf(pendingEquip))))){const id=pendingEquip;pendingEquip='';setTool(id);if($('shopDialog').open)$('shopDialog').close();}
 if(!s.free&&!(s.unlock&(1<<TOOL_IDS.indexOf(selectedTool)))&&!pendingEquip)setTool('grab');
 if($('shopDialog').open)renderCatalogue(force);
}
''')
# Above rewrite removes original savePostcard? It lives before old workshop? find and restore from baseline if needed.
if 'function savePostcard' not in js:
 i=(ROOT/'baseline.js').read_text().index('function savePostcard')
 old=(ROOT/'baseline.js').read_text();j=old.index('function refreshBlood',i)
 # old contains workshop code? use brace balanced extraction to only function and following onclick
 depth=0;at=old.index('{',i);end=None
 for k in range(at,len(old)):
  if old[k]=='{':depth+=1
  elif old[k]=='}':
   depth-=1
   if not depth:end=k+1;break
 replace('function refreshBlood',old[i:end]+"\n$('postcardBtn').onclick=savePostcard;\nfunction refreshBlood")
section('function toggleTools(){',"$('toolsBtn').onclick=toggleTools;",'''function toggleTools(){
 if($('shopDialog').open){$('shopDialog').close();return;}
 openCatalogue({owned:true,fast:true,tab:TOY_SET.has(selectedTool)?'toys':'weapons',item:'tool:'+selectedTool});$('toolsBtn').setAttribute('aria-expanded','true');
}
''')
# E toggles catalogue while modal open, without firing weapon keys behind it.
# World c initial definitions initialized before any synchronous updateUI() calls.
replace('const local={id:myId,',"const local={style:0,id:myId,")
# Store state may not exist while the original boot emits its first events. Define catalogue before network is constructed.
replace('/* Application / authority boundary.',(ROOT/'catalogue.js').read_text()+'\n/* Application / authority boundary.')
replace('requestAnimationFrame(frame);updateUI();','initCatalogue();requestAnimationFrame(frame);updateUI();')
# API debug additions for deterministic fixture state assertions.
replace('get ui(){return {quiet:uiQuiet,drawerOpen:!$(\'toolDrawer\').hidden,scale:uiFactor};}',"get ui(){return {quiet:uiQuiet,drawerOpen:$('shopDialog').open,catalogue:{...catState},scale:uiFactor};},") if False else None
replace("get ui(){return {quiet:uiQuiet,drawerOpen:!$('toolDrawer').hidden,scale:uiFactor};},", "get ui(){return {quiet:uiQuiet,drawerOpen:$('shopDialog').open,catalogue:{...catState},scale:uiFactor};},")
replace('setTool,command,disconnect:', 'setTool,command,catalogue:openCatalogue,disconnect:')
# Close a shop naturally upon equipping from keyboard/UI.
replace("closeTools();sendInput(true);setPointerHover(false);", "closeTools();if($('shopDialog').open)$('shopDialog').close();sendInput(true);setPointerHover(false);")

# E closes the same catalogue it opens; other weapon shortcuts remain blocked in dialogs.
replace("if(e.target.matches('input,textarea,select,[contenteditable=\"true\"]')||document.querySelector('dialog[open]'))return;", "if(e.target.matches('input,textarea,select,[contenteditable=\"true\"]'))return;\n if($('shopDialog').open&&e.key.toLowerCase()==='e'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();$('shopDialog').close();return;}\n if(document.querySelector('dialog[open]'))return;")
replace("['none','hard hat','crown','party'][s?.hat||0]", "(HATS[s?.hat||0]?.name||'none')")
