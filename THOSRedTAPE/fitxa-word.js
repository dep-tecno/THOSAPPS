'use strict';
function buildWord(state, data) {
  const enc = new TextEncoder();
  const xml = v => String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const para = value => String(value).split('\n').map(line=>'<w:p><w:r><w:t xml:space="preserve">'+xml(line)+'</w:t></w:r></w:p>').join('');
  function table(headers, rows) {
    const widths={2:[3100,5800],3:[1250,5700,1950],4:[850,850,5200,2000]}[headers.length];
    const row=(cells,heading)=>'<w:tr><w:trPr><w:cantSplit/>'+(heading?'<w:tblHeader/>':'')+'</w:trPr>'+cells.map((c,i)=>'<w:tc><w:tcPr><w:tcW w:w="'+widths[i]+'" w:type="dxa"/>'+(heading?'<w:shd w:fill="E4E8E7"/>':'')+'</w:tcPr>'+para(c)+'</w:tc>').join('')+'</w:tr>';
    return '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>'+widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join('')+'</w:tblGrid>'+row(headers,true)+rows.map(c=>row(c,false)).join('')+'</w:tbl>';
  }
  const blocks={CE:table(['Competència','Què aprendré a fer?','Criteris'],data.CE),SA:table(['SA / Durada','Sabers treballats'],data.SA),SEQ:table(['Trim','Núm','Títol de la SA','Data Inici'],data.SEQ),EVAL:para(state.assessment)+table(['Instrument','Ponderació'],data.EVAL)+para(state.recovery),BIB:para(state.bib)};
  const fields={...state,level:state.year+' '+state.stage+' · '+state.academic,date:new Date().toLocaleDateString('ca'),duration:state.hours+' h setmanals · '+state.hours*state.weeks+' h anuals estimades · '+state.margin+' h de marge'};
  const entries=Object.entries(plantilla).map(([name,base64])=>{
    let bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
    if(name==='word/document.xml'){
      let doc=new TextDecoder().decode(bytes);
      doc=doc.replace(/<w:p(?=[\s>])[^>]*>(?:(?!<w:p[\s>])[\s\S])*?<\/w:p>/g,p=>{
        const marker=p.match(/\{\{(\w+)\}\}/);if(!marker)return p;
        return blocks[marker[1]]??p.replace(marker[0],()=>xml(fields[marker[1]]));
      });
      bytes=enc.encode(doc);
    }
    return [enc.encode(name),bytes];
  });
  const chunks=[], central=[];let offset=0;
  function record(length, fields){const a=new Uint8Array(length),v=new DataView(a.buffer);for(const [pos,size,num] of fields)v[size===2?'setUint16':'setUint32'](pos,num,true);return a;}
  for(const [name,bytes] of entries){
    let crc=-1;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(~crc)>>>0;
    const n=bytes.length;
    chunks.push(record(30,[[0,4,0x04034b50],[4,2,20],[14,4,crc],[18,4,n],[22,4,n],[26,2,name.length]]),name,bytes);
    central.push(record(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[16,4,crc],[20,4,n],[24,4,n],[28,2,name.length],[42,4,offset]]),name);
    offset+=30+name.length+n;
  }
  return new Blob([...chunks,...central,record(22,[[0,4,0x06054b50],[8,2,entries.length],[10,2,entries.length],[12,4,central.reduce((a,b)=>a+b.length,0)],[16,4,offset]])],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function exportWord(state,data){
  const url=URL.createObjectURL(buildWord(state,data)),a=document.createElement('a');
  a.href=url;a.download='Fitxa inici - '+state.subject+' - '+state.year+' '+state.stage+'.docx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
