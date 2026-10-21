import { TYPES, power, formatPower, peltonPhysics } from './model.mjs';

const $ = id => document.getElementById(id);
let THREE, OrbitControls, renderer, scene, camera, controls, hydro, rotor, generator, magnet, particles, housingParts = [], explodedParts = [];
let mode = 'assembled', paused = false, phase = 0, lastTime = 0, waterTime = 0;
const pitchBlades = [];
const state = { type: 'pelton', head: 300, flow: 1, efficiency: 88, pitch: 30, needle: 100 };
const waveContext = $('wave').getContext('2d');

function update() {
  for (const key of ['head', 'flow', 'efficiency', 'pitch']) state[key] = Number($(key).value);
  $('headValue').textContent = state.head + ' m';
  $('flowValue').textContent = state.flow.toLocaleString('ca-ES') + ' m³/s';
  $('efficiencyValue').textContent = state.efficiency + ' %';
  $('pitchValue').textContent = state.pitch + '°';
  state.needle = Number($('needle').value);
  $('needleValue').textContent = state.needle + ' %';
  const actualFlow = state.type === 'pelton' ? state.flow * state.needle / 100 : state.flow;
  const p = power(state.head, actualFlow, state.efficiency);
  const physics = peltonPhysics(state.head, actualFlow, state.efficiency);
  $('jetSpeed').textContent = physics.jetSpeed.toLocaleString('ca-ES',{maximumFractionDigits:1}) + ' m/s';
  $('peltonRpm').textContent = physics.rpm.toLocaleString('ca-ES',{maximumFractionDigits:0}) + ' rpm';
  $('peltonTorque').textContent = physics.torque.toLocaleString('ca-ES',{maximumFractionDigits:0}) + ' N·m';
  for (const key of ['hydraulic', 'shaft', 'electric']) $(key).textContent = formatPower(p[key]);
  for (const blade of pitchBlades) blade.rotation.x = state.pitch * Math.PI / 180;
  $('waveNote').textContent = actualFlow === 0
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
  $('peltonControls').hidden = $('peltonMetrics').hidden = state.type !== 'pelton';
  if (THREE && scene) buildHydro();
  if (THREE && scene) applyView();
  updateLesson(); update();
}

