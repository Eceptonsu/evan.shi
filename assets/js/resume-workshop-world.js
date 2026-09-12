import * as T from './lib/three/three.module.min.js';
import { RoundedBoxGeometry } from './lib/three/RoundedBoxGeometry.js';
import { HOVER_OFFSET, SHOTS, sampleFlight, sampleStory } from './resume-workshop-path.js';
import { createCosmos } from './resume-workshop-cosmos.js';
import { batchStaticMeshes } from './resume-workshop-batch.js';
import { createCosmicEvents } from './resume-workshop-events.js';
import { createCelestialLandmarks } from './resume-workshop-landmarks.js';
import { createPlanetSurface } from './resume-workshop-surfaces.js';
import { createStoryThread } from './resume-workshop-story.js';

// Retained sculptural details are batched around the original articulated rig.
export function createObservatory(textures={}) {
  const root=new T.Group();
  const physical=(color,options={})=>new T.MeshStandardMaterial({color,roughness:.3,metalness:.05,...options});
  const m={
    porcelain:physical(0xe8e7dc), chalk:physical(0xc7d8d5,{roughness:.48}),
    brass:physical(0xc99d60,{metalness:.82,roughness:.32}),
    dark:physical(0x102833,{metalness:.52,roughness:.25}),
    jade:physical(0x469d94,{metalness:.25,roughness:.22}),
    pink:physical(0xc38890,{metalness:.25,roughness:.3}),
    glass:physical(0xa6e6db,{roughness:.19,metalness:.65}),
    ink:physical(0x203946,{metalness:.2,roughness:.6}),
    glow:physical(0x87ecd2,{emissive:0x64d9c0,emissiveIntensity:.75}),
    paper:physical(0xf1e7cf,{roughness:.65,side:T.DoubleSide}),
    rose:physical(0xba878e,{metalness:.7,roughness:.24,side:T.DoubleSide}),
    fabric:physical(0xdce1dc,{roughness:.86,metalness:0}),
    rubber:physical(0x23343b,{roughness:.88,metalness:0}),
    timber:physical(0x795844,{roughness:.78,metalness:0}),
  };
  function mesh(parent,geometry,mat,x=0,y=0,z=0) {
    const o=new T.Mesh(geometry,mat); o.position.set(x,y,z); parent.add(o);return o;
  }
  const round=(g,w,h,d,mat,x=0,y=0,z=0,r=.08)=>mesh(g,new RoundedBoxGeometry(w,h,d,Math.min(w,h,d)<.09?1:2,Math.min(r,w/2,h/2,d/2)),mat,x,y,z);
  const sphere=(g,r,mat,x=0,y=0,z=0)=>mesh(g,new T.SphereGeometry(r,r>.3?40:r<.07?12:16,r>.3?24:r<.07?8:10),mat,x,y,z);
  const ring=(g,r,t,mat,x=0,y=0,z=0,arc=Math.PI*2)=>mesh(g,new T.TorusGeometry(r,t,8,64,arc),mat,x,y,z);
  const cylinder=(g,r,h,mat,x=0,y=0,z=0)=>mesh(g,new T.CylinderGeometry(r,r,h,24),mat,x,y,z);
  function group(parent,x=0,y=0,z=0) {const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
  function tube(parent,points,r,mat,closed=false) {
    return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed),40,r,6,closed),mat);
  }
  function beam(parent,a,b,r,mat) {
    const p=new T.Vector3(...a),q=new T.Vector3(...b),d=q.clone().sub(p);
    const o=mesh(parent,new T.CylinderGeometry(r,r,d.length(),16),mat);
    o.position.copy(p.add(q).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;
  }
  function lathe(parent,points,mat,x=0,y=0,z=0) {return mesh(parent,new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),96),mat,x,y,z);}
  const fineRing=(g,r,t,mat,x=0,y=0,z=0)=>mesh(g,new T.TorusGeometry(r,t,6,40),mat,x,y,z);
  function detailTube(parent,points,r,mat,closed=false){return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),closed),Math.max(16,points.length*2),r,6,closed),mat);}
  function fasteners(parent,positions,r=.02){
    const screws=new T.InstancedMesh(new T.SphereGeometry(r,10,6),m.brass,positions.length),pose=new T.Object3D();
    positions.forEach((p,i)=>{pose.position.set(...p);pose.updateMatrix();screws.setMatrixAt(i,pose.matrix);});parent.add(screws);return screws;
  }
  function surface(fn,uCount=48,vCount=12) {
    const positions=[],uvs=[],indices=[];
    for(let u=0;u<=uCount;u++)for(let v=0;v<=vCount;v++){positions.push(...fn(u/uCount,v/vCount));uvs.push(u/uCount,v/vCount);}
    for(let u=0;u<uCount;u++)for(let v=0;v<vCount;v++){const a=u*(vCount+1)+v,b=a+vCount+1;indices.push(a,b,a+1,b,b+1,a+1);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  function arch(parent,r,height,mat,x=0,z=0) {
    const g=group(parent,x,0,z);ring(g,r,.14,mat,0,height,0,Math.PI);
    cylinder(g,.14,height,mat,-r,height/2,0);cylinder(g,.14,height,mat,r,height/2,0);
    ring(g,r-.19,.017,m.brass,0,height,.12,Math.PI);return g;
  }
  const stage=group(root);stage.name='Shared evolving world';
  const chapters=Array.from({length:6},(_,index)=>{const layer=group(stage);layer.name=`Story layer ${index}`;return layer;});
  const aperture=group(chapters[0],0,1.9,0);
  const pearl=sphere(aperture,.54,m.glass);sphere(aperture,.2,m.glow);
  const traveler=group(root,...HOVER_OFFSET);
  traveler.name='Articulated expedition suit';
  const torso=mesh(traveler,surface((u,v)=>{
    const a=u*Math.PI*2,shoulder=Math.sin(Math.PI*v),waist=.23+.075*shoulder+.025*v;
    const taper=Math.min(1,Math.sin(Math.PI*v)*5);
    return [Math.cos(a)*waist*taper,.86+v*.7,-Math.sin(a)*(.19+.035*shoulder)*taper];
  },40,20),m.fabric);torso.name='Tailored pressure suit';
  round(traveler,.48,.13,.36,m.rubber,0,.91,0,.055);
  round(traveler,.45,.48,.18,m.dark,0,1.2,-.28,.07);
  const jets=[];
  const jetMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,
    vertexShader:`varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 v;void main(){float a=pow(v.y,1.8)*.55;gl_FragColor=vec4(mix(vec3(.22,.15,.95),vec3(.55,.95,1.),v.y),a);}`
  });
  for(const x of [-.2,.2]){
    cylinder(traveler,.105,.36,m.brass,x,1.13,-.36);
    ring(traveler,.09,.025,m.glow,x,.94,-.36).rotation.x=Math.PI/2;
    const jet=mesh(traveler,new T.CylinderGeometry(.07,.21,.8,24,1,true),jetMaterial,x,.53,-.36);jet.castShadow=jet.receiveShadow=false;jets.push(jet);
  }
  round(traveler,.39,.26,.055,m.porcelain,0,1.28,.225,.045);
  round(traveler,.27,.11,.025,m.dark,0,1.32,.266,.02);
  for(let i=0;i<3;i++)round(traveler,.13-i*.025,.009,.006,m.glow,-.035,1.345-i*.024,.282,.003);
  for(let i=0;i<3;i++)sphere(traveler,.024,i===0?m.glow:m.porcelain,-.09+i*.09,1.34,.31);
  ring(traveler,.26,.065,m.brass,0,1.59).rotation.x=Math.PI/2;
  const head=group(traveler,0,1.59,0);
  mesh(head,new T.SphereGeometry(.43,48,32),m.porcelain,0,.35);
  const lensGeometry=new T.SphereGeometry(.445,48,24,0,Math.PI*2,0,1.04);
  lensGeometry.rotateX(Math.PI/2);
  const visor=mesh(head,lensGeometry,physical(0x614933,{metalness:.94,roughness:.15}),0,.35,0);
  visor.name='Flush curved visor';
  const visorRadius=.445*Math.sin(1.04),visorDepth=.445*Math.cos(1.04);
  ring(head,visorRadius+.013,.022,m.rubber,0,.35,visorDepth-.004);
  ring(head,visorRadius,.012,m.brass,0,.35,visorDepth+.008);
  for(const x of [-.42,.42]){const ear=cylinder(head,.12,.08,m.brass,x,.35,0);ear.rotation.z=Math.PI/2;sphere(head,.055,m.glow,x*1.06,.35,.02);}
  const arms=[],legs=[],elbows=[],knees=[];
  for(const side of [-1,1]){
    const arm=group(traveler,side*.42,1.43,0);arms.push(arm);
    sphere(arm,.14,m.rubber);mesh(arm,new T.CapsuleGeometry(.13,.29,8,20),m.fabric,0,-.25);
    sphere(arm,.115,m.dark,0,-.47);const elbow=group(arm,0,-.47,0);elbows.push(elbow);
    mesh(elbow,new T.CapsuleGeometry(.11,.24,8,20),m.fabric,0,-.18);
    sphere(elbow,.12,m.rubber,0,-.4);arm.rotation.z=side*.13;
    round(elbow,.19,.15,.14,m.fabric,0,-.47,.015,.055);
    const thumb=mesh(elbow,new T.CapsuleGeometry(.035,.075,4,10),m.fabric,side*.105,-.46,.055);thumb.rotation.z=-side*.5;
    fineRing(elbow,.115,.014,m.brass,0,-.37).rotation.x=Math.PI/2;
    const leg=group(traveler,side*.175,.85,0);legs.push(leg);
    mesh(leg,new T.CapsuleGeometry(.15,.31,8,20),m.fabric,0,-.22);
    sphere(leg,.125,m.rubber,0,-.44);const knee=group(leg,0,-.44,0);knees.push(knee);
    round(knee,.25,.28,.27,m.fabric,0,-.14,0,.08);
    round(knee,.29,.18,.43,m.rubber,0,-.31,.075,.075);
    round(knee,.29,.035,.43,m.rubber,0,-.38,.075,.015);
    // Bellows, knee guards, articulated glove fingers, and boot tread.
    for(let j=0;j<4;j++){
      fineRing(arm,.116,.012,m.dark,0,-.43-j*.026).rotation.x=Math.PI/2;
      fineRing(leg,.127,.01,m.dark,0,-.4-j*.025).rotation.x=Math.PI/2;
      round(knee,.255,.012,.03,m.rubber,0,-.402,-.05+j*.085,.004);
      mesh(elbow,new T.CapsuleGeometry(.023,.09,3,8),m.fabric,-.069+j*.046,-.505,.025);
    }
    round(leg,.19,.15,.065,m.chalk,0,-.43,.117,.035);
    round(arm,.115,.14,.035,m.jade,0,-.24,.115,.025);
    for(let j=0;j<3;j++){
      const fold=fineRing(arm,.13,.008,m.fabric,0,-.27-j*.045);fold.rotation.x=Math.PI/2;fold.scale.set(1,1,.7);
    }
    detailTube(knee,[[side*.08,-.02,.135],[side*.09,-.13,.143],[side*.08,-.24,.14]],.005,m.chalk);
    round(leg,.09,.16,.035,m.jade,side*.06,-.22,.135,.02);
    detailTube(traveler,[[side*.21,1.37,-.32],[side*.39,1.16,-.29],[side*.37,1.02,.14],[side*.2,1.09,.245]],.024,m.dark);
    round(traveler,.055,.38,.035,m.brass,side*.21,1.23,.205,.012);
  }
  for(let i=0;i<6;i++)round(traveler,.31,.018,.025,m.chalk,0,1.06+i*.048,-.382,.005);
  for(const side of [-1,1]){
    detailTube(traveler,[[side*.2,1.48,.17],[side*.23,1.3,.22],[side*.21,1.08,.22],[side*.17,.95,.17]],.009,m.chalk);
    round(traveler,.08,.075,.035,m.brass,side*.21,1.12,.239,.012);
  }
  fasteners(traveler,[[-.18,1.4,.285],[.18,1.4,.285],[-.18,1.24,.285],[.18,1.24,.285]],.017);
  detailTube(head,[[-.29,.57,.285],[-.12,.66,.305],[.11,.66,.305],[.26,.57,.285]],.012,m.porcelain);
  beam(traveler,[.24,1.4,-.35],[.29,1.85,-.38],.012,m.brass);

  // 02: a world-making instrument, with a detailed controller and brass meridians.
  const games=chapters[1],planet=group(games,0,1.94,-.25);
  sphere(planet,1.08,physical(0xffffff,{map:createPlanetSurface(0x296f71,0xb0bba4),roughness:.58}));
  // Parallel latitude bands cannot intersect one another. Their inner edges
  // clear the surface, and the terrain is one texture rather than stacked caps.
  for(const y of [-.6,-.25])ring(planet,Math.sqrt(1.13*1.13-y*y),.009,m.brass,0,y).rotation.x=Math.PI/2;
  const meridian=ring(planet,1.58,.045,m.brass);meridian.rotation.set(.52,.1,.4);
  ring(planet,1.76,.024,m.glow).rotation.set(1.0,.25,-.4);
  sphere(planet,.13,m.porcelain,1.9,1.15,0);
  // Small architectural fragments form an imaginary world on the globe.
  for(let i=0;i<16;i++){
    const a=i*2.399, y=.45+(i%4)*.11, radius=Math.sqrt(Math.max(.1,1.08*1.08-y*y));
    const shard=round(planet,.13,.14+(i%3)*.09,.14,i%3?m.porcelain:m.brass,Math.cos(a)*radius,y,Math.sin(a)*radius,.035);shard.rotation.z=Math.cos(a)*-.5;shard.rotation.x=Math.sin(a)*.5;
  }
  const controller=group(games,0,.72,1.5);controller.name='Game controller';controller.rotation.x=-.3;
  const shape=new T.Shape();shape.moveTo(-.68,.3);shape.bezierCurveTo(-.97,.28,-1.12,-.53,-.77,-.56);shape.bezierCurveTo(-.54,-.57,-.43,-.18,-.25,-.18);shape.lineTo(.25,-.18);shape.bezierCurveTo(.43,-.18,.54,-.57,.77,-.56);shape.bezierCurveTo(1.12,-.53,.97,.28,.68,.3);shape.closePath();
  const body=mesh(controller,new T.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelThickness:.09,bevelSize:.08,bevelSegments:6,curveSegments:24}),m.porcelain);body.position.z=-.1;
  for(const x of [-.3,.3]){cylinder(controller,.12,.05,m.dark,x,-.04,.18).rotation.x=Math.PI/2;ring(controller,.11,.018,m.brass,x,-.04,.22);}
  for(const x of [-.3,.3]){
    const stem=mesh(controller,new T.CylinderGeometry(.055,.055,.08,16),m.dark,x,-.04,.24);stem.rotation.x=Math.PI/2;
    const grip=mesh(controller,new T.SphereGeometry(.10,20,12),m.rubber,x,-.04,.282);grip.scale.z=.3;
  }
  const cross=new T.Shape();
  [[-.038,.13],[.038,.13],[.038,.038],[.13,.038],[.13,-.038],[.038,-.038],[.038,-.13],[-.038,-.13],[-.038,-.038],[-.13,-.038],[-.13,.038],[-.038,.038]].forEach(([x,y],i)=>{if(i)cross.lineTo(x,y);else cross.moveTo(x,y);});cross.closePath();
  const dpad=mesh(controller,new T.ExtrudeGeometry(cross,{depth:.04,bevelEnabled:true,bevelThickness:.006,bevelSize:.008,bevelSegments:2}),m.dark,-.62,.12,.218);
  dpad.name='Single-piece D-pad';
  cylinder(controller,.1,.04,m.dark,-.62,.12,.192).rotation.x=Math.PI/2;
  for(let i=0;i<4;i++){const a=i*Math.PI/2;sphere(controller,.047,i%2?m.brass:m.jade,.62+Math.cos(a)*.095,.12+Math.sin(a)*.095,.24);}
  round(controller,.34,.12,.025,m.ink,0,.15,.22,.025);
  for(const x of [-.65,.65])round(controller,.36,.1,.14,m.dark,x,.34,.055,.035);
  for(let i=0;i<5;i++)round(controller,.014,.055,.012,m.brass,-.055+i*.028,.15,.24,.005);
  fasteners(controller,[[-.77,-.34,.15],[.77,-.34,.15],[-.38,.26,.17],[.38,.26,.17]],.022);

  // 03/04: a glass neural instrument and its kinetic clock.
  const ai=chapters[2],neural=group(ai,.3,2,-.3);
  const knot=mesh(neural,new T.TorusKnotGeometry(.9,.16,128,12,2,3),m.glass);
  const filament=mesh(neural,new T.TorusKnotGeometry(.91,.022,128,6,2,3),m.brass);filament.rotation.z=.1;
  const knotPoint=t=>new T.Vector3(.45*(2+Math.cos(3*t))*Math.cos(2*t),.45*(2+Math.cos(3*t))*Math.sin(2*t),.45*Math.sin(3*t));
  for(let i=0;i<18;i++){
    const t=i*Math.PI*2/18,p=knotPoint(t),collar=fineRing(knot,.165,.012,m.brass,...p);
    collar.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),knotPoint(t+.001).sub(p).normalize());
  }
  sphere(neural,.37,m.glow);
  const neurons=[];
  for(let i=0;i<28;i++){const y=1-(i/27)*2,a=i*2.39996,r=Math.sqrt(1-y*y);const p=[Math.cos(a)*r*1.48,y*1.48,Math.sin(a)*r*1.48];neurons.push(p);sphere(neural,.042,i%4?m.brass:m.glow,...p);if(i>1)beam(neural,neurons[i-2],p,.007,m.brass);}
  ring(neural,1.68,.018,m.glow).rotation.x=Math.PI/2;

  const clock=group(ai,-1.65,1.12,1.02);clock.rotation.y=-.15;
  cylinder(clock,.62,.12,m.dark).rotation.x=Math.PI/2;ring(clock,.63,.045,m.brass,0,0,.08);
  ring(clock,.48,.01,m.brass,0,0,.075);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const tick=round(clock,.025,i%3===0?.11:.055,.02,m.porcelain,Math.sin(a)*.52,Math.cos(a)*.52,.09,.008);tick.rotation.z=-a;}
  const clockHand=group(clock,0,0,.115);round(clockHand,.028,.41,.025,m.glow,0,.17,0,.012);sphere(clock,.055,m.brass,0,0,.14);
  const hour=round(clock,.035,.26,.025,m.brass,.07,.065,.12,.01);hour.rotation.z=-.8;
  const gears=[];
  for(const [x,y,r,count] of [[-.23,.15,.16,16],[.19,.22,.12,12],[.08,-.22,.19,20]]){
    const gear=group(clock,x,y,.08);gears.push(gear);
    fineRing(gear,r,.013,m.brass);fineRing(gear,r*.38,.012,m.brass);
    const teeth=new T.InstancedMesh(new T.BoxGeometry(.035,.035,.018),m.brass,count),pose=new T.Object3D();
    for(let i=0;i<count;i++){const a=i*Math.PI*2/count;pose.position.set(Math.cos(a)*r,Math.sin(a)*r,0);pose.rotation.z=a;pose.updateMatrix();teeth.setMatrixAt(i,pose.matrix);}gear.add(teeth);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;beam(gear,[0,0,0],[Math.cos(a)*r,Math.sin(a)*r,0],.009,m.brass);}
    fasteners(gear,[[0,0,.025]],.026);
  }


  // 05: one continuous Möbius ribbon connects independent modules.
  const systems=chapters[3],ribbon=group(systems,0,1.85,0);
  const mobius=surface((u,v)=>{const a=u*Math.PI*2,s=(v-.5)*.66;return [(1.28+s*Math.cos(a/2))*Math.cos(a),s*Math.sin(a/2),(1.28+s*Math.cos(a/2))*Math.sin(a)];},192,14);
  const band=mesh(ribbon,mobius,m.rose);band.rotation.x=.55;band.rotation.z=.35;
  detailTube(band,Array.from({length:193},(_,i)=>{const a=i*Math.PI*4/192,s=.33;return [(1.28+s*Math.cos(a/2))*Math.cos(a),s*Math.sin(a/2),(1.28+s*Math.cos(a/2))*Math.sin(a)];}),.012,m.brass,true);
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,x=Math.cos(a)*1.3,z=Math.sin(a)*1.3;
    const module=group(systems,x,.58,z);round(module,.74,.52,.74,m.porcelain,0,0,0,.12);round(module,.5,.045,.5,m.dark,0,.29,0,.06);
    for(let j=0;j<5;j++){round(module,.04,.07,.12,m.brass,-.24+j*.12,.16,.41,.015);round(module,.04,.07,.12,m.brass,-.24+j*.12,.16,-.41,.015);}
    tube(systems,[[x,.87,z],[x*.7,1.28,z*.7],[0,1.8,0]],.025,m.brass);
    round(module,.19,.035,.19,m.brass,0,.33,0,.025);
    for(const sign of [-1,1])for(let n=0;n<3;n++){
      const z=-.15+n*.15;
      detailTube(module,[[sign*.075,.33,z*.4],[sign*.14,.33,z*.4],[sign*.18,.33,z],[sign*.24,.33,z]],.007,m.glow);
    }
    fasteners(module,[[-.29,.265,-.29],[.29,.265,-.29],[-.29,.265,.29],[.29,.265,.29]],.024);
  }
  sphere(ribbon,.23,m.glass);

  // 06: individually curved pages and suspended sheets, encircled by an armillary.
  const library=chapters[4],book=group(library,0,1.25,0);book.name='Research book';book.rotation.set(.12,0,.08);
  const pageHeight=u=>.25*Math.sin(u*Math.PI*.95)+.08*u,topPage=.04+13*.018;
  const pageGeometry=surface((u,v)=>[.065+u*1.43,pageHeight(u),(v-.5)*1.7],36,12);
  for(const side of [-1,1])for(let i=0;i<14;i++){
    const page=mesh(book,pageGeometry,i===0?m.brass:m.paper,0,.04+i*.018,0);page.scale.x=side;
  }
  round(book,.09,.28,1.8,m.brass,0,.07,0,.035);
  for(let i=0;i<7;i++)detailTube(book,[[-.075,.15,-.68+i*.22],[-.1,.04,-.68+i*.22],[0,-.04,-.68+i*.22],[.1,.04,-.68+i*.22],[.075,.15,-.68+i*.22]],.014,m.brass);
  mesh(book,surface((u,v)=>{const x=.62+(v-.5)*.1,z=.55+u*.66,overhang=Math.max(0,z-.85);return [x,topPage+pageHeight((x-.065)/1.43)+.028-overhang*overhang*2,z];},24,3),m.rose);
  const writtenPage=group(book,0,topPage+.018,0);writtenPage.name='Page lettering';
  for(const side of [-1,1])for(let line=0;line<7;line++){
    const pts=[];for(let j=0;j<12;j++){const u=.2+j*.057;pts.push([side*(.065+u*1.43),pageHeight(u),-.63+line*.16]);}tube(writtenPage,pts,.008,m.ink);
  }
  const paperOrbit=group(library,0,1.8,0);
  paperOrbit.name='Suspended research pages';
  for(let i=0;i<5;i++){
    const a=(i-2)*.38;
    const sheet=mesh(paperOrbit,surface((u,v)=>[(u-.5)*.6,.09*Math.sin(u*Math.PI),(v-.5)*.8],16,8),m.paper,Math.sin(a)*2.2,.4+Math.cos(a)*.6,-.8+Math.cos(a)*.35);
    sheet.rotation.set(.5,a,.3);
    // Embossed diagrams on each suspended page, with no floating copy.
    for(let j=0;j<3;j++){
      const glyph=fineRing(sheet,.065+j*.026,.004,m.brass,0,.095,-.1);glyph.rotation.x=-Math.PI/2;
    }
    detailTube(sheet,[[-.19,.07,.12],[.05,.095,.12],[.16,.075,.22]],.006,m.ink);
  }


  // 07: a botanical sculpture and a carefully curved sailing vessel.
  const projects=chapters[5],garden=group(projects,-1.15,.25,0),ship=group(projects,1.12,.57,.35);

  tube(garden,[[0,.2,0],[-.16,.8,.05],[.1,1.45,0],[-.02,2.4,.1]],.075,m.brass);
  const leafGeo=surface((u,v)=>[(v-.5)*Math.pow(Math.sin(Math.PI*u),.7)*.42,u*.7,.1*Math.sin(Math.PI*u)-.13*(v-.5)*(v-.5)],20,10);
  const leafMat=physical(0x3e9685,{side:T.DoubleSide,roughness:.57,metalness:.08});
  for(let i=0;i<15;i++){
    const a=i*2.399,h=.6+i*.11,spread=.5+Math.sin(i)*.12;
    const tip=[Math.cos(a)*spread,h+.3,Math.sin(a)*spread];tube(garden,[[0,h,0],[tip[0]*.6,h+.12,tip[2]*.6],tip],.021,m.brass);
    const leaf=mesh(garden,leafGeo,i%4===0?m.brass:leafMat,...tip);leaf.rotation.set(.4+Math.sin(a)*.4,a,-Math.cos(a)*.6);
    const vein=tube(leaf,[[0,0,0],[0,.35,.1],[0,.7,0]],.006,m.brass);vein.castShadow=false;
    for(let j=1;j<=3;j++)for(const side of [-1,1]){
      const u=j*.2,width=Math.pow(Math.sin(Math.PI*u),.7)*.18;
      detailTube(leaf,[[0,u*.7,.1*Math.sin(Math.PI*u)],[side*width*.5,u*.7+.035,.1*Math.sin(Math.PI*u)-.004],[side*width,u*.7+.05,.1*Math.sin(Math.PI*u)-.018]],.0035,m.brass);
    }
  }
  const blossom=group(garden,-.02,2.62,.1);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const petal=sphere(blossom,.16,m.porcelain,Math.cos(a)*.18,Math.sin(a)*.18,0);petal.scale.set(.65,1.4,.3);petal.rotation.z=a-Math.PI/2;}
  sphere(blossom,.11,m.brass,0,0,.08);
  const hull=surface((u,v)=>{const x=(u-.5)*2,w=Math.pow(Math.sin(u*Math.PI),.7)*.41,a=v*Math.PI;return [x,-Math.sin(a)*.36,Math.cos(a)*w];},52,20);
  mesh(ship,hull,m.dark);const rail=[];for(let i=0;i<=100;i++){const a=i*Math.PI*2/100;rail.push([Math.cos(a),.012,Math.sin(a)*.39]);}tube(ship,rail,.023,m.brass,true);
  const deck=mesh(ship,new T.CircleGeometry(1,64),m.timber);deck.rotation.x=-Math.PI/2;deck.scale.y=.39;
  for(let i=-3;i<=3;i++){
    const z=i*.085,x=Math.sqrt(1-z*z/(.39*.39))*.94;
    beam(ship,[-x,.01,z],[x,.01,z],.007,m.dark);
  }
  round(ship,.38,.19,.3,m.porcelain,-.42,.095,0,.055);
  round(ship,.23,.07,.025,m.ink,-.42,.135,.151,.018);
  const wheel=group(ship,-.72,.27,0);fineRing(wheel,.13,.016,m.brass);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;beam(wheel,[0,0,0],[Math.cos(a)*.16,Math.sin(a)*.16,0],.009,m.brass);}
  cylinder(ship,.025,1.6,m.brass,0,.8);
  const sail=surface((u,v)=>[u*.72,.25+v*1.15,.19*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)],28,22);
  mesh(ship,sail,m.paper,.035,0,0);const smallSail=mesh(ship,sail,m.porcelain,-.035,.16,0);smallSail.scale.set(-.7,.8,1);
  for(let j=1;j<=4;j++){
    const v=j/5;
    detailTube(ship,Array.from({length:17},(_,i)=>{const u=i/16;return [.035+u*.72,.25+v*1.15,.19*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)+.005];}),.006,m.brass);
  }
  for(const side of [-1,1]){
    // Curved hull strakes follow the body instead of reading as a plain shell.
    for(const level of [.3,.6])detailTube(ship,Array.from({length:25},(_,i)=>{
      const u=.06+i/24*.88,a=level*Math.PI/2;
      return [(u-.5)*2,-Math.sin(a)*.36,side*Math.pow(Math.sin(u*Math.PI),.7)*.415*Math.cos(a)];
    }),.008,m.brass);
    for(let i=0;i<5;i++){const x=-.7+i*.35,z=side*Math.sqrt(1-x*x)*.39;beam(ship,[x,0,z],[x,.16,z],.009,m.brass);}
    detailTube(ship,Array.from({length:21},(_,i)=>{const x=-.8+i*.08;return [x,.16,side*Math.sqrt(1-x*x)*.39];}),.01,m.brass);
  }
  beam(ship,[0,1.65,0],[-.96,.03,0],.008,m.brass);beam(ship,[0,1.65,0],[.96,.03,0],.008,m.brass);
  for(let i=0;i<4;i++){ring(ship,.042,.012,m.brass,-.5+i*.3,-.11,.37);}



  // The old tabletop subjects now inhabit much larger astronomical scenes.
  planet.name='Game world';planet.scale.setScalar(3.15);planet.position.set(.7,-1.1,-5);
  controller.position.set(-.7,1.1,2.2);controller.scale.setScalar(1.2);
  neural.name='Stellar engine';neural.scale.setScalar(2.35);neural.position.set(-.6,1,-4.5);
  clock.scale.setScalar(2.25);clock.position.set(1.4,.8,-.8);
  ribbon.scale.setScalar(2.15);ribbon.position.set(-.3,1,-3.5);
  book.scale.setScalar(1.45);book.position.x=.5;
  paperOrbit.scale.setScalar(1.1);paperOrbit.position.set(0,2.9,-1.7);
  garden.scale.setScalar(1.55);garden.position.set(-2.7,-.4,-.5);
  ship.scale.setScalar(1.65);ship.position.set(.8,.4,-.7);
  const landmarks=createCelestialLandmarks(chapters);
  batchStaticMeshes(root,[pearl,knot,filament,...jets,...landmarks.animated]);
  const transitions=chapters.map(layer=>{
    const clones=new Map(),meshes=[];
    layer.traverse(child=>{if(!child.isMesh)return;meshes.push(child);
      const clone=original=>{if(!clones.has(original)){const material=original.clone();
        // Solid surfaces keep depth testing/writes during fades. Alpha hashing
        // avoids triangle-sort artifacts in batched rings and layered pages.
        if(!original.transparent&&!original.isShaderMaterial){material.transparent=false;material.alphaHash=true;material.depthWrite=true;}
        clones.set(original,{material,opacity:original.opacity,depthWrite:original.depthWrite});}return clones.get(original).material;};
      child.material=Array.isArray(child.material)?child.material.map(clone):clone(child.material);
    });return {materials:[...clones.values()],meshes};
  });
  const thread=createStoryThread();stage.add(thread.points);
  const events=createCosmicEvents();stage.add(events.root);
  const cosmos=createCosmos(textures);root.add(cosmos.root);
  const tailPositions=new Float32Array(48*3),tailAges=new Float32Array(48);
  for(let i=0;i<48;i++)tailAges[i]=i/47;
  const tailGeometry=new T.BufferGeometry();
  tailGeometry.setAttribute('position',new T.BufferAttribute(tailPositions,3).setUsage(T.DynamicDrawUsage));
  tailGeometry.setAttribute('age',new T.BufferAttribute(tailAges,1));
  const tailUniforms={energy:{value:0}};
  const tailMaterial=new T.ShaderMaterial({uniforms:tailUniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:`attribute float age;varying float a;void main(){a=age;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp((1.-a)*90./max(2.,-p.z),1.,14.);}`,
    fragmentShader:`varying float a;uniform float energy;void main(){float r=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(mix(vec3(.55,.9,1.),vec3(.5,.25,1.),a),exp(-r*r*5.)*pow(1.-a,2.)*energy*.45);}`
  });
  const tail=new T.Points(tailGeometry,tailMaterial);tail.frustumCulled=false;root.add(tail);

  return {root,stage,chapters,traveler,setViewPosition(position,quaternion){cosmos.setViewPosition(position,quaternion);},animate(progress,time,stationary=false,thrust=0,direction=1){
    const t=stationary?0:time;
    const story=sampleStory(progress);stage.position.copy(story.origin);thread.animate(progress,t);events.update(progress,stationary);landmarks.update(progress,t);
    chapters.forEach((layer,i)=>{
      const weight=story.weights[i];layer.visible=weight>.002;
      const a=SHOTS[story.index],b=SHOTS[story.index+1];
      const own=a.layer===i?a:b;
      const scale=a.layer===b.layer?T.MathUtils.lerp(a.scale,b.scale,story.blend):own.scale;
      const offset=new T.Vector3(...own.offset);
      if(a.layer===b.layer)offset.lerp(new T.Vector3(...b.offset),story.blend);
      layer.scale.setScalar(scale*(.9+.1*weight));
      layer.position.copy(offset).add(new T.Vector3((1-weight)*2.4*(i<SHOTS[story.index].layer?-1:1),(1-weight)*(i%2?1.6:-1.6),-(1-weight)*3));
      layer.rotation.y=(1-weight)*.12;
      transitions[i].materials.forEach(({material,opacity,depthWrite})=>{material.opacity=opacity*weight;material.depthWrite=depthWrite;if(material.uniforms?.chapterOpacity)material.uniforms.chapterOpacity.value=material.opacity;});

    });
    aperture.rotation.y=progress*.2+Math.sin(t*.16)*.1;pearl.position.y=Math.sin(t*.4)*.06;
    planet.rotation.y=progress*.26+t*.035;
    knot.rotation.y=progress*.4+t*.06;filament.rotation.y=knot.rotation.y;
    clockHand.rotation.z=-progress*3-t*.1;
    gears.forEach((gear,i)=>{gear.rotation.z=(i%2?-1:1)*(progress*.5+t*.12)/(i===1?.75:1);});
    ribbon.rotation.y=progress*.16+t*.06;
    paperOrbit.rotation.y=progress*.08+Math.sin(t*.18)*.15;
    book.position.y=1.25+Math.sin(t*.35)*.06;
    ship.rotation.z=Math.sin(t*.5)*.035;ship.rotation.y=-.25+Math.sin(t*.18)*.12;
    cosmos.animate(t);
    tail.visible=!stationary&&thrust>.03;tailUniforms.energy.value=thrust;
    if(tail.visible){
      for(let i=0;i<48;i++){const p=sampleFlight(progress-i*.006*direction).position;p.y+=.6;tailPositions.set([p.x+Math.sin(i*2.4)*i*.004,p.y,p.z+Math.cos(i*2.4)*i*.004],i*3);}
      tailGeometry.attributes.position.needsUpdate=true;
    }
    // Small corrective gestures and delayed limb movement make the suit feel
    // weightless. Thrust comes from scroll velocity and settles when it stops.
    head.rotation.set(-.06-thrust*.12+Math.sin(t*.63)*.045,Math.sin(t*.43)*.2*(1-thrust),Math.sin(t*.37)*.035);
    arms.forEach((arm,i)=>{arm.rotation.x=-.18-thrust*.52+Math.sin(t*.7+i*1.8)*.12;arm.rotation.z=(i?1:-1)*(.28+thrust*.26+Math.sin(t*.5+i)*.07);});
    elbows.forEach((elbow,i)=>{elbow.rotation.x=-.22-thrust*.3+Math.sin(t*.73+i*2)*.13;});
    legs.forEach((leg,i)=>{leg.rotation.x=.08+i*.1+thrust*.23+Math.sin(t*.55+i*2.2)*.075;leg.rotation.z=(i?1:-1)*(.13+Math.sin(t*.41+i)*.035);});
    knees.forEach((knee,i)=>{knee.rotation.x=.22+i*.14+thrust*.45+Math.sin(t*.65+i*1.6)*.1;});
    jets.forEach((jet,i)=>{const length=stationary?.28:.3+thrust*.85+Math.sin(t*7+i)*.025;jet.scale.y=length;jet.position.y=.93-.4*length;});
  }};
}

