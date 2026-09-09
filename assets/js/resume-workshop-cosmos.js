import * as T from './lib/three/three.module.min.js';
import { createDetailedPlanets } from './resume-workshop-planets.js';

// Entirely procedural: the nebula wraps every camera angle without image seams.
export function createCosmos() {
  const root=new T.Group();root.name='Interstellar sky';
  const uniforms={time:{value:0}};
  const skyMaterial=new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      varying vec3 direction;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<4;i++){n+=noise(p)*a;p=p*2.07+vec3(6.2,1.7,9.2);a*=.5;}return n;}
      void main(){
        vec3 d=normalize(direction);float cloud=fbm(d*5.+vec3(2.,7.,1.));
        float band=exp(-pow((d.y*.82+d.x*.4-d.z*.25+.12+(cloud-.5)*.6)*2.6,2.));
        float detail=fbm(d*19.+cloud*3.);float veil=smoothstep(.24,.76,cloud)*band;
        vec3 tint=mix(vec3(.12,.035,.3),vec3(.025,.28,.39),smoothstep(-.7,.8,d.x+d.z));
        vec3 c=vec3(.004,.007,.025)+tint*veil*1.65;
        c+=vec3(.36,.14,.3)*pow(veil,2.)*detail;
        float thread=pow(max(0.,1.-abs(detail-.48)*4.),7.)*veil;
        c+=vec3(.12,.22,.35)*thread*.4;
        c*=1.-smoothstep(.48,.7,detail)*band*.68;
        float core=pow(max(0.,dot(d,normalize(vec3(-.6,.15,-.8)))),40.);
        c+=vec3(.62,.31,.23)*core*.7;
        gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
      }`
  });
  const sky=new T.Mesh(new T.SphereGeometry(110,48,32),skyMaterial);sky.name='Nebula backdrop';sky.position.set(6,3,4);root.add(sky);

  let seed=2718;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const positions=[],colors=[],sizes=[],phases=[];
  const palette=[new T.Color('#e4e9ff'),new T.Color('#b0dffe'),new T.Color('#f6cda5'),new T.Color('#c6b4fa')];
  for(let i=0;i<2400;i++){
    const y=random()*2-1,a=random()*Math.PI*2,r=i<2100?48+random()*43:15+random()*28,s=Math.sqrt(1-y*y);
    positions.push(6+Math.cos(a)*s*r,3+y*r,4+Math.sin(a)*s*r);
    colors.push(...palette[i%4].toArray());sizes.push(i%37===0?3.8:1.+random()*1.5);phases.push(random()*Math.PI*2);
  }
  const starGeometry=new T.BufferGeometry();
  starGeometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  starGeometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  starGeometry.setAttribute('size',new T.Float32BufferAttribute(sizes,1));
  starGeometry.setAttribute('phase',new T.Float32BufferAttribute(phases,1));
  const starMaterial=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`attribute vec3 color;attribute float size;attribute float phase;uniform float time;varying vec3 tint;varying float brightness;void main(){vec4 p=modelViewMatrix*vec4(position,1.);tint=color;brightness=.68+.22*sin(time*.55+phase);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*65./max(12.,-p.z),1.,9.);}`,
    fragmentShader:`varying vec3 tint;varying float brightness;void main(){float r=length(gl_PointCoord-.5)*2.;float light=exp(-r*r*5.)*(1.-smoothstep(.6,1.,r));gl_FragColor=vec4(tint*brightness,light);}`
  });
  const stars=new T.Points(starGeometry,starMaterial);root.add(stars);
  stars.name='Distant starfield';
  const middleGeometry=new T.BufferGeometry(),middlePositions=[];
  for(let i=0;i<650;i++){const y=random()*2-1,a=random()*Math.PI*2,r=30+random()*35,s=Math.sqrt(1-y*y);middlePositions.push(Math.cos(a)*s*r,y*r,Math.sin(a)*s*r);}
  middleGeometry.setAttribute('position',new T.Float32BufferAttribute(middlePositions,3));
  for(const name of ['color','size','phase'])middleGeometry.setAttribute(name,new T.BufferAttribute(starGeometry.attributes[name].array.slice(0,650*starGeometry.attributes[name].itemSize),starGeometry.attributes[name].itemSize));
  const middleStars=new T.Points(middleGeometry,starMaterial);middleStars.name='Middle starfield';root.add(middleStars);

  // Nearby motes keep their world positions as the camera passes, then recycle
  // outside the view. They provide a much faster parallax layer than the sky.
  const dustPositions=[],dustPhases=[];
  for(let i=0;i<180;i++){dustPositions.push((random()-.5)*70,(random()-.5)*70,(random()-.5)*70);dustPhases.push(random()*6.28);}
  const dustGeometry=new T.BufferGeometry();dustGeometry.setAttribute('position',new T.Float32BufferAttribute(dustPositions,3));dustGeometry.setAttribute('phase',new T.Float32BufferAttribute(dustPhases,1));
  const dustUniforms={time:uniforms.time,eye:{value:new T.Vector3()}};
  const dust=new T.Points(dustGeometry,new T.ShaderMaterial({uniforms:dustUniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`uniform vec3 eye;uniform float time;attribute float phase;varying float opacity;void main(){vec3 delta=mod(position-eye+35.,70.)-35.;vec3 pos=eye+delta;pos.y+=sin(time*.15+phase)*.18;vec4 view=modelViewMatrix*vec4(pos,1.);float distanceToEye=length(delta);opacity=smoothstep(2.,7.,distanceToEye)*(1.-smoothstep(25.,34.,distanceToEye))*.3;gl_Position=projectionMatrix*view;gl_PointSize=clamp(70./max(2.,-view.z),2.,13.);}`,
    fragmentShader:`varying float opacity;void main(){float r=length(gl_PointCoord-.5)*2.;float glow=exp(-r*r*5.)*(1.-smoothstep(.6,1.,r));gl_FragColor=vec4(.64,.82,1.,glow*opacity);}`
  }));dust.name='Foreground stardust';dust.frustumCulled=false;root.add(dust);

  const veils=new T.Group();veils.name='Nebula veils';root.add(veils);
  for(const [x,y,z,phase,color] of [[-18,12,-42,.3,0x8d73dc],[30,-12,-60,1.8,0x4aaebf]]){
    const veil=new T.Mesh(new T.PlaneGeometry(90,48),new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      uniforms:{time:uniforms.time,phase:{value:phase},tint:{value:new T.Color(color)}},
      vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 v;uniform float time;uniform float phase;uniform vec3 tint;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec2 q=(v-.5)*2.;float cloud=noise(v*8.+phase)+noise(v*19.-phase)*.35;float curve=q.y-sin(q.x*2.+phase)*.22-(cloud-.6)*.27;float ribbon=exp(-curve*curve*24.);float edge=(1.-smoothstep(.45,1.,abs(q.x)))*(1.-smoothstep(.5,1.,abs(q.y)));float silk=.6+.4*sin(q.x*8.+cloud*5.+time*.025);gl_FragColor=vec4(tint*(.6+cloud*.4),ribbon*edge*silk*.16);}`
    }));veil.position.set(x,y,z);veil.rotation.z=phase*.2;veils.add(veil);
  }

  const planets=createDetailedPlanets();root.add(planets.root);
  return {root,animate(time){uniforms.time.value=time;planets.animate(time);},setViewPosition(position){
    // Distant bodies shift slowly; the enclosing nebula always surrounds the
    // camera, including at the far end of the extended journey.
    root.position.copy(position).multiplyScalar(.8);
    sky.position.copy(position).sub(root.position);
    stars.position.copy(position).multiplyScalar(.16);
    middleStars.position.copy(position).multiplyScalar(-.24);
    veils.position.copy(position).multiplyScalar(.1);
    planets.root.position.copy(position).multiplyScalar(-.04);
    dust.position.copy(root.position).negate();dustUniforms.eye.value.copy(position);
  }};
}
