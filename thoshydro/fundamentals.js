// Independent classroom models; no dependency on the Three.js turbine simulation.
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const format=(value,digits=0)=>value.toLocaleString('ca-ES',{maximumFractionDigits:digits});
 const gravity=9.807;
 const waters=[
  {name:'Aigua dolça · 4 °C',rho:1000},
  {name:'Aigua dolça · 10 °C',rho:999.7},
  {name:'Aigua dolça · 20 °C',rho:998.2},
  {name:'Aigua dolça · 40 °C',rho:992.2},
  {name:'Aigua de mar · 20 °C',rho:1025}
 ];
 function updatePressure(){
  const h=Number($('foundationHeight').value),water=waters[Number($('foundationDensity').value)],rho=water.rho;
  const pressure=rho*gravity*h;
  $('foundationHeightValue').textContent=format(h)+' m';
  $('foundationHeightLabel').textContent=format(h)+' m';
  $('foundationDensityValue').textContent=format(rho,1)+' kg/m³';
  $('foundationWaterType').textContent=water.name;
  $('foundationPressureMpa').textContent=format(pressure/1e6,3)+' MPa';
  $('foundationPressureBar').textContent=format(pressure/1e5,2)+' bar';
  $('foundationWater').style.height=(h/150*100)+'%';
 }
 function updateEnergy(){
  const h=Number($('foundationHead').value),q=Number($('foundationFlow').value);
  const turbine=Number($('foundationTurbineEta').value)/100,alternator=Number($('foundationGeneratorEta').value)/100;
  const hydraulic=1000*gravity*h*q/1000,mechanical=hydraulic*turbine,electric=mechanical*alternator;
  for(const [id,value,unit] of [
   ['foundationHeadValue',h,' m'],['foundationFlowValue',q,' m³/s'],
   ['foundationTurbineEtaValue',turbine*100,' %'],['foundationGeneratorEtaValue',alternator*100,' %']
  ])$(id).textContent=format(value)+unit;
  for(const [id,value] of [['foundationPotential',hydraulic],['foundationKinetic',hydraulic],['foundationMechanical',mechanical],['foundationElectric',electric],['foundationPowerResult',electric]])$(id).textContent=format(value)+' kW';
  $('foundationPowerBar').style.width=(turbine*alternator*100)+'%';
  $('foundationOverallEta').textContent='Rendiment global: '+format(turbine*alternator*100,1)+' %';
  $('foundationLosses').textContent='Pèrdues: '+format(hydraulic-electric)+' kW';
 }
 function init(){
  for(const id of ['foundationHeight','foundationDensity'])$(id).addEventListener('input',updatePressure);
  for(const id of ['foundationHead','foundationFlow','foundationTurbineEta','foundationGeneratorEta'])$(id).addEventListener('input',updateEnergy);
  $('foundationResetPressure').addEventListener('click',()=>{$('foundationHeight').value='129';$('foundationDensity').value='0';updatePressure();});
  updatePressure();updateEnergy();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
