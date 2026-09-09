import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Box3, Vector3, Matrix4, PerspectiveCamera, ShaderChunk } from '../assets/js/lib/three/three.module.min.js';
import { createObservatory } from '../assets/js/resume-workshop-world.js';
import { ROOM_POSITIONS, HOVER_OFFSET, FLIGHT_CLEARANCE, SHOTS, sampleCamera, sampleFlight } from '../assets/js/resume-workshop-path.js';

// Validate the actual procedural geometry, including every buffer and shader include.
const world=createObservatory(), geometries=new Set(), materials=new Set();
let triangles=0;
world.root.traverse(object=>{
  if(object.geometry){geometries.add(object.geometry);triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);}
  for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[]){
    materials.add(material);
    if(material.isShaderMaterial)for(const shader of [material.vertexShader,material.fragmentShader]){
      for(const match of shader.matchAll(/#include <([^>]+)>/g))assert.ok(ShaderChunk[match[1]],`Known shader chunk: ${match[1]}`);
      assert.equal((shader.match(/#include/g)||[]).length,(shader.match(/^#include/gm)||[]).length,'GLSL includes start on their own lines');
    }
  }
});
for(const geometry of geometries){
  assert.ok(geometry.attributes.position.array.every(Number.isFinite),'Finite geometry positions');
  if(geometry.attributes.normal)assert.ok(geometry.attributes.normal.array.every(Number.isFinite),'Finite normals');
  if(geometry.index)assert.ok(geometry.index.array.every(index=>index<geometry.attributes.position.count),'Valid mesh indices');
}
assert.equal(world.exhibits.length,6,'Six distinct exhibits');
assert.ok(triangles<800000,'Geometry budget includes all instanced detail');
assert.ok(new Box3().setFromObject(world.traveler).getSize(new Vector3()).y>2,'Traveler has full human-scale geometry');
function radialBound(group,horizontal=false){
  world.root.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert();let bound=0;
  group.traverse(object=>{if(!object.geometry)return;object.geometry.computeBoundingSphere();
    for(let i=0;i<(object.isInstancedMesh?object.count:1);i++){
      const matrix=new Matrix4().multiplyMatrices(inverse,object.matrixWorld);
      if(object.isInstancedMesh){const instance=new Matrix4();object.getMatrixAt(i,instance);matrix.multiply(instance);}
      const sphere=object.geometry.boundingSphere.clone().applyMatrix4(matrix),center=sphere.center;
      bound=Math.max(bound,(horizontal?Math.hypot(center.x,center.z):center.length())+sphere.radius);
    }
  });return bound;
}
const stationBounds=world.exhibits.map(exhibit=>radialBound(exhibit,true));let travelerBound=0;
for(const stationary of [false,true])for(const direction of [-1,1])for(let p=0;p<=7;p+=.25){
  world.animate(p,p*3,stationary,sampleFlight(p).thrust,direction);
  world.root.traverse(object=>{
    assert.ok([...object.position,...object.rotation.toArray().slice(0,3),...object.scale].every(Number.isFinite),'Finite animated transform');
    if(object.geometry)assert.ok(object.geometry.attributes.position.array.every(Number.isFinite),'Finite flight trail');
  });
  travelerBound=Math.max(travelerBound,radialBound(world.traveler));
}
assert.ok(Math.max(...stationBounds)+travelerBound+.25<FLIGHT_CLEARANCE,'Safety envelope includes actual model bounds, full astronaut rotation, and drift');
let previousFlight;
for(let p=0;p<=7;p+=.005){
  const flight=sampleFlight(p);
  assert.ok([...flight.position,...flight.direction,flight.thrust].every(Number.isFinite),'Finite flight path');
  ROOM_POSITIONS.forEach(([x,,z],i)=>assert.ok(Math.hypot(flight.position.x-x,flight.position.z-z)>stationBounds[i]+travelerBound+.25,'Flight keeps the full astronaut clear of every station'));
  if(previousFlight)assert.ok(flight.position.distanceTo(previousFlight)<.4,'Continuous flight through chapter boundaries');
  previousFlight=flight.position;
}
for(let i=1;i<SHOTS.length-1;i++)assert.ok(sampleFlight(i-.000001).position.distanceTo(sampleFlight(i+.000001).position)<.001,'No flight jump at a section boundary');
for(let i=1;i<ROOM_POSITIONS.length;i++){
  const previous=new Vector3(...ROOM_POSITIONS[i-1]),current=new Vector3(...ROOM_POSITIONS[i]);
  assert.ok(current.distanceTo(previous)>25,'Stations have generous separation');
  assert.ok(current.z<previous.z-15,'Journey continues deeper instead of looping back');
  if(i>1)assert.ok((current.x-previous.x)*(previous.x-ROOM_POSITIONS[i-2][0])<0,'Successive flights alternate sides');
}
assert.equal(SHOTS.at(-1).room,SHOTS.at(-2).room,'Ending stays at the last exhibit');
assert.ok(SHOTS.at(-1).radius<8&&SHOTS.at(-1).elevation<.2,'Ending is a close portrait, not an overhead overview');
for(let i=0;i<SHOTS.length;i++){
  const landing=new Vector3(...ROOM_POSITIONS[SHOTS[i].room]).add(new Vector3(...HOVER_OFFSET));
  assert.ok(sampleFlight(i).position.distanceTo(landing)<.001,'Astronaut hovers beside each exhibit');
  if(i<SHOTS.length-1&&SHOTS[i].room!==SHOTS[i+1].room){
    const midpoint=sampleFlight(i).position.clone().lerp(sampleFlight(i+1).position,.5);
    assert.ok(sampleFlight(i+.5).position.y>midpoint.y+1,'Flight arcs above exhibit level');
  }
}

for(const aspect of [390/844,1440/900]){
  let previous;const camera=new PerspectiveCamera(48,aspect,.1,250);
  for(let progress=0;progress<=7;progress+=.005){
    const pose=sampleCamera(progress,aspect);
    assert.ok([...pose.position,...pose.focus].every(Number.isFinite),'Finite camera pose');
    assert.ok(pose.position.y>1,'Camera stays above platforms');
    assert.ok(pose.position.distanceTo(pose.focus)>3,'Camera avoids its subject');
    if(previous)assert.ok(previous.distanceTo(pose.position)<.6,'Continuous camera travel');
    previous=pose.position;
    const flight=sampleFlight(progress);
    camera.position.copy(pose.position);camera.position.y+=flight.thrust*.75;
    pose.focus.lerp(flight.position.clone().add(new Vector3(0,1,0)),flight.thrust*.28);
    const index=Math.min(6,Math.floor(progress)),fraction=progress-index,t=fraction*fraction*(3-2*fraction);
    const offset=aspect<1?0:(SHOTS[index].side==='left'?-.12:.12)*(1-t)+(SHOTS[index+1].side==='left'?-.12:.12)*t;
    camera.setViewOffset(aspect*900,900,aspect*900*offset,aspect<1?135:0,aspect*900,900);
    camera.lookAt(pose.focus);camera.updateMatrixWorld();
    const projected=flight.position.clone().add(new Vector3(0,1,0)).project(camera);
    assert.ok(Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9&&projected.z>-1&&projected.z<1,`Astronaut remains framed: progress=${progress.toFixed(3)}, aspect=${aspect.toFixed(3)}, projection=${projected.toArray()}`);
    world.setViewPosition(camera.position);world.root.updateMatrixWorld(true);
    assert.ok(world.root.getObjectByName('Nebula backdrop').getWorldPosition(new Vector3()).distanceTo(camera.position)<.001,'Sky surrounds the full extended journey');
  }
  for(let i=0;i<SHOTS.length;i++)assert.ok(sampleCamera(i,aspect).focus.distanceTo(new Vector3(...SHOTS[i].focus))<4.2,'Camera composes the exhibit and astronaut together');
}
const layers=['Foreground stardust','Middle starfield','Distant starfield','Nebula backdrop'];
world.setViewPosition(new Vector3());world.root.updateMatrixWorld(true);
const layerStarts=layers.map(name=>world.root.getObjectByName(name).getWorldPosition(new Vector3()));
world.setViewPosition(new Vector3(12,5,-20));world.root.updateMatrixWorld(true);
const displacements=layers.map((name,i)=>world.root.getObjectByName(name).getWorldPosition(new Vector3()).distanceTo(layerStarts[i]));
assert.ok(displacements[0]<.001&&displacements[1]<displacements[2]&&displacements[2]<displacements[3],'Foreground, middle stars, distant stars, and sky have distinct parallax depths');
geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
const html=fs.readFileSync(new URL('../_site/resume/index.html',import.meta.url),'utf8');
for(const title of ['2K Games','AgentLive Games','Yale University','Submitty','CyberPatriot Club','MDCure'])assert.ok(html.includes(title),`Resume contains ${title}`);
assert.equal((html.match(/data-workshop-chapter=/g)||[]).length,8,'Eight captions');
assert.equal((html.match(/data-workshop-template=/g)||[]).length,6,'Complete resume detail panels');
assert.ok(!html.includes('data-workshop-detail="credits"')&&!html.includes('data-workshop-template="credits"'),'Credits removed');
assert.ok(html.includes('data-workshop-scrubber'),'Keyboard-accessible journey slider');
assert.ok(!html.includes('Take a walk through my work.'),'Removed introductory sentence');
for(const caption of html.matchAll(/<article[^>]+data-workshop-chapter[\s\S]*?<\/article>/g)){
  const words=caption[0].replace(/<[^>]*>/g,' ').trim().split(/\s+/);
  assert.ok(words.length<=32,`Compact caption (${words.length} words)`);
}
assert.ok(/data-resume-workshop\s+hidden/.test(html),'Classic no-JavaScript default');
assert.ok(html.includes('resume-workshop.js'),'Scene controller included');
const css=fs.readFileSync(new URL('../assets/css/resume-workshop.css',import.meta.url),'utf8');
assert.ok(css.includes('dialog:not([open])'),'Theme cannot expose a closed dialog');
const annotationRules=[...css.matchAll(/\.workshop__annotation\s*\{([^}]+)\}/g)].map(match=>match[1]);
assert.ok(annotationRules.every(rule=>!/(?:max-height|overflow-y\s*:\s*(?:auto|scroll))/.test(rule)),'Captions have no internal scroll or height cap');
console.log(`Verified six sculptures, ${Math.round(triangles).toLocaleString()} triangles, cosmic shaders, forward/reverse flight, reduced motion, eight camera stops, compact captions, and complete resume details.`);
