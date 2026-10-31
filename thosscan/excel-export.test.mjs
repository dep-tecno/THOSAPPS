import test from 'node:test';
import assert from 'node:assert/strict';
import scribe from 'scribe.js-ocr';
import {OcrPage,OcrPar,OcrLine,OcrWord} from 'scribe.js-ocr/js/objects/ocrObjects.js';
import {LayoutDataTablePage} from 'scribe.js-ocr/js/objects/layoutObjects.js';
import {ZipReader,Uint8ArrayReader,TextWriter} from 'scribe.js-ocr/lib/zip.js/index.js';
import {exportExcelTables} from './excel-export.js';
let serial=0;
function fixture(specs){
  const pages=[],layouts=[];
  specs.forEach((tables,n)=>{
    const page=new OcrPage(n,{width:2480,height:3508});const layout=new LayoutDataTablePage(n);
    tables.forEach((spec,t)=>{
      const top=100+t*800;const table=new scribe.layout.LayoutDataTable(layout);
      table.continuesPrev=!!spec.continues;table.headerRows=1;
      for(let c=0;c<2;c++)table.boxes.push(new scribe.layout.LayoutDataColumn({left:100+c*500,right:600+c*500,top,bottom:top+spec.rows.length*150},table));
      table.rowBounds=spec.rows.map((_,r)=>top+(r+1)*150);
      spec.rows.forEach((row,r)=>row.forEach((text,c)=>String(text).split('\n').forEach((part,l)=>{
        if(!part)return;
        const bbox={left:120+c*500,right:500+c*500,top:top+r*150+15+l*45,bottom:top+r*150+50+l*45};
        const line=new OcrLine(page,bbox,[0,0]);line.par=new OcrPar(page,bbox);line.par.lines.push(line);
        const word=new OcrWord(line,String(++serial),part,bbox);word.style.bold=r===0;word.style.size=45;
        line.words.push(word);page.lines.push(line);page.pars.push(line.par);
      })));
      layout.tables.push(table);
    });pages.push(page);layouts.push(layout);
  });return {ocr:{active:pages},layoutDataTables:{pages:layouts}};
}
async function unzip(bytes){
  const reader=new ZipReader(new Uint8ArrayReader(bytes));const files={};
  for(const entry of await reader.getEntries())if(entry.filename.endsWith('.xml'))files[entry.filename]=await entry.getData(new TextWriter());
  await reader.close();return files;
}
test('two independent tables on one page produce two valid named worksheets',async()=>{
  const doc=fixture([[{rows:[['Nom','Valor'],['A','0012']]},{rows:[['Nom','Valor'],['B','=1+1']]}]]);
  const files=await unzip(await exportExcelTables(doc,scribe));
  assert.ok(files['xl/workbook.xml'].includes('name="Taula 1"'));assert.ok(files['xl/workbook.xml'].includes('name="Taula 2"'));
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('0012'));
  assert.ok(files['xl/worksheets/sheet2.xml'].includes('=1+1'));
  assert.ok(!files['xl/worksheets/sheet2.xml'].includes('<f>'),'Source strings must not become formulas');
  assert.ok(!files['xl/worksheets/sheet1.xml'].includes('>B<'));
});
test('an explicitly linked continuation stays in one sheet without repeated headers',async()=>{
  const doc=fixture([[{rows:[['Producte','Quantitat'],['A','1']]}],[{continues:true,rows:[['Producte','Quantitat'],['B','2']]}]]);
  const files=await unzip(await exportExcelTables(doc,scribe));
  assert.equal(Object.keys(files).filter(n=>n.startsWith('xl/worksheets/')).length,1);
  assert.equal((files['xl/worksheets/sheet1.xml'].match(/Producte/g)||[]).length,1);
  assert.ok(files['xl/worksheets/sheet1.xml'].includes('>A<'));assert.ok(files['xl/worksheets/sheet1.xml'].includes('>B<'));
});
test('matching tables on different pages are not merged without a continuation link',async()=>{
  const doc=fixture([[{rows:[['Producte','Quantitat'],['A','1']]}],[{rows:[['Producte','Quantitat'],['B','2']]}]]);
  const files=await unzip(await exportExcelTables(doc,scribe));
  assert.equal(Object.keys(files).filter(n=>n.startsWith('xl/worksheets/')).length,2);
});
test('multiline and empty cells retain their order and positions',async()=>{
  const doc=fixture([[{rows:[['Concepte','Valor'],['Primera\nSegona',''],['Final','3']]}]]);
  const files=await unzip(await exportExcelTables(doc,scribe));const xml=files['xl/worksheets/sheet1.xml'];
  assert.ok(xml.indexOf('Primera')<xml.indexOf('Segona'));assert.ok(xml.includes('r="B2"'));
  assert.ok(xml.includes('r="B3"'));
});
test('no detected tables gives an actionable error instead of an empty workbook',async()=>{
  await assert.rejects(()=>exportExcelTables(fixture([[]]),scribe),/No s’ha detectat cap taula/);
});
test('cancellation between tables never calls the workbook writer',async()=>{
  const controller=new AbortController();let writes=0;
  const engine={...scribe,utils:{...scribe.utils,extractSingleTableContent:scribe.utils.extractSingleTableContent,
    writeXlsxFromSheets(){writes++;}}};
  const doc=fixture([[{rows:[['Nom','Valor'],['A','1']]},{rows:[['Nom','Valor'],['B','2']]}]]);
  await assert.rejects(()=>exportExcelTables(doc,engine,{signal:controller.signal,onProgress:()=>controller.abort()}),{name:'AbortError'});
  assert.equal(writes,0);
});
