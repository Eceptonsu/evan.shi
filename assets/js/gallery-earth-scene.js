import * as THREE from './lib/three/three.module.min.js';
import { TrackballControls } from './lib/three/TrackballControls.js';
import { placeMarkers } from './gallery-earth-layout.js';

// Same equirectangular convention as SphereGeometry's UVs: east is negative Z.
function positionAt(lat, lng) {
  const latitude = THREE.MathUtils.degToRad(lat);
  const longitude = THREE.MathUtils.degToRad(lng);
  return new THREE.Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), -Math.cos(latitude) * Math.sin(longitude));
}

function earthTexture(land) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  context.fillStyle = '#123349';
  context.fillRect(0, 0, 2048, 1024);
  context.fillStyle = '#73aaa6';
  context.strokeStyle = '#a5cfba';
  context.lineWidth = 0.65;
  for (const feature of land.features) {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const polygon of polygons) {
      context.beginPath();
      for (const ring of polygon) {
        ring.forEach(([lng, lat], index) => {
          const x = (lng + 180) / 360 * 2048;
          const y = (90 - lat) / 180 * 1024;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
      }
      context.fill('evenodd');
      context.stroke();
    }
  }
  context.strokeStyle = 'rgba(174, 221, 225, .13)';
  context.lineWidth = 1;
  context.beginPath();
  for (let lng = 0; lng <= 360; lng += 15) {
    context.moveTo(lng / 360 * 2048, 0);
    context.lineTo(lng / 360 * 2048, 1024);
  }
  for (let lat = 15; lat < 180; lat += 15) {
    context.moveTo(0, lat / 180 * 1024);
    context.lineTo(2048, lat / 180 * 1024);
  }
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function createEarth(root, photos) {
  // Load before creating GPU resources so a failed request leaves nothing allocated.
  const response = await fetch(root.dataset.landUrl, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Earth geography unavailable');
  const land = await response.json();
  if (!root.isConnected) return;
  const stage = root.querySelector('[data-earth-stage]');
  const status = root.querySelector('[data-earth-status]');
  const events = new AbortController();
  const on = (element, event, handler, options = {}) => element.addEventListener(event, handler, { ...options, signal: events.signal });
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive Earth. Drag to rotate freely, scroll or pinch to zoom. Use arrow keys to rotate, plus or minus to zoom, Home to reset. Choose a photograph below to find any location.');
  stage.append(canvas);

  // Decorative space stays behind the WebGL surface and never captures input.
  const sky = document.createElement('div');
  sky.className = 'gallery-earth__sky';
  sky.setAttribute('aria-hidden', 'true');
  let skySeed = 4271;
  const random = () => {
    skySeed = (skySeed * 16807) % 2147483647;
    return (skySeed - 1) / 2147483646;
  };
  for (let index = 0; index < 48; index++) {
    const star = document.createElement('i');
    star.className = 'gallery-earth__star';
    star.style.left = `${3 + random() * 94}%`;
    star.style.top = `${3 + random() * 94}%`;
    star.style.setProperty('--star-size', `${1.3 + random() * 1.4}px`);
    star.style.setProperty('--star-duration', `${1.8 + random() * 2.4}s`);
    star.style.setProperty('--star-delay', `${-random() * 15}s`);
    star.style.setProperty('--star-drift', `${16 + random() * 12}s`);
    sky.append(star);
  }
  const moon = document.createElement('span');
  moon.className = 'gallery-earth__moon';
  sky.append(moon);
  stage.prepend(sky);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 30);
  camera.position.copy(positionAt(28, -112).multiplyScalar(3.4));
  camera.lookAt(0, 0, 0);
  const controls = new TrackballControls(camera, canvas);
  controls.noPan = true;
  controls.rotateSpeed = 2.5;
  controls.zoomSpeed = 0.85;
  controls.minDistance = 2.25;
  controls.maxDistance = 5.5;
  // Keyboard handling is scoped to the focused canvas, not the whole page.
  controls.keys = [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  controls.staticMoving = reducedMotion.matches;
  controls.dynamicDampingFactor = 0.12;

  const texture = earthTexture(land);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const material = new THREE.MeshPhongMaterial({ map: texture, shininess: 12, specular: 0x24475b });
  scene.add(new THREE.Mesh(geometry, material));
  scene.add(new THREE.AmbientLight(0xc4e7ee, 1.65));
  const sun = new THREE.DirectionalLight(0xfff4de, 2.2);
  scene.add(sun);

  // A Fresnel rim adds a thin atmosphere without hiding the surface or markers.
  const atmosphereMaterial = new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main() { vec4 p = modelViewMatrix * vec4(position, 1.0); vNormal = normalize(normalMatrix * normal); vView = normalize(-p.xyz); gl_Position = projectionMatrix * p; }',
    fragmentShader: 'varying vec3 vNormal; varying vec3 vView; void main() { float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 3.5); gl_FragColor = vec4(0.28, 0.72, 0.85, rim * 0.48); }',
    transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const atmosphere = new THREE.Mesh(geometry, atmosphereMaterial);
  atmosphere.scale.setScalar(1.028);
  scene.add(atmosphere);

  const overlay = document.createElement('div');
  overlay.className = 'gallery-earth__markers';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('gallery-earth__leaders');
  svg.setAttribute('aria-hidden', 'true');
  stage.append(svg, overlay);
  const select = root.querySelector('[data-earth-place]');
  const open = root.querySelector('[data-earth-open]');
  let selected = -1;
  const markers = photos.map((photo, index) => {
    const image = photo.querySelector('img');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gallery-earth__pin';
    button.title = `${photo.dataset.title} · ${photo.dataset.location}`;
    button.setAttribute('aria-label', `Open ${photo.dataset.title}, ${photo.dataset.location}`);
    const thumb = document.createElement('img');
    thumb.src = image.getAttribute('src');
    thumb.alt = '';
    thumb.draggable = false;
    const label = document.createElement('span');
    label.textContent = photo.dataset.title;
    button.append(thumb, label);
    on(button, 'click', () => photo.click());
    overlay.append(button);
    const line = document.createElementNS(svg.namespaceURI, 'line');
    const dot = document.createElementNS(svg.namespaceURI, 'circle');
    dot.setAttribute('r', '3');
    svg.append(line, dot);
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${photo.dataset.title} · ${photo.dataset.location}`;
    select.append(option);
    const marker = { button, line, dot, position: positionAt(Number(photo.dataset.lat), Number(photo.dataset.lng)), index,
      offsetX: 0, offsetY: -26, opacity: 0, ready: thumb.complete && thumb.naturalWidth > 0 };
    button.inert = true;
    button.setAttribute('aria-hidden', 'true');
    line.style.opacity = dot.style.opacity = '0';
    on(thumb, 'load', () => { marker.ready = true; });
    // A missing thumbnail should not make the full photograph unreachable.
    on(thumb, 'error', () => { marker.ready = true; });
    return marker;
  });

  let active = false, intersecting = true, frame = 0, dirty = true, disposed = false, spinning = false, previousTime = 0;
  let width = 1, height = 1;
  const projected = new THREE.Vector3();
  const towardCamera = new THREE.Vector3();
  const rotationAxis = new THREE.Vector3();

  function draw() {
    dirty = false;
    camera.updateMatrixWorld();
    sun.position.copy(camera.position).add(new THREE.Vector3(-1, 2, 1));
    renderer.render(scene, camera);
  }

  function updateMarkers(delta) {
    const fadeBlend = reducedMotion.matches ? 1 : 1 - Math.exp(-delta / 0.12);
    const positionBlend = reducedMotion.matches ? 1 : 1 - Math.exp(-delta / 0.18);
    const visible = [];
    for (const marker of markers) {
      towardCamera.copy(camera.position).sub(marker.position).normalize();
      projected.copy(marker.position).project(camera);
      // Fade across a band on the front of the horizon instead of flipping
      // display:none at a single threshold. Small drags cannot toggle a pin.
      const horizon = THREE.MathUtils.smoothstep(marker.position.dot(towardCamera), 0.015, 0.22);
      const edge = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(projected.x), Math.abs(projected.y)), 0.82, 0.98);
      marker.targetOpacity = marker.ready ? horizon * edge : 0;
      if (marker.targetOpacity < 0.001 && marker.opacity < 0.001) {
        marker.opacity = 0;
        marker.offsetX = 0;
        marker.offsetY = -26;
        marker.button.style.visibility = 'hidden';
        marker.button.style.opacity = marker.line.style.opacity = marker.dot.style.opacity = '0';
        marker.button.inert = true;
        marker.button.setAttribute('aria-hidden', 'true');
        marker.button.classList.remove('is-interactive');
        continue;
      }
      marker.x = (projected.x + 1) * width / 2;
      marker.y = (1 - projected.y) * height / 2;
      visible.push(marker);
    }
    placeMarkers(visible, width, height, positionBlend);
    for (const marker of visible) {
      marker.opacity += (marker.targetOpacity - marker.opacity) * fadeBlend;
      const interactive = marker.targetOpacity > 0.05 && marker.opacity > 0.15;
      marker.button.inert = !interactive;
      marker.button.setAttribute('aria-hidden', String(!interactive));
      marker.button.classList.toggle('is-interactive', interactive);
      marker.button.style.visibility = 'visible';
      marker.button.style.opacity = String(marker.opacity);
      const scale = reducedMotion.matches ? 1 : 0.88 + marker.opacity * 0.12;
      marker.button.style.transform = `translate(${marker.px}px, ${marker.py}px) translate(-50%, -50%) scale(${scale})`;
      marker.line.style.opacity = String(marker.opacity * 0.65);
      marker.dot.style.opacity = String(marker.opacity);
      marker.line.setAttribute('x1', marker.x);
      marker.line.setAttribute('y1', marker.y);
      marker.line.setAttribute('x2', marker.px);
      marker.line.setAttribute('y2', marker.py);
      marker.dot.setAttribute('cx', marker.x);
      marker.dot.setAttribute('cy', marker.y);
    }
  }

  function tick(time) {
    frame = 0;
    if (disposed || !active || !intersecting || document.hidden) return;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 1 / 60;
    previousTime = time;
    if (spinning) {
      camera.position.applyAxisAngle(camera.up, delta * 0.09);
      dirty = true;
    }
    controls.update();
    if (dirty) draw();
    updateMarkers(delta);
    frame = requestAnimationFrame(tick);
  }
  function wake() {
    stage.classList.toggle('is-sky-active', active && intersecting && !document.hidden && !disposed);
    dirty = true;
    previousTime = 0;
    if (!frame && active && intersecting && !document.hidden && !disposed) frame = requestAnimationFrame(tick);
  }
  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    width = rect.width;
    height = rect.height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    controls.handleResize();
    wake();
  }
  const spinButton = root.querySelector('[data-earth-spin]');
  function stopSpin() { spinning = false; spinButton.setAttribute('aria-pressed', 'false'); }
  function reset() {
    stopSpin();
    controls.reset();
    camera.position.copy(positionAt(28, -112).multiplyScalar(3.4));
    camera.up.set(0, 1, 0);
    controls.update();
    wake();
  }
  function zoom(factor) {
    camera.position.setLength(THREE.MathUtils.clamp(camera.position.length() * factor, controls.minDistance, controls.maxDistance));
    controls.update();
    wake();
  }
  controls.addEventListener('change', () => { dirty = true; });
  controls.addEventListener('start', stopSpin);
  on(root.querySelector('[data-earth-reset]'), 'click', reset);
  root.querySelectorAll('[data-earth-zoom]').forEach(button => on(button, 'click', () => zoom(button.dataset.earthZoom === 'in' ? 0.88 : 1.14)));
  on(spinButton, 'click', () => { spinning = !spinning; spinButton.setAttribute('aria-pressed', String(spinning)); wake(); });
  on(reducedMotion, 'change', () => { controls.staticMoving = reducedMotion.matches; if (reducedMotion.matches) stopSpin(); });
  on(canvas, 'keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', 'Home'].includes(event.key)) return;
    event.preventDefault();
    stopSpin();
    if (event.key === 'Home') return reset();
    if (['+', '=', '-'].includes(event.key)) return zoom(event.key === '-' ? 1.14 : 0.88);
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    if (horizontal) rotationAxis.copy(camera.up).normalize();
    else rotationAxis.crossVectors(camera.up, camera.position).normalize();
    camera.position.applyAxisAngle(rotationAxis, ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -0.12 : 0.12);
    if (!horizontal) camera.up.applyAxisAngle(rotationAxis, ['ArrowUp'].includes(event.key) ? -0.12 : 0.12);
    controls.update();
    wake();
  });
  on(select, 'change', () => {
    selected = select.value === '' ? -1 : Number(select.value);
    open.disabled = selected < 0;
    markers.forEach(marker => marker.button.classList.toggle('is-selected', marker.index === selected));
    if (selected < 0) return;
    stopSpin();
    // Reset also clears any residual drag momentum before centering a pin.
    controls.reset();
    camera.position.copy(markers[selected].position).multiplyScalar(3.1);
    camera.up.set(0, 1, 0);
    controls.update();
    wake();
  });
  on(open, 'click', () => { if (selected >= 0) photos[selected].click(); });
  on(document, 'visibilitychange', wake);
  on(window, 'scroll', () => controls.handleResize(), { passive: true });
  on(canvas, 'webglcontextlost', event => {
    event.preventDefault();
    active = false;
    stage.classList.remove('is-sky-active');
    status.hidden = false;
    status.textContent = 'The Earth view was interrupted. Reload this page to try again, or switch to Grid to see your photos.';
  });
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  const intersection = new IntersectionObserver(entries => { intersecting = entries[0].isIntersecting; wake(); });
  intersection.observe(stage);
  status.hidden = true;
  resize();

  return {
    setActive(value) { active = value; controls.enabled = value; if (value) resize(); else { stage.classList.remove('is-sky-active'); cancelAnimationFrame(frame); frame = 0; } },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      events.abort();
      observer.disconnect();
      intersection.disconnect();
      controls.dispose();
      geometry.dispose();
      material.dispose();
      atmosphereMaterial.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      stage.classList.remove('is-sky-active');
      sky.remove(); canvas.remove(); overlay.remove(); svg.remove();
    }
  };
}
