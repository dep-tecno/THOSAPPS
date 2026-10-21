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
 const regulation=0.30*Math.tanh((operatingRatio-0.5)*2.4);
 const opt=clamp(p.opt+0.12*Math.tanh(mismatch)+regulation,0.25,1.05);
 const width=p.width*(1-0.28*Math.min(1,Math.abs(mismatch)/2))*(1-0.12*Math.abs(regulation));
 const peak=p.peak*(1-0.18*Math.min(1,Math.abs(mismatch)/2))*(0.72+0.28*Math.min(1,operatingRatio/0.7));
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
  const g=guides[tab];
  for(const [id,value] of [['curveGuideTitle',g.title],['curveGuideIntro',g.intro],['curveGuideFormula',g.formula],['curveGuideObservation',g.observation],['curveGuideChallenge',g.challenge],['curveGuideConcepts',g.concepts]])doc.getElementById(id).textContent=value;
 }
 updateGuide();
 const fmt=(n,d=1)=>n.toLocaleString('ca-ES',{maximumFractionDigits:d});
 function recommendation(h,q){
   const eligible=Object.entries(profiles).filter(([,p])=>h>=p.minHead&&h<=p.maxHead&&q>=p.minFlow&&q<=p.maxFlow);
   if(!eligible.length)return 'Fora de les zones orientatives: cal estudiar el disseny concret.';
   const scores=eligible.map(([type,p])=>({type,score:Math.abs(Math.log(h/Math.sqrt(p.minHead*p.maxHead)))+Math.abs(Math.log(q/Math.sqrt(p.minFlow*p.maxFlow)))}));
   scores.sort((a,b)=>a.score-b.score);
   return 'Zona orientativa: '+scores[0].type.toUpperCase()+'. Les zones se superposen i la selecció real depèn de més factors.';
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
   const maxY=tab==='efficiency'?100:tab==='power'?Math.max(1,9.81*h*250*.95):250;
   ctx.strokeStyle='#d7e3e8';ctx.fillStyle='#587381';ctx.font='12px system-ui';
   for(let j=0;j<=5;j++){const y=T+j*H/5;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(L+W,y);ctx.stroke();ctx.fillText(fmt(maxY*(1-j/5),0),5,y+4);}
   for(let j=0;j<=5;j++){const x=L+j*W/5;ctx.fillText(fmt(tab==='selection'?j*70:tab==='power'?j*50:j*20,0),x-8,height-23);}
   ctx.fillText(tab==='selection'?'Salt hidràulic (m)':tab==='power'?'Cabal (m³/s)':'Cabal relatiu (%)',L+W/2-55,height-5);
   if(tab==='selection'){
     for(const [type,p] of Object.entries(profiles)){
       const x1=L+clamp(p.minHead/350,0,1)*W,x2=L+clamp(p.maxHead/350,0,1)*W;
       const y1=T+H-clamp(p.minFlow/250,0,1)*H,y2=T+H-clamp(p.maxFlow/250,0,1)*H;
       ctx.globalAlpha=.16;ctx.fillStyle=COLORS[type];ctx.fillRect(x1,y2,x2-x1,y1-y2);ctx.globalAlpha=1;
       ctx.fillStyle=COLORS[type];ctx.fillText(type.toUpperCase(),x1+5,Math.max(T+14,y2+15));
     }
     ctx.fillStyle='#263f50';ctx.beginPath();ctx.arc(L+clamp(h/350,0,1)*W,T+H-clamp(q/250,0,1)*H,6,0,2*Math.PI);ctx.fill();
     ctx.fillStyle='#587381';// Show the current flow as a horizontal reference across the entire map.
     const selectedY=T+H-clamp(q/250,0,1)*H;
     ctx.setLineDash([6,5]);ctx.strokeStyle='#203e50';ctx.lineWidth=2;
     ctx.beginPath();ctx.moveTo(L,selectedY);ctx.lineTo(L+W,selectedY);ctx.stroke();ctx.setLineDash([]);
     ctx.fillStyle='#587381';ctx.fillText('Cabal (m³/s) ↑',L+6,T+14);
     doc.getElementById('curveNote').textContent=recommendation(h,q)+' · Eixos: 0–350 m i 0–250 m³/s.';
     return;
   }
   for(const type of Object.keys(profiles)){
     const p=profiles[type],qRel=clamp(q/p.maxFlow,0,1);
     ctx.beginPath();
     for(let j=0;j<=100;j++){
       const x=j/100;
       const eta=efficiency(type,tab==='power'?x*250/p.maxFlow:x,h,q);
       const y=tab==='efficiency'?eta*100:9.81*h*(x*250)*eta*.9;
       const py=T+H-clamp(y/maxY,0,1)*H;
       if(j===0)ctx.moveTo(L,py);else ctx.lineTo(L+x*W,py);
     }
     ctx.strokeStyle=COLORS[type];ctx.lineWidth=2.5;ctx.stroke();
     const y=tab==='efficiency'?efficiency(type,qRel,h,q)*100:9.81*h*q*efficiency(type,q/p.maxFlow,h,q)*.9;
     ctx.fillStyle=COLORS[type];ctx.beginPath();ctx.arc(L+(tab==='power'?q/250:qRel)*W,T+H-clamp(y/maxY,0,1)*H,5,0,Math.PI*2);ctx.fill();
   }
   doc.getElementById('curveNote').textContent=tab==='efficiency'?'El salt i el cabal modifiquen la família de corbes de rendiment mitjançant un model simplificat de regulació. Els punts marquen el funcionament seleccionat; no són corbes de fabricant.':'La potència es representa amb eixos fixos (0–250 m³/s) per veure'n els canvis reals. El salt i la regulació del cabal modifiquen les corbes; alternador al 90 %.';
 }
 for(const el of [head,flow])el.addEventListener('input',draw);
 tabs.forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.curve;tabs.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));updateGuide();draw();}));
 window.addEventListener('resize',draw);
 return {draw};
}
