import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Box3, Vector3, Matrix4, PerspectiveCamera, ShaderChunk } from '../assets/js/lib/three/three.module.min.js';
import { createObservatory } from '../assets/js/resume-workshop-world.js';
import { SHOTS, sampleStory, storyOrigin, sampleCamera, sampleFlight } from '../assets/js/resume-workshop-path.js';
import { createProjectParallax } from '../assets/js/resume-workshop-art.js';

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
assert.equal(world.chapters.length,6,'Six story layers share one stage');
assert.ok(triangles<250000,'Geometry budget includes all instanced detail');
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
let travelerBound=0,stageFront=-Infinity,peakDraws=0;
const thread=world.root.getObjectByName('Continuous story thread');assert.ok(thread,'One persistent thread connects the chapters');
for(const stationary of [false,true])for(const direction of [-1,1])for(let p=0;p<=7;p+=.125){
  world.animate(p,p*3,stationary,sampleFlight(p).thrust,direction);
  const story=sampleStory(p);
  assert.ok(Math.abs(story.weights.reduce((sum,value)=>sum+value,0)-1)<.00001,'Story has no empty transition');
  assert.ok(story.weights.filter(value=>value>0).length<=2,'Only neighboring story layers overlap');
  assert.ok(world.chapters.some(layer=>layer.visible),'Scene never disappears between chapters');
  assert.equal(world.root.getObjectByName('Continuous story thread'),thread,'Morphing preserves the same scene object');
  world.root.traverse(object=>{
    assert.ok([...object.position,...object.rotation.toArray().slice(0,3),...object.scale].every(Number.isFinite),'Finite animated transform');
    if(object.geometry)assert.ok(object.geometry.attributes.position.array.every(Number.isFinite),'Finite moving geometry');
  });
  travelerBound=Math.max(travelerBound,radialBound(world.traveler));
  // The pilot follows a lane in front of the art. Exact chapter AABBs are more
  // useful than origin-centered spheres for these deliberately offset layouts.
  for(const layer of world.chapters)if(layer.visible)stageFront=Math.max(stageFront,new Box3().setFromObject(layer).max.z-world.stage.position.z);
  let draws=0;world.root.traverseVisible(object=>{if(object.isMesh||object.isPoints)draws++;});peakDraws=Math.max(peakDraws,draws);
}
for(const p of [.5,1.5,3.5,4.5,5.5]){
  world.animate(p,0,true);
  assert.equal(world.chapters.filter(layer=>layer.visible).length,2,'Outgoing and incoming work overlap during a transition');
}
assert.equal(sampleStory(2.5).weights[2],1,'AI and its tools remain one continuous scene');
assert.equal(SHOTS.at(-1).layer,SHOTS.at(-2).layer,'Ending preserves the project world');
assert.ok(SHOTS.at(-1).radius<8&&SHOTS.at(-1).elevation<.2,'Ending stays intimate rather than returning to an overview');
let previousFlight;
for(let p=0;p<=7;p+=.005){
  const flight=sampleFlight(p),origin=storyOrigin(p);
  assert.ok([...flight.position,...flight.direction].every(Number.isFinite),'Finite companion path');
  assert.ok(flight.position.z-origin.z>stageFront+travelerBound+.25,'Astronaut stays ahead of all chapter bounds, including limb rotation clearance');
  if(previousFlight)assert.ok(flight.position.distanceTo(previousFlight)<.1,'Companion moves continuously');
  previousFlight=flight.position;
}
for(const aspect of [390/844,1440/900]){
  let previous;const camera=new PerspectiveCamera(48,aspect,.1,250);
  for(let progress=0;progress<=7;progress+=.005){
    const pose=sampleCamera(progress,aspect);
    assert.ok([...pose.position,...pose.focus].every(Number.isFinite),'Finite camera pose');
    assert.ok(pose.position.distanceTo(pose.focus)>3,'Camera avoids its subject');
    if(previous)assert.ok(previous.distanceTo(pose.position)<.2,'Continuous parallax camera');
    previous=pose.position;
    const story=sampleStory(progress),offset=(SHOTS[story.index].side==='left'?-.12:.12)*(1-story.blend)+(SHOTS[story.index+1].side==='left'?-.12:.12)*story.blend;
    camera.position.copy(pose.position);camera.setViewOffset(aspect*900,900,aspect<1?0:aspect*900*offset,aspect<1?135:0,aspect*900,900);
    camera.lookAt(pose.focus);camera.updateMatrixWorld();
    const projected=sampleFlight(progress).position.clone().add(new Vector3(0,1,0)).project(camera);
    assert.ok(Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9&&projected.z>-1&&projected.z<1,`Companion remains framed at ${progress.toFixed(3)}, aspect ${aspect.toFixed(3)}: ${projected.toArray()}`);
    world.setViewPosition(camera.position);world.root.updateMatrixWorld(true);
    assert.ok(world.root.getObjectByName('Nebula backdrop').getWorldPosition(new Vector3()).distanceTo(camera.position)<.001,'Sky surrounds the evolving scene');
  }
}
const layers=['Foreground stardust','Middle starfield','Distant starfield','Nebula backdrop'];
world.setViewPosition(new Vector3());world.root.updateMatrixWorld(true);
const layerStarts=layers.map(name=>world.root.getObjectByName(name).getWorldPosition(new Vector3()));
world.setViewPosition(new Vector3(12,5,-20));world.root.updateMatrixWorld(true);
const displacements=layers.map((name,i)=>world.root.getObjectByName(name).getWorldPosition(new Vector3()).distanceTo(layerStarts[i]));
assert.ok(displacements[0]<.001&&displacements[1]<displacements[2]&&displacements[2]<displacements[3],'Foreground, middle stars, distant stars, and sky have distinct parallax depths');
geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
assert.ok(peakDraws<125,`Visible draw submission budget: ${peakDraws}`);
assert.ok(materials.size>0&&[...materials].every(m=>!m.transmission),'No refractive offscreen render pass');
assert.ok(new Set(SHOTS.map(shot=>shot.side)).size===2,'Captions alternate to suit each composition');
assert.ok(Math.max(...SHOTS.map(s=>s.scale))/Math.min(...SHOTS.map(s=>s.scale))>2,'Substantial scale variation');
const fakeArt=Object.fromEntries(['submitty','flora','seas'].map(key=>[key,{image:{width:1920,height:960}}]));
const art=createProjectParallax(fakeArt),artCamera=new PerspectiveCamera(48,1.6,.1,250);
for(const p of [3.5,4,4.5,5.5,6,6.5,7]){
  art.update(artCamera,p,.5,-.5);
  for(const mesh of art.root.children){assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.depthTest,false);assert.equal(mesh.scale.x,mesh.scale.y,'Image aspect ratio is preserved');}
}
for(const name of ['nebula.jpg','veil.png','planet-0.png','planet-1.png','planet-2.png'])assert.ok(fs.statSync(new URL(`../assets/img/workshop/${name}`,import.meta.url)).size>1000,`Baked artwork exists: ${name}`);
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
console.log(`Verified ${Math.round(triangles).toLocaleString()} triangles, at most ${peakDraws} visible mesh/point submissions, baked artwork, parallax image layers, collision clearance, forward/reverse flight, responsive camera framing, reduced motion, and complete resume details.`);
