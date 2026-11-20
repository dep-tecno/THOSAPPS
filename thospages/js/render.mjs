import {solutionBlocks} from './model.mjs';
export function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node;}
function add(parent,tag,text,cls){const node=el(tag,cls,text);parent.append(node);return node;}
const number=n=>new Intl.NumberFormat('ca',{maximumFractionDigits:12}).format(n);
function formulaText(node,text){
  const notation=/([_^])(?:\{([^{}]+)\}|\(([^()]+)\))/g;let cursor=0;
  for(const match of text.matchAll(notation)){
    node.append(text.slice(cursor,match.index),el(match[1]==='_'?'sub':'sup','',match[2]??match[3]));cursor=match.index+match[0].length;
  }
  node.append(text.slice(cursor));
}
export function renderBlock(b,parent,context){
  const {report,resources,space}=context;
  const mode=context.mode==='end'?'student':context.mode;
  let node;
  switch(b.type){
    case 'paragraph':node=el('p','',b.text);break;
    case 'heading':node=el('h'+Math.min(6,Math.max(2,b.level)),'',b.text);break;
    case 'note':node=el('aside','note',b.text);break;
    case 'list':node=el('ul');for(const item of b.items)add(node,'li',item);break;
    case 'table':{
      node=el('div','table-wrap');const table=el('table');
      if(b.caption)add(table,'caption',b.caption);
      const head=el('thead'),row=el('tr');for(const col of b.columns){const cell=add(row,'th',col);cell.scope='col';}head.append(row);table.append(head);
      const body=el('tbody');for(const cells of b.rows){const tr=el('tr');for(const cell of cells)add(tr,'td',cell);body.append(tr);}table.append(body);node.append(table);break;
    }
    case 'formula':node=el('p','formula');formulaText(node,b.fallbackText);break;
    case 'figure':{
      node=el('figure','figure');const img=el('img');img.src=resources.get(b.src);img.alt=b.alt;img.loading='eager';img.decoding='sync';
      node.append(img);if(b.caption)add(node,'figcaption',b.caption);break;
    }
    case 'example':node=el('section','example');add(node,'h4',b.title);{const list=el('ol');for(const step of b.steps)add(list,'li',step);node.append(list);}break;
    case 'variant':node=el('section','variant');add(node,'h4',b.label);for(const child of b.blocks)renderBlock(child,node,context);break;
    case 'question':{
      node=el('section','question');
      if(b.stage)add(node,'p',b.stage==='final'?'Avaluació final':'Pràctica','question-stage');
      add(node,'h4',b.prompt);
      if(b.points!==undefined)add(node,'p',`${number(b.points)} punts`,'question-meta');
      if(b.options){const list=el('ul','options');for(const option of b.options)add(list,'li',`☐ ${option.id}) ${option.text}`);node.append(list);}
      if(b.unit)add(node,'p','Unitat de resposta: '+b.unit,'question-meta');
      if(mode!=='solutions'&&space)node.append(el('div','response-space'));
      if(mode!=='student'){
        const a=report.answers.get(b.questionId),answer=el('div','answer');add(answer,'h5','Solució');
        if(a.correctOptionIds)for(const id of a.correctOptionIds){const option=b.options.find(o=>o.id===id);add(answer,'p',`${id}) ${option.text}`);}
        if(a.expectedValue!==undefined){add(answer,'p',`${number(a.expectedValue)} ${a.unit}`);add(answer,'p',`Tolerància absoluta: ±${number(a.tolerance)} ${a.unit}.`);add(answer,'p',a.rounding);}
        add(answer,'p',a.explanation);
        for(const [key,value] of Object.entries(a.feedback||{}))if(value!==a.explanation)add(answer,'p',`${key==='correct'?'En cas d’encert':key==='incorrect'?'Per revisar':key}: ${value}`);
        // figureSrc is the support figure, already placed by contextBlockIds.
        if(a.figureSrc&&!(b.contextBlockIds||[]).some(id=>report.byId.get(id)?.src===a.figureSrc))renderBlock({type:'figure',id:b.id+'-support',src:a.figureSrc,alt:'Figura de suport de la solució'},answer,context);
        for(const figure of a.figures||[])renderBlock(figure,answer,context);
        node.append(answer);
      }
      break;
    }
    default:node=el('p','placeholder','Bloc no compatible: '+b.type);
  }
  node.dataset.blockId=b.id;
  const issues=report.errors.filter(issue=>issue.id===b.id);
  if(issues.length){node.classList.add('content-issue');for(const issue of issues)add(node,'span','Incidència: '+issue.message,'issue-message');}
  parent.append(node);return node;
}
export function renderDocument(book,report,resources,options){
  const paper=el('article','paper'+(options.compact?' compact':''));
  paper.dataset.layout=options.layout==='two'?'two':'one';
  paper.dataset.orientation=options.orientation==='landscape'?'landscape':'portrait';
  const context={mode:options.mode,space:options.space,report,resources};
  const chapters=book.content.chapters;
  const title=options.mode==='student'?'Llibre sense solucions':options.mode==='end'?'Llibre amb solucions en fulls al final':'Llibre amb solucions al costat de cada exercici';
  if(options.cover){const cover=el('section','cover');add(cover,'h1',book.manifest.title);add(cover,'p',title);paper.append(cover);}
  if(options.toc){const toc=el('nav','toc');add(toc,'h2','Índex');const list=el('ol');chapters.forEach((ch,i)=>{const item=el('li'),link=add(item,'a',ch.title);link.href='#chapter-'+i;list.append(item);});toc.append(list);paper.append(toc);}
  chapters.forEach((ch,i)=>{const chapter=el('section','chapter'+(!options.breaks||i===0?' first':''));chapter.id='chapter-'+i;add(chapter,'h2',ch.title);
    for(const sec of ch.sections){const section=el('section');add(section,'h3',sec.title);for(const b of sec.blocks)renderBlock(b,section,context);chapter.append(section);}paper.append(chapter);});
  if(options.mode==='end'){
    const annex=el('section','solutions-annex');annex.id='exercise-solutions';add(annex,'h2','Solucions dels exercicis');
    let count=0;
    for(const ch of book.content.chapters){
      const chapter=el('section'),sections=[];
      for(const sec of ch.sections){
        const blocks=solutionBlocks(sec.blocks);
        if(!blocks.length)continue;
        const section=el('section');add(section,'h3',sec.title);
        for(const b of blocks)renderBlock(b,section,{...context,mode:'solutions'});
        sections.push(section);count++;
      }
      if(sections.length){add(chapter,'h3',ch.title);chapter.append(...sections);annex.append(chapter);}
    }
    if(count){paper.append(annex);if(options.toc){const tocList=paper.querySelectorAll('ol')[0];const item=el('li'),link=add(item,'a','Solucions dels exercicis');link.href='#exercise-solutions';tocList.append(item);}}
  }
  return paper;
}
