(function(root){
 'use strict';
 const M={EPS:1e-7,CONTACT:0.6,SNAP:9,MAX_COMPONENTS:200,rpmToRad:n=>n*Math.PI/30,radius:c=>c.type==='gear'?c.properties.teeth*c.properties.module/2:c.type==='pulley'?c.properties.diameter/2:c.type==='shaft'?10:18};
 M.rackLength=c=>c.properties.teeth*c.properties.module*Math.PI;
 M.sliderPosition=(c,angle)=>{const r=c.properties.crankRadius,l=c.properties.rodLength,s=Math.sin(angle);return r*Math.cos(angle)+Math.sqrt(Math.max(0,l*l-r*r*s*s));};
 M.sliderDisplacement=(c,angle)=>M.sliderPosition(c,angle)-(c.properties.rodLength-c.properties.crankRadius);
 M.bounds=c=>c.type==='rack'?{halfWidth:M.rackLength(c)/2,halfHeight:Math.max(4,c.properties.module*1.6),offsetX:0}:c.type==='gear'?{halfWidth:M.radius(c)+c.properties.module*.8,halfHeight:M.radius(c)+c.properties.module*.8,offsetX:0}:c.type==='crankSlider'?{halfWidth:c.properties.crankRadius+c.properties.rodLength/2+11,halfHeight:c.properties.crankRadius+8,offsetX:c.properties.rodLength/2+3}:{halfWidth:M.radius(c),halfHeight:M.radius(c),offsetX:0};
 M.library={motor:{label:'Motor',ports:['ROTATIONAL_SHAFT'],defaults:{rpm:120,active:true}},shaft:{label:'Eix',ports:['ROTATIONAL_SHAFT'],defaults:{}},gear:{label:'Engranatge',ports:['ROTATIONAL_SHAFT','GEAR_CONTACT','RACK_CONTACT'],defaults:{teeth:20,module:2}},pulley:{label:'Politja',ports:['ROTATIONAL_SHAFT','BELT_PULLEY'],defaults:{diameter:40}},rack:{label:'Cremallera',ports:['RACK_CONTACT','LINEAR_SLIDER'],defaults:{teeth:24,module:2}},crankSlider:{label:'Biela-manovella',ports:['ROTATIONAL_SHAFT','LINKAGE_PIN','LINEAR_SLIDER'],defaults:{crankRadius:25,rodLength:80}}};
 M.create=(type,x,y)=>({id:crypto.randomUUID(),type,position:{x,y},rotation:0,locked:false,properties:{...M.library[type].defaults}});
 M.empty=()=>({format:'thosmotion',version:1,metadata:{title:'Muntatge'},components:[],connections:[],settings:{}});
 M.validate=data=>{
  const fail=()=>{throw Error('El fitxer no és un projecte THOSMOTION vàlid (versió 1).');};
  if(!data||data.format!=='thosmotion'||data.version!==1||!Array.isArray(data.components)||data.components.length>M.MAX_COMPONENTS||!Array.isArray(data.connections)||data.connections.length>2000)fail();
  const ids=new Set(); const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
  const components=data.components.map(c=>{
   if(!c||!Object.hasOwn(M.library,c.type)||typeof c.id!=='string'||!c.id.length||c.id.length>100||ids.has(c.id)||!finite(c.position?.x,-100000,100000)||!finite(c.position?.y,-100000,100000)||!finite(c.rotation,-1e6,1e6)||typeof c.locked!=='boolean')fail();ids.add(c.id);
   const p=c.properties;if(!p)fail();
   if(c.type==='gear'&&(!Number.isInteger(p.teeth)||!finite(p.teeth,8,120)||!finite(p.module,0.5,5)))fail();
   if(c.type==='pulley'&&!finite(p.diameter,10,240))fail();
   if(c.type==='rack'&&(!Number.isInteger(p.teeth)||!finite(p.teeth,8,60)||!finite(p.module,0.5,5)))fail();
   if(c.type==='crankSlider'&&(!finite(p.crankRadius,5,80)||!finite(p.rodLength,15,240)||p.rodLength<=p.crankRadius))fail();
   if(c.type==='motor'&&(!finite(p.rpm,-600,600)||typeof p.active!=='boolean'))fail();
   const properties=['gear','rack'].includes(c.type)?{teeth:p.teeth,module:p.module}:c.type==='pulley'?{diameter:p.diameter}:c.type==='crankSlider'?{crankRadius:p.crankRadius,rodLength:p.rodLength}:c.type==='motor'?{rpm:p.rpm,active:p.active}:{};
   return {id:c.id,type:c.type,position:{x:c.position.x,y:c.position.y},rotation:c.rotation,locked:c.locked,properties};
  });
  const byId=new Map(components.map(c=>[c.id,c]));const pairs=new Set();
  const connections=data.connections.map(e=>{
   if(!e||typeof e.id!=='string'||!['mesh','shaft','belt','rack'].includes(e.type)||!ids.has(e.a)||!ids.has(e.b)||e.a===e.b)fail();
   const a=byId.get(e.a),b=byId.get(e.b);if(e.type==='mesh'&&(a.type!=='gear'||b.type!=='gear'))fail();const rotary=['gear','motor','pulley','crankSlider'];const shaftPair=e.type==='shaft'&&((a.type==='shaft'&&rotary.includes(b.type))||(b.type==='shaft'&&rotary.includes(a.type))||(a.type==='motor'&&['gear','pulley','crankSlider'].includes(b.type))||(b.type==='motor'&&['gear','pulley','crankSlider'].includes(a.type)));if(e.type==='shaft'&&!shaftPair)fail();if(e.type==='belt'&&(a.type!=='pulley'||b.type!=='pulley'||typeof e.crossed!=='boolean'))fail();if(e.type==='rack'&&!((a.type==='gear'&&b.type==='rack')||(a.type==='rack'&&b.type==='gear')))fail();
   const key=[e.a,e.b].sort().join('|');if(pairs.has(key))fail();pairs.add(key);
   return e.type==='belt'?{id:e.id,type:e.type,a:e.a,b:e.b,crossed:e.crossed}:{id:e.id,type:e.type,a:e.a,b:e.b};
  });
  return {format:'thosmotion',version:1,metadata:{title:typeof data.metadata?.title==='string'?data.metadata.title.slice(0,160):'Muntatge'},components,connections,settings:{}};
 };
 root.ThosMotion=root.ThosMotion||{};root.ThosMotion.model=M;
 if(typeof module!=='undefined')module.exports=M;
})(globalThis);
