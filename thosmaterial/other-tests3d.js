import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const host=document.getElementById('scene3d');
if(!host)throw Error('Falta el contenidor de la simulació 3D');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x17384a);
const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(5,3.3,7.8);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.minDistance=3.3;orbit.maxDistance=13;orbit.target.set(0,0,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x446579,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,7,6);scene.add(light);
const specimen=new THREE.MeshStandardMaterial({color:0x54c7d6,metalness:.65,roughness:.32,side:THREE.DoubleSide});
const hardware=new THREE.MeshStandardMaterial({color:0x8ca4b1,metalness:.75,roughness:.32});
const accent=new THREE.MeshStandardMaterial({color:0xf3ae5a,metalness:.3,roughness:.4});
const dark=new THREE.MeshStandardMaterial({color:0x344f60,metalness:.65,roughness:.4});
const stripe=new THREE.MeshStandardMaterial({color:0xe2f7fb,metalness:.25,roughness:.55});
const group=new THREE.Group();scene.add(group);
function add(geometry,material,x=0,y=0,z=0,parent=group){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
function box(w,h,d,mat,x=0,y=0,z=0){return add(new THREE.BoxGeometry(w,h,d),mat,x,y,z)}
function cyl(rt,rb,h,mat,x=0,y=0,z=0){return add(new THREE.CylinderGeometry(rt,rb,h,40),mat,x,y,z)}
function sphere(r,mat,x=0,y=0,z=0){return add(new THREE.SphereGeometry(r,24,16),mat,x,y,z)}
function rod(a,b,r,mat){const d=new THREE.Vector3().subVectors(b,a),mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5);const mesh=add(new THREE.CylinderGeometry(r,r,d.length(),18),mat,mid.x,mid.y,mid.z);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh}
function clear(){group.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material?.isLineDashedMaterial)o.material.dispose()});group.clear()}
function grid(){const g=new THREE.GridHelper(7,14,0x3c687b,0x2c5366);g.position.y=-1.7;group.add(g)}
function compression(p,scale){
 const mode=current.compressionMode||"axial",threshold=current.thresholdP??1;
 if(mode==="buckling")return compressionBuckling(p,scale,threshold,current.failureP??1,current.material==="wood");
 if(mode==="fracture")return compressionFracture(p,scale,threshold,current.failureP??1);
 if(mode==="wood")return compressionWood(p,scale,current.failureP??1);
 // Deformació 3D amplificada ×20, amb contorn de referència de la proveta original.
 const visualStrain=.012*p*20,h0=2.65,h=h0*(1-visualStrain),bottom=-1.45;
 const radius0=.47*scale,volumeRadius=radius0/Math.sqrt(1-visualStrain);
 const points=[],segments=48,bulge=.11*p;
 for(let i=0;i<=segments;i++){
  const t=i/segments,localY=-h/2+t*h;
  const factor=1+bulge*Math.pow(Math.sin(Math.PI*t),2);
  const normalization=1+bulge*.5;
  points.push(new THREE.Vector2(volumeRadius*factor/normalization,localY));
 }
 // Referència inicial: només contorns discontinus, sense tapar la proveta actual.
 if(p>.001){
  const ghostMat=new THREE.LineDashedMaterial({color:0xa9e6ef,transparent:true,opacity:.45,dashSize:.10,gapSize:.075,depthTest:false});
  const reference=new THREE.Group();group.add(reference);
  const y0=bottom+.13,y1=y0+h0;
  for(const y of [y0,y1]){
   const vertices=[];
   for(let k=0;k<=64;k++){const a=k*Math.PI*2/64;vertices.push(new THREE.Vector3(radius0*Math.cos(a),y,radius0*Math.sin(a)))}
   const geo=new THREE.BufferGeometry().setFromPoints(vertices);
   const ring=new THREE.Line(geo,ghostMat);ring.computeLineDistances();reference.add(ring);
  }
  for(const a of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
   const geo=new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(radius0*Math.cos(a),y0,radius0*Math.sin(a)),
    new THREE.Vector3(radius0*Math.cos(a),y1,radius0*Math.sin(a))
   ]);
   const side=new THREE.Line(geo,ghostMat);side.computeLineDistances();reference.add(side);
  }
 }
 // Plaques i cos deformable: posició de contacte coherent amb la superfície.
 box(2.4,.25,2.1,hardware,0,bottom,0);
 add(new THREE.LatheGeometry(points,48),specimen,0,bottom+.125+h/2,0);
 box(2.4,.25,2.1,hardware,0,bottom+.25+h,0);
 cyl(.14,.14,.6,dark,0,bottom+.25+h+.43,0);
 // Anells de referència pintats a la superfície, seguint la deformació.
 for(let j=1;j<=4;j++){
  const t=j/5,r=volumeRadius*(1+bulge*Math.pow(Math.sin(Math.PI*t),2))/(1+bulge*.5);
  const ring=add(new THREE.TorusGeometry(r,.012,8,64),stripe,0,bottom+.125+h*t,0);
  ring.rotation.x=Math.PI/2;
 }
}
function compressionWood(p,scale,failureP){
 const bottom=-1.45,h0=2.65,h=h0*(1-.28*p),r=.47*scale*(1+.09*p),damage=Math.max(0,Math.min(1,(p-.68)/(failureP-.68)));
 box(2.4,.25,2.1,hardware,0,bottom,0);
 cyl(r,r,h,specimen,0,bottom+.125+h/2,0);
 box(2.4,.25,2.1,hardware,0,bottom+.25+h,0);
 for(let k=0;k<7;k++){
  const a=k*Math.PI*2/7;
  const fiber=add(new THREE.CylinderGeometry(.012,.012,h*.94,8),stripe,r*.98*Math.cos(a),bottom+.125+h/2,r*.98*Math.sin(a));
  fiber.rotation.z=p>.2?Math.sin(k*2)*.11*p:0;
 }
 if(p>.2)for(let k=0;k<5;k++){const y=bottom+.125+h*(k+1)/6;const ring=add(new THREE.TorusGeometry(r*.99,.012,6,40),accent,0,y,0);ring.rotation.x=Math.PI/2;}
 if(damage>.1)for(let k=0;k<4;k++){const crack=box(.02,.25*damage,.02,dark,r*.85*Math.cos(k*Math.PI/2),bottom+.4+h*k/5,r*.85*Math.sin(k*Math.PI/2));crack.rotation.z=.4*damage;}
}
function compressionBuckling(p,scale,threshold,failureP,isWood){
 const bottom=-1.45,top=1.25,r=.24*scale;
 const after=Math.max(0,Math.min(1,(p-threshold)/Math.max(.01,failureP-threshold)));
 const deflection=(isWood?.29:1.28)*Math.sqrt(after);
 box(2.4,.22,2.1,hardware,0,bottom,0);
 box(2.4,.22,2.1,hardware,0,top+.22,0);
 const low=bottom+.12,high=top+.12,mid=(low+high)/2;
 const broken=isWood&&p>=failureP;
 if(broken){
  // Fractura inequívoca: dos trams físicament separats, amb cares de ruptura visibles.
  // No continuar augmentant la curvatura després de la fallada.
  const breakGap=.34,offset=.23,half=(high-low)/2;
  const lower=add(new THREE.CylinderGeometry(r,r,half,40),specimen,
   deflection*.47-offset*.5,low+half/2-breakGap*.20,0);
  const upper=add(new THREE.CylinderGeometry(r,r,half,40),specimen,
   deflection*.47+offset*.5,mid+half/2+breakGap*.70,0);
  lower.rotation.z=-.13;upper.rotation.z=.18;
  for(const sign of [-1,1]){
   const x=deflection*.47+sign*offset*.5;
   const y=mid+(sign>0?breakGap*.70:-breakGap*.20);
   const face=cyl(r*.98,r*.98,.045,dark,x,y,0);
   face.rotation.z=sign*.16;
  }
  for(let k=0;k<7;k++){
   const angle=k*2*Math.PI/7;
   const fragment=box(.04,.16+.055*(k%3),.035,accent,
    deflection*.47+.23*Math.cos(angle),mid+.05+.13*Math.sin(angle),.14*Math.sin(angle));
   fragment.rotation.z=angle;
  }
 }else{
  const rings=50,around=32,vertices=[],indices=[];
  for(let i=0;i<=rings;i++){
   const t=i/rings,y=low+(high-low)*t;
   const bend=deflection*Math.sin(Math.PI*t);
   for(let j=0;j<=around;j++){
    const angle=j/around*Math.PI*2;
    vertices.push(bend+r*Math.cos(angle),y,r*Math.sin(angle));
   }
  }
  for(let i=0;i<rings;i++)for(let j=0;j<around;j++){
   const u=i*(around+1)+j,v=u+around+1;
   indices.push(u,v,u+1,u+1,v,v+1);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setIndex(indices);geo.computeVertexNormals();add(geo,specimen);
  if(after>.68&&!isWood){
   const hinge=box(.16,.16,.13,accent,deflection*.99,mid,r*.8);
   hinge.rotation.z=-after*.7;
  }
 }
 const reference=new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,low,0),new THREE.Vector3(0,high,0)]),
  new THREE.LineDashedMaterial({color:0xa9e6ef,dashSize:.12,gapSize:.08,transparent:true,opacity:.5})
 );
 reference.computeLineDistances();group.add(reference);
}
function compressionFracture(p,scale,threshold,failureP){
 const bottom=-1.45,h=2.65*(1-.14*Math.min(1,p/Math.max(.01,threshold))),r=.47*scale;
 const damage=Math.max(0,Math.min(1,(p-threshold)/Math.max(.01,failureP-threshold)));
 box(2.4,.25,2.1,hardware,0,bottom,0);
 box(2.4,.25,2.1,hardware,0,bottom+.25+h,0);
 const cy=bottom+.125+h/2;
 if(damage<.3)cyl(r*(1+.035*p),r*(1+.035*p),h,specimen,0,cy,0);
 else{
  const split=Math.min(1,(damage-.3)/.7);
  const upper=cyl(r,r,h*.49,specimen,split*.2,cy+h*.255,0);
  const lower=cyl(r,r,h*.49,specimen,-split*.2,cy-h*.255,0);
  upper.rotation.z=split*.22;lower.rotation.z=-split*.18;
  const seam=box(r*1.85,.022,.025,dark,0,cy,r*.72);seam.rotation.z=-.32;
  if(split>.45)for(let k=0;k<4;k++){
   const angle=k*Math.PI/2,fragment=box(r*.3,.12+split*.12,r*.25,specimen,Math.cos(angle)*(r+.18*split),bottom+.3+split*.16,Math.sin(angle)*(r+.18*split));
   fragment.rotation.z=split*(k%2?.65:-.5);
  }
 }
 if(damage>0){
  for(let k=0;k<4;k++){
   const a=k*Math.PI/2,crack=box(.022,.12+damage*.7,.028,dark,r*.97*Math.cos(a),cy+(.5-k*.3)*damage,r*.97*Math.sin(a));
   crack.rotation.z=(k%2?1:-1)*(.3+damage*.5);
  }
 }
 cyl(.14,.14,.6,dark,0,bottom+.25+h+.43,0);
}
function flexion(p,scale){
 const span=4.3,L=Math.max(40,current.length||120),def=Math.min(.85,(current.deflection||0)/L*span*3),failure=!!current.flexionFailure&&p>=current.failureP;
 const w=.44*scale,h=.42*scale,verts=[],inds=[],N=60;
 for(const x of [-span/2,span/2]){const roller=cyl(.18,.18,.85,hardware,x,-.77,0);roller.rotation.x=Math.PI/2;box(.75,.22,1.05,dark,x,-1.15,0)}
 for(let i=0;i<=N;i++){const t=i/N,x=span*(t-.5),u=Math.min(t,1-t),shape=u*(3-4*u*u),y=-.37-def*shape;for(const [yy,zz] of [[-h/2,-w/2],[-h/2,w/2],[h/2,w/2],[h/2,-w/2]])verts.push(x,y+yy,zz)}
 for(let i=0;i<N;i++){if(failure&&i===N/2)continue;for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4,c=a+4,d=b+4;inds.push(a,b,c,b,d,c)}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();add(geo,specimen);
 if(failure){box(.09,h*.92,w*.9,dark,0,-.37-def,0);for(let k=0;k<4;k++){const chip=box(.07,.08,.07,accent,(k-1.5)*.12,-.52-def-.06*(k%2),.1*(k%2?1:-1));chip.rotation.z=k*.3}}
 const tip=cyl(.17,.17,.6,hardware,0,.66-def,0);tip.rotation.z=Math.PI/2;box(.72,.22,.7,accent,0,.22-def,0);
}
function torsion(p,scale){const length=3.8,r=.45*scale;const n=64,around=24,verts=[],inds=[];
 for(let i=0;i<=n;i++){const x=-length/2+length*i/n,angle=p*1.45*i/n;for(let j=0;j<=around;j++){const a=j/around*Math.PI*2+angle;verts.push(x,r*Math.cos(a),r*Math.sin(a))}}
 for(let i=0;i<n;i++)for(let j=0;j<around;j++){const a=i*(around+1)+j,b=a+around+1;inds.push(a,b,a+1,a+1,b,b+1)}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(inds);geo.computeVertexNormals();add(geo,specimen);
 for(let i=0;i<=8;i++){const x=-length/2+length*i/8,angle=p*1.45*i/8;const s=sphere(.075,stripe,x,r*Math.cos(angle),r*Math.sin(angle));s.scale.set(1,.65,.65)}
 for(const x of [-2.2,2.2]){const chuck=cyl(.76,.76,.3,hardware,x,0,0);chuck.rotation.z=Math.PI/2}
 const marker=box(.1,.7,.12,accent,2.32,0,0);marker.rotation.x=p*1.45}
