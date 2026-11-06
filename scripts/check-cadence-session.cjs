// Exercise the production session controller with a deterministic audio clock.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const C = require('../assets/js/cadence-core.js');
global.CadenceLab=require('../assets/js/cadence-lab.js');
const Score=require('../assets/js/crosswind-score.js');
const dispatched=[];
const Lab = require('../assets/js/cadence-lab.js');
let now = 1, counter = 0, micHz = 440;
const frames = new Map(), storage = new Map(), voices = [];
class Element {
  constructor() { this.children = []; this.dataset = {}; this.handlers = {}; this.style = {}; this.parentElement = {}; this.hidden = false; this.disabled = false; this.value = ''; const classes = new Set(); this.classList = { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => on ? classes.add(c) : classes.delete(c) }; }
  set textContent(v) { this.content = String(v); this.children = []; }
  get textContent() { return this.content || ''; }
  setAttribute() {} focus() {} closest() { return null; }
  append(...els) { for(const el of els)el.parentElement=this; this.children.push(...els); }
  get options() { return this.children; }
  remove() { this.parentElement.children=this.parentElement.children.filter(el=>el!==this); }
  replaceChildren(...els) { this.children = els; }
  addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
  async fire(name, extra = {}) { for (const fn of this.handlers[name] || []) { const result=fn({ target: this, detail: 0, ...extra }); if(this===elements.upload)await result; } await new Promise(setImmediate); }
}
const html = fs.readFileSync('_projects/cadence.html', 'utf8');
const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => [m[1], new Element()]));
for (const [id, value] of Object.entries({ difficulty:'easy', song:'joy', section:'0', tuning:'440', pitch:'60', volume:'35' })) elements[id].value = value;
elements.pitch.selectedOptions = [{ textContent: 'C major' }];
const modes = ['melody','sustain','crosswind'].map((mode) => { const el = new Element(); el.dataset.mode = mode; return el; });
const idle = new Element();
const document = { hidden:false, getElementById: (id) => elements[id], createElement: () => new Element(), dispatchEvent(e){dispatched.push(e);}, querySelector: () => idle, querySelectorAll: (selector) => selector === '.key' ? elements.keyboard.children : modes, addEventListener() {} };
class AudioContext {
  constructor() { this.state = 'running'; this.baseLatency = 0; }
  get currentTime() { return now; }
  resume() { return Promise.resolve(); }
  get sampleRate() { return 48000; }
  createMediaStreamSource() { return { connect(){},disconnect(){} }; }
  createAnalyser() { return { fftSize:2048,disconnect(){},getFloatTimeDomainData(data){for(let i=0;i<data.length;i++)data[i]=.2*Math.sin(i*2*Math.PI*micHz/48000);} }; }
  decodeAudioData() { const samples=new Float32Array(48000*8); for(let i=0;i<samples.length;i++)samples[i]=i%24000<200?.3*Math.sin(i):0; return Promise.resolve({duration:8,sampleRate:48000,length:samples.length,numberOfChannels:1,getChannelData:()=>samples}); }
  createBufferSource() { return {connect(){},disconnect(){},start(at,offset,duration){voices.push({at,offset,duration,uploaded:true});},stop(){}}; }
  getOutputTimestamp() { return { contextTime:now, performanceTime:now * 1000 }; }
  createGain() { return { connect() {}, disconnect() {}, gain: { setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} } }; }
  createOscillator() { const voice = { connect() {}, disconnect() {}, start(at) { voice.at = at; voices.push(voice); }, stop(at) { voice.end = at; }, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; return voice; }
}
const navigator={mediaDevices:{getUserMedia:async()=>{throw Error('denied');}}};
vm.runInNewContext(fs.readFileSync('assets/js/cadence.js', 'utf8'), { CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},window: { CadenceArt:{Scene:class {draw(){} flash(){} clear(){} resetFlight(){}}}, CrosswindScore:Score, CadenceCore:C, CadenceLab:{ ...Lab, Scene:class { draw(){} flash(){} } }, AudioContext, addEventListener() {} }, navigator, document, performance: { now: () => now * 1000 }, localStorage: { getItem: (key) => storage.get(key), setItem: (key,value) => storage.set(key,value) }, requestAnimationFrame: (fn) => { frames.set(++counter, fn); return counter; }, cancelAnimationFrame: (id) => frames.delete(id), setTimeout() {} });
function advance(seconds) { now += seconds; const pending = [...frames.values()]; frames.clear(); pending.forEach((fn) => fn()); }
(async () => {
  assert.equal(elements.crosswind.hidden,false,'Crosswind opens inside Cadence');
  assert(!html.includes('data-mode="rhythm"'),'Sync is removed');
  assert.equal(elements['practice-panel'].hidden,true);
  await modes[0].fire('click');
  await elements.preview.fire('click');
  assert.equal(elements.phase.textContent, 'LISTENING');
  assert.equal(elements.song.disabled, true);
  assert.ok(voices.length > 8, 'Preview includes accompaniment as well as melody');
  advance(9);
  assert.equal(elements.phase.textContent, 'FINISHED');
  assert.equal(storage.size, 0, 'Listening cannot create a score');
  await elements.start.fire('click');
  const parts = C.songPhrases('joy', '0', 'easy');
  for (let i = 0; i < parts.length; i++) {
    advance(9);
    assert.equal(elements.phase.textContent, 'YOUR TURN');
    for (const [note] of parts[i]) if (note >= 0) await elements.keyboard.children[note].fire('click');
    if (i + 1 < parts.length) await elements.continue.fire('click');
  }
  assert.equal(elements.feedback.textContent, 'Song complete.');
  const records = JSON.parse(storage.get('cadence-records-v3'));
  assert.equal(records['melody-easy-joy-0'], 1100, 'Eight notes and two clean-phrase bonuses');
  assert.equal(elements.start.hidden, false);
  assert.ok(voices.at(-1).end > now + .3, 'Final played note is allowed to ring');
  elements.song.value = 'jacques'; await elements.song.fire('change');
  assert.equal(elements.record.textContent, '0000', 'Songs have independent records');
  await modes[1].fire('click');
  assert(!html.includes('tune-mode'),'Sustain has no mode switch');
  assert.equal(elements['flight-canvas'].hidden,false,'Sustain opens directly into flight');
  assert.equal(elements['song-picker'].hidden,false,'Flight offers real melodies');
  assert.equal(elements['volume-control'].hidden,false,'Melody guide volume is adjustable');
  assert.equal(elements.start.textContent,'Start microphone');
  await elements.start.fire('click');
  assert.match(elements.feedback.textContent,/permission/, 'Unavailable microphone produces a recoverable error');
  assert.equal(elements.start.hidden,false);
  let pendingMic,stopped=0;
  navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{pendingMic=resolve;});
  await elements.start.fire('click'); await elements.stop.fire('click');
  pendingMic({getTracks:()=>[{stop:()=>stopped++}]}); await new Promise(setImmediate);
  assert.equal(stopped,1,'A permission grant after Stop releases the microphone');
  navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop:()=>stopped++}]});
  const previewVoices=voices.length;
  await elements.preview.fire('click');
  assert.equal(elements.phase.textContent,'LISTENING');
  assert.equal(voices.length-previewVoices,8,'The flight preview plays every melody note');
  advance(18);assert.equal(elements.feedback.textContent,'Melody complete.');
  assert.equal(stopped,1,'Listening never opens a microphone');
  async function fly(input){
    const score=C.flightScore(elements.song.value,elements.section.value,elements.difficulty.value,Number(elements.pitch.value));
    await elements.start.fire('click');const begun=now+1.2;
    for(let i=0;i<Math.ceil((score.duration+1.5)/.025);i++){
      const t=now+.025-begun,note=score.notes.find(n=>t>=n.start && t<n.end);
      micHz=input(note,t);advance(.025);
    }
    return score;
  }
  const frequency=n=>n?Number(elements.tuning.value)*2**((n.midi-69)/12):0;
  for(const difficulty of ['easy','medium','hard']){
    elements.difficulty.value=difficulty;elements.pitch.value='62';elements.tuning.value='442';
    await elements.difficulty.fire('change');
    const score=await fly(frequency);
    assert.equal(elements.feedback.textContent,`${score.notes.length} / ${score.notes.length} rings · ${score.notes.length*100} points`,'Changing microphone pitches follow the transposed melody at each difficulty');
  }
  await fly(()=>440);
  assert.match(elements.feedback.textContent,/^0 \/ 8 rings/,'A fixed A cannot pass a changing melody');
  await fly((note,t)=>note && t<note.start+.24?frequency(note):0);
  assert.match(elements.feedback.textContent,/^0 \/ 8 rings/,'Guide-cue audio cannot award a ring');
  elements.song.value='saints';elements.section.value='0';await elements.song.fire('change');
  await fly(frequency);assert.match(elements.feedback.textContent,/^4 \/ 4 rings/,'Rests do not create extra targets');
  assert.equal(stopped,7,'Every completed flight releases the microphone');
  elements.song.value='jacques';await elements.song.fire('change');
  elements.upload.files=[{name:'My tune.wav',size:1024,arrayBuffer:async()=>new ArrayBuffer(8)}];
  await elements.upload.fire('change');
  assert.equal(elements.crosswind.hidden,false,'Uploads open Crosswind');
  const shared=dispatched.find(e=>e.type==='cadence:track' && e.detail);
  assert(shared.detail.buffer && shared.detail.profile.events.length,'Crosswind receives the decoded recording and its analysis');
  await modes[0].fire('click');
  assert.equal(elements.headline.textContent,'Frère Jacques','Repeat keeps its built-in song after an upload');
  await modes[2].fire('click');
  assert.equal(elements.crosswind.hidden,false);assert.equal(elements['practice-panel'].hidden,true);
  assert.equal(elements['active-track'].textContent,'My tune','Switching games preserves the recording');
  await elements['remove-upload'].fire('click');assert.equal(elements.song.value,'jacques');
  assert.equal(dispatched.filter(e=>e.type==='cadence:track').at(-1).detail,null,'Remove releases the Crosswind recording');
  console.log('Session checks passed: accompanied preview, complete song, scoring, pitch flight, upload routing, and mode switching.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
