// Educational, normalized characteristic curves. Not manufacturer test data.
const COLORS={pelton:'#0085a3',francis:'#d18a2c',kaplan:'#39a37b'};
const profiles={
 pelton:{peak:0.91,opt:0.62,width:0.85,minHead:80,maxHead:1000,minFlow:0.05,maxFlow:8},
 francis:{peak:0.94,opt:0.80,width:0.56,minHead:20,maxHead:350,minFlow:1,maxFlow:80},
 kaplan:{peak:0.93,opt:0.87,width:0.78,minHead:2,maxHead:70,minFlow:5,maxFlow:250}
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function efficiency(type,relativeFlow){
 const p=profiles[type],q=clamp(relativeFlow,0,1.3);
 if(q<=0)return 0;
 return clamp(p.peak*(1-Math.pow((q-p.opt)/p.width,2))*(1-Math.exp(-q*17)),0,p.peak);
}
export function createCharacteristics(doc){
 const panel=doc.getElementById('characteristics');
 const canvas=doc.getElementById('characteristicChart');
 const head=doc.getElementById('curveHead'),flow=doc.getElementById('curveFlow');
 const tabs=[...panel.querySelectorAll('[data-curve]')];
 let tab='efficiency';
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
   const maxY=tab==='efficiency'?100:tab==='power'?Math.max(1,9.81*h*q*1.25):300;
   ctx.strokeStyle='#d7e3e8';ctx.fillStyle='#587381';ctx.font='12px system-ui';
   for(let j=0;j<=5;j++){const y=T+j*H/5;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(L+W,y);ctx.stroke();ctx.fillText(fmt(maxY*(1-j/5),0),5,y+4);}
   for(let j=0;j<=5;j++){const x=L+j*W/5;ctx.fillText(fmt(j*20,0),x-8,height-23);}
   ctx.fillText(tab==='selection'?'Salt hidràulic (m)':'Cabal relatiu (%)',L+W/2-55,height-5);
   if(tab==='selection'){
     for(const [type,p] of Object.entries(profiles)){
       const x1=L+clamp(p.minHead/350,0,1)*W,x2=L+clamp(p.maxHead/350,0,1)*W;
       const y1=T+H-clamp(p.minFlow/250,0,1)*H,y2=T+H-clamp(p.maxFlow/250,0,1)*H;
       ctx.globalAlpha=.16;ctx.fillStyle=COLORS[type];ctx.fillRect(x1,y2,x2-x1,y1-y2);ctx.globalAlpha=1;
       ctx.fillStyle=COLORS[type];ctx.fillText(type.toUpperCase(),x1+5,Math.max(T+14,y2+15));
     }
     ctx.fillStyle='#263f50';ctx.beginPath();ctx.arc(L+clamp(h/350,0,1)*W,T+H-clamp(q/250,0,1)*H,6,0,2*Math.PI);ctx.fill();
     ctx.fillStyle='#587381';ctx.fillText('Cabal (m³/s) ↑',L+6,T+14);
     doc.getElementById('curveNote').textContent=recommendation(h,q)+' · Eixos: 0–350 m i 0–250 m³/s.';
     return;
   }
   for(const type of Object.keys(profiles)){
     const p=profiles[type],qRel=clamp(q/p.maxFlow,0,1);
     ctx.beginPath();
     for(let j=0;j<=100;j++){
       const x=j/100;
       const eta=efficiency(type,x);
       const y=tab==='efficiency'?eta*100:9.81*h*(x*p.maxFlow)*eta*.9;
       const py=T+H-clamp(y/maxY,0,1)*H;
       if(j===0)ctx.moveTo(L,py);else ctx.lineTo(L+x*W,py);
     }
     ctx.strokeStyle=COLORS[type];ctx.lineWidth=2.5;ctx.stroke();
     const y=tab==='efficiency'?efficiency(type,qRel)*100:9.81*h*q*efficiency(type,qRel)*.9;
     ctx.fillStyle=COLORS[type];ctx.beginPath();ctx.arc(L+qRel*W,T+H-clamp(y/maxY,0,1)*H,5,0,Math.PI*2);ctx.fill();
   }
   doc.getElementById('curveNote').textContent=tab==='efficiency'?'Corbes de rendiment aproximades segons el cabal relatiu de cada turbina. Els punts indiquen el cabal seleccionat.':'Potència elèctrica estimada amb rendiment variable i alternador al 90 %. Les escales nominals de cabal són diferents per a cada turbina.';
 }
 for(const el of [head,flow])el.addEventListener('input',draw);
 tabs.forEach(button=>button.addEventListener('click',()=>{tab=button.dataset.curve;tabs.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));draw();}));
 window.addEventListener('resize',draw);
 return {draw};
}
