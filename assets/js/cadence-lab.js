(function (root) {
  'use strict';
  // Normalized autocorrelation with the first strong local maximum avoids octave subharmonics.
  function pitch(samples, rate) {
    let energy = 0; for (const x of samples) energy += x*x;
    if (Math.sqrt(energy / samples.length) < .008) return null;
    const min = Math.floor(rate / 1400), max = Math.min(Math.floor(rate / 90), samples.length / 2);
    const correlations = [];
    for (let lag = min; lag <= max; lag++) {
      let sum = 0, a = 0, b = 0;
      for (let i = 0; i < samples.length - max; i += 2) { const x=samples[i], y=samples[i+lag]; sum+=x*y; a+=x*x; b+=y*y; }
      correlations[lag] = sum / Math.sqrt(a*b || 1);
      if (lag > min+1 && correlations[lag-1] > .88 && correlations[lag-1] > correlations[lag-2] && correlations[lag-1] >= correlations[lag]) {
        const l = lag-1, left = correlations[l-1], mid = correlations[l], right = correlations[l+1];
        const correction = .5 * (left-right) / (left-2*mid+right || 1);
        return rate / (l + correction);
      }
    }
    return null;
  }
  function peaks(envelope, step) {
    const result = []; let last = -1;
    for (let i=2; i<envelope.length-1; i++) {
      let mean=0; const start=Math.max(0,i-40); for(let j=start;j<i;j++) mean+=envelope[j]; mean/=i-start;
      if(envelope[i] > .012 && envelope[i] > mean*1.45 && envelope[i] > envelope[i-1] && envelope[i] >= envelope[i+1] && i*step-last > .16) { last=i*step; result.push(last); }
    }
    return result;
  }
  function bpmFromPeaks(times) {
    const votes = new Map();
    for(let i=0;i<times.length;i++) for(let j=i+1;j<Math.min(i+5,times.length);j++) {
      let bpm=60/(times[j]-times[i]); while(bpm<80)bpm*=2; while(bpm>180)bpm/=2;
      const bucket=Math.round(bpm/2)*2; votes.set(bucket,(votes.get(bucket)||0)+1/(j-i));
    }
    return [...votes].sort((a,b)=>b[1]-a[1])[0]?.[0] || 120;
  }
  function chart(times, duration, bpm, level, grid=false) {
    const gap = level==='easy' ? .48 : level==='medium' ? .28 : .18;
    const source=grid || times.length<4 ? Array.from({length:Math.ceil(duration/(60/bpm))},(_,i)=>i*60/bpm) : times;
    let last=-1;
    return source.filter(t=> { if(t<.15 || t>=duration-.15 || t-last<gap)return false; last=t; return true; });
  }
  // Positive spectral change catches percussion and new pitches in a full mix,
  // where compression can leave the overall RMS almost constant.
  async function spectralFlux(channels, rate, length, hop) {
    const size=512, stride=Math.max(1,Math.round(rate/11025));
    const real=new Float64Array(size), imaginary=new Float64Array(size), previous=new Float64Array(size/2);
    const window=Float64Array.from({length:size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(size-1)));
    const flux=[];
    for(let center=0;center<length;center+=hop){
      real.fill(0);imaginary.fill(0);
      for(let i=0;i<size;i++){
        const index=center+(i-size/2)*stride;
        if(index>=0 && index<length){
          // Analyze one channel to avoid cancellation from opposite stereo phase.
          real[i]=channels[0][index]*window[i];
        }
      }
      for(let i=1,j=0;i<size;i++){
        let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
        if(i<j)[real[i],real[j]]=[real[j],real[i]];
      }
      for(let span=2;span<=size;span*=2){
        const angle=-2*Math.PI/span, wr=Math.cos(angle),wi=Math.sin(angle);
        for(let base=0;base<size;base+=span){
          let ar=1,ai=0;
          for(let j=0;j<span/2;j++){
            const a=base+j,b=a+span/2,br=real[b]*ar-imaginary[b]*ai,bi=real[b]*ai+imaginary[b]*ar;
            real[b]=real[a]-br;imaginary[b]=imaginary[a]-bi;real[a]+=br;imaginary[a]+=bi;
            const next=ar*wr-ai*wi;ai=ar*wi+ai*wr;ar=next;
          }
        }
      }
      let change=0;
      for(let bin=2;bin<size/2;bin++){
        const magnitude=Math.log1p(Math.hypot(real[bin],imaginary[bin])*10);
        change+=Math.max(0,magnitude-previous[bin]);previous[bin]=magnitude;
      }
      flux.push(change/(size/2));
      if(flux.length%250===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return flux;
  }
  async function analyse(buffer, includeDynamics=false) {
    const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    const hop=Math.round(buffer.sampleRate*.01), envelope=[], texture=[];
    for(let start=0;start<buffer.length;start+=hop) {
      let sum=0,changes=0,count=0;
      for(let i=start;i<Math.min(start+hop,buffer.length);i+=4) {
        for(const channel of channels){
          sum+=channel[i]*channel[i];
          if(includeDynamics){const delta=channel[i]-channel[Math.max(0,i-4)];changes+=delta*delta;}
        }
        count+=channels.length;
      }
      envelope.push(Math.sqrt(sum/Math.max(1,count)));
      if(includeDynamics)texture.push(Math.sqrt(changes/Math.max(1,count)));
      if(envelope.length%1000===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    const times=peaks(envelope,hop/buffer.sampleRate);
    const result={times,bpm:bpmFromPeaks(times)};
    if(includeDynamics){
      // Prefer the channel with the most signal, including one-sided recordings.
      const energy=channels.map(channel=>{let total=0;for(let i=0;i<channel.length;i+=128)total+=channel[i]*channel[i];return total;});
      const strongest=channels[energy.indexOf(Math.max(...energy))];
      const flux=await spectralFlux([strongest],buffer.sampleRate,buffer.length,hop);
      Object.assign(result,{envelope,texture,flux,step:hop/buffer.sampleRate});
    }
    return result;
  }
  class Scene {
    constructor(canvas) { this.canvas=canvas; this.ctx=canvas.getContext('2d'); this.flashAt=-99; this.success=false; }
    flash(now, success) { this.flashAt=now; this.success=success; }
    draw(kind, now, targets=[], beat=.6, cents=null, flight=null) {
      const c=this.canvas, box=c.getBoundingClientRect(), ratio=Math.min(root.devicePixelRatio||1,2);
      if(c.width!==Math.round(box.width*ratio)||c.height!==Math.round(box.height*ratio)) { c.width=Math.round(box.width*ratio); c.height=Math.round(box.height*ratio); }
      const g=this.ctx,w=box.width,h=box.height; g.setTransform(ratio,0,0,ratio,0,0); g.fillStyle='#121720';g.fillRect(0,0,w,h);
      const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const flash=Math.max(0,1-(now-this.flashAt)*4);
      g.strokeStyle='#29323f';g.lineWidth=1;
      for(let i=0;i<7;i++){g.beginPath();g.moveTo(0,h*i/6);g.lineTo(w,h*i/6);g.stroke();}
      if(kind==='flight') {
        const y=h*.5 + (cents===null?0:Math.max(-120,Math.min(120,-cents))*h/300);
        const cycle=flight?.progress||0,x=w*.8-cycle*w*.58;
        g.strokeStyle='#a7dbd0';g.lineWidth=3;g.beginPath();g.ellipse(x,h/2,13,h*.12,0,0,Math.PI*2);g.stroke();
        g.fillStyle=cents===null?'#687380':Math.abs(cents)<25?'#a7dbd0':'#f2a978';
        g.beginPath();g.moveTo(w*.22+17,y);g.lineTo(w*.22-12,y-9);g.lineTo(w*.22-6,y);g.lineTo(w*.22-12,y+9);g.closePath();g.fill();
        g.fillStyle='#cad4df';g.font='12px monospace';g.fillText(cents===null?'PLAY A STEADY NOTE':`${cents>0?'+':''}${Math.round(cents)} cents`,20,28);
        g.fillText(`${flight?.hits||0} / 6 gates`,20,h-20);
      } else if(kind==='forge') {
        const hitX=w*.27, floor=h*.65;
        g.fillStyle='#303a45';g.fillRect(0,floor,w,14);
        g.fillStyle='#778693';g.fillRect(hitX-30,floor+14,60,35);
        for(const t of targets) { const delta=t.time-now;if(delta < -.35 || delta > beat*5)continue; const x=hitX+delta/beat*w*.145;
          g.fillStyle=t.state==='hit'?'#f3d9ac':t.state==='miss'?'#5e6670':'#d68b53';g.fillRect(x-16,floor-18,32,18);
          if(t.state==='hit'){g.strokeStyle='#eeb965';for(let i=0;i<5;i++){g.beginPath();g.moveTo(x,floor-20);g.lineTo(x+Math.cos(i)*30,floor-45-i*3);g.stroke();}}
        }
        g.save();g.translate(hitX,floor-85);g.rotate(-.35+flash*1.25);g.fillStyle='#ad9877';g.fillRect(-4,-60,8,75);g.fillStyle='#d2d6d6';g.fillRect(-25,-72,50,24);g.restore();
        g.strokeStyle='#e9bb81';g.beginPath();g.moveTo(hitX,floor+15);g.lineTo(hitX,floor+50);g.stroke();
      } else {
        const angle=reduced?0:Math.sin(now/beat/8)*.42, cx=w*.5,cy=h*(reduced?.68:.59+Math.sin(now/beat/12)*.09);
        g.save();g.translate(cx,cy);g.rotate(angle);
        g.strokeStyle=flash&&this.success?'#fff2c4':'#a7dbd0';g.lineWidth=2+flash*3;g.beginPath();g.moveTo(-w*.42,0);g.lineTo(w*.42,0);g.stroke();
        for(let i=0;i<targets.length;i++) {const t=targets[i],delta=t.time-now;if(delta<-.25||delta>beat*5)continue;
          const x=((i*7)%5-2)*w*.12,y=-delta/beat*h*.18;
          g.fillStyle=t.state==='hit'?'#f9d598':t.state==='miss'?'#4c5968':'#d6eee9';g.fillRect(x-15,y-4,30,8);
          if(t.state==='hit'){g.strokeStyle='#f9d598';g.beginPath();g.arc(x,0,18+(1-flash)*12,0,Math.PI*2);g.stroke();}
        }g.restore();
      }
      if(flash && this.success) { g.fillStyle=`rgba(240,185,98,${flash*.06})`;g.fillRect(0,0,w,h); }
    }
  }
  const api={pitch,peaks,bpmFromPeaks,chart,analyse,Scene};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CadenceLab=api;
}(typeof window!=='undefined'?window:globalThis));
