import * as T from './lib/three/three.module.min.js';
import { RoundedBoxGeometry } from './lib/three/RoundedBoxGeometry.js';

// Bound volumes and printed surfaces, rather than giant sheets with tube text.
// Page color, grain, and ink are generated once; no font or image downloads.
function pagePrint(right=false){
  const size=1024;
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#e5e1d7';ctx.fillRect(0,0,size,size);
  let seed=317;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<14000;i++){
    ctx.fillStyle=i%2?'rgba(89,78,64,.025)':'rgba(255,255,255,.07)';
    ctx.fillRect(random()*size,random()*size,1+random()*2,1);
  }
  ctx.fillStyle='#485058';ctx.font='32px Georgia, serif';
  ctx.fillText(right?'Questions from office hours':'Notes on teaching',104,138);
  ctx.fillStyle='#8d877a';ctx.fillRect(104,164,816,1);
  ctx.fillStyle='#41484d';ctx.font='24px Georgia, serif';
  const lines=right?[
    'Start with a small example. Work through it together.',
    'Trace the structure before writing the next function.',
    'What changes? What should stay the same?',
    '',
    'A few questions are better than a page of answers.',
    'Leave room in the margin for another approach.',
    '',
    'Lists, trees, and the paths between them.',
  ]:[
    'A notebook from labs, classes, and office hours.',
    'Diagrams, small examples, and questions to revisit.',
    'Some ideas make more sense on the second pass.',
    '',
    'An example on the board. A test that does not pass.',
    'Follow the steps and see where the reasoning turns.',
    '',
    'There is usually more than one way to explain it.',
  ];
  lines.forEach((line,i)=>ctx.fillText(line,104,224+i*40));
  // A restrained notebook diagram, with the same cool ink as the scene.
  ctx.strokeStyle='#7e8b91';ctx.lineWidth=2;
  const nodes=right?[[310,635],[205,726],[415,726],[155,803],[270,803],[460,803]]:[[250,650],[380,635],[520,680],[690,635]];
  for(let i=1;i<nodes.length;i++){
    const from=nodes[right?Math.floor((i-1)/2):i-1],to=nodes[i];
    ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...to);ctx.stroke();
  }
  for(const [x,y] of nodes){ctx.beginPath();ctx.arc(x,y,13,0,Math.PI*2);ctx.fillStyle='#e5e1d7';ctx.fill();ctx.stroke();}
  ctx.fillStyle='#989185';ctx.font='16px Georgia, serif';ctx.fillText(right?'06':'05',900,936);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  texture.anisotropy=4;texture.name='Notebook paper and printed ink';return texture;
}

export function createResearchBook(){
  const book=new T.Group();book.name='Research book';
  const cover=new T.MeshPhysicalMaterial({color:0x344854,roughness:.13,metalness:.12,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:.85});
  const edge=new T.MeshStandardMaterial({color:0xd3cab8,roughness:.8,metalness:0,envMapIntensity:.2});
  const trim=new T.MeshStandardMaterial({color:0x929b9e,roughness:.28,metalness:.65});
  const ribbon=new T.MeshStandardMaterial({color:0x587387,roughness:.8,metalness:0,side:T.DoubleSide});
  const curve=u=>.19*Math.sin(u*Math.PI*.93)+.028*u;
  const top=.24,width=1.12,depth=1.62,gutter=.065;
  function add(geometry,material,name){const mesh=new T.Mesh(geometry,material);mesh.name=name;book.add(mesh);return mesh;}
  function volume(side,y,thickness,coverWing=false){
    const shape=new T.Shape(),extra=coverWing?.05:0;
    const outline=[];
    for(let i=0;i<=48;i++){
      const u=i/48;outline.push([side*(gutter+u*(width+extra)),y+curve(u)]);
    }
    shape.moveTo(...outline[0]);outline.slice(1).forEach(p=>shape.lineTo(...p));
    for(let i=48;i>=0;i--)shape.lineTo(outline[i][0],outline[i][1]-thickness);
    shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:depth+(coverWing?.09:0),steps:1,bevelEnabled:true,bevelThickness:coverWing?.012:.004,bevelSize:coverWing?.012:.004,bevelSegments:3,curveSegments:16});
    geometry.translate(0,0,-(depth+(coverWing?.09:0))/2);
    return geometry;
  }
  const lettering=new T.Group();lettering.name='Page lettering';book.add(lettering);
  const printed=[],boundPages=[];
  for(const side of [-1,1]){
    add(volume(side,.038,.065,true),cover,'Polished bound cover');
    boundPages.push(add(volume(side,top,.18),edge,'Bound page block'));
    // Fine, separated page edges give the volume scale without fourteen shells.
    for(let i=0;i<5;i++){
      const y=.075+i*.033;
      add(volume(side,y,.004),edge,'Fine page edge');
    }
    const positions=[],uvs=[],indices=[];
    for(let u=0;u<=48;u++)for(let v=0;v<=24;v++){
      positions.push(side*(gutter+u/48*width),top+curve(u/48)+.012,(v/24-.5)*depth);
      // Both pages read from spine to fore-edge, without mirroring the print.
      uvs.push(side<0?1-u/48:u/48,1-v/24);
    }
    for(let u=0;u<48;u++)for(let v=0;v<24;v++){
      const a=u*25+v,b=a+25;
      indices.push(...(side<0?[a,b,a+1,b,b+1,a+1]:[a,a+1,b,b,a+1,b+1]));
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new T.MeshStandardMaterial({color:0xe5e1d7,map:pagePrint(side>0),roughness:.75,metalness:0,side:T.DoubleSide,envMapIntensity:.2});
    // Crease shading remains subtle under the shared light; no bright paper cutout.
    const colors=[];
    for(let u=0;u<=48;u++)for(let v=0;v<=24;v++){
      const shade=.68+.32*T.MathUtils.smoothstep(u/48,0,.16);colors.push(shade,shade,shade);
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));material.vertexColors=true;
    const page=new T.Mesh(geometry,material);page.name='Printed curved page';lettering.add(page);printed.push(page);
  }
  const spine=add(new RoundedBoxGeometry(.19,.31,1.77,3,.055),cover,'Rounded book spine');spine.position.y=.095;
  for(const z of [-.59,.59]){
    const seam=add(new RoundedBoxGeometry(.2,.014,.018,2,.006),trim,'Binding accent');seam.position.set(0,.232,z);
  }
  // Cloth bookmark follows the page, then folds down over the fore-edge.
  const ribbonPositions=[],ribbonUvs=[],ribbonIndices=[];
  for(let i=0;i<=32;i++)for(let j=0;j<2;j++){
    const z=.12+i/32*1.02,overhang=Math.max(0,z-depth/2);
    const x=.72+(j-.5)*.065;
    ribbonPositions.push(x,top+curve((x-gutter)/width)+.021-overhang*overhang*3.4,z);
    ribbonUvs.push(j,i/32);
    if(i<32&&j===0){const a=i*2;ribbonIndices.push(a,a+2,a+1,a+2,a+3,a+1);}
  }
  const ribbonGeometry=new T.BufferGeometry();ribbonGeometry.setAttribute('position',new T.Float32BufferAttribute(ribbonPositions,3));ribbonGeometry.setAttribute('uv',new T.Float32BufferAttribute(ribbonUvs,2));ribbonGeometry.setIndex(ribbonIndices);ribbonGeometry.computeVertexNormals();add(ribbonGeometry,ribbon,'Cloth bookmark');
  return {book,printed,boundPages};
}
