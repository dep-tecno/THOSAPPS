// Read-only conversion of BB Classics 01; retains provenance and the 24 supplied levels.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SOURCE='Biblioteques originals/Descomprimides/BB_Classics_Map_Pack_01';
function decode(data,filename,number,archiveSha256){
  if(data.length<2100||data.readInt32LE(0)!==1111970370||data.readInt32LE(4)!==4)throw Error('Unknown BGL header: '+filename);
  const float=offset=>data.readFloatLE(offset),int=offset=>data.readInt32LE(offset),count=int(2092);
  if(count<1||count>100||data.length!==2100+count*12)throw Error('Unexpected BGL layout: '+filename);
  const match=filename.match(/^MP(\d+)L(\d+)\.BGL$/i);if(!match)throw Error('Unknown original identifier: '+filename);
  const originalPack=Number(match[1]),originalNumber=Number(match[2]);
  const author={1:'Schlumpfine',2:'Thomas McGuire'}[originalPack];if(!author)throw Error('Unknown level author');
  const left=float(16),right=float(20),road=float(8),origin=(left+right)/2;
  const anchors=Array.from({length:count},(_,i)=>({x:(float(2100+i*12)-origin)/4,y:(float(2104+i*12)-road)/4}));
  const first=Math.max(0,Math.floor(left/4)-12),last=Math.min(511,Math.ceil(right/4)+12);
  const terrain=Array.from({length:last-first+1},(_,i)=>({x:first+i-origin/4,y:(float(44+(first+i)*4)-road)/4}));
  const level={id:'no-badis-'+String(number).padStart(2,'0'),pack:'no-badis',number,name:'Nivell '+number,budget:int(24),left:(left-origin)/4,right:(right-origin)/4,road:0,water:(float(12)-road)/4,anchors,terrain,
    source:{file:SOURCE+'/'+filename,sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length,grid:4,originX:origin,roadY:road,header:Array.from({length:11},(_,i)=>int(i*4)),trainWeight:int(28),rawFlags:[int(32),int(36),int(40)],archive:'BB_Classics_Map_Pack_01.zip',archiveSha256,originalLevel:filename.slice(0,-4),originalPack,originalNumber,author,convertedBy:'Captain Smith'}};
  if(!Number.isFinite(level.water)||level.budget<=0||!(level.right>level.left)||terrain.length<2||[...anchors,...terrain].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('Invalid geometry: '+filename);
  return level;
}
function convert(root){
  const archive=fs.readFileSync(path.join(root,'Biblioteques originals/ZIP/BB_Classics_Map_Pack_01.zip')),archiveSha256=crypto.createHash('sha256').update(archive).digest('hex');
  const files=fs.readdirSync(path.join(root,SOURCE)).filter(file=>/\.bgl$/i.test(file)).sort();
  if(files.length!==24)throw Error('Expected the 24 supplied No badis levels');
  const levels=files.map((file,i)=>decode(fs.readFileSync(path.join(root,SOURCE,file)),file,i+1,archiveSha256));
  const family={id:'no-badis',name:'No badis',count:24,authors:['Schlumpfine','Thomas McGuire'],convertedBy:'Captain Smith',sourceUrl:'https://www.indiedb.com/games/bridge-builder/addons/bb-classics-map-pack-01',archiveSha256,omittedInSource:['MP01L10','MP01L11','MP01L12','MP01L13','MP02L01','MP02L05']};
  const target=path.resolve(__dirname,'../families/no-badis.js');fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,'// BB Classics 01: Schlumpfine / Thomas McGuire; converted to BBG by Captain Smith.\nexport const family = '+JSON.stringify(family)+';\nexport const levels = '+JSON.stringify(levels)+';\n');
  console.log('Converted '+levels.length+' No badis levels; originals unchanged.');
}
module.exports={decode};
if(require.main===module)convert(process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'../../..'));
