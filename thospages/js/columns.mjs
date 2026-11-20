// General A4 layout decisions, independent of book IDs and asset names.
export const COLUMN_PX=86.5*96/25.4, FULL_PX=180*96/25.4, MIN_LABEL_PX=11.33;
export function figureWidth(viewWidth,minFont,fullWidth=FULL_PX){
  const columnWidth=(fullWidth-7*96/25.4)/2;
  if(!Number.isFinite(viewWidth)||viewWidth<=0||!Number.isFinite(minFont)||minFont<=0)return {wide:true,width:FULL_PX};
  const readable=viewWidth*MIN_LABEL_PX/minFont;
  // Unknown/dense figures stay wide; never shrink below the readable estimate.
  return {wide:readable>columnWidth-40,width:Math.min(fullWidth,Math.max(180,readable))};
}
export async function prepareColumns(paper,view,{read=async url=>(await fetch(url)).text()}={}){
  if(paper.dataset.layout!=='two')return;
  const fullWidth=(paper.dataset.orientation==='landscape'?267:180)*96/25.4;
  const doc=view.doc,host=doc.createElement('div');
  host.style.cssText='position:absolute;left:-100000px;top:0;visibility:hidden;width:180mm;font:16px Arial,sans-serif';doc.body.append(host);
  const cache=new Map();
  function span(node){
    const owner=node.closest('.question, .example, .variant')||node;
    owner.classList.add('wide-block');
  }
  try{
    for(const image of paper.querySelectorAll('img')){
      let plan=cache.get(image.src);
      if(!plan){
        plan={wide:true,width:FULL_PX};
        if(image.src.startsWith('blob:')){
          const text=await read(image.src);
          // The resource URL was created only after SVG validation. Raster stays wide.
          if(text.trimStart().startsWith('<')){
            const parsed=new view.win.DOMParser().parseFromString(text,'image/svg+xml'),root=parsed.documentElement;
            if(root.localName==='svg'){
              const svg=doc.importNode(root,true),box=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
              if(box.length===4&&box[2]>0&&box[3]>0){
                svg.setAttribute('width',String(box[2]));svg.setAttribute('height',String(box[3]));host.append(svg);
                let minimum=Infinity;
                for(const label of svg.querySelectorAll('text,tspan'))if(label.textContent.trim()){
                  const size=parseFloat(view.win.getComputedStyle(label).fontSize),matrix=label.getCTM();
                  const scale=matrix?Math.hypot(matrix.a,matrix.b):1;
                  if(size>0&&scale>0)minimum=Math.min(minimum,size*scale);
                }
                plan=figureWidth(box[2],minimum,fullWidth);svg.remove();
              }
            }
          }
        }
        cache.set(image.src,plan);
      }
      image.style.setProperty('--figure-width',plan.width+'px');
      if(plan.wide)span(image.closest('figure'));
    }
    for(const table of paper.querySelectorAll('table'))if(table.querySelectorAll('thead th').length>3)span(table.closest('.table-wrap'));
    for(const formula of paper.querySelectorAll('.formula'))if(formula.textContent.length>55)span(formula);
    pairColumns(paper,doc);
  }finally{host.remove();}
}
// Bounded panels avoid nested multicol fragmentation inside Paged.js pages.
export function pairColumns(paper,doc){
  function arrange(parent){
    const children=[...parent.children];if(!children.length)return;
    parent.replaceChildren();let pending=null;
    function flush(){if(pending){parent.append(pending);pending=null;}}
    for(const node of children){
      if(node.matches('h1,h2,h3,.wide-block,.cover,.toc')){flush();parent.append(node);continue;}
      if(!node.dataset.blockId){flush();arrange(node);parent.append(node);continue;}
      if(node.textContent.length>600||node.querySelectorAll('li').length>8||node.querySelectorAll('img').length){flush();parent.append(node);continue;}
      if(!pending){pending=node;continue;}
      const pair=doc.createElement('div');pair.className='column-pair';
      for(const block of [pending,node]){const cell=doc.createElement('div');cell.className='column-cell';cell.append(block);pair.append(cell);}
      parent.append(pair);pending=null;
    }
    flush();
  }
  for(const chapter of paper.querySelectorAll('.chapter,.solutions-annex'))arrange(chapter);
}
