// Independent educational simulation for THOSBRIDGE; not the BBG executable engine.
export const RULES = Object.freeze({beamCost:100, maxLength:4.5, stiffness:1800,
  gravity:10, strength:260, maxSag:0.7, step:1/240, damping:5, maxNodes:700, maxBeams:1500});
export const copy = value => JSON.parse(JSON.stringify(value));
export function didacticIndicators(simulation){
  if(!simulation)return [];
  const recorded=simulation.mode==='stress'||!simulation.active;
  let tension=null,compression=null,buckling=null;
  for(const e of simulation.beams){
    if(e.broken&&simulation.mode!=='stress')continue;
    const tensile=recorded?e.peakTension:Math.max(0,e.stress),compressive=recorded?e.peakCompression:Math.max(0,-e.stress);
    if(tensile>.035&&tensile>(tension?.value||0))tension={kind:'tension',beam:e.id,value:tensile};
    if(compressive>.035&&compressive>(compression?.value||0))compression={kind:'compression',beam:e.id,value:compressive};
    if(e.type==='bar'&&!e.broken&&e.length>=RULES.maxLength*.75&&compressive>.035){
      const score=compressive*e.length*e.length;
      if(score>(buckling?.score||0))buckling={kind:'buckling',beam:e.id,score,qualitative:true};
    }
  }
  const deflection=simulation.maxDeckDrop?.amount>.025?{kind:'deflection',...simulation.maxDeckDrop}:null;
  return [tension,compression,deflection,buckling].filter(Boolean);
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
export const cost = bridge => bridge.beams.length * RULES.beamCost;
export function nodeAt(bridge,p) {return bridge.nodes.find(n=>Math.hypot(n.x-p.x,n.y-p.y)<0.025);}
function nextId(items,prefix){let i=0;while(items.some(item=>item.id===prefix+i))i++;return prefix+i;}
function connectPoint(bridge,p){
  let node=nodeAt(bridge,p);
  if(!node){node={id:nextId(bridge.nodes,'n'),x:p.x,y:p.y,fixed:false};bridge.nodes.push(node);}
  // Only explicit endpoints make junctions; geometric crossings alone stay separate.
  for(const edge of [...bridge.beams]){
    if(edge.a===node.id||edge.b===node.id)continue;
    const a=bridge.nodes.find(n=>n.id===edge.a),b=bridge.nodes.find(n=>n.id===edge.b);
    const dx=b.x-a.x,dy=b.y-a.y,t=((node.x-a.x)*dx+(node.y-a.y)*dy)/(dx*dx+dy*dy);
    if(t<=0||t>=1||Math.hypot(node.x-a.x-t*dx,node.y-a.y-t*dy)>1e-6)continue;
    const oldEnd=edge.b;edge.b=node.id;
    if(!bridge.beams.some(e=>(e.a===node.id&&e.b===oldEnd)||(e.a===oldEnd&&e.b===node.id)))
      bridge.beams.push({id:nextId(bridge.beams,'b'),a:node.id,b:oldEnd,type:edge.type});
  }
  return node;
}
function constructionLimit(bridge,level){
  if(cost(bridge)>level.budget)return 'No queda prou pressupost. Cada tram costa 100; crear una unió també pot dividir trams existents.';
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
  return {segments,draft,added:draft.beams.length-bridge.beams.length+segments.filter(s=>!s.existing).length,converted:segments.filter(s=>s.type==='bar').length};
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
  return {bridge:draft,added:plan.added,converted:plan.converted};
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
    edges.add(key);beamIds.add(e.id);result.beams.push({id:e.id,a:e.a,b:e.b,type:e.type});
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
export class Simulation {
  constructor(level,bridge,weight=1,options={}) {
    this.mode=options.mode==='stress'?'stress':'train';
    this.level=level;this.design=copy(bridge);this.time=0;this.weight=weight;this.loadFactor=0;
    this.nodes=bridge.nodes.map(n=>({...n,x0:n.x,y0:n.y,vx:0,vy:0,mass:0.35,fx:0,fy:0}));
    this.byId=new Map(this.nodes.map(n=>[n.id,n]));
    this.beams=bridge.beams.map(e=>{const a=this.byId.get(e.a),b=this.byId.get(e.b),length=Math.hypot(b.x-a.x,b.y-a.y);
      if(!a.fixed)a.mass+=length*.08;if(!b.fixed)b.mass+=length*.08;
      return {...e,length,stress:0,peakStress:0,peakTension:0,peakCompression:0,broken:false};});
    this.edgeMap=new Map(this.beams.map(e=>[e.id,e]));
    this.deckNodeIds=new Set(this.beams.filter(e=>e.type==='deck').flatMap(e=>[e.a,e.b]));
    this.maxDeckDrop=null;
    this.route=deckRoute(level,bridge);this.trainX=level.left-5;this.trainY=0;this.status='running';this.reason='';this.peak=0;this.broken=0;
    if(this.mode==='train'&&!this.route?.length){this.status='failed';this.failureKind='route';this.reason='Falta un tauler continu entre les dues ribes. Completa el camí amb l’eina Tauler o fes servir Construir tauler horitzontal.';}
    if(this.mode==='stress'&&!this.beams.length){this.status='failed';this.failureKind='structure';this.reason='Construeix algun tram abans de fer la prova d’esforços.';}
    this.trainMass=Math.max(4,Math.min(24,(level.source.trainWeight||40000)/5000))*weight;
  }
  get active(){return this.status==='running'||this.status==='collapsing';}
  fail(reason,animate=true){
    if(this.status!=='running')return;
    this.reason=reason;this.failureKind='structure';this.status=animate?'collapsing':'failed';this.collapseTime=0;
    if(animate&&this.mode==='train')this.cars=[0,1.3,2.6,3.9].map(offset=>{
      const x=this.trainX-offset,rail=this.railAt(x);
      return {x,y:rail.broken?this.trainY:rail.y,vx:0,vy:0,falling:false};
    });
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
    for(const n of this.nodes){n.fx=0;n.fy=-RULES.gravity*n.mass;}
    if(this.mode==='stress'){
      this.loadFactor=Math.max(0,Math.min(1,(this.time-.8)/3));
      const deck=this.beams.filter(e=>e.type==='deck'&&!e.broken),total=deck.reduce((s,e)=>s+e.length,0);
      for(const e of deck){const load=total?this.trainMass*RULES.gravity*this.loadFactor*e.length/total/2:0;this.byId.get(e.a).fy-=load;this.byId.get(e.b).fy-=load;}
    }
    if(this.mode==='train'&&this.status==='running'&&this.time>0.8){
      this.trainX+=(this.level.right-this.level.left+10)/12*dt;
      for(const offset of [0,1.3,2.6,3.9]) {
        const x=this.trainX-offset;
        if(x<this.level.left||x>this.level.right)continue;
        const rail=this.railAt(x);
        if(rail.broken||rail.y<(rail.designY??0)-RULES.maxSag){this.fail('El pont no ha aguantat el pas del tren. Reforça’l amb triangles.');break;}
        if(!rail.ground&&rail.a){const load=this.trainMass*RULES.gravity/4;rail.a.fy-=load*(1-rail.t);rail.b.fy-=load*rail.t;}
      }
      const front=this.railAt(this.trainX);if(!front.broken)this.trainY=front.y;
    }
    if(this.status==='collapsing'){
      this.collapseTime+=dt;
      for(const car of this.cars||[]){
        const rail=this.railAt(car.x);
        if(!car.falling&&(rail.broken||rail.y<(rail.designY??0)-RULES.maxSag)){
          car.falling=true;car.vx=(this.level.right-this.level.left+10)/24;
        }
        if(car.falling){
          car.vy-=RULES.gravity*dt;car.x+=car.vx*dt;car.y+=car.vy*dt;
          const floor=terrainAt(this.level,car.x);if(car.y<floor){car.y=floor;car.vy=0;car.vx*=Math.exp(-8*dt);}
        }else{
          car.y=rail.y;
          if(!rail.ground&&rail.a){const load=this.trainMass*RULES.gravity/4;rail.a.fy-=load*(1-rail.t);rail.b.fy-=load*rail.t;}
        }
      }
    }
    for(const e of this.beams){if(e.broken)continue;const a=this.byId.get(e.a),b=this.byId.get(e.b);
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.max(.001,Math.hypot(dx,dy)),nx=dx/len,ny=dy/len;
      const extension=len-e.length,relative=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
      const force=RULES.stiffness*extension+RULES.damping*relative;
      const strength=RULES.strength/(1+e.length*e.length/30);
      e.stress=RULES.stiffness*extension/strength;this.peak=Math.max(this.peak,Math.abs(e.stress));
      e.peakTension=Math.max(e.peakTension,e.stress);
      e.peakCompression=Math.max(e.peakCompression,-e.stress);
      if(Math.abs(e.stress)>Math.abs(e.peakStress))e.peakStress=e.stress;
      if(Math.abs(e.stress)>1){e.broken=true;this.broken++;continue;}
      a.fx+=force*nx;a.fy+=force*ny;b.fx-=force*nx;b.fy-=force*ny;
    }
    for(const n of this.nodes){if(n.fixed)continue;
      n.vx=(n.vx+n.fx/n.mass*dt)*Math.exp(-1.5*dt);n.vy=(n.vy+n.fy/n.mass*dt)*Math.exp(-1.5*dt);
      n.x+=n.vx*dt;n.y+=n.vy*dt;
      const floor=terrainAt(this.level,n.x);
      // Ground contact also makes overhang and single-anchor levels playable.
      if(n.y<floor&&n.y0>=terrainAt(this.level,n.x0)-0.1){n.y=floor;n.vy=Math.max(0,-n.vy*.05);n.vx*=.85;}
      if(!Number.isFinite(n.x)||!Number.isFinite(n.y)||Math.abs(n.x)>1000||Math.abs(n.y)>1000){
        n.x=n.x0;n.y=n.y0;n.vx=0;n.vy=0;this.status='failed';this.reason='La construcció és inestable. Torna a editar el pont.';return;
      }
    }
    if(this.status==='running')for(const n of this.nodes)if(this.deckNodeIds.has(n.id)&&!n.fixed){
      const amount=n.y0-n.y;
      if(amount>(this.maxDeckDrop?.amount||0))this.maxDeckDrop={node:n.id,x:n.x,y:n.y,y0:n.y0,amount};
    }
    if(this.mode==='stress'&&this.status==='running'){
      if(this.broken||this.nodes.some(n=>!n.fixed&&n.y<n.y0-RULES.maxSag))this.fail('La càrrega prèvia indica una estructura feble. Reforça els trams més carregats.',false);
      else if(this.time>=6){this.status='assessed';this.reason='Prova prèvia completada. Observa els trams més carregats i fes passar el tren.';}
    }
    if(this.mode==='train'&&this.status==='running'&&this.trainX-3.9>this.level.right+1){this.status='passed';this.reason='El tren ha travessat el pont!';}
    if(this.status==='running'&&this.time>20)this.fail('El tren no ha pogut completar el recorregut.');
    if(this.status==='collapsing'&&this.collapseTime>=8)this.status='failed';
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
