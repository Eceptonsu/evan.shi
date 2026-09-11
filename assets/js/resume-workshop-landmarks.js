import * as T from './lib/three/three.module.min.js';

// Large spatial subjects give the small handcrafted details a world to inhabit.
// Surface color is baked into vertices once; no textures or noise fragment loops.
export function createCelestialLandmarks(chapters){
  const animated=[];
  function planet(parent,name,radius,position,low,high){
    const geometry=new T.SphereGeometry(radius,40,28),vertices=geometry.attributes.position,colors=[];
    const a=new T.Color(low),b=new T.Color(high),color=new T.Color();
    for(let i=0;i<vertices.count;i++){
      const x=vertices.getX(i)/radius,y=vertices.getY(i)/radius,z=vertices.getZ(i)/radius;
      const field=Math.sin(x*9+Math.sin(z*7)*1.3)+Math.sin(y*13-z*5)*.5+Math.cos(z*17+x*3)*.23;
      color.copy(a).lerp(b,T.MathUtils.smoothstep(field,-.3,.65));colors.push(...color);
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const body=new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:.64,metalness:.2}));
    body.name=name;body.position.set(...position);parent.add(body);animated.push(body);return body;
  }
  function orbit(parent,radius,color,rotation=[0,0,0]){
    const ring=new T.Mesh(new T.TorusGeometry(radius,.022,6,128),new T.MeshBasicMaterial({color,toneMapped:false}));
    ring.rotation.set(...rotation);parent.add(ring);return ring;
  }
  const eclipse=planet(chapters[0],'Eclipse horizon',3.15,[1.5,.3,-5],0x071124,0x0d2031);
  orbit(eclipse,3.25,0xffd6a0);orbit(eclipse,3.4,0xa2c9e9,[.1,.05,0]);
  const systems=planet(chapters[3],'Connected world',4,[-2,-1.4,-6],0x12314f,0x548e9d);
  orbit(systems,4.6,0xaddbd3,[.8,.3,.35]);orbit(systems,4.9,0xd4ad79,[1.4,-.4,-.3]);
  const research=planet(chapters[4],'Observatory moon',2.8,[1,-1.2,-5],0x2f3b61,0x838eab);
  orbit(research,3.4,0xd3b080,[.8,.3,-.5]);
  const ocean=planet(chapters[5],'Ocean and garden world',3.6,[-1.2,-2,-5.2],0x102951,0x459789);
  orbit(ocean,4.15,0x8bbbcf,[1.15,-.4,.25]);
  return {animated,update(progress,time){animated.forEach((body,i)=>{body.rotation.y=progress*.09+time*(i%2?.007:-.005);});}};
}
