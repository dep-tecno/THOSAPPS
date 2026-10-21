import { TYPES, power, formatPower } from './model.mjs';

const $ = id => document.getElementById(id);
let THREE, OrbitControls, renderer, scene, camera, controls, hydro, rotor, generator, magnet, particles, housingParts = [], explodedParts = [];
let mode = 'assembled', paused = false, phase = 0, lastTime = 0, waterTime = 0;
const pitchBlades = [];
const state = { type: 'pelton', head: 300, flow: 1, efficiency: 88, pitch: 30 };
const waveContext = $('wave').getContext('2d');

function update() {
  for (const key of ['head', 'flow', 'efficiency', 'pitch']) state[key] = Number($(key).value);
  $('headValue').textContent = state.head + ' m';
  $('flowValue').textContent = state.flow.toLocaleString('ca-ES') + ' m³/s';
  $('efficiencyValue').textContent = state.efficiency + ' %';
  $('pitchValue').textContent = state.pitch + '°';
  const p = power(state.head, state.flow, state.efficiency);
  for (const key of ['hydraulic', 'shaft', 'electric']) $(key).textContent = formatPower(p[key]);
  for (const blade of pitchBlades) blade.rotation.x = state.pitch * Math.PI / 180;
  $('waveNote').textContent = state.flow === 0
    ? 'Cabal nul: l’eix s’atura i no hi ha tensió induïda en aquest model.'
    : 'Una parella de pols: una volta produeix un cicle. Ona normalitzada i temps alentit; no representa volts ni freqüència de xarxa.';
  drawWave();
}

function selectType() {
  state.type = $('turbine').value;
  const type = TYPES[state.type];
  $('head').max = type.maxHead; $('head').min = state.type === 'kaplan' ? 1 : 10;
  $('head').step = state.type === 'kaplan' ? 1 : 10; $('head').value = type.head;
  $('flow').max = type.maxFlow; $('flow').value = type.flow;
  $('efficiency').value = type.efficiency;
  $('description').textContent = type.description; $('rangeNote').textContent = type.note;
  $('pitch').hidden = $('pitchLabel').hidden = state.type !== 'kaplan';
  if (THREE && scene) buildHydro();
  if (THREE && scene) applyView();
  updateLesson(); update();
}

function updateLesson() {
  const type = TYPES[state.type];
  $('sceneTitle').textContent = 'Turbina ' + type.name + ' · alternador acoblat';
  $('sceneHint').textContent = mode === 'exploded' ? 'Vista d’especejament: components separats' : mode === 'cutaway' ? 'Carcasses transparents: mecanisme interior' : 'Turbina, eix i alternador en una sola instal·lació';
  $('lessonTitle').textContent = 'Com funciona la ' + type.name + '?';
  $('lesson').textContent = type.lesson + ' L’eix transmet el gir al rotor de l’alternador; el camp magnètic variable indueix tensió al bobinatge fix.';
}
function material(color, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, ...options }); }
function mesh(geometry, mat, parent, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, mat); object.position.set(x, y, z); parent.add(object); return object;
}
function tube(points, radius, mat, parent) {
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, radius, 10, false), mat, parent);
}
function clearGroup(group) {
  if (!group) return;
  const materials = new Set();
  group.traverse(object => { object.geometry?.dispose(); if (object.material) materials.add(object.material); });
  materials.forEach(mat => mat.dispose()); scene.remove(group);
}
function cylinder(radius, length, mat, parent, x = 0, y = 0, z = 0) {
  const obj = mesh(new THREE.CylinderGeometry(radius, radius, length, 40), mat, parent, x, y, z);
  obj.rotation.x = Math.PI / 2; return obj;
}