function hardness(p,scale){box(4,.7,2.6,hardware,0,-1.13,0);box(2.5,.28,1.7,specimen,0,-.63,0);const tip=cyl(.15,.48,.82,accent,0,.65-.7*p,0);tip.rotation.z=Math.PI;const shaft=cyl(.16,.16,.8,hardware,0,1.45-.7*p,0);if(p>.05){const ring=add(new THREE.TorusGeometry(.07+.26*p,.035,12,40),dark,0,-.48,0);ring.rotation.x=Math.PI/2}}
function impact(p,scale){const theta=p<.48?(-1.1+(p/.48)*1.1):(p<.58?0:(p-.58)/.42*.75),len=2.9;const pivot=new THREE.Vector3(0,1.65,0),end=new THREE.Vector3(Math.sin(theta)*len,1.65-Math.cos(theta)*len,0);rod(pivot,end,.065,hardware);sphere(.24,accent,end.x,end.y,end.z);cyl(.18,.18,.6,hardware,0,1.65,0).rotation.x=Math.PI/2;for(const x of [-.7,.7])box(.65,.28,.9,hardware,x,-1.44,0);box(1.8,.24,.35,specimen,0,-1.19,0);if(p>.53){const fracture=Math.min(1,(p-.53)*10);box(.85*(1-fracture*.16),.22,.35,specimen,-.48-fracture*.12,-1.19,0);box(.85*(1-fracture*.16),.22,.35,specimen,.48+fracture*.12,-1.19,0)}}
const initialTest=new URLSearchParams(window.location.search).get('test');
let current={test:['compressio','flexio','torsio','duresa','impacte'].includes(initialTest)?initialTest:'compressio',progress:Number(document.getElementById('load')?.value||0)/1000,size:Number(document.getElementById('size')?.value||20)};
function rebuild(){clear();grid();const p=Math.max(0,Math.min(1,current.progress)),scale=.75+current.size/60;
 if(current.test==='compressio')compression(p,scale);
 else if(current.test==='flexio')flexion(p,scale);
 else if(current.test==='torsio')torsion(p,scale);
 else if(current.test==='duresa')hardness(p,scale);
 else impact(p,scale)}
window.updateThosOther3D=state=>{current={...current,...state};rebuild()};
const resize=()=>{const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
new ResizeObserver(resize).observe(host);resize();rebuild();
let running=true;function frame(){if(!running)return;requestAnimationFrame(frame);orbit.update();renderer.render(scene,camera)}frame();
window.addEventListener('pagehide',()=>{running=false;orbit.dispose();clear();renderer.dispose()},{once:true});
