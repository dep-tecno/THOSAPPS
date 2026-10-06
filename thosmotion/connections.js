(function(root){
 'use strict';const M=root.ThosMotion.model;
 const distance=(a,b)=>Math.hypot(a.position.x-b.position.x,a.position.y-b.position.y);
 function relation(a,b){
  const d=distance(a,b);
  if(a.type==='gear'&&b.type==='gear'){
   if(Math.abs(a.properties.module-b.properties.module)>M.EPS)return {state:'INCOMPATIBLE'};
   const target=M.radius(a)+M.radius(b);
   return {type:'mesh',target,state:Math.abs(d-target)<=M.CONTACT?'VALID_CONTACT':d<target?'INTERFERENCE':'SEPARATED'};
  }
  if((a.type==='gear'&&b.type==='rack')||(a.type==='rack'&&b.type==='gear')){
   const gear=a.type==='gear'?a:b,rack=a.type==='rack'?a:b;
   if(Math.abs(gear.properties.module-rack.properties.module)>M.EPS)return {state:'INCOMPATIBLE'};
   const target=M.radius(gear),dy=rack.position.y-gear.position.y,side=Math.sign(dy)||1,verticalError=Math.abs(Math.abs(dy)-target),overhang=Math.max(0,Math.abs(gear.position.x-rack.position.x)-M.rackLength(rack)/2);
   const state=overhang>M.CONTACT?'SEPARATED':verticalError<=M.CONTACT?'VALID_CONTACT':Math.abs(dy)<target?'INTERFERENCE':'SEPARATED';
   return {type:'rack',target,state,side,error:verticalError+overhang,gear,rack};
  }
  const rotary=['gear','motor','pulley','crankSlider','camFollower'];const shaftCompatible=(a.type==='shaft'&&rotary.includes(b.type))||(b.type==='shaft'&&rotary.includes(a.type))||(a.type==='motor'&&['gear','pulley','crankSlider','camFollower'].includes(b.type))||(b.type==='motor'&&['gear','pulley','crankSlider','camFollower'].includes(a.type));
  if(shaftCompatible)return {type:'shaft',target:0,state:d<=M.CONTACT?'VALID_CONTACT':'SEPARATED'};
  return {state:'INCOMPATIBLE'};
 }
 function revalidate(p){const map=new Map(p.components.map(c=>[c.id,c]));p.connections=p.connections.filter(e=>{const a=map.get(e.a),b=map.get(e.b);if(!a||!b)return false;if(e.type==='belt')return a.type==='pulley'&&b.type==='pulley'&&distance(a,b)>M.radius(a)+M.radius(b);const r=relation(a,b);return r.state==='VALID_CONTACT'&&r.type===e.type;});}
 function ratio(e,a,b){if(e.type==='mesh')return -a.properties.teeth/b.properties.teeth;if(e.type==='belt')return (e.crossed?-1:1)*a.properties.diameter/b.properties.diameter;return 1;}
 function snap(p,c){
  let best=null;
  for(const b of p.components){if(c===b)continue;const r=relation(c,b);if(!r.type)continue;const d=distance(c,b),error=r.error??Math.abs(d-r.target);if(error<=M.SNAP&&(!best||error<best.error))best={b,r,d,error};}
  if(best){const {b,r,d}=best;if(r.type==='rack'){if(c.type==='rack')c.position.y=r.gear.position.y+r.side*r.target;else c.position.y=r.rack.position.y-r.side*r.target;}else{const dx=c.position.x-b.position.x,dy=c.position.y-b.position.y;c.position={x:b.position.x+(d?dx/d:1)*r.target,y:b.position.y+(d?dy/d:0)*r.target};}}
  revalidate(p);
  for(const b of p.components){if(c===b)continue;const r=relation(c,b);if(r.state==='VALID_CONTACT'&&!p.connections.some(e=>(e.a===c.id&&e.b===b.id)||(e.b===c.id&&e.a===b.id)))p.connections.push({id:crypto.randomUUID(),type:r.type,a:c.id,b:b.id});}
  return best;
 }
 root.ThosMotion.connections={relation,revalidate,snap,distance,ratio};
 if(typeof module!=='undefined')module.exports=root.ThosMotion.connections;
})(globalThis);
