import * as T from './lib/three/three.module.min.js';

// Pre-lit planetary portraits replace expensive per-pixel crater and noise loops.
export function createDetailedPlanets(textures={}){
  const root=new T.Group();root.name='Distant planetary systems';
  const bodies=[];
  for(const [kind,x,y,z,size] of [[0,-19,10,-29,29],[1,24,-8,-20,21],[2,-24,-5,12,13]]){
    const texture=textures[`planet${kind}`];
    const body=new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({
      map:texture||null,transparent:true,depthWrite:false,toneMapped:false,opacity:texture?1:0}));
    body.position.set(x,y,z);body.name=['Banded storm planet','Fractured ice world','Cratered copper moon'][kind];
    root.add(body);bodies.push(body);
  }
  return {root,animate(){},faceCamera(quaternion){if(quaternion)bodies.forEach(body=>body.quaternion.copy(quaternion));}};
}