function updateLesson() {
  const type = TYPES[state.type];
  $('sceneTitle').textContent = 'Turbina ' + type.name + (state.type === 'pelton' ? ' · alternador acoblat' : ' · model didàctic');
  $('sceneHint').textContent = (state.type === 'pelton' ? 'Eix horitzontal' : 'Eix vertical') + ' · ' + (mode === 'exploded' ? 'components separats' : mode === 'cutaway' ? 'mecanisme interior' : 'vista completa');
  $('lessonTitle').textContent = 'Com funciona la ' + type.name + '?';
  $('lesson').textContent = type.lesson + (state.type === 'pelton' ? ' L’eix transmet el gir al rotor de l’alternador; el camp magnètic variable indueix tensió al bobinatge fix.' : ' En aquesta vista, l’eix és vertical i la sortida axial dirigeix l’aigua cap avall. La integració mecànica de l’alternador està desenvolupada actualment per a la Pelton.');
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

// Engineering details are separate fixed assemblies; the runner and alternator rotor
// remain children of the same rotating group.
function boltCircle(parent,radius,z,count,mat,boltRadius=0.055) {
  for(let i=0;i<count;i++){
    const a=i*2*Math.PI/count;
    const head=mesh(new THREE.CylinderGeometry(boltRadius,boltRadius,0.055,6),mat,parent,radius*Math.cos(a),radius*Math.sin(a),z);
    head.rotation.x=Math.PI/2;
  }
}
function bearingAssembly(parent,z,metal,dark) {
  const support=mesh(new THREE.BoxGeometry(0.66,0.88,0.8),metal,parent,0,-0.65,z);
  const ring=mesh(new THREE.TorusGeometry(0.31,0.11,14,48),dark,parent,0,0,z+0.42);
  const cap=mesh(new THREE.TorusGeometry(0.29,0.045,12,48),metal,parent,0,0,z-0.42);
  for(const x of [-0.23,0.23]) {
    mesh(new THREE.CylinderGeometry(0.055,0.055,0.12,8),dark,parent,x,-1.09,z);
  }

}
function engineeringPelton(parent,runner,steel,flange,bronze) {
  const fastener=material(0x303f4a,{metalness:0.88,roughness:0.23});
  const pipe=material(0x23618a,{metalness:0.55,roughness:0.3});
  const gasket=material(0x9c5037,{metalness:0.3});
  // Exposed casing flanges, bolt circles and inspection window.
  for(const z of [-0.46,0.46]){
    const ring=mesh(new THREE.TorusGeometry(1.85,0.11,12,80),flange,parent,0,0,z);
    housingParts.push(ring);
    boltCircle(parent,1.85,z+(z>0?0.10:-0.10),24,fastener);
  }
  const cover=mesh(new THREE.RingGeometry(1.52,1.82,72,1,0,Math.PI*1.22),material(0x386d91,{metalness:0.5,side:THREE.DoubleSide,transparent:true,opacity:0.65,depthWrite:false}),parent,0,0,0.48);
  housingParts.push(cover);
  // Hub cover and fasteners turn with the wheel.
  cylinder(0.34,0.55,steel,runner,0,0,-0.1);
  boltCircle(runner,0.28,0.31,8,fastener,0.035);
  // Pressure pipe, nozzle adjustment spindle and hand wheel.
  const inlet=mesh(new THREE.CylinderGeometry(0.32,0.32,1.4,40),pipe,parent,-3.45,1.36,0);
  inlet.rotation.z=Math.PI/2;
  for(const x of [-4.08,-2.82]){
    const collar=mesh(new THREE.CylinderGeometry(0.41,0.41,0.12,40),flange,parent,x,1.36,0);
    collar.rotation.z=Math.PI/2;
  }
  const actuator=mesh(new THREE.BoxGeometry(0.44,0.65,0.52),flange,parent,-2.48,2.13,0);
  const stem=mesh(new THREE.CylinderGeometry(0.065,0.065,0.55,16),steel,parent,-2.48,2.65,0);
  mesh(new THREE.TorusGeometry(0.31,0.035,10,32),pipe,parent,-2.48,2.95,0).rotation.x=Math.PI/2;
  // Two bearing pedestals make the common shaft mechanically legible.
  bearingAssembly(parent,0.88,steel,fastener);
  bearingAssembly(parent,1.70,steel,fastener);
  // Outlet and structural base with anchor bolts.
  mesh(new THREE.BoxGeometry(4.0,0.24,2.1),flange,parent,0,-2.34,0.15);
  for(const x of [-1.6,1.6])for(const z of [-0.65,0.95]){
    mesh(new THREE.CylinderGeometry(0.095,0.095,0.16,8),fastener,parent,x,-2.17,z);
  }
  mesh(new THREE.BoxGeometry(1.1,0.2,1.4),gasket,parent,0,-2.48,0.2);
}

function buildHydro() {
  clearGroup(hydro); pitchBlades.length = 0;
  hydro = new THREE.Group(); scene.add(hydro); hydro.visible = true; housingParts = []; explodedParts = [];
  // Pelton: horizontal shaft (local Z). Francis/Kaplan: vertical shaft.
  // Rotating the entire hydraulic assembly preserves runner/water alignment.
  if (state.type !== 'pelton') { hydro.rotation.x = Math.PI / 2; hydro.position.y = 0.6; }
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
    // Pelton runner: eighteen double-cup buckets with sculpted concave surfaces,
    // raised lips and a central water splitter. All components rotate together.
    for (let i=0;i<18;i++) {
      const angle=i*Math.PI*2/18;
      const bucket=new THREE.Group();
      bucket.position.set(1.31*Math.cos(angle),1.31*Math.sin(angle),0);
      bucket.rotation.z=angle;
      rotor.add(bucket);
      mesh(new THREE.BoxGeometry(0.50,0.19,0.40),bronze,bucket,-0.12,0,0);
      for(const sign of [-1,1]) {
        const vertices=[],indices=[],nu=24,nv=20;
        for(let u=0;u<=nu;u++)for(let v=0;v<=nv;v++){
          const U=2*u/nu-1,V=2*v/nv-1;
          const radial=0.21+0.43*U;
          const axial=sign*(0.23+0.20*V);
          const depth=0.28*(1-U*U)*(1-V*V);
          const tangent=0.08+0.13*U*U+0.08*V*V-depth;
          vertices.push(radial,tangent,axial);
        }
        for(let u=0;u<nu;u++)for(let v=0;v<nv;v++){
          const k=u*(nv+1)+v;
          indices.push(k,k+1,k+nv+1,k+1,k+nv+2,k+nv+1);
        }
        const geo=new THREE.BufferGeometry();
        geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
        geo.setIndex(indices);geo.computeVertexNormals();
        const cup=mesh(geo,bronze,bucket);
        cup.material.side=THREE.DoubleSide;
        // The visible thick rolled edge distinguishes the cup from a flat plate.
        const lip=[];
        for(let j=0;j<=24;j++){
          const U=-1+2*j/24;
          lip.push(new THREE.Vector3(0.21+0.43*U,0.21+0.13*U*U,sign*0.43));
        }
        tube(lip,0.027,bronze,bucket);
        const outer=[];
        for(let j=0;j<=20;j++){
          const V=-1+2*j/20;
          outer.push(new THREE.Vector3(0.64,0.21+0.08*V*V,sign*(0.23+0.20*V)));
        }
        tube(outer,0.025,bronze,bucket);
      }
      const splitter=mesh(new THREE.ConeGeometry(0.115,0.68,4),bronze,bucket,0.24,0.13,0);
      splitter.rotation.z=-Math.PI/2;
      boltCircle(bucket,0.14,0.25,4,dark,0.022);
    }
    // True sector-cut turbine housing: curved metal wall and annular end plates.
    // The missing front-right sector exposes the runner instead of hiding it.
    const casingMetal=material(0x386b88,{metalness:0.58,roughness:0.32,side:THREE.DoubleSide,transparent:true,opacity:0.95,depthWrite:false});
    const shell=mesh(new THREE.CylinderGeometry(1.92,1.92,0.98,96,1,true,Math.PI*0.32,Math.PI*1.48),casingMetal,hydro);
    shell.rotation.x=Math.PI/2;housingParts.push(shell);
    for(const z of [-0.50,0.50]){
      const face=mesh(new THREE.RingGeometry(1.55,1.94,96,1,Math.PI*0.32,Math.PI*1.48),casingMetal,hydro,0,0,z);
      housingParts.push(face);
      const rim=mesh(new THREE.TorusGeometry(1.91,0.06,12,96,Math.PI*1.48),flange,hydro,0,0,z);
      rim.rotation.z=Math.PI*0.32;housingParts.push(rim);
    }
    for(const x of [-1.15,1.15]) mesh(new THREE.BoxGeometry(0.38,0.8,0.55),flange,hydro,x,-2.03,0);
    // Tangential jet entering from the left, at the upper perimeter.
    const nozzle=mesh(new THREE.CylinderGeometry(0.1,0.25,0.72,32),flange,hydro,-2.28,1.36,0);
    nozzle.rotation.z=-Math.PI/2;
    tube([new THREE.Vector3(-3.25,1.36,0),new THREE.Vector3(-2.60,1.36,0)],0.26,flange,hydro);
    tube([new THREE.Vector3(-1.97,1.36,0),new THREE.Vector3(-1.50,1.36,0)],0.075,water,hydro);
    // Alternator sits on the same axis, to the rear (positive z).
    engineeringPelton(hydro,rotor,steel,flange,bronze);
    buildCoupledAlternator(hydro,steel);
  } else if (state.type === 'francis') {
    // Radial admission: volute, guide vanes, radial runner, axial draft tube.
    const shell=material(0x467f9e,{metalness:0.3,roughness:0.42,transparent:true,opacity:0.45,depthWrite:false,side:THREE.DoubleSide});
    const cast=material(0x566b79,{metalness:0.65,roughness:0.32});
    const spiral=[];
    for(let i=0;i<=128;i++){
      const t=i/128,a=t*Math.PI*2.05,r=2.23-0.56*t;
      spiral.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,-0.12));
    }
    tube(spiral,0.29,shell,hydro);
    tube([new THREE.Vector3(3.25,0,-0.12),new THREE.Vector3(2.2,0,-0.12)],0.29,shell,hydro);
    for(let i=0;i<18;i++){
      const a=i*2*Math.PI/18;
      const vane=mesh(new THREE.BoxGeometry(0.53,0.085,0.65),cast,hydro,1.42*Math.cos(a),1.42*Math.sin(a),0);
      vane.rotation.z=a+0.55;
    }
    cylinder(1.14,0.18,orange,rotor,0,0,-0.3);
    cylinder(0.50,0.75,orange,rotor);
    for(let i=0;i<13;i++){
      const a=i*2*Math.PI/13,curve=[];
      for(let j=0;j<=12;j++){
        const t=j/12,ang=a+0.58*t,r=1.18-0.67*t;
        curve.push(new THREE.Vector3(r*Math.cos(ang),r*Math.sin(ang),-0.28+0.68*t));
      }
      tube(curve,0.115,orange,rotor);
    }
    const draft=mesh(new THREE.CylinderGeometry(0.58,0.91,1.75,48,1,true),shell,hydro,0,0,1.35);
    draft.rotation.x=Math.PI/2;housingParts.push(draft);
    const inlet=mesh(new THREE.TorusGeometry(1.63,0.06,10,72),cast,hydro,0,0,-0.36);
    housingParts.push(inlet);
    // Francis-specific stationary structure: stay ring, wicket-gate pivots and
    // removable inspection covers. All coordinates are local to the vertical axis.
    const bolt=material(0x303e49,{metalness:0.82,roughness:0.25});
    const copper=material(0xb97638,{metalness:0.7,roughness:0.27});
    const magnetSteel=material(0x3d5363,{metalness:0.7,roughness:0.3});
    for(const z of [-0.48,0.50]){
      const rim=mesh(new THREE.TorusGeometry(1.84,0.095,14,80),cast,hydro,0,0,z);
      housingParts.push(rim);
      boltCircle(hydro,1.84,z+(z>0?0.09:-0.09),24,bolt,0.046);
    }
    // Annular scroll-casing wall, shown as a sectional transparent envelope.
    const casing=mesh(new THREE.CylinderGeometry(1.90,1.90,1.0,80,1,true),shell,hydro);
    casing.rotation.x=Math.PI/2;housingParts.push(casing);
    for(let i=0;i<18;i++){
      const a=i*2*Math.PI/18;
      const pin=mesh(new THREE.CylinderGeometry(0.075,0.075,0.88,12),bolt,hydro,1.42*Math.cos(a),1.42*Math.sin(a),0);
      pin.rotation.x=Math.PI/2;
      mesh(new THREE.SphereGeometry(0.095,10,8),cast,hydro,1.42*Math.cos(a),1.42*Math.sin(a),-0.49);
    }
    // Continuous vertical shaft, mechanical coupling and bearing housings.
    cylinder(0.17,4.6,cast,rotor,0,0,-1.65);
    for(const z of [-1.12,-1.77]){
      const pedestal=mesh(new THREE.BoxGeometry(0.84,0.72,0.48),cast,hydro,0,-0.54,z);
      const bearing=mesh(new THREE.TorusGeometry(0.32,0.10,12,40),magnetSteel,hydro,0,0,z);
      boltCircle(hydro,0.42,z-0.22,8,bolt,0.038);
    }
    cylinder(0.30,0.38,magnetSteel,rotor,0,0,-1.94);
    for(const z of [-2.08,-1.81])boltCircle(rotor,0.24,z,8,bolt,0.032);
    // Coupled alternator: rotating magnetic poles inside fixed laminated stator.
    const stator=new THREE.Group();stator.position.z=-3.0;hydro.add(stator);
    const generatorShell=mesh(new THREE.CylinderGeometry(1.07,1.07,1.28,64,1,true),shell,stator);
    generatorShell.rotation.x=Math.PI/2;housingParts.push(generatorShell);
    for(const z of [-0.64,0.64]){
      const ring=mesh(new THREE.TorusGeometry(1.07,0.10,12,64),magnetSteel,stator,0,0,z);
      housingParts.push(ring);
      boltCircle(stator,1.07,z,16,bolt,0.038);
    }
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      const core=new THREE.Group();core.rotation.z=a;stator.add(core);
      mesh(new THREE.BoxGeometry(0.25,0.35,0.85),magnetSteel,core,0,0.82,0);
      for(const z of [-0.28,-0.10,0.10,0.28]){
        const winding=mesh(new THREE.TorusGeometry(0.18,0.042,8,20),copper,core,0,0.82,z);
        winding.rotation.x=Math.PI/2;
      }
    }
    const field=new THREE.Group();field.position.z=-3.0;rotor.add(field);
    cylinder(0.52,1.05,magnetSteel,field);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2;
      const pole=mesh(new THREE.BoxGeometry(0.42,0.30,0.88),material(i%2?0x2d80a6:0xb65044),field,0.64*Math.cos(a),0.64*Math.sin(a));
      pole.rotation.z=a;
    }
    // Generator support platform and structural anchors.
    mesh(new THREE.BoxGeometry(2.8,2.4,0.18),cast,hydro,0,0,-3.78);
    for(const x of [-1.12,1.12])for(const y of [-0.88,0.88]){
      mesh(new THREE.CylinderGeometry(0.075,0.075,0.14,8),bolt,hydro,x,y,-3.66);
    }
    explodedParts.push({object:stator,base:-3.0,offset:-1.05});

  } else {
    // Kaplan: axial flow through a transparent conduit and pitch-adjustable runner.
    const shell=material(0x4987a5,{transparent:true,opacity:0.34,depthWrite:false,side:THREE.DoubleSide,metalness:0.24});
    const cast=material(0x506c7c,{metalness:0.58});
    const conduit=mesh(new THREE.CylinderGeometry(1.73,1.73,3.55,64,1,true),shell,hydro);
    conduit.rotation.x=Math.PI/2;housingParts.push(conduit);
    for(const z of [-1.7,1.7]){
      const flange=mesh(new THREE.TorusGeometry(1.73,0.10,12,64),cast,hydro,0,0,z);
      housingParts.push(flange);
    }
    for(let i=0;i<10;i++){
      const a=i*2*Math.PI/10;
      const guide=mesh(new THREE.BoxGeometry(0.55,0.09,0.72),cast,hydro,1.30*Math.cos(a),1.30*Math.sin(a),-0.95);
      guide.rotation.z=a+0.35;
    }
    for(let i=0;i<5;i++){
      const arm=new THREE.Group();arm.rotation.z=i*2*Math.PI/5;rotor.add(arm);
      const pivot=new THREE.Group();pivot.position.x=0.84;arm.add(pivot);
      const blade=mesh(new THREE.SphereGeometry(1,32,20),orange,pivot);
      blade.scale.set(0.88,0.35,0.09);
      pitchBlades.push(pivot);
    }
    cylinder(0.43,0.95,orange,rotor);
    cylinder(0.17,3.2,cast,rotor,0,0,-1.1);
  }
  const positions = new Float32Array((state.type === 'francis' ? 480 : 90) * 3);
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
  boltCircle(stator,1.1,0.83,16,iron,0.045);
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
  const activeFlow = state.type === 'pelton' ? state.flow*state.needle/100 : state.flow;
  particles.visible = activeFlow > 0;
  particles.material.size = state.type === 'francis' ? 0.065 : state.type === 'pelton' ? 0.03 + 0.055*Math.sqrt(state.needle/100) : 0.075;
  const a = particles.geometry.attributes.position.array;
  const count = a.length / 3;
  for (let i=0; i<count; i++) {
    const lane = ((i*37)%101)/101;
    const strand = ((i*17)%89)/89;
    const t = (i/count + waterTime*(state.type==='francis'?0.22:0.3))%1;
    let x,y,z;
    if (state.type==='pelton') {
      if(t<0.65){x=-2.3+t/0.65*2.6;y=1.45;z=(lane-0.5)*0.16;}
      else {const u=(t-0.65)/0.35;x=0.3+u;y=1.45-u*3.6;z=(lane-0.5)*u;}
    } else if(state.type==='francis') {
      // Local XY = radial plane, local +Z = downward draft tube.
      // 0–32%: spiral casing; 32–70%: distributor/runner;
      // 70–100%: axial discharge, with decaying swirl.
      if(t<0.32){
        const u=t/0.32;
        const angle=2*Math.PI*(u*0.94)+strand*0.10;
        const radius=2.24-0.54*u+(lane-0.5)*0.24;
        x=radius*Math.cos(angle);
        y=radius*Math.sin(angle);
        z=-0.12+(strand-0.5)*0.32;
      } else if(t<0.70){
        const u=(t-0.32)/0.38;
        const angle=2*Math.PI*(0.94+strand*0.10)+u*1.0;
        const radius=1.70-1.20*u+(lane-0.5)*0.12;
        x=radius*Math.cos(angle);
        y=radius*Math.sin(angle);
        z=-0.16+0.52*u;
      } else {
        const u=(t-0.70)/0.30;
        const angle=2*Math.PI*(0.94+strand*0.10)+1.0+0.35*u;
        const radius=0.18+0.50*lane+0.18*u;
        x=radius*Math.cos(angle);
        y=radius*Math.sin(angle);
        z=0.36+1.83*u;
      }
    } else {
      const angle=i*2.4, radius=0.65+lane;
      x=radius*Math.cos(angle);y=radius*Math.sin(angle);z=-1.7+t*3.4;
    }
    a[3*i]=x;a[3*i+1]=y;a[3*i+2]=z;
  }
  particles.geometry.attributes.position.needsUpdate=true;
}

