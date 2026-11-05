const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../_projects/cadence.html'),'utf8');
let source=fs.readFileSync(require('path').join(__dirname,'../assets/js/crosswind.js'),'utf8');new vm.Script(source);
source=source.replace(/\}\)\(\);\s*$/, 'globalThis.testStudy={time,makeChart,gustPosition,catchPoint,sailPoints,approachVector,flightPose,worldView,edgeTrace,curvePoint,draw,setPose(x,y){bank=x;lift=y;},snapshot(){return {hits,bank,lift,travelX,altitude,streak,bestStreak,running,notes,held};}};})();');
let now=0,frames=[],width=736,height=440,arcs=[],resize,draws=0;const listeners={};
function element(name){return {name,style:{},dataset:{},textContent:'',disabled:false,attrs:{},events:{},addEventListener(k,fn){this.events[k]=fn;},setAttribute(k,v){this.attrs[k]=v;},remove(){},setPointerCapture(){},getBoundingClientRect(){return {width,height};}};}
const context=new Proxy({}, {get(o,k){if(k==='createLinearGradient')return ()=>({addColorStop(){}});return (...args)=>{args.forEach(a=>{if(typeof a==='number')assert(Number.isFinite(a),k+' finite argument');});if(k==='arc')arcs.push(args);draws++;};},set(o,k,v){o[k]=v;return true;}});
const selectors=['canvas','.cw-status','.cw-count','.cw-start','.cw-demo','.cw-sound','.cw-progress','.cw-phrase','.cw-track','.cw-upload','.cw-original','.cw-settings','.cw-fields','.cw-bpm','.cw-mapping','.cw-offset','.cw-instruction'];
const elements=Object.fromEntries(selectors.map(s=>[s,element(s)]));const bar=element('span');elements['.cw-progress'].querySelector=()=>bar;elements.canvas.getContext=()=>context;
const hands=['a','w','s','d'].map(key=>{const e=element('hand');e.dataset.key=key;e.label=element('span');e.querySelector=()=>e.label;return e;});
const root=element('root');root.querySelector=s=>{assert(elements[s],s);return elements[s];};root.querySelectorAll=()=>hands;root.appendChild=()=>{};
const document={getElementById:id=>{assert(html.includes('id="'+id+'"'));return root;},createElement:()=>element('probe'),addEventListener(k,v){listeners[k]=v;},dispatchEvent(e){listeners[e.type]?.(e);},hidden:false};
const window={addEventListener(k,v){listeners[k]=v;}};
const sandbox={CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},document,window,console,Math,Number,String,Promise,performance:{now:()=>now},devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({color:'#aabbcc'}),ResizeObserver:class{constructor(fn){resize=fn;}observe(){resize();}},requestAnimationFrame(fn){frames.push(fn);return frames.length;},cancelAnimationFrame(){frames=[];}};
vm.runInNewContext(source,sandbox);const api=sandbox.testStudy;document.dispatchEvent({type:"cadence:mode",detail:{mode:"crosswind",level:"hard"}});
function step(sec){now=sec*1000;const queue=frames;frames=[];queue.forEach(fn=>fn(now));}
function advance(seconds){const target=now/1000+seconds;while(now/1000+1/60<target)step(now/1000+1/60);step(target);}
function click(sel){elements[sel].events.click();}
function key(kind,key){listeners[kind]({key,repeat:false,preventDefault(){}});}
let baseline=0;
function start(){if(api.snapshot().running)click('.cw-start');baseline=now/1000;click('.cw-start');}
function at(t){advance(Math.max(0,baseline+t-now/1000));}
function tap(k){key('keydown',k);key('keyup',k);}
// Every contact is on the actual silhouette. Camera motion must project the
// sail, buttons and note arrivals together, while preserving local note paths.
assert.deepEqual(JSON.parse(JSON.stringify(api.sailPoints)),{a:[-151,33],d:[151,33],w:[0,-65],s:[0,56.5]});
const hemMid=api.curvePoint([[-12,64],[0,49],[12,64]],.5);assert.equal(hemMid[1],api.sailPoints.s[1]);
for(const w of [320,440,441,736]){
  width=w;height=w<=440?400:440;resize();const paths=[];
  for(const lean of [-1,0,1])for(const climb of [-1,0,1]){
    api.setPose(lean,climb);arcs=[];api.draw(1);assert(arcs.every(a=>a[2]<=8),'only notes use circles; contacts trace the silhouette');
    paths.push(JSON.stringify(['a','w','s','d'].map(k=>api.gustPosition({keys:[k],time:2},1).local)));
  ['a','w','s','d'].forEach((k,i)=>{
    const target=api.catchPoint(k),touch=hands[i],sail=api.flightPose().project(...api.sailPoints[k]);
    assert.equal(target[0],sail[0]);assert.equal(target[1],sail[1]);
    assert.equal(parseFloat(touch.style.left),target[0]);assert.equal(parseFloat(touch.style.top),target[1]);
    assert(target[0]-28>=0 && target[0]+28<=w && target[1]-28>=0 && target[1]+28<=height,'rotated touch area stays on screen');
    const note={keys:[k],time:3,end:4.25},origin=api.gustPosition(note,1),v=api.approachVector(k);
    assert(origin.x>=8 && origin.x<=w-8 && origin.y>=40 && origin.y<=height-8,'approach remains visible through banking');
    const head=api.gustPosition(note,3),tail=api.gustPosition(note,4.25,k,note.end);
    assert(Math.abs(head.x-target[0])<1e-9);assert(Math.abs(head.y-target[1])<1e-9);assert(Math.abs(tail.x-target[0])<1e-9);assert(Math.abs(tail.y-target[1])<1e-9);
    assert(Math.abs(api.gustPosition(note,2).x-(target[0]+origin.x)/2)<1e-9);
    assert(Math.abs(api.gustPosition(note,2).y-(target[1]+origin.y)/2)<1e-9);
    for(const other of ['a','w','s','d'].slice(i+1)){const p=api.catchPoint(other);assert(Math.abs(p[0]-target[0])>=44 || Math.abs(p[1]-target[1])>=44,'44px touch areas must not overlap');}
  });
  }
  assert(paths.every(p=>p===paths[0]),'banking must not rewrite local note paths');
  api.setPose(0,0);
  assert(api.catchPoint('a')[0]<api.catchPoint('w')[0] && api.catchPoint('d')[0]>api.catchPoint('w')[0]);
  assert(api.catchPoint('w')[1]<api.catchPoint('a')[1] && api.catchPoint('s')[1]>api.catchPoint('a')[1]);
}
assert(!html.includes('laneLayout'));assert(!html.includes("fillText('HIT'"));
assert.equal(api.makeChart().length,20);assert.equal(new Set(api.makeChart().map(n=>n.kind)).size,3);
start();at(2.5);key('keydown','a');assert(api.snapshot().notes[0].armed);at(3.6);assert.equal(hands[0].label.textContent,'Hold…');at(3.72);assert.equal(hands[0].label.textContent,'Release');at(3.75);key('keyup','a');assert.equal(api.snapshot().hits,1);
assert(api.flightPose().tilt>.15 && api.flightPose().tilt<.20,'sustained left input banks between 9 and 12 degrees');
assert(api.worldView().roll<0 && Math.abs(api.worldView().roll)<.05,'horizon rolls less than three degrees');
assert(api.snapshot().travelX<-80,'sustained turn travels through the world');
at(5);key('keydown','d');at(5.1);key('keyup','d');assert.equal(api.snapshot().notes[1].hit,false,'early release fails');
at(7.5);tap('a');assert.equal(api.snapshot().hits,2,'diamond scores on press');
at(8.125);tap('ArrowRight');assert.equal(api.snapshot().hits,3,'arrow aliases work');
at(11.25);tap('w');advance(.1);assert(api.snapshot().lift>0,'climb has a distinct flight response');
at(12.5);tap('s');advance(.15);assert(api.snapshot().lift<0,'dive has a distinct flight response');
at(15);key('keydown','a');at(15.07);key('keydown','w');assert(api.snapshot().notes[8].hit,'two-key chord allows a small input skew');key('keyup','a');key('keyup','w');
at(16.25);key('keydown','d');at(16.40);key('keydown','s');assert.equal(api.snapshot().notes[9].hit,false,'rolled chord is rejected');key('keyup','d');key('keyup','s');
at(17.5);hands[0].events.pointerdown({preventDefault(){},pointerId:1});at(18.75);hands[0].events.pointerup({pointerId:1});assert(api.snapshot().notes[10].hit,'touch holds score');
at(20);hands[3].events.pointerdown({preventDefault(){},pointerId:2});at(21.25);hands[3].events.pointercancel({pointerId:2});assert.equal(api.snapshot().notes[11].hit,false,'pointer cancel never scores');
listeners.blur();assert(!api.snapshot().running);assert.equal(frames.length,0);assert(Object.values(api.snapshot().held).every(v=>v===null));
// Chords can be played with two fingers, without keyboard simulation.
start();at(15);hands[0].events.pointerdown({preventDefault(){},pointerId:7});hands[1].events.pointerdown({preventDefault(){},pointerId:8});assert(api.snapshot().notes[8].hit);hands[0].events.pointerup({pointerId:7});hands[1].events.pointerup({pointerId:8});
// Holding keys before an event cannot farm points; release/press is required.
start();at(2);key('keydown','a');at(3.75);key('keyup','a');assert.equal(api.snapshot().hits,0);assert.equal(api.snapshot().notes[0].hit,false);
// Independent input sources must not accidentally release a shared key.
start();at(2.5);key('keydown','a');key('keydown','ArrowLeft');at(3);key('keyup','a');assert(api.snapshot().held.a!==null);at(3.75);key('keyup','ArrowLeft');assert.equal(api.snapshot().hits,1);
// An accepted early hold must not teleport its head to the wing. Once the head
// arrives, it is consumed so it cannot hide the approaching hollow release tail.
start();at(2.4);key('keydown','a');arcs=[];api.draw(2.4);let contact=api.catchPoint('a');
assert(arcs.some(([x,y,r])=>x<contact[0] && r===8 && y<contact[1]));
at(2.5);arcs=[];api.draw(2.5);contact=api.catchPoint('a');assert(!arcs.some(([x,y,r])=>Math.abs(x-contact[0])<1e-9 && r===8));
at(3.75);arcs=[];api.draw(3.75);contact=api.catchPoint('a');assert(arcs.some(([x,y,r])=>Math.abs(x-contact[0])<1e-9 && r===7 && Math.abs(y-contact[1])<1e-9));key('keyup','a');assert.equal(api.snapshot().hits,1);
listeners.blur();click('.cw-demo');advance(31.4);assert.equal(api.snapshot().hits,20,'demo executes every interaction type');assert.equal(api.snapshot().bestStreak,20);assert.equal(elements['.cw-status'].textContent,'Your turn. Ride the wind.');assert.equal(bar.style.width,'100%');assert(!api.snapshot().running);
click('.cw-sound');assert.equal(elements['.cw-sound'].textContent,'Sound off');assert(html.includes('<!doctype html>'));assert(!html.includes('\\"'));
// Reduced-motion preference keeps scoring and edge positions functional while
// suppressing camera travel, zoom and most roll.
sandbox.matchMedia=()=>({matches:true,addEventListener(){}});vm.runInNewContext(source,sandbox);
const quiet=sandbox.testStudy;document.dispatchEvent({type:"cadence:mode",detail:{mode:"crosswind",level:"hard"}});quiet.setPose(-1,1);
assert(Math.abs(quiet.flightPose().tilt)<.05);assert(Math.abs(quiet.worldView().roll)<.02);assert.equal(quiet.worldView().pan,0);assert.equal(quiet.worldView().pitch,0);assert.equal(quiet.worldView().zoom,1);
async function verifyRecording() {
  document.dispatchEvent({type:'cadence:mode',detail:{mode:'crosswind',level:'easy'}});
  assert.equal(quiet.makeChart().length,11);
  assert(quiet.makeChart().every(n=>n.kind==='tap' && ['a','d'].includes(n.keys[0])));
  start();at(3-.28);tap('a');assert.equal(quiet.snapshot().hits,1,'Easy allows a 280ms timing error');
  document.dispatchEvent({type:'cadence:mode',detail:{mode:'crosswind',level:'medium'}});
  assert(!quiet.snapshot().running,'changing mode or level stops the previous flight');
  assert(!quiet.makeChart().some(n=>n.kind==='chord'));
  start();const hold=quiet.snapshot().notes.find(n=>n.kind==='hold');at(hold.time);key('keydown',hold.keys[0]);at(hold.end+.05);
  assert(hold.hit,'Medium completes a held ribbon without an exact release');
  document.dispatchEvent({type:'cadence:mode',detail:{mode:'crosswind',level:'hard'}});
  const rate=12000,duration=13,samples=new Float32Array(rate*duration);
  for(let n=0;n<23;n++){
    if(n===5 || n===19 || (n>=12 && n<=15))continue;
    const start=Math.round((.8+n*.5)*rate);
    const length=Math.round((n===4 || n===18?.85:.08)*rate);
    const volume=n===8?.85:.22;
    for(let i=0;i<length;i++)samples[start+i]=volume*Math.sin(2*Math.PI*200*i/rate);
  }
  const recording = {duration,sampleRate:rate,length:samples.length,numberOfChannels:1,getChannelData(){return samples;}};
  let recordingStart, recordingStopped = false, stamp=null;
  const gains=[];
  window.AudioContext = class {
    currentTime = 4;
    async resume() {}
    async decodeAudioData() { return recording; }
    getOutputTimestamp(){return stamp;}
    createGain() { const gain={gain: {}, connect(){}, disconnect(){}};gains.push(gain);return gain; }
    createBufferSource() {
      return {connect(){}, disconnect(){}, start(when){recordingStart=when;}, stop(){recordingStopped=true;}};
    }
  };
  window.CadenceLab=require('../assets/js/cadence-lab.js');
  vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../assets/js/crosswind-score.js'),'utf8'),sandbox);
  const analysis=await window.CadenceLab.analyse(recording,true);
  const profile=window.CrosswindScore.profile(analysis);
  document.dispatchEvent({type:'cadence:track',detail:{buffer:recording,profile,name:'practice.wav'}});
  assert.equal(elements['.cw-track'].textContent,'practice.wav');
  assert.equal(elements['.cw-count'].textContent,'120 BPM');
  click('.cw-start');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(recordingStart,6.1,'playback includes the two-second visual lead-in');
  assert.equal(gains.at(-1).gain.value,.85,'Custom audio uses an audible playback level');
  stamp={contextTime:4.6,performanceTime:now};
  assert(Math.abs(quiet.time()-.5)<1e-8,'Gameplay follows the audible output clock');stamp=null;
  const chart=quiet.snapshot().notes;
  assert(Math.abs(chart[0].time-2.8)<.025,'chart respects silent intro and first attack');
  assert.equal(new Set(chart.map(note=>note.kind)).size,3);
  assert(chart.some(n=>n.kind==='hold' && Math.abs(n.end-n.time-.85)<.04),'a sustained tone maps to its audible duration');
  assert(chart.filter(n=>n.kind==='hold').every(n=>n.end-n.time>.45),'short percussive hits cannot become holds');
  assert(!chart.some(n=>n.time>=8.8 && n.time<10.8),'quiet break contains no notes');
  assert(chart.some(n=>n.kind==='chord' && Math.abs(n.time-6.8)<.025),'strong accent produces a chord');
  click('.cw-start');
  assert(recordingStopped);
  elements['.cw-offset'].value=100;
  elements['.cw-fields'].events.change();
  click('.cw-start');assert(Math.abs(quiet.snapshot().notes[0].time-chart[0].time-.1)<1e-8);click('.cw-start');
  elements['.cw-mapping'].value='grid';elements['.cw-bpm'].value=60;
  elements['.cw-fields'].events.change();
  assert.equal(elements['.cw-count'].textContent,'60 BPM');
  click('.cw-start');assert(!quiet.snapshot().notes.some(n=>n.time>=8.9 && n.time<10.9));click('.cw-start');
  document.dispatchEvent({type:'cadence:track',detail:null});
  assert.equal(elements['.cw-count'].textContent,'96 BPM');
  assert.equal(elements['.cw-track'].hidden,true);
  assert.equal(bar.style.width,'0%');
  assert.equal(elements['.cw-start'].textContent,'Play');
  assert.equal(elements['.cw-phrase'].textContent,'Hard · holds, chords & releases');
}
verifyRecording().then(()=>console.log('Crosswind checks passed: edge alignment, gentler bank and horizon limits, reduced motion, 20/20 demo, keyboard and touch scoring, custom recording playback and cleanup, and original score restoration.')).catch(error=>{console.error(error);process.exitCode=1;});
