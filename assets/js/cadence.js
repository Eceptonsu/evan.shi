(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const C = window.CadenceCore;
  const Lab = window.CadenceLab;
  const rhythmScene = new Lab.Scene($('rhythm-canvas'));
  const flightScene = new Lab.Scene($('flight-canvas'));
  let uploaded = null, uploadGeneration = 0, microphone = null;
  const isUpload = () => $('song').value === 'upload';
  function stopMicrophone() { if (microphone) { microphone.stream.getTracks().forEach(t=>t.stop()); microphone.source.disconnect(); microphone.analyser.disconnect(); microphone=null; } }
  const names = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C↑'];
  const shortcuts = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];
  const storeKey = 'cadence-records-v3';
  let mode = 'melody', audio, run, raf, generation = 0, loading = false;
  let records = {};
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey) || '{}');
    if (raw && typeof raw === 'object') for (const [key, value] of Object.entries(raw)) if (/^(melody|rhythm)-(easy|medium|hard)-(joy|jacques|saints)-(all|[0-3])$/.test(key) && Number.isSafeInteger(value) && value >= 0) records[key] = value;
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
  const song = () => isUpload() ? { title: uploaded?.name || 'Your music', credit: 'Local audio · Sync', bpm: Number($('upload-bpm').value) || 120 } : C.songs[$('song').value];
  const tempo = () => song().bpm * (isUpload() ? 1 : { easy: .75, medium: 1, hard: 1.15 }[level()]);
  function scores() { text('score', String(run?.score || 0).padStart(4, '0')); text('record', String(records[recordKey()] || 0).padStart(4, '0')); }
  function lock(locked) { for(const id of ['upload','upload-bpm','upload-chart','remove-upload','tap-offset','tune-mode']) $(id).disabled=locked; $('song').disabled = locked; $('section').disabled = locked; $('preview').disabled = locked; $('difficulty').disabled = locked; $('pitch').disabled = locked; $('tuning').disabled = locked; $('start').hidden = locked; $('stop').hidden = !locked; }
  function clear() {
    generation++; loading = false; cancelAnimationFrame(raf); audio?.stop(); stopMicrophone(); run = null; lock(false);
    $('start').disabled = false; $('replay').hidden = true; $('continue').hidden = true;
    document.querySelectorAll('.key').forEach((el) => { el.disabled = false; el.classList.remove('active'); });
    $('tap').classList.remove('flash');
  }
  function choose(next) {
    clear(); mode = next;
    $('crosswind').hidden = mode !== 'crosswind';
    $('practice-panel').hidden = mode === 'crosswind';
    $('active-track').textContent = mode==='crosswind' ? uploaded?.name||'First flight' : mode==='drone' ? 'Concert pitch' : song().title;
    $('remove-upload').hidden = !uploaded;
    $('difficulty').parentElement.hidden = false;
    document.dispatchEvent(new CustomEvent('cadence:mode', {detail:{mode,level:level()}}));
    document.querySelectorAll('[data-mode]').forEach((el) => el.setAttribute('aria-pressed', el.dataset.mode === mode));
    if(mode === 'crosswind') return;
    $('song-picker').hidden = mode === 'drone'; text('song-credit', song().credit);
    for (const name of ['melody', 'rhythm', 'drone']) $(`${name}-view`).hidden = name !== mode;
    $('keyboard').hidden = mode !== 'melody'; $('tap').hidden = mode !== 'rhythm';
    $('tap').disabled = true; $('difficulty').parentElement.hidden = mode === 'drone';
    $('record').parentElement.hidden = mode === 'drone' || isUpload(); $('score').parentElement.hidden = mode === 'drone';
    text('mode-label', mode === 'melody' ? '02 / REPEAT' : mode === 'rhythm' ? '03 / SYNC' : '04 / SUSTAIN');
    text('phase', 'READY'); text('start', mode === 'drone' ? ($('tune-mode').value === 'flight' ? 'Start microphone' : 'Start drone') : 'Play ↗');
    $('upload-settings').hidden = !uploaded || mode === 'drone';
    $('difficulty').parentElement.hidden = mode === 'drone' && $('tune-mode').value !== 'flight';
    $('flight-canvas').hidden = $('tune-mode').value !== 'flight';
    if (mode === 'drone' && $('tune-mode').value === 'flight') flightScene.draw('flight', 0);
    updateScene();
    text('headline', mode === 'drone' ? 'Sustain' : song().title);
    text('instruction', mode === 'melody' ? 'Listen, then play it back.' : mode === 'rhythm' ? 'Tap at the line or anvil.' : 'Play along with the drone.');
    text('feedback', '');
    if (isUpload() && mode === 'melody') { $('start').disabled = true; text('instruction', 'Your audio plays in Sync. Choose a built-in song for Repeat.'); }
    text('run-detail', mode === 'melody' ? 'A S D F G H J K' : mode === 'rhythm' ? 'SPACE / TAP' : 'Concert pitch');
    text('help', mode === 'melody' ? 'Repeat each phrase. Easy shows the keys. Three misses end the run; replay whenever you need to. Pitch is scored; rhythm is free.' : mode === 'rhythm' ? 'Tap on the line. Easy follows the half-note pulse; Medium follows the melody; Hard adds taps during held notes. Use wired headphones for more consistent timing.' : 'Match the concert note. No pitch scoring. The drone stops after two minutes.');
    text('scoring', mode === 'melody' ? '100 per new correct note. 150 bonus for a phrase without misses or replays.' : mode === 'rhythm' ? 'Perfect ≤55 ms: 100. Good ≤110 ms: 65. Early/late ≤180 ms: 25. Extra taps: −25.' : 'Rest whenever you need to.');
    if(mode==='drone' && $('tune-mode').value==='flight') {
      text('instruction','Hold the target note to fly through six gates.');
      text('help','Play a single steady note into your microphone. Sharp moves up; flat moves down. Microphone audio is processed locally and is not recorded.');
      text('scoring','Hold within 35 / 25 / 15 cents on Easy / Medium / Hard for the final 0.6 seconds before each gate. 100 points per gate. Rest or stop whenever needed.');
    }
    if(mode==='rhythm' && isUpload()) text('help','A generated chart follows detected sound attacks, not a hand-authored score. Beat grid is useful for tracks with few attacks. Positive tap offset compensates for late input. Files stay in memory until removed or the page closes.');
    $('phrase').replaceChildren(); const blank = document.createElement('span'); blank.className = 'empty-phrase'; blank.textContent = '●  ●  ●'; $('phrase').append(blank);
    text('phrase-caption', ''); $('notes').replaceChildren(); document.querySelector('.track-idle').hidden = false;
    text('tempo-label', `${Math.round(tempo())} BPM`); text('combo', '0 COMBO'); text('remaining', `${isUpload() ? Math.ceil(uploadPart().duration * tempo() / 60) : C.arrangement($('song').value, $('section').value).beats} BEATS`); scores(); droneDisplay();
  }
  function updateScene() {
    const classic = $('scene').value === 'track'; $('classic-track').hidden=!classic; $('rhythm-canvas').hidden=classic;
    if(mode==='rhythm' && !classic && (!run || run.phase!=='rhythm')) rhythmScene.draw($('scene').value,0);
  }
  function uploadPart() { const duration=uploaded.buffer.duration; const section=$('section').value; return section==='all' ? { offset:0,duration } : { offset:Number(section)*duration/4,duration:duration/4 }; }
  function playUploaded(at, part) {
    const source=audio.ctx.createBufferSource(); const gain=audio.ctx.createGain();
    source.buffer=uploaded.buffer; gain.gain.value=.85; source.connect(gain);gain.connect(audio.master);
    const voice={o:source,g:gain};audio.nodes.add(voice);source.onended=()=>{source.disconnect();gain.disconnect();audio.nodes.delete(voice);};source.start(at,part.offset,part.duration);
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

  function startRhythm() {
    if(isUpload()) { startUploadedRhythm(); return; }
    run.phase = 'rhythm'; run.beat = 60 / tempo(); run.scoreData = C.arrangement($('song').value, $('section').value); run.start = audio.now + .3 + 4 * run.beat;
    run.targets = C.songTargets($('song').value, $('section').value, level()).map((beat) => ({ time: run.start + beat * run.beat, state: 'waiting' }));
    run.combo = 0; run.maxCombo = 0; run.hits = 0; run.quality = 0;
    $('notes').replaceChildren(...run.targets.map((target) => { const el = document.createElement('span'); el.className = 'beat-note'; target.el = el; return el; }));
    document.querySelector('.track-idle').hidden = true;
    for (let i = -4; i < 0; i++) audio.note(80, run.start + i * run.beat, .055, 'tick');
    arrange(run.start, run.scoreData, run.beat);
    $('tap').disabled = false; $('tap').focus({ preventScroll: true }); text('headline', song().title); text('phase', 'COUNT IN');
  }
  function tap() {
    if (!run || run.phase !== 'rhythm') return;
    const now = audio.heard - Number($('tap-offset').value || 0)/1000;
    if (now < run.start - .18) return;
    const available = run.targets.filter((t) => t.state === 'waiting');
    const nearest = available.reduce((best, t) => !best || Math.abs(t.time - now) < Math.abs(best.time - now) ? t : best, null);
    const result = nearest ? C.judgment(now - nearest.time) : { points: 0 };
    audio.note(85, audio.now, .045, 'tick');
    $('tap').classList.add('flash'); setTimeout(() => $('tap').classList.remove('flash'), 80);
    if (result.points) {
      nearest.state = 'hit'; nearest.el.classList.add('hit'); run.hits++; run.quality += result.points; run.combo++; run.maxCombo = Math.max(run.maxCombo, run.combo); run.score += result.points;
      text('feedback', `${result.label} / ${Math.round(Math.abs(now - nearest.time) * 1000)} ms ${now < nearest.time ? 'early' : 'late'}`);
    } else { run.combo = 0; run.score = Math.max(0, run.score - 25); text('feedback', 'Extra tap · −25'); }
    rhythmScene.flash(audio.heard, Boolean(result.points));
    text('combo', `${run.combo} COMBO`); scores();
  }
  function save() {
    if(isUpload()) return;
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
    lock(false); $('replay').hidden = true; $('continue').hidden = true; $('tap').disabled = true;
    document.querySelectorAll('.key').forEach((el) => { el.disabled = false; el.classList.remove('active'); });
    text('phase', 'FINISHED'); text('headline', mode === 'drone' ? 'Sustain' : song().title); text('feedback', message); text('start', mode === 'drone' ? ($('tune-mode').value === 'flight' ? 'Start microphone' : 'Start drone') : 'Play again ↗');
  }
  function tick() {
    if (!run || run.phase === 'over') return;
    const now = audio.heard;
    if (run.phase === 'listen') {
      const pos = run.onsets.findIndex((event) => now >= event.at && now < event.end);
      [...$('phrase').children].forEach((el, i) => el.classList.toggle('sounding', pos === i));
      [...$('keyboard').children].forEach((el, i) => el.classList.toggle('active', level() === 'easy' && pos >= 0 && pos < run.phrase.length && run.phrase[pos] === i));
      if (now >= run.listenEnd) {
        run.phase = 'input'; slots(); text('phase', 'YOUR TURN'); text('feedback', ''); text('phrase-caption', 'Your turn.');
        $('replay').disabled = false;
        [...$('keyboard').children].forEach((el) => { el.disabled = false; el.classList.remove('active'); });
        $('keyboard').children[0].focus({ preventScroll: true });
      }
    } else if (run.phase === 'rhythm') {
      const beat = (now - run.start) / run.beat;
      text('phase', beat < 0 ? `COUNT IN / ${Math.min(4, Math.ceil(-beat))}` : `BAR ${Math.min(run.scoreData.beats / 4, Math.floor(beat / 4) + 1)} / ${run.scoreData.beats / 4}`);

      for (const target of run.targets) {
        target.el.style.left = `${18 + ((target.time - now) / run.beat) * 18}%`;
        if (target.state === 'waiting' && now - Number($('tap-offset').value || 0)/1000 > target.time + .18) { target.state = 'miss'; target.el.classList.add('miss'); run.combo = 0; text('combo', '0 COMBO'); text('feedback', 'Miss'); }
      }
      text('remaining', `${Math.max(0, Math.ceil(run.scoreData.beats - beat))} BEATS LEFT`);
      if ($('scene').value !== 'track') rhythmScene.draw($('scene').value, now, run.targets, run.beat);
      if (beat >= run.scoreData.beats + Math.max(.5,.6/run.beat)) { finish(`${run.hits}/${run.targets.length} notes hit · ${Math.round(run.quality / Math.max(1,run.targets.length * 100) * 100)}% timing accuracy · best combo ${run.maxCombo}.`); return; }
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
      run = { phase: 'start', round: 0, score: 0, preview, parts: isUpload() ? [] : C.songPhrases($('song').value, $('section').value, level()) }; lock(true); scores();
      if (preview && isUpload()) { const part=uploadPart();run.phase='preview';run.end=audio.now+.1+part.duration;playUploaded(audio.now+.1,part);text('phase','LISTENING'); }
      else if (preview) { const data = C.arrangement($('song').value, $('section').value); const beat = 60 / tempo(); run.phase = 'preview'; run.end = audio.now + .1 + data.beats * beat; arrange(audio.now + .1, data, beat); text('phase', 'LISTENING'); text('feedback', ''); }
      else if (mode === 'melody' && isUpload()) { finish('Choose a built-in song for Repeat.'); }
      else if (mode === 'melody') newPhrase();
      else if (mode === 'rhythm') startRhythm();
      else if ($('tune-mode').value === 'flight') { await startFlight(token); if(token !== generation || !run || run.phase==='over') return; }
      else { run.phase = 'drone'; run.end = audio.now + 120; audio.note(Number($('pitch').value), audio.now, 120); text('phase', 'PLAYING'); text('headline', 'Sustain'); text('feedback', ''); }
      raf = requestAnimationFrame(tick);
    } catch { if(token!==generation)return; stopMicrophone(); if(run)finish('Could not start. Check audio or microphone permission, then retry.'); else text('feedback','Could not start audio. Try again.'); }
    finally { if(token===generation){loading = false; $('start').disabled = mode==='melody'&&isUpload();} }
  }
  function startUploadedRhythm() {
    const part=uploadPart(); run.phase='rhythm';run.beat=60/tempo();run.start=audio.now+.3+4*run.beat;
    run.scoreData={beats:part.duration/run.beat};
    const peaks=uploaded.analysis.times.filter(t=>t>=part.offset && t<part.offset+part.duration).map(t=>t-part.offset);
    run.targets=Lab.chart(peaks,part.duration,tempo(),level(),$('upload-chart').value==='grid').map(time=>({time:run.start+time,state:'waiting'}));
    run.combo=0;run.maxCombo=0;run.hits=0;run.quality=0;
    $('notes').replaceChildren(...run.targets.map(target=>{const el=document.createElement('span');el.className='beat-note';target.el=el;return el;}));
    document.querySelector('.track-idle').hidden=true;
    for(let i=-4;i<0;i++)audio.note(80,run.start+i*run.beat,.055,'tick');
    playUploaded(run.start,part);$('tap').disabled=false;$('tap').focus({preventScroll:true});text('headline',uploaded.name);text('phase','COUNT IN');
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
    text('phase','MIC ON');text('headline',`Hold ${$('pitch').selectedOptions[0].textContent}`);text('instruction','Keep the glider centered through each gate.');text('feedback','Microphone stays on this device.');
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
      text('upload-status','Building chart…');
      const analysis=await Lab.analyse(buffer,true);
      const profile=window.CrosswindScore.profile(analysis);
      analysis.times=profile.events.map(event=>event.time);analysis.bpm=profile.bpm;
      if(token!==uploadGeneration)return;
      uploaded={buffer,analysis,profile,name:file.name.replace(/\.[^.]+$/,'')};
      let option=[...$('song').options].find(option=>option.value==='upload');
      if(!option){option=document.createElement('option');option.value='upload';$('song').append(option);}
      option.textContent=uploaded.name;$('song').value='upload';$('section').value='all';$('upload-bpm').value=analysis.bpm;
      document.dispatchEvent(new CustomEvent('cadence:track',{detail:uploaded}));
      text('music-status','');text('upload-status','Local only · auto chart is approximate.');choose(mode==='crosswind'?'crosswind':'rhythm');
    } catch(error) { if(token===uploadGeneration)text('music-status',error.message?.match(/^(Use a|Choose a|No audible)/)?error.message:'Could not read this file. Try MP3 or WAV.'); }
    finally { if(token===uploadGeneration){$('upload').value='';$('upload').disabled=false;$('start').disabled=mode==='melody'&&isUpload();$('preview').disabled=false;document.dispatchEvent(new CustomEvent('cadence:loading',{detail:false}));} }
  });
  $('remove-upload').addEventListener('click',()=>{
    uploadGeneration++;clear();uploaded=null;const option=[...$('song').options].find(o=>o.value==='upload');option?.remove();$('song').value='joy';$('section').value='all';text('music-status','');document.dispatchEvent(new CustomEvent('cadence:track',{detail:null}));choose(mode);
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
  $('tap').addEventListener('pointerdown', (event) => { if (event.button !== 0) return; event.preventDefault(); $('tap').focus({ preventScroll: true }); tap(); });
  $('tap').addEventListener('click', (event) => { if (event.detail === 0) tap(); });
  document.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.target.closest('input,select,a')) return;
    if (mode === 'rhythm' && run?.phase === 'rhythm' && event.code === 'Space' && (!event.target.closest('button') || event.target === $('tap'))) { event.preventDefault(); tap(); }
    const index = shortcuts.indexOf(event.key.toLowerCase());
    if (mode === 'melody' && index >= 0) { event.preventDefault(); playKey(index); }
  });
  $('scene').addEventListener('change', updateScene);
  $('tune-mode').addEventListener('change', () => choose(mode));
  $('upload-bpm').addEventListener('change', () => { $('upload-bpm').value = Math.min(240,Math.max(40,Number($('upload-bpm').value)||120)); choose(mode); });
  $('upload-chart').addEventListener('change', () => choose(mode));
  $('tap-offset').addEventListener('change', () => { $('tap-offset').value = Math.min(300,Math.max(-300,Number($('tap-offset').value)||0)); });
  $('rhythm-canvas').addEventListener('pointerdown', event => { if(event.button===0){event.preventDefault();$('tap').focus({preventScroll:true});tap();} });
  $('volume').addEventListener('input', () => audio?.volume());
  $('pitch').addEventListener('change', droneDisplay); $('tuning').addEventListener('change', droneDisplay);
  function interrupt() { generation++; if (run && run.phase !== 'over') finish('Stopped while away.'); else audio?.stop(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); }); window.addEventListener('pagehide', interrupt);
  document.addEventListener('cadence:flight',event=>{
    for(const id of ['difficulty','upload','remove-upload'])$(id).disabled=event.detail;
  });
  choose('crosswind');
}());
