import * as T from './lib/three/three.module.min.js';

const noiseGLSL=`
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.03+vec3(3.7,9.2,1.5);a*=.5;}return n;}
`;
const vertexShader=`
varying vec3 p;varying vec3 worldPoint;varying vec3 worldNormal;
void main(){p=normalize(position);worldPoint=(modelMatrix*vec4(position,1.)).xyz;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;

export function createDetailedPlanets(){
  const root=new T.Group();root.name='Detailed background planets';
  const bodies=[];
  const light=new T.Vector3(-.8,.45,.7).normalize();
  // Fixed spherical crater positions avoid both texture seams and polar stretching.
  const craters=Array.from({length:24},(_,i)=>{
    const y=1-2*(i+.5)/24,a=i*2.39996,r=Math.sqrt(1-y*y);
    return new T.Vector4(Math.cos(a)*r,y,Math.sin(a)*r,.055+(i%5)*.031);
  });
  const fragmentShader=`
uniform float kind;uniform float time;uniform vec3 sun;uniform vec4 craters[24];
varying vec3 p;varying vec3 worldPoint;varying vec3 worldNormal;
${noiseGLSL}
void main(){
  vec3 d=normalize(p);float coarse=fbm(d*5.);float grain=noise(d*170.);float height=0.;float ocean=0.;vec3 color;
  if(kind<.5){
    // Turbulent cloud belts at several scales, with an elliptical storm system.
    float warp=fbm(d*16.+vec3(0.,time*.008,0.));
    float belt=sin(d.y*72.+warp*6.+coarse*5.);
    float lace=sin(d.y*240.+warp*14.)*.5+.5;
    color=mix(vec3(.13,.12,.25),vec3(.56,.38,.31),smoothstep(-.65,.7,belt));
    color=mix(color,vec3(.68,.58,.49),pow(lace,5.)*.38);
    color=mix(color,vec3(.07,.27,.34),smoothstep(.63,.78,warp)*.5);
    vec3 center=normalize(vec3(.3,.12,1.)),east=normalize(vec3(1.,0.,-.3)),north=cross(center,east);
    vec2 q=vec2(dot(d,east)*1.3,dot(d,north)*2.4);float r=length(q);
    float storm=exp(-r*r*38.)*smoothstep(.6,.9,dot(d,center));
    float curl=sin(atan(q.y,q.x)+r*65.+warp*9.);
    color=mix(color,mix(vec3(.25,.09,.13),vec3(.85,.6,.4),curl*.5+.5),storm*.9);
    height=(belt*.002+warp*.015);color*=.94+grain*.12;
  }else{
    float relief=fbm(d*14.),fine=fbm(d*48.);height=relief*.095+fine*.018;
    float craterRim=0.,basin=0.;
    for(int i=0;i<24;i++){
      float q=distance(d,craters[i].xyz)/craters[i].w;
      float bowl=(1.-smoothstep(.05,.82,q))*.075;
      float rim=exp(-pow((q-.91)*13.,2.))*.047;
      height+=rim-bowl;craterRim+=rim;basin+=bowl;
    }
    if(kind<1.5){
      // Blue mineral seas, fractured ice shelves, and bright polar frost.
      ocean=1.-smoothstep(.38,.49,coarse);
      color=mix(vec3(.42,.64,.7),vec3(.018,.13,.23),ocean);
      float fissure=1.-smoothstep(.008,.027,abs(relief-.48));
      color=mix(color,vec3(.045,.29,.38),fissure*(1.-ocean)*.8);
      float cap=smoothstep(.63,.88,abs(d.y)+fine*.16);
      color=mix(color,vec3(.8,.86,.84),cap);
      color+=craterRim*.7; height*=.5*(1.-ocean);height-=fissure*.007;
    }else{
      // Oxidized ridges and dark basalt basins reveal a cratered rocky surface.
      color=mix(vec3(.12,.105,.13),vec3(.5,.29,.19),smoothstep(.26,.72,coarse));
      color*=.72+fine*.65+grain*.14;
      color+=vec3(.53,.4,.29)*craterRim*3.;color*=1.-min(.5,basin*4.);
    }
  }
  // Screen-space height derivatives turn small ridges and crater rims into
  // surface normals without adding hundreds of thousands of mesh vertices.
  vec3 n=normalize(worldNormal),sx=dFdx(worldPoint),sy=dFdy(worldPoint);
  vec3 rx=cross(sy,n),ry=cross(n,sx);float det=dot(sx,rx);
  vec3 gradient=sign(det)*(dFdx(height)*rx+dFdy(height)*ry);
  n=normalize(abs(det)*n-gradient);
  vec3 view=normalize(cameraPosition-worldPoint);float day=max(0.,dot(n,sun));
  float rim=pow(1.-max(0.,dot(view,n)),3.);
  vec3 lit=color*(.045+day*1.4);
  if(kind<1.5)lit+=vec3(.07,.18,.3)*rim*smoothstep(-.35,.4,dot(n,sun))*.6;
  if(kind>.5&&kind<1.5)lit+=vec3(.65,.8,.9)*pow(max(0.,dot(n,normalize(sun+view))),70.)*ocean*.55;
  gl_FragColor=vec4(lit,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

  function atmosphere(parent,r,color){
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      uniforms:{tint:{value:new T.Color(color)},sun:{value:light}},vertexShader,
      fragmentShader:`uniform vec3 tint;uniform vec3 sun;varying vec3 worldPoint;varying vec3 worldNormal;void main(){vec3 n=normalize(worldNormal),view=normalize(cameraPosition-worldPoint);float rim=pow(1.-max(0.,dot(n,view)),3.5);float day=smoothstep(-.3,.65,dot(n,sun));gl_FragColor=vec4(tint,rim*(.12+day*.32));}`
    });
    parent.add(new T.Mesh(new T.SphereGeometry(r*1.026,64,40),material));
  }
  for(const [kind,x,y,z,r] of [[0,-23,13,-33,5],[1,34,-8,-22,3.4],[2,-28,0,25,2.2]]){
    const system=new T.Group();system.position.set(x,y,z);system.rotation.z=kind===0?-.32:.18;system.scale.setScalar(kind===0?1.35:1.15);root.add(system);
    const uniforms={kind:{value:kind},time:{value:0},sun:{value:light},craters:{value:craters}};
    const material=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader});
    const body=new T.Mesh(new T.SphereGeometry(r,96,64),material);body.name=['Banded storm planet','Fractured ice world','Cratered copper moon'][kind];system.add(body);bodies.push({body,uniforms,kind});
    if(kind<2)atmosphere(system,r,kind===0?0x8e97ff:0x68dcff);
    if(kind===0){
      const rings=new T.Mesh(new T.RingGeometry(6,10,192),new T.ShaderMaterial({side:T.DoubleSide,transparent:true,depthWrite:false,
        vertexShader:`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader:`varying vec3 p;void main(){float r=length(p.xy);float grain=.5+.23*sin(r*77.)+.16*sin(r*183.)+.1*sin(r*391.);float edge=smoothstep(6.,6.2,r)*(1.-smoothstep(9.6,10.,r));float gaps=smoothstep(.03,.12,abs(r-7.6))*smoothstep(.015,.045,abs(r-8.7));float shade=mix(.2,1.,smoothstep(-.75,.2,p.x/r));vec3 c=mix(vec3(.25,.24,.42),vec3(.8,.66,.5),grain)*shade;gl_FragColor=vec4(c,edge*gaps*(.16+grain*.42));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`
      }));rings.rotation.x=-Math.PI/2+.2;system.add(rings);
    }
  }
  return {root,animate(time){bodies.forEach(({body,uniforms,kind})=>{uniforms.time.value=time;body.rotation.y=time*(kind===0?.012:.007);});}};
}
