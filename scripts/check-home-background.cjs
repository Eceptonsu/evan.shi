const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the shipped controller with deterministic media failures and lifecycle events.
function fixture() {
  let now = 0, timerId = 0;
  const timers = new Map(), elements = [], mutations = [];
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.attributes = {};
      this.listeners = {};
      this.children = [];
      this.className = '';
      this.paused = true;
      this.currentTime = 0;
      this.buffered = { length: 0 };
      this.loads = 0;
      this.plays = 0;
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        add: name => { if (!this.classList.contains(name)) this.className += ' ' + name; }
      };
      elements.push(this);
    }
    get isConnected() { return this.root || !!this.parentNode?.isConnected; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    emit(name, data = {}) { (this.listeners[name] || []).forEach(fn => fn(data)); }
    appendChild(child) { child.parentNode = this; this.children.push(child); }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(el => el !== this);
      this.parentNode = null;
    }
    pause() { this.paused = true; }
    load() { this.loads++; this.paused = true; }
    play() {
      this.plays++;
      if (this.blocked) return Promise.reject({ name: 'NotAllowedError' });
      // A stalled resource leaves play() pending, just as it does in browsers.
      return new Promise(() => {});
    }
    getBoundingClientRect() { return { top: 0, bottom: 800, height: this.height || 80 }; }
  }
  const sidebar = new Element(); sidebar.root = true;
  const background = new Element(); background.className = 'sidebar-bg'; sidebar.appendChild(background);
  const pushState = new Element(); pushState.root = true;
  const document = new Element();
  document.hidden = false;
  document.createElement = tag => new Element(tag);
  const ids = { _drawer: sidebar, _sidebar: sidebar, _pushState: pushState };
  document.getElementById = id => ids[id] || null;
  document.querySelectorAll = selector => {
    if (selector === '#_sidebar .sidebar-bg') return sidebar.children.filter(el => el.className === 'sidebar-bg');
    return elements.filter(el => el.isConnected && el.classList.contains('home-background-video') &&
      (!selector.endsWith('.is-playing') || el.classList.contains('is-playing')));
  };
  const scenes = ['fjord', 'alpine', 'mist'].map(id => ({ id, label: id, file: id + '.mp4', poster: id + '.jpg' }));
  const script = new Element();
  Object.entries({ 'data-scenes': JSON.stringify(scenes), 'data-video-root': '/assets/video/',
    'data-home': '/', 'data-blog': '/blog/', 'data-sections': '["/gallery/"]' })
    .forEach(([name, value]) => script.setAttribute(name, value));
  document.currentScript = script;
  const window = new Element();
  const reducedMotion = new Element(); reducedMotion.matches = false;
  const connection = new Element(); connection.saveData = false;
  window.matchMedia = () => reducedMotion;
  window.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; };
  const clearTimeout = id => timers.delete(id);
  const location = { href: 'https://example.test/?scene=fjord', pathname: '/', search: '?scene=fjord' };
  const history = { replaceState: (_, __, url) => { location.search = url.search; } };
  class MutationObserver {
    constructor(fn) { this.fn = fn; mutations.push(this); }
    observe(target) { this.target = target; }
    disconnect() {}
  }
  const context = vm.createContext({ document, window, location, history, URL, URLSearchParams,
    Intl, Date, navigator: { connection }, sessionStorage: { getItem: () => null, setItem() {} },
    setTimeout: window.setTimeout, clearTimeout, MutationObserver });
  vm.runInContext(fs.readFileSync('assets/js/home-background.js', 'utf8'), context);
  return {
    document, window, reducedMotion, connection, sidebar, pushState, location, elements,
    videos: () => document.querySelectorAll('.home-background-video'),
    current: () => document.querySelectorAll('.home-background-video').at(-1),
    next: () => sidebar.children.find(el => el.tag === 'button').emit('click'),
    playing(video) { video.paused = false; video.emit('playing'); },
    async tick(ms) {
      const end = now + ms;
      for (;;) {
        const item = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!item) break;
        now = item[1].at;
        timers.delete(item[0]);
        item[1].fn();
        await Promise.resolve();
      }
      now = end;
    },
    replaceBackground() {
      background.remove();
      const replacement = new Element(); replacement.className = 'sidebar-bg'; sidebar.appendChild(replacement);
      mutations.filter(observer => observer.target === sidebar).forEach(observer => observer.fn());
      return replacement;
    }
  };
}

