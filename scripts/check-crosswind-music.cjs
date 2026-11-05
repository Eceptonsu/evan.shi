const assert=require('node:assert/strict');
const Lab=require('../assets/js/cadence-lab.js');
global.CadenceLab=Lab;
const Score=require('../assets/js/crosswind-score.js');
const rate=22050,duration=14;
function recording(shift=0){
  const samples=new Float32Array(rate*duration);
  let phase=0;
  for(let i=0;i<samples.length;i++){
    const t=i/rate-shift;
    if(t<1 || t>=13 || (t>=6 && t<8))continue;
    const phrase=Math.floor((t-1)*2),frequency=[220,330,440,293.66][phrase%4];
    phase+=2*Math.PI*frequency/rate;
    // New notes at constant loudness, including the sort of mix where an
    // amplitude-only detector misses most of the rhythm.
    samples[i]=.22*Math.sin(phase)+.08*Math.sin(phase*2);
  }
  return {duration,sampleRate:rate,length:samples.length,numberOfChannels:2,getChannelData:c=>c ? samples : new Float32Array(samples.length)};
}
(async()=>{
  const p=Score.profile(await Lab.analyse(recording(),true));
  const q=Score.profile(await Lab.analyse(recording(.19),true));
  const expected=Array.from({length:24},(_,i)=>1+i*.5).filter(t=>t<6 || t>=8);
  const detected=expected.filter(t=>p.events.some(e=>Math.abs(e.time-t)<.08));
  assert(detected.length>=expected.length*.8,`Constant-volume pitch changes: ${detected.length}/${expected.length}`);
  const settings={bpm:p.bpm,offset:0};
  const easy=Score.arrange(p,{...settings,difficulty:'easy'},duration,3);
  const medium=Score.arrange(p,{...settings,difficulty:'medium'},duration,2.6);
  const hard=Score.arrange(p,{...settings,difficulty:'hard'},duration,2);
  assert(easy.length<medium.length && medium.length<hard.length,'Levels produce different note density');
  assert(easy.every(n=>n.kind==='tap' && n.keys.length===1 && ['a','d'].includes(n.keys[0])));
  assert(easy.every((n,i)=>!i || n.time-easy[i-1].time>=1.099));
  assert(hard.every(n=>n.time<8.02 || n.time>=9.98),'Silent section stays empty');
  assert(Math.abs(q.events[0].time-p.events[0].time-.19)<.035,'Notes follow a shifted recording');
  const shifted=Score.arrange(p,{...settings,difficulty:'hard',offset:120},duration,2);
  assert(Math.abs(shifted[0].time-hard[0].time-.12)<1e-8);
  assert.throws(()=>Score.profile({envelope:Array(100).fill(0),texture:[],flux:[],step:.01}),/No audible/);
  console.log(`Music checks passed: ${detected.length}/${expected.length} constant-volume onsets, right-only stereo, silence, distinct charts, timing shift, and all difficulty levels.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
