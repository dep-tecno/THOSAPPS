(function(root){
 'use strict';
 const M=root.ThosMotion.model;
 const field=(label,key,min,max,step=1)=>({label,key,min,max,step});
 const definitions={
  internalGear:{label:'Engranatge interior',ports:['ROTATIONAL_SHAFT','INTERNAL_GEAR_CONTACT'],defaults:{teeth:60,module:2},fields:[field('Dents','teeth',24,160),field('Mòdul (mm)','module',.5,5,.5)]},
  bevelGear:{label:'Engranatge cònic',ports:['ROTATIONAL_SHAFT','BEVEL_GEAR_CONTACT'],defaults:{teeth:20,module:2,axis:0},fields:[field('Dents','teeth',8,120),field('Mòdul (mm)','module',.5,5,.5),field('Eix (0° o 90°)','axis',0,90,90)]},
  fourBar:{label:'Quatre barres',ports:['ROTATIONAL_SHAFT','LINKAGE_PIN'],defaults:{ground:100,crank:25,coupler:90,rocker:60},fields:[field('Bastidor (mm)','ground',20,200),field('Manovella (mm)','crank',5,80),field('Biela (mm)','coupler',10,240),field('Balancí (mm)','rocker',10,200)]},
  lever:{label:'Palanca',ports:['ROTATIONAL_SHAFT','FIXED_SUPPORT'],defaults:{inputArm:60,outputArm:30},fields:[field('Braç d’entrada (mm)','inputArm',10,160),field('Braç de sortida (mm)','outputArm',10,160)]},
  fixedPulley:{label:'Politja fixa',ports:['ROTATIONAL_SHAFT','LINEAR_SLIDER'],defaults:{radius:18,height:140},fields:[field('Radi (mm)','radius',10,40),field('Separació inicial (mm)','height',80,300)]},
  movablePulley:{label:'Politja mòbil',ports:['ROTATIONAL_SHAFT','LINEAR_SLIDER'],defaults:{radius:18,height:140},fields:[field('Radi (mm)','radius',10,40),field('Separació inicial (mm)','height',80,300)]},
  hoist:{label:'Polispast',ports:['ROTATIONAL_SHAFT','LINEAR_SLIDER'],defaults:{radius:14,height:140,pairs:2},fields:[field('Radi (mm)','radius',10,30),field('Separació inicial (mm)','height',80,300),field('Parelles de politges','pairs',2,4)]},
  differential:{label:'Diferencial simplificat',ports:['ROTATIONAL_SHAFT'],defaults:{split:1},fields:[field('Factor sortida A','split',0,2,.1)]}
 };
 M.extraRotary=Object.keys(definitions);
 M.advanced={};
 for(const [type,d]of Object.entries(definitions)){
  M.library[type]={label:d.label,ports:d.ports,defaults:d.defaults};
  M.advanced[type]={validate(p,fail){for(const f of d.fields)if(typeof p[f.key]!=='number'||!Number.isFinite(p[f.key])||p[f.key]<f.min||p[f.key]>f.max||(f.step===1&&!Number.isInteger(p[f.key]))||(f.key==='axis'&&![0,90].includes(p[f.key])))fail();},properties:p=>Object.fromEntries(d.fields.map(f=>[f.key,p[f.key]]))};
 }
 const oldRadius=M.radius,oldBounds=M.bounds,oldTracePoint=M.tracePoint;
 M.radius=c=>['internalGear','bevelGear'].includes(c.type)?c.properties.teeth*c.properties.module/2:['fixedPulley','movablePulley','hoist'].includes(c.type)?c.properties.radius:c.type==='fourBar'?c.properties.crank:c.type==='differential'?35:oldRadius(c);
 M.bounds=c=>{
  const p=c.properties;
  if(c.type==='internalGear')return {halfWidth:M.radius(c)+p.module*3,halfHeight:M.radius(c)+p.module*3,offsetX:0,offsetY:0};
  if(c.type==='bevelGear')return {halfWidth:M.radius(c)+6,halfHeight:M.radius(c)+6,offsetX:0,offsetY:0};
  if(c.type==='fourBar')return {halfWidth:(p.ground+p.rocker+p.crank)/2+8,halfHeight:Math.max(p.crank,p.rocker)+10,offsetX:(p.ground+p.rocker-p.crank)/2,offsetY:0};
  if(c.type==='lever')return {halfWidth:Math.max(p.inputArm,p.outputArm)+8,halfHeight:Math.max(p.inputArm,p.outputArm)+8,offsetX:0,offsetY:0};
  if(['fixedPulley','movablePulley','hoist'].includes(c.type)){const n=c.type==='hoist'?p.pairs:1;return {halfWidth:(c.type==='fixedPulley'?p.radius:2*n*p.radius)+24,halfHeight:(p.height+50)/2,offsetX:c.type==='fixedPulley'?0:2*n*p.radius-p.radius,offsetY:(p.height+20)/2};}
  if(c.type==='differential')return {halfWidth:87,halfHeight:44,offsetX:0,offsetY:0};
  return oldBounds(c);
 };
 M.fourBarValid=c=>{const p=c.properties,min=p.ground-p.crank,max=p.ground+p.crank;return min>Math.abs(p.coupler-p.rocker)+M.EPS&&max<p.coupler+p.rocker-M.EPS;};
 // Intersection of the coupler circle at A and the rocker circle at the fixed pivot D.
 M.fourBarState=(c,position)=>{
  const p=c.properties,A={x:p.crank*Math.cos(position),y:-p.crank*Math.sin(position)},dx=p.ground-A.x,dy=-A.y,d=Math.hypot(dx,dy);
  if(d<M.EPS||d>p.coupler+p.rocker+M.EPS||d<Math.abs(p.coupler-p.rocker)-M.EPS)return null;
  const along=(p.coupler*p.coupler-p.rocker*p.rocker+d*d)/(2*d),h=Math.sqrt(Math.max(0,p.coupler*p.coupler-along*along)),B={x:A.x+along*dx/d+h*dy/d,y:A.y+along*dy/d-h*dx/d};
  return {A,B,mid:{x:(A.x+B.x)/2,y:(A.y+B.y)/2},outputAngle:Math.atan2(-B.y,B.x-p.ground)};
 };
 M.ropeStrands=c=>c.type==='fixedPulley'?1:c.type==='movablePulley'?2:2*c.properties.pairs;
 M.familyLinearPosition=(c,position)=>c.type==='lever'?-c.properties.outputArm*Math.sin(position):c.type==='fourBar'?(M.fourBarState(c,position)?.mid.y||0):['fixedPulley','movablePulley','hoist'].includes(c.type)?-position*c.properties.radius/M.ropeStrands(c):0;
 M.familyLinearVelocity=(c,position,omega)=>{
  if(c.type==='lever')return -c.properties.outputArm*Math.cos(position)*omega;
  if(c.type==='fourBar'){const delta=1e-5;return (M.familyLinearPosition(c,position+delta)-M.familyLinearPosition(c,position-delta))/(2*delta)*omega;}
  return ['fixedPulley','movablePulley','hoist'].includes(c.type)?-omega*c.properties.radius/M.ropeStrands(c):0;
 };
 M.fourBarOutputVelocity=(c,position,omega)=>{const delta=1e-5,a=M.fourBarState(c,position-delta),b=M.fourBarState(c,position+delta);if(!a||!b)return 0;const difference=b.outputAngle-a.outputAngle;return Math.atan2(Math.sin(difference),Math.cos(difference))/(2*delta)*omega;};
 M.differentialSpeeds=(c,rpm)=>({a:rpm*c.properties.split||0,b:rpm*(2-c.properties.split)||0});
 M.familyMeasurementValid=(c,kind,position)=>c.type!=='fourBar'||!['fourBarOutputAngle','fourBarOutputSpeed','linearSpeed','displacement'].includes(kind)||M.fourBarState(c,position)!==null;
 M.tracePoint=(c,kind,position)=>{
  if(c.type==='fourBar'&&['couplerPoint','rockerPoint'].includes(kind)){const geometry=M.fourBarState(c,position);return geometry?(kind==='couplerPoint'?geometry.mid:geometry.B):null;}
  if(c.type==='lever'&&kind==='leverTip')return {x:c.properties.outputArm*Math.cos(position),y:M.familyLinearPosition(c,position)};
  if(['fixedPulley','movablePulley','hoist'].includes(c.type)&&kind==='loadPoint')return {x:c.type==='fixedPulley'?c.properties.radius:2*c.properties.radius*(c.type==='hoist'?c.properties.pairs:1),y:c.properties.height+M.familyLinearPosition(c,position)+30};
  return oldTracePoint(c,kind,position);
 };
 const linearTypes=['fourBar','lever','fixedPulley','movablePulley','hoist'];
 function annotation(c){const p=c.properties;return ['internalGear','bevelGear'].includes(c.type)?`Z${p.teeth} · m${p.module}`:c.type==='lever'?`${p.inputArm}:${p.outputArm}`:c.type==='fourBar'?'4 barres':c.type==='differential'?`A ×${p.split} · B ×${(2-p.split).toFixed(1)}`:`${M.ropeStrands(c)} trams portants`;}
 function info(c,s,position){
  const p=c.properties,number=n=>n.toLocaleString('ca',{maximumFractionDigits:2}),n=s.rpm||0,omega=M.rpmToRad(n);let detail='';
  if(c.type==='internalGear')detail=`Z = ${p.teeth} · m = ${p.module}\nContacte interior: mateix sentit de gir.\nModel ideal; sense interferència detallada de dents.`;
  if(c.type==='bevelGear')detail=`Z = ${p.teeth} · m = ${p.module}\nEix ${p.axis}° · projecció didàctica 2D.\nEngrana amb un eix perpendicular.\nEls signes de gir segueixen la referència del model.`;
  if(c.type==='fourBar'){const state=M.fourBarState(c,position);detail=`Bastidor ${p.ground} · manovella ${p.crank} mm\nBiela ${p.coupler} · balancí ${p.rocker} mm\n${M.fourBarValid(c)?'Manovella amb volta completa.':'Longituds incompatibles amb volta completa.'}${state?`\nAngle balancí = ${number(state.outputAngle*180/Math.PI)}°`:''}`;}
  if(c.type==='lever')detail=`Braç entrada = ${p.inputArm} mm\nBraç sortida = ${p.outputArm} mm\nAvantatge mecànic ideal = ${number(p.inputArm/p.outputArm)}\nDesplaçament vertical sortida / entrada = −${number(p.outputArm/p.inputArm)}\nAcciona-la amb una manovella manual.`;
  if(['fixedPulley','movablePulley','hoist'].includes(c.type)){const strands=M.ropeStrands(c);detail=`${strands} trams sostenen la càrrega\nAvantatge mecànic ideal = ${strands}\nCorda recollida = ${number(position*p.radius)} mm\nAlçament càrrega = ${number(-M.familyLinearPosition(c,position))} mm\nEntrada: torn ideal · corda inextensible\nRecorregut sense topalls al model.`;}
  if(c.type==='differential'){const outputs=M.differentialSpeeds(c,n);detail=`Entrada = ${number(n)} rpm\nSortida A = ${number(outputs.a)} rpm\nSortida B = ${number(outputs.b)} rpm\n(A + B) / 2 = entrada\nRepartiment imposat pel factor A.\nSortides internes; sense càrregues ni parell.`;}
  const motion=!M.familyMeasurementValid(c,'displacement',position)?'\nSortida no disponible: geometria incompatible.':linearTypes.includes(c.type)?`\ns vertical = ${number(M.familyLinearPosition(c,position))} mm\nv vertical = ${number(M.familyLinearVelocity(c,position,omega))} mm/s`:'';
  return `${M.library[c.type].label}\n${detail}${c.type==='differential'?'':`\nn entrada = ${number(n)} rpm`}${motion}\n${s.conflict?'Bloquejat':n===0?'Aturat':'En moviment'}`;
 }
 const line=(el,parent,color='#91a9ba',width=4)=>el('line',{stroke:color,'stroke-width':width,'stroke-linecap':'round'},parent);
 const set=(node,attrs)=>{for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);};
 function wheel(el,parent,r,color='#91a9ba'){el('circle',{r,fill:'#202d38',stroke:color,'stroke-width':2},parent);el('circle',{r:r-4,fill:'none',stroke:'#657d8e'},parent);el('line',{x1:0,y1:0,x2:r-4,y2:0,stroke:'#20c4c8','stroke-width':2},parent);}
 function draw(c,parent,rotor,selected,el){
  const p=c.properties,r=M.radius(c),color=selected?'#17434a':'#273643';
  if(c.type==='internalGear'){
   el('circle',{r:r+p.module*3,fill:'none',stroke:'#91a9ba','stroke-width':p.module*2},rotor);
   let d='';for(let i=0;i<p.teeth*4;i++){const a=(i+.5)*Math.PI*2/(p.teeth*4),rr=i%4===0||i%4===3?r+p.module*.8:r-p.module*.8;d+=`${i?'L':'M'}${rr*Math.cos(a)},${rr*Math.sin(a)} `;}
   el('path',{d:d+'Z',fill:'none',stroke:'#b8c8d3','stroke-width':1.5},rotor);el('line',{x1:r+p.module,y1:0,x2:r+p.module*4,y2:0,stroke:'#20c4c8','stroke-width':3},rotor);
   parent.append(rotor);return {update:angle=>rotor.setAttribute('transform',`rotate(${-angle*180/Math.PI})`)};
  }
  if(c.type==='bevelGear'){
   el('line',{x1:p.axis===0?-r-8:0,y1:p.axis===90?-r-8:0,x2:p.axis===0?r+8:0,y2:p.axis===90?r+8:0,stroke:'#f0b85a','stroke-width':2,'stroke-dasharray':'4 3'},parent);
   el('path',{d:`M${-r},0 L0,${-r*.7} L${r},0 L0,${r*.7} Z`,fill:color,stroke:'#91a9ba','stroke-width':2},parent);
   el('circle',{r:r*.72,fill:'#202d38',stroke:'#b8c8d3','stroke-width':1.5},rotor);
   for(let i=0;i<p.teeth;i++)el('line',{x1:r*.58,y1:0,x2:r*.78,y2:0,stroke:'#b8c8d3','stroke-width':1,transform:`rotate(${i*360/p.teeth})`},rotor);
   el('line',{x1:0,y1:0,x2:r*.55,y2:0,stroke:'#20c4c8','stroke-width':2},rotor);el('path',{d:'M-5,-5 L5,-5 L5,5',fill:'none',stroke:'#f0b85a','stroke-width':1.5},parent);
   parent.append(rotor);return {update:angle=>rotor.setAttribute('transform',`rotate(${-angle*180/Math.PI})`)};
  }
  if(c.type==='fourBar'){
   const base=line(el,parent,'#526b7c',2);set(base,{x1:0,y1:0,x2:p.ground,y2:0,'stroke-dasharray':'5 4'});
   const crank=line(el,parent,'#20c4c8',5),coupler=line(el,parent),rocker=line(el,parent,'#f0b85a',5),pins=[0,1,2,3].map(()=>el('circle',{r:4,fill:'#111922',stroke:'#b8c8d3','stroke-width':1.5},parent));
   return {update:angle=>{const q=M.fourBarState(c,angle);if(!q){set(crank,{x1:0,y1:0,x2:p.crank,y2:0});set(coupler,{x1:p.crank,y1:0,x2:p.ground,y2:0,opacity:.3});set(rocker,{x1:p.ground,y1:0,x2:p.ground,y2:-p.rocker,opacity:.3});return;}set(crank,{x1:0,y1:0,x2:q.A.x,y2:q.A.y});set(coupler,{x1:q.A.x,y1:q.A.y,x2:q.B.x,y2:q.B.y});set(rocker,{x1:p.ground,y1:0,x2:q.B.x,y2:q.B.y});[{x:0,y:0},q.A,q.B,{x:p.ground,y:0}].forEach((v,i)=>set(pins[i],{cx:v.x,cy:v.y}));}};
  }
  if(c.type==='lever'){
   el('path',{d:'M-12,17 L0,0 L12,17 Z',fill:'#273643',stroke:'#91a9ba','stroke-width':1.5},parent);
   set(line(el,rotor,'#f0b85a',5),{x1:-p.inputArm,y1:0,x2:0,y2:0});set(line(el,rotor,'#20c4c8',5),{x1:0,y1:0,x2:p.outputArm,y2:0});
   el('circle',{cx:-p.inputArm,r:4,fill:'#f0b85a'},rotor);el('circle',{cx:p.outputArm,r:4,fill:'#20c4c8'},rotor);el('circle',{r:4,fill:'#111922',stroke:'#b8c8d3'},parent);
   parent.append(rotor);return {update:angle=>rotor.setAttribute('transform',`rotate(${-angle*180/Math.PI})`)};
  }
  if(c.type==='differential'){
   el('rect',{x:-37,y:-29,width:74,height:58,rx:12,fill:color,stroke:'#91a9ba','stroke-width':2},parent);
   const outputs=[];for(const x of [-67,67]){set(line(el,parent,'#91a9ba',5),{x1:x,y1:0,x2:Math.sign(x)*24,y2:0});const group=el('g',{transform:`translate(${x} 0)`},parent),spin=el('g',{},group);wheel(el,spin,17);outputs.push(spin);const label=el('text',{x,y:29,fill:'#b8c8d3','font-size':8,'text-anchor':'middle'},parent);label.textContent=x<0?'A':'B';}
   wheel(el,rotor,19,'#20c4c8');parent.append(rotor);return {update:angle=>{rotor.setAttribute('transform',`rotate(${-angle*180/Math.PI})`);outputs[0].setAttribute('transform',`rotate(${-angle*p.split*180/Math.PI})`);outputs[1].setAttribute('transform',`rotate(${-angle*(2-p.split)*180/Math.PI})`);}};
  }
  // Rope drives are functional assemblies: an ideal winch imposes cable travel s=Rθ.
  const count=c.type==='hoist'?p.pairs:1,strands=M.ropeStrands(c),upper=[],lower=[],ropes=[],spacing=4*p.radius;
  const base=line(el,parent,'#526b7c',3);set(base,{x1:-p.radius-10,y1:-p.radius-10,x2:(count-1)*spacing+(c.type==='fixedPulley'?p.radius:3*p.radius)+10,y2:-p.radius-10});
  for(let i=0;i<count;i++){const x=i*spacing,group=el('g',{transform:`translate(${x} 0)`},parent),spin=el('g',{},group);wheel(el,spin,p.radius);upper.push({x,spin});if(c.type!=='fixedPulley'){const low=el('g',{},parent),lowSpin=el('g',{},low);wheel(el,lowSpin,p.radius);lower.push({x:x+2*p.radius,group:low,spin:lowSpin});}ropes.push(line(el,parent,'#bac8d2',1.5));ropes.push(line(el,parent,'#bac8d2',1.5));}
  const load=el('g',{},parent);el('rect',{x:-13,y:17,width:26,height:24,rx:3,fill:color,stroke:'#f0b85a','stroke-width':1.5},load);set(line(el,load,'#f0b85a',1.5),{x1:0,y1:0,x2:0,y2:17});
  const end=el('circle',{r:4,fill:'#20c4c8'},parent),free=line(el,parent,'#20c4c8',1.5),block=line(el,parent,'#91a9ba',3);
  return {update:angle=>{
   const travel=angle*p.radius,height=p.height-travel/strands,loadX=c.type==='fixedPulley'?p.radius:2*count*p.radius;
   load.setAttribute('transform',`translate(${loadX} ${height})`);set(free,{x1:-p.radius,y1:0,x2:-p.radius,y2:p.height+travel});set(end,{cx:-p.radius,cy:p.height+travel});
   if(lower.length)set(block,{x1:lower[0].x,y1:height,x2:lower.at(-1).x,y2:height});
   for(let i=0;i<count;i++){
    const x=upper[i].x;upper[i].spin.setAttribute('transform',`rotate(${-angle*(count-i)/count*180/Math.PI})`);
    if(lower[i]){lower[i].group.setAttribute('transform',`translate(${lower[i].x} ${height})`);lower[i].spin.setAttribute('transform',`rotate(${angle*(2*(count-i)-1)/strands*180/Math.PI})`);}
    set(ropes[2*i],{x1:x+p.radius,y1:0,x2:x+p.radius,y2:height});
    if(lower[i])set(ropes[2*i+1],{x1:lower[i].x+p.radius,y1:height,x2:lower[i].x+p.radius,y2:i===count-1?-p.radius-10:0});
   }
  }};
 }
 const exampleTypes={advancedInternal:'internalGear',advancedBevel:'bevelGear',advancedFourBar:'fourBar',advancedLever:'lever',advancedFixed:'fixedPulley',advancedMovable:'movablePulley',advancedHoist:'hoist',advancedDifferential:'differential'};
 function example(kind){const type=exampleTypes[kind],p=M.empty(),c=M.create(type,0,0),source=M.create(type==='lever'?'manualCrank':'motor',0,0);if(type==='lever')source.properties.radius=50;else source.properties.rpm=['fixedPulley','movablePulley','hoist'].includes(type)?5:30;p.components=[source,c];root.ThosMotion.connections.snap(p,c);
  if(type==='internalGear'){const gear=M.create('gear',40,0);p.components.push(gear);root.ThosMotion.connections.snap(p,gear);}
  if(type==='bevelGear'){const gear=M.create('bevelGear',60,0);gear.properties.teeth=40;gear.properties.axis=90;p.components.push(gear);root.ThosMotion.connections.snap(p,gear);}
  if(type==='differential')c.properties.split=.5;
  return {project:p,selected:c.id};
 }
 root.ThosMotion.families={has:type=>Object.hasOwn(definitions,type),definitions,linearTypes,annotation,info,draw,isExample:kind=>Object.hasOwn(exampleTypes,kind),example};
 if(typeof module!=='undefined')module.exports=root.ThosMotion.families;
})(globalThis);
