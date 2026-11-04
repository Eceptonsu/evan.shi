const assert=require('node:assert/strict');
const L=require('../assets/js/cadence-lab.js');
const rate=48000;
for(const hz of [130.81,220,261.63,440,442,880,1046.5]) {
  const signal=Float32Array.from({length:2048},(_,i)=>.18*Math.sin(2*Math.PI*hz*i/rate)+.04*Math.sin(4*Math.PI*hz*i/rate));
  const detected=L.pitch(signal,rate);
  assert.ok(detected && Math.abs(1200*Math.log2(detected/hz))<5,`Pitch ${hz}: ${detected}`);
}
assert.equal(L.pitch(new Float32Array(2048),rate),null,'Silence cannot pass a tuning gate');
let seed=42;
const noise=Float32Array.from({length:2048},()=>{seed=(seed*1664525+1013904223)>>>0;return (seed/2**32-.5)*.2;});
assert.equal(L.pitch(noise,rate),null,'Unpitched noise is not a stable pitch');
const envelope=Array(400).fill(.001);for(let i=20;i<400;i+=50)envelope[i]=.4;
const peaks=L.peaks(envelope,.01);assert.equal(peaks.length,8);assert.equal(L.bpmFromPeaks(peaks),120);
for(const level of ['easy','medium','hard']){
  const chart=L.chart(peaks,4,120,level);
  assert.ok(chart.length>0&&chart.every(t=>t>=.15&&t<3.85));
  assert.equal(chart.length,new Set(chart).size);
  assert.ok(L.chart([],10,120,level).length>0,'Sparse or sustained tracks have a playable grid fallback');
}
const samples=Float32Array.from({length:rate*4},(_,i)=>i%(rate/2)<240? .4*Math.sin(i):0);
const ctx=new Proxy({}, {get:(obj,key)=>obj[key] || ((...args)=>{assert.ok(args.filter(a=>typeof a==='number').every(Number.isFinite),`Finite canvas coordinates: ${key}`);}),set:(obj,key,value)=>{obj[key]=value;return true;}});
const canvas={width:900,height:330,getContext:()=>ctx,getBoundingClientRect:()=>({width:900,height:330})};
const scene=new L.Scene(canvas);
for(const kind of ['orbit','forge','flight'])for(const time of [0,1,5,10])scene.draw(kind,time,[{time:2,state:'waiting'},{time:3,state:'hit'}],.5,12,{progress:.5,hits:2});
L.analyse({sampleRate:rate,length:samples.length,numberOfChannels:1,getChannelData:()=>samples}).then(result=>{
  assert.ok(result.times.length>=6,'Detects transients from decoded audio');
  console.log('Upload/pitch checks passed: transient analysis, BPM estimate, chart fallback, pitch accuracy, silence, and noise rejection.');
}).catch(error=>{console.error(error);process.exitCode=1;});
