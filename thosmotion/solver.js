(function(root){
 'use strict';const M=root.ThosMotion.model;
 // Positive angular speeds are counterclockwise; positive linear speeds point right.
 function solve(project){
  const byId=new Map(project.components.map(c=>[c.id,c]));const graph=new Map(project.components.map(c=>[c.id,[]]));const states=new Map();const diagnostics=[];
  for(const e of project.connections){const a=byId.get(e.a),b=byId.get(e.b);if(!a||!b)continue;const r=root.ThosMotion.connections.relation(a,b),valid=e.type==='belt'?a.type==='pulley'&&b.type==='pulley'&&root.ThosMotion.connections.distance(a,b)>M.radius(a)+M.radius(b):e.type==='chain'?a.type==='sprocket'&&b.type==='sprocket'&&Math.abs(a.properties.pitch-b.properties.pitch)<=M.EPS&&root.ThosMotion.connections.distance(a,b)>M.radius(a)+M.radius(b):e.type==='worm'?((a.type==='worm'&&b.type==='wormWheel')||(a.type==='wormWheel'&&b.type==='worm'))&&Math.abs(a.properties.module-b.properties.module)<=M.EPS&&root.ThosMotion.connections.distance(a,b)>M.radius(a)+M.radius(b):r.state==='VALID_CONTACT'&&r.type===e.type;if(!valid)continue;if(e.type==='rack'){const gear=a.type==='gear'?a:b,rack=a.type==='rack'?a:b,k=r.side*Math.PI*M.radius(gear)/30;graph.get(gear.id).push({id:rack.id,k,motion:'linear'});graph.get(rack.id).push({id:gear.id,k:1/k,motion:'rotary'});}else{const k=root.ThosMotion.connections.ratio(e,a,b);graph.get(a.id).push({id:b.id,k,motion:'rotary'});graph.get(b.id).push({id:a.id,k:1/k,motion:'rotary'});}}
  const visited=new Set();
  for(const c of project.components){if(visited.has(c.id))continue;
   const members=[],queue=[c.id];visited.add(c.id);for(let i=0;i<queue.length;i++){const id=queue[i];members.push(id);for(const e of graph.get(id))if(!visited.has(e.id)){visited.add(e.id);queue.push(e.id);}}
   const sources=members.map(id=>byId.get(id)).filter(c=>c.type==='motor'&&c.properties.active);
   if(!sources.length){members.forEach(id=>{const linear=byId.get(id).type==='rack';states.set(id,{motion:linear?'linear':'rotary',rpm:linear?null:0,linearSpeed:linear?0:null,ratio:null,source:null,conflict:false});});if(!members.some(id=>byId.get(id).type==='manualCrank'))diagnostics.push({kind:'WARNING',ids:members,message:'Aquest conjunt no està connectat a cap font de moviment activa.'});continue;}
   const origin=sources[0];states.set(origin.id,{motion:'rotary',rpm:origin.properties.rpm,linearSpeed:null,ratio:1,source:origin.id,conflict:false});const pending=[origin.id];let conflict=false;
   for(let i=0;i<pending.length;i++){const id=pending[i],s=states.get(id);for(const edge of graph.get(id)){const input=s.motion==='linear'?s.linearSpeed:s.rpm,value=input*edge.k,next={motion:edge.motion,rpm:edge.motion==='rotary'?value:null,linearSpeed:edge.motion==='linear'?value:null,ratio:edge.motion==='rotary'&&s.ratio!==null?s.ratio*edge.k:null,source:origin.id,conflict:false},old=states.get(edge.id);if(old){const oldValue=old.motion==='linear'?old.linearSpeed:old.rpm;if(old.motion!==next.motion||Math.abs(oldValue-value)>M.EPS)conflict=true;}else{states.set(edge.id,next);pending.push(edge.id);}}}
   for(const motor of sources)if(Math.abs(states.get(motor.id).rpm-motor.properties.rpm)>M.EPS)conflict=true;
   if(conflict){members.forEach(id=>{const s=states.get(id);states.set(id,{...s,rpm:s.motion==='rotary'?0:null,linearSpeed:s.motion==='linear'?0:null,conflict:true});});diagnostics.push({kind:'CONFLICT',ids:members,message:'Mecanisme bloquejat: el cicle o els motors imposen moviments incompatibles.'});}
  }
  return {states,graph,diagnostics};
 }
 root.ThosMotion.solver={solve};if(typeof module!=='undefined')module.exports={solve};
})(globalThis);
