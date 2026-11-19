// ZIP local: stored/deflate, with bounded output and CRC verification.
export const limits = { zip: 60*1024**2, total: 160*1024**2, entries: 1500, ratio: 200 };
const decoder = new TextDecoder('utf-8', {fatal:true});
export function safePath(path) {
  return typeof path === 'string' && path.length > 0 && !/[\\\x00-\x1f\x7f:%?#]/.test(path) &&
    !path.startsWith('/') && !path.split('/').some((part,i,a) => part==='..'||part==='.'||(!part&&i<a.length-1));
}
export function crc32(bytes) {
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
}
export async function readZip(file) {
  if(file.size>limits.zip)throw Error('El ZIP supera el límit de 60 MB.');
  const buffer=await file.arrayBuffer(),v=new DataView(buffer),bytes=new Uint8Array(buffer);
  const u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);
  let end=-1;
  for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)
    if(u32(p)===0x06054b50&&p+22+u16(p+20)===bytes.length){end=p;break;}
  if(end<0)throw Error('El fitxer no és un ZIP vàlid.');
  if(u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10))throw Error('ZIP dividit en volums no compatible.');
  const count=u16(end+10),dirSize=u32(end+12),dir=u32(end+16);
  if(count===65535||dir===0xffffffff||dirSize===0xffffffff)throw Error('ZIP64 no compatible.');
  if(!count||count>limits.entries||dir+dirSize!==end)throw Error('Directori ZIP incorrecte o massa entrades.');
  const entries=new Map(),folded=new Set(),ranges=[];let pos=dir,total=0;
  for(let i=0;i<count;i++){
    if(pos+46>end||u32(pos)!==0x02014b50)throw Error('Directori ZIP corrupte.');
    const flags=u16(pos+8),method=u16(pos+10),crc=u32(pos+16),packed=u32(pos+20),size=u32(pos+24);
    const n=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),offset=u32(pos+42);
    if(pos+46+n+extra+comment>end||u16(pos+34)||flags&1)throw Error('Entrada ZIP incompleta, xifrada o dividida.');
    const name=decoder.decode(bytes.subarray(pos+46,pos+46+n));pos+=46+n+extra+comment;
    if(!safePath(name)||folded.has(name.toLowerCase()))throw Error('Ruta ZIP insegura o duplicada: '+name);
    folded.add(name.toLowerCase());
    if(method!==0&&method!==8)throw Error('Compressió ZIP no compatible.');
    total+=size;
    if(total>limits.total||(size>1024**2&&size>packed*limits.ratio))throw Error('El ZIP supera els límits de descompressió segura.');
    if(offset+30>dir||u32(offset)!==0x04034b50)throw Error('Capçalera ZIP incorrecta.');
    const localNameLength=u16(offset+26),start=offset+30+localNameLength+u16(offset+28);
    if(start+packed>dir||u16(offset+8)!==method||u16(offset+6)!==flags||
      decoder.decode(bytes.subarray(offset+30,offset+30+localNameLength))!==name)throw Error('Capçaleres ZIP inconsistents: '+name);
    ranges.push([offset,start+packed]);entries.set(name,{method,packed,size,start,crc});
  }
  if(pos!==end)throw Error('Mida del directori ZIP inconsistent.');
  ranges.sort((a,b)=>a[0]-b[0]);
  if(ranges.some((r,i)=>i&&r[0]<ranges[i-1][1]))throw Error('Entrades ZIP superposades.');
  async function get(name){
    const e=entries.get(name);if(!e)throw Error('No es troba '+name);
    let data=bytes.slice(e.start,e.start+e.packed);
    if(e.method===8){
      if(typeof DecompressionStream==='undefined')throw Error('Aquest navegador no admet descompressió ZIP local.');
      const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks=[];let length=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;
        if(length>e.size||length>limits.total)throw Error('Descompressió excessiva: '+name);chunks.push(value);}}
      catch(error){await reader.cancel().catch(()=>{});throw error;}
      data=new Uint8Array(length);let p=0;for(const chunk of chunks){data.set(chunk,p);p+=chunk.length;}
    }
    if(data.length!==e.size||crc32(data)!==e.crc)throw Error('Mida o CRC incorrecte: '+name);
    return data;
  }
  return {entries,get,has:name=>entries.has(name)};
}
export function parseJson(bytes,name){try{return JSON.parse(decoder.decode(bytes));}catch{throw Error('JSON invàlid: '+name);}}