function buildHydro() {
  clearGroup(hydro); pitchBlades.length = 0;
  hydro = new THREE.Group(); scene.add(hydro); hydro.visible = true; housingParts = []; explodedParts = [];
  rotor = new THREE.Group(); hydro.add(rotor);
  const orange = material(0xe98b36), steel = material(0x718c9a), water = material(0x009fc7, { transparent: true, opacity: 0.38, depthWrite: false });
  cylinder(0.13, 3.8, steel, hydro, 0, 0, 0.45);
  cylinder(0.32, 0.5, orange, rotor);
  if (state.type === 'pelton') {
    // Two opposed dished lobes and a central splitter: recognisable Pelton buckets.
    const bronze = material(0xc78b45,{metalness:0.78,roughness:0.27});
    const dark = material(0x465c6b,{metalness:0.65,roughness:0.33});
    const casing = material(0x719ca9,{metalness:0.28,roughness:0.4,transparent:true,opacity:0.25,depthWrite:false,side:THREE.DoubleSide});
    const flange = material(0x526c79,{metalness:0.65});
    cylinder(1.12,0.23,dark,rotor);
    cylinder(0.45,0.44,bronze,rotor);
    for (let i=0;i<18;i++) {
      const angle=i*Math.PI*2/18;
      const bucket=new THREE.Group();
      bucket.position.set(1.32*Math.cos(angle),1.32*Math.sin(angle),0);
      bucket.rotation.z=angle;
      // Lobes use an actual concave surface, not spheres.
      for(const sign of [-1,1]) {
        const vertices=[],indices=[],nu=14,nv=12;
        for(let u=0;u<=nu;u++) for(let v=0;v<=nv;v++) {
          const U=u/nu*2-1,V=v/nv*2-1;
          const x=0.24+U*0.38;
          const z=sign*(0.19+V*0.17);
          const y=0.12-0.23*(1-U*U)*(1-V*V);
          vertices.push(x,y,z);
        }
        for(let u=0;u<nu;u++) for(let v=0;v<nv;v++){
          const k=u*(nv+1)+v;indices.push(k,k+1,k+nv+1,k+1,k+nv+2,k+nv+1);
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geo.setIndex(indices);geo.computeVertexNormals();
        mesh(geo,bronze,bucket).material.side=THREE.DoubleSide;
      }
      const splitter=mesh(new THREE.ConeGeometry(0.11,0.55,4),bronze,bucket,0.25,0.10,0);
      splitter.rotation.z=-Math.PI/2;
      rotor.add(bucket);
    }
    // Casing: annular shroud, front inspection ring and mounting feet.
    const shell=mesh(new THREE.TorusGeometry(1.78,0.32,18,90),casing,hydro);
    housingParts.push(shell);
    const rim=mesh(new THREE.TorusGeometry(1.8,0.045,8,90),flange,hydro,0,0,0.4);
    housingParts.push(rim);
    for(const x of [-1.15,1.15]) mesh(new THREE.BoxGeometry(0.38,0.8,0.55),flange,hydro,x,-2.03,0);
    // Tangential jet entering from the left, at the upper perimeter.
    const nozzle=mesh(new THREE.CylinderGeometry(0.1,0.25,0.72,32),flange,hydro,-2.28,1.36,0);
    nozzle.rotation.z=-Math.PI/2;
    tube([new THREE.Vector3(-3.25,1.36,0),new THREE.Vector3(-2.60,1.36,0)],0.26,flange,hydro);
    tube([new THREE.Vector3(-1.97,1.36,0),new THREE.Vector3(-1.50,1.36,0)],0.075,water,hydro);
    // Alternator sits on the same axis, to the rear (positive z).
    buildCoupledAlternator(hydro,steel);
  } else if (state.type === 'francis') {
    const spiral = [];
    for (let i = 0; i <= 100; i++) { const a = i / 100 * Math.PI * 2; const r = 2.35 - i / 100 * 0.65; spiral.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    spiral.unshift(new THREE.Vector3(3.4, 0, 0)); tube(spiral, 0.26, water, hydro);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI * 2 / 16;
      const vane = mesh(new THREE.BoxGeometry(0.38, 0.08, 0.5), steel, hydro, 1.6 * Math.cos(a), 1.6 * Math.sin(a)); vane.rotation.z = a + 0.65;
    }
    cylinder(1.15, 0.12, orange, rotor, 0, 0, -0.25);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const points = [new THREE.Vector3(Math.cos(a) * 1.22, Math.sin(a) * 1.22, -0.18), new THREE.Vector3(Math.cos(a + 0.35) * 0.82, Math.sin(a + 0.35) * 0.82, 0), new THREE.Vector3(Math.cos(a + 0.65) * 0.42, Math.sin(a + 0.65) * 0.42, 0.38)];
      tube(points, 0.11, orange, rotor);
    }
    cylinder(0.58, 1.8, water, hydro, 0, 0, 1.1);
  } else {
    cylinder(1.85, 2.1, water, hydro);
    for (let i = 0; i < 5; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i / 5 * Math.PI * 2; rotor.add(arm);
      const pivot = new THREE.Group(); pivot.position.x = 0.9; arm.add(pivot);
      const blade = mesh(new THREE.SphereGeometry(1, 24, 12), orange, pivot); blade.scale.set(0.85, 0.27, 0.075);
      pitchBlades.push(pivot);
    }
    cylinder(0.4, 0.8, orange, rotor);
  }
  const positions = new Float32Array(90 * 3);
  particles = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0x007bce, size: 0.075 }));
  particles.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); hydro.add(particles);
}

