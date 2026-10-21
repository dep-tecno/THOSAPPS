import { TYPES, power, formatPower } from './model.mjs';

const $ = id => document.getElementById(id);
let THREE, OrbitControls, renderer, scene, camera, controls, hydro, rotor, generator, magnet, particles;
let mode = 'hydro', paused = false, phase = 0, lastTime = 0, waterTime = 0;
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
  updateLesson(); update();
}

function updateLesson() {
  const type = TYPES[state.type];
  $('sceneTitle').textContent = mode === 'hydro' ? 'Turbina ' + type.name : 'Alternador · Imant i bobina';
  $('sceneHint').textContent = mode === 'hydro' ? 'Blau: aigua · Taronja: element giratori' : 'Vermell: nord · Blau: sud · Coure: bobina fixa';
  $('lessonTitle').textContent = mode === 'hydro' ? 'Com funciona la ' + type.name + '?' : 'Per què es genera corrent altern?';
  $('lesson').textContent = mode === 'hydro' ? type.lesson : 'L’eix de la turbina fa girar l’imant. El flux magnètic que travessa la bobina fixa varia i s’hi indueix una tensió alterna. La polaritat s’inverteix cada mitja volta. El circuit i la càrrega no es representen: la potència elèctrica és una estimació amb un rendiment fix del 90 %.';
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
  hydro = new THREE.Group(); scene.add(hydro); hydro.visible = mode === 'hydro';
  rotor = new THREE.Group(); hydro.add(rotor);
  const orange = material(0xe98b36), steel = material(0x718c9a), water = material(0x009fc7, { transparent: true, opacity: 0.38, depthWrite: false });
  cylinder(0.13, 3.8, steel, hydro, 0, 0, 0.45);
  cylinder(0.32, 0.5, orange, rotor);
  if (state.type === 'pelton') {
    cylinder(1.35, 0.16, steel, rotor);
    for (let i = 0; i < 18; i++) {
      const bucket = new THREE.Group(), a = i * Math.PI * 2 / 18;
      bucket.position.set(1.55 * Math.cos(a), 1.55 * Math.sin(a), 0); bucket.rotation.z = a;
      for (const z of [-0.19, 0.19]) {
        const cup = mesh(new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), orange, bucket, 0, 0, z);
        cup.scale.set(1.15, 0.7, 1); cup.rotation.x = Math.PI;
      }
      rotor.add(bucket);
    }
    const nozzle = cylinder(0.18, 0.7, steel, hydro, -2.6, 1.45, 0); nozzle.rotation.set(0, 0, Math.PI / 2);
    tube([new THREE.Vector3(-2.25, 1.45, 0), new THREE.Vector3(-1, 1.45, 0), new THREE.Vector3(0.45, 1.3, 0), new THREE.Vector3(1.4, -2, 0)], 0.1, water, hydro);
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

function buildGenerator() {
  generator = new THREE.Group(); scene.add(generator); generator.visible = false;
  const copper = material(0xc77635), steel = material(0x718c9a);
  // The fixed rectangular winding lies in the x-z plane; its normal is y.
  for (let i = 0; i < 9; i++) {
    const y = (i - 4) * 0.045;
    const pts = [[-2,y,-0.8],[2,y,-0.8],[2,y,0.8],[-2,y,0.8],[-2,y,-0.8]].map(p => new THREE.Vector3(...p));
    tube(pts, 0.045, copper, generator);
  }
  cylinder(0.12, 4, steel, generator);
  magnet = new THREE.Group(); generator.add(magnet);
  mesh(new THREE.BoxGeometry(0.58, 0.85, 0.52), material(0xe35f52), magnet, 0, 0.425, 0);
  mesh(new THREE.BoxGeometry(0.58, 0.85, 0.52), material(0x258ac2), magnet, 0, -0.425, 0);
  // Illustrative field lines, fixed to the rotating magnet.
  for (const x of [-0.75, 0.75]) {
    tube([new THREE.Vector3(0,0.9,0),new THREE.Vector3(x,0.65,0),new THREE.Vector3(x,-0.65,0),new THREE.Vector3(0,-0.9,0)],0.018,material(0x7f9c8d),magnet);
  }
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

function resetCamera() { camera.position.set(5,3.2,6.5); controls.target.set(0,0,0); controls.update(); }
function tick(time) {
  requestAnimationFrame(tick);
  const dt = lastTime ? Math.min((time-lastTime)/1000,0.05) : 0; lastTime=time;
  if (!paused && !document.hidden && state.flow > 0) {
    const relative = Math.sqrt(state.head/TYPES[state.type].head) * Math.sqrt(state.flow/TYPES[state.type].flow);
    const speed = Math.min(3,relative)*1.3;
    phase = (phase + dt*speed) % (Math.PI*2); waterTime += dt*Math.min(2,relative);
  }
  if (rotor) rotor.rotation.z = -phase;
  if (magnet) magnet.rotation.z = -phase;
  animateWater(); drawWave(); controls.update(); renderer.render(scene,camera);
}

for (const key of ['head','flow','efficiency','pitch']) $(key).addEventListener('input',update);
$('turbine').addEventListener('change',selectType);
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Continua':'Pausa';$('pause').setAttribute('aria-pressed',String(paused));});
$('reset').addEventListener('click',()=>{paused=false;phase=0;waterTime=0;$('pause').textContent='Pausa';$('pause').setAttribute('aria-pressed','false');$('pitch').value=30;selectType();if(controls)resetCamera();});
$('help').addEventListener('click',()=>{$('guide').hidden=!$('guide').hidden;$('help').setAttribute('aria-expanded',String(!$('guide').hidden));});
for(const [id,value] of [['hydroView','hydro'],['generatorView','generator']]) $(id).addEventListener('click',()=>{mode=value;if(hydro)hydro.visible=mode==='hydro';if(generator)generator.visible=mode==='generator';$('hydroView').setAttribute('aria-pressed',String(mode==='hydro'));$('generatorView').setAttribute('aria-pressed',String(mode==='generator'));updateLesson();if(controls)resetCamera();});
$('cameraReset').addEventListener('click',()=>{if(controls)resetCamera();});
selectType();
try {
  THREE = await import('three'); ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
  scene = new THREE.Scene(); scene.background = new THREE.Color(0xdfeaf0);
  camera = new THREE.PerspectiveCamera(42,1,0.1,100);
  renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.domElement.setAttribute('aria-label','Model 3D interactiu de la turbina o de l’alternador');
  $('scene').appendChild(renderer.domElement);
  controls = new OrbitControls(camera,renderer.domElement); controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=18;
  scene.add(new THREE.HemisphereLight(0xffffff,0x61737c,2.3));
  const light = new THREE.DirectionalLight(0xffffff,3);light.position.set(4,6,8);scene.add(light);
  const floor = mesh(new THREE.BoxGeometry(8,0.12,6),material(0xb7cbd3),scene,0,-2.65,0);
  floor.material.roughness=1;
  buildHydro();buildGenerator();update();resetCamera();
  new ResizeObserver(()=>{const w=$('scene').clientWidth,h=$('scene').clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe($('scene'));
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){paused=true;$('pause').textContent='Continua';$('pause').setAttribute('aria-pressed','true');}
  $('loading').hidden=true;requestAnimationFrame(tick);
} catch(error) {
  console.error('THOSHYDRO: no s’ha pogut iniciar la vista 3D',error);
  $('loading').textContent='No s’ha pogut iniciar la vista 3D. Comprova la connexió a Internet i el suport WebGL del navegador. Els controls i els càlculs continuen disponibles.';
}
