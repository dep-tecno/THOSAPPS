import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {family,levels} from '../families/no-badis.js';
import {levels as originals} from '../levels.js';
import {emptyBridge,validateBridge,makeDeck,Simulation,assessBridge,copy} from '../core.js';
const root=process.env.BBG_SOURCE||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const filesAvailable=fs.existsSync(path.join(root,levels[0].source.file));
test('No badis contains exactly the supplied 24 levels with stable IDs and original authors',()=>{
  assert.equal(family.name,'No badis');assert.equal(levels.length,24);
  assert.deepEqual(levels.map(l=>l.number),Array.from({length:24},(_,i)=>i+1));
  assert.equal(new Set([...originals,...levels].map(l=>l.id)).size,54);
  assert.equal(levels.filter(l=>l.source.author==='Schlumpfine').length,11);
  assert.equal(levels.filter(l=>l.source.author==='Thomas McGuire').length,13);
  for(const l of levels){assert.equal(l.pack,family.id);assert.match(l.id,/^no-badis-\d\d$/);assert.ok(l.right>l.left&&l.budget>0);assert.deepEqual(validateBridge(emptyBridge(l),l),emptyBridge(l));assert.ok([...l.anchors,...l.terrain].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.ok(!family.omittedInSource.includes(l.source.originalLevel));assert.equal(l.source.archiveSha256,family.archiveSha256);}
});
test('No badis source hashes, geometry and budget match each downloaded BGL',{skip:!filesAvailable},()=>{
  for(const l of levels){const data=fs.readFileSync(path.join(root,l.source.file));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),l.source.sha256);assert.equal(data.length,l.source.bytes);
    assert.equal(l.budget,data.readInt32LE(24));assert.equal(l.anchors.length,data.readInt32LE(2092));
    assert.equal(l.right-l.left,(data.readFloatLE(20)-data.readFloatLE(16))/4);
    assert.equal(l.water,(data.readFloatLE(12)-data.readFloatLE(8))/4);
    for(const [i,n] of l.anchors.entries()){assert.equal(n.x,(data.readFloatLE(2100+i*12)-l.source.originX)/4);assert.equal(n.y,(data.readFloatLE(2104+i*12)-l.source.roadY)/4);}
    for(const n of l.terrain){const index=Math.round(n.x+l.source.originX/4);assert.equal(n.y,(data.readFloatLE(44+index*4)-l.source.roadY)/4);}
  }
});
test('No badis automatic decks and numerical tests preserve designs and stay finite',()=>{
  let exercised=0;
  for(const l of levels){const result=makeDeck(l,emptyBridge(l));if(!result.bridge)continue;
    const b=result.bridge,before=copy(b);assert.deepEqual(validateBridge(b,l),b);
    const analysis=assessBridge(l,b);assert.ok(['assessed','failed'].includes(analysis.status));assert.deepEqual(b,before);
    const train=new Simulation(l,b);for(let i=0;i<8000&&train.active;i++)train.step();assert.equal(train.active,false);
    assert.ok([...analysis.nodes,...train.nodes].every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));assert.deepEqual(b,before);exercised++;
  }
  assert.ok(exercised>0,'At least one nonempty bridge must exercise the numerical model');
});
