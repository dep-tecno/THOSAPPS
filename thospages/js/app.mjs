import {readZip} from './zip.mjs';
import {importBook} from './model.mjs';
import {validateScorm,prepareResources} from './resources.mjs';
import {el,renderDocument} from './render.mjs?v=20261120-8';
import {PagedPreview} from './pagination.mjs?v=20261120-8';
import {createDocx} from './docx.mjs?v=20261121-2';

const $=id=>document.getElementById(id);
const state={book:null,report:null,resources:new Map(),urls:[],generation:0,ready:false,paper:null};
const pagination=new PagedPreview($('preview'));
function status(message,kind=''){$('status').className='status '+kind;$('status').textContent=message;}
function clear(){
  state.generation++;state.ready=false;
  pagination.clear();$('page-count').textContent='';$('page-go').disabled=true;$('page-jump').disabled=true;
  for(const url of state.urls)URL.revokeObjectURL(url);
  Object.assign(state,{book:null,report:null,resources:new Map(),urls:[],paper:null});
  $('word').disabled=true;$('word-style').disabled=true;$('word-status').textContent='';
  $('print').disabled=true;$('settings').disabled=true;
  if($('pdf-notice').open)$('pdf-notice').close();
  $('report').replaceChildren(el('p','','Encara no hi ha cap document analitzat.'));
  const empty=el('div','empty');empty.append(el('h3','','El document apareixerà aquí'),el('p','','Importa un ZIP SCORM amb TAPP per preparar una versió imprimible.'));
  $('preview').replaceChildren(empty);$('file').value='';
}
async function load(file){
  clear();const generation=state.generation;$('filename').textContent=file.name;status('Analitzant el paquet…');
  let prepared;
  try{
    if(!/\.zip$/i.test(file.name))throw Error('Selecciona un fitxer .zip.');
    const zip=await readZip(file),{book,report}=await importBook(zip,validateScorm);
    prepared=await prepareResources(report,zip);
    if(generation!==state.generation){prepared.urls.forEach(url=>URL.revokeObjectURL(url));return;}
    Object.assign(state,{book,report,...prepared});$('settings').disabled=false;
    await update();
    if(generation===state.generation)status(report.errors.length?'El paquet té incidències bloquejants. Revisa l’informe.':'Paquet importat. La fidelitat visual queda pendent de revisió.',report.errors.length?'error':'ok');
  }catch(error){
    if(generation!==state.generation)return;
    prepared?.urls.forEach(url=>URL.revokeObjectURL(url));clear();$('filename').textContent=file.name;status(error.message||'No s’ha pogut importar el fitxer.','error');
  }
}
function showReport(){
  const {book,report}=state,box=$('report'),i=report.inventory;box.replaceChildren();
  box.append(el('p','','Títol: '+book.manifest.title),el('p','','Idioma: '+book.manifest.language),
    el('p','',`${i.chapters} capítols · ${i.sections} seccions · ${i.blocks} blocs (incloses correccions)`),
    el('p','',`${i.figures} figures · ${i.examples} exemples · ${i.variants} variants · ${i.questions} preguntes · ${i.answers} solucions`),
    el('p','',`${state.resources.size}/${i.resources} recursos preparats`),
    el('p',report.errors.length?'error':report.warnings.length?'warn':'good',report.errors.length?'No complet / conversió bloquejada':report.warnings.length?'Apte amb advertiments':'Apte estructuralment · revisió visual pendent'));
  if(report.errors.length||report.warnings.length){const list=el('ul');for(const issue of report.errors)list.append(el('li','error',`${issue.id?issue.id+': ':''}${issue.message}`));for(const issue of report.warnings)list.append(el('li','warn',issue.message));box.append(list);}
}
let renderGeneration=0;
async function update(){
  if(!state.book)return;
  const revision=++renderGeneration,generation=state.generation;
  pagination.clear();state.ready=false;state.paper=null;$('print').disabled=true;$('word').disabled=true;$('word-style').disabled=true;$('word-status').textContent='';$('page-go').disabled=true;$('page-jump').disabled=true;$('page-count').textContent='Preparant pàgines A4…';showReport();
  if(state.report.errors.some(issue=>!issue.previewSafe)){const panel=el('div','empty');panel.append(el('h3','','Conversió bloquejada'),el('p','','L’informe identifica els elements que cal corregir abans de construir una versió imprimible fidel.'));$('preview').replaceChildren(panel);return;}
  const paper=renderDocument(state.book,state.report,state.resources,{mode:$('edition').value,layout:$('layout').value,images:$('image-size').value,orientation:$('orientation').value,compact:$('density').value==='compact',cover:$('cover').checked,toc:$('toc').checked,breaks:$('breaks').checked,space:$('space').checked});
  if(!state.report.errors.length){state.paper=paper;$('word').disabled=false;$('word-style').disabled=false;}
  $('preview').replaceChildren(el('p','','Calculant els salts de pàgina…'));
  try{
    await Promise.all([...paper.querySelectorAll('img')].map(img=>img.decode()));
    if(generation!==state.generation||revision!==renderGeneration)return;
    const result=await pagination.render(paper,{onProgress:count=>{if(generation===state.generation&&revision===renderGeneration)$('page-count').textContent=`Maquetant pàgina ${count}…`;}});
    if(generation===state.generation&&revision===renderGeneration){
      $('page-count').textContent=`${result.count} pàgines A4`;$('page-go').max=result.count;$('page-go').value=1;$('page-go').disabled=false;$('page-jump').disabled=false;
      state.ready=!state.report.errors.length;$('print').disabled=!state.ready;
    }
  }catch(error){
    if(generation!==state.generation||revision!==renderGeneration)return;
    pagination.clear();$('page-count').textContent='No s’ha pogut completar la paginació.';
    $('preview').replaceChildren(el('p','',`No es pot preparar la previsualització del PDF: ${error.message}`));
  }
}
$('file').addEventListener('change',event=>{const file=event.target.files?.[0];if(file)load(file);});
const drop=$('drop');
drop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('file').click();}});
for(const name of ['dragenter','dragover'])drop.addEventListener(name,event=>{event.preventDefault();drop.classList.add('drag');});
for(const name of ['dragleave','drop'])drop.addEventListener(name,event=>{event.preventDefault();drop.classList.remove('drag');});
drop.addEventListener('drop',event=>{const file=event.dataTransfer?.files?.[0];if(file)load(file);});
for(const id of ['edition','layout','image-size','orientation','density','cover','toc','breaks','space'])$(id).addEventListener('change',update);
$('reset').addEventListener('click',()=>{clear();$('filename').textContent='Cap fitxer seleccionat';status('Selecciona un paquet per començar.');});
$('print').addEventListener('click',()=>{if(state.ready)$('pdf-notice').showModal();});
$('word').addEventListener('click',async()=>{
  const {paper,book}=state;
  if(!paper||$('word').disabled)return;
  const edition=$('edition').value;
  const suffix={student:'sense-solucions',full:'amb-solucions',end:'solucions-al-final'}[edition];
  const title=book.manifest.title.replace(/[<>:"/\\|?*]/g,'-').replace(/\s+/g,' ').trim().slice(0,120)||'THOSPAGES';
  const styled=$('word-style').value==='styled';
  $('word').disabled=true;$('word-style').disabled=true;$('word-status').textContent='Preparant el Word…';
  try{
    const file=await createDocx(paper,{language:book.manifest.language,compact:$('density').value==='compact',styled});
    if(state.paper!==paper)return;
    const url=URL.createObjectURL(file),link=el('a');
    link.href=url;link.download=`${title} - ${suffix}.docx`;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    $('word-status').textContent='Word generat.';
  }catch(error){
    if(state.paper===paper)$('word-status').textContent=error.message||'No s’ha pogut generar el Word.';
  }finally{
    if(state.paper===paper){$('word').disabled=false;$('word-style').disabled=false;}
  }
});
$('pdf-cancel').addEventListener('click',()=>$('pdf-notice').close());
$('pdf-continue').addEventListener('click',()=>{$('pdf-notice').close();if(state.ready)pagination.print();});
$('page-jump').addEventListener('click',()=>{const number=Number($('page-go').value);if(Number.isFinite(number))pagination.goTo(Math.round(number));});
window.addEventListener('pagehide',event=>{if(!event.persisted)state.urls.forEach(url=>URL.revokeObjectURL(url));});
clear();
