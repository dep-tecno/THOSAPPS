import {safePath,parseJson} from './zip.mjs';
export const blockTypes=new Set(['paragraph','heading','list','table','formula','figure','example','question','note','variant']);
const text=x=>typeof x==='string'&&x.trim().length>0;
const strings=x=>Array.isArray(x)&&x.every(v=>typeof v==='string');
export function flatten(blocks){return blocks.flatMap(b=>b&&typeof b==='object'?[b,...(b.type==='variant'&&Array.isArray(b.blocks)?flatten(b.blocks):[])]:[]);}
export function validateBook(book,zip){
  const errors=[],warnings=[],ids=new Set(),byId=new Map(),questions=new Map(),answers=new Map(),resources=new Set();
  const issue=(id,msg)=>errors.push({id,message:msg});
  const claim=(id,kind)=>{if(!text(id))issue('',`Falta identificador de ${kind}.`);else if(ids.has(id))issue(id,'Identificador duplicat.');else ids.add(id);};
  const resource=(path,id)=>{if(!safePath(path)||!zip.has(path))issue(id,'Recurs absent o ruta no segura: '+path);else resources.add(path);};
  function inspect(b,previous){
    if(!b||typeof b!=='object'||Array.isArray(b)){issue('','Bloc invàlid.');return;}
    claim(b.id,'bloc');byId.set(b.id,b);
    if(!blockTypes.has(b.type))issue(b.id,'Tipus de bloc no compatible: '+b.type);
    if(['paragraph','heading','note'].includes(b.type)&&!text(b.text))issue(b.id,'Falta text.');
    if(b.type==='heading'&&(!Number.isInteger(b.level)||b.level<1||b.level>6))issue(b.id,'Nivell de títol invàlid.');
    if(b.type==='list'&&!strings(b.items))issue(b.id,'Llista: cal un array de textos simples.');
    if(b.type==='table'&&(!strings(b.columns)||!b.columns.length||!Array.isArray(b.rows)||!b.rows.every(r=>strings(r)&&r.length===b.columns.length)))issue(b.id,'Taula: files o columnes incompatibles.');
    if(b.type==='formula'&&(!text(b.latex)||!text(b.fallbackText)))issue(b.id,'Fórmula sense latex o fallbackText llegible.');
    if(b.type==='formula'&&/\[\[\d+\]\]/.test(String(b.latex)+' '+String(b.fallbackText)))errors.push({id:b.id,previewSafe:true,message:'Fórmula incompleta: conté un marcador intern de l’exportador sense resoldre. Cal corregir el TAPP d’origen.'});
    if(b.type==='figure'){resource(b.src,b.id);if(!text(b.alt))issue(b.id,'Figura sense text alternatiu.');}
    if(b.type==='example'&&(!text(b.title)||!strings(b.steps)||!b.steps.length))issue(b.id,'Exemple sense títol o passos de text ordenats.');
    if(b.contextBlockIds!==undefined){
      if(!strings(b.contextBlockIds)||new Set(b.contextBlockIds).size!==b.contextBlockIds.length)issue(b.id,'Referències de context invàlides.');
      else {const order=[...previous.keys()];let last=-1;for(const id of b.contextBlockIds){const index=order.indexOf(id);if(index<0||index<=last)issue(b.id,'Context absent, posterior o fora d’ordre: '+id);last=index;}}
    }
    if(b.figureSrc!==undefined){resource(b.figureSrc,b.id);if(!(b.contextBlockIds||[]).some(id=>previous.get(id)?.type==='figure'&&previous.get(id).src===b.figureSrc))issue(b.id,'figureSrc no coincideix amb el context declarat.');}
    if(b.type==='question'){
      if(!text(b.questionId)||questions.has(b.questionId))issue(b.id,'questionId absent o duplicat.');else questions.set(b.questionId,b);
      if(!text(b.prompt))issue(b.id,'Pregunta sense enunciat.');
      if(b.stage!==undefined&&!['practice','final'].includes(b.stage))issue(b.id,'Etapa d’avaluació no compatible.');
      if(b.points!==undefined&&(!Number.isFinite(b.points)||b.points<0))issue(b.id,'Puntuació invàlida.');
      if(b.questionType==='single-choice'||b.questionType==='multiple-choice'){
        const options=b.options;
        if(!Array.isArray(options)||options.length<2||options.some(o=>!o||!text(o.id)||!text(o.text))||new Set(options.map(o=>o?.id)).size!==options.length)issue(b.id,'Opcions absents o identificadors duplicats.');
      }else if(b.questionType==='numeric'){if(!text(b.unit))issue(b.id,'Pregunta numèrica sense unitat.');}
      else issue(b.id,'Manca esquema per al tipus d’activitat: '+b.questionType);
    }
    if(b.type==='variant'){
      if(!text(b.label)||!Array.isArray(b.blocks)||!b.blocks.length)issue(b.id,'Variant incompleta.');
      else {const local=new Map(previous);for(const child of b.blocks){inspect(child,local);if(child)local.set(child.id,child);}}
    }
  }
  for(const ch of book.content.chapters){
    if(!ch||typeof ch!=='object'){issue('','Capítol invàlid.');continue;}
    claim(ch.id,'capítol');if(!text(ch.title))issue(ch.id,'Capítol sense títol.');
    if(!Array.isArray(ch.sections)){issue(ch.id,'Capítol sense seccions.');continue;}
    for(const sec of ch.sections){
      if(!sec||typeof sec!=='object'){issue(ch.id,'Secció invàlida.');continue;}
      claim(sec.id,'secció');if(!text(sec.title))issue(sec.id,'Secció sense títol.');
      if(!Array.isArray(sec.blocks)){issue(sec.id,'Secció sense blocs.');continue;}
      const previous=new Map();for(const b of sec.blocks){inspect(b,previous);if(b){if(b.group!==undefined&&b.group!==sec.id)issue(b.id,'Grup diferent de la secció.');previous.set(b.id,b);}}
    }
  }
  for(const a of book.solutions.answers){
    if(!a||!text(a.questionId)){issue('','Resposta sense questionId.');continue;}
    if(answers.has(a.questionId))issue(a.questionId,'Resposta duplicada.');answers.set(a.questionId,a);
    const q=questions.get(a.questionId);if(!q){issue(a.questionId,'Resposta òrfena.');continue;}
    if(q.questionType==='single-choice'||q.questionType==='multiple-choice'){
      if(!strings(a.correctOptionIds)||!a.correctOptionIds.length||new Set(a.correctOptionIds).size!==a.correctOptionIds.length||
        (q.questionType==='single-choice'&&a.correctOptionIds.length!==1)||a.correctOptionIds.some(id=>!q.options?.some(o=>o.id===id)))issue(q.id,'Clau d’opcions invàlida.');
    }else if(q.questionType==='numeric'&&(!Number.isFinite(a.expectedValue)||!Number.isFinite(a.tolerance)||a.tolerance<0||a.unit!==q.unit||!text(a.rounding)))issue(q.id,'Clau numèrica incompleta o inconsistent.');
    if(!text(a.explanation))issue(q.id,'Solució sense justificació.');
    if(a.feedback!==undefined&&(!a.feedback||Object.values(a.feedback).some(v=>typeof v!=='string')))issue(q.id,'Feedback incompatible.');
    if(a.figureSrc!==undefined)resource(a.figureSrc,q.id);
    if(a.figures!==undefined){if(!Array.isArray(a.figures))issue(q.id,'Figures de correcció invàlides.');else for(const f of a.figures){if(f?.type!=='figure')issue(q.id,'La correcció conté un bloc que no és una figura.');else inspect(f,new Map());}}
  }
  for(const [id,q] of questions)if(!answers.has(id))issue(q.id,'Pregunta sense solució: '+id);
  const blocks=[...byId.values()];
  const inventory={chapters:book.content.chapters.length,sections:book.content.chapters.reduce((n,c)=>n+(c?.sections?.length||0),0),
    blocks:blocks.length,figures:blocks.filter(b=>b.type==='figure').length,questions:questions.size,examples:blocks.filter(b=>b.type==='example').length,
    variants:blocks.filter(b=>b.type==='variant').length,answers:answers.size,resources:resources.size};
  return {errors,warnings,byId,questions,answers,resources,inventory};
}
export async function importBook(zip,validateScorm){
  if(!zip.has('imsmanifest.xml'))throw Error('No s’ha trobat imsmanifest.xml a l’arrel.');
  await validateScorm(new TextDecoder('utf-8',{fatal:true}).decode(await zip.get('imsmanifest.xml')),zip);
  if(!zip.has('tapp/manifest.json'))throw Error('Format encara no compatible: el SCORM no inclou TAPP.');
  const manifest=parseJson(await zip.get('tapp/manifest.json'),'tapp/manifest.json');
  if(manifest?.protocol!=='TAPP'||!/^1\.0\.\d+$/.test(manifest.version))throw Error('Versió TAPP no compatible.');
  if(!text(manifest.bookId)||!text(manifest.title)||!text(manifest.language)||manifest.source?.standard!=='SCORM'||manifest.source?.version!=='1.2'||
    !safePath(manifest.source?.entry)||!zip.has(manifest.source.entry)||manifest.print?.defaultPageSize!=='A4'||manifest.print?.orientation!=='portrait')throw Error('Metadades TAPP incompletes o preferències d’impressió incompatibles.');
  if(!safePath(manifest.files?.content)||!safePath(manifest.files?.solutions))throw Error('Rutes TAPP no vàlides.');
  const content=parseJson(await zip.get(manifest.files.content),manifest.files.content),solutions=parseJson(await zip.get(manifest.files.solutions),manifest.files.solutions);
  if(content?.bookId!==manifest.bookId||solutions?.bookId!==manifest.bookId)throw Error('Els bookId no coincideixen.');
  if(!Array.isArray(content.chapters)||!content.chapters.length||!Array.isArray(solutions.answers))throw Error('Estructura TAPP incompleta.');
  const book={manifest,content,solutions};return {book,report:validateBook(book,zip)};
}
// Keep referenced context once, in source order; retain variants containing questions.
export function solutionBlocks(blocks){
  const required=new Set();
  function collect(b){if(b.type==='question'){required.add(b.id);for(const id of b.contextBlockIds||[])required.add(id);}if(b.type==='variant')for(const child of b.blocks)collect(child);}
  blocks.forEach(collect);
  let changed=true;while(changed){changed=false;for(const b of flatten(blocks))if(required.has(b.id))for(const id of b.contextBlockIds||[])if(!required.has(id)){required.add(id);changed=true;}}
  function select(b){if(b.type==='variant'){const children=b.blocks.map(select).filter(Boolean);if(children.length)return {...b,blocks:children};}return required.has(b.id)?b:null;}
  return blocks.map(select).filter(Boolean);
}
