import test from 'node:test';
import assert from 'node:assert/strict';
import scribe from 'scribe.js-ocr';
import { OcrPage, OcrPar, OcrLine, OcrWord } from 'scribe.js-ocr/js/objects/ocrObjects.js';
import { LayoutDataTablePage } from 'scribe.js-ocr/js/objects/layoutObjects.js';
import { ZipReader, Uint8ArrayReader, TextWriter } from 'scribe.js-ocr/lib/zip.js/index.js';
import { buildWordPages, exportWord } from './word-export.js';

let nextId = 0;
function line(page, text, x, y, par = null) {
  const bbox = { left:x, top:y, right:x + text.length*20, bottom:y+40 };
  const result = new OcrLine(page, bbox, [0,0]);
  result.par = par || new OcrPar(page, bbox);
  const word = new OcrWord(result, String(++nextId), text, bbox);
  word.style.size = 45;
  result.words.push(word);
  result.par.lines.push(result);
  page.lines.push(result);
  if (!page.pars.includes(result.par)) page.pars.push(result.par);
  return result;
}
function fixture() {
  const page = new OcrPage(0, { width:2480, height:3508 });
  const before = line(page, 'Abans & <títol>', 200, 100);
  before.words[0].style.bold = true;
  before.words[0].style.color = '#ff0000';
  const cells = [line(page,'Capçalera',200,400),line(page,'Valor',900,400),
    line(page,'Primera línia',200,600),line(page,'Segona línia',200,660),line(page,'42',900,600),
    line(page,'Cel·la sense valor',200,850)];
  line(page,'Després',200,1200);
  const layoutPage = new LayoutDataTablePage(0);
  const table = new scribe.layout.LayoutDataTable(layoutPage);
  for (const [left,right] of [[180,850],[850,1500]]) {
    table.boxes.push(new scribe.layout.LayoutDataColumn({left,top:380,right,bottom:1000},table));
  }
  table.rowBounds=[550,800,1000];
  table.headerRows=1;
  layoutPage.tables.push(table);
  return { doc:{ ocr:{active:[page]}, pageMetrics:[{dims:page.dims}], layoutDataTables:{pages:[layoutPage]}, inputData:{pdfMode:true} }, table, cells };
}
async function documentXml(doc) {
  const bytes = await exportWord(doc,scribe);
  const reader = new ZipReader(new Uint8ArrayReader(bytes));
  const entries = await reader.getEntries();
  const xml = await entries.find(entry=>entry.filename==='word/document.xml').getData(new TextWriter());
  await reader.close();
  return xml;
}
test('editable cells keep multiline order, empty cells, styles and surrounding paragraphs', async()=>{
  const {doc}=fixture();
  const pages=buildWordPages(doc,scribe);
  assert.deepEqual(pages[0].blocks.map(block=>block.kind), ['paragraph','table','paragraph']);
  const xml = await documentXml(doc);
  assert.equal((xml.match(/<w:tr>/g)||[]).length,3);
  assert.equal((xml.match(/<w:tc>/g)||[]).length,6);
  assert.ok(xml.indexOf('Primera línia')<xml.indexOf('Segona línia'));
  assert.ok(xml.indexOf('Abans &amp; &lt;títol&gt;')<xml.indexOf('<w:tbl>'));
  assert.ok(xml.indexOf('Després')>xml.indexOf('</w:tbl>'));
  assert.equal((xml.match(/Primera línia/g)||[]).length,1);
  assert.ok(xml.includes('w:val="ff0000"'));
  assert.ok(xml.includes('w:hRule="atLeast"'));
  assert.ok(!xml.includes('NaN'));
});
test('overlapping table detections do not duplicate any content',()=>{
  const {doc,table}=fixture();
  doc.layoutDataTables.pages[0].tables.push(table);
  const blocks=buildWordPages(doc,scribe)[0].blocks;
  assert.equal(blocks.filter(block=>block.kind==='table').length,1);
  assert.equal(blocks.flatMap(block=>block.kind==='table'?block.rows.flat(2):block.lines.flatMap(line=>line.words)).length,8);
});
test('documents without tables retain paragraphs and page sections', async()=>{
  const {doc}=fixture();
  doc.layoutDataTables.pages[0].tables=[];
  const page = new OcrPage(1,{width:3508,height:2480});
  line(page,'Pàgina dos',200,150);
  doc.ocr.active.push(page);
  doc.pageMetrics.push({dims:page.dims});
  const xml=await documentXml(doc);
  assert.ok(!xml.includes('<w:tbl>'));
  assert.equal((xml.match(/<w:sectPr>/g)||[]).length,2);
  assert.ok(xml.includes('Pàgina dos'));
});
test('image tables use the same Scribe extraction and fit A4 geometry',async()=>{
  const {doc}=fixture();
  doc.inputData.pdfMode=false;
  const xml=await documentXml(doc);
  assert.equal((xml.match(/<w:tbl>/g)||[]).length,1);
  assert.ok(xml.includes('w:pgSz'));
  assert.ok(!xml.includes('NaN'));
});
