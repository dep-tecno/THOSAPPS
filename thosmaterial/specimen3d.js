import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host=document.getElementById('specimen3d');
if(!host)throw new Error('No hi ha contenidor 3D');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#f1f7f9');
const camera=new THREE.PerspectiveCamera(38,1,.1,100);
camera.position.set(3.7,2.5,6.8);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;orbit.minDistance=3.5;orbit.maxDistance=12;orbit.target.set(0,0,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x718b9b,2.2));
const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);
const steel=new THREE.MeshStandardMaterial({color:0x9bbbc7,metalness:.77,roughness:.28,side:THREE.DoubleSide});
const jaws=new THREE.MeshStandardMaterial({color:0x395867,metalness:.55,roughness:.35});
const detail=new THREE.MeshStandardMaterial({color:0x7596a4,metalness:.55,roughness:.38});
function cylinder(r,h,mat){const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,40),mat);return o;}
const upper=new THREE.Group(),lower=new THREE.Group();scene.add(upper,lower);
for(const g of [upper,lower]){
 const clamp=new THREE.Mesh(new THREE.BoxGeometry(1.5,.38,1.1),jaws);g.add(clamp);
 for(const x of [-.42,.42]){const jaw=new THREE.Mesh(new THREE.BoxGeometry(.30,.5,.83),detail);jaw.position.set(x,0,0);g.add(jaw);}
}
const body=new THREE.Group();scene.add(body);
let meshes=[];
function clearBody(){for(const mesh of meshes){body.remove(mesh);mesh.geometry.dispose();}meshes=[];}
function profileMesh(start,end,length,radius,neck,fracture,topPiece){
 const points=[],N=42;
 for(let i=0;i<=N;i++){
  const t=i/N,y=start+(end-start)*t;
  const waist=Math.exp(-Math.pow(y/(.19*length),2));
  let r=radius*(1-(1-neck)*waist);
  // Collars at the two ends of the calibrated section.
  const collar=Math.max(0,(Math.abs(y)-length*.39)/(length*.11));
  r*=1+.33*Math.min(1,collar);
  if(fracture){const distance=Math.abs(y);if(distance<.045)r*=.83+.17*Math.min(1,distance/.045);}
  points.push(new THREE.Vector2(Math.max(.018,r),y));
 }
 const mesh=new THREE.Mesh(new THREE.LatheGeometry(points,48),steel);
 mesh.castShadow=true;body.add(mesh);meshes.push(mesh);
}
let current={strain:0,maxStrain:.28,diameter:10,broken:false,neckStart:.17,fragile:false,unloading:false,plastic:0};
let peakStrain=0;
function renderSpecimen(){
 const {strain,maxStrain,diameter,broken,neckStart,fragile,unloading,plastic}=current;
 // Escala visual amplificada: els càlculs i el diagrama conserven la deformació real.
 const visualFactor=fragile?12:1.8;
 const visualStrain=strain*visualFactor;
 const length=2.65*(1+visualStrain);
 // Aproximació de conservació del volum durant la deformació plàstica.
 const radius=.19*diameter/10/Math.sqrt(1+Math.max(0,fragile?strain:visualStrain));
 const retainedNeckStrain=unloading?Math.max(plastic,peakStrain):strain;
 const neck=fragile?1:Math.max(.30,1-.7*Math.max(0,(retainedNeckStrain-neckStart)/(maxStrain-neckStart||1)));
 upper.position.y=length/2+.18;lower.position.y=-length/2-.18;
 clearBody();
 if(broken){
  profileMesh(.055,length/2,length,radius,neck,true,true);
  profileMesh(-length/2,-.055,length,radius,neck,true,false);
  upper.position.y+=.13;lower.position.y-=.13;
 }else profileMesh(-length/2,length/2,length,radius,neck,false,false);
 const status=document.getElementById('specimenStatus');
 if(status)status.textContent=broken?'Proveta fracturada':unloading?(Math.abs(strain-plastic)<1e-6?'Deformació permanent: '+(plastic*100).toFixed(2)+' %':'Recuperació elàstica…'):fragile?'Comportament fràgil · deformació visual ×12':strain>neckStart?'Estricció localitzada':strain>0?'Allargament axial':'Proveta inicial';
}
window.updateThosSpecimen3D=state=>{if(!state.unloading&&state.strain===0)peakStrain=0;else if(!state.unloading)peakStrain=Math.max(peakStrain,state.strain);current={...current,...state};renderSpecimen();};
renderSpecimen();
const resize=()=>{const w=Math.max(1,host.clientWidth),h=Math.max(1,host.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
new ResizeObserver(resize).observe(host);resize();
function animate(){requestAnimationFrame(animate);orbit.update();renderer.render(scene,camera);}animate();
window.addEventListener('pagehide',()=>{orbit.dispose();renderer.dispose();},{once:true});
