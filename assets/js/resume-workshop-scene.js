import * as THREE from './lib/three/three.module.min.js';
import { createObservatory } from './resume-workshop-world.js';
import { SHOTS, sampleCamera, sampleFlight } from './resume-workshop-path.js';

const clamp=THREE.MathUtils.clamp;
const smooth=value=>value*value*(3-2*value);

function studioEnvironment(renderer) {
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x536e78);
  const geometry=new THREE.PlaneGeometry(12,12),materials=[];
  const panels=[[[0,10,0],0xffe5c2,4],[[8,2,0],0xf4c99d,3],[[-8,3,0],0xa2e8e4,3],[[0,3,-8],0xd6d2ef,2],[[0,0,8],0xf6f3ea,2]];
  for(const [position,color,intensity] of panels){
    const material=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(intensity),side:THREE.DoubleSide});materials.push(material);
    const panel=new THREE.Mesh(geometry,material);panel.position.set(...position);panel.lookAt(0,0,0);studio.add(panel);
  }
  const generator=new THREE.PMREMGenerator(renderer);
  const target=generator.fromScene(studio,.03,.1,100);
  generator.dispose();geometry.dispose();materials.forEach(item=>item.dispose());return target;
}

export async function createWorkshop(container,signal,onContextLost,onFrame) {
  if(signal.aborted)throw signal.reason;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x060919);
  const camera=new THREE.PerspectiveCamera(48,1,.1,250);
  let world,environment;
  const geometries=new Set(),materials=new Set();
  function collect(){world?.root.traverse(child=>{if(child.geometry)geometries.add(child.geometry);for(const mat of Array.isArray(child.material)?child.material:child.material?[child.material]:[])materials.add(mat);});}
  function release(){collect();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());environment?.dispose();renderer.dispose();}
  try {
    environment=studioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.65;
    world=createObservatory();scene.add(world.root);
    scene.add(new THREE.HemisphereLight(0xc3ceff,0x3b245e,1.45));
  } catch(error){release();throw error;}
  const sun=new THREE.DirectionalLight(0xffdfb9,3.1);
  sun.castShadow=true;sun.shadow.mapSize.set(container.clientWidth>700?2048:1024,container.clientWidth>700?2048:1024);
  Object.assign(sun.shadow.camera,{left:-10,right:10,top:10,bottom:-10,near:.5,far:65});
  sun.shadow.normalBias=.035;sun.shadow.bias=-.00005;
  scene.add(sun,sun.target);
  const fill=new THREE.DirectionalLight(0x92d9e5,1.65);scene.add(fill,fill.target);
  container.append(renderer.domElement);
  let active=false,disposed=false,frame=0,inViewport=true;
  let target=0,progress=0,still=false,lastTime=0,elapsed=0,flightDirection=1,flightEnergy=0;
  let pointerX=0,pointerY=0,lookX=0,lookY=0;
  const projected=new THREE.Vector3(),flightRotation=new THREE.Quaternion();
  function project(point){projected.set(...point).project(camera);return{x:(projected.x*.5+.5)*container.clientWidth,y:(-.5*projected.y+.5)*container.clientHeight,visible:projected.z>-1&&projected.z<1};}
  function draw(time=0){
    frame=0;if(disposed||!active||!inViewport)return;
    // Slow ambient movement is rendered at 30 fps, paused when hidden or reduced.
    if(!still&&lastTime&&time-lastTime<32){request();return;}
    const delta=Math.min((time-lastTime)/1000||.033,.06);lastTime=time;if(!still)elapsed+=delta;
    const difference=target-progress,previousProgress=progress;
    progress=still?Math.round(target):Math.abs(difference)<.0005?target:progress+difference*(1-Math.exp(-delta*10));
    const segment=Math.min(SHOTS.length-2,Math.floor(progress)),fraction=progress-segment,travel=smooth(clamp(fraction,0,1));
    if(Math.abs(difference)>.001)flightDirection=Math.sign(difference);
    const flight=sampleFlight(progress),thrust=still?0:flight.thrust;
    const speed=Math.abs(progress-previousProgress)/Math.max(delta,.001);
    flightEnergy=still?0:THREE.MathUtils.lerp(flightEnergy,Math.min(1,speed*1.5)*Math.min(1,thrust*4),1-Math.exp(-delta*5));
    world.traveler.position.copy(flight.position);
    if(!still){world.traveler.position.y+=Math.sin(elapsed*.85)*.17;world.traveler.position.x+=Math.sin(elapsed*.47)*.07;}
    const yaw=flight.direction.lengthSq()>.1?Math.atan2(flight.direction.x,flight.direction.z)+(flightDirection<0?Math.PI:0):.2;
    const idle=still?0:1-flightEnergy;
    const ahead=sampleFlight(progress+.025*flightDirection).direction;
    const turn=THREE.MathUtils.clamp(flight.direction.clone().cross(ahead).y*8,-.28,.28);
    flightRotation.setFromEuler(new THREE.Euler(flightEnergy*(1.08-flight.direction.y*flightDirection*.3)+idle*Math.sin(elapsed*.65)*.055,flightEnergy>.06?yaw:.2+idle*Math.sin(elapsed*.38)*.12,turn*flightEnergy+idle*Math.sin(elapsed*.55)*.085,'YXZ'));
    if(still)world.traveler.quaternion.copy(flightRotation);else world.traveler.quaternion.slerp(flightRotation,1-Math.exp(-delta*5));
    world.animate(progress,elapsed,still,flightEnergy,flightDirection);
    const pose=sampleCamera(progress,camera.aspect);camera.position.copy(pose.position);
    camera.position.y+=thrust*.75;
    pose.focus.lerp(flight.position.clone().add(new THREE.Vector3(0,1,0)),thrust*.28);
    lookX=still?0:THREE.MathUtils.lerp(lookX,pointerX,1-Math.exp(-delta*3));
    lookY=still?0:THREE.MathUtils.lerp(lookY,pointerY,1-Math.exp(-delta*3));
    camera.position.add(new THREE.Vector3(lookX*.65,-lookY*.3,0));
    camera.fov=48+flightEnergy*4;
    camera.up.set(Math.sin(still?0:turn*flightEnergy*.07),1,0).normalize();
    const shotIndex=clamp(Math.round(progress),0,SHOTS.length-1),shot=SHOTS[shotIndex];
    const offset=camera.aspect<1?0:THREE.MathUtils.lerp(SHOTS[segment].side==='left'?-.12:.12,SHOTS[segment+1].side==='left'?-.12:.12,travel);
    camera.setViewOffset(container.clientWidth,container.clientHeight,container.clientWidth*offset,camera.aspect<1?container.clientHeight*.15:0,container.clientWidth,container.clientHeight);
    camera.lookAt(pose.focus);camera.updateMatrixWorld();
    world.setViewPosition(camera.position);
    sun.position.copy(pose.focus).add(new THREE.Vector3(8,15,8));sun.target.position.copy(pose.focus);
    fill.position.copy(pose.focus).add(new THREE.Vector3(-8,8,-4));fill.target.position.copy(pose.focus);
    renderer.render(scene,camera);
    onFrame?.({progress,shot:shotIndex,point:project(shot.anchor),side:shot.side,name:shot.name});
    if(!still)request();
  }
  function request(){if(!frame&&active&&inViewport&&!disposed)frame=requestAnimationFrame(draw);}
  function resize(){if(disposed)return;const width=container.clientWidth,height=container.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();request();}
  const observer=new ResizeObserver(resize);observer.observe(container);
  const intersection=new IntersectionObserver(entries=>{inViewport=entries[0].isIntersecting;if(inViewport)request();else{cancelAnimationFrame(frame);frame=0;}});intersection.observe(container);
  function contextLost(event){event.preventDefault();onContextLost();}
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  resize();
  return {
    setProgress(value,stationary=false){target=clamp(value,0,SHOTS.length-1);still=stationary;request();},
    setPointer(x,y){pointerX=x;pointerY=y;request();},
    setActive(value){active=value;if(value){lastTime=0;resize();request();}else{cancelAnimationFrame(frame);frame=0;}},
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();renderer.domElement.removeEventListener('webglcontextlost',contextLost);sun.shadow.dispose();release();renderer.forceContextLoss();renderer.domElement.remove();},
  };
}
