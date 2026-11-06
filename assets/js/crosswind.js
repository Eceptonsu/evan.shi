(() => {
  const root=document.getElementById('crosswind');
  const canvas=root.querySelector('canvas'), ctx=canvas.getContext('2d');
  const art=window.CrosswindArt;
  const status=root.querySelector('.cw-status'), count=root.querySelector('.cw-count');
  const startButton=root.querySelector('.cw-start'), demoButton=root.querySelector('.cw-demo'), soundButton=root.querySelector('.cw-sound');
  const progress=root.querySelector('.cw-progress'), bar=progress.querySelector('span');
  const hands=[...root.querySelectorAll('.cw-hand')];
  const phrase=root.querySelector('.cw-phrase');
  const trackName = root.querySelector('.cw-track');
  const settingsPanel = root.querySelector('.cw-settings');
  const settingsFields = root.querySelector('.cw-fields');
  const instruction = root.querySelector('.cw-instruction');
  const mappingInput = root.querySelector('.cw-mapping');
  const bpmInput = root.querySelector('.cw-bpm');
  const offsetInput = root.querySelector('.cw-offset');
  let customTrack = null;
  let difficulty='easy', loading=false;
  const levels={
    easy:{window:.32,approach:3,bpm:80,label:'Easy · A / D taps'},
    medium:{window:.24,approach:2.6,bpm:88,label:'Medium · four directions & holds'},
    hard:{window:.16,approach:2,bpm:96,label:'Hard · holds, chords & releases'}
  };
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const atmosphere = .65;
  let width=736,height=440,colors={},running=false,demo=false,sound=true,clockStart=0,audioStart=0,audio=null,master=null,nodes=[],raf=0,generation=0;
  const keys=['a','w','s','d'], names={a:'Turn left',d:'Turn right',w:'Climb',s:'Dive'};
  const emptyHeld=()=>Object.fromEntries(keys.map(k=>[k,null]));
  let elapsed=0,lastFrame=0,bank=0,lift=0,streak=0,hits=0,notes=[],held=emptyHeld(),messageUntil=0,impulseX=0,impulseY=0,bestStreak=0;
  let demoEvents=[],demoIndex=0,flashes={},travelX=0,altitude=0;
  let forward=0,airspeed=1,gust=0;
  const inputSources=Object.fromEntries(keys.map(k=>[k,new Set()]));
  let windowSize=.32,approach=3;
  let beat=.75,duration=50*beat;
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
    const easy=Array.from({length:11},(_,i)=>[4+i*4,'tap',i%2?'d':'a']);
    const medium=[[4,'tap','a'],[7,'tap','d'],[10,'tap','a'],[13,'tap','d'],[16,'hold','a',18],[21,'hold','d',23],[26,'tap','w'],[29,'tap','s'],[32,'tap','a'],[35,'tap','d'],[38,'hold','w',40],[43,'tap','s'],[46,'tap','d']];
    return (difficulty==='easy'?easy:difficulty==='medium'?medium:chart).map(([b,kind,k,end])=>({time:b*beat,end:(end??b)*beat,kind,keys:[...k],done:false,hit:false,armed:false,presses:{}}));
  }
  function resetFlightView() {
    elapsed = bank = lift = travelX = altitude = 0;
    forward=0;airspeed=1;gust=0;
    flashes = {};
    notes = [];
    startButton.textContent = 'Play';
    phrase.textContent = levels[difficulty].label;
    instruction.textContent=difficulty==='easy'?'A / D · Catch the petal tip at the wing.':difficulty==='medium'?'W A S D · Hold the ink ribbon through its tail. Release is automatic.':'W A S D · Catch petals. Hold ribbons, then release at the open petal.';
    hands.forEach(button=>button.hidden=difficulty==='easy' && !['a','d'].includes(button.dataset.key));
    bar.style.width = '0%';
    progress.setAttribute('aria-valuenow', '0');
    draw(0);
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
      difficulty, grid, bpm, offset
    }, customTrack.buffer.duration, approach);
    count.textContent = tempoLabel();
    resetFlightView();
    const moves = customTrack.chart.length;
    status.textContent = moves ? moves+' moves · ready' : 'No moves at this setting. Try another chart or track.';
    startButton.disabled = demoButton.disabled = !moves;
  }
  settingsFields.addEventListener('change',rebuildScore);
  function tempoLabel() {
    return (customTrack ? customTrack.bpm : levels[difficulty].bpm) + ' BPM';
  }
  document.addEventListener('cadence:track',event=>{
    if(running)stop();
    customTrack=event.detail ? {...event.detail,bpm:event.detail.profile.bpm,chart:[]} : null;
    trackName.hidden=settingsPanel.hidden=!customTrack;
    trackName.textContent=customTrack?.name||'';
    if(customTrack){
      bpmInput.value=customTrack.profile.bpm;
      offsetInput.value=0;
      mappingInput.value='attacks';
      rebuildScore();
    }else{resetFlightView();count.textContent=tempoLabel();status.textContent='Ready to fly';}
  });
  document.addEventListener('cadence:loading',event=>{
    loading=event.detail;
    if(loading && running)stop();
    startButton.disabled=demoButton.disabled=loading || Boolean(customTrack && !customTrack.chart.length);
    settingsFields.disabled=loading;
  });
  document.addEventListener('cadence:mode',event=>{
    if(running)stop();
    difficulty=levels[event.detail.level]?event.detail.level:'easy';
    windowSize=levels[difficulty].window;approach=levels[difficulty].approach;
    beat=60/levels[difficulty].bpm;
    if(customTrack)rebuildScore();
    else{resetFlightView();count.textContent=tempoLabel();status.textContent='Ready to fly';}
    if(event.detail.mode==='crosswind')resize();
  });
  // Timing is an invariant screen-space frame. Wind adds only lateral drift;
  // steering cannot change a petal's approach or its arrival time.
  function flightPose(){
    const scale=Math.min((width-132)/302,1.08),cx=width*.5,cy=height*.61;
    return {cx,cy,scale,tilt:0,project:(x,y)=>[cx+x*scale,cy+y*scale]};
  }
  // S is the exact midpoint of the quadratic hem: (64 + 2*49 + 64)/4.
  const sailPoints={a:[-151,33],d:[151,33],w:[0,-65],s:[0,56.5]};
  function catchPoint(key){
    return flightPose().project(...sailPoints[key]);
  }
  function approachVector(key){
    const target=catchPoint(key);
    if(key==='a')return [-Math.min(width*.16,target[0]-40),-height*.16];
    if(key==='d')return [Math.min(width*.16,width-40-target[0]),-height*.16];
    if(key==='w')return [0,-Math.min(height*.27,target[1]-82)];
    return [0,Math.min(height*.23,height-28-target[1])];
  }
  function positionControls(){
    const pose=flightPose();hands.forEach(button=>{const [x,y]=catchPoint(button.dataset.key);button.style.left=x+'px';button.style.top=y+'px';button.style.transform='translate(-50%,-50%) rotate('+pose.tilt+'rad)';});
  }
  function gustPosition(note,t,key=note.keys[0],edge=note.time){
    const target=catchPoint(key),v=approachVector(key),remaining=(edge-t)/approach;
    const length=Math.hypot(...v),wind=petalWind(note,t,key,edge);
    // A transverse sway keeps progress toward the wing uniform. It settles
    // completely for the final 450 ms, leaving a calm, readable contact.
    const drift=reduced?0:Math.min(12,width*.023,length*.12)*wind.settle*Math.sin(wind.phase);
    return {x:target[0]+v[0]*remaining-v[1]/length*drift,
      y:target[1]+v[1]*remaining+v[0]/length*drift,target};
  }
  function petalWind(note,t,key,edge=note.time){
    const u=Math.max(0,Math.min(1,(edge-t-.45)/.7));
    return {settle:u*u*(3-2*u),phase:(1-(edge-t)/approach)*Math.PI*2.6+note.time*1.71+key.charCodeAt(0)*.37};
  }
  function petalPose(note,t,key,edge=note.time){
    const v=approachVector(key),base=Math.atan2(-v[1],-v[0]);
    if(reduced)return {angle:base,fold:1,curl:0};
    const wind=petalWind(note,t,key,edge),weight=.12+.88*wind.settle;
    const before=gustPosition(note,t-.01,key,edge),after=gustPosition(note,t+.01,key,edge);
    return {angle:Math.atan2(after.y-before.y,after.x-before.x)+Math.sin(wind.phase*1.3)*.22*weight,
      fold:1-(.5+.5*Math.sin(wind.phase*1.6))*.42*weight,
      curl:Math.cos(wind.phase*.9)*2.6*weight};
  }
  function worldView(){return {roll:bank*(reduced?0:.045),pan:reduced?0:travelX,pitch:reduced?0:altitude+lift*32,zoom:reduced?1:1-lift*.055};}
  function advanceTravel(dt){
    if(reduced)return;
    // Always cruise forward. Lift trades speed for height; dives recover it.
    // A caught gust gives a brief push, easing back without a camera snap.
    const target=Math.max(.72,Math.min(1.45,1-lift*.25+gust*.2));
    airspeed+=(target-airspeed)*(1-Math.exp(-dt*2));
    forward+=dt*2.1*airspeed;
    gust*=Math.exp(-dt*1.7);
  }
  function worldPoint(x,y,z){
    const world=worldView(),perspective=3.8/(z+2);
    const vx=width*(.5-bank*(reduced?0:.035));
    const vy=height*.34+world.pitch*.12;
    const lateral=Math.tanh(world.pan/width)*.45;
    return [vx+(x-lateral)*width*.46*perspective,vy+(y*height*.34+world.pitch*.32)*perspective];
  }
  function drawPassage(){
    const spacing=4.2,first=Math.floor(forward/spacing);
    // Sparse painted crags occupy the banks; the white river and mist remain
    // open around the kite and timing paths. Each crag is fixed in world space.
    for(let row=6;row>=0;row--){
      const id=first+row,z=(id+1)*spacing-forward;
      const fade=Math.min(1,z/1.4)*Math.max(0,Math.min(1,(28-z)/8));
      for(const side of [-1,1]){
        const variation=Math.sin(id*2.73+side*2),x=side*(1.45+variation*.24);
        const breadth=1.65+Math.cos(id*1.3+side)*.35;
        const tall=1.75+Math.sin(id*3.1+side)*.35;
        const left=worldPoint(x-breadth/2,1.65-tall,z),right=worldPoint(x+breadth/2,1.65,z);
        ctx.globalAlpha=fade*(.52+(1-z/30)*.48);
        art.drawMountain(ctx,id+(side===-1?0:3),left[0],left[1],right[0]-left[0],right[1]-left[1]);
      }
      ctx.globalAlpha=1;
      // Curved wisps travel down a winding, unpainted river. Their opacity
      // falls at either end so no row or straight seam appears on arrival.
      const wisp=[];
      for(let i=0;i<=36;i++){
        const x=-1.6+i*.09+.25*Math.sin(id*1.7);
        wisp.push(worldPoint(x,1.48+.15*Math.sin(x*2.4+id),z));
      }
      ctx.lineCap='round';path(wisp,colors.paper,fade*.36,Math.max(1,18/(z+2)));
    }
    for(let i=0;i<18;i++){
      const z=((i*1.731-forward)%22+22)%22;
      const angle=i*2.39996,x=Math.cos(angle)*2.4,y=Math.sin(angle)*1.6;
      const fade=Math.min(1,z/1.2)*Math.min(1,(22-z)/4);
      const a=worldPoint(x,y,z+.7),b=worldPoint(x,y,z);
      path([a,[(a[0]+b[0])/2+3,(a[1]+b[1])/2],b],colors.line,fade*.09,.45+1/(z+2));
    }
  }
  function birdPosition(i,t){
    const clock=reduced?0:t,follow=clock-i*.22;
    const glide=.25+.75*(.5+.5*Math.sin(clock*.63+i*.9))**2;
    return {x:((width*(.16+i*.034)+clock*18+Math.sin(follow*.55)*10+Math.sin(clock*.93+i)*3+30)%(width+60))-30,
      y:height*(.24+i*.012)+Math.sin(follow*.7)*height*.026+Math.sin(clock*1.13+i*1.7)*3.5,
      wing:1.5+Math.sin(clock*(4.6+i*.19)+i*.9)*3.2*glide,
      bank:Math.cos(follow*.7)*1.2+Math.cos(clock*1.13+i*1.7)*.6};
  }
  function drawBirds(t){
    // Screen-space flight: neither roll, heading nor airspeed steers the flock.
    for(let i=0;i<5;i++){
      const {x,y,wing,bank}=birdPosition(i,t);
      ctx.save();ctx.strokeStyle=colors.ink;ctx.globalAlpha=.28;ctx.lineWidth=.8;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(x-5,y-wing);
      ctx.quadraticCurveTo(x-2.3,y-wing*.7-1,x,y);
      ctx.quadraticCurveTo(x+2.5,y-wing*.65-1,x+5,y-wing*.8+bank);ctx.stroke();
      ctx.restore();
    }
  }
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
      master=audio.createGain();master.gain.value=sound?(customTrack?.85:.25):0;master.connect(audio.destination);audioStart=audio.currentTime+.1;clockStart=performance.now()+100;
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
  function time(){
    if(!audioStart || !audio)return Math.max(0,(performance.now()-clockStart)/1000);
    const stamp=audio.getOutputTimestamp?.();
    const heard=stamp?.contextTime>0 && stamp.performanceTime>0 ? stamp.contextTime+(performance.now()-stamp.performanceTime)/1000 : audio.currentTime-(audio.baseLatency||0);
    return Math.max(0,heard-audioStart);
  }
  function feedback(text,t){status.textContent=text;messageUntil=t+.35;}
  function miss(note,text,t){if(note.done)return;note.done=true;streak=0;feedback(text,t);}
  function hit(note,t){
    if(note.done)return;note.done=true;note.hit=true;hits++;streak++;bestStreak=Math.max(bestStreak,streak);
    gust=Math.min(1,gust+.65);
    for(const key of note.keys){flashes[key]=t;if(key==='a')impulseX=-1;if(key==='d')impulseX=1;if(key==='w')impulseY=1;if(key==='s')impulseY=-1;}
    const err=Math.max(...note.keys.map(k=>Math.abs((note.kind==='hold'?t:note.presses[k])-(note.kind==='hold'?note.end:note.time))));
    feedback((err<.075?'Clean':'Caught')+' · '+streak+' streak',t);
  }
  function press(key,t=time()){
    if(!running || held[key]!==null || difficulty==='easy' && !['a','d'].includes(key))return;
    held[key]=t;
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
  function release(key,cancel=false,t=time()){
    if(held[key]===null)return;
    held[key]=null;
    if(!running)return;
    const note=notes.find(n=>!n.done && n.armed && n.keys.includes(key));
    if(note){
      if(!cancel && (Math.abs(note.end-t)<=windowSize || difficulty==='medium' && t>=note.end-windowSize))hit(note,t);
      else miss(note,cancel?'Pull interrupted':t<note.end?'Early release':'Late release',t);
    }
    for(const pending of notes)if(!pending.done && pending.kind==='chord')delete pending.presses[key];
    controlCues(activeNote(),t);
  }
  function inputDown(key,source){if(!running || demo)return;const set=inputSources[key];if(set.has(source))return;set.add(source);if(set.size===1)press(key);}
  function inputUp(key,source,cancel=false){const set=inputSources[key];if(!set.delete(source))return;if(set.size===0)release(key,cancel);}
  function clearInputs(){held=emptyHeld();keys.forEach(k=>inputSources[k].clear());}
  function stop(finished=false){
    settingsFields.disabled = false;
    document.dispatchEvent(new CustomEvent('cadence:flight',{detail:false}));
    running=false;generation++;cancelAnimationFrame(raf);silence();clearInputs();hands.forEach(b=>{b.disabled=true;b.setAttribute('aria-pressed','false');});
    controlCues(null,elapsed);
    startButton.textContent='Fly again';demoButton.disabled=false;demoButton.textContent='Watch demo';
    status.textContent=finished?(demo?'Your turn. Ride the wind.':hits+' / '+notes.length+' moves · best streak '+bestStreak):'Flight stopped.';
    count.textContent=finished && !demo?'FLIGHT COMPLETE':tempoLabel();
    bar.style.width=finished?'100%':bar.style.width;progress.setAttribute('aria-valuenow',finished?'100':String(Math.round(elapsed/duration*100)));draw(elapsed);
  }
  function start(auto){
    if(loading || root.hidden)return;
    if(running)stop();generation++;running=true;demo=auto;elapsed=0;bank=0;lift=0;travelX=0;altitude=0;impulseX=0;impulseY=0;flashes={};hits=0;streak=0;bestStreak=0;messageUntil=0;lastFrame=performance.now();clockStart=performance.now();
    forward=0;airspeed=1;gust=0;
    beat = 60 / (customTrack ? customTrack.bpm : levels[difficulty].bpm);
    duration = customTrack ? customTrack.buffer.duration + approach + .25 : 50 * beat;
    notes = customTrack ? customTrack.chart.map(note=>({...note,presses:{}})) : makeChart();
    settingsFields.disabled = true;
    document.dispatchEvent(new CustomEvent('cadence:flight',{detail:true}));
    clearInputs();demoIndex=0;
    demoEvents=notes.flatMap(n=>n.keys.flatMap(key=>[{t:n.time,key,down:true},{t:n.kind==='hold'?n.end:n.time+.09,key,down:false}])).sort((a,b)=>a.t-b.t);
    bar.style.width='0%';progress.setAttribute('aria-valuenow','0');controlCues(notes[0],0);
    hands.forEach(b=>{b.disabled=auto;b.setAttribute('aria-pressed','false');});startButton.textContent='Stop';demoButton.disabled=true;
    status.textContent=auto?'Demo · watch the wings':notePrompt(notes[0],0);music(generation);raf=requestAnimationFrame(frame);
  }
  function frame(now){
    if(!running)return;elapsed=time();const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
    if(demo)while(demoIndex<demoEvents.length && elapsed>=demoEvents[demoIndex].t){const event=demoEvents[demoIndex++];event.down?press(event.key,event.t):release(event.key,false,event.t);}
    if(difficulty==='medium')for(const n of notes)if(!n.done && n.armed && elapsed>=n.end)hit(n,elapsed);
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
    advanceTravel(dt);
    phrase.textContent=levels[difficulty].label;
    count.textContent=demo?'DEMO':hits+' / '+notes.length;const pct=Math.min(100,elapsed/duration*100);bar.style.width=pct+'%';progress.setAttribute('aria-valuenow',String(Math.round(pct)));
    draw(elapsed);if(elapsed>=duration){stop(true);return;}raf=requestAnimationFrame(frame);
  }
  function draw(t){
    positionControls();
    ctx.clearRect(0,0,width,height);ctx.fillStyle=colors.paper;ctx.fillRect(0,0,width,height);
    const motion=reduced?0:t;
    // The wash breathes with the actual recording, even between playable notes.
    // The kite and hit targets stay stable so audio response cannot move a target.
    const songTime=t-approach;
    const energy=customTrack && running && songTime>=0 ? Math.min(1, (customTrack.profile.envelope[Math.floor(songTime/customTrack.profile.step)]||0)/customTrack.profile.reference) : 0;
    const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,colors.paper);sky.addColorStop(1,colors.mist);ctx.globalAlpha=.45+(reduced?0:energy*.3);ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;
    // The horizon rolls opposite the aircraft, with deeper layers travelling
    // faster. Accumulated heading persists after the bank eases back to level.
    const world=worldView();
    ctx.save();ctx.translate(width*.5,height*.48);ctx.rotate(world.roll);ctx.scale(world.zoom,world.zoom);ctx.translate(-width*.5,-height*.48);
    // Layered ink washes in the far distance establish a slow horizon.
    for(let layer=0;layer<4;layer++){
      const x=width*(-.32+layer*.39)-world.pan*.025;
      ctx.globalAlpha=.10+layer%2*.035;
      art.drawMountain(ctx,layer+2,x,height*.04+world.pitch*.06,width*.68,height*.88);
    }
    ctx.globalAlpha=1;
    drawPassage();
    ctx.restore();
    drawBirds(motion);
    const {cx,cy,scale,tilt}=flightPose();
    art.kite(ctx,{cx,cy,scale,tilt},clothFlex(),colors,{lean:reduced?bank*.2:bank,lift:reduced?lift*.2:lift});
    // A fine, slightly irregular weave gives the otherwise sparse scene material.
    ctx.fillStyle=colors.ink;ctx.globalAlpha=.025*atmosphere;
    for(let i=0;i<420;i++){const x=(Math.sin(i*127.1)*43758.5453)%1,y=(Math.sin(i*311.7)*96321.912)%1;ctx.fillRect(Math.abs(x)*width,Math.abs(y)*height,1,1);}ctx.globalAlpha=1;
    drawTiming(t);
  }
  function drawTiming(t){
    const visible=running?notes.filter(n=>!n.done && n.time-t<=approach):[{keys:['a'],kind:difficulty==='easy'?'tap':'hold',time:t+.65,end:t+1.6},{keys:['d'],kind:'tap',time:t+1.35,end:t+1.35}];
    // No board or lanes. A short, fading wind trace identifies the actual
    // point on the sail; the native button uses that exact same coordinate.
    const activeKeys=new Set(visible.flatMap(n=>n.keys));
    activeKeys.forEach(key=>{
      const note=visible.find(n=>n.keys.includes(key)),edge=note.armed?note.end:note.time;
      const trace=Array.from({length:33},(_,i)=>{const p=gustPosition(note,edge-approach*(1-i/32),key,edge);return [p.x,p.y];});
      path(trace,colors.line,.12,.8);
    });
    function petal(point,key,n,open=false){
      const pose=petalPose(n,t,key,open?n.end:n.time);
      art.petal(ctx,point[0],point[1],pose.angle,open,colors.sail,colors.paper,pose);
    }
    visible.forEach(n=>{
      const points=[];
      n.keys.forEach(key=>{
        const front=gustPosition(n,t,key),tail=gustPosition(n,t,key,n.end),target=catchPoint(key);
        const head=n.armed && t>=n.time?target:[front.x,front.y];
        if(n.kind==='hold'){
          ctx.save();ctx.lineCap='round';
          const ribbon=[];
          for(let i=0;i<=20;i++){
            const u=i/20,bend=Math.sin(u*Math.PI)*3*Math.sin(n.time+t*.4);
            const from=n.armed?Math.max(t,n.time):n.time,to=Math.min(n.end,t+approach);
            const p=gustPosition(n,t,key,from+(to-from)*u);
            ribbon.push([p.x+bend,p.y]);
          }
          path(ribbon,colors.sail,n.armed?.27:.16,9);
          path(ribbon,colors.sail,n.armed?.7:.45,2.5);ctx.restore();
          if(n.end-t<=approach)petal([tail.x,tail.y],key,n,true);
        }
        // The head is absorbed into the wing after a hold begins. The hollow
        // release tail remains distinct, and reaches precisely the same point.
        if(!n.armed || t<n.time)petal([front.x,front.y],key,n);
        points.push(head);
      });
      if(points.length===2){const [a,b]=points;path([a,[(a[0]+b[0])/2,(a[1]+b[1])/2+12],b],colors.sail,.28,.8);}
    });
    keys.forEach(key=>{
      if(difficulty==='easy' && !['a','d'].includes(key))return;
      const [x,y]=catchPoint(key);
      const flash=flashes[key]===undefined?0:Math.max(0,1-(t-flashes[key])*4);
      const active=held[key]!==null || running && notes.some(n=>!n.done && n.keys.includes(key) && Math.abs((n.armed?n.end:n.time)-t)<windowSize),edge=edgeTrace(key).map(p=>flightPose().project(...p));
      ctx.save();ctx.lineCap='round';
      path(edge,active || flash?colors.sail:colors.ink,active || flash?1:.6,active || flash?4:1.5);ctx.restore();
      if(flash && !reduced){
        const age=1-flash;
        for(let i=0;i<4;i++){
          const angle=i*1.7+key.charCodeAt(0),distance=10+age*27;
          path([[x+Math.cos(angle)*distance,y+Math.sin(angle)*distance],[x+Math.cos(angle)*(distance+5),y+Math.sin(angle)*(distance+5)]],colors.sail,flash*.5,1.4);
        }
      }
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
  window.addEventListener('keydown',e=>{if(e.target?.closest?.('input,select,a') || e.ctrlKey || e.metaKey || e.altKey)return;const key=keyControl(e);if(key && running && !demo){e.preventDefault();if(!e.repeat)inputDown(key,'key'+e.key.toLowerCase());}});
  window.addEventListener('keyup',e=>{const key=keyControl(e);if(key && running && !demo){e.preventDefault();inputUp(key,'key'+e.key.toLowerCase());}});
  window.addEventListener('blur',()=>{if(running)stop();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden && running)stop();});
  startButton.addEventListener('click',()=>running?stop():start(false));demoButton.addEventListener('click',()=>start(true));
  function applySound(){soundButton.textContent=sound?'Sound on':'Sound off';soundButton.setAttribute('aria-pressed',String(sound));if(master)master.gain.setTargetAtTime(sound?(customTrack?.85:.25):0,audio.currentTime,.03);}
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
