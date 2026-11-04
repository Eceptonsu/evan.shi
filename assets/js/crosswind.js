(() => {
  const root=document.getElementById('crosswind');
  const canvas=root.querySelector('canvas'), ctx=canvas.getContext('2d');
  const status=root.querySelector('.cw-status'), count=root.querySelector('.cw-count');
  const startButton=root.querySelector('.cw-start'), demoButton=root.querySelector('.cw-demo'), soundButton=root.querySelector('.cw-sound');
  const progress=root.querySelector('.cw-progress'), bar=progress.querySelector('span');
  const hands=[...root.querySelectorAll('.cw-hand')];
  const phrase=root.querySelector('.cw-phrase');
  const uploadInput = root.querySelector('.cw-upload');
  const originalButton = root.querySelector('.cw-original');
  const trackName = root.querySelector('.cw-track');
  const settingsPanel = root.querySelector('.cw-settings');
  const settingsFields = root.querySelector('.cw-fields');
  const densityInput = root.querySelector('.cw-density');
  const mappingInput = root.querySelector('.cw-mapping');
  const bpmInput = root.querySelector('.cw-bpm');
  const offsetInput = root.querySelector('.cw-offset');
  let customTrack = null;
  let loadId = 0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const atmosphere = .65;
  let width=736,height=440,colors={},running=false,demo=false,sound=true,clockStart=0,audioStart=0,audio=null,master=null,nodes=[],raf=0,generation=0;
  const keys=['a','w','s','d'], names={a:'Turn left',d:'Turn right',w:'Climb',s:'Dive'};
  const emptyHeld=()=>Object.fromEntries(keys.map(k=>[k,null]));
  let elapsed=0,lastFrame=0,bank=0,lift=0,streak=0,hits=0,notes=[],held=emptyHeld(),messageUntil=0,impulseX=0,impulseY=0,bestStreak=0;
  let demoEvents=[],demoIndex=0,flashes={},travelX=0,altitude=0;
  const inputSources=Object.fromEntries(keys.map(k=>[k,new Set()]));
  const windowSize=.18,approach=2;
  let beat=.625,duration=50*beat;
  function makeChart(){
    const chart=[
      [4,'hold','a',6],[8,'hold','d',10],
      [12,'tap','a'],[13,'tap','d'],[14,'tap','a'],[15,'tap','d'],
      [18,'tap','w'],[20,'tap','s'],
      [24,'chord','aw'],[26,'chord','ds'],
      [28,'hold','a',30],[32,'hold','d',34],
      [36,'tap','a'],[36.5,'tap','d'],[37,'tap','a'],[38,'tap','d'],
      [40,'tap','w'],[42,'tap','s'],[44,'chord','aw'],[46,'chord','dw']
    ];
    return chart.map(([b,kind,k,end])=>({time:b*beat,end:(end??b)*beat,kind,keys:[...k],done:false,hit:false,armed:false,presses:{}}));
  }
  function rebuildScore() {
    if (!customTrack || running) return;
    const grid = mappingInput.value === 'grid';
    const bpm = Math.max(40, Math.min(240, Math.round(Number(bpmInput.value) || customTrack.profile.bpm)));
    const offset = Math.max(-300, Math.min(300, Number(offsetInput.value) || 0));
    bpmInput.disabled = !grid;
    bpmInput.value = bpm;
    offsetInput.value = offset;
    customTrack.bpm = grid ? bpm : customTrack.profile.bpm;
    customTrack.chart = window.CrosswindScore.arrange(customTrack.profile, {
      density: densityInput.value, grid, bpm, offset
    }, customTrack.buffer.duration, approach);
    count.textContent = tempoLabel();
    const moves = customTrack.chart.length;
    status.textContent = moves ? moves+' moves · ready' : 'No moves at this setting. Try another chart or track.';
    startButton.disabled = demoButton.disabled = !moves;
  }
  settingsFields.addEventListener('change',rebuildScore);
  function tempoLabel() {
    return (customTrack ? customTrack.bpm : 96) + ' BPM';
  }
  async function loadMusic() {
    const file = uploadInput.files[0];
    if (!file) return;
    const id = ++loadId;
    if (running) stop();
    startButton.disabled = demoButton.disabled = true;
    settingsFields.disabled = true;
    status.textContent = 'Listening to your track…';
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('Choose a file under 30 MB.');
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('This browser cannot play local audio.');
      if (!audio) audio = new Audio();
      const buffer = await audio.decodeAudioData(await file.arrayBuffer());
      if (id !== loadId) return;
      if (buffer.duration < 5 || buffer.duration > 300) throw new Error('Choose a track between 5 seconds and 5 minutes.');
      const analysis = await window.CadenceLab.analyse(buffer,true);
      if (id !== loadId) return;
      const profile = window.CrosswindScore.profile(analysis);
      customTrack = {buffer, profile, bpm:profile.bpm, chart:[]};
      bpmInput.value = profile.bpm;
      offsetInput.value = 0;
      mappingInput.value = profile.events.length<2 ? 'grid' : 'attacks';
      trackName.textContent = file.name;
      trackName.hidden = originalButton.hidden = settingsPanel.hidden = false;
      rebuildScore();
    } catch (error) {
      if (id !== loadId) return;
      status.textContent = error.name === 'EncodingError' ? 'Try an MP3 or WAV recording.' : error.message;
    } finally {
      if (id === loadId) {
        uploadInput.value = '';
        settingsFields.disabled = false;
        startButton.disabled = demoButton.disabled = Boolean(customTrack && !customTrack.chart.length);
      }
    }
  }
  uploadInput.addEventListener('change', loadMusic);
  originalButton.addEventListener('click', () => {
    ++loadId;
    if (running) stop();
    customTrack = null;
    trackName.hidden = originalButton.hidden = settingsPanel.hidden = true;
    trackName.textContent = '';
    count.textContent = tempoLabel();
    status.textContent = 'Ready to fly';
    settingsFields.disabled = false;
    startButton.disabled = demoButton.disabled = false;
    uploadInput.value = '';
  });
  // One camera projection for the sail, edge contacts and incoming cues.
  // Note paths stay fixed in flight coordinates; banking changes the view.
  function flightPose(lean=bank,boost=lift){
    const scale=Math.min((width-112)/302,1.25),tilt=-lean*(reduced?.025:.195);
    const cx=width*.5+lean*Math.min(32,width*.05)*(reduced?.1:1),cy=height*.48-boost*(reduced?3:22);
    const c=Math.cos(tilt),s=Math.sin(tilt);
    return {cx,cy,scale,tilt,project(x,y){return [cx+(x*c-y*s)*scale,cy+(x*s+y*c)*scale];},unproject(x,y){const dx=(x-cx)/scale,dy=(y-cy)/scale;return [dx*c+dy*s,-dx*s+dy*c];}};
  }
  // S is the exact midpoint of the quadratic hem: (64 + 2*49 + 64)/4.
  const sailPoints={a:[-151,33],d:[151,33],w:[0,-65],s:[0,56.5]};
  function catchPoint(key){
    return flightPose().project(...sailPoints[key]);
  }
  function approachVector(key){
    const target=flightPose(0,0).project(...sailPoints[key]);
    if(key==='a')return [-Math.min(width*.16,target[0]-40),-height*.16];
    if(key==='d')return [Math.min(width*.16,width-40-target[0]),-height*.16];
    if(key==='w')return [0,-Math.min(height*.20,target[1]-70)];
    return [0,Math.min(height*.23,height-28-target[1])];
  }
  function positionControls(){
    const pose=flightPose();hands.forEach(button=>{const [x,y]=catchPoint(button.dataset.key);button.style.left=x+'px';button.style.top=y+'px';button.style.transform='translate(-50%,-50%) rotate('+pose.tilt+'rad)';});
  }
  function gustPosition(note,t,key=note.keys[0],edge=note.time){
    const neutral=flightPose(0,0),base=neutral.project(...sailPoints[key]),v=approachVector(key),remaining=(edge-t)/approach;
    const local=neutral.unproject(base[0]+v[0]*remaining,base[1]+v[1]*remaining);
    const point=flightPose().project(...local);
    return {x:point[0],y:point[1],target:catchPoint(key),local};
  }
  function worldView(){return {roll:bank*(reduced?0:.045),pan:reduced?0:travelX,pitch:reduced?0:altitude+lift*32,zoom:reduced?1:1-lift*.055};}
  function curvePoint(points,t){
    const p=points.map(v=>v.slice());for(let k=p.length-1;k>0;k--)for(let i=0;i<k;i++)p[i]=[p[i][0]*(1-t)+p[i+1][0]*t,p[i][1]*(1-t)+p[i+1][1]*t];return p[0];
  }
  function edgeTrace(key){
    const flex=clothFlex(),left=[[0,-65],[-42,-54],[-103,-16+flex],[-151,33]],right=[[151,33],[103,-16-flex],[42,-54],[0,-65]];
    const lowerLeft=[[-151,33],[-94,21],[-50,33],[-12,64]],lowerRight=[[12,64],[50,33],[94,21],[151,33]];
    const sample=(curve,a,b)=>Array.from({length:10},(_,i)=>curvePoint(curve,a+(b-a)*i/9));
    if(key==='a')return [...sample(left,.92,1),...sample(lowerLeft,0,.08)];
    if(key==='d')return [...sample(lowerRight,.92,1),...sample(right,0,.08)];
    if(key==='w')return [...sample(right,.92,1),...sample(left,0,.08)];
    return Array.from({length:11},(_,i)=>curvePoint([[-12,64],[0,49],[12,64]],i/10));
  }
  function clothFlex(){return reduced?bank*2:bank*12+lift*3;}
  function activeNote(){return notes.find(n=>!n.done);}
  function notePrompt(note,t){
    if(!note)return 'Coast home';
    const label=note.keys.join(' + ').toUpperCase();
    if(note.kind==='hold')return note.armed?(Math.abs(note.end-t)<=.06?'Release '+label+' now':'Keep holding '+label):'Catch with '+label+' · hold';
    return (note.kind==='chord'?'Together: ':'Catch with ')+label+(Math.abs(note.time-t)<=.06?' now':'');
  }
  function controlCues(next,t){
    hands.forEach(button=>{
      const key=button.dataset.key,active=held[key]!==null,relevant=next?.keys.includes(key);
      const due=relevant && Math.abs((next.armed?next.end:next.time)-t)<=.06;
      button.dataset.cue=due?'release':relevant?'next':'';
      button.querySelector('span').textContent=relevant?(next.kind==='hold'?(next.armed?(due?'Release':'Hold…'):(due?'Hold now':'Hold')):(next.kind==='chord'?'Together':'Tap')):names[key];
      button.setAttribute('aria-pressed',String(active));
    });
  }
  function palette(){
    const probe=document.createElement('span'); root.appendChild(probe);
    for(const key of ['paper','ink','quiet','mist','ridge','sail','sail-light','line']) { probe.style.color='var(--'+key+')'; colors[key]=getComputedStyle(probe).color; }
    probe.remove();
  }
  function resize(){
    const rect=canvas.getBoundingClientRect();width=rect.width || 736;height=rect.height || 440;
    const dpr=Math.min(devicePixelRatio || 1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);palette();positionControls();draw(elapsed);
  }
  function path(points,color,alpha=1,line=1){ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=line;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.stroke();ctx.globalAlpha=1;}
  function tone(frequency,time,length,volume,type='sine'){
    if(!audio || !master)return;
    const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,time);
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.015);gain.gain.exponentialRampToValueAtTime(.0001,time+length);
    osc.connect(gain);gain.connect(master);osc.start(time);osc.stop(time+length+.03);nodes.push(osc);
  }
  async function music(token){
    try{
      const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)return;
      if(!audio)audio=new Audio();await audio.resume();if(token!==generation || !running)return;
      master=audio.createGain();master.gain.value=sound?.25:0;master.connect(audio.destination);audioStart=audio.currentTime+.1;clockStart=performance.now()+100;
      if (customTrack) {
        const recording = audio.createBufferSource();
        recording.buffer = customTrack.buffer;
        recording.connect(master);
        recording.start(audioStart + approach);
        nodes.push(recording);
        return;
      }
      const chords=[[146.83,220,293.66,349.23],[130.81,196,261.63,329.63],[174.61,220,349.23,440],[164.81,246.94,329.63,392]];
      for(let n=0;n<50;n++){
        const t=audioStart+n*beat, chord=chords[Math.floor(n/8)%4];
        tone(chord[n%4]*2,t,.85,.14);if(n%2===0){tone(65.41,t,.12,.22);tone(chord[0]/2,t,1.1,.18);}
        if(n%4===0)chord.forEach(f=>tone(f,t,2.1,.045,'triangle'));
      }
      const pitches={a:880,d:1174.66,w:1567.98,s:587.33};
      notes.forEach(n=>n.keys.forEach(k=>{tone(pitches[k],audioStart+n.time,.12,.09);if(n.kind==='hold'){tone(pitches[k]/2,audioStart+n.time,n.end-n.time,.045,'triangle');tone(pitches[k],audioStart+n.end,.12,.09);}}));
    }catch(_){
      if(token!==generation || !running)return;
      if(customTrack){stop();status.textContent='Audio unavailable. Try playing again.';return;}
      status.textContent='Audio unavailable · visual timing active';messageUntil=3;
    }
  }
  function silence(){nodes.forEach(n=>{try{n.stop();n.disconnect();}catch(_){}});nodes=[];if(master){master.disconnect();master=null;}audioStart=0;}
  function time(){return Math.max(0,audioStart && audio ? audio.currentTime-audioStart : (performance.now()-clockStart)/1000);}
  function feedback(text,t){status.textContent=text;messageUntil=t+.35;}
  function miss(note,text,t){if(note.done)return;note.done=true;streak=0;feedback(text,t);}
  function hit(note,t){
    if(note.done)return;note.done=true;note.hit=true;hits++;streak++;bestStreak=Math.max(bestStreak,streak);
    for(const key of note.keys){flashes[key]=t;if(key==='a')impulseX=-1;if(key==='d')impulseX=1;if(key==='w')impulseY=1;if(key==='s')impulseY=-1;}
    const err=Math.max(...note.keys.map(k=>Math.abs((note.kind==='hold'?t:note.presses[k])-(note.kind==='hold'?note.end:note.time))));
    feedback((err<.075?'Clean':'Caught')+' · '+streak+' streak',t);
  }
  function press(key){
    if(!running || held[key]!==null)return;
    const t=time();held[key]=t;
    const note=notes.find(n=>!n.done && !n.armed && n.keys.includes(key) && Math.abs(n.time-t)<=windowSize);
    if(note){
      note.presses[key]=t;
      if(note.kind==='hold'){note.armed=true;feedback('Keep holding '+key.toUpperCase(),t);}
      else if(note.keys.every(k=>held[k]!==null && note.presses[k]!==undefined)){
        const times=note.keys.map(k=>note.presses[k]);
        if(Math.max(...times)-Math.min(...times)<=.11)hit(note,t);
        else miss(note,'Closer together',t);
      }
    }else{streak=0;feedback('Wait for the marker',t);}
    controlCues(activeNote(),t);
  }
  function release(key,cancel=false){
    if(held[key]===null)return;
    const t=time();held[key]=null;
    if(!running)return;
    const note=notes.find(n=>!n.done && n.armed && n.keys.includes(key));
    if(note){
      if(!cancel && Math.abs(note.end-t)<=windowSize)hit(note,t);
      else miss(note,cancel?'Pull interrupted':t<note.end?'Early release':'Late release',t);
    }
    for(const pending of notes)if(!pending.done && pending.kind==='chord')delete pending.presses[key];
    controlCues(activeNote(),t);
  }
  function inputDown(key,source){if(!running || demo)return;const set=inputSources[key];if(set.has(source))return;set.add(source);if(set.size===1)press(key);}
  function inputUp(key,source,cancel=false){const set=inputSources[key];if(!set.delete(source))return;if(set.size===0)release(key,cancel);}
  function clearInputs(){held=emptyHeld();keys.forEach(k=>inputSources[k].clear());}
  function chapter(t){
    const b=t/beat;return b<12?'Pull & release':b<18?'Quick gusts':b<24?'Climb & dive':b<28?'Crosswinds':'Mixed flight';
  }
  function stop(finished=false){
    settingsFields.disabled = false;
    running=false;generation++;cancelAnimationFrame(raf);silence();clearInputs();hands.forEach(b=>{b.disabled=true;b.setAttribute('aria-pressed','false');});
    controlCues(null,elapsed);
    startButton.textContent='Fly again';demoButton.disabled=false;demoButton.textContent='Watch demo';
    status.textContent=finished?(demo?'Your turn. Ride the wind.':hits+' / '+notes.length+' moves · best streak '+bestStreak):'Flight stopped.';
    count.textContent=finished && !demo?'FLIGHT COMPLETE':tempoLabel();
    bar.style.width=finished?'100%':bar.style.width;progress.setAttribute('aria-valuenow',finished?'100':String(Math.round(elapsed/duration*100)));draw(elapsed);
  }
  function start(auto){
    if(running)stop();generation++;running=true;demo=auto;elapsed=0;bank=0;lift=0;travelX=0;altitude=0;impulseX=0;impulseY=0;flashes={};hits=0;streak=0;bestStreak=0;messageUntil=0;lastFrame=performance.now();clockStart=performance.now();
    beat = customTrack ? 60 / customTrack.bpm : .625;
    duration = customTrack ? customTrack.buffer.duration + approach + .25 : 50 * beat;
    notes = customTrack ? customTrack.chart.map(note=>({...note,presses:{}})) : makeChart();
    settingsFields.disabled = true;
    clearInputs();demoIndex=0;
    demoEvents=notes.flatMap(n=>n.keys.flatMap(key=>[{t:n.time,key,down:true},{t:n.kind==='hold'?n.end:n.time+.09,key,down:false}])).sort((a,b)=>a.t-b.t);
    bar.style.width='0%';progress.setAttribute('aria-valuenow','0');controlCues(notes[0],0);
    hands.forEach(b=>{b.disabled=auto;b.setAttribute('aria-pressed','false');});startButton.textContent='Stop';demoButton.disabled=true;
    status.textContent=auto?'Demo · watch the wings':notePrompt(notes[0],0);music(generation);raf=requestAnimationFrame(frame);
  }
  function frame(now){
    if(!running)return;elapsed=time();const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
    if(demo)while(demoIndex<demoEvents.length && elapsed>=demoEvents[demoIndex].t){const event=demoEvents[demoIndex++];event.down?press(event.key):release(event.key);}
    for(const n of notes)if(!n.done && elapsed>(n.armed?n.end:n.time)+windowSize)miss(n,n.armed?'Release at the ribbon’s end':'Missed · next wind',elapsed);
    const next=activeNote();
    if(elapsed>messageUntil)status.textContent=(demo?'Demo · ':'')+notePrompt(next,elapsed);
    controlCues(next,elapsed);
    const desiredX=(held.d!==null?1:0)-(held.a!==null?1:0),desiredY=(held.w!==null?1:0)-(held.s!==null?1:0);
    const targetBank = Math.max(-1, Math.min(1, desiredX + impulseX));
    const response = desiredX === 0 ? 4.5 : 6.5;
    bank += (targetBank - bank) * (1 - Math.exp(-dt * response));
    lift+=(Math.max(-1,Math.min(1,desiredY+impulseY))-lift)*(1-Math.exp(-dt*9));impulseX*=Math.exp(-dt*3);impulseY*=Math.exp(-dt*2.4);
    travelX+=bank*dt*115;altitude=Math.max(-100,Math.min(100,altitude+lift*dt*35));
    phrase.textContent=customTrack ? 'Your flight' : chapter(elapsed);
    count.textContent=demo?'DEMO':hits+' / '+notes.length;const pct=Math.min(100,elapsed/duration*100);bar.style.width=pct+'%';progress.setAttribute('aria-valuenow',String(Math.round(pct)));
    draw(elapsed);if(elapsed>=duration){stop(true);return;}raf=requestAnimationFrame(frame);
  }
  function draw(t){
    positionControls();
    ctx.clearRect(0,0,width,height);ctx.fillStyle=colors.paper;ctx.fillRect(0,0,width,height);
    const motion=reduced?0:t;
    const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,colors.paper);sky.addColorStop(1,colors.mist);ctx.globalAlpha=.6;ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;
    // The horizon rolls opposite the aircraft, with deeper layers travelling
    // faster. Accumulated heading persists after the bank eases back to level.
    const world=worldView();
    ctx.save();ctx.translate(width*.5,height*.48);ctx.rotate(world.roll);ctx.scale(world.zoom,world.zoom);ctx.translate(-width*.5,-height*.48);
    for(let layer=0;layer<5;layer++){
      const depth=.18+layer*.23,base=height*(.62+layer*.09)+world.pitch*depth,amp=height*(.11-layer*.012),pts=[];
      for(let x=-width*.5;x<=width*1.5;x+=10){const u=(x+world.pan*depth)/width;const y=base+Math.sin(u*7+layer*1.4+motion*.025)*amp+Math.sin(u*17-layer*.7)*amp*.25;pts.push([x,y]);}
      ctx.beginPath();ctx.moveTo(pts[0][0],height*2);pts.forEach(p=>ctx.lineTo(...p));ctx.lineTo(width*1.5,height*2);ctx.closePath();ctx.globalAlpha=.07+layer*.04;ctx.fillStyle=colors.ridge;ctx.fill();ctx.globalAlpha=1;
      path(pts,colors.line,.08+layer*.025,.6);
      for(let j=1;j<4;j++)path(pts.map(([x,y])=>[x,y+j*5]),colors.line,.025,.5);
    }
    // Forward flow expands out of a vanishing point and sweeps across turns.
    for(let i=0;i<32;i++){
      const depth=((i*.137+motion*.14)%1),angle=i*2.39996;
      const vx=width*.5-bank*width*.08,vy=height*.38+world.pitch*.25;
      const farX=Math.cos(angle)*width*.95,farY=Math.sin(angle)*height*.95;
      const p=depth*depth,tail=Math.max(0,depth-.045-Math.abs(bank)*.025),q=tail*tail;
      path([[vx+farX*q,vy+farY*q],[vx+farX*p,vy+farY*p]],colors.line,(.035+depth*.11)*atmosphere,.7);
    }
    ctx.restore();
    const {cx,cy,scale,tilt,project}=flightPose();
    // Two distinct tension lines connect the hands to the kite's structure.
    [-1,1].forEach(side=>{
      const attachment=project(side*53,25),handX=width*(side===-1?.25:.75),taut=held[side===-1?'a':'d']!==null;
      ctx.beginPath();ctx.moveTo(handX,height+12);ctx.quadraticCurveTo(handX+side*(taut?0:22),height*.75,attachment[0],attachment[1]);ctx.strokeStyle=colors.line;ctx.globalAlpha=taut?.8:.35;ctx.lineWidth=taut?1.15:.8;ctx.stroke();ctx.globalAlpha=1;
    });
    ctx.save();ctx.translate(cx,cy);ctx.rotate(tilt);ctx.scale(scale,scale);
    const flex=clothFlex();
    const sail=ctx.createLinearGradient(-140,-45,100,80);sail.addColorStop(0,colors['sail-light']);sail.addColorStop(.56,colors.sail);sail.addColorStop(1,colors['sail-light']);
    ctx.fillStyle=sail;ctx.beginPath();ctx.moveTo(0,-65);ctx.bezierCurveTo(-42,-54,-103,-16+flex,-151,33);ctx.bezierCurveTo(-94,21,-50,33,-12,64);ctx.quadraticCurveTo(0,49,12,64);ctx.bezierCurveTo(50,33,94,21,151,33);ctx.bezierCurveTo(103,-16-flex,42,-54,0,-65);ctx.closePath();ctx.fill();
    // Translucent panels, a bent leading edge, seams and a quiet trailing hem.
    ctx.fillStyle=colors['sail-light'];ctx.globalAlpha=.42;ctx.beginPath();ctx.moveTo(0,-65);ctx.quadraticCurveTo(-18,2,-12,64);ctx.quadraticCurveTo(-48,29,-92,26);ctx.quadraticCurveTo(-62,-18,0,-65);ctx.fill();ctx.globalAlpha=.26;ctx.beginPath();ctx.moveTo(0,-65);ctx.quadraticCurveTo(51,-12,151,33);ctx.quadraticCurveTo(87,5,12,64);ctx.quadraticCurveTo(22,1,0,-65);ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle=colors.paper;ctx.globalAlpha=.35;ctx.lineWidth=.7;
    [-1,1].forEach(side=>{for(let j=1;j<5;j++){ctx.beginPath();ctx.moveTo(0,-65);ctx.quadraticCurveTo(side*j*18,-16,side*(12+j*27),35-j*3-side*flex*j/4);ctx.stroke();}});
    ctx.globalAlpha=.5;ctx.strokeStyle=colors.ink;ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-151,33);ctx.bezierCurveTo(-103,-16+flex,-42,-54,0,-65);ctx.bezierCurveTo(42,-54,103,-16-flex,151,33);ctx.stroke();ctx.globalAlpha=.2;ctx.beginPath();ctx.moveTo(0,-65);ctx.quadraticCurveTo(4,0,0,55);ctx.stroke();ctx.globalAlpha=1;ctx.restore();
    // A fine, slightly irregular weave gives the otherwise sparse scene material.
    ctx.fillStyle=colors.ink;ctx.globalAlpha=.025*atmosphere;
    for(let i=0;i<420;i++){const x=(Math.sin(i*127.1)*43758.5453)%1,y=(Math.sin(i*311.7)*96321.912)%1;ctx.fillRect(Math.abs(x)*width,Math.abs(y)*height,1,1);}ctx.globalAlpha=1;
    drawTiming(t);
  }
  function drawTiming(t){
    const visible=running?notes.filter(n=>!n.done && n.time-t<=approach):[{keys:['a'],kind:'hold',time:t+.65,end:t+1.6},{keys:['d'],kind:'tap',time:t+1.35,end:t+1.35}];
    // No board or lanes. A short, fading wind trace identifies the actual
    // point on the sail; the native button uses that exact same coordinate.
    const activeKeys=new Set(visible.flatMap(n=>n.keys));
    activeKeys.forEach(key=>{
      const point=catchPoint(key),origin=gustPosition({keys:[key],time:t+approach},t);
      path([[origin.x,origin.y],point],colors.line,.16,.8);
    });
    const dot=(x,y,hollow=false)=>{
      ctx.save();ctx.shadowColor=colors.sail;ctx.shadowBlur=hollow?0:13;
      ctx.beginPath();ctx.arc(x,y,hollow?7:8,0,Math.PI*2);ctx.fillStyle=hollow?colors.paper:colors.sail;ctx.fill();
      ctx.shadowBlur=0;ctx.strokeStyle=colors.sail;ctx.lineWidth=2;ctx.stroke();
      if(!hollow){ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fillStyle=colors.paper;ctx.fill();}ctx.restore();
    };
    visible.forEach(n=>{
      const points=[];
      n.keys.forEach(key=>{
        const front=gustPosition(n,t,key),tail=gustPosition(n,t,key,n.end),target=catchPoint(key);
        const head=n.armed && t>=n.time?target:[front.x,front.y];
        if(n.kind==='hold'){
          const visibleTail=gustPosition(n,t,key,Math.min(n.end,t+approach));
          ctx.save();ctx.lineCap='round';path([head,[visibleTail.x,visibleTail.y]],colors.sail,n.armed?.5:.3,8);ctx.restore();
          if(n.end-t<=approach)dot(tail.x,tail.y,true);
        }
        // The head is absorbed into the wing after a hold begins. The hollow
        // release tail remains distinct, and reaches precisely the same point.
        if(!n.armed || t<n.time)dot(front.x,front.y);
        points.push(head);
      });
      if(points.length===2)path(points,colors.sail,.35,1);
    });
    keys.forEach(key=>{
      const [x,y]=catchPoint(key);
      const flash=flashes[key]===undefined?0:Math.max(0,1-(t-flashes[key])*4);
      const active=held[key]!==null,edge=edgeTrace(key).map(p=>flightPose().project(...p));
      ctx.save();ctx.lineCap='round';if(active || flash){ctx.shadowColor=colors['sail-light'];ctx.shadowBlur=14;}
      path(edge,active || flash?colors['sail-light']:colors.ink,active || flash?1:.65,active || flash?3.5:2);ctx.restore();
    });
  }
  hands.forEach(button=>{
    const key=button.dataset.key;
    button.addEventListener('pointerdown',e=>{if(demo || !running)return;e.preventDefault();button.setPointerCapture(e.pointerId);inputDown(key,'pointer'+e.pointerId);});
    button.addEventListener('pointerup',e=>inputUp(key,'pointer'+e.pointerId));button.addEventListener('pointercancel',e=>inputUp(key,'pointer'+e.pointerId,true));
    button.addEventListener('lostpointercapture',e=>inputUp(key,'pointer'+e.pointerId,true));
    button.addEventListener('keydown',e=>{if((e.key===' ' || e.key==='Enter')&&!e.repeat){e.preventDefault();inputDown(key,'button'+e.key);}});
    button.addEventListener('keyup',e=>{if(e.key===' ' || e.key==='Enter'){e.preventDefault();inputUp(key,'button'+e.key);}});
  });
  function keyControl(e){const k=e.key.toLowerCase();return keys.includes(k)?k:({arrowleft:'a',arrowright:'d',arrowup:'w',arrowdown:'s'})[k];}
  window.addEventListener('keydown',e=>{const key=keyControl(e);if(key && running && !demo){e.preventDefault();if(!e.repeat)inputDown(key,'key'+e.key.toLowerCase());}});
  window.addEventListener('keyup',e=>{const key=keyControl(e);if(key && running && !demo){e.preventDefault();inputUp(key,'key'+e.key.toLowerCase());}});
  window.addEventListener('blur',()=>{if(running)stop();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden && running)stop();});
  startButton.addEventListener('click',()=>running?stop():start(false));demoButton.addEventListener('click',()=>start(true));
  function applySound(){soundButton.textContent=sound?'Sound on':'Sound off';soundButton.setAttribute('aria-pressed',String(sound));if(master)master.gain.setTargetAtTime(sound?.25:0,audio.currentTime,.03);}
  try {
    sound = localStorage.getItem('cadence.crosswind.sound') !== 'off';
  } catch {}
  applySound();
  soundButton.addEventListener('click', () => {
    sound = !sound;
    applySound();
    try { localStorage.setItem('cadence.crosswind.sound', sound ? 'on' : 'off'); } catch {}
  });
  new ResizeObserver(resize).observe(canvas);matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{palette();draw(elapsed);});controlCues(null,0);resize();
})();