function buildCoupledAlternator(parent,steel) {
  const stator = new THREE.Group(); stator.position.z=2.75; parent.add(stator);
  const copper=material(0xc87939,{metalness:0.72}), iron=material(0x485c6a,{metalness:0.65});
  const cover=material(0x6d8795,{transparent:true,opacity:0.28,depthWrite:false,side:THREE.DoubleSide});
  const housing=mesh(new THREE.CylinderGeometry(1.12,1.12,1.52,48,1,true),cover,stator);
  housing.rotation.x=Math.PI/2; housingParts.push(housing);
  for(const z of [-0.74,0.74]) {
    const ring=mesh(new THREE.TorusGeometry(1.1,0.08,12,64),iron,stator,0,0,z);
    housingParts.push(ring);
  }
  // Stationary coils around the rotating field.
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6;
    const coil=new THREE.Group();coil.rotation.z=angle;stator.add(coil);
    const core=mesh(new THREE.BoxGeometry(0.23,0.42,0.92),iron,coil,0,0.84,0);
    for(const z of [-0.32,-0.16,0,0.16,0.32]) {
      const winding=mesh(new THREE.TorusGeometry(0.19,0.045,8,18),copper,coil,0,0.84,z);
      winding.rotation.x=Math.PI/2;
    }
  }
  // Shaft passes through both units; rotor turns with the Pelton wheel.
  cylinder(0.15,3.9,steel,rotor,0,0,1.55);
  const armature=new THREE.Group();armature.position.z=2.75;rotor.add(armature);
  cylinder(0.54,1.16,iron,armature);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    const pole=mesh(new THREE.BoxGeometry(0.46,0.32,0.88),material(i%2?0x277ca9:0xb84d43),armature,0.65*Math.cos(a),0.65*Math.sin(a),0);
    pole.rotation.z=a;
  }
  explodedParts.push({object:stator,base:2.75,offset:1.25});
}

