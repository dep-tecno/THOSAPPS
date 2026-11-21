import {crc32} from './zip.mjs';

const mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const word='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const office='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const encode=new TextEncoder();
const entities={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'};
const xml=value=>String(value).toWellFormed().replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g,'\ufffd').replace(/[&<>"]/g,char=>entities[char]);

function packageDocx(files){
  const chunks=[],directory=[];
  let offset=0,directorySize=0;
  for(const [path,value] of files){
    const name=encode.encode(path),bytes=typeof value==='string'?encode.encode(declaration+value):value;
    const crc=crc32(bytes);
    const local=new DataView(new ArrayBuffer(30));
    const central=new DataView(new ArrayBuffer(46));
    local.setUint32(0,0x04034b50,true);
    central.setUint32(0,0x02014b50,true);
    central.setUint16(4,20,true);
    central.setUint32(42,offset,true);
    for(const [header,start] of [[local,4],[central,6]]){
      header.setUint16(start,20,true);
      header.setUint16(start+8,33,true); // DOS date: 1980-01-01.
      header.setUint32(start+10,crc,true);
      header.setUint32(start+14,bytes.length,true);
      header.setUint32(start+18,bytes.length,true);
      header.setUint16(start+22,name.length,true);
    }
    chunks.push(local.buffer,name,bytes);
    directory.push(central.buffer,name);
    offset+=30+name.length+bytes.length;
    directorySize+=46+name.length;
  }
  const end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);
  end.setUint16(8,files.length,true);
  end.setUint16(10,files.length,true);
  end.setUint32(12,directorySize,true);
  end.setUint32(16,offset,true);
  return new Blob([...chunks,...directory,end.buffer],{type:mime});
}

const relationships=items=>`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id,type,target])=>`<Relationship Id="${id}" Type="${office}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
function run(text,align=''){
  const properties=align?`<w:rPr><w:vertAlign w:val="${align}"/></w:rPr>`:'';
  return `<w:r>${properties}${text.split(/\r\n?|\n/).map(line=>`<w:t xml:space="preserve">${xml(line)}</w:t>`).join('<w:br/>')}</w:r>`;
}
function inline(node){
  if(node.localName!=='p'||!node.children.length)return run(node.textContent);
  return [...node.childNodes].map(child=>run(child.textContent,{sub:'subscript',sup:'superscript'}[child.localName])).join('');
}
function paragraph(content,style='',properties=''){
  const format=(style?`<w:pStyle w:val="${style}"/>`:'')+properties;
  return `<w:p>${format?`<w:pPr>${format}</w:pPr>`:''}${content}</w:p>`;
}

async function embedImage(img,mode,pageWidth,fetchImage){
  try{
    await img.decode();
    const width=img.naturalWidth,height=img.naturalHeight;
    if(!width||!height)throw Error('Dimensions buides');
    const scale=Math.min(1,pageWidth/(width*9525),({compact:1980000,auto:3960000,large:5040000}[mode])/(height*9525));
    const cx=Math.max(1,Math.round(width*9525*scale)),cy=Math.max(1,Math.round(height*9525*scale));
    let blob=await fetchImage(img.src);
    if(blob.type==='image/svg+xml'){
      // PNG preserves SVG diagrams in Word and in Google Docs imports.
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(cx/914400*240));
      canvas.height=Math.max(1,Math.round(cy/914400*240));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    }
    if(!blob||!['image/png','image/jpeg'].includes(blob.type))throw Error('Format d’imatge incompatible');
    return {cx,cy,extension:blob.type==='image/jpeg'?'jpg':'png',bytes:new Uint8Array(await blob.arrayBuffer())};
  }catch{
    throw Error(`No s’ha pogut incorporar la figura «${img.alt}» al Word.`);
  }
}

function drawing(image,id,relationship,alt){
  const {cx,cy}=image,description=xml(alt);
  return paragraph(`<w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Figura ${id}" descr="${description}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="Figura ${id}" descr="${description}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relationship}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`,'Figure');
}

