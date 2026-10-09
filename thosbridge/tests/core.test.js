import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {levels} from '../levels.js';
import {copy,emptyBridge,demo,Simulation,cost,addBeam,removeBeam,makeDeck,validateBridge,terrainAt,deckRoute} from '../core.js';
const root=process.env.BBG_SOURCE||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const sourcesAvailable=fs.existsSync(path.join(root,'level/01-Old/Level01.lvl'));
const first=levels.find(l=>l.id==='new-01');
function simulate(level,bridge,weight=1){const s=new Simulation(level,bridge,weight);for(let i=0;i<6000&&s.status==='running';i++)s.step();return s;}
test('30 source files, two ordered packs, finite coordinates and exact provenance',()=>{
  assert.equal(levels.length,30);assert.equal(new Set(levels.map(l=>l.id)).size,30);
  for(const pack of ['old','new'])assert.deepEqual(levels.filter(l=>l.pack===pack).map(l=>l.number),Array.from({length:15},(_,i)=>i+1));
  for(const l of levels){assert.match(l.source.sha256,/^[a-f0-9]{64}$/);assert.ok(l.source.bytes>0);assert.ok(l.budget>0);assert.ok(l.right>l.left);
    for(const p of [...l.terrain,...l.anchors])assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
    assert.deepEqual(validateBridge(emptyBridge(l),l),emptyBridge(l));
  }
});
test('source hashes, budgets, terrain and anchors are decoded directly from both layouts',{skip:!sourcesAvailable},()=>{
  for(const l of levels){const b=fs.readFileSync(path.join(root,l.source.file)),old=l.pack==='old';
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'),l.source.sha256);assert.equal(b.length,l.source.bytes);
    assert.equal(l.budget,b.readInt32LE(old?8:24));
    const offset=old?4116:2092;assert.equal(l.anchors.length,b.readInt32LE(offset));
    for(let i=0;i<l.anchors.length;i++){const p=offset+(old?4:8)+i*(old?92:12);assert.equal(l.anchors[i].x,(b.readFloatLE(p+(old?4:0))-l.source.originX)/4);assert.equal(l.anchors[i].y,(b.readFloatLE(p+(old?8:4))-l.source.roadY)/4);}
    for(const p of l.terrain){const idx=Math.round(p.x+l.source.originX/4);assert.equal(p.y,(b.readFloatLE((old?20:44)+idx*4)-l.source.roadY)/4);}
  }
});
test('initial examples in both packs survive the standard train without changing the design',()=>{
  for(const id of ['new-01','old-01']){const l=levels.find(l=>l.id===id),b=demo(l),before=copy(b),s=simulate(l,b);
    assert.equal(s.status,'passed');assert.equal(s.broken,0);assert.ok(s.peak<1);assert.deepEqual(b,before);assert.ok(cost(b)<=l.budget);
  }
});
test('a horizontal deck with no triangular reinforcement fails under the standard train',()=>{
  const b=makeDeck(first,emptyBridge(first)).bridge;assert.ok(deckRoute(first,b));assert.equal(simulate(first,b).status,'failed');
});
test('missing and disconnected decks fail instead of awarding success',()=>{
  assert.equal(simulate(first,emptyBridge(first)).status,'failed');const b=demo(first);removeBeam(b,b.beams.find(e=>e.type==='deck').id);assert.equal(deckRoute(first,b),null);assert.equal(simulate(first,b).status,'failed');
});
test('an inclined deck can connect an elevated right anchor',()=>{
  const l={...copy(first),anchors:[{x:-4,y:0},{x:4,y:2}]},b=emptyBridge(l);
  assert.equal(addBeam(b,{x:-4,y:0},{x:0,y:1},'deck',l),null);
  assert.equal(addBeam(b,{x:0,y:1},{x:4,y:2},'deck',l),null);assert.equal(deckRoute(l,b).length,2);
});
test('unlinked deck islands remain disconnected across a terrain gap',()=>{
  const b=emptyBridge(first);addBeam(b,{x:-4,y:0},{x:-2,y:0},'deck',first);addBeam(b,{x:2,y:0},{x:4,y:0},'deck',first);assert.equal(deckRoute(first,b),null);
});
test('building enforces lengths, duplicate edges and budget atomically',()=>{
  const b=emptyBridge(first),before=copy(b);assert.match(addBeam(b,{x:-4,y:0},{x:4,y:0},'bar',first),/longitud/);assert.deepEqual(b,before);
  assert.equal(addBeam(b,{x:-4,y:0},{x:-2,y:0},'deck',first),null);const one=copy(b);
  assert.match(addBeam(b,{x:-2,y:0},{x:-4,y:0},'bar',first),/units/);assert.deepEqual(b,one);
  assert.match(addBeam(b,{x:-2,y:0},{x:0,y:0},'deck',{...first,budget:100}),/pressupost/);assert.deepEqual(b,one);
  assert.match(addBeam(b,{x:200,y:0},{x:201,y:0},'bar',first),/àrea/);assert.deepEqual(b,one);
});
test('deleting an edge removes orphan nodes and preserves every anchor',()=>{
  const b=emptyBridge(first);addBeam(b,{x:-4,y:0},{x:-2,y:1},'bar',first);removeBeam(b,b.beams[0].id);assert.deepEqual(b,emptyBridge(first));
});
test('JSON round trip preserves a usable bridge',()=>{const b=demo(first);assert.deepEqual(validateBridge(JSON.parse(JSON.stringify(b)),first),b);});
test('import rejects forged anchors, fixed free nodes, invalid coordinates and duplicate ids',()=>{
  const altered=demo(first);altered.nodes[0].x+=1;assert.throws(()=>validateBridge(altered,first),/ancoratges/);
  for(const invalid of [n=>n.fixed=true,n=>n.x=Infinity,n=>n.y=NaN,n=>n.id='a0']){const b=demo(first);invalid(b.nodes.find(n=>!n.fixed));assert.throws(()=>validateBridge(b,first));}
});
test('import rejects unknown endpoints, zero length, invalid types and over-budget bridges',()=>{
  for(const invalid of [b=>b.beams[0].a='missing',b=>b.beams[0].b=b.beams[0].a,b=>b.beams[0].type='magic',b=>b.beams.push(copy(b.beams[0]))]){const b=demo(first);invalid(b);assert.throws(()=>validateBridge(b,first));}
  assert.throws(()=>validateBridge(demo(first),{...first,budget:100}),/pressupost/);
});
test('automatic deck cannot leave a partially-built bridge when budget is insufficient',()=>{
  const b=emptyBridge(first),before=copy(b),result=makeDeck({...first,budget:100},b);assert.ok(result.error);assert.deepEqual(b,before);
});
test('loading a heavier train changes the structural response',()=>{
  const b=demo(first),a=simulate(first,b,.5),z=simulate(first,b,2);assert.ok(z.peak>a.peak);assert.equal(a.status,'passed');
});
test('terrain interpolation and contact preserve finite simulations on all 30 levels',()=>{
  for(const l of levels){assert.equal(terrainAt(l,l.terrain[0].x),l.terrain[0].y);const result=makeDeck(l,emptyBridge(l));if(!result.bridge)continue;
    const s=simulate(l,result.bridge);assert.notEqual(s.status,'running');assert.ok(s.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
  }
});