function animateWater() {
  if (!particles) return;
  particles.visible = state.flow > 0;
  const a = particles.geometry.attributes.position.array;
  for (let i = 0; i < 90; i++) {
    const t = (i / 90 + waterTime * 0.3) % 1, lane = ((i * 7) % 13) / 13;
    if (state.type === 'pelton') {
      if (t < 0.65) { a[3*i] = -2.3 + t / 0.65 * 2.6; a[3*i+1] = 1.45; a[3*i+2] = (lane - 0.5) * 0.16; }
      else { const u = (t - 0.65) / 0.35; a[3*i] = 0.3 + u; a[3*i+1] = 1.45 - u * 3.6; a[3*i+2] = (lane - 0.5) * u; }
    } else if (state.type === 'francis') {
      const angle = lane * Math.PI * 2 - t * 2;
      const r = t < 0.7 ? 2.05 * (1 - t / 0.7) + 0.3 : 0.3;
      a[3*i] = r * Math.cos(angle); a[3*i+1] = r * Math.sin(angle); a[3*i+2] = t < 0.7 ? 0.1 : (t - 0.7) / 0.3 * 2;
    } else {
      const angle = i * 2.4; const r = 0.65 + lane;
      a[3*i] = r * Math.cos(angle); a[3*i+1] = r * Math.sin(angle); a[3*i+2] = -1.7 + t * 3.4;
    }
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

function drawWave() {
  const ctx = waveContext, w = 600, h = 180;
  ctx.clearRect(0,0,w,h); ctx.lineWidth = 1; ctx.strokeStyle = '#cbdae1';
  ctx.beginPath(); ctx.moveTo(30,90); ctx.lineTo(w-15,90); ctx.moveTo(30,15); ctx.lineTo(30,h-20); ctx.stroke();
  ctx.font = '12px system-ui'; ctx.fillStyle = '#526e7b'; ctx.fillText('+',12,30); ctx.fillText('−',12,155); ctx.fillText('temps →',w-80,h-5);
  // Magnetic flux is proportional to cos(phase), induced voltage to sin(phase).
  ctx.strokeStyle = '#00869b'; ctx.lineWidth = 2.5; ctx.beginPath();
  for(let x=30;x<w-15;x++) { const theta = phase - (w-16-x)/(w-46)*Math.PI*4; const y = 90 - (state.flow > 0 ? 60*Math.sin(theta) : 0); if(x===30)ctx.moveTo(x,y);else ctx.lineTo(x,y); }
  ctx.stroke(); ctx.fillStyle = '#ea8834'; ctx.beginPath(); ctx.arc(w-16,90-(state.flow>0?60*Math.sin(phase):0),4,0,Math.PI*2);ctx.fill();
}

function resetCamera() { camera.position.set(6,4.1,9.5); controls.target.set(0,0,0); controls.update(); }
function tick(time) {
  requestAnimationFrame(tick);
  const dt = lastTime ? Math.min((time-lastTime)/1000,0.05) : 0; lastTime=time;
  if (!paused && !document.hidden && state.flow > 0) {
    const relative = Math.sqrt(state.head/TYPES[state.type].head) * Math.sqrt(state.flow/TYPES[state.type].flow);
    const speed = Math.min(3,relative)*1.3;
    phase = (phase + dt*speed) % (Math.PI*2); waterTime += dt*Math.min(2,relative);
  }
  if (rotor) rotor.rotation.z = -phase;
  
  animateWater(); drawWave(); controls.update(); renderer.render(scene,camera);
}

for (const key of ['head','flow','efficiency','pitch']) $(key).addEventListener('input',update);
$('turbine').addEventListener('change',selectType);
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Continua':'Pausa';$('pause').setAttribute('aria-pressed',String(paused));});
$('reset').addEventListener('click',()=>{paused=false;phase=0;waterTime=0;$('pause').textContent='Pausa';$('pause').setAttribute('aria-pressed','false');$('pitch').value=30;selectType();if(controls)resetCamera();});
$('help').addEventListener('click',()=>{$('guide').hidden=!$('guide').hidden;$('help').setAttribute('aria-expanded',String(!$('guide').hidden));});
for(const [id,value] of [['assembledView','assembled'],['cutawayView','cutaway'],['explodedView','exploded']]) {
  $(id).addEventListener('click',()=>{
    mode=value;
    for(const [button,view] of [['assembledView','assembled'],['cutawayView','cutaway'],['explodedView','exploded']])
      $(button).setAttribute('aria-pressed',String(mode===view));
    applyView();updateLesson();
  });
}
function applyView(){
  for(const part of housingParts) {
    if(part.material.transparent) part.material.opacity=mode==='assembled'?0.6:0.13;
  }
  for(const part of explodedParts) part.object.position.z=part.base+(mode==='exploded'?part.offset:0);
}

$('cameraReset').addEventListener('click',()=>{if(controls)resetCamera();});
selectType();
try {
  THREE = await import('three'); ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  scene = new THREE.Scene(); scene.background = new THREE.Color(0xdfeaf0);
  camera = new THREE.PerspectiveCamera(42,1,0.1,100);
  renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.domElement.setAttribute('aria-label','Model 3D de turbina i alternador acoblats');
  $('scene').appendChild(renderer.domElement);
  controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=24;
  scene.add(new THREE.HemisphereLight(0xffffff,0x61737c,2.3));
  const light = new THREE.DirectionalLight(0xffffff,3);light.position.set(4,6,8);scene.add(light);
  const floor = mesh(new THREE.BoxGeometry(10,0.12,7),material(0xb7cbd3),scene,0,-2.65,0);
  floor.material.roughness=1;
  buildHydro();update();resetCamera();
  new ResizeObserver(()=>{const w=$('scene').clientWidth,h=$('scene').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe($('scene'));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){paused=true;$('pause').textContent='Continua';$('pause').setAttribute('aria-pressed','true');}
  $('loading').hidden=true;requestAnimationFrame(tick);
} catch(error) {
  console.error('THOSHYDRO: no s’ha pogut iniciar la vista 3D',error);
  $('loading').textContent='No s’ha pogut iniciar la vista 3D. Comprova la connexió a Internet i el suport WebGL del navegador. Els controls i els càlculs continuen disponibles.';
}
