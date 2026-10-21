// Educational, normalized characteristic curves. Not manufacturer test data.
const COLORS={pelton:'#0085a3',francis:'#d18a2c',kaplan:'#39a37b'};
const profiles={
 pelton:{peak:0.91,opt:0.62,width:0.85,minHead:80,maxHead:1000,minFlow:0.05,maxFlow:8},
 francis:{peak:0.94,opt:0.80,width:0.56,minHead:20,maxHead:350,minFlow:1,maxFlow:80},
 kaplan:{peak:0.93,opt:0.87,width:0.78,minHead:2,maxHead:70,minFlow:5,maxFlow:250}
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function efficiency(type,relativeFlow,head=profiles[type].minHead,operatingFlow=null){
 const p=profiles[type],q=clamp(relativeFlow,0,1.3);
 if(q<=0)return 0;
 // Head-dependent design matching: the best efficiency point and curve width
 // vary with hydraulic head; deliberately simplified for classroom use.
 const designHead=Math.sqrt(p.minHead*p.maxHead);
 const mismatch=Math.log(Math.max(1,head)/designHead);
 const operatingRatio=operatingFlow===null?1:clamp(operatingFlow/p.maxFlow,0,2);
 // Simplified variable regulation: changing the selected flow changes the operating characteristic.
 const regulation=0.16*Math.tanh((operatingRatio-0.5)*1.8);
 const opt=clamp(p.opt+0.12*Math.tanh(mismatch)+regulation,0.25,1.05);
 const width=p.width*(1-0.28*Math.min(1,Math.abs(mismatch)/2))*(1-0.12*Math.abs(regulation));
 const peak=p.peak*(1-0.18*Math.min(1,Math.abs(mismatch)/2))*(1-0.09*Math.abs(operatingRatio-0.7));
 return clamp(peak*(1-Math.pow((q-opt)/width,2))*(1-Math.exp(-q*17)),0,p.peak);
}
export function createCharacteristics(doc){
 const panel=doc.getElementById('characteristics');
 const canvas=doc.getElementById('characteristicChart');
 const head=doc.getElementById('curveHead'),flow=doc.getElementById('curveFlow');
 const tabs=[...panel.querySelectorAll('[data-curve]')];
 let tab='efficiency';
 const guides={
  efficiency:{title:'Interpretar el rendiment',intro:'El rendiment η indica la fracció de potència hidràulica convertida en potència mecànica útil.',formula:'η = P eix / P hidràulica',observation:'Busca el màxim de cada corba. Compara la forma de les corbes quan canvies el salt.',challenge:'Mantén el cabal i modifica el salt. Quina turbina conserva millor el rendiment?',concepts:'Rendiment · Càrrega parcial · Punt de màxim rendiment'},
  power:{title:'Interpretar la potència',intro:'La potència depèn del salt, del cabal i dels rendiments de la turbina i l’alternador.',formula:'P elèctrica = ρ · g · Q · H · η turbina · η alternador',observation:'Compara la potència disponible a diferents percentatges del cabal seleccionat.',challenge:'Duplica el salt mantenint el cabal. Com canvia la potència?',concepts:'Salt · Cabal · Potència hidràulica · Potència elèctrica'},
  selection:{title:'Escollir una turbina',intro:'Pelton s’associa a salts elevats; Francis, a condicions intermèdies; Kaplan, a salts baixos i cabals elevats.',formula:'Selecció segons H (m) i Q (m³/s)',observation:'Localitza el punt de treball i identifica les zones orientatives que el contenen.',challenge:'Augmenta el cabal i redueix el salt. Cap a quina família de turbines et desplaces?',concepts:'Pelton · Francis · Kaplan · Zones de funcionament'}
 };
 function updateGuide(){
  const selecting=tab==='selection';
  head.max=selecting?'1500':'350';flow.max=selecting?'1000':'250';
  if(+head.value>+head.max)head.value=head.max;
  if(+flow.value>+flow.max)flow.value=flow.max;
  const g=guides[tab];
  for(const [id,value] of [['curveGuideTitle',g.title],['curveGuideIntro',g.intro],['curveGuideFormula',g.formula],['curveGuideObservation',g.observation],['curveGuideChallenge',g.challenge],['curveGuideConcepts',g.concepts]])doc.getElementById(id).textContent=value;
 }
 updateGuide();
 const fmt=(n,d=1)=>n.toLocaleString('ca-ES',{maximumFractionDigits:d});
 // Approximate boundaries digitized visually from the classroom PDF (not manufacturer data).
 // Coordinates are [flow m³/s, head m], on a 0–1000 / 0–1500 matrix.
 // Schematic approximation of the three bounded regions in the classroom matrix.
 const pelton=[[0,1000],[200,1000],[200,1500],[0,1500]];
 const francis=[[200,500],[700,500],[700,1000],[200,1000]];
 const kaplanTop=[[200,500],[400,500],[500,340],[600,230],[700,155],[800,115],[900,95],[1000,85]];
 const kaplan=[[200,0],[1000,0],[1000,85],...[...kaplanTop].reverse().slice(1)];
 function inPolygon(q,h,polygon){
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
   if(((yi>h)!==(yj>h))&&(q<(xj-xi)*(h-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
 }
 function recommendation(h,q){
  if(q<=0||h<=0)return 'Sense salt o sense cabal no hi ha aprofitament hidràulic.';
  if(inPolygon(q,h,pelton))return 'PELTON · Salt elevat i cabal baix (zona orientativa de la matriu).';
  if(inPolygon(q,h,francis))return 'FRANCIS · Salt i cabal intermedis (zona orientativa de la matriu).';
  if(inPolygon(q,h,kaplan))return 'KAPLAN · Salt baix i cabal elevat (zona orientativa de la matriu).';
  return 'FORA DE LES ZONES · La matriu no permet escollir directament una turbina. Cal estudiar altres configuracions, turbines en paral·lel o una solució específica; no implica que sigui impossible.';
 }
 function drawSelection(ctx,L,T,W,H,h,q){
  const X=v=>L+clamp(v/1000,0,1)*W,Y=v=>T+H-clamp(v/1500,0,1)*H;
  function region(poly,fill,stroke){
   ctx.beginPath();poly.forEach(([x,y],i)=>i?ctx.lineTo(X(x),Y(y)):ctx.moveTo(X(x),Y(y)));ctx.closePath();
   ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle=stroke;ctx.stroke();
  }
  region(pelton,'#c8e8f1',COLORS.pelton);
  region(francis,'#f6dfb9',COLORS.francis);
  region(kaplan,'#c9ead9',COLORS.kaplan);
  ctx.font='bold 13px system-ui';
  ctx.fillStyle='#006781';ctx.fillText('PELTON',X(30),Y(1270));
  ctx.fillStyle='#88510c';ctx.fillText('FRANCIS',X(370),Y(760));
  ctx.fillStyle='#176b4c';ctx.fillText('KAPLAN',X(700),Y(170));
  ctx.font='11px system-ui';ctx.fillStyle='#687b83';
  ctx.fillText('Fora de les zones',X(720),Y(1230));
  ctx.setLineDash([5,5]);ctx.strokeStyle='#405c6a';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(X(q),Y(0));ctx.lineTo(X(q),Y(h));ctx.lineTo(X(0),Y(h));ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#203f50';ctx.beginPath();ctx.arc(X(q),Y(h),6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#587381';ctx.fillText('Salt (m) ↑',L+4,T+13);
  doc.getElementById('curveNote').textContent=recommendation(h,q)+' · Zones esquemàtiques aproximades del PDF de classe; no són límits tècnics universals.';
 }
 function draw(){
   if(panel.hidden)return;
   const h=+head.value,q=+flow.value;
   doc.getElementById('curveHeadValue').textContent=fmt(h,0)+' m';
   doc.getElementById('curveFlowValue').textContent=fmt(q,0)+' m³/s';
   const width=Math.max(280,canvas.clientWidth||600),height=320,dpr=Math.min(window.devicePixelRatio||1,2);
   canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
   const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
   ctx.fillStyle='#f2f7f9';ctx.fillRect(0,0,width,height);
   const L=64,R=20,T=22,B=49,W=width-L-R,H=height-T-B;
   const maxY=tab==='efficiency'?100:tab==='power'?Math.max(1,9.81*h*Math.max(1,q)*1.05):1500;
   ctx.strokeStyle='#d7e3e8';ctx.fillStyle='#587381';ctx.font='12px system-ui';
   for(let j=0;j<=5;j++){const y=T+j*H/5;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(L+W,y);ctx.stroke();ctx.fillText(fmt(maxY*(1-j/5),0),5,y+4);}
   for(let j=0;j<=5;j++){const x=L+j*W/5;ctx.fillText(fmt(tab==='selection'?j*200:j*20,0),x-8,height-23);}
   ctx.fillText(tab==='selection'?'Cabal (m³/s)':'Cabal relatiu (%)',L+W/2-55,height-5);
   if(tab==='selection'){drawSelection(ctx,L,T,W,H,h,q,width,height);return;}
   for(const type of Object.keys(profiles)){
     const p=profiles[type],qRel=clamp(q/p.maxFlow,0,1);
     ctx.beginPath();
     for(let j=0;j<=100;j++){
       const x=j/100;
       const eta=efficiency(type,x,h,q);
       const y=tab==='efficiency'?eta*100:9.81*h*(x*q)*eta*.9;
       const py=T+H-clamp(y/maxY,0,1)*H;
       if(j===0)ctx.moveTo(L,py);else ctx.lineTo(L+x*W,py);
     }
     ctx.strokeStyle=COLORS[type];ctx.lineWidth=2.5;ctx.stroke();
     const y=tab==='efficiency'?efficiency(type,qRel,h,q)*100:9.81*h*q*efficiency(type,1,h,q)*.9;
     ctx.fillStyle=COLORS[type];ctx.beginPath();ctx.arc(L+(tab==='power'?W:qRel*W),T+H-clamp(y/maxY,0,1)*H,5,0,Math.PI*2);ctx.fill();
   }
   doc.getElementById('curveNote').textContent=tab==='efficiency'?'El salt i el cabal modifiquen la família de corbes de rendiment mitjançant un model simplificat de regulació. Els punts marquen el funcionament seleccionat; no són corbes de fabricant.':'El salt i el cabal seleccionats modifiquen la corba de potència disponible (0–100 % del cabal seleccionat). Alternador amb rendiment del 90 %. Model didàctic.';
 }
 for(const el of [head,flow])el.addEventListener('input',draw);
 tabs.forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.curve;tabs.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateGuide();draw();}));
 window.addEventListener('resize',draw);
 return {draw};
}
