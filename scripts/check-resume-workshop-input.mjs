import assert from 'node:assert/strict';
import { attachJourneyInput } from '../assets/js/resume-workshop-input.js';

const frames=new Map();let nextFrame=0;
globalThis.requestAnimationFrame=callback=>{frames.set(++nextFrame,callback);return nextFrame;};
globalThis.cancelAnimationFrame=id=>frames.delete(id);
class Surface extends EventTarget{
  clientWidth=1000;clientHeight=800;scrollHeight=8800;scrollTop=0;captures=new Set();classes=new Set();
  classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value)};
  setPointerCapture(id){this.captures.add(id);}hasPointerCapture(id){return this.captures.has(id);}releasePointerCapture(id){this.captures.delete(id);}
  scrollTo({top}){this.scrollTop=top;}
}
const root=new Surface();let enabled=true,reduced=false,navigated=0;
const controls=attachJourneyInput(root,{isEnabled:()=>enabled,isReduced:()=>reduced,onNavigate:()=>navigated++});
function event(name,values={}){
  const e=new Event(name,{cancelable:true});
  const props={isPrimary:true,button:0,pointerId:1,clientX:700,clientY:200,timeStamp:100,target:{closest:()=>null},...values};
  for(const [key,value] of Object.entries(props))Object.defineProperty(e,key,{value});root.dispatchEvent(e);return e;
}
event('pointerdown');
assert.ok(event('pointermove',{clientX:500,timeStamp:116}).defaultPrevented);
assert.ok(root.scrollTop>250&&root.scrollTop<300,'Dragging left advances the journey');
assert.ok(root.captures.has(1)&&root.classes.has('is-dragging'));
event('pointerup',{clientX:500,timeStamp:120});
assert.equal(root.captures.size,0);assert.equal(frames.size,1,'Release starts bounded momentum');
const beforeCoast=root.scrollTop;
const [[id,callback]]=frames;frames.delete(id);callback(performance.now()+32);
assert.ok(root.scrollTop>beforeCoast,'Momentum continues in the drag direction');
controls.cancel();assert.equal(frames.size,0);

root.scrollTop=2000;
event('pointerdown');
assert.equal(event('pointermove',{clientX:702,clientY:300,timeStamp:116}).defaultPrevented,false,'Vertical touch scrolling remains native');
assert.equal(root.scrollTop,2000);assert.equal(root.captures.size,0);

event('pointerdown',{target:{closest:()=>({})}});event('pointermove',{clientX:100,timeStamp:116});
assert.equal(root.scrollTop,2000,'Buttons, captions and inputs do not start a drag');
event('pointerdown');event('pointermove',{clientX:400,timeStamp:116});event('pointercancel');
assert.equal(root.captures.size,0);assert.equal(root.classes.size,0);assert.equal(frames.size,0,'Cancellation releases all interaction state');

reduced=true;root.scrollTop=0;event('pointerdown');event('pointermove',{clientX:-10000,timeStamp:116});event('pointerup',{timeStamp:120});
assert.equal(root.scrollTop,8000,'Dragging cannot overshoot the final section');assert.equal(frames.size,0,'Reduced motion disables momentum');
event('pointerdown');event('pointermove',{clientX:10000,timeStamp:116});event('pointerup',{timeStamp:120});
assert.equal(root.scrollTop,0,'Dragging cannot overshoot the beginning');

assert.ok(event('wheel',{deltaX:200,deltaY:10,deltaMode:0}).defaultPrevented);
assert.equal(root.scrollTop,200,'Horizontal trackpad movement advances the journey');
assert.equal(event('wheel',{deltaX:0,deltaY:100,deltaMode:0}).defaultPrevented,false);
assert.equal(event('wheel',{deltaX:200,deltaY:10,deltaMode:0,ctrlKey:true}).defaultPrevented,false,'Pinch zoom is not intercepted');
enabled=false;event('pointerdown');event('pointermove',{clientX:100,timeStamp:116});assert.equal(root.scrollTop,200,'Hidden scenes and open dialogs cannot drag');
controls.dispose();enabled=true;event('wheel',{deltaX:200,deltaY:0,deltaMode:0});assert.equal(root.scrollTop,200,'Disposal removes input listeners');
assert.ok(navigated>0);
console.log('Verified horizontal drag, momentum, vertical touch scrolling, cancellation, bounds, trackpad input, reduced motion, and disposal.');
