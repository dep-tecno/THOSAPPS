(function(root){
 'use strict';const M=root.ThosMotion.model;
 // Positive angular speeds are counterclockwise. Each edge imposes nB = ratio * nA.
 function solve(project){
  const byId=new Map(project.components.map(c=>[c.id,c]));const graph=new Map(project.components.map(c=>[c.id,[]]));const states=new Map();const diagnostics=[];
  for(const e of project.connections){const a=byId.get(e.a),b=byId.get(e.b);if(!a||!b)continue;const r=root.ThosMotion.connections.relation(a,b),valid=e.type==='belt'?a.type==='pulley'&&b.type==='pulley'&&root.ThosMotion.connections.distance(a,b)>M.radius(a)+M.radius(b):r.state==='VALID_CONTACT'&&r.type===e.type;if(!valid)continue;const k=root.ThosMotion.connections.ratio(e,a,b);graph.get(a.id).push({id:b.id,k});graph.get(b.id).push({id:a.id,k:1/k});}
  const visited=new Set();
  for(const c of project.components){if(visited.has(c.id))continue;
   const members=[],queue=[c.id];visited.add(c.id);for(let i=0;i<queue.length;i++){const id=queue[i];members.push(id);for(const e of graph.get(id))if(!visited.has(e.id)){visited.add(e.id);queue.push(e.id);}}
   const sources=members.map(id=>byId.get(id)).filter(c=>c.type==='motor'&&c.properties.active);
   if(!sources.length){members.forEach(id=>states.set(id,{rpm:0,ratio:null,source:null,conflict:false}));diagnostics.push({kind:'WARNING',ids:members,message:'Aquest conjunt no està connectat a cap font de moviment activa.'});continue;}
   const origin=sources[0];states.set(origin.id,{rpm:origin.properties.rpm,ratio:1,source:origin.id,conflict:false});const pending=[origin.id];let conflict=false;
   for(let i=0;i<pending.length;i++){const id=pending[i],s=states.get(id);for(const edge of graph.get(id)){const rpm=s.rpm*edge.k,ratio=s.ratio*edge.k;const old=states.get(edge.id);if(old){if(Math.abs(old.rpm-rpm)>M.EPS||Math.abs(old.ratio-ratio)>M.EPS)conflict=true;}else{states.set(edge.id,{rpm,ratio,source:origin.id,conflict:false});pending.push(edge.id);}}}
   for(const motor of sources)if(Math.abs(states.get(motor.id).rpm-motor.properties.rpm)>M.EPS)conflict=true;
   if(conflict){members.forEach(id=>states.set(id,{...states.get(id),rpm:0,conflict:true}));diagnostics.push({kind:'CONFLICT',ids:members,message:'Mecanisme bloquejat: el cicle o els motors imposen moviments incompatibles.'});}
  }
  return {states,graph,diagnostics};
 }
 root.ThosMotion.solver={solve};if(typeof module!=='undefined')module.exports={solve};
})(globalThis);