(async () => {
  {
    const page = fixture(), video = page.current();
    assert.equal(video.preload, 'auto');
    assert.equal(video.muted, true);
    assert.ok(video.poster.endsWith('/fjord.jpg'));
    assert.ok(video.classList.contains('is-visible'), 'Cold start displays the scene preview');
    await page.tick(13000);
    assert.equal(video.loads, 1, 'A silent startup stall triggers recovery');
    await page.tick(100000);
    assert.equal(video.loads, 3, 'A permanently unavailable resource has bounded retries');
    page.document.emit('pointerdown');
    await page.tick(13000);
    assert.equal(video.loads, 4, 'User interaction allows recovery after exhausted retries');
  }
  {
    const page = fixture(), video = page.current();
    page.playing(video);
    for (let i = 1; i <= 30; i++) {
      video.currentTime = i;
      video.emit('timeupdate');
      await page.tick(1000);
    }
    assert.equal(video.loads, 0, 'Healthy playback is never reloaded');
    video.emit('waiting');
    await page.tick(13000);
    assert.equal(video.loads, 1, 'A mid-playback stall recovers');
  }
  {
    const page = fixture(), video = page.current();
    for (let i = 1; i <= 5; i++) {
      await page.tick(10000);
      video.buffered = { length: 1, end: () => i };
      video.emit('progress');
    }
    assert.equal(video.loads, 0, 'Slow but advancing downloads are retained');
    page.document.hidden = true;
    page.document.emit('visibilitychange');
    await page.tick(30000);
    assert.equal(video.loads, 0, 'Hidden tabs do not retry downloads');
    page.document.hidden = false;
    page.document.emit('visibilitychange');
    await page.tick(13000);
    assert.equal(video.loads, 1, 'Returning to a visible tab restores recovery');
  }
  {
    const page = fixture(), video = page.current();
    video.blocked = true;
    video.emit('error');
    await page.tick(1000);
    const loads = video.loads, plays = video.plays;
    await page.tick(40000);
    assert.equal(video.loads, loads, 'Autoplay denial does not repeatedly reload media');
    page.document.emit('pointerdown');
    await Promise.resolve();
    assert.ok(video.plays > plays, 'A gesture retries blocked autoplay');
  }
  {
    const page = fixture(), original = page.current();
    page.playing(original);
    page.next();
    const failed = page.current();
    failed.emit('error');
    assert.ok(original.isConnected, 'A failed scene switch preserves the outgoing scene');
    page.next();
    const next = page.current();
    assert.equal(failed.isConnected, false, 'Switching past a failed video releases it');
    page.playing(next);
    original.emit('progress');
    await page.tick(1300);
    assert.equal(page.videos().length, 1, 'Crossfades leave only one decoder active');
    assert.equal(page.current(), next);
    const replacement = page.replaceBackground();
    assert.equal(page.current().parentNode, replacement, 'Theme background replacement reattaches video');
    page.location.pathname = '/projects/detail/';
    page.pushState.emit('hy-push-state-after');
    assert.equal(page.videos().length, 0, 'Non-section routes release background video');
    await page.tick(30000);
    assert.equal(page.videos().length, 0);
  }
  {
    const page = fixture();
    page.reducedMotion.matches = true;
    page.reducedMotion.emit('change');
    assert.equal(page.videos().length, 0, 'Reduced motion releases video');
    page.reducedMotion.matches = false;
    page.reducedMotion.emit('change');
    assert.equal(page.videos().length, 1);
    page.window.emit('pagehide');
    await page.tick(30000);
    assert.equal(page.videos().length, 0, 'Page exit cancels all video recovery');
    page.window.emit('pageshow');
    assert.equal(page.videos().length, 1, 'Back/forward restoration restarts the scene');
  }
  {
    let banner = null, mutation, resize;
    const properties = {}, events = {};
    const document = {
      documentElement: { style: { setProperty: (name, value) => { properties[name] = value; } } },
      getElementById: id => id === '_pushState' ? {} : banner,
      addEventListener: (name, callback) => { events[name] = callback; }
    };
    class ResizeObserver {
      constructor(callback) { resize = callback; }
      observe() {}
      disconnect() {}
    }
    class MutationObserver {
      constructor(callback) { mutation = callback; }
      observe() {}
    }
    const window = { ResizeObserver, addEventListener() {} };
    vm.runInNewContext(fs.readFileSync('assets/js/cookie-banner-layout.js', 'utf8'),
      { window, document, ResizeObserver, MutationObserver });
    assert.equal(properties['--cookie-banner-height'], '0px');
    banner = { isConnected: true, getBoundingClientRect: () => ({ height: 80.4 }) };
    mutation();
    assert.equal(properties['--cookie-banner-height'], '81px', 'Late consent notice reserves its actual height');
    banner.getBoundingClientRect = () => ({ height: 142 });
    resize();
    assert.equal(properties['--cookie-banner-height'], '142px', 'Wrapped phone notice reserves more space');
    banner = null;
    events['hy--cookies-ok']();
    assert.equal(properties['--cookie-banner-height'], '0px', 'Consent dismissal restores page space');
  }
  console.log('Background recovery, autoplay, navigation, lifecycle, and responsive consent spacing checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
