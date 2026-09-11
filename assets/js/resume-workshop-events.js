import * as T from './lib/three/three.module.min.js';

// Scroll is the clock: scrubbing backwards retraces each comet instead of
// restarting a timer. All tails share one draw call and reusable buffers.
export const COMET_PASSES=[
  {start:.25,end:1.35,from:[-19,9,-15],to:[17,-3,-7],bend:4},
  {start:1.8,end:2.9,from:[19,8,-18],to:[-18,-2,-5],bend:-3},
  {start:3.45,end:4.75,from:[-20,-5,-11],to:[18,11,-19],bend:5},
  {start:5.35,end:6.8,from:[20,12,-16],to:[-19,-4,-5],bend:3},
];
export function cometPosition(pass,t,target=new T.Vector3()){
  return target.set(
    T.MathUtils.lerp(pass.from[0],pass.to[0],t),
    T.MathUtils.lerp(pass.from[1],pass.to[1],t)+Math.sin(t*Math.PI)*pass.bend,
    T.MathUtils.lerp(pass.from[2],pass.to[2],t));
}
export function createCosmicEvents(){
  const root=new T.Group();root.name='Scroll-driven cosmic events';
  const count=96,positions=new Float32Array(COMET_PASSES.length*count*3),ages=[],colors=[],strengths=new Float32Array(COMET_PASSES.length*count);
  const palette=[0xa5eaff,0xffd6ac,0xb6b1ff,0x97f6d9];
  COMET_PASSES.forEach((_,i)=>{const tint=new T.Color(palette[i]);for(let j=0;j<count;j++){ages.push(j/(count-1));colors.push(...tint);}});
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('strength',new T.BufferAttribute(strengths,1).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('age',new T.Float32BufferAttribute(ages,1));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`attribute float age;attribute float strength;attribute vec3 color;varying float opacity;varying vec3 tint;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;tint=color;opacity=pow(1.-age,1.7)*strength;gl_PointSize=clamp((1.-age*.65)*190./max(3.,-p.z),1.,24.);}`,
    fragmentShader:`varying float opacity;varying vec3 tint;void main(){float r=length(gl_PointCoord-.5)*2.;float halo=exp(-r*r*4.)*(1.-smoothstep(.65,1.,r));gl_FragColor=vec4(tint,halo*opacity);}`});
  const comets=new T.Points(geometry,material);comets.name='Comet trails';comets.frustumCulled=false;root.add(comets);
  // One instanced belt adds nearer silhouettes and a sense of passing distance.
  const rocks=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshStandardMaterial({color:0x688b9c,roughness:.86,metalness:.18}),100);
  rocks.name='Orbital debris arc';const pose=new T.Object3D();
  for(let i=0;i<100;i++){
    const a=i/99*Math.PI*1.65-.5,r=12+Math.sin(i*7.13)*1.3,size=.035+(i%9)*.014;
    pose.position.set(Math.cos(a)*r,Math.sin(a)*r*.4+1,-12+Math.sin(a)*3);
    pose.rotation.set(i*.7,i*1.3,i*.4);pose.scale.set(size,size*.65,size*1.5);pose.updateMatrix();rocks.setMatrixAt(i,pose.matrix);
  }
  root.add(rocks);let previous=-1;const point=new T.Vector3();
  return {root,update(progress,stationary=false){
    comets.visible=!stationary;
    rocks.rotation.z=Math.sin(progress*.45)*.18;rocks.position.x=Math.sin(progress*.65)*2;
    if(progress===previous)return;previous=progress;
    COMET_PASSES.forEach((pass,i)=>{
      const t=(progress-pass.start)/(pass.end-pass.start);
      const fade=T.MathUtils.smoothstep(t,0,.15)*(1-T.MathUtils.smoothstep(t,.8,1));
      for(let j=0;j<count;j++){
        const age=j/(count-1),index=i*count+j;
        cometPosition(pass,t-age*.24,point);point.y+=Math.sin(age*6+i)*age*.12;
        positions.set(point.toArray(),index*3);strengths[index]=fade;
      }
    });
    geometry.attributes.position.needsUpdate=true;geometry.attributes.strength.needsUpdate=true;
  }};
}
