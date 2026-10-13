import * as T from './lib/three/three.module.min.js';

const sources={nebula:'workshop/nebula.jpg',veil:'workshop/veil.png',
  planet0:'workshop/planet-0.png',planet1:'workshop/planet-1.png',planet2:'workshop/planet-2.png'};
for(const kind of ['terrain','ocean'])for(const channel of ['color','height','roughness'])sources[`${kind}_${channel}`]=`workshop/${kind}-${channel}.jpg`;
// NASA Earth Observatory / NASA's Scientific Visualization Studio. See
// licenses/workshop-art.md for source URLs and attribution.
sources.earth_color='workshop/earth-color.jpg';
sources.moon_color='workshop/lunar-color.jpg';
sources.moon_height='workshop/lunar-height.jpg';

export async function loadWorkshopArt(){
  const textures={},loader=new T.TextureLoader();
  await Promise.all(Object.entries(sources).map(async([key,path])=>{
    try{const texture=await loader.loadAsync(new URL(`../img/${path}`,import.meta.url).href);
      texture.colorSpace=key.endsWith('_height')||key.endsWith('_roughness')?T.NoColorSpace:T.SRGBColorSpace;
      if(key.includes('_'))texture.wrapS=T.RepeatWrapping;
      textures[key]=texture;
    }catch(error){console.warn(`Workshop artwork unavailable: ${key}`,error);}
  }));
  return textures;
}
