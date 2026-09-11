import * as T from './lib/three/three.module.min.js';
import { sampleStory, STORY_CENTER } from './resume-workshop-path.js';

// The same points carry through every chapter. Shapes refer to the work: a
// world, neural connections, a clock, open circuits, a book, and metamorphosis.
export function createStoryThread(){
  const count=1800,shapes=Array.from({length:8},()=>new Float32Array(count*3));
  for(let i=0;i<count;i++){
    const u=(i+.5)/count,a=i*2.39996,y=1-2*u,r=Math.sqrt(1-y*y),t=u*Math.PI*2;
    const sphere=[Math.cos(a)*r,y,Math.sin(a)*r];
    shapes[0].set(sphere.map(v=>v*.76),i*3);
    shapes[1].set(sphere.map(v=>v*1.16),i*3);
    const knotRadius=.46*(2+Math.cos(3*t)),ripple=Math.sin(a)*.06;
    shapes[2].set([knotRadius*Math.cos(t*2)+ripple,knotRadius*Math.sin(t*2)+ripple,.46*Math.sin(t*3)],i*3);
    shapes[3].set([-1.65+Math.cos(a)*(.64+(i%3)*.03),-.78+Math.sin(a)*(.64+(i%3)*.03),1.12+Math.sin(t)*.06],i*3);
    const strip=((i%31)/30-.5)*.65;
    shapes[4].set([(1.28+strip*Math.cos(t/2))*Math.cos(t),strip*Math.sin(t/2),(1.28+strip*Math.cos(t/2))*Math.sin(t)],i*3);
    const pageU=(i%61)/60,side=i%2?1:-1;
    shapes[5].set([side*pageU*1.43,-.5+.25*Math.sin(pageU*Math.PI)+.08*pageU,(u-.5)*1.7],i*3);
    // Finding Flora's caterpillar-to-butterfly transformation becomes the last
    // state of the common thread, surrounding the botanical and sailing pieces.
    const wing=(Math.exp(Math.cos(t))-2*Math.cos(4*t)-Math.pow(Math.sin(t/12),5))*.57;
    shapes[6].set([Math.sin(t)*wing,Math.cos(t)*wing*.72,.2*Math.sin(a)],i*3);
    shapes[7].set([Math.sin(t)*wing,Math.cos(t)*wing*.72,.2*Math.sin(a)],i*3);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(shapes[0],3));geometry.setAttribute('destination',new T.BufferAttribute(shapes[1],3));
  const uniforms={blend:{value:0},time:{value:0},tint:{value:new T.Color('#dac9a2')}};
  const colors=['#dac9a2','#7bc9b0','#99e4ea','#cddbaa','#cbb0d6','#e3d9bd','#91e2bf','#91e2bf'].map(color=>new T.Color(color));
  const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`attribute vec3 destination;uniform float blend;uniform float time;varying float pulse;void main(){vec3 p=mix(position,destination,blend);pulse=.65+.25*sin(float(gl_VertexID)*.37+time*.7);vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(30./max(2.,-v.z),1.2,5.);}`,
    fragmentShader:`uniform vec3 tint;varying float pulse;void main(){float r=length(gl_PointCoord-.5)*2.;float light=exp(-r*r*4.)*(1.-smoothstep(.65,1.,r));gl_FragColor=vec4(tint,light*pulse*.58);}`
  });
  const points=new T.Points(geometry,material);points.name='Continuous story thread';points.position.set(...STORY_CENTER);points.frustumCulled=false;let previous=-1;
  return {points,animate(progress,time){const {index,blend}=sampleStory(progress);if(index!==previous){geometry.attributes.position.array=shapes[index];geometry.attributes.position.needsUpdate=true;geometry.attributes.destination.array=shapes[index+1];geometry.attributes.destination.needsUpdate=true;previous=index;}uniforms.blend.value=blend;uniforms.time.value=time;uniforms.tint.value.copy(colors[index]).lerp(colors[index+1],blend);}};
}
