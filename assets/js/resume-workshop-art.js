import * as T from './lib/three/three.module.min.js';

const sources={nebula:'workshop/nebula.jpg',veil:'workshop/veil.png',
  planet0:'workshop/planet-0.png',planet1:'workshop/planet-1.png',planet2:'workshop/planet-2.png',
  flora:'projects/finding-flora@0,5.jpg',seas:'projects/troubled-seas@0,5.png',submitty:'projects/submitty_demo.png'};

export async function loadWorkshopArt(){
  const textures={},loader=new T.TextureLoader();
  await Promise.all(Object.entries(sources).map(async([key,path])=>{
    try{const texture=await loader.loadAsync(new URL(`../img/${path}`,import.meta.url).href);
      texture.colorSpace=T.SRGBColorSpace;textures[key]=texture;
    }catch(error){console.warn(`Workshop artwork unavailable: ${key}`,error);}
  }));
  return textures;
}

// The linked parallax skill's image-plane approach: preserve the original image
// ratio, layer back to front, and give each image its own scroll and mouse travel.
export function createProjectParallax(textures={}){
  const root=new T.Group();root.name='Project image parallax';
  const pixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const edge=Math.min(x,y,63-x,63-y)/5;
    const value=Math.round(T.MathUtils.smoothstep(edge,0,1)*255);
    pixels.set([value,value,value,255],(y*64+x)*4);
  }
  const feather=new T.DataTexture(pixels,64,64);feather.needsUpdate=true;
  feather.magFilter=T.LinearFilter;feather.minFilter=T.LinearFilter;
  const specs=[
    {key:'submitty',chapter:4,x:-.20,y:.06,width:.61,z:-14,fx:.34,fy:-.18,tilt:.035},
    {key:'seas',chapter:5.85,x:.22,y:.17,width:.57,z:-16,fx:-.37,fy:.20,tilt:-.08},
    {key:'flora',chapter:6.3,x:-.19,y:-.09,width:.51,z:-10,fx:.48,fy:-.25,tilt:.055},
  ];
  const layers=specs.map((spec,index)=>{
    const texture=textures[spec.key],ratio=texture?texture.image.width/texture.image.height:2;
    const mesh=new T.Mesh(new T.PlaneGeometry(ratio,1),new T.MeshBasicMaterial({
      map:texture||null,alphaMap:feather,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,opacity:0}));
    mesh.name=`Project artwork: ${spec.key}`;mesh.renderOrder=20+index;root.add(mesh);
    return {mesh,ratio,...spec};
  });
  return {root,update(camera,progress,mouseX,mouseY){
    root.position.copy(camera.position);root.quaternion.copy(camera.quaternion);
    const portrait=camera.aspect<1;
    for(const layer of layers){
      const {mesh,chapter,z,ratio}=layer,d=progress-chapter;
      const envelope=T.MathUtils.smoothstep(1-Math.abs(d)/.95,0,1);
      mesh.visible=!!textures[layer.key]&&envelope>.005;
      if(!mesh.visible)continue;
      const height=2*Math.tan(T.MathUtils.degToRad(camera.fov/2))*-z,width=height*camera.aspect;
      const imageWidth=width*(portrait?.88:layer.width)*(1+d*.12);
      mesh.scale.set(imageWidth/ratio,imageWidth/ratio,1);
      mesh.position.set(width*((portrait?0:layer.x)+d*layer.fx+mouseX*.018),height*((portrait?.12:layer.y)+d*layer.fy-mouseY*.012),z);
      mesh.rotation.z=layer.tilt+d*.045;mesh.material.opacity=envelope*.94;
    }
  }};
}
