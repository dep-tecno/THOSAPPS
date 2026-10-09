// Read-only conversion of the user's Bridge Building Game 1.25 level files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../../..');
const out = [];
for (const [folder, pack] of [['01-Old', 'old'], ['02-New', 'new']]) {
  for (const file of fs.readdirSync(path.join(root, 'level', folder)).sort()) {
    if (!/\.(lvl|bgl)$/.test(file)) continue;
    const b = fs.readFileSync(path.join(root, 'level', folder, file));
    const old = pack === 'old';
    const float = o => b.readFloatLE(o);
    const int = o => b.readInt32LE(o);
    const heightsOffset = old ? 20 : 44;
    const heightsCount = old ? 1024 : 512;
    const nodesOffset = heightsOffset + heightsCount * 4;
    const count = int(nodesOffset);
    const start = nodesOffset + (old ? 4 : 8);
    const stride = old ? 92 : 12;
    if (count < 1 || count > 100 || start + count * stride !== b.length) throw Error('Unexpected file layout: ' + file);
    if (!old && (int(0) !== 1111970370 || int(4) !== 4)) throw Error('Unexpected BGL header');
    const left = float(old ? 12 : 16), right = float(old ? 16 : 20);
    const origin = (left + right) / 2;
    const road = float(old ? 4 : 8);
    const anchors = Array.from({length:count}, (_,i) => ({
      x: (float(start + i * stride + (old ? 4 : 0)) - origin) / 4,
      y: (float(start + i * stride + (old ? 8 : 4)) - road) / 4
    }));
    const first = Math.max(0, Math.floor(left / 4) - 12);
    const last = Math.min(heightsCount - 1, Math.ceil(right / 4) + 12);
    const terrain = Array.from({length:last-first+1}, (_,i) => ({
      x: first + i - origin / 4,
      y: (float(heightsOffset + (first+i)*4) - road) / 4
    }));
    const number = parseInt(file.match(/\d+/)[0]);
    out.push({id:pack+'-'+String(number).padStart(2,'0'), pack, number,
      name:'Nivell '+number, budget:int(old ? 8 : 24),
      left:(left-origin)/4, right:(right-origin)/4, road:0,
      water:(float(old ? 0 : 12)-road)/4, anchors, terrain,
      source:{file:'level/'+folder+'/'+file, sha256:crypto.createHash('sha256').update(b).digest('hex'),
        bytes:b.length, grid:4, originX:origin, roadY:road,
        header: old ? null : Array.from({length:11},(_,i)=>int(i*4)),
        trainWeight:old ? null : int(28),
        // This field is retained as raw metadata, not silently interpreted.
        rawFlags:old ? null : [int(32),int(36),int(40)]}
    });
  }
}
fs.writeFileSync(path.resolve(__dirname,'../levels.js'),
  '// Converted from the supplied BBG 1.25 levels. See THOSBRIDGE.md for attribution and limitations.\nexport const levels = '+JSON.stringify(out)+';\n');
console.log('Converted '+out.length+' levels; source files unchanged.');
