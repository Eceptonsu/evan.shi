// Horizontal dragging uses the same native scroll position as the wheel, chapter
// buttons, and slider. Vertical touch gestures and pinch zoom remain native.
export function attachJourneyInput(root,{isEnabled=()=>true,isReduced=()=>false,onNavigate=()=>{},onEngage=()=>{}}={}){
  const listeners=new AbortController(),signal=listeners.signal;
  let drag=null,inertia=0,velocity=0,lastFrame=0;
  const interactive='button,a,input,select,textarea,[contenteditable],dialog,.workshop__annotation';
  const range=()=>Math.max(0,root.scrollHeight-root.clientHeight);
  function write(value){const next=Math.max(0,Math.min(range(),value));root.scrollTop=next;onNavigate();return next;}
  function stopMomentum(){cancelAnimationFrame(inertia);inertia=0;velocity=0;}
  function release(){const previous=drag;drag=null;root.classList.remove('is-dragging');if(previous&&root.hasPointerCapture(previous.id))root.releasePointerCapture(previous.id);return previous;}
  function cancel(){stopMomentum();release();}
  function coast(time){
    inertia=0;if(!isEnabled()||isReduced()){stopMomentum();return;}
    const dt=Math.min(40,time-lastFrame);lastFrame=time;
    const before=root.scrollTop,after=write(before+velocity*dt);velocity*=Math.exp(-dt/140);
    if(Math.abs(velocity)>.025&&after!==before)inertia=requestAnimationFrame(coast);
  }
  root.addEventListener('pointerdown',event=>{
    if(!isEnabled()||!event.isPrimary||event.button!==0||event.target.closest(interactive))return;
    stopMomentum();drag={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,time:event.timeStamp,scroll:root.scrollTop,active:false,gain:range()/7/Math.max(280,root.clientWidth*.8)};
  },{signal});
  root.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(!drag.active){
      if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
      if(Math.abs(dy)>=Math.abs(dx)){release();return;}
      drag.active=true;root.setPointerCapture(drag.id);root.classList.add('is-dragging');
      root.scrollTo({top:drag.scroll,behavior:'instant'});onEngage();
    }
    event.preventDefault();const dt=Math.max(8,event.timeStamp-drag.time);
    velocity=Math.max(-4,Math.min(4,(drag.lastX-event.clientX)*drag.gain/dt));
    drag.lastX=event.clientX;drag.time=event.timeStamp;
    write(drag.scroll-dx*drag.gain);
  },{signal,passive:false});
  root.addEventListener('pointerup',event=>{
    if(!drag||event.pointerId!==drag.id)return;
    const previous=release();
    if(previous.active&&!isReduced()&&event.timeStamp-previous.time<90&&Math.abs(velocity)>.025){lastFrame=performance.now();inertia=requestAnimationFrame(coast);}else stopMomentum();
  },{signal});
  for(const name of ['pointercancel','lostpointercapture'])root.addEventListener(name,event=>{if(drag&&event.pointerId===drag.id)cancel();},{signal});
  root.addEventListener('wheel',event=>{
    if(!isEnabled()||event.target.closest('dialog')||event.ctrlKey)return;
    cancel();
    if(Math.abs(event.deltaX)>Math.abs(event.deltaY)){
      event.preventDefault();const unit=event.deltaMode===1?16:event.deltaMode===2?root.clientHeight:1;
      write(root.scrollTop+event.deltaX*unit);onEngage();
    }
  },{signal,passive:false});
  root.addEventListener('keydown',stopMomentum,{signal});
  return {cancel,dispose(){cancel();listeners.abort();}};
}
