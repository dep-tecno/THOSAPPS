import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {levels} from '../levels.js';
import {clampCardPosition,initialCardPosition} from '../cards.js';
import {assessBridge,stressHeatColor,didacticIndicators} from '../core.js';
import {RULES,copy,emptyBridge,demo,Simulation,cost,addBeam,nodeAt,planDeckSpan,addDeckSpan,removeBeam,makeDeck,validateBridge,terrainAt,deckRoute} from '../core.js';
const root=process.env.BBG_SOURCE||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const sourcesAvailable=fs.existsSync(path.join(root,'level/01-Old/Level01.lvl'));
const first=levels.find(l=>l.id==='new-01');
function simulate(level,bridge,weight=1){const s=new Simulation(level,bridge,weight);for(let i=0;i<8000&&s.active;i++)s.step();return s;}
test('canvas annotations select at most one representative of each concept',()=>{
  const s={mode:'train',active:true,maxDeckDrop:{node:'n0',x:0,y:-.2,y0:0,amount:.2},beams:[
    {id:'b0',type:'bar',length:4,stress:-.6,broken:false},
    {id:'b1',type:'bar',length:2,stress:.7,broken:false},
    {id:'b2',type:'bar',length:4,stress:.2,broken:false},
    {id:'b3',type:'bar',length:4,stress:-.9,broken:true}]};
  const markers=didacticIndicators(s);assert.equal(markers.length,4);
  assert.equal(markers.find(m=>m.kind==='tension').beam,'b1');
  assert.equal(markers.find(m=>m.kind==='compression').beam,'b0');
  const buckling=markers.find(m=>m.kind==='buckling');assert.equal(buckling.beam,'b0');assert.equal(buckling.qualitative,true);assert.equal(buckling.value,undefined);
  assert.deepEqual(didacticIndicators(null),[]);
});
test('canvas directions follow current axial stress during the train and recorded peaks on the map',()=>{
  const beam={id:'b0',type:'bar',length:2,stress:-.2,peakTension:.7,peakCompression:.4,broken:false},s={mode:'train',active:true,beams:[beam]};
  assert.equal(didacticIndicators(s).some(m=>m.kind==='tension'),false);
  s.mode='stress';assert.equal(didacticIndicators(s).find(m=>m.kind==='tension').value,.7);
  assert.equal(didacticIndicators(s).find(m=>m.kind==='compression').value,.4);
  beam.length=2;assert.equal(didacticIndicators(s).some(m=>m.kind==='buckling'),false);
});
test('arrow representatives stay on a bar for small load differences and switch for a significant change',()=>{
  const s={mode:'train',active:true,beams:[{id:'b0',type:'bar',length:2,stress:.5,broken:false},{id:'b1',type:'bar',length:2,stress:.49,broken:false}]};
  const first=didacticIndicators(s);s.beams[1].stress=.55;
  assert.equal(didacticIndicators(s,first).find(m=>m.kind==='tension').beam,'b0');
  s.beams[1].stress=.7;assert.equal(didacticIndicators(s,first).find(m=>m.kind==='tension').beam,'b1');
  s.beams[0].stress=-.8;s.beams[1].stress=0;
  const later=didacticIndicators(s,first);assert.equal(later.some(m=>m.kind==='tension'),false);assert.equal(later.find(m=>m.kind==='compression').beam,'b0');
});
test('arrow smoothing follows a changing load without changing raw stress or recorded peaks',()=>{
  const b=demo(first),s=new Simulation(first,b),e=s.beams.find(e=>e.type==='bar');
  const node=s.byId.get(e.b);node.y+=.01;s.step();
  assert.ok(Math.abs(e.visualStress)<Math.abs(e.stress));
  assert.equal(e.peakStress,e.stress);
  const source={mode:'train',active:true,beams:[{id:'b0',type:'bar',length:2,stress:-.6,visualStress:.1,broken:false}]};
  assert.equal(didacticIndicators(source)[0].kind,'tension');
  source.beams[0].visualStress=-.2;assert.equal(didacticIndicators(source)[0].kind,'compression');
});
test('canvas deck drop retains its measured position and excludes collapse and non-deck nodes',()=>{
  const b=demo(first),s=new Simulation(first,b),n=s.nodes.find(n=>!n.fixed&&s.deckNodeIds.has(n.id)),other=s.nodes.find(n=>!n.fixed&&!s.deckNodeIds.has(n.id));
  n.y=n.y0-.2;other.y=other.y0-2;s.step(0);
  assert.ok(Math.abs(s.maxDeckDrop.amount-.2)<1e-9);assert.equal(s.maxDeckDrop.node,n.id);
  const measured=copy(s.maxDeckDrop);n.y=n.y0+.1;s.step(0);assert.deepEqual(s.maxDeckDrop,measured);
  s.fail('test');n.y=n.y0-10;s.step(0);assert.deepEqual(s.maxDeckDrop,measured);
  assert.equal(new Simulation(first,b).maxDeckDrop,null);
});
test('the stationary pretest preserves measured drop without moving the displayed bridge',()=>{
  const b=demo(first),s=assessBridge(first,b);
  assert.ok(s.maxDeckDrop.amount>0);
  assert.ok(s.beams.some(e=>e.peakCompression>0));
  for(const n of s.nodes){assert.equal(n.x,n.x0);assert.equal(n.y,n.y0);}
});
test('maximum tension remains visible when the same bar later has a larger compression peak',()=>{
  const level={...copy(first),budget:1000},b=emptyBridge(level);
  assert.equal(addBeam(b,{x:0,y:2},{x:2,y:2},'bar',level),null);
  const s=new Simulation(level,b,1,{mode:'stress'}),edge=s.beams[0],end=s.byId.get(edge.b);
  end.x=2.01;s.step(0);const tension=edge.peakTension;
  assert.ok(tension>0);assert.equal(edge.peakStress,tension);
  end.x=1.98;s.step(0);
  assert.ok(edge.peakStress<0);assert.ok(Math.abs(edge.peakStress)>tension);
  assert.equal(edge.peakTension,tension);
  const fresh=new Simulation(level,b,1,{mode:'stress'});
  assert.equal(fresh.beams[0].peakTension,0);
});
test('an endpoint on a deck makes a shared joint that carries the train load',()=>{
  const level={...copy(first),left:-2,right:2,budget:1000,terrain:[{x:-10,y:-10},{x:10,y:-10}],anchors:[{x:-2,y:0},{x:2,y:0},{x:0,y:-2}]};
  const b=emptyBridge(level);
  assert.equal(addBeam(b,{x:-2,y:0},{x:2,y:0},'deck',level),null);
  assert.equal(addBeam(b,{x:0,y:-2},{x:0,y:0},'bar',level),null);
  const joint=b.nodes.find(n=>n.x===0&&n.y===0);
  assert.equal(b.beams.filter(e=>e.a===joint.id||e.b===joint.id).length,3);
  assert.equal(b.beams.filter(e=>e.type==='deck').length,2);
  assert.equal(cost(b),300);assert.equal(deckRoute(level,b).length,2);
  assert.equal(simulate(level,b).status,'passed');assert.deepEqual(validateBridge(b,level),b);
  const count=b.nodes.length;
  assert.equal(addBeam(b,{x:0,y:0},{x:0,y:2},'bar',level),null);
  assert.equal(b.nodes.length,count+1);
});
test('geometric crossings stay separate unless an endpoint explicitly creates a junction',()=>{
  const level={...copy(first),budget:2000},b=emptyBridge(level);
  assert.equal(addBeam(b,{x:-2,y:0},{x:2,y:0},'bar',level),null);
  assert.equal(addBeam(b,{x:0,y:-2},{x:0,y:2},'bar',level),null);
  assert.equal(nodeAt(b,{x:0,y:0}),undefined);assert.equal(b.beams.length,2);
  assert.equal(addBeam(b,{x:0,y:0},{x:2,y:2},'bar',level),null);
  const joint=nodeAt(b,{x:0,y:0});
  assert.equal(b.beams.filter(e=>e.a===joint.id||e.b===joint.id).length,5);
});
test('junction cost is checked atomically, including splits at both endpoints',()=>{
  const level={...copy(first),budget:2000},b=emptyBridge(level);
  addBeam(b,{x:-2,y:0},{x:2,y:0},'deck',level);
  addBeam(b,{x:-2,y:2},{x:2,y:2},'bar',level);
  const before=copy(b);
  assert.match(addBeam(b,{x:0,y:0},{x:0,y:2},'bar',{...level,budget:400}),/pressupost/);
  assert.deepEqual(b,before);
  assert.equal(addBeam(b,{x:0,y:0},{x:0,y:2},'bar',{...level,budget:500}),null);
  assert.equal(cost(b),500);
});
test('drawing deck over a longer existing deck splits it without laying a second deck',()=>{
  const level={...copy(first),budget:1000},b=emptyBridge(level);
  addBeam(b,{x:-2,y:0},{x:2,y:0},'deck',level);
  const r=addDeckSpan(b,{x:-2,y:0},{x:0,y:0},level);
  assert.equal(r.error,undefined);assert.equal(r.added,1);assert.equal(r.bridge.beams.length,2);
  const again=addDeckSpan(r.bridge,{x:-2,y:0},{x:0,y:0},level);
  assert.equal(again.added,0);assert.deepEqual(again.bridge,r.bridge);
});
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
test('an under-reinforced bridge continues falling after losing train support',()=>{
  const b=makeDeck(first,emptyBridge(first)).bridge,s=new Simulation(first,b),design=copy(b);
  for(let i=0;i<6000&&s.status==='running';i++)s.step();assert.equal(s.status,'collapsing');assert.equal(s.active,true);
  const time=s.time,positions=s.nodes.map(n=>n.y),cars=s.cars.map(c=>c.y);
  for(let i=0;i<240;i++)s.step();assert.ok(s.time>time);assert.ok(s.nodes.some((n,i)=>Math.abs(n.y-positions[i])>.01));assert.ok(s.cars.some((c,i)=>c.y<cars[i]-.1));
  for(let i=0;i<2400&&s.active;i++)s.step();assert.equal(s.status,'failed');assert.ok(s.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));assert.deepEqual(b,design);
});
test('missing and disconnected decks fail instead of awarding success',()=>{
  const missing=simulate(first,emptyBridge(first));assert.equal(missing.status,'failed');assert.equal(missing.failureKind,'route');
  const b=demo(first);removeBeam(b,b.beams.find(e=>e.type==='deck').id);assert.equal(deckRoute(first,b),null);assert.equal(simulate(first,b).status,'failed');
});
test('Old level 1 accepts drawing a deck directly from one bank to the other',()=>{
  const level=levels.find(l=>l.id==='old-01'),before=emptyBridge(level);
  const result=addDeckSpan(before,{x:level.left,y:0},{x:level.right,y:0},level);
  assert.equal(result.error,undefined);assert.equal(result.added,2);assert.equal(cost(result.bridge),200);
  assert.deepEqual(before,emptyBridge(level));assert.equal(deckRoute(level,result.bridge).length,2);
  const s=new Simulation(level,result.bridge);assert.equal(s.status,'running');assert.equal(s.time,0);assert.notEqual(s.failureKind,'route');
  assert.deepEqual(validateBridge(result.bridge,level),result.bridge);
});
test('direct deck strokes work in either drawing direction and reuse existing nodes',()=>{
  for(const reverse of [false,true]){
    const b=emptyBridge(first);addBeam(b,{x:0,y:0},{x:0,y:2},'bar',first);
    const a={x:first.left,y:0},z={x:first.right,y:0},result=addDeckSpan(b,reverse?z:a,reverse?a:z,first);
    assert.ok(deckRoute(first,result.bridge));assert.equal(result.bridge.nodes.filter(n=>n.x===0&&n.y===0).length,1);
    assert.equal(result.added,2);
  }
});
test('drawing Tauler over existing bars converts them without adding cost',()=>{
  const b=demo(first);b.beams.filter(e=>e.type==='deck').forEach(e=>e.type='bar');const before=cost(b);
  assert.equal(deckRoute(first,b),null);
  const result=addDeckSpan(b,{x:first.left,y:0},{x:first.right,y:0},first);
  assert.equal(result.converted,2);assert.equal(result.added,0);assert.equal(cost(result.bridge),before);
  assert.equal(simulate(first,result.bridge).status,'passed');
  assert.ok(b.beams.every(e=>e.type==='bar'));
});
test('a long deck stroke rolls back completely when it exceeds the budget',()=>{
  const b=emptyBridge(first),before=copy(b),result=addDeckSpan(b,{x:-4,y:0},{x:4,y:0},{...first,budget:100});
  assert.match(result.error,/pressupost/);assert.deepEqual(b,before);
});
test('long inclined deck strokes keep grid points and respect each segment limit',()=>{
  const level={...copy(first),budget:2000,left:-6,right:6},b=emptyBridge(level);
  for(const end of [{x:6,y:4},{x:6,y:1},{x:6,y:6}]){
    const result=addDeckSpan(b,{x:-6,y:0},end,level);assert.equal(result.error,undefined);
    assert.ok(result.bridge.nodes.filter(n=>!n.fixed).every(n=>Number.isInteger(n.x)&&Number.isInteger(n.y)));
    assert.deepEqual(validateBridge(result.bridge,level),result.bridge);
    assert.ok(planDeckSpan(b,{x:-6,y:0},end).segments.every(s=>Math.hypot(s.a.x-s.b.x,s.a.y-s.b.y)<=RULES.maxLength+1e-6));
  }
});
test('automatic deck converts pre-existing bars instead of silently leaving a missing route',()=>{
  const b=makeDeck(first,emptyBridge(first)).bridge;b.beams.forEach(e=>e.type='bar');
  const result=makeDeck(first,b);assert.ok(deckRoute(first,result.bridge));assert.equal(cost(result.bridge),cost(b));
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
test('stress pretest loads the structure without moving a train or changing the saved design',()=>{
  for(const level of [levels[0],levels[15]]){
    const b=demo(level),before=copy(b),s=new Simulation(level,b,1,{mode:'stress'}),trainX=s.trainX;
    for(let i=0;i<4000&&s.active;i++)s.step();
    assert.equal(s.status,'assessed');assert.equal(s.loadFactor,1);assert.equal(s.trainX,trainX);assert.equal(s.cars,undefined);
    assert.ok(s.peak>0);assert.ok(s.beams.some(e=>Math.abs(e.peakStress)>0));assert.deepEqual(b,before);
  }
});
test('stress calculation flags a weak deck immediately without animating a collapse',()=>{
  const b=makeDeck(first,emptyBridge(first)).bridge,s=new Simulation(first,b,1,{mode:'stress'});
  for(let i=0;i<4000&&s.status==='running';i++)s.step();
  assert.equal(s.status,'failed');assert.match(s.reason,/prèvia/);assert.equal(s.cars,undefined);
  const time=s.time;s.step();assert.equal(s.time,time);
});
test('stress pretest accepts incomplete structures and reports an empty design clearly',()=>{
  const b=emptyBridge(first);addBeam(b,{x:first.left,y:0},{x:first.left+2,y:2},'bar',first);
  const s=new Simulation(first,b,1,{mode:'stress'});assert.equal(s.status,'running');assert.equal(s.route,null);
  const empty=new Simulation(first,emptyBridge(first),1,{mode:'stress'});assert.equal(empty.status,'failed');assert.match(empty.reason,/Construeix/);
});
test('floating cards remain reachable after a viewport shrink and have separate initial positions',()=>{
  const size={width:245,height:200},stage={width:900,height:650};
  assert.notDeepEqual(initialCardPosition('costCard',size,stage),initialCardPosition('legendCard',size,stage));
  assert.deepEqual(clampCardPosition({x:850,y:600},size,{width:500,height:400}),{x:247,y:158});
  assert.deepEqual(clampCardPosition({x:-100,y:NaN},size,stage),{x:8,y:8});
});
test('the heat map returns an undeformed design and allows a fresh train test after a warning',()=>{
  for(const b of [demo(first),makeDeck(first,emptyBridge(first)).bridge]){
    const before=copy(b),s=assessBridge(first,b);
    assert.equal(s.status,'assessed');assert.equal(s.active,false);assert.equal(s.cars,undefined);
    assert.deepEqual(s.nodes.map(({id,x,y,fixed})=>({id,x,y,fixed})),b.nodes);assert.deepEqual(b,before);
    assert.ok(s.beams.some(e=>Math.abs(e.peakStress)>0));
    const weak=b.beams.every(e=>e.type==='deck');assert.equal(s.analysisWarning,weak);
    assert.equal(simulate(first,b).status,weak?'failed':'passed');
  }
  assert.equal(assessBridge(first,emptyBridge(first)).status,'failed');
});
test('heat colors range from yellow to orange to red for both tension and compression',()=>{
  assert.equal(stressHeatColor(0),'rgb(255,216,66)');assert.equal(stressHeatColor(.5),'rgb(255,140,32)');
  assert.equal(stressHeatColor(1),'rgb(239,68,44)');assert.equal(stressHeatColor(2),stressHeatColor(1));
  assert.equal(stressHeatColor(-.75),stressHeatColor(.75));
});
