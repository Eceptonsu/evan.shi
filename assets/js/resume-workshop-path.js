import { Vector3, MathUtils } from './lib/three/three.module.min.js';

export const STORY_CENTER=[0,1.9,0];
export const HOVER_OFFSET=[-.78,1,6.45];
export const SHOTS=[
  {layer:0,scale:1.4,offset:[1, 0, -1],focus:[0,1.9,0],radius:12,angle:0.15,elevation:0.24,anchor:[0,1.9,0],side:'left',name:'HELLO'},
  {layer:1,scale:1.65,offset:[0.7, -1.6, -2],focus:[0,1.8,0],radius:10,angle:-0.2,elevation:0.15,anchor:[0,1.94,-.25],side:'left',name:'GAMES'},
  {layer:2,scale:1.25,offset:[-1.4, -0.4, -1],focus:[.2,1.9,0],radius:12.8,angle:0.4,elevation:0.35,anchor:[.3,2,-.3],side:'right',name:'AI'},
  {layer:2,scale:1.65,offset:[1, -0.3, -2],focus:[-.65,1.5,.4],radius:9.8,angle:-0.22,elevation:0.2,anchor:[-1.65,1.12,1.02],side:'left',name:'TOOLS'},
  {layer:3,scale:0.85,offset:[1.8, -0.1, -2],focus:[0,1.8,0],radius:12,angle:0.12,elevation:0.16,anchor:[0,1.85,0],side:'right',name:'OPEN SOURCE'},
  {layer:4,scale:1.35,offset:[-0.8, -1, -1],focus:[0,1.6,0],radius:10,angle:-0.3,elevation:0.48,anchor:[0,1.5,0],side:'left',name:'RESEARCH'},
  {layer:5,scale:1.05,offset:[0.6, 0, -2],focus:[0,1.6,0],radius:12,angle:0.15,elevation:0.2,anchor:[-1.15,2,0],side:'right',name:'PROJECTS'},
  {layer:5,scale:0.7,offset:[0, 0, -2],focus:[1.25,2,6.38],radius:7,angle:0.22,elevation:0.14,anchor:[1.25,2.5,6.38],side:'left',name:'PROFILE'},
];
export function storyOrigin(progress){const p=MathUtils.clamp(progress,0,7);return new Vector3(Math.sin(p*.32)*4,p*.5,-p*6);}
export function sampleStory(progress){
  const p=MathUtils.clamp(progress,0,7),index=Math.min(6,Math.floor(p)),fraction=p-index;
  const blend=fraction*fraction*(3-2*fraction),weights=Array(6).fill(0);
  weights[SHOTS[index].layer]+=1-blend;weights[SHOTS[index+1].layer]+=blend;
  return {index,blend,weights,origin:storyOrigin(p)};
}
function flightPosition(progress){const p=MathUtils.clamp(progress,0,7),angle=-.12+p*.045;return storyOrigin(p).add(new Vector3(Math.sin(angle)*6.5,1+Math.sin(p*.8)*.14,Math.cos(angle)*6.5));}
export function sampleFlight(progress){
  const position=flightPosition(progress),direction=flightPosition(progress+.002).sub(flightPosition(progress-.002)).normalize();
  return {position,direction,thrust:.35};
}
export function sampleCamera(progress,aspect=1.6){
  const {index,blend:t,origin}=sampleStory(progress),a=SHOTS[index],b=SHOTS[index+1];
  const focus=new Vector3(...a.focus).lerp(new Vector3(...b.focus),t).add(origin);
  const traveler=flightPosition(progress).add(new Vector3(0,1,0));
  const weight=MathUtils.lerp(a.name==='PROFILE'?0:aspect<1?.5:.32,b.name==='PROFILE'?0:aspect<1?.5:.32,t);focus.lerp(traveler,weight);
  const angle=MathUtils.lerp(a.angle,b.angle,t)*(aspect<1?.6:1),elevation=MathUtils.lerp(a.elevation,b.elevation,t);
  const radius=MathUtils.lerp(a.radius,b.radius,t)*(aspect<1?1.5:1);
  const position=focus.clone().add(new Vector3(Math.sin(angle)*Math.cos(elevation),Math.sin(elevation),Math.cos(angle)*Math.cos(elevation)).multiplyScalar(radius));
  return {position,focus};
}
