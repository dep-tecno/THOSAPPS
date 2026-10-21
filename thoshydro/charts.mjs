// Independent 2D telemetry: no dependency on Three.js or turbine geometry.
export function createTelemetry(root) {
  const canvases=['powerChart','rpmChart','torqueChart'].map(id=>root.getElementById(id));
  const colors=['#0089a6','#d48727','#4278b7'];
  let samples=[],elapsed=0,last=0,values=[0,0,0];
  function reset(){samples=[];elapsed=0;last=0;render();}
  function setValues(powerKW,rpm,torque){values=[powerKW,rpm,torque].map(v=>Number.isFinite(v)?Math.max(0,v):0);}
  function sample(dt){
    if(!Number.isFinite(dt)||dt<=0)return;
    elapsed+=dt;last+=dt;
    if(last>=0.25){last=0;samples.push({t:elapsed,v:[...values]});if(samples.length>120)samples.shift();render();}
  }
  function render(){
    canvases.forEach((canvas,index)=>{
      if(!canvas)return;
      const width=Math.max(200,canvas.clientWidth||300),height=145,dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
      ctx.fillStyle='#f2f7f9';ctx.fillRect(0,0,width,height);
      const left=48,right=12,top=12,bottom=25,w=width-left-right,h=height-top-bottom;
      const max=Math.max(1,...samples.map(p=>p.v[index]))*1.15;
      ctx.font='11px system-ui';ctx.strokeStyle='#d3e1e7';ctx.fillStyle='#627d89';ctx.lineWidth=1;
      for(let j=0;j<=3;j++){const y=top+h*j/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(width-right,y);ctx.stroke();ctx.fillText((max*(1-j/3)).toLocaleString('ca-ES',{maximumFractionDigits:1}),3,y+4);}
      const minT=Math.max(0,elapsed-30),span=30;
      ctx.fillText('−30 s',left,height-7);ctx.fillText('ara',width-right-19,height-7);
      if(samples.length<2)return;
      ctx.beginPath();let started=false;
      for(const p of samples){if(p.t<minT)continue;const x=left+(p.t-minT)/span*w,y=top+h-p.v[index]/max*h;if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);}
      ctx.strokeStyle=colors[index];ctx.lineWidth=2.5;ctx.stroke();
    });
  }
  window.addEventListener('resize',render);
  render();
  return {setValues,sample,reset};
}
