(function(root){
 'use strict';
 const M=root.ThosMotion.model,C=root.ThosMotion.connections;
 const label=c=>M.library[c.type].label;
 const near=(a,b)=>{const x=M.bounds(a),y=M.bounds(b);return Math.abs(a.position.x+x.offsetX-b.position.x-y.offsetX)<=x.halfWidth+y.halfWidth+M.SNAP&&Math.abs(a.position.y+x.offsetY-b.position.y-y.offsetY)<=x.halfHeight+y.halfHeight+M.SNAP;};
 function explicitPair(a,b,type){
  const expected=type==='belt'?['pulley','pulley']:type==='chain'?['sprocket','sprocket']:['worm','wormWheel'];
  if(!expected.includes(a.type)||!expected.includes(b.type)||(type==='worm'&&a.type===b.type))return {state:'incompatible',message:'× Tria una segona peça compatible amb aquesta connexió.'};
  if(a.id===b.id)return {state:'incompatible',message:'× Tria una segona peça diferent.'};
  if(type==='chain'&&Math.abs(a.properties.pitch-b.properties.pitch)>M.EPS)return {state:'incompatible',message:'× Els pinyons tenen passos diferents. Iguala el pas de cadena.'};
  if(type==='worm'&&Math.abs(a.properties.module-b.properties.module)>M.EPS)return {state:'incompatible',message:'× El cargol i la corona tenen mòduls diferents. Iguala el mòdul.'};
  if(C.distance(a,b)<=M.radius(a)+M.radius(b))return {state:'interference',message:'× Les peces se superposen. Separa els centres abans de connectar.'};
  return {state:'ready',message:'✓ Peces compatibles: clica per crear la connexió.'};
 }
 // Same geometry and tolerance as snap; preview never moves or connects a component.
 function preview(project,a,target=null,link=null){
  if(!a)return null;
  if(link){if(!target)return null;const result=explicitPair(a,target,link.type);const connected=project.connections.some(e=>e.type===link.type&&((e.a===a.id&&e.b===target.id)||(e.b===a.id&&e.a===target.id)));return {...result,targetId:target.id,message:connected?'✓ Aquestes peces ja estan connectades.':result.message};}
  const candidates=project.components.filter(b=>b!==a).map(b=>{const r=C.relation(a,b),error=r.error??Math.abs(C.distance(a,b)-(r.target||0));return {b,r,error};});
  const best=candidates.filter(x=>x.r.type&&x.error<=M.SNAP).sort((x,y)=>x.error-y.error)[0];
  if(best){const name=label(best.b),contact=best.r.state==='VALID_CONTACT';return {state:'ready',targetId:best.b.id,message:`✓ ${name}: ${contact?'contacte correcte':'connexió possible amb ajust'}. Deixa anar per connectar.`};}
  const nearby=candidates.filter(x=>near(a,x.b)).sort((x,y)=>C.distance(a,x.b)-C.distance(a,y.b));
  for(const {b,r}of nearby){
   if(r.state==='INTERFERENCE')return {state:'interference',targetId:b.id,message:`× Interferència amb ${label(b).toLowerCase()}. Separa les peces fins al contacte.`};
   if(((a.type==='internalGear'&&b.type==='gear')||(b.type==='internalGear'&&a.type==='gear'))&&r.state==='INCOMPATIBLE'){const ring=a.type==='internalGear'?a:b,pin=ring===a?b:a;return {state:'incompatible',targetId:b.id,message:ring.properties.teeth<=pin.properties.teeth?'× La corona interior ha de tenir més dents que el pinyó.':'× Mòduls diferents. Iguala el mòdul per engranar les peces.'};}
   if(a.type==='bevelGear'&&b.type==='bevelGear'&&r.state==='INCOMPATIBLE')return {state:'incompatible',targetId:b.id,message:Math.abs(a.properties.axis-b.properties.axis)!==90?'× Els eixos cònics han de ser perpendiculars: un a 0° i l’altre a 90°.':'× Mòduls diferents. Iguala el mòdul per engranar les peces.'};
   const sameModule=(a.type==='gear'&&['gear','rack'].includes(b.type))||(b.type==='gear'&&a.type==='rack');
   if(sameModule&&r.state==='INCOMPATIBLE')return {state:'incompatible',targetId:b.id,message:'× Mòduls diferents. Iguala el mòdul per engranar les peces.'};
   const type=a.type==='pulley'&&b.type==='pulley'?'belt':a.type==='sprocket'&&b.type==='sprocket'?'chain':['worm','wormWheel'].includes(a.type)&&['worm','wormWheel'].includes(b.type)&&a.type!==b.type?'worm':null;
   if(type){const result=explicitPair(a,b,type);return {...result,state:result.state==='ready'?'manual':result.state,targetId:b.id,message:result.state==='ready'?`↗ Selecciona una peça i prem ${type==='belt'?'Corretja oberta o creuada':type==='chain'?'Cadena':'Engrana'} per unir-les.`:result.message};}
  }
  const incompatible=nearby.find(x=>x.r.state==='INCOMPATIBLE');
  return incompatible?{state:'incompatible',targetId:incompatible.b.id,message:'× Aquestes peces no es connecten directament. Tria peces amb ports compatibles.'}:null;
 }
 function context(project,solution){
  const roles=new Map(),issues=solution.diagnostics.map(d=>({...d,advice:d.advice||(d.kind==='CONFLICT'?'Revisa les velocitats i els sentits dels motors, o trenca una connexió del cicle. Els altres conjunts poden continuar funcionant.':'Connecta el conjunt a un motor actiu o afegeix una manovella manual.')}));
  for(const c of project.components){const s=solution.states.get(c.id);roles.set(c.id,c.type==='support'?'Estructural':c.type==='manualCrank'?'Conductor manual':c.type==='motor'?(c.properties.active?'Conductor · motor':'Motor inactiu'):s?.source?'Conduït · rep moviment del motor':'Sense font de moviment');}
  // A manual source is a valid driver even though the speed solver returns zero while paused.
  for(const source of project.components.filter(c=>c.type==='manualCrank')){const seen=new Set([source.id]),queue=[source.id];for(let i=0;i<queue.length;i++)for(const edge of solution.graph.get(queue[i])||[]){if(seen.has(edge.id))continue;seen.add(edge.id);queue.push(edge.id);if(roles.get(edge.id)==='Sense font de moviment')roles.set(edge.id,'Conduït · rep moviment de la manovella');}}
  for(const c of project.components){const s=solution.states.get(c.id);if(s?.conflict)roles.set(c.id,'Bloquejat · moviments incompatibles');}
  for(const issue of issues)if(issue.kind==='WARNING'){
   const inactive=issue.ids.some(id=>project.components.some(c=>c.id===id&&c.type==='motor'&&!c.properties.active));
   if(inactive){issue.message='Conjunt aturat: el motor està desactivat.';issue.advice='Activa el motor a les propietats, o connecta una altra font de moviment.';}
  }
  return {roles,issues};
 }
 function motion(c,s,position=0){
  if(!s||s.conflict||c.type==='support')return [];
  const omega=M.rpmToRad(s.rpm||0),result=[];
  if(s.motion==='rotary'&&Math.abs(omega)>M.EPS)result.push({kind:'rotation',direction:Math.sign(omega)});
  let v=s.motion==='linear'?s.linearSpeed:0,point={x:0,y:0},axis='x';
  if(c.type==='crankSlider'){v=M.sliderVelocity(c,position,omega);point=M.tracePoint(c,'slider',position);}
  if(c.type==='camFollower'){v=M.camLiftVelocity(c,position,omega);point=M.tracePoint(c,'follower',position);axis='y';}
  if(root.ThosMotion.families?.linearTypes.includes(c.type)){v=M.familyLinearVelocity(c,position,omega);point=c.type==='fourBar'?M.tracePoint(c,'couplerPoint',position):c.type==='lever'?M.tracePoint(c,'leverTip',position):M.tracePoint(c,'loadPoint',position);axis='y';}
  if(Math.abs(v)>M.EPS)result.push({kind:'linear',axis,direction:Math.sign(v),point});
  return result;
 }
 root.ThosMotion.education={preview,context,motion};
 if(typeof module!=='undefined')module.exports=root.ThosMotion.education;
})(globalThis);
