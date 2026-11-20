// Trusted, local Paged.js runs in a separate document so its CSS cannot alter the UI.
const engineURL=new URL('../vendor/pagedjs/paged-0.4.3.min.js',import.meta.url).href;
const stylesheetURL=new URL('../print.css',import.meta.url).href;
function aborted(){return new DOMException('Paginació cancel·lada.','AbortError');}
function waitFor(promise,signal){
  if(signal.aborted)return Promise.reject(aborted());
  return new Promise((resolve,reject)=>{
    const cancel=()=>reject(aborted());signal.addEventListener('abort',cancel,{once:true});
    Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',cancel));
  });
}
export function createFrame(container){
  const frame=document.createElement('iframe');frame.className='pages-frame';frame.title='Document A4 paginat';
  frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-modals');
  container.replaceChildren(frame);
  const doc=frame.contentDocument,win=frame.contentWindow;
  doc.open();doc.write('<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>THOSPAGES · Document imprimible</title></head><body></body></html>');doc.close();
  const style=doc.createElement('style');
  style.textContent=`@media screen {
    html,body{margin:0;background:#102e40}
    body{padding:14px 0 30px}
    .pagedjs_pages{width:max-content;margin:auto;zoom:var(--page-scale,1)}
    .pagedjs_page{background:white;margin:0 auto 28px;box-shadow:0 4px 18px #061a2870}
  }
  @media print{.pagedjs_pages{zoom:1!important}.pagedjs_page{box-shadow:none!important;margin:0!important}}`;
  doc.head.append(style);
  const script=doc.createElement('script');script.src=engineURL;
  const ready=new Promise((resolve,reject)=>{script.onload=()=>resolve();script.onerror=()=>reject(Error('No es pot carregar el motor local de paginació.'));});
  doc.head.append(script);
  return {frame,doc,win,ready,screenStyle:style,dispose:()=>frame.remove()};
}
export function verifyPaginatedContent(source,pages){
  const rendered=new Map(),expectedBlocks=new Map();
  for(const page of pages)for(const node of page.querySelectorAll('[data-block-id]')){
    const id=node.dataset.blockId;rendered.set(id,(rendered.get(id)||'')+node.textContent);
  }
  const normalized=text=>text.replace(/\s+/g,'');
  for(const node of source.querySelectorAll('[data-block-id]'))expectedBlocks.set(node.dataset.blockId,(expectedBlocks.get(node.dataset.blockId)||'')+node.textContent);
  for(const [id,text] of expectedBlocks){
    const expected=normalized(text),actual=normalized(rendered.get(id)||'');
    // Repeated table headers may insert text, but every source character must survive in order.
    let position=0;for(const character of actual)if(character===expected[position])position++;
    if(!rendered.has(id)||position<expected.length)throw Error('La paginació no ha conservat tot el bloc: '+id);
  }
  const imageCounts=new Map();
  for(const img of pages.flatMap(page=>[...page.querySelectorAll('img')]))imageCounts.set(img.src,(imageCounts.get(img.src)||0)+1);
  for(const img of source.querySelectorAll('img')){const count=imageCounts.get(img.src)||0;if(!count)throw Error('La paginació ha omès una figura.');imageCounts.set(img.src,count-1);}
}
export class PagedPreview{
  constructor(container,{factory=createFrame}={}){this.container=container;this.factory=factory;this.pages=[];this.view=null;}
  clear(){this.controller?.abort();this.view?.dispose();this.view=null;this.pages=[];}
  async render(source,{onProgress=()=>{}}={}){
    this.clear();const controller=new AbortController();this.controller=controller;
    const {signal}=controller,view=this.factory(this.container);this.view=view;
    try{
      await waitFor(view.ready,signal);
      const engine=view.win.PagedModule;
      if(!engine?.Previewer)throw Error('Motor de paginació local no disponible.');
      const content=view.doc.createDocumentFragment(),copy=view.doc.importNode(source,true);content.append(copy);
      await waitFor(Promise.all([...copy.querySelectorAll('img')].map(img=>img.decode())),signal);
      if(view.doc.fonts)await waitFor(view.doc.fonts.ready,signal);
      const previewer=new engine.Previewer();let count=0;
      previewer.on('page',()=>{onProgress(++count);});
      const flow=await waitFor(previewer.preview(content,[stylesheetURL],view.doc.body),signal);
      const pages=[...view.doc.querySelectorAll('.pagedjs_page')];
      if(!pages.length||flow.pages.length!==pages.length)throw Error('El motor no ha paginat correctament el document.');
      verifyPaginatedContent(source,pages);
      this.pages=pages;
      if(view.screenStyle)view.doc.head.append(view.screenStyle);
      const fit=()=>{
        const width=pages[0].getBoundingClientRect().width/Number(view.doc.documentElement.style.getPropertyValue('--page-scale')||1);
        view.doc.documentElement.style.setProperty('--page-scale',Math.min(1,Math.max(.2,(view.frame.clientWidth-28)/width)));
      };
      fit();view.win.addEventListener('resize',fit);
      return {count:pages.length};
    }catch(error){if(!signal.aborted){view.dispose();if(this.view===view)this.view=null;}throw error;}
  }
  goTo(number){this.pages[Math.max(0,Math.min(this.pages.length-1,number-1))]?.scrollIntoView({block:'start',behavior:'smooth'});}
  print(){if(!this.view||!this.pages.length)throw Error('No hi ha pàgines preparades.');this.view.win.focus();this.view.win.print();}
}
