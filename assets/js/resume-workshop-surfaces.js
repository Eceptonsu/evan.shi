import * as T from './lib/three/three.module.min.js';

// Seamless spherical color maps, computed once on opening. Finer terrain than
// interpolated vertex colors, with one ordinary texture sample while rendering.
export function createPlanetSurface(low,high,rocky=false){
  const width=512,height=256,pixels=new Uint8Array(width*height*4);
  const deep=new T.Color(low),land=new T.Color(high),color=new T.Color();
  for(let row=0;row<height;row++){
    const theta=(1-row/(height-1))*Math.PI,s=Math.sin(theta),y=Math.cos(theta);
    for(let column=0;column<width;column++){
      const phi=column/(width-1)*Math.PI*2,x=-Math.cos(phi)*s,z=Math.sin(phi)*s;
      const warp=Math.sin(x*5+z*3)*.7+Math.cos(y*7-z*4)*.35;
      const broad=Math.sin(x*8+warp)+Math.sin(y*11-z*5+warp)*.5+Math.cos(z*13+x*4)*.3;
      const fine=Math.sin(x*47+y*29+warp*4)*Math.cos(z*53-y*17)*.13;
      const grain=Math.sin(x*157+z*93)*Math.sin(y*139-z*71)*.035;
      const terrain=T.MathUtils.smoothstep(broad+fine,-.2,.6);
      color.copy(deep).lerp(land,rocky?T.MathUtils.clamp(.5+broad*.18+fine,0,1):terrain);
      // A pale coastal shelf and fine mineral variation break up the silhouettes.
      if(!rocky){const coast=Math.exp(-Math.pow((broad+fine-.16)*9,2));color.lerp(land,coast*.28);}
      color.multiplyScalar(1+fine*.35+grain+(rocky?Math.sin(x*73-z*41+y*57)*.045:0));
      color.convertLinearToSRGB();const offset=(row*width+column)*4;
      pixels[offset]=Math.min(255,Math.round(color.r*255));pixels[offset+1]=Math.min(255,Math.round(color.g*255));pixels[offset+2]=Math.min(255,Math.round(color.b*255));pixels[offset+3]=255;
    }
  }
  const texture=new T.DataTexture(pixels,width,height);
  texture.colorSpace=T.SRGBColorSpace;texture.wrapS=T.RepeatWrapping;
  texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  texture.name=rocky?'Mineral surface':'Coastal terrain';return texture;
}
