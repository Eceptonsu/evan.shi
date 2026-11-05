(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const C = window.CadenceCore;
  const Lab = window.CadenceLab;
  const flightScene = new window.CadenceArt.Scene($('flight-canvas'));
  const practiceScene = new window.CadenceArt.Scene($('practice-canvas'));
  let uploaded = null, uploadGeneration = 0, microphone = null;
  function stopMicrophone() { if (microphone) { microphone.stream.getTracks().forEach(t=>t.stop()); microphone.source.disconnect(); microphone.analyser.disconnect(); microphone=null; } }
  const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C↑'];
  const shortcuts = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];
  const storeKey = 'cadence-records-v3';
  let mode = 'melody', audio, run, raf, generation = 0, loading = false;
  let records = {};
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey) || '{}');
    if (raw && typeof raw === 'object') for (const [key, value] of Object.entries(raw)) if (/^(melody)-(easy|medium|hard)-(joy|jacques|saints)-(all|[0-3])$/.test(key) && Number.isSafeInteger(value) && value >= 0) records[key] = value;
  } catch { $('storage-status').textContent = 'Storage unavailable. Records last this visit.'; }

  class Audio {
    constructor() {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw Error('Audio unavailable');
      this.ctx = new Context(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); this.nodes = new Set(); this.volume();
    }
    get now() { return this.ctx.currentTime; }
    get heard() { const t = this.ctx.getOutputTimestamp?.(); return t?.contextTime > 0 && t.performanceTime > 0 ? t.contextTime + (performance.now() - t.performanceTime) / 1000 : this.now - (this.ctx.baseLatency || 0); }
    async ready() { await this.ctx.resume(); if (this.ctx.state !== 'running') throw Error('Audio blocked'); }
    volume() { this.master.gain.setTargetAtTime(Number($('volume').value) / 100, this.now, .02); }
    note(midi, at = this.now, duration = .4, kind = 'note') {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      const frequency = Number($('tuning').value) * 2 ** ((midi - 69) / 12);
      o.type = kind === 'note' ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(kind === 'kick' ? 130 : kind === 'tick' ? 1200 : frequency, at);
      if (kind === 'kick') o.frequency.exponentialRampToValueAtTime(45, at + .12);
      const amplitude = kind === 'bass' ? .12 : kind === 'backing' ? .085 : kind === 'kick' ? .12 : .25;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amplitude, at + .008);
      if (duration < 5) g.gain.exponentialRampToValueAtTime(.001, at + duration);
      else { g.gain.setValueAtTime(amplitude, at + duration - .05); g.gain.linearRampToValueAtTime(0, at + duration); }
      o.connect(g); g.connect(this.master);
      const voice = { o, g }; this.nodes.add(voice);
      o.onended = () => { o.disconnect(); g.disconnect(); this.nodes.delete(voice); };
      o.start(at); o.stop(at + duration + .02);
    }
    stop() { for (const { o, g } of this.nodes) { g.gain.cancelScheduledValues(this.now); g.gain.setTargetAtTime(0, this.now, .008); try { o.stop(this.now + .04); } catch {} } }
  }
  async function sound() {
    audio ||= new Audio(); await audio.ready();
  }
  const text = (id, value) => { $(id).textContent = value; };
  const level = () => $('difficulty').value;
  const recordKey = () => `${mode}-${level()}-${$('song').value}-${$('section').value}`;
  const song = () => C.songs[$('song').value];
  const tempo = () => song().bpm * { easy:.75, medium:1, hard:1.15 }[level()];
  function scores() { text('score', String(run?.score || 0).padStart(4, '0')); text('record', String(records[recordKey()] || 0).padStart(4, '0')); }
  function lock(locked) { for(const id of ['upload','remove-upload','tune-mode']) $(id).disabled=locked; $('song').disabled = locked; $('section').disabled = locked; $('preview').disabled = locked; $('difficulty').disabled = locked; $('pitch').disabled = locked; $('tuning').disabled = locked; $('start').hidden = locked; $('stop').hidden = !locked; }
  function clear() {
    generation++; loading = false; cancelAnimationFrame(raf); audio?.stop(); stopMicrophone(); run = null; lock(false);
    $('start').disabled = false; $('replay').hidden = true; $('continue').hidden = true;
    document.querySelectorAll('.key').forEach((el) => { el.disabled = false; el.classList.remove('active'); });
  }
  function choose(next) {
    clear(); mode=['crosswind','melody','drone'].includes(next)?next:'crosswind';
    $('crosswind').hidden=mode!=='crosswind';$('practice-panel').hidden=mode==='crosswind';
    $('active-track').textContent=mode==='crosswind'?uploaded?.name||'First flight':mode==='drone'?'Concert pitch':song().title;
    $('remove-upload').hidden=!uploaded;
    $('difficulty').parentElement.hidden=mode==='drone' && $('tune-mode').value!=='flight';
    document.dispatchEvent(new CustomEvent('cadence:mode',{detail:{mode,level:level()}}));
    document.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',el.dataset.mode===mode));
    if(mode==='crosswind')return;
    $('song-picker').hidden=mode==='drone';text('song-credit',song().credit);
    for(const name of ['melody','drone'])$(name+'-view').hidden=name!==mode;
    $('keyboard').hidden=mode!=='melody';$('record').parentElement.hidden=mode==='drone';$('score').parentElement.hidden=mode==='drone';
    const flight=mode==='drone' && $('tune-mode').value==='flight';
    $('practice-canvas').hidden=flight;
    text('mode-label',mode==='melody'?'Repeat':'Sustain');
    text('practice-seal',mode==='melody'?'和':'息');
    $('instrument').dataset.mode=mode;
    text('phase','READY');text('start',mode==='melody'?'Play':flight?'Start microphone':'Start drone');
    $('flight-canvas').hidden=!flight;if(flight)flightScene.draw('flight',0);
    text('headline',mode==='drone'?'Sustain':song().title);
    text('instruction',mode==='melody'?'Listen, then play it back.':flight?'Hold the target note to fly through six gates.':'Play along with the drone.');
    text('feedback','');text('run-detail',mode==='melody'?'A S D F G H J K':'Concert pitch');
    text('help',mode==='melody'?'Repeat each phrase. Easy shows the keys. Three misses end the run; replay whenever you need to. Pitch is scored; rhythm is free.':flight?'Play a single steady note into your microphone. Sharp moves up; flat moves down. Microphone audio is processed locally and is not recorded.':'Match the concert note. The drone stops after two minutes.');
    text('scoring',mode==='melody'?'100 per new correct note. 150 bonus for a phrase without misses or replays.':flight?'Hold within 35 / 25 / 15 cents on Easy / Medium / Hard for the final 0.6 seconds before each gate. 100 points per gate.':'Rest whenever you need to.');
    $('phrase').replaceChildren();const blank=document.createElement('span');blank.className='empty-phrase';blank.textContent='●  ●  ●';$('phrase').append(blank);
    text('phrase-caption','');scores();droneDisplay();
    practiceScene.draw(mode==='melody'?'repeat':'drone',0);
  }
  function droneDisplay() { text('drone-note', $('pitch').selectedOptions[0].textContent); text('drone-frequency', `${(Number($('tuning').value) * 2 ** ((Number($('pitch').value) - 69) / 12)).toFixed(1)} Hz`); }
  function slots() {
    $('phrase').replaceChildren(...run.phrase.map((_, i) => { const el = document.createElement('span'); el.textContent = i < run.position ? names[run.phrase[i]] : '·'; el.className = i < run.position ? 'done' : i === run.position ? 'current' : ''; return el; }));
  }
  function newPhrase() {
    run.events = run.parts[run.round]; run.phrase = run.events.filter(([note]) => note >= 0).map(([note]) => note); run.position = 0; run.misses = 0; run.assisted = false; run.awarded = new Set();
    text('headline', `${song().title} / ${run.round + 1} of ${run.parts.length}`); slots(); listen();
  }
  function listen() {
    audio.stop(); run.phase = 'listen'; run.position = 0; run.listenAt = audio.now + .25;
    const beat = 60 / tempo(); let offset = 0; run.onsets = [];
    run.events.forEach(([note, duration]) => { if (note >= 0) { run.onsets.push({ at: run.listenAt + offset * beat, end: run.listenAt + (offset + duration) * beat }); audio.note(C.midi[note], run.listenAt + offset * beat, duration * beat * .85); } offset += duration; });
    run.listenEnd = run.listenAt + offset * beat;
    slots(); text('phase', 'LISTEN'); text('feedback', '');
    text('phrase-caption', level() === 'easy' ? 'Watch the keys.' : 'Listen.');
    $('replay').hidden = false; $('replay').disabled = true; $('continue').hidden = true;
    document.querySelectorAll('.key').forEach((key) => { key.disabled = true; });
  }
  async function playKey(index) {
    if (mode !== 'melody' || loading || (run && !['input', 'over'].includes(run.phase))) return;
    const token = generation;
    try { await sound(); } catch { text('feedback', 'Audio could not start. Allow sound in your browser and try again.'); return; }
    if (token !== generation || document.hidden || (run && !['input', 'over'].includes(run.phase))) return;
    audio.note(C.midi[index]);
    practiceScene.flash(audio.heard,true,index);
    practiceScene.draw('repeat',audio.heard,[index]);
    const key = $('keyboard').children[index]; key.classList.add('active'); setTimeout(() => key.classList.remove('active'), 140);
    if (!run || run.phase === 'over') return;
    if (index === run.phrase[run.position]) {
      if (!run.awarded.has(run.position)) { run.score += 100; run.awarded.add(run.position); }
      run.position++; slots(); scores();
      if (run.position === run.phrase.length) {
        run.phase = 'won'; const bonus = !run.assisted && !run.misses ? 150 : 0; run.score += bonus; scores();
        text('phase', 'PHRASE COMPLETE'); text('feedback', bonus ? '+150 · clean take' : 'Phrase complete.');
        if (run.round + 1 === run.parts.length) { finish('Song complete.', true); return; }
        text('phrase-caption', '');
        $('replay').hidden = true; $('continue').hidden = false; $('continue').focus({ preventScroll: true }); save();
      } else text('feedback', `${run.position} / ${run.phrase.length} notes found.`);
    } else {
      run.misses++; run.assisted = true;
      const expected = names[run.phrase[run.position]];
      if (run.misses >= 3) { finish(`The missing note was ${expected}. Try again, or play the phrase freely.`); $('phrase').children[run.position].textContent = expected; }
      else { run.position = 0; slots(); text('feedback', `That note was ${expected}. Start from the beginning. ${3 - run.misses} attempts left.`); }
    }
  }

  function arrange(at, data, beat) {
    // Original accompaniment: bass, broken triads, and a quiet kick under the melody.
    const triads = { 0: [48,52,55], 3: [41,45,48], 4: [43,47,50] };
    data.events.forEach((event) => { if (event.note >= 0) audio.note(C.midi[event.note], at + event.beat * beat, event.duration * beat * .88); });
    for (let bar = 0; bar < data.beats / 4; bar++) {
      const chord = triads[song().chords[(bar + data.chordOffset) % song().chords.length]];
      audio.note(chord[0] - 12, at + bar * 4 * beat, beat * 3.5, 'bass');
      for (let step = 0; step < 4; step++) {
        audio.note(chord[step % 3], at + (bar * 4 + step) * beat, beat * .85, 'backing');
        if (step % 2 === 0) audio.note(36, at + (bar * 4 + step) * beat, .14, 'kick');
      }
    }
  }

  function save() {
    const key = recordKey(); if (run.score <= (records[key] || 0)) return;
    records[key] = run.score;
    try { localStorage.setItem(storeKey, JSON.stringify(records)); } catch { text('storage-status', 'Storage unavailable. Records last this visit.'); }
    scores();
  }
  function finish(message, letNoteRing = false) {
    if (!run) return;
    stopMicrophone();
    if (!letNoteRing) audio.stop();
    cancelAnimationFrame(raf); run.phase = 'over';
    if (mode !== 'drone' && !run.preview) save();
    lock(false); $('replay').hidden = true; $('continue').hidden = true;
    document.querySelectorAll('.key').forEach((el) => { el.disabled = false; el.classList.remove('active'); });
    text('phase', 'FINISHED'); text('headline', mode === 'drone' ? 'Sustain' : song().title); text('feedback', message); text('start', mode === 'drone' ? ($('tune-mode').value === 'flight' ? 'Start microphone' : 'Start drone') : 'Play again ↗');
  }
  function tick() {
    if (!run || run.phase === 'over') return;
    const now = audio.heard;
    if(run.phase!=='flight')practiceScene.draw(mode==='melody'?'repeat':'drone',now,mode==='melody'?[run.position]:[]);
    if (run.phase === 'listen') {
      const pos = run.onsets.findIndex((event) => now >= event.at && now < event.end);
      if(pos>=0 && pos!==run.visualNote){practiceScene.flash(now,true,run.phrase[pos]);run.visualNote=pos;}
      [...$('phrase').children].forEach((el, i) => el.classList.toggle('sounding', pos === i));
      [...$('keyboard').children].forEach((el, i) => el.classList.toggle('active', level() === 'easy' && pos >= 0 && pos < run.phrase.length && run.phrase[pos] === i));
      if (now >= run.listenEnd) {
        run.phase = 'input'; slots(); text('phase', 'YOUR TURN'); text('feedback', ''); text('phrase-caption', 'Your turn.');
        $('replay').disabled = false;
        [...$('keyboard').children].forEach((el) => { el.disabled = false; el.classList.remove('active'); });
        $('keyboard').children[0].focus({ preventScroll: true });
      }
    } else if (run.phase === 'flight') { tickFlight(now); if(run.phase==='over')return;
    } else if (run.phase === 'preview' && audio.now >= run.end) { finish(''); return;
    } else if (run.phase === 'drone' && audio.now >= run.end) { finish('Two minutes complete.'); return; }
    raf = requestAnimationFrame(tick);
  }
  async function start(preview = false) {
    if (loading) return;
    clear(); loading = true; const token = generation; $('start').disabled = true;
    try {
      await sound(); if (token !== generation || document.hidden) return;
      run = { phase: 'start', round: 0, score: 0, preview, parts: C.songPhrases($('song').value, $('section').value, level()) }; lock(true); scores();
      if (preview) { const data = C.arrangement($('song').value, $('section').value); const beat = 60 / tempo(); run.phase = 'preview'; run.end = audio.now + .1 + data.beats * beat; arrange(audio.now + .1, data, beat); text('phase', 'LISTENING'); text('feedback', ''); }
      else if (mode === 'melody') newPhrase();
      else if ($('tune-mode').value === 'flight') { await startFlight(token); if(token !== generation || !run || run.phase==='over') return; }
      else { run.phase = 'drone'; run.end = audio.now + 120; audio.note(Number($('pitch').value), audio.now, 120); text('phase', 'PLAYING'); text('headline', 'Sustain'); text('feedback', ''); }
      raf = requestAnimationFrame(tick);
    } catch { if(token!==generation)return; stopMicrophone(); if(run)finish('Could not start. Check audio or microphone permission, then retry.'); else text('feedback','Could not start audio. Try again.'); }
    finally { if(token===generation){loading = false; $('start').disabled = false;} }
  }
  async function startFlight(token) {
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone unavailable');
    text('feedback','Allow microphone to fly.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    if(token!==generation || document.hidden || !run || run.phase==='over'){stream.getTracks().forEach(track=>track.stop());return;}
    // Keep the stream owned before constructing nodes, so every failure path can release it.
    microphone={stream,source:{disconnect(){}},analyser:{disconnect(){}}};
    const source=audio.ctx.createMediaStreamSource(stream),analyser=audio.ctx.createAnalyser();
    microphone.source=source;microphone.analyser=analyser;
    analyser.fftSize=2048;source.connect(analyser);
    microphone.data=new Float32Array(analyser.fftSize);
    run.phase='flight';run.flightStart=audio.now;run.gate=0;run.hold=0;run.hits=0;run.lastFrame=audio.now;run.lastPitch=0;run.cents=null;
    run.target=Number($('tuning').value)*2**((Number($('pitch').value)-69)/12);
    text('phase','MIC ON');text('headline',`Hold ${$('pitch').selectedOptions[0].textContent}`);text('instruction',`Hold ${$('pitch').selectedOptions[0].textContent}. Keep the kite centered through each gate.`);text('feedback','Microphone stays on this device.');
    $('flight-canvas').hidden=false;flightScene.draw('flight',audio.now);
  }
  function tickFlight(now) {
    if(!microphone)return;
    if(now-run.lastPitch>.05){
      microphone.analyser.getFloatTimeDomainData(microphone.data);
      const hz=Lab.pitch(microphone.data,audio.ctx.sampleRate);
      run.cents=hz ? 1200*Math.log2(hz/run.target) : null;run.lastPitch=now;
    }
    const dt=Math.min(.1,Math.max(0,now-run.lastFrame));run.lastFrame=now;
    const tolerance={easy:35,medium:25,hard:15}[level()];
    if(run.cents!==null && Math.abs(run.cents)<=tolerance)run.hold+=dt;else run.hold=0;
    const elapsed=now-run.flightStart;
    if(elapsed>=(run.gate+1)*5){
      const hit=run.hold>=.6;run.gate++;if(hit){run.hits++;run.score+=100;}
      flightScene.flash(now,hit);text('feedback',hit?'Through. +100':'Missed gate.');run.hold=0;
      if(run.gate===6){flightScene.draw('flight',now,[],.6,run.cents,{progress:1,hits:run.hits});finish(`${run.hits} / 6 gates · ${run.score} points`);return;}
    }
    flightScene.draw('flight',now,[],.6,run.cents,{progress:(elapsed%5)/5,hits:run.hits});
  }
  $('upload').addEventListener('change',async()=>{
    const file=$('upload').files?.[0];if(!file)return;
    const token=++uploadGeneration;clear();
    document.dispatchEvent(new CustomEvent('cadence:loading',{detail:true}));
    text('music-status','Listening to your music…');$('upload').disabled=true;$('start').disabled=true;$('preview').disabled=true;
    try {
      if(file.size>30*1024*1024)throw Error('Use a file under 30 MB.');
      await sound();
      const buffer=await audio.ctx.decodeAudioData(await file.arrayBuffer());
      if(buffer.duration<5 || buffer.duration>300)throw Error('Choose a track between 5 seconds and 5 minutes.');
      text('music-status','Preparing track…');
      const analysis=await Lab.analyse(buffer,true);
      const profile=window.CrosswindScore.profile(analysis);
      analysis.times=profile.events.map(event=>event.time);analysis.bpm=profile.bpm;
      if(token!==uploadGeneration)return;
      uploaded={buffer,analysis,profile,name:file.name.replace(/\.[^.]+$/,'')};
      document.dispatchEvent(new CustomEvent('cadence:track',{detail:uploaded}));
      text('music-status','');choose('crosswind');
    } catch(error) { if(token===uploadGeneration)text('music-status',error.message?.match(/^(Use a|Choose a|No audible)/)?error.message:'Could not read this file. Try MP3 or WAV.'); }
    finally { if(token===uploadGeneration){$('upload').value='';$('upload').disabled=false;$('start').disabled=false;$('preview').disabled=false;document.dispatchEvent(new CustomEvent('cadence:loading',{detail:false}));} }
  });
  $('remove-upload').addEventListener('click',()=>{
    uploadGeneration++;clear();uploaded=null;text('music-status','');document.dispatchEvent(new CustomEvent('cadence:track',{detail:null}));choose(mode);
  });
  names.forEach((name, i) => {
    const key = document.createElement('button'); key.className = 'key'; key.setAttribute('aria-label', `${name === 'C↑' ? 'C5' : name + '4'}, keyboard ${shortcuts[i].toUpperCase()}`);
    const label = document.createElement('span'), hint = document.createElement('kbd'); label.textContent = name; hint.textContent = shortcuts[i].toUpperCase(); key.append(label, hint);
    key.addEventListener('pointerdown', (event) => { if (event.button !== 0 || key.disabled) return; event.preventDefault(); key.focus({ preventScroll: true }); playKey(i); });
    key.addEventListener('click', (event) => { if (event.detail === 0) playKey(i); }); $('keyboard').append(key);
  });
  document.querySelectorAll('[data-mode]').forEach((el) => el.addEventListener('click', () => choose(el.dataset.mode)));
  $('difficulty').addEventListener('change', () => choose(mode));
  $('start').addEventListener('click', () => start());
  $('preview').addEventListener('click', () => start(true));
  $('song').addEventListener('change', () => choose(mode));
  $('section').addEventListener('change', () => choose(mode));
  $('stop').addEventListener('click', () => { finish(mode === 'drone' ? 'Drone stopped.' : 'Stopped.'); });
  $('continue').addEventListener('click', () => { if (run?.phase === 'won') { run.round++; newPhrase(); } });
  $('replay').addEventListener('click', () => { if (run?.phase === 'input') { run.assisted = true; listen(); } });
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,select,a')) return;
    const index = shortcuts.indexOf(event.key.toLowerCase());
    if (mode === 'melody' && index >= 0) { event.preventDefault(); playKey(index); }
  });
  $('tune-mode').addEventListener('change', () => choose(mode));
  $('volume').addEventListener('input', () => audio?.volume());
  $('pitch').addEventListener('change', droneDisplay); $('tuning').addEventListener('change', droneDisplay);
  function interrupt() { generation++; if (run && run.phase !== 'over') finish('Stopped while away.'); else audio?.stop(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); }); window.addEventListener('pagehide', interrupt);
  document.addEventListener('cadence:flight',event=>{
    for(const id of ['difficulty','upload','remove-upload'])$(id).disabled=event.detail;
  });
  choose('crosswind');
}());