function drawWave() {
  const ctx = waveContext, w = 600, h = 180;
  ctx.clearRect(0,0,w,h); ctx.lineWidth = 1; ctx.strokeStyle = '#cbdae1';
  ctx.beginPath(); ctx.moveTo(30,90); ctx.lineTo(w-15,90); ctx.moveTo(30,15); ctx.lineTo(30,h-20); ctx.stroke();
  ctx.font = '12px system-ui'; ctx.fillStyle = '#526e7b'; ctx.fillText('+',12,30); ctx.fillText('−',12,155); ctx.fillText('temps →',w-80,h-5);
  // Magnetic flux is proportional to cos(phase), induced voltage to sin(phase).
  ctx.strokeStyle = '#00869b'; ctx.lineWidth = 2.5; ctx.beginPath();
  for(let x=30;x<w-15;x++) { const theta = phase - (w-16-x)/(w-46)*Math.PI*4; const y = 90 - ((state.flow > 0 && (state.type !== 'pelton' || state.needle > 0)) ? 60*Math.sin(theta) : 0); if(x===30)ctx.moveTo(x,y);else ctx.lineTo(x,y); }
  ctx.stroke(); ctx.fillStyle = '#ea8834'; ctx.beginPath(); ctx.arc(w-16,90-((state.flow>0 && (state.type !== 'pelton' || state.needle > 0))?60*Math.sin(phase):0),4,0,Math.PI*2);ctx.fill();
}

