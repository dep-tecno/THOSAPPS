import {safePath} from './zip.mjs';
const svgNS='http://www.w3.org/2000/svg';
const tags=new Set('svg g defs style title desc path rect circle ellipse line polyline polygon text tspan marker linearGradient radialGradient stop clipPath mask pattern use symbol'.split(' '));
const attrs=new Set('id viewBox xmlns width height x y x1 y1 x2 y2 cx cy r rx ry d points dx dy fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity transform text-anchor dominant-baseline alignment-baseline font-family font-size font-weight font-style letter-spacing marker-start marker-mid marker-end markerWidth markerHeight markerUnits refX refY orient preserveAspectRatio gradientUnits gradientTransform offset stop-color stop-opacity clip-path clip-rule clipPathUnits mask maskUnits maskContentUnits patternUnits patternContentUnits patternTransform href class style role aria-label'.split(' '));
attrs.add('color');
function parseXML(source){
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw Error('XML amb DTD o entitats no admès.');
  if(/<\?(?!xml\s)/i.test(source))throw Error('Instruccions de processament XML no admeses.');
  const doc=new DOMParser().parseFromString(source,'application/xml');
  if(!doc.documentElement||doc.getElementsByTagName('parsererror').length)throw Error('XML mal format.');
  return doc;
}
export function validateScorm(source,zip){
  const doc=parseXML(source),root=doc.documentElement,nodes=[root,...root.getElementsByTagName('*')];
  const named=name=>nodes.filter(n=>n.localName===name);
  if(root.localName!=='manifest'||named('schemaversion')[0]?.textContent.trim()!=='1.2')throw Error('El manifest no declara SCORM 1.2.');
  if(named('organization').length!==1)throw Error('S’espera una organització SCORM.');
  const scos=named('resource').filter(n=>n.getAttributeNS('http://www.adlnet.org/xsd/adlcp_rootv1p2','scormtype')==='sco');
  if(scos.length!==1)throw Error('S’espera un únic SCO.');
  const sco=scos[0],entry=sco.getAttribute('href');
  if(!safePath(entry)||!zip.has(entry))throw Error('Entrada del SCO absent o insegura.');
  if(!named('item').some(n=>n.getAttribute('identifierref')===sco.getAttribute('identifier')))throw Error('El SCO no està vinculat a l’organització.');
  const declared=new Set();
  for(const n of named('file')){const path=n.getAttribute('href');if(!safePath(path)||!zip.has(path))throw Error('Fitxer SCORM absent o insegur: '+path);declared.add(path);}
  for(const path of zip.entries.keys())if(path.startsWith('tapp/')&&!path.endsWith('/')&&!declared.has(path))throw Error('Fitxer TAPP no declarat al manifest SCORM: '+path);
}
// Reject unsupported active features rather than stripping didactic content silently.
export function safeSvg(source){
  const doc=parseXML(source),root=doc.documentElement;
  if(root.localName!=='svg'||root.namespaceURI!==svgNS||!root.getAttribute('viewBox'))throw Error('SVG sense espai de noms o viewBox.');
  const nodes=[root,...root.getElementsByTagName('*')],ids=new Set(),refs=[];
  function checkValue(value){
    if(/[\\@]|\/\*|\*\/|expression\s*\(|(?:https?|data|javascript|file):/i.test(value))throw Error('SVG amb CSS o URL no segur.');
    let remainder=value.replace(/url\(\s*#([\w.-]+)\s*\)/g,(_,id)=>{refs.push(id);return '';});
    if(/url\s*\(/i.test(remainder))throw Error('SVG amb recurs extern o URL no compatible.');
  }
  for(const node of nodes){
    if(node.namespaceURI!==svgNS||!tags.has(node.localName))throw Error('Element SVG no admès: '+node.localName);
    for(const attr of node.attributes){
      if(!attrs.has(attr.name)||/^on/i.test(attr.name))throw Error('Atribut SVG no admès: '+attr.name);
      if(attr.name==='xmlns'){if(attr.value!==svgNS)throw Error('Espai de noms SVG no admès.');continue;}
      checkValue(attr.value);
      if(attr.name==='id'){if(ids.has(attr.value))throw Error('ID SVG duplicat.');ids.add(attr.value);}
      if(attr.name==='href'){if(!/^#[\w.-]+$/.test(attr.value))throw Error('Referència SVG externa.');refs.push(attr.value.slice(1));}
    }
    if(node.localName==='style'){
      const css=node.textContent;checkValue(css);
      // Only local presentation rules; no imports, fonts, escapes or CSS nesting.
      if(css.replace(/[^{}]+\{[^{}]*\}/g,'').trim())throw Error('CSS SVG no compatible.');
    }
  }
  if(refs.some(id=>!ids.has(id)))throw Error('Referència interna SVG absent.');
  return new XMLSerializer().serializeToString(root);
}
export async function prepareResources(report,zip,createURL=blob=>URL.createObjectURL(blob)){
  const resources=new Map(),urls=[];
  for(const path of report.resources){
    try{
      const bytes=await zip.get(path);let blob;
      if(/\.svg$/i.test(path))blob=new Blob([safeSvg(new TextDecoder('utf-8',{fatal:true}).decode(bytes))],{type:'image/svg+xml'});
      else {
        const png=bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
        const jpeg=bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
        if(!png&&!jpeg)throw Error('Només s’admeten SVG segurs, PNG i JPEG.');
        blob=new Blob([bytes],{type:png?'image/png':'image/jpeg'});
      }
      const url=createURL(blob);urls.push(url);resources.set(path,url);
    }catch(error){report.errors.push({id:path,message:`Recurs no representable: ${path}. ${error.message}`});}
  }
  return {resources,urls};
}
