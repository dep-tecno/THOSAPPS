// THOSsCAN — una pestanya per taula. Scribe.js 0.17.0 (AGPL-3.0).
import ocr from 'scribe.js-ocr/js/objects/ocrObjects.js';
import { fixXlsxDimensions } from './xlsx-dimensions.js';

async function checkpoint(signal) {
  signal?.throwIfAborted();
  await new Promise(resolve=>setTimeout(resolve,0));
  signal?.throwIfAborted();
}
function richCell(words) {
  const lines=[];
  for(const word of [...words].sort((a,b)=>a.bbox.top-b.bbox.top||a.bbox.left-b.bbox.left)) {
    let line=lines.find(line=>Math.min(line.bottom,word.bbox.bottom)-Math.max(line.top,word.bbox.top)
      >Math.min(line.bottom-line.top,word.bbox.bottom-word.bbox.top)*0.5);
    if(!line){line={top:word.bbox.top,bottom:word.bbox.bottom,words:[]};lines.push(line);}
    line.words.push(word);
  }
  const runs=[];
  lines.forEach((line,li)=>{
    line.words.sort((a,b)=>a.bbox.left-b.bbox.left);
    line.words.forEach((word,wi)=>{
      const segments=ocr.getWordStyleSegments(word)||[{start:0,end:word.text.length,style:word.style}];
      segments.forEach((seg,si)=>runs.push({
        text:(!si?(wi?' ':li?'\n':''):'')+word.text.slice(seg.start,seg.end),style:{...seg.style},
      }));
    });
  });
  return {text:runs.map(run=>run.text).join(''),runs};
}
const normalizeRow=row=>row.map(cell=>cell.text.replace(/\s+/g,' ').trim().toLowerCase()).join('\u001f');

function gridRowBounds(table, shapes) {
  if (table.detectionMethod !== 'grid-strong' || !shapes?.paths?.length) return table.rowBounds;
  const {left, top} = table.boxes[0].coords;
  const {right, bottom} = table.boxes.at(-1).coords;
  const width = right - left;
  const edgeTolerance = Math.max(2, width * 0.005);
  const rules = [];
  for (const path of shapes.paths) {
    for (const site of path.sites ?? []) {
      const thickness = site.bottom - site.top;
      const center = (site.bottom + site.top) / 2;
      // Accept only rules spanning the whole table, including both outer edges.
      if (Math.abs(site.left - left) > edgeTolerance || Math.abs(site.right - right) > edgeTolerance ||
          thickness > edgeTolerance || center < top - edgeTolerance || center > bottom + edgeTolerance) continue;
      rules.push(center);
    }
  }
  rules.sort((a, b) => a - b);
  // PDF generators can paint the same rule more than once.
  const edges = rules.filter((rule, index) => index === 0 || rule - rules[index - 1] > 2);
  if (edges.length < 3 || Math.abs(edges[0] - top) > edgeTolerance ||
      Math.abs(edges.at(-1) - bottom) > edgeTolerance) return table.rowBounds;
  return edges.slice(1);
}

export async function exportExcelTables(doc,scribe,{signal,onProgress}={}) {
  await checkpoint(signal);
  const chains=scribe.tableChains(doc.layoutDataTables.pages);
  const sheets=[];
  for(let i=0;i<chains.length;i++) {
    await checkpoint(signal);
    const chain=chains[i],rows=[];
    const headerRows=Math.max(0,chain[0].table.headerRows??1);
    for(const {table,n} of chain) {
      await checkpoint(signal);
      const page=doc.ocr.active[n];
      if(!page||!table.boxes.length)continue;
      const rowBounds=gridRowBounds(table,doc.fillShapes?.pages[n]);
      const extracted=scribe.utils.extractSingleTableContent(page,table.boxes,rowBounds);
      let fragment=extracted.rowWordArr.map(row=>row.map(richCell));
      // Only Scribe-linked continuation fragments may share/deduplicate headers.
      if(rows.length&&headerRows&&fragment.length>=headerRows&&rows.length>=headerRows) {
        const header=rows.slice(0,headerRows).map(normalizeRow);
        if(header.join('').length>=6&&fragment.slice(0,headerRows).every((row,h)=>normalizeRow(row)===header[h]))fragment=fragment.slice(headerRows);
      }
      rows.push(...fragment);
    }
    if(rows.some(row=>row.some(cell=>cell.text.trim())))sheets.push({
      name:`Taula ${sheets.length+1}`,rows,columnWidths:'auto',
      tableRanges:[{start:0,rowCount:rows.length,headerRows:Math.min(headerRows,rows.length),grid:true}],
    });
    onProgress?.({stage:'tables',completed:i+1,total:chains.length});
  }
  if(!sheets.length)throw new Error('No s’ha detectat cap taula. Desmarca «Una taula per pestanya» per provar la conversió habitual.');
  signal?.throwIfAborted();
  onProgress?.({stage:'packaging',total:sheets.length});
  signal?.throwIfAborted();
  const bytes=await scribe.utils.writeXlsxFromSheets(sheets);
  return fixXlsxDimensions(bytes, { signal });
}
