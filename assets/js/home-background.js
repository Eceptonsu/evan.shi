(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;
  var scenes;
  try { scenes = JSON.parse(script.getAttribute('data-scenes')); } catch (error) { return; }
  if (!Array.isArray(scenes) || !scenes.length) return;
  var videoRoot = new URL(script.getAttribute('data-video-root'), location.href);
  var homePath = new URL(script.getAttribute('data-home'), location.href).pathname;
  var blogPath = new URL(script.getAttribute('data-blog'), location.href).pathname;
  var sectionPaths;
  try { sectionPaths = JSON.parse(script.getAttribute('data-sections')); } catch (error) { sectionPaths = []; }
  sectionPaths = sectionPaths.map(function (path) { return new URL(path, location.href).pathname; });
  sectionPaths.push(homePath);
  var dayFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric'
  });
  var epoch = Date.UTC(2026, 8, 7);
  var sceneId = null;
  var manualSceneId = null;
  var manualDayKey = null;
  var midnightTimer;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var connection = navigator.connection;
  var video = null;
  var observer = null;
  var visible = true;
  var retryTimer = null;
  var retryCount = 0;
  var recoveryTimer = null;
  var playPending = null;
  var autoplayBlocked = false;
  var nextButton = null;

  function dayDetails() {
    var parts = {};
    dayFormat.formatToParts(new Date()).forEach(function (part) { parts[part.type] = part.value; });
    return {
      key: parts.year + '-' + parts.month + '-' + parts.day,
      number: Math.floor((Date.UTC(+parts.year, +parts.month - 1, +parts.day) - epoch) / 86400000)
    };
  }

  function storedScene(details) {
    try {
      var stored = JSON.parse(sessionStorage.getItem('home-background-scene'));
      if (stored && stored.day === details.key) {
        return scenes.find(function (scene) { return scene.id === stored.id; });
      }
    } catch (error) { /* Storage can be unavailable without affecting the backgrounds. */ }
    return null;
  }

  function todayScene() {
    var details = dayDetails();
    if (manualDayKey !== details.key) {
      manualDayKey = details.key;
      manualSceneId = null;
    }
    var manual = scenes.find(function (scene) { return scene.id === manualSceneId; });
    if (manual) return manual;
    /* An optional scene URL previews the collection without adding page controls. */
    var preview = new URLSearchParams(location.search).get('scene');
    var override = scenes.find(function (scene) { return scene.id === preview; });
    if (override) return override;
    var remembered = storedScene(details);
    if (remembered) return remembered;
    return scenes[((details.number % scenes.length) + scenes.length) % scenes.length];
  }

  function checkDay() {
    clearTimeout(midnightTimer);
    if (!document.hidden) refresh();
    /* Check the date on minute boundaries, including across daylight-saving changes. */
    midnightTimer = setTimeout(checkDay, 60000 - (Date.now() % 60000));
  }

  function allowed() {
    var drawer = document.getElementById('_drawer');
    var path = location.pathname;
    var blogPage = path.indexOf(blogPath) === 0 && /^\d+\/?$/.test(path.slice(blogPath.length));
    var sectionPage = sectionPaths.indexOf(path) >= 0 || blogPage;
    return sectionPage && drawer &&
      !reducedMotion.matches && !(connection && connection.saveData);
  }

  function discardVideo(target) {
    if (!target) return;
    target.pause();
    target.removeAttribute('src');
    target.load();
    target.remove();
  }

  function removeVideo() {
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
    playPending = null;
    autoplayBlocked = false;
    clearTimeout(retryTimer);
    retryTimer = null;
    retryCount = 0;
    if (observer) observer.disconnect();
    observer = null;
    video = null;
    document.querySelectorAll('.home-background-video').forEach(discardVideo);
  }

  function removeButton() {
    if (nextButton) nextButton.remove();
    nextButton = null;
  }

  function nextScene(selected) {
    return scenes[(scenes.indexOf(selected) + 1) % scenes.length];
  }

  function updateButton(selected) {
    if (!allowed()) return removeButton();
    var sidebar = document.getElementById('_sidebar');
    if (!sidebar) return;
    if (!nextButton || !nextButton.isConnected) {
      nextButton = document.createElement('button');
      nextButton.className = 'home-background-next';
      nextButton.type = 'button';
      nextButton.innerHTML = '<span aria-hidden="true">&#8594;</span>';
      nextButton.addEventListener('click', function () {
        var current = scenes.find(function (scene) { return scene.id === sceneId; }) || todayScene();
        var next = nextScene(current);
        manualSceneId = next.id;
        manualDayKey = dayDetails().key;
        try {
          sessionStorage.setItem('home-background-scene', JSON.stringify({ day: manualDayKey, id: manualSceneId }));
        } catch (error) { /* The in-memory selection still works. */ }
        if (new URLSearchParams(location.search).has('scene')) {
          var url = new URL(location.href);
          url.searchParams.set('scene', manualSceneId);
          history.replaceState(history.state, '', url);
        }
        nextButton.disabled = true;
        refresh();
      });
      sidebar.appendChild(nextButton);
    }
    var upcoming = nextScene(selected);
    nextButton.setAttribute('aria-label', 'Show next background: ' + upcoming.label);
    nextButton.setAttribute('title', 'Next background: ' + upcoming.label);
  }

  function syncPlayback() {
    if (!video) return;
    if (document.hidden || !visible || !allowed()) {
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
      video.pause();
      return;
    }
    var current = video;
    if (autoplayBlocked) return;
    watchPlayback(current);
    if (playPending === current || !current.paused) return;
    playPending = current;
    var attempt = current.play();
    if (attempt) attempt.then(function () {
      if (playPending === current) playPending = null;
    }, function (error) {
      if (playPending === current) playPending = null;
      /* A pause/navigation can interrupt a pending play without being a failure. */
      if (video !== current || error.name === 'AbortError') return;
      if (error.name === 'NotAllowedError') {
        autoplayBlocked = true;
        clearTimeout(recoveryTimer);
        recoveryTimer = null;
        if (nextButton) nextButton.disabled = false;
        return;
      }
      scheduleRetry(current);
    });
    else playPending = null;
  }

  function watchPlayback(current, progressed) {
    if (video !== current) return;
    if (progressed) {
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
    }
    if (recoveryTimer || retryTimer || autoplayBlocked ||
        document.hidden || !visible || !allowed() || retryCount >= 3) return;
    /* A pending play promise and a silent stall can otherwise leave the cover stuck forever. */
    recoveryTimer = window.setTimeout(function () {
      recoveryTimer = null;
      scheduleRetry(current);
    }, 12000);
  }

  function scheduleRetry(current) {
    if (video !== current || retryTimer || !allowed()) return;
    clearTimeout(recoveryTimer);
    recoveryTimer = null;
    if (nextButton) nextButton.disabled = false;
    if (retryCount >= 3 || document.hidden || !visible || autoplayBlocked) return;
    var delay = Math.min(500 * Math.pow(2, retryCount), 8000);
    retryCount += 1;
    retryTimer = window.setTimeout(function () {
      retryTimer = null;
      if (video !== current || !allowed() || document.hidden || !visible) return;
      playPending = null;
      current.load();
      syncPlayback();
    }, delay);
  }

  function refresh() {
    var selected = todayScene();
    updateButton(selected);
    var outgoing = null;
    if (selected.id !== sceneId) {
      outgoing = video;
      /* A failed switch may leave an older playing scene behind the pending video. */
      var playing = document.querySelectorAll('.home-background-video.is-playing');
      if (playing.length && outgoing && !outgoing.classList.contains('is-playing')) {
        outgoing = playing[playing.length - 1];
      }
      document.querySelectorAll('.home-background-video').forEach(function (target) {
        if (target !== outgoing) discardVideo(target);
      });
      if (observer) observer.disconnect();
      observer = null;
      video = null;
      sceneId = selected.id;
      clearTimeout(retryTimer);
      retryTimer = null;
      retryCount = 0;
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
      playPending = null;
      autoplayBlocked = false;
    }
    if (!allowed()) return removeVideo();
    var backgrounds = document.querySelectorAll('#_sidebar .sidebar-bg');
    var background = backgrounds[backgrounds.length - 1];
    if (video && (!video.isConnected || video.parentNode !== background)) removeVideo();
    if (video) return syncPlayback();
    if (!background) return;

    var current = document.createElement('video');
    current.className = 'home-background-video';
    current.setAttribute('data-scene', selected.id);
    current.setAttribute('aria-hidden', 'true');
    current.setAttribute('tabindex', '-1');
    current.setAttribute('playsinline', '');
    current.setAttribute('muted', '');
    current.muted = true;
    current.defaultMuted = true;
    current.loop = true;
    current.autoplay = true;
    current.preload = 'auto';
    if (selected.poster) {
      current.poster = new URL(selected.poster, videoRoot).href;
      /* Show a lightweight scene preview during a cold start or blocked autoplay. */
      if (!outgoing) current.classList.add('is-visible');
    }
    var lastTime = -1;
    var bufferedUntil = 0;
    current.addEventListener('timeupdate', function () {
      if (video !== current || current.currentTime === lastTime) return;
      lastTime = current.currentTime;
      retryCount = 0;
      watchPlayback(current, true);
    });
    current.addEventListener('progress', function () {
      var end = current.buffered.length ? current.buffered.end(current.buffered.length - 1) : 0;
      if (end <= bufferedUntil) return;
      bufferedUntil = end;
      watchPlayback(current, true);
    });
    current.addEventListener('canplay', syncPlayback);
    current.addEventListener('waiting', function () { watchPlayback(current); });
    current.addEventListener('stalled', function () { watchPlayback(current); });
    current.addEventListener('playing', function () {
      if (video === current) {
        clearTimeout(retryTimer);
        retryTimer = null;
        watchPlayback(current, true);
        current.classList.add('is-playing');
        if (outgoing && outgoing.isConnected) {
          var previous = outgoing;
          outgoing = null;
          window.setTimeout(function () { discardVideo(previous); }, 1250);
        }
        if (nextButton) nextButton.disabled = false;
      }
    });
    current.addEventListener('error', function () {
      if (video !== current) return;
      /* Keep the outgoing scene visible while the new one recovers. */
      scheduleRetry(current);
      if (nextButton) nextButton.disabled = false;
    });
    video = current;
    current.src = new URL(selected.file, videoRoot).href;
    background.appendChild(current);
    visible = background.getBoundingClientRect().bottom > 0;
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        syncPlayback();
      });
      observer.observe(background);
    }
    syncPlayback();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) syncPlayback();
    else refresh();
  });
  function resumePlayback() {
    autoplayBlocked = false;
    retryCount = 0;
    syncPlayback();
  }
  window.addEventListener('online', resumePlayback);
  document.addEventListener('pointerdown', resumePlayback, { passive: true });
  document.addEventListener('keydown', resumePlayback);
  reducedMotion.addEventListener('change', refresh);
  if (connection && connection.addEventListener) connection.addEventListener('change', refresh);
  window.addEventListener('pagehide', function () {
    clearTimeout(midnightTimer);
    removeVideo();
    removeButton();
  });
  window.addEventListener('pageshow', checkDay);
  /* Hydejack can replace the background after its page transition completes. */
  var sidebar = document.getElementById('_sidebar');
  if (sidebar) new MutationObserver(refresh).observe(sidebar, { childList: true });
  var pushState = document.getElementById('_pushState');
  if (pushState) {
    pushState.addEventListener('hy-push-state-start', function () {
      /* The cover persists between routes, so keep its video alive while content changes. */
      syncPlayback();
    });
    ['hy-push-state-after', 'hy-push-state-networkerror'].forEach(function (event) {
      pushState.addEventListener(event, function () {
        refresh();
      });
    });
  }
  checkDay();
}());
