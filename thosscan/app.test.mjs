import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./app.js', import.meta.url), 'utf8')
  .replace("import { exportWord } from './word-export.js';", 'const exportWord = exportWordStub;')
  .replace("await import('scribe.js-ocr')", '({ default: engine })');
const deferred = () => { let resolve, reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
async function setup({ opening, recognize, word, excel, close } = {}) {
  const elements = new Map();
  const get = key => {
    if (!elements.has(key)) elements.set(key, {
      value: key === '#lang' ? 'cat' : 'docx', files: [{name:'prova.pdf',size:4000}],
      hidden: ['#download','#drive','#cancel','#progress'].includes(key),
      disabled: false, textContent: '', handlers: {}, attributes: {},
      classList: {add(){},remove(){}},
      addEventListener(type,handler){this.handlers[type]=handler;},
      setAttribute(name,value){this.attributes[name]=value;},
      removeAttribute(name){delete this[name];},
    });
    return elements.get(key);
  };
  const calls={open:0,ocr:0,word:0,excel:0,close:0,errors:0};
  const doc={inputData:{pageCount:3},
    async recognize(options){calls.ocr++;return recognize?.(options,doc,get);},
    async exportData(ext){calls.excel++;assert.equal(ext,'xlsx');return excel ? excel(doc,get) : new Uint8Array([80,75]);},
    async close(){calls.close++;return close?.();},
  };
  const engine={opt:{},async openDocument(){calls.open++;return opening ? opening(doc) : doc;}};
  const context=vm.createContext({document:{querySelector:get,baseURI:'https://tecno-apps.cat/thosscan/'},
    engine,exportWordStub:async(d,s,options)=>{calls.word++;return word ? word(options,d,get) : new Uint8Array([80,75]);},
    Blob,URL,AbortController,setTimeout,
    console:{info(){},warn(){},error(){calls.errors++;}},
  });
  await new vm.Script(`(async()=>{${source}})()`).runInContext(context);
  return {get,doc,engine,calls,start:()=>get('#convert').handlers.click(),cancel:()=>get('#cancel').handlers.click()};
}
test('Word reports real page events, deduplicates OCR and restores controls after closing',async()=>{
  const s=await setup({recognize(options,doc,get){
    assert.equal(options.modeAdv,'lstm');assert.equal(options.ocrPages,'auto');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(get('#file').disabled,true);assert.equal(get('#cancel').hidden,false);
    doc.progressHandler({type:'convert',n:2});
    doc.progressHandler({type:'convert',n:0});
    doc.progressHandler({type:'convert',n:0});
    assert.match(get('#status').textContent,/completades: 2/);
    assert.equal(get('#progress').value,undefined,'Auto OCR has no invented percentage');
  },word({onProgress},doc,get){
    onProgress({stage:'pages',completed:2,total:3});
    assert.equal(get('#progress').value,2);assert.equal(get('#progress').max,3);
    onProgress({stage:'packaging'});assert.equal(get('#progress').value,undefined);
    return new Uint8Array([80,75]);
  }});
  await s.start();
  assert.equal(s.calls.close,1);assert.equal(s.get('#download').hidden,false);
  assert.equal(s.get('#file').disabled,false);assert.equal(s.get('#cancel').hidden,true);
  assert.match(s.get('#status').textContent,/Conversió completada/);
});
test('cancel during opening closes the opened document without starting OCR',async()=>{
  const open=deferred();const s=await setup({opening:()=>open.promise});
  const pending=s.start();s.cancel();
  assert.match(s.get('#status').textContent,/Cancel·lant/);
  assert.equal(s.get('#file').disabled,true);
  open.resolve(s.doc);await pending;
  assert.equal(s.calls.ocr,0);assert.equal(s.calls.close,1);assert.equal(s.calls.errors,0);
  assert.match(s.get('#status').textContent,/Conversió cancel·lada/);
  assert.equal(s.get('#download').hidden,true);assert.equal(s.get('#convert').disabled,false);
});
test('cancel OCR passes AbortSignal, ignores late events and permits a clean retry',async()=>{
  const entered=deferred();let first=true;
  const s=await setup({recognize({signal}){
    if(!first)return;first=false;
    entered.resolve();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  }});
  const pending=s.start();await entered.promise;s.cancel();
  s.doc.progressHandler({type:'convert',n:0});
  assert.match(s.get('#status').textContent,/Cancel·lant/);
  await s.start();assert.equal(s.calls.open,1,'No concurrent conversion');
  await pending;assert.equal(s.calls.word,0);assert.equal(s.calls.errors,0);
  await s.start();assert.equal(s.calls.open,2);assert.equal(s.calls.close,2);
  assert.match(s.get('#status').textContent,/Conversió completada/);
});
test('cancel Word export hides partial output and preserves the selected file',async()=>{
  const entered=deferred();const s=await setup({word({signal,onProgress}){
    onProgress({stage:'images',completed:1,total:3});entered.resolve();
    return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  }});
  const pending=s.start();await entered.promise;s.cancel();await pending;
  assert.equal(s.get('#download').hidden,true);assert.equal(s.get('#drive').hidden,true);
  assert.equal(s.get('#file').files[0].name,'prova.pdf');assert.equal(s.get('#progress').hidden,true);
});
test('Excel finishes its current operation after cancellation and discards its result',async()=>{
  const entered=deferred(),finished=deferred();
  const s=await setup({excel(doc,get){
    doc.progressHandler({type:'export',n:0});
    assert.equal(get('#progress').value,1);assert.equal(get('#progress').max,3);
    entered.resolve();return finished.promise;
  }});s.get('#format').value='xlsx';
  const pending=s.start();await entered.promise;s.cancel();
  s.get('#drop').handlers.drop({preventDefault(){},dataTransfer:{files:[{name:'other.pdf'}]}});
  assert.equal(s.get('#file').files[0].name,'prova.pdf');
  finished.resolve(new Uint8Array([80,75]));await pending;
  assert.equal(s.calls.word,0);assert.equal(s.get('#download').hidden,true);
  assert.match(s.get('#status').textContent,/Conversió cancel·lada/);
});
test('cancellation during resource cleanup cannot publish a finished result',async()=>{
  const entered=deferred(),closed=deferred();
  const s=await setup({close(){entered.resolve();return closed.promise;}});
  const pending=s.start();await entered.promise;
  assert.equal(s.get('#download').hidden,true);s.cancel();closed.resolve();await pending;
  assert.match(s.get('#status').textContent,/Conversió cancel·lada/);
});
test('real OCR errors retain their phase and restore the controls',async()=>{
  const s=await setup({recognize(){throw new Error('initialization failed');},close(){throw new Error('close failed');}});
  await s.start();
  assert.match(s.get('#status').textContent,/reconeixement OCR: initialization failed/);
  assert.equal(s.get('#convert').disabled,false);assert.equal(s.calls.close,1);
  assert.equal(s.get('#cancel').hidden,true);
});
test('an empty rejection cannot be mistaken for a successful conversion',async()=>{
  const s=await setup({recognize(){throw undefined;}});
  await s.start();
  assert.match(s.get('#status').textContent,/Error durant reconeixement OCR/);
  assert.equal(s.get('#download').hidden,true);
  assert.equal(s.get('#convert').disabled,false);
});