function table(node,width){
  const rows=[...node.querySelectorAll('tr')];
  const columns=rows[0].children.length;
  const cellWidth=Math.floor(width/columns);
  const grid='<w:tblGrid>'+('<w:gridCol w:w="'+cellWidth+'"/>').repeat(columns)+'</w:tblGrid>';
  const borders=['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="single" w:sz="4" w:color="A9B9C1"/>`).join('');
  const caption=[...node.children].find(child=>child.localName==='caption');
  return (caption?paragraph(run(caption.textContent),'Caption','<w:keepNext/>'):'')+
    `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="dxa"/><w:tblBorders>${borders}</w:tblBorders>`+
    `<w:tblLayout w:type="fixed"/></w:tblPr>${grid}`+rows.map((row,index)=>
      '<w:tr>'+(index===0?'<w:trPr><w:tblHeader/></w:trPr>':'')+[...row.children].map(cell=>
        `<w:tc><w:tcPr><w:tcW w:w="${cellWidth}" w:type="dxa"/></w:tcPr>`+
        paragraph(run(cell.textContent),index===0?'TableHeading':'TableText')+'</w:tc>').join('')+'</w:tr>').join('')+'</w:tbl>';
}

function styles(compact,language){
  const definitions=[
    ['Title',52,'<w:keepNext/>','<w:b/>'],
    ...[32,26,23,22,21].map((size,index)=>[`Heading${index+1}`,size,
      `<w:keepNext/><w:keepLines/><w:spacing w:before="200" w:after="90"/><w:outlineLvl w:val="${index}"/>`,'<w:b/>']),
    ['Caption',19,'<w:jc w:val="center"/>','<w:i/>'],
    ['Figure',22,'<w:keepNext/><w:jc w:val="center"/>',''],
    ['TableHeading',21,'','<w:b/>'],
    ['TableText',21,'',''],
    ['Response',22,'<w:pBdr><w:bottom w:val="single" w:sz="4" w:color="A9B9C1"/><w:between w:val="single" w:sz="4" w:color="A9B9C1"/></w:pBdr><w:spacing w:after="95" w:line="360" w:lineRule="atLeast"/>','']
  ];
  return `<w:styles xmlns:w="${word}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="${compact?20:22}"/><w:lang w:val="${xml(language)}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="${compact?65:120}"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>`+
    definitions.map(([id,size,pPr,rPr])=>`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id.replace(/^Heading(\d)$/, 'heading $1')}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr>${pPr}</w:pPr><w:rPr>${rPr}<w:sz w:val="${size}"/></w:rPr></w:style>`).join('')+'</w:styles>';
}

export async function createDocx(paper,{language='ca',compact=false,fetchImage=async url=>(await fetch(url)).blob()}={}){
  const landscape=paper.dataset.orientation==='landscape';
  const [width,height]=landscape?[16838,11906]:[11906,16838];
  const margin=850,bodyWidth=width-2*margin;
  const files=[],links=[['styles','styles','styles.xml'],['numbering','numbering','numbering.xml']];
  const numbering=[];
  const media=new Map();
  const bookmarks=new Map([...paper.querySelectorAll('section')].filter(node=>node.id).map((node,index)=>[node.id,index+1]));
  const contents=[];
  let imageId=0;

  async function write(node){
    const tag=node.localName,classes=node.className.split(/\s+/);
    const has=name=>classes.includes(name);
    if(tag==='img'){
      const id=++imageId;
      if(!media.has(node.src)){
        const {bytes,extension,cx,cy}=await embedImage(node,paper.dataset.images,bodyWidth*635,fetchImage);
        const name=`media/figure-${id}.${extension}`,relationship=`image${id}`;
        files.push(['word/'+name,bytes]);
        links.push([relationship,'image',name]);
        media.set(node.src,{cx,cy,relationship});
      }
      const image=media.get(node.src);
      contents.push(drawing(image,id,image.relationship,node.alt));
    }else if(tag==='table'){
      contents.push(table(node,bodyWidth));
    }else if(tag==='ol'||tag==='ul'){
      const id=numbering.length+1;
      const options=has('options');
      const type=tag==='ol'?0:1;
      if(!options)numbering.push(`<w:num w:numId="${id}"><w:abstractNumId w:val="${type}"/></w:num>`);
      for(const item of node.children){
        const anchor=item.children[0];
        const bookmark=anchor?.localName==='a'&&bookmarks.get(anchor.href.split('#').at(-1));
        const content=bookmark?`<w:hyperlink w:anchor="section${bookmark}">${run(item.textContent)}</w:hyperlink>`:run(item.textContent);
        const format=options?'<w:ind w:left="360"/>':`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${id}"/></w:numPr>`;
        contents.push(paragraph(content,'',format));
      }
    }else if(has('response-space')){
      contents.push(paragraph(run(' '),'Response').repeat(3));
    }else if(/^h[1-6]$/.test(tag)||['p','aside','figcaption'].includes(tag)){
      const parent=node.parentElement;
      const startsSection=tag==='h2'&&parent?.id;
      const bookmark=startsSection&&bookmarks.get(parent.id);
      const style=tag==='h1'?'Title':/^h[2-6]$/.test(tag)?'Heading'+(Number(tag[1])-1):tag==='figcaption'?'Caption':'';
      const pageBreak=startsSection&&!parent.className.split(/\s+/).includes('first');
      const content=inline(node);
      contents.push(paragraph(bookmark?`<w:bookmarkStart w:id="${bookmark}" w:name="section${bookmark}"/>${content}<w:bookmarkEnd w:id="${bookmark}"/>`:content,
        style,pageBreak?'<w:pageBreakBefore/>':''));
    }else{
      for(const child of node.children)await write(child);
      if(has('cover')||has('toc'))contents.push(paragraph('<w:r><w:br w:type="page"/></w:r>'));
    }
  }

  await write(paper);
  const section=`<w:sectPr><w:pgSz w:w="${width}" w:h="${height}"${landscape?' w:orient="landscape"':''}/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>`;
  const abstract=(id,format,label)=>`<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${label}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="540" w:hanging="300"/></w:pPr></w:lvl></w:abstractNum>`;
  return packageDocx([
    ['[Content_Types].xml',`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>${['document','styles','numbering'].map(name=>`<Override PartName="/word/${name}.xml" ContentType="${mime.replace('.document','') }.${name}${name==='document'?'.main':''}+xml"/>`).join('')}</Types>`],
    ['_rels/.rels',relationships([['document','officeDocument','word/document.xml']])],
    ['word/_rels/document.xml.rels',relationships(links)],
    ['word/styles.xml',styles(compact,language)],
    ['word/numbering.xml',`<w:numbering xmlns:w="${word}">${abstract(0,'decimal','%1.')}${abstract(1,'bullet','•')}${numbering.join('')}</w:numbering>`],
    ['word/document.xml',`<w:document xmlns:w="${word}" xmlns:r="${office}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${contents.join('')}${section}</w:body></w:document>`],
    ...files
  ]);
}
