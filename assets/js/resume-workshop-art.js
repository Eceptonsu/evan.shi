import * as T from './lib/three/three.module.min.js';

const sources={nebula:'workshop/nebula.jpg',veil:'workshop/veil.png',
  planet0:'workshop/planet-0.png',planet1:'workshop/planet-1.png',planet2:'workshop/planet-2.png'};

export async function loadWorkshopArt(){
  const textures={},loader=new T.TextureLoader();
  await Promise.all(Object.entries(sources).map(async([key,path])=>{
    try{const texture=await loader.loadAsync(new URL(`../img/${path}`,import.meta.url).href);
      texture.colorSpace=T.SRGBColorSpace;textures[key]=texture;
    }catch(error){console.warn(`Workshop artwork unavailable: ${key}`,error);}
  }));
  return textures;
}