function resetCamera() { camera.position.set(6,4.1,9.5); controls.target.set(0,0,0); controls.update(); }
function tick(time) {
  requestAnimationFrame(tick);
  const dt = lastTime ? Math.min((time-lastTime)/1000,0.05) : 0; lastTime=time;
  if (!paused && !document.hidden && state.flow > 0 && (state.type !== 'pelton' || state.needle > 0)) {
    const relative = Math.sqrt(state.head/TYPES[state.type].head) * Math.sqrt(state.flow/TYPES[state.type].flow);
    // Animation is deliberately slowed down; Pelton angular speed follows jet speed.
    const pelton = peltonPhysics(state.head,state.flow*state.needle/100,state.efficiency);
    const speed = state.type === 'pelton' ? pelton.rpm/60*2*Math.PI*0.035 : Math.min(3,relative)*1.3;
    phase = (phase + dt*speed) % (Math.PI*2); waterTime += dt*Math.min(2,relative);
  }
  if (rotor) rotor.rotation.z = -phase;
  
  animateWater(); drawWave(); controls.update(); renderer.render(scene,camera);
}

for (const key of ['head','flow','efficiency','pitch','needle']) $(key).addEventListener('input',update);
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
    if(part.material.transparent) part.material.opacity=mode==='assembled'?0.93:0.16;
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
