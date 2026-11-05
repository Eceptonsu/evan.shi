// Ripple origins follow rendered phrase slots, including repeated pitches,
// wrapped rows and layout changes. They must not be inferred from pitch number.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let now=0,frames=[],rings=[],resize;
const ctx={setTransform(){},beginPath(){},stroke(){},ellipse(...args){rings.push(args);}};
let box={width:600,height:245,left:120,top:300};
const canvas={getContext:()=>ctx,getBoundingClientRect:()=>box};
const art={palette:{sail:'#ad5e78'},scenery(){},petal(){}};
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
console.log('Ripple checks passed: active petal center, wrapping, resize, and final-note fade.');
