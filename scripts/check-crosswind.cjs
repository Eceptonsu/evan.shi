const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../_projects/cadence.html'),'utf8');
let source=fs.readFileSync(require('path').join(__dirname,'../assets/js/crosswind.js'),'utf8');new vm.Script(source);
source=source.replace(/\}\)\(\);\s*$/, 'globalThis.testStudy={resultAt,drawResult,windGuide,petalPose,birdPosition,worldPoint,advanceTravel,time,makeChart,gustPosition,catchPoint,sailPoints,approachVector,flightPose,worldView,edgeTrace,curvePoint,draw,setPose(x,y){bank=x;lift=y;},setSpeed(v){airspeed=v;},snapshot(){return {forward,airspeed,hits,bank,lift,travelX,altitude,streak,bestStreak,running,notes,held};}};})();');
let rotation=0,rotations=[],strokes=[],pen=[];
let now=0,frames=[],width=736,height=440,arcs=[],petals=[],resize,draws=0;const listeners={};
function element(name){return {name,style:{},dataset:{},textContent:'',disabled:false,attrs:{},events:{},addEventListener(k,fn){this.events[k]=fn;},setAttribute(k,v){this.attrs[k]=v;},remove(){},setPointerCapture(){},getBoundingClientRect(){return {width,height};}};}
const context=new Proxy({}, {get(o,k){if(k==='createLinearGradient')return ()=>({addColorStop(){}});return (...args)=>{args.forEach(a=>{if(typeof a==='number')assert(Number.isFinite(a),k+' finite argument');});if(k==='save')rotations.push(rotation);if(k==='restore')rotation=rotations.pop()||0;if(k==='rotate')rotation+=args[0];if(k==='moveTo')pen=args;if(k==='stroke')strokes.push({pen,rotation});if(k==='arc')arcs.push(args);draws++;};},set(o,k,v){o[k]=v;return true;}});
const selectors=['canvas','.cw-status','.cw-count','.cw-start','.cw-demo','.cw-sound','.cw-progress','.cw-phrase','.cw-track','.cw-upload','.cw-original','.cw-settings','.cw-fields','.cw-bpm','.cw-mapping','.cw-offset','.cw-instruction'];
const elements=Object.fromEntries(selectors.map(s=>[s,element(s)]));const bar=element('span');elements['.cw-progress'].querySelector=()=>bar;elements.canvas.getContext=()=>context;
const hands=['a','w','s','d'].map(key=>{const e=element('hand');e.dataset.key=key;e.label=element('span');e.querySelector=()=>e.label;return e;});
const root=element('root');root.querySelector=s=>{assert(elements[s],s);return elements[s];};root.querySelectorAll=()=>hands;root.appendChild=()=>{};
const document={getElementById:id=>{assert(html.includes('id="'+id+'"'));return root;},createElement:()=>({...element('probe'),getContext:()=>context}),addEventListener(k,v){listeners[k]=v;},dispatchEvent(e){listeners[e.type]?.(e);},hidden:false};
const window={addEventListener(k,v){listeners[k]=v;}};
const sandbox={Path2D:class {moveTo(){} lineTo(){} closePath(){}},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},document,window,console,Math,Number,String,Promise,performance:{now:()=>now},devicePixelRatio:1,matchMedia:()=>({matches:false,addEventListener(){}}),getComputedStyle:()=>({color:'#aabbcc'}),ResizeObserver:class{constructor(fn){resize=fn;}observe(){resize();}},requestAnimationFrame(fn){frames.push(fn);return frames.length;},cancelAnimationFrame(){frames=[];}};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname,'../assets/js/crosswind-art.js'),'utf8'),sandbox);
const paintPetal=window.CrosswindArt.petal;window.CrosswindArt.petal=(g,x,y,angle,open,...rest)=>{petals.push({x,y,open});paintPetal(g,x,y,angle,open,...rest);};
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
// sail and buttons together, while incoming petals keep independent paths.
assert.deepEqual(JSON.parse(JSON.stringify(api.sailPoints)),{a:[-151,33],d:[151,33],w:[0,-65],s:[0,56.5]});
const hemMid=api.curvePoint([[-12,64],[0,49],[12,64]],.5);assert.equal(hemMid[1],api.sailPoints.s[1]);
for(const w of [320,440,441,736]){
  width=w;height=w<=440?400:440;resize();const paths=[];
  for(const lean of [-1,0,1])for(const climb of [-1,0,1]){
    api.setPose(lean,climb);arcs=[];petals=[];api.draw(1);
    paths.push(JSON.stringify(['a','w','s','d'].flatMap(k=>[0,.5,.9,1.5,1.9,2,2.1].map(t=>{
      const p=api.gustPosition({keys:[k],time:2},t);return [p.x,p.y];
    }))));
  ['a','w','s','d'].forEach((k,i)=>{
    const target=api.catchPoint(k),touch=hands[i],sail=api.flightPose().project(...api.sailPoints[k]);
    assert.equal(target[0],sail[0]);assert.equal(target[1],sail[1]);
    assert.equal(parseFloat(touch.style.left),target[0]);assert.equal(parseFloat(touch.style.top),target[1]);
    assert(target[0]-28>=0 && target[0]+28<=w && target[1]-28>=0 && target[1]+28<=height,'rotated touch area stays on screen');
    const note={keys:[k],time:3,end:4.25},origin=api.gustPosition(note,1),v=api.approachVector(k);
    assert(origin.x>=8 && origin.x<=w-8 && origin.y>=40 && origin.y<=height-8,'approach remains visible through banking');
    const head=api.gustPosition(note,3),tail=api.gustPosition(note,4.25,k,note.end);
    assert(Math.abs(head.x-target[0])<1e-9);assert(Math.abs(head.y-target[1])<1e-9);assert(Math.abs(tail.x-target[0])<1e-9);assert(Math.abs(tail.y-target[1])<1e-9);
    for(let t=1;t<3.1;t+=.1){
      const p=api.gustPosition(note,t),q=api.gustPosition(note,t+.1);
      const length=Math.hypot(...v),along=((q.x-p.x)*v[0]+(q.y-p.y)*v[1])/length;
      assert(Math.abs(along+length*.1/2)<1e-8,'forward timing stays uniform while petals drift sideways');
      const offset=((p.x-target[0])*-v[1]+(p.y-target[1])*v[0])/length;
      assert(Math.abs(offset)<=12.00001,'wind drift stays subtle');
      if(t>=2.55)assert(Math.abs(offset)<1e-8,'the final 450 ms stays straight and readable');
    }
    for(const other of ['a','w','s','d'].slice(i+1)){const p=api.catchPoint(other);assert(Math.abs(p[0]-target[0])>=44 || Math.abs(p[1]-target[1])>=44,'44px touch areas must not overlap');}
  });
  }
  assert(paths.every(p=>p===paths[0]),'banking and climbing cannot change any part of a petal path');
  api.setPose(0,0);
  assert(api.catchPoint('a')[0]<api.catchPoint('w')[0] && api.catchPoint('d')[0]>api.catchPoint('w')[0]);
  assert(api.catchPoint('w')[1]<api.catchPoint('a')[1] && api.catchPoint('s')[1]>api.catchPoint('a')[1]);
}
// Birds cross the viewport outside the landscape's camera transform.
for(const bank of [-1,1]){
  api.setPose(bank,1);strokes=[];api.draw(3);
  for(let i=0;i<5;i++){
    const bird=api.birdPosition(i,3),stroke=strokes.find(s=>Math.abs(s.pen[0]-(bird.x-5))<1e-8 && Math.abs(s.pen[1]-(bird.y-bird.wing))<1e-8);
    assert(stroke && stroke.rotation===0,'Bird strokes are independent of camera rotation');
  }
}
const bird=api.birdPosition(0,3);api.setPose(-1,-1);api.setSpeed(1.45);
assert.deepEqual(api.birdPosition(0,3),bird,'Steering and speed cannot move a bird');
const flock=Array.from({length:120},(_,i)=>api.birdPosition(0,i/10));
assert(Math.max(...flock.map(b=>b.y))-Math.min(...flock.map(b=>b.y))>18,'Birds visibly rise and dip');
assert(Math.max(...flock.map(b=>b.y))-Math.min(...flock.map(b=>b.y))<height*.08,'Vertical flight stays subtle');
assert(flock.some((b,i)=>i && b.y>flock[i-1].y) && flock.some((b,i)=>i && b.y<flock[i-1].y),'The flock climbs and descends');
assert(Math.max(...flock.map(b=>b.wing))-Math.min(...flock.map(b=>b.wing))>3,'Wingbeats alternate with gliding');
const poses=Array.from({length:80},(_,i)=>api.petalPose({time:3},1+i/40,'a'));
assert(Math.max(...poses.map(p=>p.fold))-Math.min(...poses.map(p=>p.fold))>.25,'Petal bodies roll as they fall');
assert(poses.every(p=>p.fold>=.58 && p.fold<=1),'Petals remain visible through each flutter');
assert(Math.max(...poses.map(p=>p.angle))-Math.min(...poses.map(p=>p.angle))>.35,'Petals turn with the wind');
api.setPose(0,0);api.setSpeed(1);
// Replays get new wind, while straight guides and scoring stay fixed.
const sampleNote={keys:['a'],time:3,end:4.25};
const sampleWind=()=>Array.from({length:30},(_,i)=>api.gustPosition(sampleNote,1+i/30));
const guides=JSON.stringify(['a','w','s','d'].map(k=>api.windGuide(k)));
sandbox.Math=Object.assign(Object.create(Math),{random:()=>.15});start();
const firstWind=JSON.stringify(sampleWind());assert.equal(JSON.stringify(sampleWind()),firstWind,'A flight has repeatable, jitter-free petal paths');
sandbox.Math.random=()=>.85;start();
assert.notEqual(JSON.stringify(sampleWind()),firstWind,'A new flight changes the petal drift');
assert.equal(JSON.stringify(['a','w','s','d'].map(k=>api.windGuide(k))),guides,'Straight guides do not change with the flight seed');
for(const k of ['a','w','s','d']){
  const guide=api.windGuide(k),target=api.catchPoint(k),v=api.approachVector(k);
  assert.equal(guide.length,2,'Reference is a straight line');assert.deepEqual(guide[1],target);
  assert.deepEqual(guide[0],[target[0]+v[0],target[1]+v[1]]);
  const p=api.gustPosition(sampleNote,3,k);assert.equal(p.x,target[0]);assert.equal(p.y,target[1]);
}
listeners.blur();sandbox.Math=Math;
assert(!html.includes('laneLayout'));assert(!html.includes("fillText('HIT'"));
// Forward travel must be present without banking, and respond smoothly to pitch.
start();advance(1);assert(api.snapshot().forward>2 && api.snapshot().forward<2.2);assert.equal(api.snapshot().bank,0);
key('keydown','w');advance(2);const climbSpeed=api.snapshot().airspeed;assert(climbSpeed<.85);
key('keyup','w');key('keydown','s');advance(2);assert(api.snapshot().airspeed>1.15);key('keyup','s');
listeners.blur();const stoppedDistance=api.snapshot().forward;advance(1);assert.equal(api.snapshot().forward,stoppedDistance,'Stopped flights freeze the passage');
api.setPose(0,0);
const far=api.worldPoint(1,1,15),near=api.worldPoint(1,1,2);
assert(near[0]>far[0] && near[1]>far[1],'Scenery expands outward and down as it approaches');
for(const speed of [.72,1.45]){
  api.setSpeed(speed);
  for(const k of ['a','w','s','d']){
    const point=api.catchPoint(k),arrival=api.gustPosition({keys:[k],time:2},2);
    assert.equal(arrival.x,point[0]);assert.equal(arrival.y,point[1]);
  }
}
api.setSpeed(1);
assert.equal(api.makeChart().length,20);assert.equal(new Set(api.makeChart().map(n=>n.kind)).size,3);
start();at(2.5);key('keydown','a');assert(api.snapshot().notes[0].armed);at(3.6);assert.equal(hands[0].label.textContent,'Hold…');at(3.72);assert.equal(hands[0].label.textContent,'Release');at(3.75);key('keyup','a');assert.equal(api.snapshot().hits,1);
assert(api.snapshot().bank<-.8 && api.flightPose().tilt===0,'steering banks the flight without rotating the contact frame');
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
// Feedback must cover every outcome, including notes the player never touches.
start();at(2.5);key('keydown','a');assert.equal(api.resultAt('a',2.5).kind,'hold','Capture acknowledges the hold without awarding a success');
at(3.75);key('keyup','a');assert.equal(api.resultAt('a',3.75).kind,'hit');
assert(api.resultAt('a',4.3),'Success remains visible long enough to read');assert.equal(api.resultAt('a',4.5),null,'Success effects expire');
start();at(2.5);key('keydown','a');at(2.7);key('keyup','a');assert.equal(api.resultAt('a',2.7).kind,'miss','Early release gets a distinct failure');
start();at(2.7);assert.equal(api.resultAt('a',2.7).kind,'miss','An untouched note gets visible missed feedback');
start();at(1);tap('d');assert.equal(api.resultAt('d',1).kind,'miss','Wrong-time presses get feedback at the pressed edge');
start();at(15);tap('a');at(15.2);assert.equal(api.resultAt('a',15.2).kind,'miss');assert.equal(api.resultAt('w',15.2).kind,'miss','Incomplete chords mark both required edges');
start();assert.equal(api.resultAt('a',0),null,'A new flight clears old results');
arcs=[];api.drawResult('a',{kind:'hit',age:.25,alpha:.8});assert(arcs.filter(a=>Math.abs(a[4]-a[3]-Math.PI*2)<1e-8).length>=3,'Success draws complete blooming rings');
arcs=[];api.drawResult('a',{kind:'miss',age:.25,alpha:.8});assert.equal(arcs.filter(a=>a[4]-a[3]<Math.PI).length,2,'Failure draws two broken arcs');
listeners.blur();assert.equal(api.resultAt('a',0),null,'Stopping clears effects');
// Chords can be played with two fingers, without keyboard simulation.
start();at(15);hands[0].events.pointerdown({preventDefault(){},pointerId:7});hands[1].events.pointerdown({preventDefault(){},pointerId:8});assert(api.snapshot().notes[8].hit);hands[0].events.pointerup({pointerId:7});hands[1].events.pointerup({pointerId:8});
// Holding keys before an event cannot farm points; release/press is required.
start();at(2);key('keydown','a');at(3.75);key('keyup','a');assert.equal(api.snapshot().hits,0);assert.equal(api.snapshot().notes[0].hit,false);
// Independent input sources must not accidentally release a shared key.
start();at(2.5);key('keydown','a');key('keydown','ArrowLeft');at(3);key('keyup','a');assert(api.snapshot().held.a!==null);at(3.75);key('keyup','ArrowLeft');assert.equal(api.snapshot().hits,1);
// An accepted early hold must not teleport its head to the wing. Once the head
// arrives, it is consumed so it cannot hide the approaching hollow release tail.
start();at(2.4);key('keydown','a');arcs=[];petals=[];api.draw(2.4);let contact=api.catchPoint('a');
assert(petals.some(({x,y,open})=>x<contact[0] && !open && y<contact[1]));
at(2.5);arcs=[];petals=[];api.draw(2.5);contact=api.catchPoint('a');assert(!petals.some(({x,open})=>Math.abs(x-contact[0])<1e-9 && !open));
at(3.75);arcs=[];petals=[];api.draw(3.75);contact=api.catchPoint('a');assert(petals.some(({x,y,open})=>Math.abs(x-contact[0])<1e-9 && open && Math.abs(y-contact[1])<1e-9));key('keyup','a');assert.equal(api.snapshot().hits,1);
listeners.blur();click('.cw-demo');advance(31.4);assert.equal(api.snapshot().hits,20,'demo executes every interaction type');assert.equal(api.snapshot().bestStreak,20);assert.equal(elements['.cw-status'].textContent,'Your turn. Ride the wind.');assert.equal(bar.style.width,'100%');assert(!api.snapshot().running);
// Demonstration inputs belong to the musical clock even if rendering stalls.
click('.cw-demo');step(now/1000+31.4);assert.equal(api.snapshot().hits,20,'a delayed frame cannot make the demo miss notes');
click('.cw-sound');assert.equal(elements['.cw-sound'].textContent,'Sound off');assert(html.includes('<!doctype html>'));assert(!html.includes('\\"'));
// Reduced-motion preference keeps scoring and edge positions functional while
// suppressing camera travel, zoom and most roll.
sandbox.matchMedia=()=>({matches:true,addEventListener(){}});vm.runInNewContext(source,sandbox);
const quiet=sandbox.testStudy;document.dispatchEvent({type:"cadence:mode",detail:{mode:"crosswind",level:"hard"}});quiet.setPose(-1,1);
assert(Math.abs(quiet.flightPose().tilt)<.05);assert(Math.abs(quiet.worldView().roll)<.02);assert.equal(quiet.worldView().pan,0);assert.equal(quiet.worldView().pitch,0);assert.equal(quiet.worldView().zoom,1);
assert.deepEqual(quiet.birdPosition(0,0),quiet.birdPosition(0,10),'Reduced motion keeps birds still');
assert.deepEqual(quiet.petalPose({time:3},1,'a'),quiet.petalPose({time:3},2,'a'),'Reduced motion disables petal flutter');
arcs=[];quiet.drawResult('a',{kind:'hit',age:.1,alpha:.9});const stillRadii=arcs.map(a=>a[2]);
arcs=[];quiet.drawResult('a',{kind:'hit',age:.7,alpha:.4});assert.deepEqual(arcs.map(a=>a[2]),stillRadii,'Reduced motion keeps the outcome mark without expansion');
quiet.advanceTravel(2);assert.equal(quiet.snapshot().forward,0,'Reduced motion suppresses forward travel');assert.equal(quiet.snapshot().airspeed,1);
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
verifyRecording().then(()=>console.log('Crosswind checks passed: success/miss effects, flutter, independent bird flight, stable arrival timing, edge alignment, reduced motion, 20/20 demo, keyboard and touch scoring, custom recording playback and cleanup, and original score restoration.')).catch(error=>{console.error(error);process.exitCode=1;});
