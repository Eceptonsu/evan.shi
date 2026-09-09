import { Vector3, MathUtils } from './lib/three/three.module.min.js';

// An open journey deeper into space, with pronounced changes of side and height.
export const ROOM_POSITIONS = [[0,0,0], [18,5,-18], [-7,10,-40], [20,3,-62], [-9,12,-85], [14,6,-108]];
export const HOVER_OFFSET = [-.7,1.2,7.2];
// Covers the station's outermost ring, the astronaut at full lean, and a margin.
export const FLIGHT_CLEARANCE = 6.3;
// Focus and anchor coordinates are authored relative to each station.
export const SHOTS = [
  { room:0, focus:[0,1.6,0], radius:12.5, angle:.42, elevation:.27, anchor:[-.7,2.5,7.2], side:'left', name:'HELLO' },
  { room:1, focus:[0,1.6,-.1], radius:8.8, angle:-.68, elevation:.3, anchor:[0,1.94,-.25], side:'right', name:'GAMES' },
  { room:2, focus:[.3,1.8,-.2], radius:8, angle:.82, elevation:.26, anchor:[.3,2,-.3], side:'left', name:'AI' },
  { room:2, focus:[-1.2,1.2,.8], radius:5.8, angle:-.65, elevation:.27, anchor:[-1.65,1.12,1.02], side:'right', name:'TOOLS' },
  { room:3, focus:[0,1.4,0], radius:8.6, angle:-.72, elevation:.32, anchor:[0,1.85,0], side:'left', name:'OPEN SOURCE' },
  { room:4, focus:[0,1.7,0], radius:9, angle:.72, elevation:.36, anchor:[0,1.5,0], side:'right', name:'RESEARCH' },
  { room:5, focus:[0,1.5,0], radius:8.6, angle:-.52, elevation:.26, anchor:[-1.15,2,0], side:'right', name:'PROJECTS' },
  // End beside the traveler at the final exhibit, with no return or overhead view.
  { room:5, focus:[-.7,2.3,7.2], radius:6.5, angle:.38, elevation:.14, anchor:[-.7,2.7,7.2], side:'left', name:'PROFILE' },
].map(shot=>({...shot,localFocus:shot.focus,focus:shot.focus.map((v,i)=>v+ROOM_POSITIONS[shot.room][i]),anchor:shot.anchor.map((v,i)=>v+ROOM_POSITIONS[shot.room][i])}));

function sampleJourney(progress) {
  const p=MathUtils.clamp(progress,0,SHOTS.length-1),index=Math.min(SHOTS.length-2,Math.floor(p));
  const fraction=p-index,t=fraction*fraction*(3-2*fraction);
  const start=new Vector3(...ROOM_POSITIONS[SHOTS[index].room]);
  const end=new Vector3(...ROOM_POSITIONS[SHOTS[index+1].room]);
  const distance=start.distanceTo(end),direction=end.clone().sub(start).normalize();
  const lift=Math.sin(Math.PI*t),position=start.clone().lerp(end,t);
  position.y+=lift*Math.min(4.2,distance*.2);
  const bank=lift*Math.min(3.2,distance*.12);
  position.x+=Math.sign(direction.x)*bank;position.z+=Math.abs(direction.z)*bank*.45;
  return {position,direction,index,t,thrust:distance>.1?Math.sin(Math.PI*fraction):0};
}

export function sampleFlight(progress) {
  const {thrust}=sampleJourney(progress),position=flightPosition(progress);
  const direction=flightPosition(progress+.002).sub(flightPosition(progress-.002)).normalize();
  return {position,direction,thrust};
}

function flightPosition(progress){
  const {position}=sampleJourney(progress);position.add(new Vector3(...HOVER_OFFSET));
  for(const [x,,z] of ROOM_POSITIONS){
    const dx=position.x-x,dz=position.z-z,distance=Math.hypot(dx,dz),blend=.6;
    if(distance<FLIGHT_CLEARANCE+blend){
      // Smooth radial avoidance also protects a reverse flight along this route.
      const radius=distance<FLIGHT_CLEARANCE-blend?FLIGHT_CLEARANCE:FLIGHT_CLEARANCE+Math.pow(distance-FLIGHT_CLEARANCE+blend,2)/(4*blend);
      const scale=radius/Math.max(distance,.00001);position.x=x+dx*scale;position.z=z+dz*scale;
    }
  }
  return position;
}

export function sampleCamera(progress,aspect=1.6) {
  // Camera and traveler share the same eased curve, so the longer flights stay
  // framed throughout the journey rather than diverging on separate splines.
  const journey=sampleJourney(progress),a=SHOTS[journey.index],b=SHOTS[journey.index+1],t=journey.t;
  const focus=journey.position.clone().add(new Vector3(...a.localFocus).lerp(new Vector3(...b.localFocus),t));
  const traveler=flightPosition(progress).add(new Vector3(0,1,0));
  focus.lerp(traveler,MathUtils.lerp(a.name==='PROFILE'?0:aspect<1?.52:.4,b.name==='PROFILE'?0:aspect<1?.52:.4,t));
  const angle=MathUtils.lerp(a.angle,b.angle,t)*(aspect<1?.6:1),elevation=MathUtils.lerp(a.elevation,b.elevation,t);
  const radius=(MathUtils.lerp(a.name==='PROFILE'?a.radius:Math.max(11.5,a.radius),b.name==='PROFILE'?b.radius:Math.max(11.5,b.radius),t)+journey.thrust*2)*(aspect<1?1.5:1);
  const position=focus.clone().add(new Vector3(Math.sin(angle)*Math.cos(elevation),Math.sin(elevation),Math.cos(angle)*Math.cos(elevation)).multiplyScalar(radius));
  return {position,focus};
}
