import {pdfName} from './core.mjs';
import {fitField,exportForm} from './forms-core.mjs';
const $=id=>document.getElementById(id);
const names={text:'Text',checkbox:'Casella',radio:'Opció',dropdown:'Desplegable'};
export function initFormsEditor() {
  let source=null,pdf=null,loading=null,renderTask=null,fields=[],viewports=[],selected=null,tool='select',pageIndex=0,serial=0,working=false,externalBusy=false,rendering=false,loadId=0,renderId=0,downloadURL=null,drag=null;
  const selectedField=()=>fields.find(field=>field.id===selected);
  const tell=(message,error=false)=>{$('forms-status').textContent=message;$('forms-status').classList.toggle('error',error);};
  function clearDownload(){if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=null;$('forms-download').replaceChildren();$('forms-download').hidden=true;}
  function controls(){
    $('forms-input').disabled=working||externalBusy;
    $('forms-workspace').disabled=working||externalBusy;
    $('form-export').disabled=working||externalBusy||rendering||!source||!fields.length;
    $('form-prev').disabled=working||externalBusy||rendering||pageIndex===0;
    $('form-next').disabled=working||externalBusy||rendering||!pdf||pageIndex+1>=pdf.numPages;
    $('form-page').disabled=working||externalBusy||rendering;
    $('form-properties').disabled=working||externalBusy||!selectedField();
    $('form-stage').classList.toggle('is-loading',working||externalBusy||rendering);
  }
  document.addEventListener('thospdf-busy',event=>{externalBusy=event.detail;controls();});
  function setTool(value){
    tool=value;
    document.querySelectorAll('[data-form-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.formTool===tool)));
    $('form-stage').classList.toggle('placing',tool!=='select');
    $('forms-tip').textContent=tool==='select'?'Selecciona un camp per editar-lo o arrossega’l per moure’l.':`Clica sobre la pàgina per afegir: ${names[tool].toLowerCase()}.`;
  }
  document.querySelectorAll('[data-form-tool]').forEach(button=>button.onclick=()=>setTool(button.dataset.formTool));
  function syncProperties(){
    const field=selectedField(); $('form-properties').hidden=!field;
    if(!field){controls();return;}
    $('form-field-name').value=field.name;
    $('form-initial-wrap').hidden=field.type!=='text'; $('form-multiline-wrap').hidden=field.type!=='text';
    $('form-options-wrap').hidden=field.type!=='dropdown'; $('form-radio-wrap').hidden=field.type!=='radio';
    $('form-initial').value=field.initial||''; $('form-multiline').checked=!!field.multiline;
    $('form-options').value=(field.options||[]).join('\n'); $('form-radio-group').value=field.group||''; $('form-radio-value').value=field.option||'';
    $('form-x').value=(field.x*100).toFixed(1); $('form-y').value=(field.y*100).toFixed(1); $('form-width').value=(field.w*100).toFixed(1); $('form-height').value=(field.h*100).toFixed(1); $('form-required').checked=!!field.required;
    controls();
  }
  function paint(){
    $('form-count').textContent=`Camps afegits (${fields.length})`; $('form-empty').hidden=fields.length>0;
    $('form-fields').replaceChildren(); $('form-overlays').replaceChildren();
    for(const field of fields){
      const label=field.name||names[field.type];
      const entry=document.createElement('button');entry.type='button';entry.className='form-list-item';entry.textContent=`${label} · pàg. ${field.page+1}`;entry.setAttribute('aria-pressed',String(field.id===selected));
      entry.onclick=async()=>{selected=field.id;setTool('select');if(pageIndex!==field.page)await showPage(field.page);paint();syncProperties();};$('form-fields').append(entry);
      if(field.page!==pageIndex)continue;
      const box=document.createElement('div');box.className=`form-overlay ${field.type}${selected===field.id?' chosen':''}`;box.dataset.id=String(field.id);box.tabIndex=0;box.setAttribute('role','button');box.setAttribute('aria-label',`${names[field.type]}: ${label}`);box.setAttribute('aria-pressed',String(selected===field.id));
      Object.assign(box.style,{left:`${field.x*100}%`,top:`${field.y*100}%`,width:`${field.w*100}%`,height:`${field.h*100}%`});
      const content=document.createElement('span');content.textContent=field.type==='checkbox'?'✓':field.type==='radio'?'●':(field.type==='dropdown'?'▾ ':'')+(field.initial||label);box.append(content);
      const handle=document.createElement('span');handle.className='resize-handle';handle.title='Arrossega per canviar la mida';box.append(handle);$('form-overlays').append(box);
    }
    controls();
  }
  function changeSelected(update){const field=selectedField();if(!field)return;Object.assign(field,update);clearDownload();paint();}
  for(const [id,key] of [['form-field-name','name'],['form-initial','initial'],['form-radio-group','group'],['form-radio-value','option']])$(id).oninput=()=>changeSelected({[key]:$(id).value});
  $('form-options').oninput=()=>changeSelected({options:$('form-options').value.split('\n').map(value=>value.trim()).filter(Boolean)});
  $('form-multiline').onchange=()=>changeSelected({multiline:$('form-multiline').checked});
  $('form-required').onchange=()=>changeSelected({required:$('form-required').checked});
  for (const [id,key] of [['form-x','x'],['form-y','y'],['form-width','w'],['form-height','h']]) {
    const input = $(id);
    input.oninput = () => {
      const field = selectedField();
      const value = input.valueAsNumber / 100;
      if (!field || !Number.isFinite(value) || value < 0) return;
      changeSelected(fitField({...field,[key]:value}));
    };
    input.onchange = syncProperties;
  }
  $('form-delete').onclick=()=>{fields=fields.filter(field=>field.id!==selected);selected=null;clearDownload();paint();syncProperties();};
  $('form-duplicate').onclick=()=>{
    const old=selectedField();if(!old)return;
    const id=++serial,field=fitField({...old,id,name:`${names[old.type]} ${id}`,option:old.type==='radio'?`Opció ${id}`:old.option,x:old.x+.025,y:old.y+.025,options:old.options?.slice()});
    fields.push(field);selected=id;clearDownload();paint();syncProperties();
  };
  function addField(x,y){
    const viewport=viewports[pageIndex],small=tool==='checkbox'||tool==='radio',id=++serial;
    const field=fitField({id,page:pageIndex,type:tool,name:`${names[tool]} ${id}`,x,y,w:small?18/viewport.width:.3,h:small?18/viewport.height:.045,initial:'',options:tool==='dropdown'?['Opció 1','Opció 2']:[],group:tool==='radio'?'Grup 1':'',option:`Opció ${id}`,multiline:false,required:false});
    fields.push(field);selected=id;clearDownload();setTool('select');paint();syncProperties();tell('Camp afegit. Pots arrossegar-lo, canviar-ne la mida i editar-ne les propietats.');
  }
  const stage=$('form-stage');
  stage.addEventListener('pointerdown',event=>{
    if(working||externalBusy||rendering||!source||event.button!==0)return;
    const bounds=stage.getBoundingClientRect(),box=event.target.closest('.form-overlay');
    if(box){
      const field=fields.find(item=>item.id===Number(box.dataset.id));selected=field.id;
      drag={id:field.id,x:event.clientX,y:event.clientY,original:{...field},width:bounds.width,height:bounds.height,resize:!!event.target.closest('.resize-handle')};
      stage.setPointerCapture(event.pointerId);event.preventDefault();paint();syncProperties();
    }else if(tool!=='select')addField((event.clientX-bounds.left)/bounds.width,(event.clientY-bounds.top)/bounds.height);
    else{selected=null;paint();syncProperties();}
  });
  stage.addEventListener('pointermove',event=>{
    if(!drag)return;
    const field=fields.find(item=>item.id===drag.id);if(!field)return;
    const dx=(event.clientX-drag.x)/drag.width,dy=(event.clientY-drag.y)/drag.height;
    const candidate=drag.resize?{...drag.original,w:Math.max(.01,Math.min(1-drag.original.x,drag.original.w+dx)),h:Math.max(.01,Math.min(1-drag.original.y,drag.original.h+dy))}:{...drag.original,x:drag.original.x+dx,y:drag.original.y+dy};
    Object.assign(field,fitField(candidate));clearDownload();paint();syncProperties();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,()=>{drag=null;});
  stage.addEventListener('keydown',event=>{
    const box=event.target.closest('.form-overlay');if(!box||working||externalBusy)return;
    const field=fields.find(item=>item.id===Number(box.dataset.id));selected=field.id;
    if(event.key==='Enter'||event.key===' '){event.preventDefault();paint();syncProperties();$('form-field-name').focus();return;}
    if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();$('form-delete').click();return;}
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;
    event.preventDefault();const bounds=stage.getBoundingClientRect(),step=event.shiftKey?10:1;
    Object.assign(field,fitField({...field,x:field.x+delta[0]*step/bounds.width,y:field.y+delta[1]*step/bounds.height}));clearDownload();paint();syncProperties();
    $('form-overlays').querySelector(`[data-id="${field.id}"]`)?.focus();
  });
  async function showPage(index){
    const current=++renderId;renderTask?.cancel();pageIndex=index;rendering=true;controls();$('form-page').value=String(index);$('form-overlays').replaceChildren();
    try{
      const page=await pdf.getPage(index+1);if(current!==renderId)return;
      const viewport=page.getViewport({scale:Math.min(2,1400/viewports[index].width)}),canvas=$('form-canvas');
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.setAttribute('aria-label',`Pàgina ${index+1} del PDF de base`);
      stage.style.aspectRatio=`${viewport.width} / ${viewport.height}`;
      renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;
      if(current!==renderId)return;
      paint();
    }catch(error){if(current===renderId&&error.name!=='RenderingCancelledException')tell('No s’ha pogut dibuixar aquesta pàgina. Torna a seleccionar-la o obre un altre PDF.',true);}
    finally{if(current===renderId){rendering=false;renderTask=null;controls();}}
  }
  $('form-prev').onclick=()=>void showPage(pageIndex-1);$('form-next').onclick=()=>void showPage(pageIndex+1);$('form-page').onchange=()=>void showPage(Number($('form-page').value));
  $('forms-input').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    const current=++loadId;++renderId;renderTask?.cancel();if(loading)void loading.destroy().catch(()=>{});
    source=null;pdf=null;fields=[];selected=null;serial=0;viewports=[];clearDownload();$('forms-workspace').hidden=true;$('forms-info').textContent='Cap document seleccionat';working=true;controls();tell(`Llegint ${file.name}…`);
    try{
      if(!globalThis.PDFLib)throw new Error('No s’ha pogut carregar el motor PDF. Torna a obrir l’app.');
      if(!/\.pdf$/i.test(file.name))throw new Error('Selecciona un fitxer PDF.');
      const bytes=new Uint8Array(await file.arrayBuffer());
      let check;try{check=await PDFLib.PDFDocument.load(bytes.slice());}catch{throw new Error('No es pot obrir el PDF. Comprova que sigui vàlid i que no estigui protegit amb contrasenya.');}
      const existing=check.getForm();if(existing.hasXFA())throw new Error('Els formularis XFA no són compatibles amb aquest editor.');
      const pdfjs=await import('./vendor/pdfjs/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
      loading=pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false,useWasm:false});const loaded=await loading.promise;
      if(current!==loadId)return;if(!loaded.numPages)throw new Error('Aquest PDF no conté pàgines.');
      for(let i=0;i<loaded.numPages;i++){const page=await loaded.getPage(i+1),viewport=page.getViewport({scale:1});viewports.push({width:viewport.width,height:viewport.height,transform:[...viewport.transform],rotation:viewport.rotation});}
      source=bytes;pdf=loaded;$('form-page').replaceChildren();
      for(let i=0;i<pdf.numPages;i++){const option=document.createElement('option');option.value=String(i);option.textContent=`${i+1} de ${pdf.numPages}`;$('form-page').append(option);}
      $('forms-info').textContent=`${file.name} · ${pdf.numPages} pàgines${existing.getFields().length?' · Els camps existents es conserven; l’editor modifica els camps nous.':''}`;
      $('forms-name').value=file.name.replace(/\.pdf$/i,'')+'-formulari.pdf';$('forms-workspace').hidden=false;setTool('select');syncProperties();await showPage(0);tell('PDF preparat. Tria un tipus de camp i clica sobre la pàgina.');
    }catch(error){tell(error.message||'No s’ha pogut preparar el PDF.',true);source=null;pdf=null;$('forms-workspace').hidden=true;}
    finally{if(current===loadId){working=false;controls();}}
  };
  $('form-export').onclick=async()=>{
    if(!source||working||externalBusy)return;
    working=true;clearDownload();controls();tell('Creant el formulari emplenable…');
    try{
      const bytes=await exportForm(PDFLib,source,fields,viewports);downloadURL=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
      const link=document.createElement('a');link.href=downloadURL;link.download=pdfName($('forms-name').value);link.textContent=`↓ Descarrega ${link.download}`;$('forms-download').append(link);$('forms-download').hidden=false;
      tell('Formulari creat. Descarrega’l i obre’l amb un lector de PDF per emplenar-lo.');
    }catch(error){tell(error.message||'No s’ha pogut crear el formulari.',true);}
    finally{working=false;controls();}
  };
  $('forms-name').oninput=clearDownload;
  window.addEventListener('pagehide',()=>{if(downloadURL)URL.revokeObjectURL(downloadURL);});controls();
}
