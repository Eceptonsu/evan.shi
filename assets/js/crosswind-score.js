(function (root) {
  'use strict';

  function quantile(values, fraction) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) * fraction)];
  }

  // Use changes in loudness and high-frequency energy. A sharp sound can
  // register even when a bass note underneath it keeps overall volume steady.
  function profile(analysis) {
    const {envelope, texture, step} = analysis;
    const audible = envelope.filter(level => level > .00003);
    if (!audible.length) throw new Error('No audible music found. Choose another recording.');
    const reference = quantile(audible, .9);
    const floor = Math.max(.00003, reference * .035);
    const attack = new Float32Array(envelope.length);
    for (let i = 0; i < attack.length; i++) {
      const past = i - 2;
      const growth = Math.max(0, envelope[i] - (envelope[past] || 0));
      const brightness = Math.max(0, texture[i] - (texture[past] || 0));
      attack[i] = (growth + .65 * brightness) / (reference * .1 + (envelope[past] || 0));
    }
    const events = [];
    let background = 0;
    for (let i = 0; i < attack.length; i++) {
      const value = attack[i];
      const threshold = Math.max(.085, background * 2.1);
      background += (Math.min(value, 3) - background) * .035;
      if (value < threshold || envelope[i] < floor || value < (attack[i-1] || 0) || value <= (attack[i+1] || 0)) continue;
      const peak = Math.max(...envelope.slice(i, i+6));
      const event = {frame:i, time:i*step, peak, strength:Math.log1p(value) + .35 * peak/reference, bright:texture[i]/Math.max(floor,envelope[i])};
      const last = events[events.length-1];
      if (last && event.time-last.time < .11) {
        if (event.strength > last.strength) events[events.length-1] = event;
      } else events.push(event);
    }
    // Find the audible end of each attack. A silent gap is a rest, never a hold.
    for (let j = 0; j < events.length; j++) {
      const event=events[j];
      const limit=Math.min(envelope.length,events[j+1]?.frame??envelope.length,event.frame+Math.round(1.8/step));
      let lastSound=event.frame, below=0;
      for (let i=event.frame; i<limit; i++) {
        if (envelope[i]>=Math.max(floor,event.peak*.4)) { lastSound=i; below=0; }
        else if (++below*step>=.055) break;
      }
      event.sustain=(lastSound-event.frame)*step;
    }
    const bpm = events.length > 2 ? root.CadenceLab.bpmFromPeaks(events.map(e=>e.time)) : analysis.bpm;
    const firstSound = envelope.findIndex(level=>level>=floor)*step;
    const period = 60/bpm;
    // Circular averaging estimates beat phase without forcing tempo changes
    // onto a fixed grid. Phase is used only for an explicitly gridded chart.
    let x=0,y=0;
    for(const event of events){
      const angle=2*Math.PI*(event.time-firstSound)/period;
      x+=event.strength*Math.cos(angle); y+=event.strength*Math.sin(angle);
    }
    const origin=firstSound+Math.atan2(y,x)*period/(2*Math.PI);
    return {events,envelope,step,floor,reference,bpm,origin,firstSound};
  }

  function pulseEvents(song,bpm) {
    const period=60/bpm, duration=song.envelope.length*song.step;
    const events=[];
    for(let t=song.origin-Math.ceil(song.origin/period)*period;t<duration;t+=period){
      if(t<0)continue;
      const index=Math.round(t/song.step);
      const level=song.envelope[index]||0;
      if(level<song.floor)continue;
      events.push({time:t,strength:level/song.reference,peak:level,bright:0,sustain:0});
    }
    return events;
  }

  function arrange(song,settings,duration,leadIn) {
    const source=settings.grid ? pulseEvents(song,settings.bpm) : song.events;
    const gap={calm:.65,flow:.38,swift:.255}[settings.density]||.38;
    // Strongest nearby onset wins. Density changes which accents to follow,
    // without moving their timestamps or dropping the beginning of a phrase.
    const occupied=new Map(), selected=[];
    for(const event of [...source].sort((a,b)=>b.strength-a.strength || a.time-b.time)){
      const cell=Math.floor(event.time/gap);
      const crowded=[cell-1,cell,cell+1].some(bin=>occupied.has(bin) && Math.abs(occupied.get(bin)-event.time)<gap);
      if(!crowded){occupied.set(cell,event.time);selected.push(event);}
    }
    selected.sort((a,b)=>a.time-b.time);
    const highAccent=quantile(selected.map(e=>e.strength),.78);
    const middle=quantile(selected.map(e=>e.strength),.50);
    const brightThreshold=quantile(selected.map(e=>e.bright),.70);
    let left=true,lastChord=-Infinity;
    return selected.map((event,index)=>{
      const time=leadIn+event.time+settings.offset/1000;
      const next=selected[index+1]?.time??duration;
      const sustain=Math.min(event.sustain,next-event.time-.15,duration-event.time-.05);
      const note={time,end:time,kind:'tap',keys:[left?'a':'d'],done:false,hit:false,armed:false,presses:{}};
      if(sustain>=.48){
        note.kind='hold';
        note.end=Math.min(leadIn+duration,time+sustain);
      } else if(index>1 && event.strength>=highAccent && event.strength>middle*1.14 && event.time-lastChord>=1.6 && settings.density!=='calm'){
        note.kind='chord';note.keys.push(event.bright>=brightThreshold?'w':'s');lastChord=event.time;
      } else if(index>1 && event.bright>brightThreshold*1.25 && event.strength>middle){
        note.keys=['w'];
      } else if(index>1 && event.bright<brightThreshold*.55 && event.peak>song.reference*.85){
        note.keys=['s'];
      }
      left=!left;
      return note;
    }).filter(note=>note.time>=leadIn && note.time<leadIn+duration-.02);
  }
  const api={profile,arrange};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else root.CrosswindScore=api;
})(typeof window!=='undefined'?window:globalThis);
