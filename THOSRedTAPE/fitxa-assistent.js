'use strict';
const root=document.getElementById('fitxa'), q=id=>root.querySelector('#'+id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let curriculumActiu=curriculum;
let font='https://xtec.gencat.cat/web/.content/curriculum/eso/curriculum-175-2022/Tecnologia-i-Digitalitzacio.pdf';
const s={stage:'',year:'',subject:'',hours:'',weeks:33,margin:3,teacher:'',centre:'Institut Thos i Codina',town:'Mataró',academic:'2026–2027',code:'',ce:curriculumActiu.ces.map(()=>true),criteria:curriculumActiu.ces.map(c=>c.criteria.map(()=>true)),criterionTexts:curriculumActiu.ces.map(c=>[...c.criteria]),sa:[],weights:[30,30,10,30,0],assessment:'Avaluació contínua i formativa amb retroacció i oportunitats de millora.',recovery:'Revisió dels treballs, activitats específiques i presentació de noves evidències.',bib:'Decret 175/2022, annex 3. Tecnologia i Digitalització.\n'+font};
const instruments=['Projectes i prototips','Activitats pràctiques','Portafolis i documentació','Observació del procés','Proves individuals'];
const titles=['Quina matèria imparteixes?','Com distribuïm les hores?','Quines competències treballaràs?','Què farà l’alumnat?','Quan començarà cada situació?','Com avaluaràs l’alumnat?','Revisa la fitxa i descarrega-la'];
let step=0;
const opts=(items,value)=>items.map(x=>'<option '+(String(x)===String(value)?'selected':'')+'>'+esc(x)+'</option>').join('');
const field=(name,label,type='text')=>'<label>'+label+'<input data-key="'+name+'" type="'+type+'" value="'+esc(s[name])+'"></label>';
const select=(key,label,items)=>'<label>'+label+'<select data-key="'+key+'"><option value="">Selecciona</option>'+opts(items,s[key])+'</select></label>';
const box=(label,html)=>'<details class="box"><summary>'+label+'</summary><div>'+html+'</div></details>';
const check=(attr,on,txt)=>'<label class="pick"><input type="checkbox" '+attr+' '+(on?'checked':'')+'> '+esc(txt)+'</label>';
const total=()=>s.hours*s.weeks, planned=()=>s.sa.reduce((a,b)=>a+Number(b.hours),0);
let identification = true;
let choosingTopics = true;
const selectedTopics = new Set();
const topicSabers = new Map();
const techProfiles = [
  ['Estructures i disseny', 'Dissenyem una estructura que suporti una càrrega', [0,1,3,6,7,10,11]],
  ['Mecanismes i màquines', 'Construïm una màquina que ens ajudi', [2,4,7,8,9]],
  ['Circuits elèctrics', 'Dissenyem la il·luminació d’una maqueta', [0,5,7,10]],
  ['Programació, sensors i robòtica', 'Programem un sistema que respongui a un sensor', [13,14,15,16,17]],
  ['Entorn digital i seguretat', 'Preparem un entorn digital segur per a la classe', [18,19,20,22,23]],
  ['Comunicació tècnica digital', 'Publiquem una guia digital del nostre prototip', [9,10,11,12,21]],
  ['Energia i sostenibilitat', 'Com podem reduir el consum energètic de l’aula?', [1,2,24,25,26]]
];
let profiles = techProfiles;
const customTopics = new Map();
let nextTopicId = profiles.length;
// Correspondències didàctiques amb els sabers del catàleg local.
const techAliases = [
  [3,'pont|ponts|torre|encavallada'], [4,'engranatges|politges|palanques|transmissio mecanica'],
  [5,'led|leds|circuit|circuits|electricitat'], [7,'impressio 3d|fabricacio digital'],
  [10,'acotacio|acotar|dibuix a escala'], [11,'cad|autocad|tinkercad|freecad|sketchup|modelatge 3d'],
  [13,'diagrama de flux|algoritmes'], [14,'scratch|python|programar una app'],
  [15,'sensor|sensors|arduino|microbit|reg automatic|hort intelligent|hort intel ligent'],
  [16,'robot|robots|robotica'], [17,'debug|depurar'], [19,'wifi|bluetooth'],
  [22,'backup|copies de seguretat'], [23,'phishing|ciberseguretat|contrasenyes'],
  [25,'ecodisseny|economia circular'], [26,'plaques solars|fotovoltaica|estalvi energetic']
];
const techName = 'Tecnologia i Digitalització';
const historyName = 'Ciències Socials: Geografia i Història';
const techFont = font;
const historyAliases = [
  ['Primeres civilitzacions','egipte|mesopotamia|faraons'],
  ['Cronologia i temps històric','linia del temps|eix cronologic'],
  ['Ubicació espacial','cartografia|mapes|coordenades'],
  ['Origen de la humanitat','prehistoria|paleolitic|neolitic'],
  ['Les arrels de la cultura occidental','roma|grecia|mon classic']
].flatMap(([group,terms])=>historia.profiles.find(p=>p[0]===group)[2].map(index=>[index,terms]));
let topicAliases = techAliases;
let loadedSubject = techName;
let loadedSheet;
const courseNames=['1r','2n','3r','4t'];
function sheetsForCourse(){
  let catalog=s.stage==='ESO'?catalegESO:s.stage==='BATX'?catalegBATX:[];
  if(s.stage==='BATX'&&s.year==='2n'&&Number(s.academic.slice(0,4))<2027){
    const oldNames=new Set(catalegBATX171.map(sheet=>sheet.names[0]));
    catalog=[...catalog.filter(sheet=>!oldNames.has(sheet.names[0])),...catalegBATX171];
  }
  return catalog.filter(sheet=>sheet.years.includes(s.year[0]));
}
function coverage(){
  return loadedSheet ? loadedSheet.years.map(y=>courseNames[Number(y)-1]).join(', ')+' de '+s.stage : '';
}
function curriculumWarning(){
  if(!loadedSheet||!s.subject)return '';
  if(loadedSheet.effectiveFrom&&Number(s.academic.slice(0,4))<2027)
    return 'El buidatge disponible d’aquesta matèria de 2n BATX correspon al Decret 103/2026, aplicable a 2n a partir de 2027–2028. Falta carregar la versió anterior per a '+s.academic+'.';
  if(loadedSheet.expectedCE&&loadedSheet.ces.length<loadedSheet.expectedCE)
    return 'El buidatge de '+s.subject+' està incomplet: hi falta la competència 2 i els criteris 2.1–2.4.';
  return '';
}
function changeSubject(name) {
  const sheet=sheetsForCourse().find(entry=>entry.names.includes(name));
  if(!sheet || (name===loadedSubject && sheet===loadedSheet)) return;
  loadedSubject=name;
  loadedSheet=sheet;
  const isTech=s.stage==='ESO' && name===techName;
  const isHistory=s.stage==='ESO' && sheet.sheet==='Geog. i Hist. 1i2';
  curriculumActiu=isTech?curriculum:isHistory?historia:sheet;
  profiles=isTech?techProfiles:curriculumActiu.profiles;
  topicAliases=isTech?techAliases:isHistory?historyAliases:[];
  font=isTech?techFont:isHistory?historia.font:s.stage==='BATX'
    ?'https://xtec.gencat.cat/ca/curriculum/batxillerat/curriculum-171-2022/'
    :'https://xtec.gencat.cat/ca/curriculum/eso/curriculum-175-2022/';
  s.ce=curriculumActiu.ces.map(()=>true);
  s.criteria=curriculumActiu.ces.map(c=>c.criteria.map(()=>true));
  s.criterionTexts=curriculumActiu.ces.map(c=>[...c.criteria]);
  s.sa=[]; selectedTopics.clear();topicSabers.clear();customTopics.clear();nextTopicId=profiles.length;
  choosingTopics=true;
  const normativa=s.stage==='BATX'
    ?(sheet.normativa.startsWith('Decret')?sheet.normativa:'Decrets 171/2022 i 103/2026')
    :'Decret 175/2022, annex 3';
  s.bib=normativa+'. '+name+'.\n'+font;
  instruments[0]=isHistory?'Projectes de recerca històrica i geogràfica':isTech?'Projectes i prototips':'Projectes i treballs de la matèria';
}
function normalizedWords(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
}
function matchSabers(title) {
  const phrase = ' '+normalizedWords(title)+' ';
  const words = new Set(phrase.trim().split(' ').filter(w=>w.length>=4));
  const entries = curriculumActiu.sab.map(text=>new Set(normalizedWords(text).split(' ')));
  const matched = new Set();
  for(const [index,aliases] of topicAliases){
    if(aliases.split('|').some(term=>phrase.includes(' '+term+' '))) matched.add(index);
  }
  const generic = new Set('projecte projectes treball activitats aplicacio aplicacions entorn diferents objectes utilitzacio desenvolupament sistemes eines creacio classe tecnologies resolucio problemes analisi disseny elaboracio basiques digital digitals construccio personal propis mitjancant sobre seves seus adequada tecnologia nostra nostre'.split(' '));
  for(const word of words){
    if(generic.has(word)) continue;
    const hits = entries.flatMap((entry,i)=>entry.has(word)?[i]:[]);
    if(hits.length===1) matched.add(hits[0]);
  }
  return [...matched].sort((a,b)=>a-b);
}

function customTopicRow([id, name]) {
  return '<div class="topic-card"><div class="row"><label>Contingut propi<input data-custom-topic="'+id+'" value="'+esc(name)+'"></label><button type="button" data-delete-topic="'+id+'">Eliminar fila</button></div>'
    +topicSaberControls(id,name.trim()&&selectedTopics.has(id))+'</div>';
}

function selectedSabersForTopic(id){
  return [...(topicSabers.get(id)??new Set(profiles[id]?.[2]??matchSabers(customTopics.get(id)??'')))].sort((a,b)=>a-b);
}
function topicSaberControls(id,visible){
  const chosen=selectedSabersForTopic(id);
  return '<details data-topic-sabers="'+id+'" '+(visible?'':'hidden')+'><summary>Sabers proposats: '+chosen.length+' seleccionats · Modificar</summary><p>Desmarca els sabers que no treballaràs o marca’n d’altres.</p>'
    +'<div class="row"><button type="button" data-topic-action="clear" data-topic-id="'+id+'">Desmarcar tots</button><button type="button" data-topic-action="reset" data-topic-id="'+id+'">Restablir proposta</button></div>'
    +'<div class="saber-picker">'+curriculumActiu.sab.map((saber,index)=>check('data-topic-saber="'+id+','+index+'"',chosen.includes(index),saber)).join('')+'</div></details>';
}
function setTopicSabers(id,chosen,details){
  topicSabers.set(id,new Set(chosen));
  const current=selectedSabersForTopic(id);
  const existing=s.sa.find(a=>a.topic===id);
  if(existing){existing.sab=current;existing.manual=!current.length;}
  if(details){
    details.querySelector('summary').textContent='Sabers proposats: '+current.length+' seleccionats · Modificar';
    details.querySelectorAll('[data-topic-saber]').forEach(input=>{input.checked=current.includes(Number(input.dataset.topicSaber.split(',')[1]));});
  }
}

root.addEventListener('click', event => {
  const target = event.target;
  if (target.dataset.topicAction !== undefined) {
    const id=Number(target.dataset.topicId);
    const proposed=profiles[id]?.[2]??matchSabers(customTopics.get(id)??'');
    setTopicSabers(id,target.dataset.topicAction==='clear'?[]:proposed,target.closest('details'));
  } else if (target.id === 'add-topic') {
    const id = nextTopicId++;
    customTopics.set(id, '');
    draw();
    root.querySelector('[data-custom-topic="'+id+'"]').focus();
  } else if (target.dataset.deleteTopic !== undefined) {
    const id = Number(target.dataset.deleteTopic);
    customTopics.delete(id);
    selectedTopics.delete(id);
    topicSabers.delete(id);
    draw();
    q('add-topic').focus();
  }
});

root.addEventListener('input', event => {
  const id = Number(event.target.dataset.customTopic);
  if (!customTopics.has(id)) return;
  const name = event.target.value;
  const existing = s.sa.find(a => a.topic === id);
  if (existing && existing.title === customTopics.get(id).trim()) existing.title = name.trim();
  if(name!==customTopics.get(id))topicSabers.delete(id);
  customTopics.set(id, name);
  if (name.trim()) selectedTopics.add(id);
  else selectedTopics.delete(id);
});
root.addEventListener('change', event => {
  if(event.target.dataset.customTopic!==undefined) draw();
});

function proposeSituations() {
  const ids = [...selectedTopics].sort((a,b)=>a-b);
  const kept = s.sa.filter(a=>a.topic===undefined || (selectedTopics.has(a.topic) &&
    (!customTopics.has(a.topic) || a.sourceTitle===customTopics.get(a.topic).trim())));
  const additions = ids.filter(id=>!kept.some(a=>a.topic===id));
  const available = Math.max(0,total()-s.margin-kept.reduce((sum,a)=>sum+Number(a.hours),0));
  additions.forEach((id,index)=>{
    const sourceTitle = customTopics.get(id)?.trim();
    const title = profiles[id]?.[1] ?? sourceTitle;
    const sab = selectedSabersForTopic(id);
    const wholeHours = Math.floor(available);
    const share = Math.floor(wholeHours / additions.length)
      + (index < wholeHours % additions.length ? 1 : 0);
    const suggested = sourceTitle ? Math.min(share, 2 + 2 * sab.length) : share;
    kept.push({topic:id,title,sourceTitle,hours:sab.length?suggested:'',manual:!sab.length,trim:1,date:'',sab:[...sab]});
  });
  s.sa=kept;
}
function first(){
  if(identification) return '<article class="grid">'+[['teacher','Professorat responsable'],['academic','Curs acadèmic'],['centre','Centre'],['town','Municipi'],['code','Codi documental (si en tens)']].map(a=>field(...a)).join('')+'</article>';
  return '<article class="grid">'+select('stage','Estudis',['ESO','BATX'])+select('year','Curs',s.stage==='ESO'?['1r','2n','3r','4t']:s.stage==='BATX'?['1r','2n']:[])+select('subject','Matèria',sheetsForCourse().flatMap(sheet=>sheet.names).sort((a,b)=>a.localeCompare(b,'ca')))+field('hours','Hores setmanals','number')+'</article>'+(curriculumWarning()?'<p class="weight-error">'+esc(curriculumWarning())+'</p>':'');
}
function topics(){
  const history = curriculumActiu===historia;
  function topicCard(profile,index){
    const [label]=profile;
    return '<div class="topic-card">'+check('data-topic="'+index+'"',selectedTopics.has(index),label)
      +topicSaberControls(index,selectedTopics.has(index))+'</div>';
  }
  const blocks=[['Reptes del món actual',0,9],['Societats i territoris',9,24],['Compromís cívic',24,34]];
  const cards=history ? blocks.map(([name,start,end])=>box(name+' · '+(end-start)+' continguts',profiles.slice(start,end).map((p,i)=>topicCard(p,start+i)).join(''))).join('')
    : profiles.map(topicCard).join('');
  return '<article><h2>Quins continguts treballaràs a '+esc(s.year)+' de '+esc(s.stage)+'?</h2><p>'+esc(loadedSubject)+' · '+coverage()+'. Tria els continguts del teu grup. Et proposarem les SA amb els sabers marcats i la durada estimada.</p>'+cards+[...customTopics].map(customTopicRow).join('')+'<button id="add-topic" type="button">+ Afegeix un contingut propi</button></article>';
}
function duration(){return '<article><h2>Proposta automàtica</h2><p id="metric"></p>'+box('Modificar la previsió','<div class="grid">'+field('weeks','Setmanes estimades','number')+field('margin','Hores de marge','number')+'</div>')+'</article>';}
function compet(){
  const intro='<p>'+esc(s.subject)+' · '+coverage()+(curriculumActiu===loadedSheet?' · Dades del buidatge curricular':'')+' · '+esc(s.bib.split('\n')[0])+' <a href="'+font+'" target="_blank" rel="noopener">Currículum XTEC</a></p>';
  const guidance=s.stage==='BATX'?'<p>Les frases per a l’alumnat i les agrupacions de sabers són propostes editables del buidatge.</p>':'';
  const cards=curriculumActiu.ces.map((c,i)=>'<article>'+check('data-ce="'+i+'"',s.ce[i],c.id+' · '+c.text)+box('Consultar i seleccionar criteris',c.criteria.map((v,j)=>
    check('data-criterion="'+i+','+j+'"',s.criteria[i][j],s.criterionTexts[i][j])
  ).join(''))+'</article>').join('');
  return intro+guidance+'<p id="metric"></p>'+cards;
}
function saField(i,k,label,type){return '<label>'+label+'<input data-sa="'+i+'" data-prop="'+k+'" type="'+type+'" value="'+esc(s.sa[i][k])+'"></label>';}
function situations(){if(choosingTopics)return topics();return '<p>Proposta didàctica editable · '+esc(s.year)+' de '+esc(s.stage)+'</p><p id="metric"></p>'+s.sa.map((a,i)=>'<details class="box" '+(a.manual&&(!a.sab.length||!(a.hours>0))?'open':'')+'><summary>SA '+(i+1)+' · '+esc(a.title)+'</summary><div>'+(a.manual?'<p>Sense coincidència al catàleg. Selecciona els sabers i indica les hores d’aquesta SA.</p>':a.sourceTitle?'<p>Sabers i durada proposats a partir del títol. Pots ajustar-los.</p>':'')+saField(i,'title','Títol','text')+saField(i,'hours','Durada (h)','number')+box('Seleccionar sabers ('+a.sab.length+')',curriculumActiu.sab.map((v,j)=>check('data-saber="'+i+','+j+'"',a.sab.includes(j),v)).join(''))+'<div class="row"><button data-action="up" data-i="'+i+'">↑ Pujar</button><button data-action="down" data-i="'+i+'">↓ Baixar</button><button data-action="remove" data-i="'+i+'">Eliminar SA</button></div></div></details>').join('')+'<button data-action="add">Afegir SA</button>';}
function calculateSequence() {
  const year = Number(s.academic.slice(0,4));
  const weekMs = 7 * 86400000;
  const anchorDates = [
    new Date(Date.UTC(year,8,14)),
    new Date(Date.UTC(year+1,0,11)),
    new Date(Date.UTC(year+1,3,6))
  ];
  const anchors = anchorDates.map(date=>date.getTime()-((date.getUTCDay()+6)%7)*86400000);
  const totalHours=planned();
  const base=Math.floor(totalHours/3);
  const limits=[base,base,base];
  for(let extra=0;extra<totalHours-3*base;extra++) limits[extra%3]++;
  const used=[0,0,0];
  let trimester=0;
  for (const sa of s.sa) {
    const allocation=[0,0,0];
    let remaining=Number(sa.hours);
    while(remaining>0 && trimester<3){
      if(used[trimester]>=limits[trimester] && trimester<2){trimester++;continue;}
      const amount=trimester===2?remaining:Math.min(remaining,limits[trimester]-used[trimester]);
      allocation[trimester]+=amount;
      used[trimester]+=amount;
      remaining-=amount;
    }
    const first=allocation.findIndex(value=>value>0);
    const term=first<0?0:first;
    const before=used[term]-allocation[term];
    const proposed=new Date(anchors[term]+Math.floor(before/Number(s.hours))*weekMs).toISOString().slice(0,10);
    sa.termHours=allocation;
    sa.earliest = proposed;
    if (!sa.fixedDate) sa.date = proposed;
    if (!sa.fixedTerm) sa.trim=term+1;
  }
}
function refreshSequenceInputs() {
  calculateSequence();
  for (const input of root.querySelectorAll('[data-sa]')) {
    const sa = s.sa[input.dataset.sa];
    input.value = sa[input.dataset.prop];
  }
}
function sequence(){calculateSequence();const totals=[0,0,0];s.sa.forEach(sa=>sa.termHours.forEach((hours,i)=>totals[i]+=hours));return '<p>Proposta orientativa segons les hores planificades. Les SA poden continuar d’un trimestre al següent. Ajusta les dates al calendari del centre.</p><article class="term-summary"><h2>Hores per trimestre</h2><div class="grid">'+totals.map((hours,i)=>'<p><strong>'+(i+1)+'r trimestre</strong><br>'+hours+' h</p>').join('')+'</div></article>'+s.sa.map((a,i)=>'<article><h2>SA '+(i+1)+' · '+esc(a.title)+'</h2><p>'+a.termHours.map((hours,term)=>hours?hours+' h al ' +['1r','2n','3r'][term]+' trimestre':'').filter(Boolean).join(' · ')+'</p><div class="grid"><label>Trimestre d’inici<select data-sa="'+i+'" data-prop="trim">'+opts([1,2,3],a.trim)+'</select></label>'+saField(i,'date','Data d’inici','date')+'</div>'+(a.fixedDate||a.fixedTerm?'<button data-action="auto-date" data-i="'+i+'">Restablir la proposta</button>':'')+'</article>').join('');}
const area=(key,label)=>'<label>'+label+'<textarea data-key="'+key+'">'+esc(s[key])+'</textarea></label>';
function evaluation(){
  const choices=[
    ['practical','Projectes i activitats pràctiques'],
    ['balanced','Avaluació equilibrada'],
    ['custom','Configuració personalitzada']
  ];
  const cards=choices.map(([id,label])=>'<button type="button" class="evaluation-choice" data-preset="'+id+'" aria-pressed="'+(evaluationPreset===id)+'">'+label+'</button>').join('');
  const sliders=instruments.map((name,i)=>'<div class="weight-row"><label for="weight-range-'+i+'">'+esc(name)+'</label><input id="weight-range-'+i+'" type="range" min="0" max="100" step="1" data-weight="'+i+'" value="'+esc(s.weights[i])+'"><label class="weight-value" for="weight-number-'+i+'"><input id="weight-number-'+i+'" type="number" min="0" max="100" step="1" data-weight="'+i+'" value="'+esc(s.weights[i])+'"> %</label></div>').join('');
  const segments=instruments.map((name,i)=>'<span class="weight-segment segment-'+i+'" data-segment="'+i+'" title="'+esc(name)+'"></span>').join('');
  return '<article><h2>Proposta de qualificació</h2><div class="evaluation-choices" role="group" aria-label="Model d’avaluació">'+cards+'</div><div class="weight-chart" role="img" aria-label="Distribució dels instruments d’avaluació">'+segments+'</div><p id="metric" role="status"></p>'+sliders+box('Com s’avaluarà i es recuperarà?',area('assessment','Avaluació i retroacció')+area('recovery','Recuperació'))+'</article>';
}
let evaluationPreset='practical';
function setEvaluationPreset(preset){
  evaluationPreset=preset;
  if(preset==='practical')s.weights=[30,30,10,30,0];
  if(preset==='balanced')s.weights=[25,25,20,20,10];
  root.querySelectorAll('[data-preset]').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.preset===preset)));
  root.querySelectorAll('[data-weight]').forEach(input=>input.value=s.weights[input.dataset.weight]);
  updateWeightChart();
}
function updateWeightChart(){
  if(step!==5)return;
  const sum=s.weights.reduce((total,value)=>total+Number(value||0),0);
  root.querySelectorAll('[data-segment]').forEach(segment=>{
    const weight=Number(s.weights[segment.dataset.segment]);
    segment.style.width=Math.max(0,Math.min(100,weight))+'%';
  });
  const metric=q('metric');
  metric.textContent='Total: '+sum+' %'+(sum===100?' · Distribució completa':sum<100?' · Falten '+(100-sum)+' punts':' · Sobren '+(sum-100)+' punts');
  metric.classList.toggle('weight-error',sum!==100);
  q('forward').disabled=sum!==100;
}
function rows(){
return {CE:curriculumActiu.ces.flatMap((c,i)=>s.ce[i]?[[c.id,c.textAlumnat,c.criteria.flatMap((original,j)=>{
  if(!s.criteria[i][j])return [];
  const code=s.criterionTexts[i][j].match(/^\s*\d+(?:\.\d+)+/)?.[0].trim()||original.match(/^\s*\d+(?:\.\d+)+/)?.[0].trim()||'Sense número';
  return [code];
}).join(', ')]]:[]),SA:s.sa.map((a,i)=>['SA '+(i+1)+' · '+a.title+' ('+a.hours+' h)',a.sab.map(j=>curriculumActiu.sab[j]).join('\n')]),SEQ:s.sa.map((a,i)=>[a.trim,i+1,a.title,a.date]),EVAL:instruments.map((v,i)=>[v,s.weights[i]+' %'])};}
function review(){return '<article>'+area('bib','Bibliografia i documentació de referència')+'</article>'+box('Identificació i durada',firstSummary())+Object.entries(rows()).map(([k,r])=>box(({CE:'Competències i criteris',SA:'Situacions i sabers',SEQ:'Seqüenciació',EVAL:'Avaluació i recuperació'})[k],r.map(row=>'<p>'+row.map(esc).join(' · ').replaceAll('\n','<br>')+'</p>').join('')+(k==='EVAL'?'<p>'+esc(s.assessment)+'</p><p>'+esc(s.recovery)+'</p>':''))).join('')+'<p id="metric"></p>';}
function firstSummary(){return [s.subject,s.year+' '+s.stage,s.academic,s.teacher,s.centre,s.town,total()+' h anuals estimades'].map(esc).join(' · ');}
function metrics(){const m=q('metric');if(!m)return;const used=new Set(s.sa.flatMap(a=>a.sab)).size;
m.textContent=({1:total()+' h anuals estimades · '+(total()-s.margin)+' h distribuïbles · '+s.margin+' h de marge',2:s.ce.filter(Boolean).length+' competències seleccionades',3:planned()+' h planificades · '+(total()-s.margin)+' h disponibles · '+(curriculumActiu.sab.length-used)+' sabers sense assignar',6:'Sabers sense assignar: '+(curriculumActiu.sab.length-used)+' · Diferència d’hores respecte de la previsió: '+(total()-s.margin-planned())})[step]||'';updateWeightChart();}
const screens=[first,duration,compet,situations,sequence,evaluation,review];
function draw(){q('count').textContent='Pas '+(step+1)+' de 7';root.querySelector('progress').value=step+1;q('screen').innerHTML='<h1>'+(step===0&&identification?'Identificació del document':titles[step])+'</h1>'+screens[step]();q('notice').textContent='';q('back').hidden=!step&&identification;q('forward').textContent=step===3&&choosingTopics?'Proposar SA i sabers →':step===6?'Descarregar Word (.docx)':step?'Acceptar i continuar →':'Continuar →';q('screen').classList.remove('enter');void q('screen').offsetWidth;q('screen').classList.add('enter');q('screen').querySelectorAll('article, details.box, label.pick').forEach((card,index)=>{card.classList.add('card-enter');card.style.setProperty('--card-delay',Math.min(index,8)*35+'ms');});metrics();}
function showNext(action){
  const change=()=>{action();draw();};
  if(document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    document.startViewTransition(change);
  } else {
    change();
  }
}
function valid(i){if(i===0&&(!s.subject||!(Number(s.hours)>0)||!/^\d{4}[–-]\d{4}$/.test(s.academic)||Number(s.academic.slice(-4))!==Number(s.academic.slice(0,4))+1))return 'Selecciona estudis, curs i matèria, indica les hores i comprova el curs acadèmic.';
if(i===0&&curriculumWarning())return curriculumWarning();
if(i===1&&(!(s.weeks>0)||s.margin===''||s.margin<0||s.margin>=total()))return 'Comprova les setmanes i el marge disponible.';
if(i===2&&!s.ce.some(Boolean))return 'Selecciona almenys una competència.';
if(i===3&&s.sa.some(a=>a.manual&&(!a.sab.length||!(a.hours>0))))return 'A les SA sense coincidència, selecciona els sabers i indica la durada.';
if(i===3&&(!s.sa.length||s.sa.some(a=>!a.title.trim()||!(a.hours>0))))return 'Cada SA necessita un títol i una durada positiva.';
if(i===4&&s.sa.some((a,j)=>j>0&&a.fixedDate&&a.date<a.earliest))return 'Una data manual se solapa amb les hores de la SA anterior. Revisa la durada o la data.';
if(i===4&&s.sa.some((a,j)=>!a.date||a.date<s.academic.slice(0,4)+'-09-01'||a.date>s.academic.slice(-4)+'-08-31'||j&&(a.date<s.sa[j-1].date||Number(a.trim)<Number(s.sa[j-1].trim))))return 'Comprova les dates, els trimestres i l’ordre de les SA.';
if(i===5&&(s.weights.some(v=>v===''||!Number.isFinite(+v)||+v<0)||Math.abs(s.weights.reduce((a,v)=>a+Number(v),0)-100)>1e-8))return 'Els pesos han de ser positius o zero i sumar el 100 %.';
return '';}
root.addEventListener('input',e=>{const el=e.target,d=el.dataset;if(d.topic!==undefined){const id=Number(d.topic);if(el.checked)selectedTopics.add(id);else selectedTopics.delete(id);const details=el.closest('.topic-card')?.querySelector('[data-topic-sabers]');if(details){details.hidden=!el.checked;if(el.checked)details.open=true;}}if(d.topicSaber!==undefined){const [id,index]=d.topicSaber.split(',').map(Number);const chosen=new Set(selectedSabersForTopic(id));if(el.checked)chosen.add(index);else chosen.delete(index);setTopicSabers(id,chosen,el.closest('details'));}if(d.key){if(d.key==='subject' && el.value){
  if((el.value!==loadedSubject||!sheetsForCourse().includes(loadedSheet))&&(s.sa.length||selectedTopics.size)&&!window.confirm('Canviar de matèria substituirà les SA i les seleccions curriculars. Vols continuar?')){el.value=s.subject;return;}
  changeSubject(el.value);
}s[d.key]=el.value;if(d.key==='stage'||d.key==='year'||d.key==='subject'){if(d.key==='stage')s.year='';if(d.key!=='subject')s.subject='';draw();}if(d.key==='academic'&&s.stage==='BATX'&&s.year==='2n'&&s.subject&&/^\d{4}[–-]\d{4}$/.test(s.academic)){changeSubject(s.subject);draw();}}if(d.sa!==undefined){s.sa[d.sa][d.prop]=el.value;if(step===4&&(d.prop==='date'||d.prop==='trim')){if(d.prop==='date')s.sa[d.sa].fixedDate=true;else s.sa[d.sa].fixedTerm=true;refreshSequenceInputs();const card=el.closest('article');if(!card.querySelector('[data-action]'))card.insertAdjacentHTML('beforeend','<button data-action="auto-date" data-i="'+Number(d.sa)+'">Restablir la proposta</button>');}if(d.prop==='title')el.closest('details').querySelector('summary').textContent='SA '+(+d.sa+1)+' · '+el.value;}if(d.weight!==undefined){
  s.weights[d.weight]=el.value;
  evaluationPreset='custom';
  root.querySelectorAll('[data-preset]').forEach(card=>card.setAttribute('aria-pressed',String(card.dataset.preset==='custom')));
  root.querySelectorAll('[data-weight="'+d.weight+'"]').forEach(input=>{if(input!==el)input.value=el.value;});
}if(d.ce!==undefined)s.ce[d.ce]=el.checked;if(d.criterion){const [i,j]=d.criterion.split(',');s.criteria[i][j]=el.checked;}if(d.saber){const [i,j]=d.saber.split(',').map(Number),a=s.sa[i];a.sab=el.checked?[...a.sab,j]:a.sab.filter(k=>k!==j);el.closest('details').querySelector('summary').textContent='Seleccionar sabers ('+a.sab.length+')';}metrics();});
root.addEventListener('click',e=>{if(e.target.dataset.preset){setEvaluationPreset(e.target.dataset.preset);return;}const {action,i}=e.target.dataset;if(!action)return;const n=Number(i);if(action==='auto-date'){s.sa[n].fixedDate=false;s.sa[n].fixedTerm=false;}if(action==='add')s.sa.push({title:'Nova situació',hours:1,trim:1,date:'',sab:[]});if(action==='remove')s.sa.splice(n,1);if(action==='up'&&n>0)s.sa.splice(n-1,0,...s.sa.splice(n,1));if(action==='down'&&n<s.sa.length-1)s.sa.splice(n+1,0,...s.sa.splice(n,1));draw();});
q('back').onclick=()=>{
  showNext(()=>{
    if(step===0) identification=true;
    else if(step===3&&!choosingTopics) choosingTopics=true;
    else step--;
  });
};
q('forward').onclick=()=>{
  if(step===0&&identification){
    if(!s.teacher.trim()||!/^\d{4}[–-]\d{4}$/.test(s.academic)||Number(s.academic.slice(-4))!==Number(s.academic.slice(0,4))+1){
      q('notice').textContent='Indica el professorat responsable i un curs acadèmic com 2026–2027.';
      return;
    }
    showNext(()=>{identification=false;});
    return;
  }
  if(step===3&&choosingTopics){
    if(!selectedTopics.size){q('notice').textContent='Selecciona almenys un contingut o escriu-ne un de propi.';return;}
    showNext(()=>{proposeSituations();choosingTopics=false;});
    return;
  }
  const err=valid(step);
  if(err){q('notice').textContent=err;return;}
  if(step===6){exportWord(s,rows());return;}
  showNext(()=>{step++;});
};
draw();
