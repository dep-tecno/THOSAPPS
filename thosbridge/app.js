import {levels as originalLevels} from './levels.js?v=20261009-visual-v19';
import {family as noBadisFamily,levels as noBadisLevels} from './families/no-badis.js?v=20261009-visual-v19';
import {RULES,copy,terrainAt,emptyBridge,cost,addBeam,planDeckSpan,addDeckSpan,removeBeam,makeDeck,demo,validateBridge,Simulation,assessBridge,stressHeatColor,didacticIndicators,connectionPreview} from './core.js?v=20261009-visual-v19';
import {mountCards} from './cards.js?v=20261009-visual-v19';
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d');
const cards=mountCards(canvas.parentElement);
const STORAGE='thosbridge:projects:v1',fmt=n=>new Intl.NumberFormat('ca-ES',{maximumFractionDigits:1}).format(n);
const levels=[...originalLevels,...noBadisLevels],packNames={old:'No miris',new:'No cau',[noBadisFamily.id]:noBadisFamily.name};
let saved={version:1,selectedLevel:'new-01',drafts:{},completed:{}},storageOK=true;
try {const raw=localStorage.getItem(STORAGE);if(raw){const s=JSON.parse(raw);if(s.version===1&&s.drafts&&typeof s.drafts==='object')saved={...saved,...s,completed:s.completed||{}};}}
catch{storageOK=false;}
let level=levels.find(l=>l.id===saved.selectedLevel)||levels[15],bridge=emptyBridge(level);
let undo=[],redo=[],tool='bar',start=null,hover=null,selected=null,simulation=null,paused=false,stress=true;
let view={x:0,y:0,scale:30},width=1,height=1,pointer=null,lastFrame=0,accumulator=0;
let statsSimulation=null;
let hoveredCritical=null,focusedCritical=null;
const criticalRows=new Map();
function status(text){$('status').textContent=text;}
function persist(){
  saved.selectedLevel=level.id;saved.drafts[level.id]=copy(bridge);
  try{localStorage.setItem(STORAGE,JSON.stringify(saved));storageOK=true;}catch{storageOK=false;}
  $('storageStatus').textContent=storageOK?'Els ponts i el progrés es desen en aquest navegador.':'El navegador no permet desar automàticament. Descarrega el teu pont amb ↓.';
}
function restore(){try{if(saved.drafts[level.id])bridge=validateBridge(saved.drafts[level.id],level);}catch{bridge=emptyBridge(level);status('No s’ha pogut recuperar el pont d’aquest nivell. Pots obrir-ne un JSON.');}}
function editMode(){simulation=null;paused=false;accumulator=0;start=null;selected=null;$('result').hidden=true;updateStats();update();}
function mutate(fn,message){if(simulation)return;const previous=copy(bridge);const result=fn();if(result){status(result);return false;}undo.push(previous);if(undo.length>80)undo.shift();redo=[];selected=null;persist();update();if(message)status(message);return true;}
function selectTool(next){tool=next;start=null;selected=null;canvas.style.cursor=next==='select'?'default':'crosshair';update();}
function populateLevels(){
  $('pack').value=level.pack;$('level').replaceChildren();
  for(const l of levels.filter(l=>l.pack===level.pack)){
    const o=document.createElement('option');o.value=l.id;o.textContent=(saved.completed[l.id]?'✓ ':'')+'Nivell '+l.number;$('level').append(o);
  }
  $('level').value=level.id;
}
function changeLevel(id){persist();level=levels.find(l=>l.id===id)||level;bridge=emptyBridge(level);restore();undo=[];redo=[];editMode();populateLevels();fit();persist();status('Nivell '+level.number+' del paquet '+packNames[level.pack]+'.');}
function update(){
  const c=cost(bridge),running=!!simulation;
  $('levelTitle').textContent=packNames[level.pack]+' / '+String(level.number).padStart(2,'0')+' · '+(saved.completed[level.id]?'Superat':'Construcció de ponts');
  $('mode').textContent=running?(paused?'EN PAUSA':simulation.status==='running'?(simulation.mode==='stress'?'TEST D’ESFORÇOS':'PROVA DEL TREN'):simulation.status==='collapsing'?'COL·LAPSE DEL PONT':simulation.status==='assessed'?'ANÀLISI PRÈVIA':'RESULTAT'):'CONSTRUCCIÓ';
  $('budget').textContent=fmt(c)+' / '+fmt(level.budget);$('budgetBar').style.width=(c/level.budget*100)+'%';
  $('budgetBar').style.background=c===level.budget?'#f4c25c':'#24c0c4';
  $('remaining').textContent='Queden '+fmt(level.budget-c)+' · 100 per tram';$('beamCount').textContent=bridge.beams.length;$('span').textContent=fmt(level.right-level.left)+' u';
  $('demo').hidden=level.number!==1||!['old','new'].includes(level.pack);
  $('levelOrigin').textContent=level.source.author?'Nivell '+level.number+' de '+packNames[level.pack]+' · Original '+level.source.originalLevel+' · Autor: '+level.source.author+' · Conversió al format BBG: '+level.source.convertedBy+'.':'Nivells originals de Bridge Building Game · Alex Austin / Cryptic Sea.';
  for(const b of document.querySelectorAll('[data-tool]')){b.setAttribute('aria-pressed',String(b.dataset.tool===tool));b.disabled=running;}
  $('undo').disabled=running||!undo.length;$('redo').disabled=running||!redo.length;
  for(const id of ['autoDeck','clear','demo','open','weight'])$(id).disabled=running;
  $('run').disabled=running&&!(simulation.mode==='stress'&&simulation.status==='assessed');$('stressTest').disabled=running;$('edit').disabled=!running;$('pause').disabled=!running||!simulation.active;
  $('pause').textContent=paused?'▶':'Ⅱ';$('pause').title=paused?'Continua la prova':'Pausa la prova';$('pause').setAttribute('aria-label',$('pause').title);
  $('stress').setAttribute('aria-pressed',String(stress));
  const e=bridge.beams.find(e=>e.id===selected);$('selection').hidden=!e||running;
  if(e){const a=bridge.nodes.find(n=>n.id===e.a),b=bridge.nodes.find(n=>n.id===e.b);$('selectionInfo').textContent=(e.type==='deck'?'Tauler':'Barra')+' · '+fmt(Math.hypot(a.x-b.x,a.y-b.y))+' u · 100';}
  $('hint').textContent=running?'Observa el pont. Prem Editar per recuperar el disseny.':start?'Escull el segon punt · Esc per cancel·lar.':tool==='erase'?'Clica un tram per esborrar-lo.':tool==='select'?'Clica un tram per veure’n el tipus o esborrar-lo.':tool==='deck'?'Uneix les ribes: el tauler es divideix en trams vàlids · Alt + arrossegar per moure la vista.':'Clica un punt i després un altre · màxim 4,5 u per barra · Alt + arrossegar per moure la vista.';
  cards.refresh();
}
function fit(){
  const points=[...level.anchors,...bridge.nodes,{x:level.left-5,y:2},{x:level.right+5,y:2},{x:0,y:Math.max(level.water,-18)}];
  const minX=Math.min(...points.map(p=>p.x))-2,maxX=Math.max(...points.map(p=>p.x))+2;
  const minY=Math.min(...points.map(p=>p.y))-3,maxY=Math.max(...points.map(p=>p.y))+6;
  view={x:(minX+maxX)/2,y:(minY+maxY)/2,scale:Math.max(4,Math.min(width/(maxX-minX),Math.max(50,height-110)/(maxY-minY)))};
}
function screen(p){return {x:(p.x-view.x)*view.scale+width/2,y:height/2-(p.y-view.y)*view.scale};}
function world(x,y){return {x:view.x+(x-width/2)/view.scale,y:view.y-(y-height/2)/view.scale};}
function pointerPosition(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function snap(p){
  const near=bridge.nodes.find(n=>Math.hypot(n.x-p.x,n.y-p.y)*view.scale<11);
  return near?{x:near.x,y:near.y}:{x:Math.round(p.x),y:Math.round(p.y)};
}
function hitBeam(p){
  let found=null,best=10/view.scale;
  for(const e of bridge.beams){const a=bridge.nodes.find(n=>n.id===e.a),b=bridge.nodes.find(n=>n.id===e.b),dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
    const d=Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);if(d<best){best=d;found=e;}
  }return found;
}
function createSegment(end,type=tool){
  if(!start)return;const a=start;start=null;
  if(Math.hypot(a.x-end.x,a.y-end.y)<.1){update();return;}
  if(type==='deck'){
    let result;
    const ok=mutate(()=>{result=addDeckSpan(bridge,a,end,level);if(result.error)return result.error;bridge=result.bridge;});
    if(ok)status(result.added?'Tauler creat: '+result.added+' trams · cost '+fmt(result.added*RULES.beamCost)+(result.converted?' · '+result.converted+' barres convertides a tauler.':'.'):result.converted?result.converted+' barres convertides a tauler.':'Aquests trams ja són tauler.');
  }else{const before=cost(bridge),ok=mutate(()=>addBeam(bridge,a,end,type,level));if(ok)status('Barra afegida'+(cost(bridge)-before>RULES.beamCost?' amb unions als trams existents':'')+' · cost '+fmt(cost(bridge)-before)+'.');}
  update();
}
canvas.addEventListener('pointerdown',e=>{
  canvas.focus();const p=pointerPosition(e);pointer={...p,view:{...view},pan:e.button===1||e.altKey,dragStart:false};
  if(pointer.pan){canvas.setPointerCapture(e.pointerId);e.preventDefault();return;}
  if(e.button!==0||simulation)return;
  const w=world(p.x,p.y),beam=hitBeam(w);
  if(tool==='erase'){if(beam)mutate(()=>removeBeam(bridge,beam.id),'Tram esborrat.');return;}
  if(tool==='select'){selected=beam?.id||null;update();return;}
  if(start){createSegment(snap(w),e.shiftKey?'deck':tool);pointer.dragStart=false;}
  else{start=snap(w);pointer.dragStart=true;canvas.setPointerCapture(e.pointerId);update();}
});
canvas.addEventListener('pointermove',e=>{
  const p=pointerPosition(e);
  if(pointer?.pan){view.x=pointer.view.x-(p.x-pointer.x)/view.scale;view.y=pointer.view.y+(p.y-pointer.y)/view.scale;return;}
  hover=snap(world(p.x,p.y));$('coords').textContent='x '+fmt(hover.x)+' · y '+fmt(hover.y);
});
canvas.addEventListener('pointerup',e=>{
  const p=pointerPosition(e);
  if(pointer?.dragStart&&Math.hypot(p.x-pointer.x,p.y-pointer.y)>8&&!simulation)createSegment(snap(world(p.x,p.y)),e.shiftKey?'deck':tool);
  pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel',()=>{pointer=null;start=null;update();});
canvas.addEventListener('pointerleave',()=>{if(!pointer)hover=null;});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();if(simulation)return;start=null;const p=pointerPosition(e),b=hitBeam(world(p.x,p.y));if(b)mutate(()=>removeBeam(bridge,b.id),'Tram esborrat.');else update();});
canvas.addEventListener('wheel',e=>{e.preventDefault();const p=pointerPosition(e),before=world(p.x,p.y);view.scale=Math.max(4,Math.min(150,view.scale*Math.exp(-e.deltaY*.001)));const after=world(p.x,p.y);view.x+=before.x-after.x;view.y+=before.y-after.y;},{passive:false});
function deleteSelection(){if(selected&&!simulation)mutate(()=>removeBeam(bridge,selected),'Tram esborrat.');}
function undoAction(){if(simulation||!undo.length)return;redo.push(copy(bridge));bridge=undo.pop();start=null;selected=null;persist();update();status('Canvi desfet.');}
function redoAction(){if(simulation||!redo.length)return;undo.push(copy(bridge));bridge=redo.pop();start=null;selected=null;persist();update();status('Canvi refet.');}
function beginTest(mode){start=null;selected=null;persist();simulation=mode==='stress'?assessBridge(level,bridge,Number($('weight').value)):new Simulation(level,bridge,Number($('weight').value));paused=false;accumulator=0;$('result').hidden=true;if(mode==='stress'){stress=true;showCards(true);}updateStats();update();if(!simulation.active)finish();else status('Prova en marxa: pes propi i pas del tren.');}
function run(){beginTest('train');}
function stressRun(){beginTest('stress');}
function criticalBeams(){return simulation?simulation.beams.filter(e=>Math.abs(e.peakStress)>.01).sort((a,b)=>Math.abs(b.peakStress)-Math.abs(a.peakStress)).slice(0,5):[];}
function updateStats(){
  $('testStage').textContent=!simulation?'Construeix → Test d’esforços → Tren':simulation.mode==='train'?'Càrrega mòbil: tren':!simulation.beams.some(e=>e.type==='deck')?'Mapa del pes propi: sense tauler per carregar':'Mapa sota càrrega repartida · pes '+fmt(simulation.weight*100)+'%';
  $('simStats').textContent=!simulation?'Primer construeix el tauler i reforça’l amb triangles.':simulation.mode==='stress'?'Esforç màxim '+fmt(simulation.peak*100)+'%'+(simulation.analysisWarning?' · Avís amb càrrega al '+fmt(simulation.loadFactor*100)+'% · Cal reforçar':' · Observa els colors del pont'):'Temps '+fmt(simulation.time)+' s · Esforç màxim '+fmt(simulation.peak*100)+'% · Trencaments '+simulation.broken;
  const tension=simulation?.beams.reduce((best,e)=>e.peakTension>(best?.peakTension||0)?e:best,null),value=tension?.peakTension||0;
  const tensionText=!simulation?'Tracció màxima · pendent de prova':!tension?'Tracció màxima · 0% · no detectada':'Tracció màxima · '+fmt(value*100)+'% · Tram '+(Number(tension.id.slice(1))+1);
  $('tensionLabel').textContent=tensionText;
  $('tensionFill').style.width=Math.min(100,value*100)+'%';
  $('tensionMeter').setAttribute('aria-valuenow',String(Math.round(Math.min(100,value*100))));
  $('tensionMeter').setAttribute('aria-valuetext',tensionText);
  const list=$('critical'),beams=criticalBeams();
  if(statsSimulation!==simulation){statsSimulation=simulation;hoveredCritical=null;focusedCritical=null;criticalRows.clear();list.replaceChildren();}
  if(!beams.length){if(!list.querySelector('[data-empty]')){list.replaceChildren();const li=document.createElement('li');li.dataset.empty='true';li.textContent='Es mostraran durant la prova.';list.append(li);}return;}
  list.querySelector('[data-empty]')?.remove();
  for(const [index,e] of beams.entries()){
    let row=criticalRows.get(e.id);
    if(!row){const li=document.createElement('li'),label=document.createElement('button'),meter=document.createElement('div'),fill=document.createElement('i');label.type='button';label.className='critical-link';label.title='Ressalta aquest tram al pont';li.addEventListener('pointerenter',()=>{hoveredCritical=e.id;});li.addEventListener('pointerleave',()=>{if(hoveredCritical===e.id)hoveredCritical=null;});label.addEventListener('focus',()=>{focusedCritical=e.id;});label.addEventListener('blur',()=>{if(focusedCritical===e.id)focusedCritical=null;});meter.className='critical-meter';meter.setAttribute('role','progressbar');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');fill.className='critical-fill';meter.append(fill);li.append(label,meter);row={li,label,meter,fill};criticalRows.set(e.id,row);}
    const value=Math.abs(e.peakStress),percent=Math.min(100,value*100),name='Tram '+(Number(e.id.slice(1))+1),text=name+' · '+(e.peakStress>0?'tracció':'compressió')+' · '+fmt(value*100)+'%'+(e.broken?(simulation.mode==='stress'?' · límit superat':' · trencat'):'');
    row.label.textContent=text;row.meter.setAttribute('aria-label',name+' · esforç respecte del límit');row.meter.setAttribute('aria-valuenow',String(Math.round(percent)));row.meter.setAttribute('aria-valuetext',text);row.fill.style.width=percent+'%';row.fill.style.backgroundColor=stressHeatColor(value);
    if(list.children[index]!==row.li)list.insertBefore(row.li,list.children[index]||null);
  }
  for(const [id,row] of criticalRows)if(!beams.some(e=>e.id===id)){row.li.remove();criticalRows.delete(id);if(hoveredCritical===id)hoveredCritical=null;if(focusedCritical===id)focusedCritical=null;}
}
function finish(){
  const passed=simulation.status==='passed',assessed=simulation.status==='assessed';$('result').hidden=false;$('result').classList.toggle('passed',passed);$('result').classList.toggle('failed',!passed&&!assessed);
  $('resultTitle').textContent=passed?'✓ Pont superat!':assessed?(simulation.analysisWarning?'Mapa: cal reforçar el pont':'Mapa d’esforços'):simulation.failureKind==='route'?'Falta completar el tauler':'El pont necessita reforços';
  $('resultRun').hidden=!assessed;
  const light=passed&&simulation.weight<1;
  $('resultText').textContent=simulation.reason+(light?' Prova també amb el pes del 100% per marcar aquest nivell com a superat.':'')+(passed&&simulation.broken?' Hi ha '+simulation.broken+' trams trencats: pots millorar el disseny.':'');
  const nextLevel=levels.find(l=>l.pack===level.pack&&l.number===level.number+1);
  $('next').hidden=!passed||light||!nextLevel;
  if(passed&&!light){saved.completed[level.id]=true;persist();populateLevels();}
  updateStats();update();status(simulation.reason);
}
function togglePause(){if(simulation?.active){paused=!paused;accumulator=0;update();}}
for(const b of document.querySelectorAll('[data-tool]'))b.addEventListener('click',()=>selectTool(b.dataset.tool));
$('undo').onclick=undoAction;$('redo').onclick=redoAction;$('deleteSelected').onclick=deleteSelection;
$('changeType').onclick=()=>mutate(()=>{const e=bridge.beams.find(e=>e.id===selected);if(e)e.type=e.type==='bar'?'deck':'bar';},'Tipus de tram canviat.');
$('run').onclick=run;$('pause').onclick=togglePause;$('edit').onclick=editMode;$('resultEdit').onclick=editMode;
$('stressTest').onclick=stressRun;$('resultRun').onclick=run;
$('next').onclick=()=>{const next=levels.find(l=>l.pack===level.pack&&l.number===level.number+1);if(next)changeLevel(next.id);};
$('stress').onclick=()=>{stress=!stress;update();};
$('autoDeck').onclick=()=>mutate(()=>{const result=makeDeck(level,bridge);if(result.error)return result.error;bridge=result.bridge;},'Tauler horitzontal construït. Afegeix-hi reforços.');
$('demo').onclick=()=>{mutate(()=>{bridge=demo(level);},'Exemple triangular carregat. Prem ▶ Tren.');fit();};
$('clear').onclick=()=>mutate(()=>{bridge=emptyBridge(level);start=null;},'Pont buidat. Pots recuperar-lo amb Desfés.');
$('pack').onchange=()=>changeLevel(levels.find(l=>l.pack===$('pack').value).id);
$('level').onchange=()=>changeLevel($('level').value);
$('zoomIn').onclick=()=>{view.scale=Math.min(150,view.scale*1.25);};$('zoomOut').onclick=()=>{view.scale=Math.max(4,view.scale/1.25);};$('fit').onclick=fit;
function showCards(show){for(const card of document.querySelectorAll('[data-info]'))card.hidden=!show;$('cardsToggle').setAttribute('aria-pressed',String(show));cards.refresh();}
$('cardsToggle').onclick=()=>showCards($('cardsToggle').getAttribute('aria-pressed')!=='true');
$('resetCards').onclick=()=>{showCards(true);cards.reset();status('Targetes recol·locades.');};
$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
$('trainSettings').onclick=()=>$('trainDialog').showModal();$('closeTrainSettings').onclick=()=>$('trainDialog').close();
$('save').onclick=()=>{
  const payload={app:'THOSBRIDGE',version:1,levelId:level.id,bridge:copy(bridge)};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='thosbridge-'+level.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('Pont descarregat en JSON.');
};
$('open').onclick=()=>$('file').click();
$('file').onchange=async()=>{
  const file=$('file').files[0];$('file').value='';if(!file)return;
  try{if(file.size>2_000_000)throw Error('El fitxer és massa gran.');const p=JSON.parse(await file.text());
    if(p.app!=='THOSBRIDGE'||p.version!==1)throw Error('Aquest fitxer no és un pont THOSBRIDGE compatible.');
    const target=levels.find(l=>l.id===p.levelId);if(!target)throw Error('Nivell desconegut.');
    const imported=validateBridge(p.bridge,target);if(target.id!==level.id)changeLevel(target.id);
    mutate(()=>{bridge=imported;},'Pont obert correctament.');fit();
  }catch(e){status('No s’ha obert el pont: '+e.message);}
};
document.addEventListener('keydown',e=>{
  if(e.target.closest?.('input,select,textarea,[contenteditable=true]')||$('helpDialog').open||$('trainDialog').open)return;
  if(e.key===' '&&e.target.closest?.('button'))return;
  if(e.ctrlKey||e.metaKey){if(e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redoAction():undoAction();}else if(e.key.toLowerCase()==='y'){e.preventDefault();redoAction();}return;}
  if(e.key===' '){e.preventDefault();simulation?.active?togglePause():!simulation||simulation.status==='assessed'?run():null;return;}
  if(e.key.toLowerCase()==='s'&&!simulation){e.preventDefault();stressRun();return;}
  if(simulation)return;
  if(e.key==='Escape'){start=null;selected=null;update();}
  if(e.key==='Delete'||e.key==='Backspace'){if(selected){e.preventDefault();deleteSelection();}}
  const mapping={b:'bar',t:'deck',v:'select',e:'erase'};if(mapping[e.key.toLowerCase()])selectTool(mapping[e.key.toLowerCase()]);
},true);
function line(a,b,color,widthPx=2,dashed=false){const p=screen(a),q=screen(b);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=color;ctx.lineWidth=widthPx;ctx.setLineDash(dashed?[5,5]:[]);ctx.stroke();ctx.setLineDash([]);}
function drawTrainCar(p,size,index,angle,rotation){
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.scale(size,size);
  ctx.lineWidth=1.2/size;ctx.strokeStyle='#07111c';
  const box=(x,y,w,h,color,r=.04)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();ctx.stroke();};
  const body=ctx.createLinearGradient(0,-1,0,-.25);
  body.addColorStop(0,index===0?'#ffd67c':'#9ac8d7');body.addColorStop(1,index===0?'#c98229':'#365e79');
  if(index===0){
    // Steam locomotive: rear cab, boiler, chimney, headlamp and front buffer.
    box(-.52,-1.03,.4,.72,'#224658');box(-.46,-.94,.26,.27,'#a7e6ed');
    ctx.fillStyle='#f1d68d';ctx.fillRect(-.45,-.64,.22,.035);
    box(-.58,-1.1,.51,.1,'#21303c');
    box(-.13,-.72,.59,.4,body,.12);box(-.05,-.79,.13,.12,'#d3a955');
    ctx.strokeStyle='#ffe3a4';ctx.lineWidth=.8/size;ctx.beginPath();ctx.moveTo(.07,-.69);ctx.lineTo(.07,-.35);ctx.moveTo(.29,-.69);ctx.lineTo(.29,-.35);ctx.stroke();ctx.strokeStyle='#07111c';ctx.lineWidth=1.2/size;
    box(.26,-.98,.11,.28,'#253844');box(.23,-1.02,.17,.07,'#14252e');
    box(.44,-.67,.06,.3,'#263e4a');
    ctx.fillStyle='#fff4ba';ctx.beginPath();ctx.arc(.5,-.57,.065,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#ad493b';ctx.beginPath();ctx.moveTo(.45,-.31);ctx.lineTo(.64,-.16);ctx.lineTo(.4,-.16);ctx.closePath();ctx.fill();ctx.stroke();
  }else if(index===1){
    box(-.53,-.7,1.06,.4,'#456b7c');ctx.fillStyle='#d6b86f';ctx.fillRect(-.47,-.41,.94,.07);
    ctx.fillStyle='#172733';ctx.beginPath();ctx.moveTo(-.47,-.68);for(let x=-.47;x<.48;x+=.13)ctx.lineTo(x,-.73-(Math.round((x+.5)*20)%3)*.025);ctx.lineTo(.48,-.68);ctx.closePath();ctx.fill();
    ctx.fillStyle='#7294a2';for(const x of [-.34,0,.34])ctx.fillRect(x,-.63,.025,.18);
  }else{
    box(-.55,-.85,1.1,.56,body);box(-.58,-.93,1.16,.1,'#253e50');
    ctx.fillStyle='#e6cf9a';ctx.fillRect(-.51,-.42,1.02,.07);
    for(const x of [-.4,-.13,.14]){box(x,-.77,.2,.23,'#b9e8ef',.025);ctx.fillStyle='#e5f8f5';ctx.fillRect(x+.025,-.74,.035,.17);}
  }
  box(-.56,-.3,1.12,.1,'#202d39');
  const wheels=index===0?[-.33,0,.32]:[-.35,.35],radius=index===0?.145:.125;
  for(const x of wheels){
    ctx.fillStyle='#14212b';ctx.strokeStyle='#bed0d8';ctx.lineWidth=1/size;ctx.beginPath();ctx.arc(x,-radius,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.save();ctx.translate(x,-radius);ctx.rotate(rotation);ctx.strokeStyle='#829fae';ctx.lineWidth=.65/size;
    for(let spoke=0;spoke<3;spoke++){const a=spoke*Math.PI/3;ctx.beginPath();ctx.moveTo(-Math.cos(a)*radius*.7,-Math.sin(a)*radius*.7);ctx.lineTo(Math.cos(a)*radius*.7,Math.sin(a)*radius*.7);ctx.stroke();}ctx.restore();
    ctx.fillStyle=index===0?'#e3b86c':'#c4d6df';ctx.beginPath();ctx.arc(x,-radius,.035,0,Math.PI*2);ctx.fill();
  }
  if(index===0){const shift=Math.cos(rotation)*.065,drop=Math.sin(rotation)*.065;ctx.strokeStyle='#c8d4d8';ctx.lineWidth=1.1/size;ctx.beginPath();ctx.moveTo(-.33+shift,-radius+drop);ctx.lineTo(.32+shift,-radius+drop);ctx.stroke();}
  ctx.restore();
}
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let indicatorSimulation=null,indicatorSnapshot=[],indicatorUpdated=-Infinity;
function drawIndicators(time){
  if(!simulation||!stress)return;
  if(indicatorSimulation!==simulation){indicatorSimulation=simulation;indicatorSnapshot=[];indicatorUpdated=-Infinity;}
  if(time-indicatorUpdated>=500){indicatorSnapshot=didacticIndicators(simulation,indicatorSnapshot);indicatorUpdated=time;}
  const annotations=indicatorSnapshot;
  const phase=reducedMotion.matches||paused?0:Math.sin(time/650)*1.5;
  const arrow=(a,b,color,dashed=false)=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<2)return;
    const nx=dx/len,ny=dy/len,head=Math.min(4,len*.4);
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.5;ctx.setLineDash(dashed?[3,3]:[]);
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-nx*head-ny*head*.6,b.y-ny*head+nx*head*.6);ctx.lineTo(b.x-nx*head+ny*head*.6,b.y-ny*head-nx*head*.6);ctx.closePath();ctx.fill();
  };
  ctx.save();ctx.globalAlpha=.8;
  for(const item of annotations){
    if(item.kind==='deflection'){
      const initial=screen({x:item.x,y:item.y0}),lowest=screen({x:item.x,y:item.y}),a={x:initial.x+13,y:initial.y},b={x:lowest.x+13,y:lowest.y};
      ctx.strokeStyle='#b99fed';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(initial.x-8,initial.y);ctx.lineTo(a.x+5,initial.y);ctx.moveTo(lowest.x,lowest.y);ctx.lineTo(b.x+5,lowest.y);ctx.stroke();ctx.setLineDash([]);
      arrow(a,b,'#c4a7f4');arrow(b,a,'#c4a7f4');
      continue;
    }
    const e=simulation.edgeMap.get(item.beam);if(!e||(e.broken&&simulation.mode!=='stress'))continue;
    const a=screen(simulation.byId.get(e.a)),b=screen(simulation.byId.get(e.b));
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);if(len<18)continue;
    const nx=dx/len,ny=dy/len,px=-ny,py=nx,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    if(item.kind==='buckling'){
      const start={x:mid.x+px*18,y:mid.y+py*18},end={x:mid.x+px*(32+phase),y:mid.y+py*(32+phase)};
      arrow(start,end,'#edbd69',true);continue;
    }
    const tensile=item.kind==='tension',offset=tensile?-11:11,color=tensile?'#78baff':'#f59b93',spread=Math.min(25,len*.2);
    for(const side of [-1,1]){
      const direction=side*(tensile?1:-1),position=side*spread+direction*phase;
      const start={x:mid.x+nx*position+px*offset,y:mid.y+ny*position+py*offset};
      arrow(start,{x:start.x+nx*direction*10,y:start.y+ny*direction*10},color);
    }
  }
  ctx.restore();
}
function draw(time){
  ctx.clearRect(0,0,width,height);ctx.fillStyle='#0d1821';ctx.fillRect(0,0,width,height);
  const lo=world(0,height),hi=world(width,0),gridStep=view.scale<12?4:view.scale<22?2:1;
  ctx.fillStyle='#203544';
  for(let x=Math.ceil(lo.x/gridStep)*gridStep;x<hi.x;x+=gridStep)for(let y=Math.ceil(lo.y/gridStep)*gridStep;y<hi.y;y+=gridStep){const p=screen({x,y});ctx.fillRect(p.x,p.y,1,1);}
  const waterScreen=screen({x:0,y:level.water}).y;
  ctx.fillStyle='#163a5060';ctx.fillRect(0,waterScreen,width,height-waterScreen);
  ctx.strokeStyle='#246282';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,waterScreen);ctx.lineTo(width,waterScreen);ctx.stroke();
  ctx.beginPath();ctx.moveTo(0,height+5);
  const t=[{x:lo.x,y:terrainAt(level,lo.x)},...level.terrain.filter(p=>p.x>lo.x&&p.x<hi.x),{x:hi.x,y:terrainAt(level,hi.x)}];
  for(const n of t){const p=screen(n);ctx.lineTo(p.x,p.y);}ctx.lineTo(width,height+5);ctx.closePath();ctx.fillStyle='#213b38';ctx.fill();
  ctx.beginPath();for(let i=0;i<t.length;i++){const p=screen(t[i]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.strokeStyle='#538275';ctx.lineWidth=2;ctx.stroke();
  // Dotted nominal deck line explains what the automatic deck builds.
  line({x:level.left,y:0},{x:level.right,y:0},'#526d7b60',1,true);
  for(const [x,label] of [[level.left,'SORTIDA'],[level.right,'ARRIBADA']]){const p=screen({x,y:0});ctx.font='9px Segoe UI';ctx.fillStyle='#82a3b3';ctx.textAlign='center';ctx.fillText(label,p.x,p.y+22);}
  const nodes=simulation?.nodes||bridge.nodes,edges=simulation?.beams||bridge.beams,byId=new Map(nodes.map(n=>[n.id,n]));
  for(const e of edges){const a=byId.get(e.a),b=byId.get(e.b);let color=e.type==='deck'?'#142c34':'#789ab3';
    const effort=simulation?.mode==='stress'?e.peakStress:e.stress;
    if(simulation?.mode==='stress'&&stress)color=stressHeatColor(effort);
    else if(simulation&&stress&&Math.abs(effort)>.035){const v=Math.min(1,Math.abs(effort));color=effort>0?`rgb(${Math.round(120-55*v)},${Math.round(157+10*v)},${Math.round(181+65*v)})`:`rgb(${Math.round(120+123*v)},${Math.round(157-61*v)},${Math.round(181-82*v)})`;}
    if(e.id===selected)line(a,b,'#29d5cf',9);
    if(e.id===(hoveredCritical||focusedCritical))line(a,b,'#f2d78c',9,e.broken);
    if(e.broken&&simulation?.mode!=='stress'){line(a,b,'#e16d6155',2,true);continue;}
    if(e.type==='deck')line(a,b,'#35d4c4',7);
    line(a,b,color,e.type==='deck'?3:simulation?.mode==='stress'&&stress?4:2.5);
    if(e.type==='deck'){const p=screen(a),q=screen(b),dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);ctx.strokeStyle='#0e2334';ctx.lineWidth=1;
      for(let d=6;d<len;d+=12){const x=p.x+dx*d/len,y=p.y+dy*d/len;ctx.beginPath();ctx.moveTo(x-dy/len*3,y+dx/len*3);ctx.lineTo(x+dy/len*3,y-dx/len*3);ctx.stroke();}
    }
  }
  for(const n of nodes){const p=screen(n);ctx.fillStyle=n.fixed?'#f4c25c':'#91b3c8';ctx.strokeStyle=n.fixed?'#fbe1a1':'#122635';ctx.lineWidth=1.5;
    ctx.beginPath();if(n.fixed){ctx.moveTo(p.x,p.y-6);ctx.lineTo(p.x+6,p.y);ctx.lineTo(p.x,p.y+6);ctx.lineTo(p.x-6,p.y);ctx.closePath();}else ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  if(hover&&!simulation&&['bar','deck'].includes(tool)){
    const preview=connectionPreview(bridge,hover),p=screen(preview.point),connected=preview.kind!=='new';
    for(const id of preview.beams){const e=bridge.beams.find(e=>e.id===id);line(byId.get(e.a),byId.get(e.b),'#38d6bc66',7);}
    ctx.strokeStyle=connected?'#52edcf':'#91b3c8';ctx.fillStyle=connected?'#0c3e34cc':'#122635cc';ctx.lineWidth=2;ctx.setLineDash(connected?[]:[3,3]);
    ctx.beginPath();ctx.arc(p.x,p.y,connected?8:6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);
    if(connected){ctx.beginPath();ctx.moveTo(p.x-3,p.y);ctx.lineTo(p.x-1,p.y+2);ctx.lineTo(p.x+4,p.y-3);ctx.stroke();}
  }
  if(start&&!simulation){const p=screen(start);ctx.beginPath();ctx.arc(p.x,p.y,9,0,Math.PI*2);ctx.strokeStyle='#2bcfca';ctx.lineWidth=2;ctx.stroke();
    if(hover){
      const length=Math.hypot(hover.x-start.x,hover.y-start.y),plan=tool==='deck'?planDeckSpan(bridge,start,hover):null;
      if(plan?.segments){for(const s of plan.segments){line(s.a,s.b,'#2bcfca',2,true);const p=screen(s.b);ctx.fillStyle='#2bcfca';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();}}
      else line(start,hover,length<=RULES.maxLength?'#2bcfca':'#f17b65',2,true);
      const q=screen(hover);ctx.fillStyle='#b7d8e6';ctx.font='11px Segoe UI';ctx.textAlign='left';
      ctx.fillText(fmt(length)+' u · '+(plan?.segments?plan.segments.length+' trams · '+fmt(plan.added*RULES.beamCost):'100'),q.x+13,q.y-12);
    }
  }
  if(simulation?.mode==='stress'&&stress){for(const e of criticalBeams()){const a=byId.get(e.a),b=byId.get(e.b),p=screen({x:(a.x+b.x)/2,y:(a.y+b.y)/2});ctx.font='11px Segoe UI';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#0d1821';ctx.fillStyle='#e8f4fa';const label='Tram '+(Number(e.id.slice(1))+1);ctx.strokeText(label,p.x,p.y-9);ctx.fillText(label,p.x,p.y-9);}}
  if(simulation?.mode==='train'){
    const size=Math.max(6,Math.min(44,view.scale*.95)),cars=[];
    for(let i=0;i<4;i++){const car=simulation.cars?.[i],x=car?.x??simulation.trainX-i*1.3,rail=simulation.railAt(x),p=screen({x,y:car?.y??(rail.broken?simulation.trainY:rail.y)});
      const angle=!car?.falling&&rail.a&&rail.b?Math.atan2(-(rail.b.y-rail.a.y),rail.b.x-rail.a.x):0;
      cars.push({p,x,angle,falling:car?.falling});}
    ctx.strokeStyle='#a6b8c2';ctx.lineWidth=1.5;
    for(let i=1;i<4;i++)if(!cars[i].falling&&!cars[i-1].falling){ctx.beginPath();ctx.moveTo(cars[i].p.x+size*.48,cars[i].p.y-size*.25);ctx.lineTo(cars[i-1].p.x-size*.48,cars[i-1].p.y-size*.25);ctx.stroke();}
    for(let i=3;i>=0;i--)drawTrainCar(cars[i].p,size,i,cars[i].angle,reducedMotion.matches?0:cars[i].x*view.scale/(size*.14));
  }
  drawIndicators(time);
}
function frame(time){
  const dt=lastFrame?Math.min((time-lastFrame)/1000,.05):0;lastFrame=time;
  if(simulation?.active&&!paused){accumulator+=dt*Number($('speed').value);let steps=0;
    while(accumulator>=RULES.step&&steps++<100){const before=simulation.status;simulation.step();accumulator-=RULES.step;
      if(before!==simulation.status&&simulation.status==='collapsing')finish();
      if(!simulation.active){finish();break;}}
    updateStats();
  }
  draw(time);requestAnimationFrame(frame);
}
const observer=new ResizeObserver(()=>{const r=canvas.getBoundingClientRect(),first=width===1;width=r.width;height=r.height;const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(first)fit();});observer.observe(canvas);
restore();populateLevels();updateStats();update();persist();requestAnimationFrame(frame);
