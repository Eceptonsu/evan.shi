// Ripple origins follow rendered phrase slots, including repeated pitches,
// wrapped rows and layout changes. They must not be inferred from pitch number.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=0,frames=[],rings=[],kites=[],resize;
const ctx={setTransform(){},beginPath(){},stroke(){},fillText(){},ellipse(...args){rings.push(args);}};
let box={width:600,height:245,left:120,top:300};
const canvas={getContext:()=>ctx,getBoundingClientRect:()=>box};
const art={palette:{sail:'#ad5e78'},scenery(){},petal(){},kite(g,pose){kites.push(pose);}};
const window={CrosswindArt:art,devicePixelRatio:2,matchMedia:()=>({matches:false})};
vm.runInNewContext(fs.readFileSync('assets/js/cadence-art.js','utf8'),{
  window,performance:{now:()=>now},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}},
  requestAnimationFrame(fn){frames.push(fn);return frames.length;},cancelAnimationFrame(){frames=[];}
});
const scene=new window.CadenceArt.Scene(canvas);
let rect={left:330,bottom:410,width:43,height:49};
scene.flash(5,true,()=>({getBoundingClientRect:()=>rect}));
scene.draw('repeat',5,[0]);
assert.equal(rings.length,3);assert(rings.every(r=>r[0]===231.5 && r[1]===122 && r[4]===0));
// Resize and a rebuilt/wrapped phrase must use the new slot geometry.
box={width:345,height:280,left:15,top:200};rect={left:210,bottom:380,width:32,height:43};
rings=[];resize();assert(rings.every(r=>r[0]===211 && r[1]===192));
// The last ripple fades without the session's requestAnimationFrame loop.
rings=[];now=600;const pending=frames;frames=[];pending.forEach(fn=>fn());
assert.equal(rings.length,0);assert.equal(frames.length,0);
scene.clear();scene.draw('repeat',5,[0]);assert.equal(rings.length,0);
const score=require('../assets/js/cadence-core.js').flightScore('jacques','0','easy');
scene.resetFlight();rings=[];
scene.draw('flight',0,[],.6,null,{score,elapsed:0,index:0,hits:0,preview:true});
const first=kites.at(-1);
assert(Math.sin(first.tilt)>.99,'The kite nose points right toward the approaching ring');
const forwardNose=first.cx+65*first.scale;
scene.draw('flight',2,[],.6,0,{score,elapsed:2,index:0,hits:0,preview:true});
assert(rings.some(r=>Math.abs(r[0]-forwardNose)<1e-8),'A ring arrives exactly at the kite nose');
for(let t=2.05;t<=4;t+=.05)scene.draw('flight',t,[],.6,0,{score,elapsed:t,index:1,hits:0,preview:true});
assert(kites.at(-1).cy<first.cy,'Higher melody notes lift the kite');
scene.flash(100,true);scene.resetFlight();rings=[];
scene.draw('flight',0,[],.6,null,{score,elapsed:-1.2,index:0,hits:0,idle:true});
assert(rings.every(r=>r[2]>0 && r[3]>0),'Restarting a flight clears the previous hit effect');
console.log('Art checks passed: centered ripples, wrapping, final fade, forward-facing kite and melody ring heights.');
