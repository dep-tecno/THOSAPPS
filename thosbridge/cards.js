export function clampCardPosition(position,size,stage){
  return {x:Math.max(8,Math.min(Number.isFinite(position.x)?position.x:8,Math.max(8,stage.width-size.width-8))),
    y:Math.max(8,Math.min(Number.isFinite(position.y)?position.y:8,Math.max(8,stage.height-size.height-42)))};
}
export function initialCardPosition(id,size,stage){
  const positions={costCard:{x:stage.width-size.width-18,y:65},simulationCard:{x:stage.width-size.width-18,y:stage.height-size.height-55},legendCard:{x:18,y:65},selection:{x:18,y:stage.height-size.height-90},result:{x:(stage.width-size.width)/2,y:65}};
  return clampCardPosition(positions[id]||{x:18,y:65},size,stage);
}
export function mountCards(stage){
  const cards=[...stage.querySelectorAll('.info-card')],key='thosbridge:cards:v1';let positions={},z=5;
  try{positions=JSON.parse(localStorage.getItem(key))||{};}catch{}
  const bounds=()=>({width:stage.clientWidth,height:stage.clientHeight});
  const size=card=>({width:card.offsetWidth,height:card.offsetHeight});
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(positions));}catch{}};
  const place=card=>{
    if(card.hidden)return;const p=positions[card.id];
    const next=p?clampCardPosition(p,size(card),bounds()):initialCardPosition(card.id,size(card),bounds());
    positions[card.id]={...p,...next,collapsed:card.classList.contains('collapsed')};card.style.left=next.x+'px';card.style.top=next.y+'px';
  };
  for(const card of cards){
    const handle=card.querySelector('.card-drag-handle'),collapse=card.querySelector('.card-collapse');let drag=null;
    if(positions[card.id]?.collapsed)card.classList.add('collapsed');
    const setCollapseLabel=()=>{const expanded=!card.classList.contains('collapsed');collapse.textContent=expanded?'−':'+';collapse.setAttribute('aria-expanded',String(expanded));collapse.title=expanded?'Plega la targeta':'Amplia la targeta';collapse.setAttribute('aria-label',collapse.title);};setCollapseLabel();
    collapse.addEventListener('click',()=>{card.classList.toggle('collapsed');setCollapseLabel();place(card);save();});
    handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();handle.focus();place(card);drag={x:e.clientX,y:e.clientY,...{origin:{...positions[card.id]}}};handle.setPointerCapture(e.pointerId);card.style.zIndex=String(++z);card.classList.add('dragging');});
    handle.addEventListener('pointermove',e=>{if(!drag)return;positions[card.id]={...positions[card.id],x:drag.origin.x+e.clientX-drag.x,y:drag.origin.y+e.clientY-drag.y};place(card);});
    const end=e=>{if(!drag)return;drag=null;card.classList.remove('dragging');if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);save();};
    handle.addEventListener('pointerup',end);handle.addEventListener('pointercancel',end);
    handle.addEventListener('keydown',e=>{const step=e.shiftKey?2:10,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];if(!delta)return;e.preventDefault();place(card);positions[card.id].x+=delta[0];positions[card.id].y+=delta[1];place(card);save();});
    new ResizeObserver(()=>place(card)).observe(card);
  }
  new ResizeObserver(()=>cards.forEach(place)).observe(stage);
  return {refresh:()=>cards.forEach(place),reset:()=>{positions={};cards.forEach(place);save();}};
}
