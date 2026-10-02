(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const workspace = $('#workspace');
  const layer = $('#components-layer');
  const wiresLayer = $('#wires-layer');
  const inspector = $('#inspector');
  const palette = $('#palette');
  const model = { components: [], wires: [], junctions: [], mode: 'edit', selected: null, selectedWire: null, selectedJunction: null, selectedWirePoint: null, tool: 'select', wireStart: null, wireBefore: null, wireHover: null, collapsed: false, expandedCards: new Set(), result: null, revision: 0, zoom: 1, panX: 0, panY: 0, panel: { x: null, y: 16 } };
  const types = {
    source: { label: 'Font AC', short: 'Font', glyph: '∿', prefix: 'V' },
    resistor: { label: 'Resistència', short: 'R', glyph: 'R', prefix: 'R' },
    inductor: { label: 'Inductància', short: 'L', glyph: '⌁', prefix: 'L' },
    capacitor: { label: 'Capacitat', short: 'C', glyph: 'Ⅱ', prefix: 'C' },
    switch: { label: 'Interruptor', short: 'SW', glyph: '／', prefix: 'SW' },
    voltmeter: { label: 'Voltímetre', short: 'V', glyph: 'V', prefix: 'V' },
    ammeter: { label: 'Amperímetre', short: 'A', glyph: 'A', prefix: 'A' }
  };
  const defaults = { source: { voltage: 12, frequency: 50 }, resistor: { value: 100 }, inductor: { value: .1 }, capacitor: { value: .0001 }, switch: { closed: true }, voltmeter: {}, ammeter: {} };
  const componentUnits = {
    resistor: [{label:'Ω',exponent:0},{label:'kΩ',exponent:3}],
    inductor: [{label:'H',exponent:0},{label:'mH',exponent:-3}],
    capacitor: [{label:'F',exponent:0},{label:'µF',exponent:-6}]
  };
  const componentUnitChoices = new WeakMap();
  let displayedWireRoutes = new Map();
  let validationIssue = null;
  const learningHelp={
    rms:'Valor eficaç. En una resistència produeix el mateix escalfament que aquest valor continu. En una sinusoide, el pic és √2 vegades el valor RMS.',
    phase:'φ = fase de V − fase d’I. φ positiu: el corrent s’endarrereix; φ negatiu: s’avança. Amb V o I nul, la fase no està definida.',
    active:'Potència mitjana absorbida o lliurada, en W. P negatiu indica que l’element lliura potència.',
    reactive:'Potència associada a l’intercanvi d’energia amb L i C, en var. No és potència dissipada.',
    apparent:'S = V RMS × I RMS = √(P² + Q²), en VA. És el mòdul de la potència complexa.',
    factor:'Relació P/S quan S és diferent de zero. En règim sinusoidal correspon a cos φ.',
    voltmeter:'Voltímetre ideal: es connecta en paral·lel, mesura V RMS i no carrega el circuit.',
    ammeter:'Amperímetre ideal: es connecta en sèrie, mesura I RMS i té impedància zero.'
  };
  let toastTimer;
  let panDrag = null;
  let panMoved = false;
  let currentAnimationFrame = null;
  let currentAnimationEpoch = 0;
  const CURRENT_VISUAL_PERIOD = 2400;
  const scopeZoomLevels = [.5, 1, 2, 4, 8];
  let scopeZoom = 1;
  let scopeDrawing = null;
  const scopeResizeObserver = new ResizeObserver(() => {
    if (scopeDrawing && model.mode === 'sim') drawScope(...scopeDrawing);
  });
  let phasorDrawing = null;
  const phasorResizeObserver = new ResizeObserver(() => {
    if (phasorDrawing && model.mode === 'sim') drawPhasors(...phasorDrawing);
  });
  const cardPositions = {};
  const cardSizes = {};
  let cardDrag = null;
  let cardResize = null;
  let cardFront = 0;
  const cardResizeObserver = new ResizeObserver(() => positionAnalysisCards());
  let history = [circuitSnapshot()];
  let historyIndex = 0;

  function circuitSnapshot() { return JSON.stringify({ components: model.components, wires: model.wires, junctions: model.junctions }); }
  function commitHistory(before) {
    const now = circuitSnapshot(); if (before === now) return;
    clearValidation();
    history = history.slice(0, historyIndex + 1); history.push(now); historyIndex = history.length - 1; updateHistoryButtons();
  }
  function restoreHistory(index) {
    clearValidation();
    historyIndex = Math.max(0, Math.min(history.length - 1, index));
    const data = JSON.parse(history[historyIndex]); model.components = data.components; model.wires = data.wires; model.junctions = data.junctions || []; model.selected = null; model.selectedWire = null; model.selectedJunction = null; model.selectedWirePoint = null; model.wireStart = null; model.wireBefore = null; model.wireHover=null; model.result = null; model.revision++; inspector.classList.add('hidden');
    updateHistoryButtons(); render();
  }
  function updateHistoryButtons() {
    const locked = model.mode === 'sim'; $('#undo-btn').disabled = locked || historyIndex <= 0; $('#redo-btn').disabled = locked || historyIndex >= history.length - 1;
  }
  function setViewport() {
    const transform = `translate(${model.panX}px, ${model.panY}px) scale(${model.zoom})`;
    layer.style.transform = transform; wiresLayer.style.transform = transform; $('#zoom-level').textContent = `${Math.round(model.zoom * 100)}%`;
  }
  function setZoom(value,anchor=null) {
    const next=Math.max(.4,Math.min(2.5,value));if(next===model.zoom)return;
    if(anchor){const ratio=next/model.zoom;model.panX=anchor.x-(anchor.x-model.panX)*ratio;model.panY=anchor.y-(anchor.y-model.panY)*ratio;}
    model.zoom=next;model.wireHover=null;clearWirePreview();hideHover();setViewport();
  }
  function changeZoom(delta) { setZoom(Math.round((model.zoom + delta) * 100) / 100); }
  function resetView() { model.zoom = 1; model.panX = 0; model.panY = 0; setViewport(); }

  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  }
  function nextId(type) {
    const prefix = types[type].prefix;
    let i = 1; while (model.components.some(c => c.id === `${prefix}${i}`)) i++;
    return `${prefix}${i}`;
  }
  function addComponent(type) {
    if (model.mode !== 'edit') return;
    if (type === 'source' && model.components.some(c => c.type === 'source')) return toast('Només es permet una font AC per circuit.');
    const before = circuitSnapshot();
    const n = model.components.length;
    const rect = workspace.getBoundingClientRect();
    const cols = Math.max(2, Math.floor((rect.width - 160) / 150));
    const sx = 110 + (n % cols) * 150, sy = 100 + Math.floor(n / cols) * 115;
    const c = { id: nextId(type), type, x: (sx - model.panX) / model.zoom, y: (sy - model.panY) / model.zoom, rotation: 0, ...structuredClone(defaults[type]) };
    model.components.push(c); model.revision++; model.selected = c.id; model.selectedWire = null; model.selectedJunction = null; model.selectedWirePoint = null; model.result = null;
    commitHistory(before);
    render(); openInspector(c.id);
  }
  function componentName(c) { return `${types[c.type].label} ${c.id}`; }
  function decimalShift(value,exponent){
    const [mantissa,power='0']=String(value).split('e');
    return Number(`${mantissa}e${Number(power)+exponent}`);
  }
  function componentUnit(comp){
    const units=componentUnits[comp.type],saved=componentUnitChoices.get(comp);
    if(saved)return saved;
    return units[comp.type==='resistor'?(comp.value>=1000?1:0):(comp.value<1?1:0)];
  }
  function componentText(c) {
    if (c.type === 'source') return `${fmt(c.voltage, 2)} V RMS · ${fmt(c.frequency, 2)} Hz`;
    if (componentUnits[c.type]) {const unit=componentUnit(c);return `${fmt(decimalShift(c.value,-unit.exponent),4)} ${unit.label}`;}
    if (c.type === 'switch') return c.closed ? 'Tancat' : 'Obert';
    return c.type === 'voltmeter' ? 'Ideal' : 'Ideal';
  }
  function symbolSvg(type, closed = false) {
    const start = '<svg class="symbol-svg" viewBox="0 0 96 40" aria-hidden="true" focusable="false"><g class="symbol-stroke">';
    const end = '</g></svg>';
    const shapes = {
      source: '<path d="M0 20H25 M71 20H96"/><circle cx="48" cy="20" r="18"/><path d="M35 20c4-10 8-10 13 0s9 10 13 0"/>',
      resistor: '<path d="M0 20H24 M72 20H96"/><rect x="24" y="9" width="48" height="22"/>',
      inductor: '<path d="M0 20H18 M78 20H96"/><path d="M18 20a7.5 9 0 0 1 15 0a7.5 9 0 0 1 15 0a7.5 9 0 0 1 15 0a7.5 9 0 0 1 15 0"/>',
      capacitor: '<path d="M0 20H40 M56 20H96 M40 7V33 M56 7V33"/>',
      switch: `<path d="M0 20H25 M71 20H96"/><circle cx="25" cy="20" r="2.2"/><circle cx="71" cy="20" r="2.2"/><path d="M27 19L${closed ? '69 20' : '63 8'}"/>`,
      voltmeter: '<path d="M0 20H28 M68 20H96"/><circle cx="48" cy="20" r="19"/><text x="48" y="25" text-anchor="middle">V</text>',
      ammeter: '<path d="M0 20H28 M68 20H96"/><circle cx="48" cy="20" r="19"/><text x="48" y="25" text-anchor="middle">A</text>'
    };
    return `${start}${shapes[type]}${end}`;
  }
  function renderPalette() {
    palette.innerHTML = '';
    for (const type of Object.keys(types)) {
      const b = document.createElement('button'); b.className = 'palette-button'; b.title = `Afegeix ${types[type].label.toLowerCase()}`;
      if(type==='voltmeter'||type==='ammeter')b.title+=`. ${learningHelp[type]}`;
      b.disabled = model.mode === 'sim';
      b.innerHTML = `${symbolSvg(type, true)}<span class="full-label">${types[type].short}</span>`;
      b.addEventListener('click', () => addComponent(type)); palette.append(b);
    }
  }
  function render() {
    stopCurrentAnimation();
    displayedWireRoutes.clear();
    layer.innerHTML = ''; wiresLayer.innerHTML = '';
    const rect = workspace.getBoundingClientRect(); wiresLayer.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    $('#empty-state').classList.toggle('hidden', model.components.length > 0);
    $('#connection-legend').classList.toggle('hidden', model.wires.length === 0);
    const warning=$('#validation-message');warning.classList.toggle('hidden',!validationIssue);warning.textContent=validationIssue?`⚠ ${validationIssue.error}`:'';
    for (const c of model.components) {
      const el = document.createElement('div'); el.className = `component ${c.type} ${c.id === model.selected ? 'selected' : ''} ${model.mode === 'sim' ? 'drag-disabled' : ''} ${model.tool === 'wire' ? 'connect-ready' : ''}`;
      el.dataset.id = c.id; el.style.left = `${c.x}px`; el.style.top = `${c.y}px`; el.style.transform = `translate(-50%,-50%) rotate(${c.rotation}deg)`;
      el.classList.toggle('validation-error',validationIssue?.components?.includes(c.id)||false);
      el.innerHTML = `<button class="terminal left ${model.wireStart===`${c.id}:a`?'wire-start':''}" data-terminal="${c.id}:a" aria-label="Terminal A de ${c.id}"></button><div class="component-card"><div class="symbol-wrap">${symbolSvg(c.type,c.closed)}<span class="component-id">${c.id}</span></div><span class="component-value">${componentText(c)}</span></div><button class="terminal right ${model.wireStart===`${c.id}:b`?'wire-start':''}" data-terminal="${c.id}:b" aria-label="Terminal B de ${c.id}"></button>`;
      el.addEventListener('pointerenter', e => showComponentHover(c, e)); el.addEventListener('pointermove', moveHover); el.addEventListener('pointerleave', hideHover);
      el.querySelectorAll('.terminal').forEach(t => {t.classList.toggle('connection-error',validationIssue?.terminals?.includes(t.dataset.terminal)||false);t.addEventListener('pointerenter', e => showNodeHover(t.dataset.terminal, e)); t.addEventListener('pointermove', moveHover); });
      if (model.tool === 'wire' && model.mode === 'edit') el.querySelectorAll('.terminal').forEach(t => t.addEventListener('click', terminalClick));
      el.addEventListener('click', e => { if (e.target.closest('.terminal')) return; e.stopPropagation(); model.selected = c.id; model.selectedWire = null; model.selectedJunction = null; model.selectedWirePoint = null; render(); openInspector(c.id); });
      if (model.mode === 'edit') enableDrag(el, c);
      layer.append(el);
    }
    for (const j of model.junctions) {
      const degree = model.wires.filter(w => w.a === j.id || w.b === j.id).length;
      const el = document.createElement('button'); el.className = `junction ${degree > 1 ? 'joined' : ''} ${degree > 2 ? 'branched' : ''} ${model.wireStart === j.id ? 'wire-start' : ''} ${model.selectedJunction === j.id ? 'selected' : ''}`;
      el.classList.toggle('validation-error',validationIssue?.junctions?.includes(j.id)||false);
      el.style.left = `${j.x}px`; el.style.top = `${j.y}px`; el.title = degree > 1 ? 'Node de connexió' : 'Extrem lliure'; el.setAttribute('aria-label', el.title);
      el.addEventListener('pointerenter', e => showJunctionHover(j, e)); el.addEventListener('pointermove', moveHover); el.addEventListener('pointerleave', hideHover);
      if (model.tool === 'wire' && model.mode === 'edit') el.addEventListener('click', e => endpointClick(e, j.id));
      else if (model.mode === 'edit' && model.tool !== 'pan') { el.addEventListener('click', e => { e.stopPropagation(); selectJunction(j.id); }); enableJunctionDrag(el, j); }
      layer.append(el);
    }
    setViewport();
    requestAnimationFrame(renderWires);
    $('#circuit-count').textContent = `${model.components.length} components · ${model.wires.length} connexions · ${model.junctions.length} nodes`;
    $('#mode-label').textContent = model.mode === 'edit' ? 'EDITAR' : 'SIMULAR';
    $('.status-dot').style.background = model.mode === 'sim' ? 'var(--green)' : 'var(--cyan)';
    $('#simulate-btn').classList.toggle('hidden', model.mode === 'sim'); $('#stop-btn').classList.toggle('hidden', model.mode !== 'sim');
    $('#wire-btn').classList.toggle('active', model.tool === 'wire'); $('#pan-btn').classList.toggle('active', model.tool === 'pan'); $('#wire-btn').disabled = model.mode === 'sim';
    ['new-btn','open-btn','undo-btn','redo-btn'].forEach(id => $(`#${id}`).disabled = model.mode === 'sim');
    renderPalette(); updateHistoryButtons();
    $('#tool-hint').textContent = model.mode === 'sim' ? 'Animació AC alentida · velocitat segons I RMS · sentit segons la fase' : model.tool === 'wire' ? (model.wireStart ? 'Tria un terminal, node, cable o espai buit per crear una branca' : 'Tria terminals o clica un cable per crear un node') : model.tool === 'pan' ? 'Arrossega l’espai de treball per desplaçar el circuit' : 'Clica un component, cable o node · Supr elimina · Arrossega nodes per allargar cables';
    $('#tool-hint').title='Amb un component seleccionat, R gira 90°. Supr o Backspace elimina l’element seleccionat. Desfer recupera el canvi. Les accions estructurals requereixen EDITAR.';
    if (model.result) renderAnalysis(); else renderEmptyAnalysis();
    if (!inspector.classList.contains('hidden')) {
      if (model.selected) openInspector(model.selected);
      else if (model.selectedWire) openWireInspector(model.selectedWire);
      else if (model.selectedJunction) openJunctionInspector(model.selectedJunction);
    }
  }
  const TERMINAL_OFFSET = 50;
  function endpointGeometry(endpointId) {
    const junction = model.junctions.find(j => j.id === endpointId);
    if (junction) return { point:{x:junction.x,y:junction.y}, normal:null, componentId:null };
    const [id, side] = endpointId.split(':'); const comp = model.components.find(x => x.id === id); if (!comp) return null;
    const angle = comp.rotation * Math.PI / 180, direction = side === 'a' ? -1 : 1;
    const normal = { x:direction*Math.round(Math.cos(angle)), y:direction*Math.round(Math.sin(angle)) };
    return { point:{x:comp.x+TERMINAL_OFFSET*normal.x,y:comp.y+TERMINAL_OFFSET*normal.y}, normal, componentId:id };
  }
  function terminalPoint(terminalId) { return endpointGeometry(terminalId)?.point || null; }
  function endpointPoint(endpointId) {
    return endpointGeometry(endpointId)?.point || null;
  }
  function simplifyPoints(points) { return points.filter((p,i)=>i===0||Math.abs(p.x-points[i-1].x)>1e-7||Math.abs(p.y-points[i-1].y)>1e-7); }
  function segmentHitsComponent(a,b,comp) {
    const vertical=Math.abs(((comp.rotation%180)+180)%180-90)<1e-7,hw=(vertical?21:50)+7,hh=(vertical?50:21)+7;
    const left=comp.x-hw,right=comp.x+hw,top=comp.y-hh,bottom=comp.y+hh;
    if(Math.abs(a.y-b.y)<1e-7)return a.y>top&&a.y<bottom&&Math.max(Math.min(a.x,b.x),left)<Math.min(Math.max(a.x,b.x),right);
    if(Math.abs(a.x-b.x)<1e-7)return a.x>left&&a.x<right&&Math.max(Math.min(a.y,b.y),top)<Math.min(Math.max(a.y,b.y),bottom);
    return true;
  }
  function wireRoute(aId,bId,priorRoutes=[]) {
    const a=endpointGeometry(aId),b=endpointGeometry(bId);if(!a||!b)return [];
    const lead=22,start=a.normal?{x:a.point.x+a.normal.x*lead,y:a.point.y+a.normal.y*lead}:a.point;
    const finish=b.normal?{x:b.point.x+b.normal.x*lead,y:b.point.y+b.normal.y*lead}:b.point;
    const midX=(start.x+finish.x)/2,midY=(start.y+finish.y)/2;
    const bounds=model.components.map(comp=>{const vertical=Math.abs(((comp.rotation%180)+180)%180-90)<1e-7;return{x0:comp.x-(vertical?28:57),x1:comp.x+(vertical?28:57),y0:comp.y-(vertical?57:28),y1:comp.y+(vertical?57:28)};});
    const sceneTop=Math.min(start.y,finish.y,...bounds.map(r=>r.y0))-36,sceneBottom=Math.max(start.y,finish.y,...bounds.map(r=>r.y1))+36;
    const sceneLeft=Math.min(start.x,finish.x,...bounds.map(r=>r.x0))-36,sceneRight=Math.max(start.x,finish.x,...bounds.map(r=>r.x1))+36;
    const otherAnchors=[...model.junctions.map(j=>({id:j.id,point:{x:j.x,y:j.y}})),...model.components.flatMap(comp=>['a','b'].map(side=>{const id=`${comp.id}:${side}`;return{id,point:endpointPoint(id)};}))].filter(anchor=>anchor.id!==aId&&anchor.id!==bId);
    const candidates=[
      [start,{x:finish.x,y:start.y},finish], [start,{x:start.x,y:finish.y},finish],
      [start,{x:midX,y:start.y},{x:midX,y:finish.y},finish], [start,{x:start.x,y:midY},{x:finish.x,y:midY},finish],
      ...[midX-16,midX+16,start.x-16,start.x+16,finish.x-16,finish.x+16].map(x=>[start,{x,y:start.y},{x,y:finish.y},finish]),
      ...[midY-16,midY+16,start.y-16,start.y+16,finish.y-16,finish.y+16].map(y=>[start,{x:start.x,y},{x:finish.x,y},finish]),
      ...[...new Set([Math.min(start.y,finish.y)-36,Math.max(start.y,finish.y)+36,sceneTop,sceneBottom])].map(y=>[start,{x:start.x,y},{x:finish.x,y},finish]),
      ...[...new Set([Math.min(start.x,finish.x)-36,Math.max(start.x,finish.x)+36,sceneLeft,sceneRight])].map(x=>[start,{x,y:start.y},{x,y:finish.y},finish])
    ].map(simplifyPoints);
    let best=candidates[0],bestScore=Infinity;
    for(const route of candidates){let length=0,collisions=0;for(let i=1;i<route.length;i++){const p=route[i-1],q=route[i];length+=Math.abs(q.x-p.x)+Math.abs(q.y-p.y);for(const comp of model.components)if(segmentHitsComponent(p,q,comp))collisions++;}
      const points=simplifyPoints([a.point,...(a.normal?[start]:[]),...route.slice(1,-1),...(b.normal?[finish]:[]),b.point]);
      let overlap=0;
      for(const previous of priorRoutes)overlap+=routeOverlap(points,previous.points,[aId,bId].filter(id=>id===previous.wire.a||id===previous.wire.b));
      let anchorHits=0;
      for(const anchor of otherAnchors)if(points.some((p,i)=>i>0&&pointSegmentDistance(anchor.point,points[i-1],p)<7))anchorHits++;
      const score=collisions*1000000+anchorHits*100000+overlap*1000+length;if(score<bestScore){bestScore=score;best=route;}}
    return simplifyPoints([a.point,...(a.normal?[start]:[]),...best.slice(1,-1),...(b.normal?[finish]:[]),b.point]);
  }
  function pathData(points) { return points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' '); }
  function pointSegmentDistance(point,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)):0;
    return Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
  }
  function routeOverlap(points,other,sharedEndpoints) {
    let overlap=0;
    for(let i=1;i<points.length;i++)for(let j=1;j<other.length;j++){
      const a=points[i-1],b=points[i],p=other[j-1],q=other[j];
      const horizontal=Math.abs(a.y-b.y)<1e-7,otherHorizontal=Math.abs(p.y-q.y)<1e-7;
      if(horizontal!==otherHorizontal)continue;
      const axis=horizontal?'x':'y',fixed=horizontal?'y':'x';if(Math.abs(a[fixed]-p[fixed])>1e-7)continue;
      const lo=Math.max(Math.min(a[axis],b[axis]),Math.min(p[axis],q[axis])),hi=Math.min(Math.max(a[axis],b[axis]),Math.max(p[axis],q[axis]));
      if(hi<=lo)continue;
      let common=0;
      for(const id of sharedEndpoints){const point=endpointPoint(id);if(point&&Math.abs(point[fixed]-a[fixed])<1e-7)common+=Math.max(0,Math.min(hi,point[axis]+22)-Math.max(lo,point[axis]-22));}
      overlap+=Math.max(0,hi-lo-common);
    }
    return overlap;
  }
  // A jump is a drawing convention only: electrical unions still use endpoint IDs.
  function wireDrawings() {
    const routes=[];
    for(const wire of model.wires){const points=wireRoute(wire.a,wire.b,routes);if(points.length>1)routes.push({wire,points,marks:points.map(()=>[]),crossings:[]});}
    for(let i=0;i<routes.length;i++)for(let j=i+1;j<routes.length;j++){
      const first=routes[i],second=routes[j];
      for(let a=1;a<first.points.length;a++)for(let b=1;b<second.points.length;b++){
        const p=first.points[a-1],q=first.points[a],u=second.points[b-1],v=second.points[b];
        const horizontal=Math.abs(p.y-q.y)<1e-7,otherHorizontal=Math.abs(u.y-v.y)<1e-7;if(horizontal===otherHorizontal)continue;
        const point=horizontal?{x:u.x,y:p.y}:{x:p.x,y:u.y};
        const distance=(from,to)=>Math.abs(from.x-to.x)+Math.abs(from.y-to.y);
        const inside=(from,to)=>point.x>=Math.min(from.x,to.x)-1e-7&&point.x<=Math.max(from.x,to.x)+1e-7&&point.y>=Math.min(from.y,to.y)-1e-7&&point.y<=Math.max(from.y,to.y)+1e-7;
        if(!inside(p,q)||!inside(u,v))continue;
        const joined=[first.wire.a,first.wire.b].some(id=>(id===second.wire.a||id===second.wire.b)&&distance(endpointPoint(id),point)<1e-7);
        if(joined)continue;
        const firstRoom=Math.min(distance(p,point),distance(q,point)),secondRoom=Math.min(distance(u,point),distance(v,point));
        const overFirst=horizontal?firstRoom>=2:secondRoom<2&&firstRoom>=2;
        const over=overFirst?first:second,under=overFirst?second:first,overIndex=overFirst?a:b,underIndex=overFirst?b:a;
        const room=overFirst?firstRoom:secondRoom;if(room<2)continue;
        const radius=Math.min(6,room),overStart=over.points[overIndex-1],underStart=under.points[underIndex-1];
        over.marks[overIndex].push({at:distance(overStart,point),radius,kind:'jump'});
        under.marks[underIndex].push({at:distance(underStart,point),radius:9,kind:'gap'});
        first.crossings.push(point);second.crossings.push(point);
      }
    }
    for(const route of routes){
      const commands=[{op:'M',...route.points[0]}];
      for(let i=1;i<route.points.length;i++){
        const start=route.points[i-1],end=route.points[i],dx=end.x-start.x,dy=end.y-start.y,length=Math.abs(dx)+Math.abs(dy);if(length<1e-7)continue;
        const at=t=>({x:start.x+dx*t/length,y:start.y+dy*t/length});
        const marks=route.marks[i].map(mark=>({lo:Math.max(0,mark.at-mark.radius),hi:Math.min(length,mark.at+mark.radius),kind:mark.kind})).sort((a,b)=>a.lo-b.lo);
        const merged=[];
        for(const mark of marks){const last=merged.at(-1);if(last&&mark.lo<=last.hi+1){last.hi=Math.max(last.hi,mark.hi);if(mark.kind==='jump')last.kind='jump';}else merged.push({...mark});}
        for(const mark of merged){
          commands.push({op:'L',...at(mark.lo)});
          if(mark.kind==='gap')commands.push({op:'M',...at(mark.hi)});
          else {const mid=at((mark.lo+mark.hi)/2);commands.push({op:'Q',cx:mid.x+(dy?12:0),cy:mid.y-(dx?12:0),...at(mark.hi)});}
        }
        commands.push({op:'L',...end});
      }
      route.commands=commands;route.d=commands.map(cmd=>`${cmd.op} ${cmd.op==='Q'?`${cmd.cx} ${cmd.cy} `:''}${cmd.x} ${cmd.y}`).join(' ');
    }
    displayedWireRoutes=new Map(routes.map(route=>[route.wire.id,route]));return routes;
  }
  function nextJunctionId() { let i=1; while(model.junctions.some(j=>j.id===`J${i}`))i++; return `J${i}`; }
  function pruneJunctions() { model.junctions=model.junctions.filter(j=>model.wires.some(w=>w.a===j.id||w.b===j.id)); }
  function cancelWireGesture() {
    if(model.wireBefore){const data=JSON.parse(model.wireBefore);model.components=data.components;model.wires=data.wires;model.junctions=data.junctions||[];}
    model.wireStart=null;model.wireBefore=null;model.wireHover=null;
  }
  function renderWires() {
    stopCurrentAnimation();
    wiresLayer.innerHTML = '';
    const flows = [];
    const wireResults = model.mode === 'sim' ? model.result?.wireCurrents || {} : {};
    const threshold = Math.max(1e-12, ...Object.values(wireResults).filter(Boolean).map(i => abs(i) * 1e-10));
    for (const drawing of wireDrawings()) {
      const w=drawing.wire,d=drawing.d;
      const p = document.createElementNS('http://www.w3.org/2000/svg','path'); p.setAttribute('d', d); p.setAttribute('class',`wire-line ${model.wireHover?.wireId===w.id?'connection-target':''} ${model.selectedWire===w.id?'selected':''}`);p.dataset.wireId=w.id;wiresLayer.append(p);
      p.classList.toggle('validation-error',validationIssue?.wires?.includes(w.id)||false);
      const current = wireResults[w.id];
      if (current && abs(current) > threshold) {
        p.classList.add('energized');
        const length = p.getTotalLength();
        if (length > 0) {
          const group = document.createElementNS('http://www.w3.org/2000/svg','g');
          group.setAttribute('class', 'current-particles');
          const count = Math.min(180, Math.max(1, Math.ceil(length / 24)));
          const spacing = length / count;
          const dots = Array.from({ length: count }, () => {
            const dot = document.createElementNS('http://www.w3.org/2000/svg','circle');
            dot.setAttribute('r', '2.4'); group.append(dot); return dot;
          });
          wiresLayer.append(group); flows.push({ path: p, length, current, spacing, dots, group });
        }
      }
      const hit = document.createElementNS('http://www.w3.org/2000/svg','path'); hit.setAttribute('d',d); hit.setAttribute('class','wire-hit');
      hit.addEventListener('pointerenter', e => {showWireHover(w,e);updateWireHover(w,e);}); hit.addEventListener('pointermove', e => {showWireHover(w,e);updateWireHover(w,e);}); hit.addEventListener('pointerleave', () => {hideHover();if(model.wireHover?.wireId===w.id){model.wireHover=null;clearWirePreview();}});
      if (model.mode === 'edit') hit.addEventListener('click', e => { e.stopPropagation(); if (model.tool === 'pan') return; if(model.tool==='wire'){if(model.wireStart===w.a||model.wireStart===w.b){toast('Aquest cable ja pertany al node d’inici. Tria un altre cable.');return;}splitWireAt(w,e);return;} selectWire(w,e); }); wiresLayer.append(hit);
    }
    if (flows.length && !document.hidden) animateWireCurrents(flows);
  }
  function stopCurrentAnimation() {
    if (currentAnimationFrame !== null) cancelAnimationFrame(currentAnimationFrame);
    currentAnimationFrame = null;
  }
  function currentFlowOffset(current, phase) {
    const magnitude = abs(current);
    if (magnitude <= 1e-12) return 0;
    const amplitude = Math.min(110, 12 + 32 * Math.log1p(magnitude / .02));
    // The derivative has the sign of i(t) = sqrt(2) * Im(I * exp(j * phase)).
    return -amplitude * (current.re * Math.cos(phase) - current.im * Math.sin(phase)) / magnitude;
  }
  function animateWireCurrents(flows) {
    const frame = now => {
      currentAnimationFrame = null;
      if (model.mode !== 'sim' || !model.result || document.hidden) return;
      const phase = 2 * Math.PI * ((now - currentAnimationEpoch) % CURRENT_VISUAL_PERIOD) / CURRENT_VISUAL_PERIOD;
      for (const flow of flows) {
        const offset = currentFlowOffset(flow.current, phase);
        const start = ((offset % flow.spacing) + flow.spacing) % flow.spacing;
        const instant = (flow.current.re * Math.sin(phase) + flow.current.im * Math.cos(phase)) / abs(flow.current);
        flow.group.style.opacity = String(.35 + .65 * Math.abs(instant));
        flow.dots.forEach((dot, index) => {
          const point = flow.path.getPointAtLength(Math.min(flow.length, index * flow.spacing + start));
          dot.setAttribute('cx', point.x); dot.setAttribute('cy', point.y);
        });
      }
      currentAnimationFrame = requestAnimationFrame(frame);
    };
    frame(performance.now());
  }
  function enableDrag(el, c) {
    let start;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('.terminal') || model.tool === 'wire' || model.tool === 'pan') return;
      start = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, before: circuitSnapshot() }; el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!start) return; c.x = Math.max(55, start.cx + (e.clientX - start.x) / model.zoom); c.y = Math.max(55, start.cy + (e.clientY - start.y) / model.zoom); el.style.left = `${c.x}px`; el.style.top = `${c.y}px`; renderWires();
    });
    el.addEventListener('pointerup', () => { if (!start) return; commitHistory(start.before); start = null; });
    el.addEventListener('pointercancel', () => { start = null; });
  }
  function enableJunctionDrag(el, j) {
    let start = null;
    el.addEventListener('pointerdown', e => {
      if (model.mode !== 'edit' || model.tool !== 'select') return;
      e.stopPropagation(); const p = eventWorldPoint(e);
      start = { x:p.x, y:p.y, jx:j.x, jy:j.y, before:circuitSnapshot(), moved:false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!start) return; const p = eventWorldPoint(e);
      if (Math.abs(p.x-start.x)+Math.abs(p.y-start.y)>2) start.moved = true;
      if (!start.moved) return;
      j.x = Math.max(8, start.jx + p.x-start.x); j.y = Math.max(8, start.jy + p.y-start.y);
      el.style.left = `${j.x}px`; el.style.top = `${j.y}px`; renderWires();
    });
    el.addEventListener('pointerup', () => { if (!start) return; if (start.moved) commitHistory(start.before); start = null; });
    el.addEventListener('pointercancel', () => { if (!start) return; j.x = start.jx; j.y = start.jy; el.style.left = `${j.x}px`; el.style.top = `${j.y}px`; renderWires(); start = null; });
  }
  function terminalClick(e) { endpointClick(e, e.currentTarget.dataset.terminal); }
  function endpointClick(e, endpoint) {
    e.stopPropagation();
    if (!model.wireStart) { model.wireStart = endpoint; model.wireBefore = circuitSnapshot(); render(); return; }
    if (model.wireStart === endpoint) { cancelWireGesture(); render(); return; }
    const before=model.wireBefore||circuitSnapshot();
    model.wires.push({ id: crypto.randomUUID(), a: model.wireStart, b: endpoint });
    model.wireStart = null; model.wireBefore = null; model.wireHover=null; commitHistory(before); invalidate(); render();
  }
  function eventWorldPoint(e) { const r=workspace.getBoundingClientRect(); return {x:(e.clientX-r.left-model.panX)/model.zoom,y:(e.clientY-r.top-model.panY)/model.zoom}; }
  function orthogonalPoints(a,b) { const mx=(a.x+b.x)/2; return [{x:a.x,y:a.y},{x:mx,y:a.y},{x:mx,y:b.y},{x:b.x,y:b.y}]; }
  function nearestOnWire(w,e) {
    const pts=displayedWireRoutes.get(w.id)?.points||wireRoute(w.a,w.b),p=eventWorldPoint(e); let best=null;
    for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;if(!len)continue;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len));const q={x:a.x+t*dx,y:a.y+t*dy};const d=(q.x-p.x)**2+(q.y-p.y)**2;if(!best||d<best.d)best={...q,d};}
    return best;
  }
  function previewRoute(startId,point) {
    const start=endpointGeometry(startId);if(!start)return [];
    const lead=start.normal?{x:start.point.x+start.normal.x*22,y:start.point.y+start.normal.y*22}:start.point;
    const elbow={x:point.x,y:lead.y};
    return simplifyPoints([start.point,...(start.normal?[lead]:[]),elbow,point]);
  }
  function updateWireHover(w,e) {
    if(model.tool!=='wire'||!model.wireStart||model.wireStart===w.a||model.wireStart===w.b){model.wireHover=null;clearWirePreview();return;}
    const point=nearestOnWire(w,e);if(!point)return;
    model.wireHover={wireId:w.id,point};
    $$('.wire-line').forEach(line=>line.classList.toggle('connection-target',line.dataset.wireId===w.id));
    let path=$('#wire-preview'),snap=$('#wire-snap-point');
    if(!path){path=document.createElementNS('http://www.w3.org/2000/svg','path');path.id='wire-preview';path.setAttribute('class','wire-preview');wiresLayer.append(path);}
    if(!snap){snap=document.createElementNS('http://www.w3.org/2000/svg','circle');snap.id='wire-snap-point';snap.setAttribute('class','wire-snap-point');snap.setAttribute('r','7');wiresLayer.append(snap);}
    path.setAttribute('d',pathData(previewRoute(model.wireStart,point)));
    snap.setAttribute('cx',point.x);snap.setAttribute('cy',point.y);
  }
  function clearWirePreview() { $('#wire-preview')?.remove();$('#wire-snap-point')?.remove();$$('.wire-line.connection-target').forEach(line=>line.classList.remove('connection-target')); }
  function splitWireAtPoint(w,point) {
    const id=nextJunctionId(); model.junctions.push({id,x:point.x,y:point.y}); model.wires=model.wires.filter(x=>x.id!==w.id);
    model.wires.push({id:crypto.randomUUID(),a:w.a,b:id},{id:crypto.randomUUID(),a:id,b:w.b}); return id;
  }
  function splitWireAt(w,e) {
    const point=nearestOnWire(w,e); if(!point)return;
    const before=model.wireBefore||circuitSnapshot(),previousStart=model.wireStart,id=splitWireAtPoint(w,point);
    model.wireHover=null;
    if(previousStart){model.wires.push({id:crypto.randomUUID(),a:previousStart,b:id});model.wireStart=null;model.wireBefore=null;commitHistory(before);invalidate();render();toast('Branca connectada al cable en el node '+id+'.');}
    else{model.wireStart=id;model.wireBefore=before;render();toast('Node '+id+' marcat. Tria ara on connectar la branca.');}
  }
  function addFreeJunction(e) {
    const before=model.wireBefore||circuitSnapshot(),p=eventWorldPoint(e),id=nextJunctionId(); model.junctions.push({id,x:p.x,y:p.y}); model.wires.push({id:crypto.randomUUID(),a:model.wireStart,b:id});
    model.wireStart=null;model.wireBefore=null;model.wireHover=null;commitHistory(before);invalidate();render();
  }
  function clearValidation(){validationIssue=null;hideHover();$('#validation-message').classList.add('hidden');$$('.connection-error,.validation-error').forEach(el=>el.classList.remove('connection-error','validation-error'));}
  function invalidate() { clearValidation();model.revision++; model.result = null; }
  function positionHover(e) { const tip=$('#hover-info'),r=workspace.getBoundingClientRect();tip.style.left=`${Math.max(4,Math.min(e.clientX-r.left+12,r.width-tip.offsetWidth-4))}px`;tip.style.top=`${Math.max(4,Math.min(e.clientY-r.top+12,r.height-tip.offsetHeight-4))}px`; }
  function showHover(title, rows, e) { const tip=$('#hover-info');tip.innerHTML=`<strong>${title}</strong>${rows.map(x=>`<span>${x}</span>`).join('')}`;tip.classList.remove('hidden');positionHover(e); }
  function moveHover(e){if(!$('#hover-info').classList.contains('hidden'))positionHover(e);}
  function hideHover(){ $('#hover-info').classList.add('hidden'); }
  function showComponentHover(comp,e){const result=model.result?.components[comp.id];const rows=[componentText(comp)];if(comp.type==='voltmeter'||comp.type==='ammeter')rows.push(learningHelp[comp.type]);if(result)rows.push(`V = ${fmt(abs(result.voltage))} V RMS`,`I = ${fmt(abs(result.current))} A RMS`);showHover(componentName(comp),rows,e);}
  function showNodeHover(terminal,e){const n=model.result?.terminalNodes?.[terminal],v=n&&model.result?.nodeValues[n];showHover(validationIssue?.terminals?.includes(terminal)?'Terminal pendent de connectar':n||'Terminal',validationIssue?.terminals?.includes(terminal)?['Connecta aquest terminal a un altre component.']:v?[`V = ${fmt(abs(v))} V RMS`,`∠ ${fmt(arg(v)*180/Math.PI)}°`]:['Simula per consultar la tensió'],e);}
  function showJunctionHover(j,e){const n=model.result?.terminalNodes?.[j.id],v=n&&model.result?.nodeValues[n];showHover(validationIssue?.junctions?.includes(j.id)?'Revisa aquest node':n||'Node',validationIssue?.junctions?.includes(j.id)?[validationIssue.error]:v?[`V = ${fmt(abs(v))} V RMS`,`∠ ${fmt(arg(v)*180/Math.PI)}°`]:['Punt d’unió de cables'],e);}
  function showWireHover(w,e){
    const point=eventWorldPoint(e),crossing=displayedWireRoutes.get(w.id)?.crossings.some(p=>Math.hypot(p.x-point.x,p.y-point.y)*model.zoom<12);
    if(model.tool==='wire'){
      const same=model.wireStart===w.a||model.wireStart===w.b;
      showHover(same?'Aquest cable ja està connectat':crossing?'Encreuament sense unió':'Crear un node en aquest cable',[
        ...(crossing?['El salt indica que els cables no s’uneixen aquí.']:[]),
        same?'Tria un altre cable per afegir una branca':model.wireStart?'Clica per connectar només al cable ressaltat':'Clica per iniciar una derivació en aquest cable'
      ],e);return;
    }
    const n=model.result?.terminalNodes?.[w.a],v=n&&model.result?.nodeValues[n];
    const rows=[...(crossing?['Els cables no s’uneixen en aquest punt.']:[]),v?`V = ${fmt(abs(v))} V RMS`:'Clica per seleccionar, afegir un node o eliminar el cable'];
    if(model.result){const current=model.result.wireCurrents[w.id];rows.push(current?`I = ${polarText(current,'A RMS')}`:'Corrent no únic en aquest bucle de cables ideals');}
    showHover(crossing?'Encreuament sense unió':'Connexió',rows,e);
  }
  function positionInspector() {
    if (model.panel.x === null) model.panel.x = Math.max(12, workspace.clientWidth - 246);
    inspector.style.left = `${model.panel.x}px`; inspector.style.right = 'auto'; inspector.style.top = `${model.panel.y}px`;
  }
  function selectWire(w,e) {
    model.selected = null; model.selectedJunction = null; model.selectedWire = w.id; model.selectedWirePoint = nearestOnWire(w,e);
    hideHover(); model.wireHover = null; clearWirePreview(); render(); openWireInspector(w.id);
  }
  function selectJunction(id) {
    model.selected = null; model.selectedWire = null; model.selectedWirePoint = null; model.selectedJunction = id;
    render(); openJunctionInspector(id);
  }
  function openWireInspector(id) {
    const w=model.wires.find(x=>x.id===id); if(!w)return;
    positionInspector();
    inspector.innerHTML=`<div class="panel-head"><span>Cable</span><button id="close-inspector" aria-label="Tanca">×</button></div><div class="panel-row">Connexió seleccionada</div><div class="analysis-note">Punt ple: unió de cables. Salt: encreuament sense unió.</div><div class="analysis-note">Afegeix un node al cable i arrossega’l per allargar o ajustar-ne el traçat.</div><div class="panel-actions">${model.mode==='edit'?'<button id="edit-wire-node">Afegeix node</button><button id="delete-selected" class="danger">Elimina cable</button>':''}</div>`;
    inspector.classList.remove('hidden'); $('#close-inspector').onclick=()=>inspector.classList.add('hidden'); makePanelDraggable();
    if($('#delete-selected')){$('#delete-selected').title='Elimina el cable seleccionat (Supr o Backspace)';$('#delete-selected').onclick=deleteSelectedElement;}
    if($('#edit-wire-node'))$('#edit-wire-node').onclick=addNodeToSelectedWire;
  }
  function openJunctionInspector(id) {
    const j=model.junctions.find(x=>x.id===id); if(!j)return;
    const degree=model.wires.filter(w=>w.a===id||w.b===id).length;
    positionInspector();
    inspector.innerHTML=`<div class="panel-head"><span>Node ${id}</span><button id="close-inspector" aria-label="Tanca">×</button></div><div class="panel-row">${degree} ${degree===1?'connexió':'connexions'}</div><div class="analysis-note">Arrossega el punt per allargar o redistribuir els cables connectats.</div><div class="panel-actions">${model.mode==='edit'?'<button id="delete-selected" class="danger">Elimina node i connexions</button>':''}</div>`;
    inspector.classList.remove('hidden'); $('#close-inspector').onclick=()=>inspector.classList.add('hidden'); makePanelDraggable();
    if($('#delete-selected')){$('#delete-selected').title='Elimina el node i els seus cables (Supr o Backspace)';$('#delete-selected').onclick=deleteSelectedElement;}
  }
  function addNodeToSelectedWire() {
    const w=model.wires.find(x=>x.id===model.selectedWire),point=model.selectedWirePoint; if(!w||!point)return;
    const a=endpointPoint(w.a),b=endpointPoint(w.b),near=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y)<16;
    if((a&&near(point,a))||(b&&near(point,b))){toast('Tria un punt més allunyat de l’extrem del cable.');return;}
    const before=circuitSnapshot(),id=splitWireAtPoint(w,point);
    model.selected=null;model.selectedWire=null;model.selectedWirePoint=null;model.selectedJunction=id;
    commitHistory(before);invalidate();render();openJunctionInspector(id);toast(`Node ${id} creat. Arrossega’l per allargar el cable.`);
  }
  function deleteSelectedElement() {
    if(model.mode!=='edit')return;
    const before=circuitSnapshot(); let message='';
    if(model.selected){
      const c=model.components.find(x=>x.id===model.selected); if(!c)return;
      message=`${componentName(c)} eliminat.`; model.components=model.components.filter(x=>x.id!==c.id);
      model.wires=model.wires.filter(w=>!w.a.startsWith(`${c.id}:`)&&!w.b.startsWith(`${c.id}:`)); pruneJunctions();
    } else if(model.selectedWire){
      if(!model.wires.some(w=>w.id===model.selectedWire))return;
      model.wires=model.wires.filter(w=>w.id!==model.selectedWire); pruneJunctions(); message='Cable eliminat.';
    } else if(model.selectedJunction){
      const id=model.selectedJunction,degree=model.wires.filter(w=>w.a===id||w.b===id).length; if(!model.junctions.some(j=>j.id===id))return;
      model.wires=model.wires.filter(w=>w.a!==id&&w.b!==id); model.junctions=model.junctions.filter(j=>j.id!==id); pruneJunctions();
      message=`Node ${id} eliminat amb ${degree} ${degree===1?'connexió.':'connexions.'}`;
    } else return;
    hideHover();
    commitHistory(before);model.selected=null;model.selectedWire=null;model.selectedJunction=null;model.selectedWirePoint=null;inspector.classList.add('hidden');invalidate();render();toast(message);
  }
  function openInspector(id) {
    const c = model.components.find(x => x.id === id); if (!c) return;
    model.selected = id;
    positionInspector();
    inspector.innerHTML = `<div class="panel-head"><span>${componentName(c)}</span><button id="close-inspector" aria-label="Tanca">×</button></div>${inspectorFields(c)}<div class="panel-actions">${model.mode === 'edit' ? '<button id="rotate-component" title="Gira 90° amb la tecla R">Gira 90° (R)</button><button id="delete-component" class="danger">Elimina component</button>' : ''}</div>`;
    inspector.classList.remove('hidden');
    $('#close-inspector').onclick = () => inspector.classList.add('hidden');
    makePanelDraggable();
    if (c.type === 'source') bindField('source-voltage', v => c.voltage = v, 'V RMS');
    if (c.type === 'source') bindField('source-frequency', v => c.frequency = v, 'Hz');
    if (componentUnits[c.type]) bindComponentValue(c);
    if (c.type === 'switch') $('#switch-toggle').onclick = () => { const before=circuitSnapshot();c.closed = !c.closed;commitHistory(before);changedElectrical();openInspector(id); };
    if ($('#rotate-component')) $('#rotate-component').onclick = () => rotateComponent(id);
    if ($('#delete-component')) {$('#delete-component').title='Elimina el component i els seus cables (Supr o Backspace)';$('#delete-component').onclick = deleteSelectedElement;}
  }
  function rotateComponent(id=model.selected) {
    if(model.mode!=='edit')return;
    const comp=model.components.find(x=>x.id===id);if(!comp)return;
    const before=circuitSnapshot();comp.rotation=(comp.rotation+90)%360;commitHistory(before);render();openInspector(id);
  }
  function inspectorFields(c) {
    if (c.type === 'source') return `<label class="panel-row">Tensió RMS<input id="source-voltage" type="number" min="0.000001" step="any" value="${c.voltage}"></label><label class="panel-row">Freqüència<input id="source-frequency" type="number" min="0.000001" step="any" value="${c.frequency}"></label><div class="analysis-note">Fase fixada a 0°</div>`;
    if (componentUnits[c.type]) {
      const unit=componentUnit(c),value=decimalShift(c.value,-unit.exponent);
      return `<div class="panel-row"><label for="component-value">Valor</label><div class="component-value-editor"><input id="component-value" type="number" min="0" step="any" value="${value}"><select id="component-unit" aria-label="Unitat del valor" title="Canvia la unitat conservant el valor físic">${componentUnits[c.type].map(option=>`<option value="${option.label}" ${option===unit?'selected':''}>${option.label}</option>`).join('')}</select></div></div>`;
    }
    if (c.type === 'switch') return `<div class="panel-row">Estat <span>${c.closed ? 'Tancat' : 'Obert'}</span></div><div class="panel-actions"><button id="switch-toggle">${c.closed ? 'Obre interruptor' : 'Tanca interruptor'}</button></div>`;
    if (c.type === 'voltmeter') return `<div class="panel-row">Mesura <span>Tensió RMS</span></div>`;
    return `<div class="panel-row">Mesura <span>Corrent RMS</span></div>`;
  }
  function bindComponentValue(comp){
    const input=$('#component-value'),select=$('#component-unit'),unit=componentUnit(comp);
    componentUnitChoices.set(comp,unit);
    input.addEventListener('change',()=>{
      const value=decimalShift(Number(input.value),unit.exponent);
      if(!Number.isFinite(value)||value<=0){
        toast(`Introdueix un valor positiu i finit en ${unit.label}.`);
        input.value=decimalShift(comp.value,-unit.exponent);return;
      }
      if(value===comp.value){input.value=decimalShift(comp.value,-unit.exponent);return;}
      const before=circuitSnapshot();comp.value=value;commitHistory(before);changedElectrical();
    });
    select.addEventListener('change',()=>{
      const next=componentUnits[comp.type].find(option=>option.label===select.value);
      const displayed=next?decimalShift(comp.value,-next.exponent):NaN;
      if(!Number.isFinite(displayed)||displayed<=0){
        select.value=unit.label;toast('Aquest valor no es pot representar en aquesta unitat.');return;
      }
      componentUnitChoices.set(comp,next);hideHover();render();
      $('#component-unit')?.focus({preventScroll:true});
    });
  }
  function bindField(id, setter, unit) {
    const input = $(`#${id}`); input.disabled = false;
    input.addEventListener('change', () => {
      const v = Number(input.value); if (!Number.isFinite(v) || v <= 0) { toast(`Introdueix un valor positiu en ${unit}.`); input.value = id === 'source-voltage' ? model.components.find(c=>c.id===model.selected).voltage : id === 'source-frequency' ? model.components.find(c=>c.id===model.selected).frequency : model.components.find(c=>c.id===model.selected).value; return; }
      const before=circuitSnapshot();setter(v);commitHistory(before);changedElectrical();
    });
  }
  function makePanelDraggable() {
    const head = $('.panel-head', inspector); let drag = null;
    head.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; const r = inspector.getBoundingClientRect(); drag = { x:e.clientX, y:e.clientY, px:r.left-workspace.getBoundingClientRect().left, py:r.top-workspace.getBoundingClientRect().top }; head.setPointerCapture(e.pointerId); });
    head.addEventListener('pointermove', e => { if (!drag) return; model.panel.x = Math.max(0, drag.px + e.clientX-drag.x); model.panel.y = Math.max(0, drag.py + e.clientY-drag.y); inspector.style.left = `${model.panel.x}px`; inspector.style.top = `${model.panel.y}px`; });
    head.addEventListener('pointerup', () => drag=null); head.addEventListener('pointercancel', () => drag=null);
  }
  function changedElectrical() {
    invalidate();
    if (model.mode === 'sim') { const out = solveCircuit(); if (out.ok) model.result = out; else { model.mode = 'edit';validationIssue=out; } }
    render();
  }

  function downloadBlob(blob, filename) {
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function saveCircuit() {
    const data={format:'THOSLAB-AC',schemaVersion:1,components:model.components.map(c=>({...c})),wires:model.wires.map(w=>({a:w.a,b:w.b})),junctions:model.junctions.map(j=>({...j}))};
    downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),'THOSLAB_AC_circuit.json');
    toast('Circuit desat en un fitxer JSON.');
  }
  function validateCircuitFile(data) {
    if(!data||data.format!=='THOSLAB-AC'||data.schemaVersion!==1||!Array.isArray(data.components)||!Array.isArray(data.wires))throw new Error('El fitxer no és un circuit THOSLAB AC v1 vàlid.');
    const rawJunctions=data.junctions??[];if(!Array.isArray(rawJunctions)||data.components.length>300||data.wires.length>1000||rawJunctions.length>500)throw new Error('El fitxer supera el nombre màxim d’elements admès.');
    const seen=new Set();let sourceCount=0;
    const components=data.components.map(raw=>{
      if(!raw||!Object.hasOwn(types,raw.type)||typeof raw.id!=='string'||! /^[A-Za-z][A-Za-z0-9_-]{0,23}$/.test(raw.id)||seen.has(raw.id))throw new Error('Hi ha un component o identificador no vàlid.');
      seen.add(raw.id);if(raw.type==='source')sourceCount++;
      if(!Number.isFinite(raw.x)||!Number.isFinite(raw.y)||Math.abs(raw.x)>10000||Math.abs(raw.y)>10000||!Number.isFinite(raw.rotation))throw new Error(`La posició o orientació de ${raw.id} no és vàlida.`);
      const comp={id:raw.id,type:raw.type,x:raw.x,y:raw.y,rotation:((raw.rotation%360)+360)%360};
      if(raw.type==='source') {if(!(Number.isFinite(raw.voltage)&&raw.voltage>0&&Number.isFinite(raw.frequency)&&raw.frequency>0))throw new Error('La font AC necessita Vrms i freqüència positius.');Object.assign(comp,{voltage:raw.voltage,frequency:raw.frequency});}
      else if(['resistor','inductor','capacitor'].includes(raw.type)){if(!(Number.isFinite(raw.value)&&raw.value>0))throw new Error(`El valor de ${raw.id} no és vàlid.`);comp.value=raw.value;}
      else if(raw.type==='switch'){if(typeof raw.closed!=='boolean')throw new Error(`L’estat de ${raw.id} no és vàlid.`);comp.closed=raw.closed;}
      return comp;
    });
    if(sourceCount>1)throw new Error('Un circuit només pot tenir una font AC.');
    const junctionIds=new Set();const junctions=rawJunctions.map(j=>{if(!j||typeof j.id!=='string'||!/^J\d+$/.test(j.id)||junctionIds.has(j.id)||seen.has(j.id)||!Number.isFinite(j.x)||!Number.isFinite(j.y)||Math.abs(j.x)>10000||Math.abs(j.y)>10000)throw new Error('Hi ha un node o identificador no vàlid.');junctionIds.add(j.id);return{id:j.id,x:j.x,y:j.y};});
    const terminals=new Set(components.flatMap(c=>[`${c.id}:a`,`${c.id}:b`]));const endpoints=new Set([...terminals,...junctionIds]),links=new Set();
    const wires=data.wires.map(raw=>{
      if(!raw||typeof raw.a!=='string'||typeof raw.b!=='string'||raw.a===raw.b||!endpoints.has(raw.a)||!endpoints.has(raw.b))throw new Error('Hi ha una connexió amb terminals o nodes inexistents.');
      const key=[raw.a,raw.b].sort().join('|');if(links.has(key))throw new Error('El fitxer conté una connexió duplicada.');links.add(key);return{id:crypto.randomUUID(),a:raw.a,b:raw.b};
    });
    return {components,wires,junctions};
  }
  async function openCircuitFile(file) {
    try {
      if(model.components.length&&!window.confirm('Obrir aquest circuit substituirà el circuit actual. Vols continuar?')){$('#open-file-input').value='';return;}
      const parsed=JSON.parse(await file.text()),loaded=validateCircuitFile(parsed);cancelWireGesture();const before=circuitSnapshot();
      model.components=loaded.components;model.wires=loaded.wires;model.junctions=loaded.junctions;model.selected=null;model.selectedWire=null;model.selectedJunction=null;model.selectedWirePoint=null;model.result=null;model.mode='edit';model.tool='select';model.wireStart=null;model.wireBefore=null;model.revision++;inspector.classList.add('hidden');commitHistory(before);resetView();render();toast('Circuit obert.');
    } catch(err) { toast(err instanceof SyntaxError?'No s’ha pogut llegir el fitxer JSON.':err.message||'No s’ha pogut obrir el circuit.'); }
    $('#open-file-input').value='';
  }
  function newCircuit() {
    if(model.mode==='sim')return;
    if(model.components.length&&!window.confirm('Es substituirà el circuit actual. Vols començar-ne un de nou?'))return;
    cancelWireGesture();
    const before=circuitSnapshot();model.components=[];model.wires=[];model.junctions=[];model.selected=null;model.selectedWire=null;model.selectedJunction=null;model.selectedWirePoint=null;model.result=null;model.tool='select';model.wireStart=null;model.wireBefore=null;model.revision++;inspector.classList.add('hidden');commitHistory(before);resetView();render();
  }
  function exportPng() {
    const width=workspace.clientWidth,height=workspace.clientHeight,ratio=2,canvas=document.createElement('canvas');canvas.width=width*ratio;canvas.height=height*ratio;
    const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);ctx.fillStyle='#0b1523';ctx.fillRect(0,0,width,height);ctx.fillStyle='#304057';for(let x=12;x<width;x+=24)for(let y=12;y<height;y+=24)ctx.fillRect(x,y,1.5,1.5);
    ctx.save();ctx.translate(model.panX,model.panY);ctx.scale(model.zoom,model.zoom);
    for(const drawing of wireDrawings()){
      ctx.beginPath();for(const cmd of drawing.commands){if(cmd.op==='M')ctx.moveTo(cmd.x,cmd.y);else if(cmd.op==='Q')ctx.quadraticCurveTo(cmd.cx,cmd.cy,cmd.x,cmd.y);else ctx.lineTo(cmd.x,cmd.y);}
      ctx.strokeStyle='#91aec8';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
    }
    for(const c of model.components)drawPngComponent(ctx,c);
    for(const j of model.junctions){const degree=model.wires.filter(w=>w.a===j.id||w.b===j.id).length;ctx.beginPath();ctx.arc(j.x,j.y,degree>2?4:3,0,Math.PI*2);ctx.fillStyle=degree>1?'#c3e5f5':'#0b1523';ctx.fill();ctx.strokeStyle='#d4e9f5';ctx.lineWidth=1;ctx.stroke();}
    ctx.restore();ctx.fillStyle='#a9bdcf';ctx.font='600 11px system-ui';ctx.fillText('THOSLAB AC',12,height-12);
    canvas.toBlob(blob=>{if(blob)downloadBlob(blob,'THOSLAB_AC_circuit.png');else toast('No s’ha pogut crear la imatge PNG.');},'image/png');
  }
  function drawPngComponent(ctx,c) {
    ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.rotation*Math.PI/180);ctx.strokeStyle='#d0dfed';ctx.fillStyle='#0b1523';ctx.lineWidth=2.4;ctx.lineCap='round';ctx.lineJoin='round';
    const line=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
    if(c.type==='source'){line(-TERMINAL_OFFSET,0,-23,0);line(23,0,TERMINAL_OFFSET,0);ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();ctx.beginPath();for(let x=-12;x<=12;x++){const y=-6*Math.sin((x+12)*Math.PI/12);x===-12?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
    else if(c.type==='resistor'){line(-TERMINAL_OFFSET,0,-24,0);ctx.strokeRect(-24,-11,48,22);line(24,0,TERMINAL_OFFSET,0);}
    else if(c.type==='inductor'){line(-TERMINAL_OFFSET,0,-30,0);for(let i=0;i<4;i++){const x=-30+i*15;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x,-17,x+15,-17,x+15,0);ctx.stroke();}line(30,0,TERMINAL_OFFSET,0);}
    else if(c.type==='capacitor'){line(-TERMINAL_OFFSET,0,-8,0);line(8,0,TERMINAL_OFFSET,0);line(-8,-13,-8,13);line(8,-13,8,13);}
    else if(c.type==='switch'){line(-TERMINAL_OFFSET,0,-23,0);line(23,0,TERMINAL_OFFSET,0);ctx.beginPath();ctx.arc(-23,0,2,0,Math.PI*2);ctx.arc(23,0,2,0,Math.PI*2);ctx.fill();line(-21,-1,c.closed?21:16,c.closed?0:-12);}
    else {line(-TERMINAL_OFFSET,0,-20,0);line(20,0,TERMINAL_OFFSET,0);ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d0dfed';ctx.font='700 15px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.type==='voltmeter'?'V':'A',0,1);}
    for(const x of [-TERMINAL_OFFSET,TERMINAL_OFFSET]){ctx.beginPath();ctx.arc(x,0,2.5,0,Math.PI*2);ctx.fillStyle='#ff4058';ctx.fill();ctx.strokeStyle='#fff0f2';ctx.lineWidth=1;ctx.stroke();}
    ctx.fillStyle='#d6e3ef';ctx.font='10px monospace';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(c.id,0,24);ctx.fillStyle='#b6c8da';ctx.font='10px monospace';ctx.fillText(componentText(c),0,37);ctx.restore();
  }

  function c(re=0, im=0) { return {re,im}; }
  const add=(a,b)=>c(a.re+b.re,a.im+b.im), sub=(a,b)=>c(a.re-b.re,a.im-b.im), mul=(a,b)=>c(a.re*b.re-a.im*b.im,a.re*b.im+a.im*b.re), div=(a,b)=>{const d=b.re*b.re+b.im*b.im;return c((a.re*b.re+a.im*b.im)/d,(a.im*b.re-a.re*b.im)/d);};
  const abs=a=>Math.hypot(a.re,a.im), arg=a=>Math.atan2(a.im,a.re), conj=a=>c(a.re,-a.im), polar=(m,a)=>c(m*Math.cos(a),m*Math.sin(a));
  function solveLinear(A, b) {
    const n=b.length; A=A.map(row=>row.map(x=>c(x.re,x.im))); b=b.map(x=>c(x.re,x.im));
    for(let k=0;k<n;k++){
      let p=k; for(let i=k+1;i<n;i++) if(abs(A[i][k])>abs(A[p][k])) p=i;
      if(abs(A[p][k])<1e-12) throw new Error('La topologia dona una solució indeterminada. Revisa les connexions i els instruments.');
      [A[k],A[p]]=[A[p],A[k]]; [b[k],b[p]]=[b[p],b[k]];
      const pivot=A[k][k]; for(let j=k;j<n;j++) A[k][j]=div(A[k][j],pivot); b[k]=div(b[k],pivot);
      for(let i=0;i<n;i++) if(i!==k){const f=A[i][k]; if(abs(f)<1e-24)continue; for(let j=k;j<n;j++)A[i][j]=sub(A[i][j],mul(f,A[k][j])); b[i]=sub(b[i],mul(f,b[k]));}
    }
    return b;
  }
  function buildNodes() {
    const parent=new Map(); const find=x=>{if(!parent.has(x))parent.set(x,x); if(parent.get(x)!==x)parent.set(x,find(parent.get(x))); return parent.get(x);};
    const union=(a,b)=>{const x=find(a),y=find(b);if(x!==y)parent.set(y,x);};
    for(const comp of model.components){find(`${comp.id}:a`);find(`${comp.id}:b`);} for(const j of model.junctions)find(j.id);
    for(const w of model.wires) union(w.a,w.b);
    const ids=new Map(); return term=>{const root=find(term);if(!ids.has(root))ids.set(root,`N${ids.size+1}`);return ids.get(root);};
  }
  function solveCircuit() {
    const sources=model.components.filter(x=>x.type==='source');
    if(sources.length!==1)return {ok:false,error:sources.length?'El circuit ha de tenir una sola font AC.':'Afegeix una font AC amb el botó Font abans de simular.',components:sources.map(x=>x.id)};
    const source=sources[0];
    if(!(source.voltage>0&&source.frequency>0&&Number.isFinite(source.voltage)&&Number.isFinite(source.frequency)))return {ok:false,error:'La font ha de tenir tensió i freqüència positives i finites.',components:[source.id]};
    for(const x of model.components) if(['resistor','inductor','capacitor'].includes(x.type)&&(!(x.value>0)||!Number.isFinite(x.value)))return {ok:false,error:`El valor de ${x.id} ha de ser positiu i finit.`,components:[x.id]};
    if(model.wires.length===0)return {ok:false,error:'Connecta els terminals marcats abans de simular.',terminals:model.components.flatMap(comp=>[`${comp.id}:a`,`${comp.id}:b`])};
    const freeJunctions=model.junctions.filter(j=>model.wires.filter(w=>w.a===j.id||w.b===j.id).length<2).map(j=>j.id);
    if(freeJunctions.length)return {ok:false,error:'Hi ha extrems de cable lliures: connecta o elimina els punts marcats.',junctions:freeJunctions,wires:model.wires.filter(w=>freeJunctions.includes(w.a)||freeJunctions.includes(w.b)).map(w=>w.id)};
    const nodeFor=buildNodes(); const nodes=new Set(); model.components.forEach(x=>{nodes.add(nodeFor(`${x.id}:a`));nodes.add(nodeFor(`${x.id}:b`));});
    const terminalCount={}; for(const comp of model.components)for(const side of ['a','b']){const n=nodeFor(`${comp.id}:${side}`);terminalCount[n]=(terminalCount[n]||0)+1;}
    const loose=new Set(Object.entries(terminalCount).filter(([,count])=>count<2).map(([id])=>id));
    if(loose.size)return {ok:false,error:'Els terminals marcats no arriben a cap altre component. Completa’n les connexions.',terminals:model.components.flatMap(comp=>['a','b'].map(side=>`${comp.id}:${side}`)).filter(id=>loose.has(nodeFor(id))),junctions:model.junctions.filter(j=>loose.has(nodeFor(j.id))).map(j=>j.id),wires:model.wires.filter(w=>loose.has(nodeFor(w.a))).map(w=>w.id)};
    const short=idealShortPath(source);if(short)return {ok:false,error:'La font està curtcircuitada per cables o elements d’impedància zero. Revisa el camí marcat.',components:[source.id,...short.components],wires:short.wires,junctions:short.junctions};
    const branches=[]; const voltageBranches=[]; const omega=2*Math.PI*source.frequency;
    for(const comp of model.components){const p=nodeFor(`${comp.id}:a`),n=nodeFor(`${comp.id}:b`); if(comp.type==='source'){voltageBranches.push({comp,p,n,value:c(comp.voltage,0),kind:'source'});continue;}
      if(comp.type==='switch'){if(comp.closed)voltageBranches.push({comp,p,n,value:c(0),kind:'short'});else branches.push({comp,p,n,y:c(0),open:true});continue;}
      if(comp.type==='voltmeter'){branches.push({comp,p,n,y:c(0),meter:true});continue;}
      if(comp.type==='ammeter'){voltageBranches.push({comp,p,n,value:c(0),kind:'ammeter'});continue;}
      let z;if(comp.type==='resistor')z=c(comp.value); if(comp.type==='inductor')z=c(0,omega*comp.value); if(comp.type==='capacitor')z=c(0,-1/(omega*comp.value));
      branches.push({comp,p,n,y:div(c(1),z)});
    }
    // Give each electrically connected island its own reference node. This also handles a valid open switch.
    const gp=new Map([...nodes].map(x=>[x,x])); const gf=x=>{let p=gp.get(x);if(p!==x){p=gf(p);gp.set(x,p);}return p;}; const gu=(a,b)=>{a=gf(a);b=gf(b);if(a!==b)gp.set(b,a);};
    for(const b of branches)if(!b.open)gu(b.p,b.n); for(const b of voltageBranches)gu(b.p,b.n);
    const refs=new Set([...nodes].map(gf)); const unknownNodes=[...nodes].filter(x=>!refs.has(x)); const idx=new Map(unknownNodes.map((x,i)=>[x,i]));
    const dim=unknownNodes.length+voltageBranches.length; if(dim===0)return {ok:false,error:'El circuit no té prou connexions per determinar les magnituds.'};
    const A=Array.from({length:dim},()=>Array.from({length:dim},()=>c(0))); const rhs=Array.from({length:dim},()=>c(0));
    const stampY=(p,n,y)=>{const i=idx.get(p),j=idx.get(n);if(i!==undefined)A[i][i]=add(A[i][i],y);if(j!==undefined)A[j][j]=add(A[j][j],y);if(i!==undefined&&j!==undefined){A[i][j]=sub(A[i][j],y);A[j][i]=sub(A[j][i],y);}};
    branches.forEach(b=>{if(!b.open&&!b.meter)stampY(b.p,b.n,b.y);});
    voltageBranches.forEach((b,k)=>{const row=unknownNodes.length+k,i=idx.get(b.p),j=idx.get(b.n);if(i!==undefined){A[i][row]=add(A[i][row],c(1));A[row][i]=add(A[row][i],c(1));}if(j!==undefined){A[j][row]=sub(A[j][row],c(1));A[row][j]=sub(A[row][j],c(1));}rhs[row]=b.value;});
    let solution; try{solution=solveLinear(A,rhs);}catch(e){return {ok:false,error:e.message};}
    const volts=new Map([...nodes].map(n=>[n,idx.has(n)?solution[idx.get(n)]:c(0)]));
    const currents={}; const componentResults={};
    const voltageBranchCurrent=new Map();voltageBranches.forEach((b,k)=>voltageBranchCurrent.set(b.comp.id,solution[unknownNodes.length+k]));
    for(const comp of model.components){const p=nodeFor(`${comp.id}:a`),n=nodeFor(`${comp.id}:b`),v=sub(volts.get(p),volts.get(n));let i=c(0);
      if(comp.type==='source'||comp.type==='ammeter'||(comp.type==='switch'&&comp.closed))i=voltageBranchCurrent.get(comp.id)||c(0);
      else if(comp.type==='switch'&&!comp.closed)i=c(0);
      else if(comp.type==='voltmeter')i=c(0);
      else {const br=branches.find(x=>x.comp.id===comp.id);i=mul(br.y,v);}
      const s=mul(v,conj(i));
      const impedance=['resistor','inductor','capacitor'].includes(comp.type)?div(c(1),branches.find(x=>x.comp.id===comp.id).y):comp.type==='ammeter'||(comp.type==='switch'&&comp.closed)?c(0):null;
      const cr={voltage:v,current:i,power:c(s.re,s.im),impedance,closed:comp.closed};componentResults[comp.id]=cr;currents[comp.id]=i;
    }
    const totalI=mul(voltageBranchCurrent.get(source.id)||c(0),c(-1)); const zEq=abs(totalI)>1e-12?div(c(source.voltage,0),totalI):null; const totalS=mul(c(source.voltage,0),conj(totalI));
    const nodeValues={};for(const n of nodes)nodeValues[n]=volts.get(n);
    const meterValues={};for(const m of model.components.filter(x=>x.type==='voltmeter'||x.type==='ammeter'))meterValues[m.id]=m.type==='voltmeter'?componentResults[m.id].voltage:componentResults[m.id].current;
    const terminalNodes={};for(const comp of model.components)for(const side of ['a','b'])terminalNodes[`${comp.id}:${side}`]=nodeFor(`${comp.id}:${side}`);for(const j of model.junctions)terminalNodes[j.id]=nodeFor(j.id);
    const wireCurrents = deriveWireCurrents(componentResults);
    return {ok:true,revision:model.revision,frequency:source.frequency,voltage:c(source.voltage,0),current:totalI,impedance:zEq,nodeValues,terminalNodes,components:componentResults,wireCurrents,meterValues,power:c(totalS.re,0),reactive:c(0,totalS.im),apparent:abs(c(totalS.re,totalS.im)),pf:abs(totalS.re)/Math.max(abs(c(totalS.re,totalS.im)),1e-15),phase:-arg(totalI),omega};
  }
  function idealShortPath(source){
    const graph=new Map(),link=(a,b,edge)=>{if(!graph.has(a))graph.set(a,[]);graph.get(a).push({to:b,...edge});};
    for(const w of model.wires){link(w.a,w.b,{wire:w.id});link(w.b,w.a,{wire:w.id});}
    for(const comp of model.components)if(comp.type==='ammeter'||(comp.type==='switch'&&comp.closed)){const a=`${comp.id}:a`,b=`${comp.id}:b`;link(a,b,{component:comp.id});link(b,a,{component:comp.id});}
    const start=`${source.id}:a`,target=`${source.id}:b`,previous=new Map([[start,null]]),queue=[start];
    for(let i=0;i<queue.length&&!previous.has(target);i++)for(const edge of graph.get(queue[i])||[])if(!previous.has(edge.to)){previous.set(edge.to,{from:queue[i],edge});queue.push(edge.to);}
    if(!previous.has(target))return null;
    const path={components:[],wires:[],junctions:[]};
    for(let id=target;id!==start;){const step=previous.get(id);if(!id.includes(':'))path.junctions.push(id);if(step.edge.component)path.components.push(step.edge.component);if(step.edge.wire)path.wires.push(step.edge.wire);id=step.from;}
    return path;
  }
  function deriveWireCurrents(componentResults) {
    const graph = new Map(), supply = new Map(), result = {};
    const ensure = id => { if (!graph.has(id)) graph.set(id, []); };
    for (const comp of model.components) {
      const a = `${comp.id}:a`, b = `${comp.id}:b`, current = componentResults[comp.id].current;
      ensure(a); ensure(b); supply.set(a, mul(current, c(-1))); supply.set(b, current);
    }
    for (const wire of model.wires) {
      ensure(wire.a); ensure(wire.b); result[wire.id] = null;
      graph.get(wire.a).push({ to: wire.b, wire }); graph.get(wire.b).push({ to: wire.a, wire });
    }
    const visited = new Map(), low = new Map(); let clock = 0;
    const visit = (id, parentEdge) => {
      visited.set(id, ++clock); low.set(id, clock);
      let total = supply.get(id) || c(0);
      for (const { to, wire } of graph.get(id)) {
        if (wire.id === parentEdge) continue;
        if (!visited.has(to)) {
          const branchSupply = visit(to, wire.id); total = add(total, branchSupply);
          low.set(id, Math.min(low.get(id), low.get(to)));
          // A bridge has a unique current fixed by KCL. An ideal-wire cycle does not.
          if (low.get(to) > visited.get(id)) result[wire.id] = mul(branchSupply, c(wire.a === id ? -1 : 1));
        } else low.set(id, Math.min(low.get(id), visited.get(to)));
      }
      return total;
    };
    for (const id of graph.keys()) if (!visited.has(id)) visit(id, null);
    return result;
  }
  function fmt(n, digits=2){if(!Number.isFinite(n))return '—';if(Math.abs(n)>0&&Math.abs(n)<.001||Math.abs(n)>=10000)return n.toExponential(2);return Number(n.toFixed(digits)).toLocaleString('ca-ES',{maximumFractionDigits:digits});}
  function polarText(z, unit='') {return `${fmt(abs(z))} ${unit} ∠ ${fmt(arg(z)*180/Math.PI)}°`;}
  function helpLabel(label,explanation){return explanation?`<abbr class="didactic-help" title="${explanation}">${label}</abbr>`:label;}
  function metric(label,value){
    const help=label.includes('RMS')?learningHelp.rms:label.startsWith('Fase')?learningHelp.phase:label==='P activa'?learningHelp.active:label==='Q reactiva'?learningHelp.reactive:label==='S aparent'?learningHelp.apparent:label==='cos φ'?learningHelp.factor:null;
    return `<div class="metric"><label>${helpLabel(label,help)}</label><strong>${value}</strong></div>`;
  }
  function renderEmptyAnalysis(){ endCardDrag();endCardResize();scopeResizeObserver.disconnect();scopeDrawing=null;phasorResizeObserver.disconnect();phasorDrawing=null;$('#analysis-area').classList.add('hidden'); }
  function renderAnalysis(){
    const r=model.result;if(!r)return renderEmptyAnalysis();
    const selected=model.components.find(x=>x.id===model.selected),selectedResult=selected?r.components[selected.id]:null;
    const pair=selectedResult||{voltage:r.voltage,current:r.current};
    const context=selected?componentName(selected):'Circuit global';
    const area=$('#analysis-area');area.classList.remove('hidden');area.classList.toggle('collapsed',model.collapsed);
    const scopeBody=$('#scope-card-content'),phasorBody=$('#phasors-card-content'),analysisBody=$('#analysis-card-content');
    const expanded=model.expandedCards;
    $$('.analysis-card').forEach(card=>{const open=expanded.has(card.dataset.card);card.classList.toggle('expanded',open);const control=$('[data-expand]',card);control.querySelector('span').textContent=open?'Plega':'Ampliar';control.setAttribute('aria-expanded',String(open));});
    const scopeSpan = 2 / scopeZoom / r.frequency;
    scopeBody.innerHTML=`<div class="card-context">${context}</div><div class="scope-controls" role="group" aria-label="Zoom temporal del Scope"><button data-scope-zoom="out" title="Allunya el Scope: més temps" aria-label="Allunya el Scope" ${scopeZoom===scopeZoomLevels[0]?'disabled':''}>−</button><span class="scope-window">${fmt(scopeZoom)}× · ${fmt(scopeSpan*1000)} ms</span><button data-scope-zoom="in" title="Apropa el Scope: menys temps" aria-label="Apropa el Scope" ${scopeZoom===scopeZoomLevels.at(-1)?'disabled':''}>+</button><button data-scope-zoom="auto" title="Restableix el Scope a dos períodes">Auto</button></div><canvas class="scope-chart ${expanded.has('scope')?'scope-large':''}" id="scope-card-canvas" role="img" aria-label="Sinusoides de tensió i corrent; escales verticals independents"></canvas><div class="card-summary"><span class="scope-voltage">V ${fmt(abs(pair.voltage))} V</span> · <span class="scope-current">I ${fmt(abs(pair.current))} A</span> RMS${expanded.has('scope')?` · f ${fmt(r.frequency)} Hz · φ ${fmt((arg(pair.voltage)-arg(pair.current))*180/Math.PI)}°`:''}</div><div class="scope-scale-note">V i I amb escala pròpia · pics ajustats</div>`;
    const phasors=[];if(selectedResult){phasors.push([`V ${selected.id}`,selectedResult.voltage,'#48d7d2'],[`I ${selected.id}`,selectedResult.current,'#ffb86b']);}else{phasors.push(['V font',r.voltage,'#48d7d2'],['I total',r.current,'#ffb86b']);const series=model.components.filter(x=>['resistor','inductor','capacitor'].includes(x.type));if(series.length&&series.every(x=>r.components[x.id])&&isSeriesRlc(series))for(const x of series)phasors.push([`V ${x.id}`,r.components[x.id].voltage,['#9ee7b5','#ff8f8f','#b69aff'][['resistor','inductor','capacitor'].indexOf(x.type)]]);}
    const phaseInfo=phasorPhase(pair);
    const phaseLabel=phaseInfo.angle===null?'φ no definit':`φ ${fmt(phaseInfo.angle*180/Math.PI)}°`;
    phasorBody.innerHTML=`<div class="card-context">${context}</div><div class="phasor-visual-row"><canvas class="phasor-chart" id="phasors-card-canvas" role="img" aria-label="Fasors de tensió i corrent amb escales pròpies; ${phaseLabel}; ${phaseInfo.description}"></canvas><div class="phasor-details"><strong class="phasor-phase">${phaseLabel}</strong><div class="phasor-relation">${phaseInfo.description}</div>${expanded.has('phasors')?`<div class="phasor-list">${phasors.map(([name,z,color])=>`<span class="phasor-chip"><span style="color:${color}">${name}</span>: ${polarText(z,name.startsWith('I')?'A RMS':'V RMS')}</span>`).join('')}</div>`:`<div class="phasor-values"><span class="scope-voltage">V ${fmt(abs(pair.voltage))} V</span><span class="scope-current">I ${fmt(abs(pair.current))} A</span><span>Valors RMS</span></div>`}</div></div><div class="phasor-scale-note">Escales pròpies: tensions en V · corrents en A</div>`;
    analysisBody.innerHTML=circuitAnalysis(r,selected,selectedResult,expanded.has('analysis'));
    $('.card-summary',scopeBody).title=learningHelp.rms;$('.card-summary',scopeBody).classList.add('didactic-help');
    $('.phasor-phase',phasorBody).title=learningHelp.phase;$('.phasor-phase',phasorBody).classList.add('didactic-help');
    const rmsValues=$('.phasor-values',phasorBody);if(rmsValues){rmsValues.title=learningHelp.rms;rmsValues.classList.add('didactic-help');}
    scopeResizeObserver.disconnect();scopeDrawing=[$('#scope-card-canvas'),pair,r.omega];
    drawScope(...scopeDrawing);scopeResizeObserver.observe(scopeDrawing[0]);
    phasorResizeObserver.disconnect();phasorDrawing=[$('#phasors-card-canvas'),phasors,pair];
    drawPhasors(...phasorDrawing);phasorResizeObserver.observe(phasorDrawing[0]);
    $$('[data-scope-zoom]',scopeBody).forEach(button=>button.onclick=()=>{
      const action=button.dataset.scopeZoom,index=scopeZoomLevels.indexOf(scopeZoom);
      scopeZoom=action==='auto'?1:scopeZoomLevels[Math.max(0,Math.min(scopeZoomLevels.length-1,index+(action==='in'?1:-1)))];
      renderAnalysis();
      const control=$(`[data-scope-zoom="${action}"]`,scopeBody);
      (control.disabled?$('[data-scope-zoom="auto"]',scopeBody):control).focus({preventScroll:true});
    });
    $$('.analysis-card-head').forEach(button=>button.onclick=()=>toggleAnalysisCard(button.dataset.expand));
    positionAnalysisCards();
  }
  function toggleAnalysisCard(id){
    const card=$(`.analysis-card[data-card="${id}"]`);if(!card)return;
    endCardDrag();endCardResize();positionAnalysisCards();
    cardPositions[id]={x:parseFloat(card.style.left),y:parseFloat(card.style.top)};
    if(model.expandedCards.has(id))model.expandedCards.delete(id);else model.expandedCards.add(id);
    card.style.zIndex=String(++cardFront);renderAnalysis();
  }
  function boundedCardPosition(card,x,y){
    const area=$('#analysis-area'),margin=8;
    const minX=Math.min(margin,Math.max(0,area.clientWidth-card.offsetWidth));
    const minY=Math.min(margin,Math.max(0,area.clientHeight-card.offsetHeight));
    return {x:Math.max(minX,Math.min(Math.max(minX,area.clientWidth-card.offsetWidth-margin),x)),y:Math.max(minY,Math.min(Math.max(minY,area.clientHeight-card.offsetHeight-38),y))};
  }
  function positionAnalysisCards(){
    const area=$('#analysis-area');
    if(model.mode!=='sim'||model.collapsed||!area.clientWidth||!area.clientHeight)return;
    const cards=$$('.analysis-card'),margin=8,gap=8;
    const columns=Math.min(3,Math.max(1,Math.floor((area.clientWidth-2*margin+gap)/(155+gap))));
    const width=Math.max(0,Math.min(420,(area.clientWidth-2*margin-gap*(columns-1))/columns));
    const rows=Math.ceil(cards.length/columns);
    cards.forEach((card,index)=>{
      const id=card.dataset.card,open=model.expandedCards.has(id);
      const maxWidth=Math.max(0,area.clientWidth-2*margin),maxHeight=Math.max(29,area.clientHeight-2*margin-38);
      if(open&&!cardSizes[id])cardSizes[id]={width:Math.max(width,600),height:360};
      const requested=open?cardSizes[id]:{width,height:144};
      card.style.width=`${Math.min(maxWidth,Math.max(Math.min(155,maxWidth),requested.width))}px`;
      card.style.height=`${Math.min(maxHeight,Math.max(Math.min(112,maxHeight),requested.height))}px`;
      card.style.maxHeight=`${maxHeight}px`;
      const saved=cardPositions[id];
      const x=saved?saved.x:margin+(index%columns)*(width+gap);
      const y=saved?saved.y:area.clientHeight-38-card.offsetHeight-(rows-1-Math.floor(index/columns))*(144+gap);
      const position=boundedCardPosition(card,x,y);
      card.style.left=`${position.x}px`;card.style.top=`${position.y}px`;
      if(saved)cardPositions[id]=position;
    });
  }
  function moveAnalysisCard(card,x,y){
    const position=boundedCardPosition(card,x,y);
    cardPositions[card.dataset.card]=position;card.style.left=`${position.x}px`;card.style.top=`${position.y}px`;
  }
  function endCardDrag(){
    if(!cardDrag)return;
    const {handle,card,pointerId}=cardDrag;cardDrag=null;card.classList.remove('dragging');
    if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);
  }
  function endCardResize(){
    if(!cardResize)return;
    const {handle,card,pointerId}=cardResize;cardResize=null;card.classList.remove('resizing');
    if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);
  }
  function resizeAnalysisCard(card,width,height){
    const id=card.dataset.card,opening=!model.expandedCards.has(id),area=$('#analysis-area');
    const maxWidth=Math.max(0,area.clientWidth-16),maxHeight=Math.max(29,area.clientHeight-54);
    cardSizes[id]={width:Math.max(Math.min(155,maxWidth),Math.min(maxWidth,width)),height:Math.max(Math.min(112,maxHeight),Math.min(maxHeight,height))};
    model.expandedCards.add(id);
    if(opening)renderAnalysis();else positionAnalysisCards();
  }
  function initializeCardMovement(){
    const area=$('#analysis-area');cardResizeObserver.observe(area);
    $$('.analysis-card').forEach(card=>{
      cardResizeObserver.observe(card);
      card.addEventListener('pointerdown',()=>{card.style.zIndex=String(++cardFront);});
      card.addEventListener('focusin',()=>{card.style.zIndex=String(++cardFront);});
      const handle=$('.card-drag-handle',card);
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==0||!e.isPrimary||model.mode!=='sim')return;
        e.preventDefault();e.stopPropagation();endCardDrag();endCardResize();positionAnalysisCards();hideHover();
        handle.focus({preventScroll:true});card.style.zIndex=String(++cardFront);card.classList.add('dragging');
        cardDrag={handle,card,pointerId:e.pointerId,x:e.clientX,y:e.clientY,left:parseFloat(card.style.left),top:parseFloat(card.style.top)};
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener('pointermove',e=>{
        if(!cardDrag||cardDrag.handle!==handle||e.pointerId!==cardDrag.pointerId)return;
        e.preventDefault();moveAnalysisCard(card,cardDrag.left+e.clientX-cardDrag.x,cardDrag.top+e.clientY-cardDrag.y);
      });
      for(const event of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(event,e=>{if(cardDrag?.handle===handle&&cardDrag.pointerId===e.pointerId)endCardDrag();});
      handle.addEventListener('keydown',e=>{
        const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[e.key];
        if(!direction||e.ctrlKey||e.metaKey||e.altKey||model.mode!=='sim')return;
        e.preventDefault();e.stopPropagation();positionAnalysisCards();card.style.zIndex=String(++cardFront);
        const step=e.shiftKey?1:10;moveAnalysisCard(card,parseFloat(card.style.left)+direction[0]*step,parseFloat(card.style.top)+direction[1]*step);
      });
      const resize=$('.card-resize-handle',card);
      resize.addEventListener('pointerdown',e=>{
        if(e.button!==0||!e.isPrimary||model.mode!=='sim')return;
        e.preventDefault();e.stopPropagation();endCardDrag();endCardResize();positionAnalysisCards();hideHover();
        resize.focus({preventScroll:true});card.style.zIndex=String(++cardFront);card.classList.add('resizing');
        cardPositions[card.dataset.card]={x:parseFloat(card.style.left),y:parseFloat(card.style.top)};
        cardResize={handle:resize,card,pointerId:e.pointerId,x:e.clientX,y:e.clientY,width:card.offsetWidth,height:card.offsetHeight};
        resize.setPointerCapture(e.pointerId);
      });
      resize.addEventListener('pointermove',e=>{
        if(!cardResize||cardResize.handle!==resize||e.pointerId!==cardResize.pointerId)return;
        const dx=e.clientX-cardResize.x,dy=e.clientY-cardResize.y;if(Math.abs(dx)+Math.abs(dy)<2)return;
        e.preventDefault();resizeAnalysisCard(card,cardResize.width+dx,cardResize.height+dy);
      });
      for(const event of ['pointerup','pointercancel','lostpointercapture'])resize.addEventListener(event,e=>{if(cardResize?.handle===resize&&cardResize.pointerId===e.pointerId)endCardResize();});
      resize.addEventListener('keydown',e=>{
        const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[e.key];
        if(!direction||e.ctrlKey||e.metaKey||e.altKey||model.mode!=='sim')return;
        e.preventDefault();e.stopPropagation();endCardDrag();endCardResize();positionAnalysisCards();card.style.zIndex=String(++cardFront);
        cardPositions[card.dataset.card]={x:parseFloat(card.style.left),y:parseFloat(card.style.top)};
        const step=e.shiftKey?1:10;resizeAnalysisCard(card,card.offsetWidth+direction[0]*step,card.offsetHeight+direction[1]*step);
      });
    });
    $('#reset-card-positions').addEventListener('click',()=>{
      endCardDrag();endCardResize();for(const key of Object.keys(cardPositions))delete cardPositions[key];
      cardFront=0;$$('.analysis-card').forEach(card=>card.style.removeProperty('z-index'));positionAnalysisCards();
    });
  }
  function hasConductingPath(result){
    const source=model.components.find(comp=>comp.type==='source');
    const graph=new Map(),link=(a,b)=>{if(!graph.has(a))graph.set(a,[]);graph.get(a).push(b);};
    for(const comp of model.components){
      if(comp.type==='source'||comp.type==='voltmeter'||(comp.type==='switch'&&!comp.closed))continue;
      const a=result.terminalNodes[`${comp.id}:a`],b=result.terminalNodes[`${comp.id}:b`];link(a,b);link(b,a);
    }
    const start=result.terminalNodes[`${source.id}:a`],target=result.terminalNodes[`${source.id}:b`];
    const visited=new Set([start]),queue=[start];
    for(let k=0;k<queue.length;k++){const node=queue[k];if(node===target)return true;for(const next of graph.get(node)||[])if(!visited.has(next)){visited.add(next);queue.push(next);}}
    return false;
  }
  function circuitAnalysis(result,component,componentResult,expanded){
    const pair=componentResult||result,voltage=abs(pair.voltage),current=abs(pair.current);
    const p=componentResult?pair.power.re:result.power.re,q=componentResult?pair.power.im:result.reactive.im;
    const apparent=componentResult?abs(pair.power):result.apparent;
    const phase=phasorPhase(pair),phaseText=phase.angle===null?'No definit':`${fmt(phase.angle*180/Math.PI)}°`;
    const pf=apparent>0?Math.max(-1,Math.min(1,p/apparent)):null;
    const tolerance=apparent*1e-10,reactive=Math.abs(q)<=tolerance?0:q;
    const source=component?.type==='source';
    const impedance=componentResult?pair.impedance:result.impedance||(current>0?div(result.voltage,result.current):null);
    const impedanceText=source?'No aplicable':impedance?`${fmt(abs(impedance))} Ω`:current===0?'∞ Ω':'No definida';
    const impedancePhase=impedance&&abs(impedance)>0?`${fmt(arg(impedance)*180/Math.PI)}°`:'No definit';
    let behavior,explanation;
    if(source){behavior='Font AC ideal';explanation='La potència de la font segueix el conveni d’absorció: P < 0 significa que lliura potència activa.';}
    else if(component?.type==='voltmeter'){behavior='Voltímetre ideal';explanation='No carrega el circuit: I = 0 i impedància infinita. La fase V − I i cos φ no estan definits.';}
    else if(component?.type==='ammeter'){behavior='Amperímetre ideal';explanation='Impedància zero i V = 0. Mesura el corrent de la branca; la fase V − I i cos φ no estan definits.';}
    else if(component?.type==='switch'){behavior=component.closed?'Interruptor tancat':'Interruptor obert';explanation=component.closed?'Element ideal amb impedància zero i V = 0. No absorbeix potència.':'Branca oberta: I = 0 i impedància infinita. La fase i cos φ no estan definits.';}
    else if(!component&&!hasConductingPath(result)){behavior='Circuit obert';explanation='No hi ha un camí conductor entre els terminals de la font. I = 0; P, Q i S són nuls. La fase i cos φ no estan definits.';}
    else if(current===0){behavior=component?'Component sense corrent':'Corrent total nul';explanation=component?'No hi circula corrent: les potències són nul·les i la fase i cos φ no estan definits.':'I total = 0 i les potències globals són nul·les. Pot haver-hi corrents en branques que es compensen; la fase global i cos φ no estan definits.';}
    else if(reactive>0){behavior=component?'Component inductiu':'Circuit inductiu';explanation='Q > 0: comportament inductiu; el corrent s’endarrereix respecte de la tensió.';}
    else if(reactive<0){behavior=component?'Component capacitiu':'Circuit capacitiu';explanation='Q < 0: comportament capacitiu; el corrent s’avança respecte de la tensió.';}
    else{behavior='Comportament resistiu';explanation='Q ≈ 0: sense potència reactiva neta; tensió i corrent estan en fase.';}
    const context=component?componentName(component):'Circuit global';
    const compactMetrics=[metric('V RMS',`${fmt(voltage)} V`),metric('I RMS',`${fmt(current)} A`),source?metric('Fase φ',phaseText):metric(component?'Impedància |Z|':'Z equivalent',impedanceText),metric('P activa',`${fmt(p)} W`)];
    const header=`<div class="card-context">${context}</div><div class="analysis-behavior">${behavior}</div>`;
    if(!expanded)return `${header}<div class="card-metrics">${compactMetrics.join('')}</div>`;
    const group=(title,metrics,note='')=>`<section class="analysis-section"><h3>${title}</h3><div class="card-metrics">${metrics.join('')}</div>${note?`<p class="analysis-explanation">${note}</p>`:''}</section>`;
    const circuitMetrics=[metric('V RMS',`${fmt(voltage)} V`),metric('I RMS',`${fmt(current)} A`),metric('Freqüència',`${fmt(result.frequency)} Hz`),metric(component?'Impedància |Z|':'Z equivalent',impedanceText)];
    if(!source)circuitMetrics.push(metric('Angle de Z',impedancePhase));
    const phaseMetrics=[metric('Fase φ = V − I',phaseText),metric('cos φ',pf===null?'No definit':fmt(pf,3))];
    const phaseNote=phase.angle===null?'La fase V − I requereix tensió i corrent no nuls. Si S = 0, cos φ tampoc està definit.':phase.description;
    const powerMetrics=[metric('P activa',`${fmt(p)} W`),metric('Q reactiva',`${reactive===0&&q!==0?'≈0':fmt(q)} var`),metric('S aparent',`${fmt(apparent)} VA`)];
    const qNote=source?(reactive>0?'Q > 0: la font absorbeix potència reactiva.':reactive<0?'Q < 0: la font lliura potència reactiva.':'Q = 0: la font no intercanvia potència reactiva neta.'):reactive>0?'Q > 0 indica comportament inductiu.':reactive<0?'Q < 0 indica comportament capacitiu.':'Q ≈ 0: no hi ha potència reactiva neta.';
    const powerNote=`P és la potència activa; Q, la reactiva; S, l’aparent. ${qNote}`;
    return `${header}<p class="analysis-explanation analysis-state">${explanation}</p>${group(component?'Component':'Circuit',circuitMetrics)}${group('Fase',phaseMetrics,phaseNote)}${group(source?'Potències de la font (absorbides)':'Potències',powerMetrics,powerNote)}`;
  }
  function isSeriesRlc(list){const branches=model.components.filter(x=>x.type==='source'||['resistor','inductor','capacitor'].includes(x.type));if(list.length<2||branches.length!==list.length+1)return false;const degree={};for(const x of branches)for(const side of ['a','b']){const n=model.result.terminalNodes[`${x.id}:${side}`];degree[n]=(degree[n]||0)+1;}return Object.values(degree).length===branches.length&&Object.values(degree).every(n=>n===2);}
  function drawScope(canvas,pair,omega){
    const dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const w=rect.width,h=rect.height,labels=h>=80&&w>=180;
    const left=5,right=w-5,top=5,bottom=h-(labels?18:5);
    if(right<=left||bottom<=top)return;
    const center=(top+bottom)/2,amplitude=(bottom-top)*.43;
    const period=2*Math.PI/omega,span=2*period/scopeZoom,start=period-span/2;
    ctx.strokeStyle='#263a51';ctx.lineWidth=1;
    for(let i=1;i<8;i++){const x=left+(right-left)*i/8;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,bottom);ctx.stroke();}
    for(let i=0;i<=4;i++){const y=top+(bottom-top)*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();}
    ctx.strokeStyle='#40556d';ctx.beginPath();ctx.moveTo(left,center);ctx.lineTo(right,center);ctx.stroke();
    // Voltage and current have different units: each uses its own peak scale.
    // Scaling by the peak (rather than RMS) leaves room for the entire sine.
    [[pair.voltage,'#48d7d2'],[pair.current,'#ffb86b']].forEach(([z,color])=>{
      const peak=Math.sqrt(2)*abs(z),phase=arg(z);
      ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.setLineDash(color==='#ffb86b'?[4,3]:[]);ctx.beginPath();
      const samples=Math.max(2,Math.ceil(right-left));
      for(let k=0;k<=samples;k++){
        const fraction=k/samples,x=left+(right-left)*fraction,t=start+span*fraction;
        const instant=peak*Math.sin(omega*t+phase);
        const y=center-(peak>0?instant/peak:0)*amplitude;
        if(k===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    if(labels){
      ctx.fillStyle='#8da3b9';ctx.font='9px monospace';ctx.textBaseline='bottom';
      [[left,start,'left'],[(left+right)/2,start+span/2,'center'],[right,start+span,'right']].forEach(([x,t,align])=>{
        ctx.textAlign=align;ctx.fillText(`${fmt(t*1000)} ms`,x,h-2);
      });
    }
  }
  function phasorPhase(pair){
    if(abs(pair.current)===0)return {angle:null,description:'Corrent nul · fase no definida'};
    if(abs(pair.voltage)===0)return {angle:null,description:'Tensió nul·la · fase no definida'};
    const difference=arg(pair.voltage)-arg(pair.current);
    const angle=Math.atan2(Math.sin(difference),Math.cos(difference));
    const description=Math.abs(angle)<1e-8?'Corrent en fase':Math.abs(Math.abs(angle)-Math.PI)<1e-8?'Corrent en oposició':angle>0?'Corrent endarrerit':'Corrent avançat';
    return {angle,description};
  }
  function drawPhasors(canvas,list,pair){
    const dpr=window.devicePixelRatio||1,rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
    const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
    const w=rect.width,h=rect.height,cx=w/2,cy=h/2,font=h>220?14:h>100?10:8;
    ctx.font=`${font}px monospace`;ctx.textBaseline='middle';
    const labelWidth=Math.max(...list.map(([name])=>ctx.measureText(name).width),0);
    const radius=Math.max(0,Math.min(w/2-labelWidth/2-7,h/2-font-6));
    if(radius<3)return;
    const maxV=Math.max(0,...list.filter(([name])=>!name.startsWith('I')).map(([,z])=>abs(z)));
    const maxI=Math.max(0,...list.filter(([name])=>name.startsWith('I')).map(([,z])=>abs(z)));
    ctx.strokeStyle='#2a4058';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(5,cy);ctx.lineTo(w-5,cy);ctx.moveTo(cx,5);ctx.lineTo(cx,h-5);ctx.stroke();
    for(let k=1;k<=2;k++){ctx.beginPath();ctx.arc(cx,cy,radius*k/2,0,Math.PI*2);ctx.stroke();}
    const phase=phasorPhase(pair);
    if(phase.angle!==null&&Math.abs(phase.angle)>1e-8){
      const start=-arg(pair.voltage),end=start+phase.angle,arcRadius=radius*.43;
      ctx.strokeStyle='#ead57a';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,arcRadius,start,end,phase.angle<0);ctx.stroke();
      const middle=(start+end)/2;ctx.fillStyle='#ead57a';ctx.textAlign='center';ctx.fillText('φ',cx+(arcRadius+7)*Math.cos(middle),cy+(arcRadius+7)*Math.sin(middle));
    }
    const labels=[];
    list.forEach(([name,z,color])=>{
      const current=name.startsWith('I'),maximum=current?maxI:maxV,magnitude=abs(z);
      const dx=maximum>0?z.re/maximum*radius:0,dy=maximum>0?-z.im/maximum*radius:0;
      const x=cx+dx,y=cy+dy;
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.8;ctx.setLineDash(current?[4,3]:[]);
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);
      if(magnitude>0){
        const direction=Math.atan2(dy,dx),tip=Math.min(6,Math.hypot(dx,dy)*.45);
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-tip*Math.cos(direction-.45),y-tip*Math.sin(direction-.45));ctx.lineTo(x-tip*Math.cos(direction+.45),y-tip*Math.sin(direction+.45));ctx.closePath();
        if(current)ctx.stroke();else ctx.fill();
      }else{ctx.beginPath();ctx.arc(cx,cy,2,0,Math.PI*2);ctx.fill();}
      const textWidth=ctx.measureText(name).width;
      const labelX=Math.max(4,Math.min(w-textWidth-4,x-textWidth/2));
      const baseY=y+(dy>0?font+4:-font-4);
      let labelY=Math.max(font/2+3,Math.min(h-font/2-3,baseY));
      for(const shift of [0,font+4,-font-4,2*(font+4),-2*(font+4)]){
        const candidate=Math.max(font/2+3,Math.min(h-font/2-3,baseY+shift));
        if(labels.every(box=>labelX+textWidth+3<box.x||labelX>box.x+box.width+3||Math.abs(candidate-box.y)>font+2)){labelY=candidate;break;}
      }
      labels.push({name,color,x:labelX,y:labelY,width:textWidth});
    });
    labels.forEach(label=>{
      ctx.fillStyle='#0d1928';ctx.fillRect(label.x-2,label.y-font/2-1,label.width+4,font+2);
      ctx.fillStyle=label.color;ctx.textAlign='left';ctx.fillText(label.name,label.x,label.y);
    });
  }
  function simulate(){cancelWireGesture();clearValidation();hideHover();model.tool='select';const r=solveCircuit();if(!r.ok){model.mode='edit';model.result=null;validationIssue=r;render();return;}model.result=r;model.mode='sim';currentAnimationEpoch=performance.now();model.revision++;render();}
  function stop(){model.mode='edit';model.result=null;model.tool='select';render();}
  $('#simulate-btn').addEventListener('click',simulate);$('#stop-btn').addEventListener('click',stop);
  $('#wire-btn').addEventListener('click',()=>{if(model.mode!=='edit')return;if(model.tool==='wire'){cancelWireGesture();model.tool='select';}else{model.tool='wire';model.wireStart=null;model.wireBefore=null;model.selected=null;model.selectedWire=null;model.selectedJunction=null;model.selectedWirePoint=null;inspector.classList.add('hidden');}render();});
  $('#new-btn').addEventListener('click',newCircuit);
  $('#save-btn').addEventListener('click',saveCircuit);
  $('#open-btn').addEventListener('click',()=>$('#open-file-input').click());
  $('#open-file-input').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)openCircuitFile(file);});
  $('#undo-btn').addEventListener('click',()=>{if(model.mode==='edit'&&historyIndex>0)restoreHistory(historyIndex-1);});
  $('#redo-btn').addEventListener('click',()=>{if(model.mode==='edit'&&historyIndex<history.length-1)restoreHistory(historyIndex+1);});
  $('#zoom-out-btn').addEventListener('click',()=>changeZoom(-.1));$('#zoom-in-btn').addEventListener('click',()=>changeZoom(.1));$('#zoom-level').addEventListener('click',resetView);
  $('#pan-btn').addEventListener('click',()=>{cancelWireGesture();model.tool=model.tool==='pan'?'select':'pan';render();});
  $('#png-btn').addEventListener('click',exportPng);
  workspace.addEventListener('wheel',e=>{
    if(e.target.closest('#inspector,input,textarea,select')||panDrag||e.buttons||!e.deltaY)return;
    e.preventDefault();
    const unit=e.deltaMode===1?16:e.deltaMode===2?workspace.clientHeight:1;
    const delta=Math.max(-160,Math.min(160,e.deltaY*unit)),rect=workspace.getBoundingClientRect();
    setZoom(model.zoom*Math.exp(-delta*.001),{x:e.clientX-rect.left,y:e.clientY-rect.top});
  },{passive:false});
  workspace.addEventListener('pointerdown', e => { if(model.tool!=='pan'||e.target.closest('.component')||e.target.closest('#inspector'))return; panDrag={x:e.clientX,y:e.clientY,px:model.panX,py:model.panY};panMoved=false;workspace.setPointerCapture(e.pointerId); });
  workspace.addEventListener('pointermove', e => { if(!panDrag)return;const dx=e.clientX-panDrag.x,dy=e.clientY-panDrag.y;if(Math.abs(dx)+Math.abs(dy)>2)panMoved=true;model.panX=panDrag.px+dx;model.panY=panDrag.py+dy;setViewport(); });
  workspace.addEventListener('pointerup', () => { panDrag=null; }); workspace.addEventListener('pointercancel',()=>{panDrag=null;});
  workspace.addEventListener('click',e=>{if(panMoved){panMoved=false;return;}if(model.tool==='pan')return;const blank=e.target===workspace||e.target.classList.contains('workspace-grid')||e.target===wiresLayer||e.target===layer;if(!blank)return;if(model.tool==='wire'&&model.wireStart){model.selected=null;model.selectedWire=null;model.selectedJunction=null;model.selectedWirePoint=null;inspector.classList.add('hidden');addFreeJunction(e);return;}if(model.tool==='wire'){cancelWireGesture();model.tool='select';}model.selected=null;model.selectedWire=null;model.selectedJunction=null;model.selectedWirePoint=null;inspector.classList.add('hidden');render();});
  window.addEventListener('keydown',e=>{
    if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(model.mode==='sim'&&(e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey){if(historyIndex<history.length-1)restoreHistory(historyIndex+1);}else if(historyIndex>0)restoreHistory(historyIndex-1);}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();if(historyIndex<history.length-1)restoreHistory(historyIndex+1);}
    else if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat&&e.key.toLowerCase()==='r'&&model.selected){e.preventDefault();rotateComponent();}
    else if(model.mode==='edit'&&(e.key==='Delete'||e.key==='Backspace')&&(model.selected||model.selectedWire||model.selectedJunction)){e.preventDefault();deleteSelectedElement();}
  });
  $('#collapse-analysis').addEventListener('click',()=>{endCardDrag();endCardResize();model.collapsed=!model.collapsed;$('#analysis-area').classList.toggle('collapsed',model.collapsed);$('#collapse-analysis').textContent=model.collapsed?'⌃':'⌄';$('#collapse-analysis').title=model.collapsed?'Mostra les targetes':'Plega les targetes';$('#collapse-analysis').setAttribute('aria-label',model.collapsed?'Mostra les targetes':'Plega les targetes');if(!model.collapsed&&model.result)renderAnalysis();});
  window.addEventListener('resize',()=>{endCardDrag();endCardResize();render();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCurrentAnimation();else if(model.mode==='sim')renderWires();});
  initializeCardMovement();renderPalette(); render();
})();
