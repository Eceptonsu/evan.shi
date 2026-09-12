import * as T from './lib/three/three.module.min.js';
import { createPlanetSurface } from './resume-workshop-surfaces.js';

// Large spatial subjects give the small handcrafted details a world to inhabit.
// Surface maps are generated once, with no procedural noise fragment loops.
export function createCelestialLandmarks(chapters){
  const animated=[];
  function planet(parent,name,radius,position,low,high){
    const geometry=new T.SphereGeometry(radius,56,36);
    const rocky=name==='Observatory moon',map=createPlanetSurface(low,high,rocky);
    const body=new T.Mesh(geometry,new T.MeshStandardMaterial({map,roughness:rocky?.88:.53,metalness:rocky?0:.12}));
    body.name=name;body.position.set(...position);parent.add(body);animated.push(body);return body;
  }
  function orbit(parent,radius,color,rotation=[0,0,0]){
    const ring=new T.Mesh(new T.TorusGeometry(radius,.022,6,128),new T.MeshBasicMaterial({color,toneMapped:false}));
    ring.rotation.set(...rotation);parent.add(ring);return ring;
  }
  // A single coherent limb replaces the two detached hoops and mottled vertex
  // colors, which made the opening globe read as intersecting disks.
  const eclipse=new T.Mesh(new T.SphereGeometry(3.15,40,28),new T.MeshStandardMaterial({
    color:0x152939,roughness:.92,metalness:0,envMapIntensity:.2}));
  eclipse.name='Eclipse horizon';eclipse.position.set(1.5,.3,-5);chapters[0].add(eclipse);
  const atmosphere=new T.Mesh(new T.SphereGeometry(3.24,40,24),new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.BackSide,blending:T.AdditiveBlending,
    uniforms:{chapterOpacity:{value:1}},
    vertexShader:`varying vec3 viewNormal;varying vec3 viewPoint;void main(){vec4 p=modelViewMatrix*vec4(position,1.);viewNormal=normalize(normalMatrix*normal);viewPoint=p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform float chapterOpacity;varying vec3 viewNormal;varying vec3 viewPoint;void main(){vec3 n=normalize(viewNormal);float rim=pow(1.-abs(dot(n,normalize(-viewPoint))),3.5);float light=.3+.7*smoothstep(-.6,.7,dot(n,normalize(vec3(-.7,.6,.4))));gl_FragColor=vec4(.38,.66,.85,rim*light*.42*chapterOpacity);}`
  }));
  atmosphere.name='Soft atmospheric limb';eclipse.add(atmosphere);
  const systems=planet(chapters[3],'Connected world',4,[-2,-1.4,-6],0x12314f,0x548e9d);
  orbit(systems,4.6,0xaddbd3,[.8,.3,.35]);orbit(systems,4.9,0xd4ad79,[1.4,-.4,-.3]);
  const research=planet(chapters[4],'Observatory moon',2.8,[1,-1.2,-5],0x2f3b61,0x838eab);
  orbit(research,3.4,0xd3b080,[.8,.3,-.5]);
  const ocean=planet(chapters[5],'Ocean and garden world',3.6,[-1.2,-2,-5.2],0x102951,0x459789);
  orbit(ocean,4.15,0x8bbbcf,[1.15,-.4,.25]);
  return {animated,update(progress,time){animated.forEach((body,i)=>{body.rotation.y=progress*.09+time*(i%2?.007:-.005);});}};
}
