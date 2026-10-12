export function createAtmosphere(root) {
const events = new AbortController();
const on = (target, type, listener, options = {}) => target.addEventListener(type, listener, { ...options, signal: events.signal });
let disposed = false, loadController;
const canvas = root.querySelector('canvas');
const status = root.querySelector('[data-status]');
const start = root.querySelector('[data-start]');
const asset = new URL('../atmosphere/', import.meta.url);
const defaults = { sunElevation:25, sunAzimuth:0, altitude:Math.log10(2), elevation:6, azimuth:0, exposure:10, ground:'#595959', resolution:0.75, zoom:1 };
const presets = {
  day: { ...defaults },
  sunset: { ...defaults, sunElevation:0.5, altitude:Math.log10(2), elevation:2 },
  orbit: { ...defaults, sunElevation:20, altitude:Math.log10(15001), elevation:-90, exposure:10 },
};
const limits = {sunElevation:[-12,90],sunAzimuth:[-180,180],altitude:[0,5],elevation:[-90,90],azimuth:[-180,180],exposure:[0.1,40],zoom:[0.5,8]};
let state = { ...defaults }, scene = 'Daylight', gl, program, textures = [], frame, busy = false;
const radians = value => value * Math.PI / 180;
const altitude = () => Math.max(0.001, 10 ** state.altitude - 1);
const wrap = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
const controls = Object.keys(defaults).map(key => root.querySelector(`[data-control="${key}"]`)).filter(Boolean);
function loadHash() {
  const saved = new URLSearchParams(location.search).get('atmosphere');
  const params = new URLSearchParams(saved || '');
  for (const [key, bounds] of Object.entries(limits)) {
    if (!params.has(key)) continue;
    const n = Number(params.get(key));
    if (Number.isFinite(n)) state[key] = Math.max(bounds[0], Math.min(bounds[1], n));
  }
  if (/^#[0-9a-f]{6}$/i.test(params.get('ground'))) state.ground = params.get('ground');
  if ([0.5,0.75,1].includes(Number(params.get('resolution')))) state.resolution = Number(params.get('resolution'));
  if (params.size) scene = 'Custom view';
}
function sync() {
  for (const input of controls) {
    const key = input.dataset.control;
    input.value = state[key];
    const output = root.querySelector(`output[for="${input.id}"]`);
    if (output) output.textContent = key === 'altitude' ? (altitude() < 1 ? `${(altitude()*1000).toFixed(0)} m` : `${altitude().toLocaleString(undefined,{maximumFractionDigits:1})} km`) : key === 'exposure' ? `${state.exposure.toFixed(1)}×` : `${Number(state[key]).toFixed(input.step === '1' ? 0 : 1)}°`;
  }
  root.querySelector('[data-scene]').textContent = scene;
  root.querySelector('[data-zoom-value]').textContent = `${+state.zoom.toFixed(1)}×`;
  root.querySelector('[data-zoom-in]').disabled = state.zoom >= limits.zoom[1];
  root.querySelector('[data-zoom-out]').disabled = state.zoom <= limits.zoom[0];
  for (const button of root.querySelectorAll('[data-preset]')) button.setAttribute('aria-pressed', String(scene.toLowerCase() === ({day:'daylight',sunset:'sunset',orbit:'orbit'})[button.dataset.preset]));
  schedule();
}
function schedule() {
  if (disposed || !program || frame || gl.isContextLost()) return;
  frame = requestAnimationFrame(() => { frame = null; draw(); });
}
function draw() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(devicePixelRatio, 2) * state.resolution;
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(program);
  const e = radians(state.elevation), a = radians(state.azimuth);
  const forward = [Math.cos(e)*Math.cos(a),Math.cos(e)*Math.sin(a),Math.sin(e)];
  const right = [-Math.sin(a),Math.cos(a),0];
  const up = [-Math.sin(e)*Math.cos(a),-Math.sin(e)*Math.sin(a),Math.cos(e)];
  const se = radians(state.sunElevation), sa = radians(state.sunAzimuth);
  const v3 = (name, value) => gl.uniform3fv(gl.getUniformLocation(program,name),value);
  v3('camera', [0,0,6360 + altitude()]);
  v3('forward', forward); v3('right',right); v3('up',up);
  v3('sun_direction',[Math.cos(se)*Math.cos(sa),Math.cos(se)*Math.sin(sa),Math.sin(se)]);
  // HTML color values are sRGB; the shader uses linear surface reflectance.
  v3('ground_albedo', state.ground.slice(1).match(/../g).map(h => { const c = parseInt(h,16)/255; return c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4; }));
  gl.uniform1f(gl.getUniformLocation(program,'exposure'),state.exposure);
  gl.uniform1f(gl.getUniformLocation(program,'aspect'),canvas.width/canvas.height);
  gl.uniform1f(gl.getUniformLocation(program,'tan_fov'),0.466307658/state.zoom);
  gl.drawArrays(gl.TRIANGLES,0,3);
}
function shader(type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s,source); gl.compileShader(s);
  if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(detail);
  }
  return s;
}
async function response(name, signal) {
  const r = await fetch(new URL(name,asset), {signal});
  if (!r.ok) throw new Error(`Could not load ${name}: HTTP ${r.status}`);
  return r;
}
function dispose() {
  cancelAnimationFrame(frame); frame = null;
  for (const t of textures) gl?.deleteTexture(t);
  textures = [];
  if (program) gl.deleteProgram(program);
  program = null;
}
async function init() {
  if (disposed || busy || program) return;
  busy = true; start.disabled = true;
  status.textContent = 'Loading the original atmosphere tables…';
  const controller = loadController = new AbortController();
  try {
    gl = canvas.getContext('webgl2', {alpha:false,antialias:false,depth:false,preserveDrawingBuffer:false});
    if (!gl) throw new Error('This playground needs WebGL 2. Try a browser with hardware acceleration enabled.');
    if (!('DecompressionStream' in window)) throw new Error('This browser cannot unpack the atmosphere data. Try a current browser.');
    if (gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) < 256) throw new Error('This device does not support the atmosphere’s 3D textures.');
    const tables = [ ['transmittance',256,64,1],['scattering',256,128,32],['irradiance',64,16,1],['s_mie_scattering',256,128,32] ];
    const [model, view, ...data] = await Promise.all([
      response('model.glsl',controller.signal).then(r=>r.text()),
      response('view.glsl',controller.signal).then(r=>r.text()),
      ...tables.map(async ([name,w,h,d]) => {
        const r = await response(name+'.bin.gz',controller.signal);
        const buffer = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        if (buffer.byteLength !== w*h*d*8) throw new Error(`Invalid ${name} table size`);
        return new Uint16Array(buffer);
      }),
    ]);
    if (disposed) return;
    if (gl.isContextLost()) throw new Error('The graphics context was lost while loading. Please retry.');
    status.textContent = 'Preparing the atmosphere…';
    const vertex = shader(gl.VERTEX_SHADER,`#version 300 es
precision highp float;
uniform vec3 forward, right, up;
uniform float aspect, tan_fov;
out vec3 view_ray;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0;
  view_ray = forward + right * p.x * aspect * tan_fov + up * p.y * tan_fov;
  gl_Position = vec4(p,0.0,1.0);
}`);
    let fragment;
    try { fragment = shader(gl.FRAGMENT_SHADER,model+'\n'+view); }
    catch (error) { gl.deleteShader(vertex); throw error; }
    program = gl.createProgram(); gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    for (let i = 0; i < tables.length; i++) {
      const [name,w,h,d] = tables[i];
      const target = d === 1 ? gl.TEXTURE_2D : gl.TEXTURE_3D;
      const texture = gl.createTexture(); textures.push(texture);
      gl.activeTexture(gl.TEXTURE0+i); gl.bindTexture(target,texture);
      gl.texParameteri(target,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(target,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(target,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(target,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if (d > 1) {
        gl.texParameteri(target,gl.TEXTURE_WRAP_R,gl.CLAMP_TO_EDGE);
        gl.texImage3D(target,0,gl.RGBA16F,w,h,d,0,gl.RGBA,gl.HALF_FLOAT,data[i]);
      } else gl.texImage2D(target,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,data[i]);
      gl.uniform1i(gl.getUniformLocation(program, name === 's_mie_scattering' ? 'single_mie_scattering_texture' : name+'_texture'),i);
    }
    if (gl.getError() !== gl.NO_ERROR) throw new Error('The graphics device could not upload the atmosphere tables.');
    root.querySelector('[data-welcome]').hidden = true;
    root.querySelector('.viewport').classList.add('is-running');
    status.textContent = 'Original Earth model · precomputed scattering';
    schedule();
  } catch (error) {
    controller.abort(); dispose();
    if (disposed) return;
    console.error('Atmosphere playground:',error);
    status.textContent = error.message.length > 200 ? 'The atmosphere shader could not compile on this device. Try another browser.' : error.message;
    root.querySelector('[data-welcome]').hidden = false;
    start.textContent = 'Retry loading';
  } finally { busy = false; loadController = null; start.disabled = false; }
}
loadHash(); sync();
for (const input of controls) on(input,'input', () => {const key=input.dataset.control;state[key] = key === 'ground' ? input.value : Number(input.value);scene = 'Custom view';sync();});
for (const button of root.querySelectorAll('[data-preset]')) on(button,'click',()=>{state={...presets[button.dataset.preset]};scene=button.textContent;sync();});
on(root.querySelector('[data-reset]'),'click',()=>{
  state={...defaults};scene='Daylight';
  const url=new URL(location.href);url.searchParams.delete('atmosphere');
  history.replaceState(history.state,'',url);sync();
});
on(start,'click',init);
on(root.querySelector('[data-share]'),'click',async()=>{
  const params = new URLSearchParams(Object.entries(state).map(([key,value])=>[key,typeof value === 'number' ? String(+value.toFixed(4)) : value]));
  const url = new URL(location.href);
  url.searchParams.set('atmosphere',params.toString());url.hash='atmosphere-playground';
  history.replaceState(history.state,'',url);
  try {await navigator.clipboard.writeText(location.href);status.textContent='Link copied. This view is saved in the URL.';}
  catch {status.textContent='This view is saved in the address bar. Copy its URL to share.';}
});
function zoomBy(factor) {
  state.zoom = Math.max(limits.zoom[0], Math.min(limits.zoom[1], state.zoom * factor));
  scene='Custom view';sync();
}
on(root.querySelector('[data-zoom-in]'),'click',()=>zoomBy(1.25));
on(root.querySelector('[data-zoom-out]'),'click',()=>zoomBy(1/1.25));
on(canvas,'wheel',event=>{
  if (!program) return;
  event.preventDefault();
  const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
  zoomBy(Math.exp(-Math.max(-200,Math.min(200,pixels))*.002));
},{passive:false});
const pointers = new Map();
const span = () => {const [a,b]=pointers.values();return a && b ? Math.hypot(a.x-b.x,a.y-b.y) : 0;};
on(canvas,'pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});});
on(canvas,'pointermove',event=>{
  const pointer=pointers.get(event.pointerId);
  if (!pointer) return;
  const previousSpan=span(),dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
  pointer.x=event.clientX;pointer.y=event.clientY;
  if (pointers.size===2) {
    const nextSpan=span();
    if (previousSpan>2 && nextSpan>2) zoomBy(nextSpan/previousSpan);
  } else if (pointers.size===1) {
    state.azimuth=wrap(state.azimuth-dx*.15/state.zoom);
    state.elevation=Math.max(-90,Math.min(90,state.elevation+dy*.15/state.zoom));
    scene='Custom view';sync();
  }
});
for (const type of ['pointerup','pointercancel','lostpointercapture']) on(canvas,type,event=>pointers.delete(event.pointerId));
on(canvas,'keydown',event=>{
  if (['+','=','-','_'].includes(event.key)) {
    event.preventDefault();zoomBy(['+','='].includes(event.key)?1.25:1/1.25);return;
  }
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  state.azimuth=wrap(state.azimuth+(event.key==='ArrowLeft'? -2:event.key==='ArrowRight'?2:0));
  state.elevation=Math.max(-90,Math.min(90,state.elevation+(event.key==='ArrowUp'?2:event.key==='ArrowDown'?-2:0)));
  scene='Custom view';sync();
});
const resize = new ResizeObserver(schedule);resize.observe(canvas);
on(canvas,'webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frame);frame=null;status.textContent='Graphics context lost. Waiting for recovery…';});
on(canvas,'webglcontextrestored',()=>{dispose();init();});
on(window,'popstate',()=>{state={...defaults};scene='Daylight';loadHash();sync();});
on(window,'pagehide',()=>{loadController?.abort();dispose();});
on(window,'pageshow',event=>{if(event.persisted) {root.querySelector('[data-welcome]').hidden=false;start.textContent='Start exploring';}});
return () => {
  disposed = true;
  events.abort();loadController?.abort();resize.disconnect();dispose();
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
};
}
