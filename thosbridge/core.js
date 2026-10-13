// Independent educational simulation for THOSBRIDGE; not the BBG executable engine.
export const RULES = Object.freeze({beamCost:100, maxLength:4.5, stiffness:1800,
  gravity:10, strength:260, maxSagRatio:0.022, minMaxSag:0.25, maxMaxSag:4.5,
  step:1/240, damping:5, maxNodes:700, maxBeams:1500});
export function maxSagForLevel(level){
  const span=Number(level?.right)-Number(level?.left);
  if(!Number.isFinite(span)||span<=0)return 0.7;
  return Math.max(RULES.minMaxSag,Math.min(RULES.maxMaxSag,span*RULES.maxSagRatio));
}
export const copy = value => JSON.parse(JSON.stringify(value));
export function didacticIndicators(simulation,previous=[]){
  if(!simulation)return [];
  const recorded=simulation.mode==='stress'||!simulation.active;
  const loads=e=>{const current=e.visualStress??e.stress;return recorded?{tensile:e.peakTension||0,compressive:e.peakCompression||0}:{tensile:Math.max(0,current),compressive:Math.max(0,-current)};};
  let tension=null,compression=null,buckling=null;
  for(const e of simulation.beams){
    if(e.broken&&simulation.mode!=='stress')continue;
    const {tensile,compressive}=loads(e);
    if(tensile>.035&&tensile>(tension?.value||0))tension={kind:'tension',beam:e.id,value:tensile};
    if(compressive>.035&&compressive>(compression?.value||0))compression={kind:'compression',beam:e.id,value:compressive};
    if(e.type==='bar'&&!e.broken&&e.length>=RULES.maxLength*.75&&compressive>.035){
      const score=compressive*e.length*e.length;
      if(score>(buckling?.score||0))buckling={kind:'buckling',beam:e.id,score,qualitative:true};
    }
  }
  const deflection=simulation.maxDeckDrop?.amount>.025?{kind:'deflection',...simulation.maxDeckDrop}:null;
  return [tension,compression,deflection,buckling].filter(Boolean).map(candidate=>{
    if(candidate.kind==='deflection')return candidate;
    const old=previous.find(item=>item.kind===candidate.kind),beam=old&&simulation.beams.find(e=>e.id===old.beam);
    if(!beam||(beam.broken&&simulation.mode!=='stress')||(candidate.kind==='buckling'&&beam.broken))return candidate;
    const values=loads(beam),value=candidate.kind==='tension'?values.tensile:values.compressive;
    const oldScore=candidate.kind==='buckling'?value*beam.length*beam.length:value,newScore=candidate.score||candidate.value;
    if(value>.025&&newScore<=oldScore*1.2)return candidate.kind==='buckling'?{...old,score:oldScore}:{...old,value};
    return candidate;
  });
}
export function terrainAt(level,x) {
  const t=level.terrain;
  if(x<=t[0].x) return t[0].y;
  if(x>=t.at(-1).x) return t.at(-1).y;
  for(let i=1;i<t.length;i++) if(x<=t[i].x) {
    const a=t[i-1],b=t[i];return a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x);
  }
}
export function emptyBridge(level) {
  return {nodes:level.anchors.map((p,i)=>({id:'a'+i,...p,fixed:true})),beams:[]};
}
export const beamCost = beam => (beam.costShare??1)*RULES.beamCost;
export const cost = bridge => Math.round(bridge.beams.reduce((sum,e)=>sum+beamCost(e),0)*1e6)/1e6;
export function nodeAt(bridge,p) {return bridge.nodes.find(n=>Math.hypot(n.x-p.x,n.y-p.y)<0.025);}
function insideBeam(bridge,e,p){
  const a=bridge.nodes.find(n=>n.id===e.a),b=bridge.nodes.find(n=>n.id===e.b),dx=b.x-a.x,dy=b.y-a.y;
  const t=((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy);
  return t>0&&t<1&&Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=1e-6;
}
export function connectionPreview(bridge,p){
  const node=nodeAt(bridge,p),beams=bridge.beams.filter(e=>e.a!==node?.id&&e.b!==node?.id&&insideBeam(bridge,e,node||p));
  return {kind:beams.length?'junction':node?'node':'new',point:node||p,beams:beams.map(e=>e.id)};
}
function nextId(items,prefix){let i=0;while(items.some(item=>item.id===prefix+i))i++;return prefix+i;}
function connectPoint(bridge,p){
  let node=nodeAt(bridge,p);
  if(!node){node={id:nextId(bridge.nodes,'n'),x:p.x,y:p.y,fixed:false};bridge.nodes.push(node);}
  // Only explicit endpoints make junctions; geometric crossings alone stay separate.
  for(const edge of [...bridge.beams]){
    if(edge.a===node.id||edge.b===node.id)continue;
    if(!insideBeam(bridge,edge,node))continue;
    const a=bridge.nodes.find(n=>n.id===edge.a),b=bridge.nodes.find(n=>n.id===edge.b);
    const oldShare=edge.costShare??1,firstShare=oldShare*Math.hypot(node.x-a.x,node.y-a.y)/Math.hypot(b.x-a.x,b.y-a.y);
    const oldEnd=edge.b;edge.b=node.id;edge.costShare=firstShare;
    if(!bridge.beams.some(e=>(e.a===node.id&&e.b===oldEnd)||(e.a===oldEnd&&e.b===node.id)))
      bridge.beams.push({id:nextId(bridge.beams,'b'),a:node.id,b:oldEnd,type:edge.type,costShare:oldShare-firstShare});
  }
  return node;
}
function constructionLimit(bridge,level){
  if(cost(bridge)>level.budget)return 'No queda prou pressupost. Cada tram nou costa 100; dividir trams existents és gratuït.';
  if(bridge.nodes.length>RULES.maxNodes||bridge.beams.length>RULES.maxBeams)return 'Has arribat al límit d’elements.';
  return null;
}
export function addBeam(bridge,a,b,type='bar',level) {
  const bound=Math.max(150,level.right-level.left+50);
  if(!['bar','deck'].includes(type)||[a,b].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>bound||Math.abs(p.y)>bound))return 'Escull punts dins l’àrea de construcció.';
  const length=Math.hypot(a.x-b.x,a.y-b.y);
  if(length<0.1) return 'Escull dos punts diferents.';
  if(length>RULES.maxLength+1e-6) return 'La longitud màxima és de 4,5 unitats de graella.';
  const na=nodeAt(bridge,a),nb=nodeAt(bridge,b);
  if(na&&nb&&bridge.beams.some(e=>(e.a===na.id&&e.b===nb.id)||(e.a===nb.id&&e.b===na.id))) return 'Aquests punts ja estan units.';
  const draft=copy(bridge),n1=connectPoint(draft,a),n2=connectPoint(draft,b);
  const existing=draft.beams.find(e=>(e.a===n1.id&&e.b===n2.id)||(e.a===n2.id&&e.b===n1.id));
  if(existing){if(type==='deck')existing.type='deck';}
  else draft.beams.push({id:nextId(draft.beams,'b'),a:n1.id,b:n2.id,type});
  const error=constructionLimit(draft,level);if(error)return error;
  bridge.nodes=draft.nodes;bridge.beams=draft.beams;return null;
}
export function removeBeam(bridge,id) {
  bridge.beams=bridge.beams.filter(e=>e.id!==id);
  bridge.nodes=bridge.nodes.filter(n=>n.fixed||bridge.beams.some(e=>e.a===n.id||e.b===n.id));
}
export function previewBeam(bridge,a,b,level){
  const draft=copy(bridge),error=addBeam(draft,a,b,'bar',{...level,budget:Infinity});
  return {error,costAdded:error?0:Math.round((cost(draft)-cost(bridge))*1e6)/1e6};
}
export function planDeckSpan(bridge,a,b) {
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(!Number.isFinite(length)||length<0.1)return {error:'Escull dos punts diferents.'};
  const stops=[{...a,t:0},{...b,t:1}];
  for(const n of bridge.nodes){
    const t=((n.x-a.x)*dx+(n.y-a.y)*dy)/(length*length);
    if(t>0.001&&t<0.999&&Math.hypot(n.x-a.x-dx*t,n.y-a.y-dy*t)<0.025)stops.push({...n,t});
  }
  stops.sort((a,b)=>a.t-b.t);
  const points=[{x:a.x,y:a.y}];
  for(let i=1;i<stops.length;i++){
    const from=stops[i-1],to=stops[i],span=Math.hypot(to.x-from.x,to.y-from.y);
    if(span<0.025)continue;
    let count=Math.ceil(span/RULES.maxLength),part;
    do{
      part=[{x:from.x,y:from.y}];
      for(let j=1;j<count;j++){
        const p={x:Math.round(from.x+(to.x-from.x)*j/count),y:Math.round(from.y+(to.y-from.y)*j/count)};
        if(Math.hypot(p.x-part.at(-1).x,p.y-part.at(-1).y)>0.1&&Math.hypot(p.x-to.x,p.y-to.y)>0.1)part.push(p);
      }
      part.push({x:to.x,y:to.y});count++;
    }while(part.some((p,j)=>j>0&&Math.hypot(p.x-part[j-1].x,p.y-part[j-1].y)>RULES.maxLength+1e-6)&&count<800);
    points.push(...part.slice(1));
  }
  const draft=copy(bridge);for(const p of points)connectPoint(draft,p);
  const segments=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],na=nodeAt(draft,a),nb=nodeAt(draft,b);
    const existing=na&&nb&&draft.beams.find(e=>(e.a===na.id&&e.b===nb.id)||(e.a===nb.id&&e.b===na.id));
    segments.push({a,b,existing:existing?.id,type:existing?.type});
  }
  const added=segments.filter(s=>!s.existing).length;
  return {segments,draft,added,costAdded:added*RULES.beamCost,converted:segments.filter(s=>s.type==='bar').length};
}
export function addDeckSpan(bridge,a,b,level) {
  const bound=Math.max(150,level.right-level.left+50);
  if([a,b].some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>bound||Math.abs(p.y)>bound))return {error:'Escull punts dins l’àrea de construcció.'};
  const plan=planDeckSpan(bridge,a,b);if(plan.error)return plan;
  const draft=plan.draft;
  for(const segment of plan.segments){
    if(segment.existing){draft.beams.find(e=>e.id===segment.existing).type='deck';continue;}
    const error=addBeam(draft,segment.a,segment.b,'deck',level);if(error)return {error};
  }
  const error=constructionLimit(draft,level);if(error)return {error};
  return {bridge:draft,added:plan.added,costAdded:Math.round((cost(draft)-cost(bridge))*1e6)/1e6,converted:plan.converted};
}
export function makeDeck(level,bridge) {
  let draft=copy(bridge);
  // Follow the level's nominal rail height. Existing solid ground forms the approaches.
  for(let x=level.left;x<level.right-0.01;x+=2) {
    const end=Math.min(level.right,x+2);
    if(terrainAt(level,(x+end)/2)>=-0.02) continue;
    const result=addDeckSpan(draft,{x,y:0},{x:end,y:0},level);
    if(result.error)return {error:result.error};draft=result.bridge;
  }
  return {bridge:draft};
}
export function demo(level) {
  const b=emptyBridge(level);const l=level.left,r=level.right,m=(l+r)/2;
  // Only the first level in each pack has this illustrative triangle.
  for(const [a,z,type] of [
    [{x:l,y:0},{x:m,y:0},'deck'],[{x:m,y:0},{x:r,y:0},'deck'],
    [{x:l,y:0},{x:m,y:2},'bar'],[{x:r,y:0},{x:m,y:2},'bar'],
    [{x:m,y:0},{x:m,y:2},'bar']]) {
    const error=addBeam(b,a,z,type,level);if(error)throw Error(error);
  }
  return b;
}
export function validateBridge(input,level) {
  if(!input||!Array.isArray(input.nodes)||!Array.isArray(input.beams)||input.nodes.length>RULES.maxNodes||input.beams.length>RULES.maxBeams) throw Error('Format de pont incorrecte.');
  const result=emptyBridge(level),ids=new Set(result.nodes.map(n=>n.id));
  const bound=Math.max(150,level.right-level.left+50);
  for(const n of input.nodes) {
    if(!n||typeof n.id!=='string'||!/^n\d+$/.test(n.id)) {
      const a=result.nodes.find(a=>a.id===n?.id);
      if(!a||a.x!==n.x||a.y!==n.y||n.fixed!==true)throw Error('Els ancoratges del nivell no es poden modificar.');
      continue;
    }
    if(ids.has(n.id)||!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(n.x)>bound||Math.abs(n.y)>bound||n.fixed)throw Error('Hi ha un node invàlid.');
    ids.add(n.id);result.nodes.push({id:n.id,x:n.x,y:n.y,fixed:false});
  }
  const edges=new Set(),beamIds=new Set();
  for(const e of input.beams) {
    if(!e||typeof e.id!=='string'||!/^b\d+$/.test(e.id)||beamIds.has(e.id)||!ids.has(e.a)||!ids.has(e.b)||e.a===e.b||!['bar','deck'].includes(e.type))throw Error('Hi ha un tram invàlid.');
    const key=[e.a,e.b].sort().join(':');if(edges.has(key))throw Error('Hi ha trams duplicats.');
    const a=result.nodes.find(n=>n.id===e.a),b=result.nodes.find(n=>n.id===e.b);
    const length=Math.hypot(a.x-b.x,a.y-b.y);
    if(length<0.1||length>RULES.maxLength+1e-6)throw Error('Hi ha un tram amb longitud incorrecta.');
    if(e.costShare!==undefined&&(!Number.isFinite(e.costShare)||e.costShare<=0||e.costShare>1||e.costShare<length/RULES.maxLength-1e-6))throw Error('Hi ha un cost de tram incorrecte.');
    edges.add(key);beamIds.add(e.id);result.beams.push({id:e.id,a:e.a,b:e.b,type:e.type,...(e.costShare===undefined?{}:{costShare:e.costShare})});
  }
  if(cost(result)>level.budget)throw Error('El pont supera el pressupost del nivell.');
  return result;
}
export function deckRoute(level,bridge) {
  const nodes=bridge.nodes,graph=new Map(nodes.map(n=>[n.id,[]]));
  const railNodes=nodes.filter(n=>bridge.beams.some(e=>e.type==='deck'&&(e.a===n.id||e.b===n.id)));
  for(const e of bridge.beams.filter(e=>e.type==='deck')) {
    graph.get(e.a).push({id:e.b,beam:e.id});graph.get(e.b).push({id:e.a,beam:e.id});
  }
  // Terrain can carry the train where it reaches the nominal track height.
  const onGround=n=>n.y>=-0.05&&terrainAt(level,n.x)>=n.y-0.15;
  const groundBetween=(a,b)=>{
    for(let x=a;x<=b;x+=0.2)if(terrainAt(level,x)<-0.05)return false;return true;
  };
  const sorted=railNodes.filter(onGround).sort((a,b)=>a.x-b.x);
  for(let i=1;i<sorted.length;i++)if(groundBetween(sorted[i-1].x,sorted[i].x)){
    graph.get(sorted[i-1].id).push({id:sorted[i].id,beam:null});graph.get(sorted[i].id).push({id:sorted[i-1].id,beam:null});
  }
  const start=railNodes.filter(n=>n.x<=level.left+0.05||(onGround(n)&&groundBetween(level.left,n.x)));
  const end=new Set(railNodes.filter(n=>n.x>=level.right-0.05||(onGround(n)&&groundBetween(n.x,level.right))).map(n=>n.id));
  const queue=start.map(n=>({id:n.id,path:[]})),visited=new Set();
  while(queue.length){const q=queue.shift();if(visited.has(q.id))continue;visited.add(q.id);
    if(end.has(q.id))return q.path;
    const a=nodes.find(n=>n.id===q.id);
    for(const edge of graph.get(q.id)) {const b=nodes.find(n=>n.id===edge.id);
      if(b.x>a.x+0.01&&Math.abs(b.y-a.y)/(b.x-a.x)<=1)queue.push({id:b.id,path:[...q.path,{a:a.id,b:b.id,beam:edge.beam}]});
    }
  }
  return null;
}
// Linear static truss solve with a preconditioned conjugate-gradient method.
// Pin joints transmit only axial force; fixed level anchors have zero displacement.
export function solveTrussEquilibrium(nodes,beams,loads,stiffness=RULES.stiffness){
  const free=nodes.filter(n=>!n.fixed),dof=new Map(free.map((n,i)=>[n.id,2*i])),size=free.length*2;
  if(!size)return {stable:true,displacements:new Map(),forces:new Map(),iterations:0};
  const elements=[];
  for(const e of beams){if(e.broken)continue;const a=nodes.find(n=>n.id===e.a),b=nodes.find(n=>n.id===e.b);if(!a||!b)continue;
    const dx=b.x0-a.x0,dy=b.y0-a.y0,length=Math.hypot(dx,dy);if(length<.1)continue;
    elements.push({e,a,b,length,c:dx/length,s:dy/length,k:stiffness});
  }
  let maxDiagonal=0;
  const apply=(x,out)=>{
    out.fill(0);
    for(const q of elements){const ia=dof.get(q.a.id),ib=dof.get(q.b.id),ax=ia===undefined?0:x[ia],ay=ia===undefined?0:x[ia+1],bx=ib===undefined?0:x[ib],by=ib===undefined?0:x[ib+1];
      const extension=q.c*(bx-ax)+q.s*(by-ay),fx=q.k*extension*q.c,fy=q.k*extension*q.s;
      if(ia!==undefined){out[ia]-=fx;out[ia+1]-=fy;}if(ib!==undefined){out[ib]+=fx;out[ib+1]+=fy;}
    }
    // The tiny diagonal spring also belongs in the operator; using it only
    // in the preconditioner leaves mechanisms singular and CG can diverge.
    if(maxDiagonal)for(let i=0;i<size;i++)out[i]+=x[i]*maxDiagonal*1e-3;
  };
  const diagonal=new Float64Array(size),rhs=new Float64Array(size);
  for(const q of elements){const ia=dof.get(q.a.id),ib=dof.get(q.b.id),xx=q.k*q.c*q.c,xy=q.k*q.c*q.s,yy=q.k*q.s*q.s;
    if(ia!==undefined){diagonal[ia]+=xx;diagonal[ia+1]+=yy;}if(ib!==undefined){diagonal[ib]+=xx;diagonal[ib+1]+=yy;}
  }
  for(const n of free){const i=dof.get(n.id),f=loads.get(n.id);if(f){rhs[i]=f.x;rhs[i+1]=f.y;}}
  for(const d of diagonal)maxDiagonal=Math.max(maxDiagonal,d);
  if(!(maxDiagonal>0))return {stable:false,reason:'mechanism',displacements:new Map(),forces:new Map(),iterations:0};
  const regularizer=maxDiagonal*1e-3;for(let i=0;i<size;i++){diagonal[i]+=regularizer;if(!Number.isFinite(diagonal[i]))return {stable:false,reason:'numeric',displacements:new Map(),forces:new Map(),iterations:0};}
  const x=new Float64Array(size),r=Float64Array.from(rhs),z=new Float64Array(size),p=new Float64Array(size),ap=new Float64Array(size),ax=new Float64Array(size);
  let rz=0,normB=0;for(let i=0;i<size;i++){z[i]=r[i]/diagonal[i];p[i]=z[i];rz+=r[i]*z[i];normB+=rhs[i]*rhs[i];}
  normB=Math.sqrt(normB);if(normB<1e-12)return {stable:true,displacements:new Map(free.map(n=>[n.id,{x:0,y:0}])),forces:new Map(),iterations:0};
  const tolerance=normB*1e-8,maxIterations=Math.min(1200,Math.max(120,size*2));let converged=false,iterations=0;
  for(;iterations<maxIterations;iterations++){
    apply(p,ap);let pap=0;for(let i=0;i<size;i++)pap+=p[i]*ap[i];
    if(!(pap>1e-24)||!Number.isFinite(pap))break;
    const alpha=rz/pap;let residual=0;
    for(let i=0;i<size;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];residual+=r[i]*r[i];}
    if(Math.sqrt(residual)<=tolerance){converged=true;iterations++;break;}
    let nextRz=0;for(let i=0;i<size;i++){z[i]=r[i]/diagonal[i];nextRz+=r[i]*z[i];}
    const beta=nextRz/rz;for(let i=0;i<size;i++)p[i]=z[i]+beta*p[i];rz=nextRz;
  }
  const displacements=new Map(free.map(n=>{const i=dof.get(n.id);return[n.id,{x:x[i],y:x[i+1]}];}));
  const forces=new Map(elements.map(q=>{const ua=displacements.get(q.a.id)||{x:0,y:0},ub=displacements.get(q.b.id)||{x:0,y:0};return[q.e.id,q.k*(q.c*(ub.x-ua.x)+q.s*(ub.y-ua.y))];}));
  apply(x,ax);let residual=0;for(let i=0;i<size;i++)residual+=(rhs[i]-ax[i])**2;
  const residualNorm=Math.sqrt(residual),maxDisplacement=Math.max(...Array.from(x,Math.abs));
  const stable=converged&&residualNorm<=Math.max(tolerance,1e-7)&&Number.isFinite(maxDisplacement)&&maxDisplacement<100;
  return {stable,reason:stable?undefined:converged?'mechanism':'not-converged',displacements,forces,iterations,residualNorm,tolerance,maxDisplacement};
}
export class Simulation {
  constructor(level,bridge,weight=1,options={}) {
    this.mode=options.mode==='stress'?'stress':'train';
    this.level=level;this.design=copy(bridge);this.time=0;this.weight=weight;this.loadFactor=0;this.maxAllowedSag=maxSagForLevel(level);
    this.nodes=bridge.nodes.map(n=>{
      // A drawn joint placed on the level terrain is a real support in the solve.
      const groundSupport=!n.fixed&&Math.abs(n.y-terrainAt(level,n.x))<=0.05;
      return {...n,fixed:n.fixed||groundSupport,groundSupport,x0:n.x,y0:n.y,vx:0,vy:0,mass:0.35,fx:0,fy:0};
    });
    this.byId=new Map(this.nodes.map(n=>[n.id,n]));
    this.beams=bridge.beams.map(e=>{const a=this.byId.get(e.a),b=this.byId.get(e.b),length=Math.hypot(b.x-a.x,b.y-a.y);
      if(!a.fixed)a.mass+=length*.08;if(!b.fixed)b.mass+=length*.08;
      return {...e,length,stress:0,visualStress:0,peakStress:0,peakTension:0,peakCompression:0,broken:false};});
    this.edgeMap=new Map(this.beams.map(e=>[e.id,e]));
    this.deckNodeIds=new Set(this.beams.filter(e=>e.type==='deck').flatMap(e=>[e.a,e.b]));
    this.maxDeckDrop=null;
    this.route=deckRoute(level,bridge);this.trainX=level.left-5;this.trainY=0;this.status='running';this.reason='';this.peak=0;this.broken=0;
    if(this.mode==='train'&&!this.route?.length){this.status='failed';this.failureKind='route';this.reason='Falta un tauler continu entre les dues ribes. Completa el camí amb l’eina Via o fes servir Construir via horitzontal.';}
    if(this.mode==='stress'&&!this.beams.length){this.status='failed';this.failureKind='structure';this.reason='Construeix algun tram abans de fer la prova d’esforços.';}
    this.trainMass=Math.max(4,Math.min(24,(level.source.trainWeight||40000)/5000))*weight;
  }
  get active(){return this.status==='running'||this.status==='collapsing';}
  fail(reason,animate=true){
    if(this.status!=='running')return;
    this.reason=reason;this.failureKind='structure';this.status=animate?'collapsing':'failed';this.collapseTime=0;
    if(animate&&this.mode==='train'){
      const rail=this.railAt(this.trainX);
      this.collapsePoint={x:this.trainX,y:rail.broken?this.trainY:rail.y};
      // The equilibrium solver's per-frame displacement is elastic, not
      // physical momentum. Do not turn that numerical change into a violent
      // sideways launch when the structure loses support.
      for(const n of this.nodes)if(!n.fixed){n.vx=0;n.vy=0;}
      this.cars=[0,1.3,2.6,3.9].map(offset=>{
        const x=this.trainX-offset,carRail=this.railAt(x);
        return {x,y:carRail.broken?this.trainY:carRail.y,vx:0,vy:0,falling:false};
      });
    }
  }
  railAt(x){
    const s=this.route?.find(s=>{const a=this.byId.get(s.a),b=this.byId.get(s.b);return x>=a.x0-0.001&&x<=b.x0+0.001;});
    if(!s)return {y:0,ground:true};
    const a=this.byId.get(s.a),b=this.byId.get(s.b),e=this.edgeMap.get(s.beam);
    if(e?.broken)return {y:-100,broken:true};
    const t=Math.max(0,Math.min(1,(x-a.x0)/(b.x0-a.x0)));
    return {a,b,t,y:a.y*(1-t)+b.y*t,ground:!s.beam,designY:a.y0*(1-t)+b.y0*t};
  }
  step(dt=RULES.step) {
    if(!this.active)return;
    this.time+=dt;
    if(this.status==='collapsing'){
      this.collapseTime+=dt;
      for(const n of this.nodes){if(n.fixed)continue;n.vy-=RULES.gravity*dt;n.x+=n.vx*dt;n.y+=n.vy*dt;const floor=terrainAt(this.level,n.x);if(n.y<floor){n.y=floor;n.vy=0;n.vx*=Math.exp(-8*dt);}}
      // Members that stretch far beyond their designed length visibly snap,
      // so the collapse reads as separate falling pieces instead of giant
      // unbroken lines dragged across the canvas.
      for(const e of this.beams){if(e.broken)continue;const a=this.byId.get(e.a),b=this.byId.get(e.b);
        if(Math.hypot(b.x-a.x,b.y-a.y)>e.length*1.35){e.broken=true;this.broken++;}}
      for(const car of this.cars||[]){
        const rail=this.railAt(car.x);
        if(!car.falling&&(rail.broken||rail.y<(rail.designY??0)-this.maxAllowedSag)){
          car.falling=true;car.vx=(this.level.right-this.level.left+10)/24;
        }
        if(car.falling){
          car.vy-=RULES.gravity*dt;car.x+=car.vx*dt;car.y+=car.vy*dt;
          const floor=terrainAt(this.level,car.x);if(car.y<floor){car.y=floor;car.vy=0;car.vx*=Math.exp(-8*dt);}
        }else{
          car.y=rail.y;
        }
      }
      if(this.collapseTime>=8)this.status='failed';return;
    }
    if(this.mode==='train'&&this.time>0.8)this.trainX+=(this.level.right-this.level.left+10)/12*dt;
    if(this.mode==='stress')this.loadFactor=Math.max(0,Math.min(1,(this.time-.8)/3));
    const loads=new Map(this.nodes.filter(n=>!n.fixed).map(n=>[n.id,{x:0,y:-RULES.gravity*n.mass}]));
    if(this.mode==='stress'){
      const deck=this.beams.filter(e=>e.type==='deck'&&!e.broken),total=deck.reduce((sum,e)=>sum+e.length,0);
      for(const e of deck){const load=total?this.trainMass*RULES.gravity*this.loadFactor*e.length/total/2:0;for(const id of [e.a,e.b])if(loads.has(id))loads.get(id).y-=load;}
    }else if(this.time>.8){
      for(const offset of [0,1.3,2.6,3.9]){const x=this.trainX-offset;if(x<this.level.left||x>this.level.right)continue;const rail=this.railAt(x);
        if(rail.broken){this.fail('El tauler s’ha trencat sota el tren. Reforça’l amb triangles.');break;}
        if(!rail.ground&&rail.a){const load=this.trainMass*RULES.gravity/4;for(const [id,fraction] of [[rail.a.id,1-rail.t],[rail.b.id,rail.t]])if(loads.has(id))loads.get(id).y-=load*fraction;}
      }
    }
    if(this.status!=='running')return;
    const solved=solveTrussEquilibrium(this.nodes,this.beams,loads);
    if(!solved.stable){this.fail('L’estructura no forma un conjunt estable. Reforça-la amb triangles.',this.mode==='train');return;}
    for(const n of this.nodes){const u=solved.displacements.get(n.id)||{x:0,y:0},oldX=n.x,oldY=n.y;n.x=n.x0+u.x;n.y=n.y0+u.y;n.vx=(n.x-oldX)/Math.max(dt,1e-6);n.vy=(n.y-oldY)/Math.max(dt,1e-6);
      if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(u.x)>50||Math.abs(u.y)>50){this.fail('L’estructura no forma un conjunt estable. Reforça-la amb triangles.',this.mode==='train');return;}
      if(this.deckNodeIds.has(n.id)&&!n.fixed){const amount=n.y0-n.y;if(amount>(this.maxDeckDrop?.amount||0))this.maxDeckDrop={node:n.id,x:n.x,y:n.y,y0:n.y0,amount};}
    }
    for(const e of this.beams){if(e.broken)continue;const force=solved.forces.get(e.id)||0,strength=RULES.strength/(1+e.length*e.length/30);e.stress=force/strength;this.peak=Math.max(this.peak,Math.abs(e.stress));
      // A deck can be geometrically unstable before its axial-force model
      // reports force (for example, an unbraced horizontal chain). Show that
      // failure through the measured sag limit instead of leaving a blank map.
      if(this.mode==='stress'&&e.type==='deck'&&Math.abs(e.stress)<1e-12&&this.maxDeckDrop?.amount>this.maxAllowedSag){
        const a=this.byId.get(e.a),b=this.byId.get(e.b),drop=Math.max(a.y0-a.y,b.y0-b.y);
        e.stress=Math.max(0,drop/this.maxAllowedSag);this.peak=Math.max(this.peak,e.stress);
      }
      e.visualStress+=(e.stress-e.visualStress)*(1-Math.exp(-dt/.2));e.peakTension=Math.max(e.peakTension,e.stress);e.peakCompression=Math.max(e.peakCompression,-e.stress);if(Math.abs(e.stress)>Math.abs(e.peakStress))e.peakStress=e.stress;
      if(Math.abs(e.stress)>1){e.broken=true;this.broken++;}
    }
    if(this.mode==='train'&&this.time>.8){
      for(const offset of [0,1.3,2.6,3.9]){const x=this.trainX-offset;if(x<this.level.left||x>this.level.right)continue;const rail=this.railAt(x);if(rail.broken||rail.y<(rail.designY??0)-this.maxAllowedSag){this.fail('El pont no ha aguantat el pas del tren. Reforça’l amb triangles.');break;}}
      const front=this.railAt(this.trainX);if(!front.broken)this.trainY=front.y;
    }
    if(this.mode==='stress'&&this.status==='running'){
      if(this.broken||this.nodes.some(n=>!n.fixed&&n.y<n.y0-this.maxAllowedSag))this.fail('La càrrega prèvia indica una estructura feble. Reforça els trams més carregats.',false);
      else if(this.time>=6){this.status='assessed';this.reason='Prova prèvia completada. Observa els trams més carregats i fes passar el tren.';}
    }
    if(this.mode==='train'&&this.status==='running'&&this.trainX-3.9>this.level.right+1){this.status='passed';this.reason='El tren ha travessat el pont!';}
    if(this.status==='running'&&this.time>20)this.fail('El tren no ha pogut completar el recorregut.');
  }
}
// Calculate on an isolated copy, then return a heat map on the undeformed design.
export function assessBridge(level,bridge,weight=1){
  const assessment=new Simulation(level,bridge,weight,{mode:'stress'});
  if(!assessment.beams.length)return assessment;
  for(let step=0;step<1500&&assessment.active;step++)assessment.step();
  assessment.analysisWarning=assessment.status!=='assessed';
  assessment.reason=assessment.analysisWarning?'Mapa d’esforços: s’han detectat trams febles o una deformació excessiva. Reforça el pont abans de provar el tren.':'Mapa d’esforços calculat. Del groc al vermell: de menys a més esforç. Pots reforçar el pont o fer passar el tren.';
  assessment.status='assessed';
  for(const n of assessment.nodes){n.x=n.x0;n.y=n.y0;n.vx=0;n.vy=0;}
  return assessment;
}
export function stressHeatColor(effort){
  const value=Math.max(0,Math.min(1,Math.abs(effort)||0));
  const low=value<=.5?[255,216,66]:[255,140,32],high=value<=.5?[255,140,32]:[239,68,44],t=value<=.5?value*2:(value-.5)*2;
  return 'rgb('+low.map((channel,i)=>Math.round(channel+(high[i]-channel)*t)).join(',')+')';
}
