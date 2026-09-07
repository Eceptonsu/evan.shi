(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;
  var scenes;
  try { scenes = JSON.parse(script.getAttribute('data-scenes')); } catch (error) { return; }
  if (!Array.isArray(scenes) || !scenes.length) return;
  var videoRoot = new URL(script.getAttribute('data-video-root'), location.href);
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
  var failed = false;
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
    return drawer && drawer.classList.contains('cover') &&
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
      video.pause();
      return;
    }
    var current = video;
    var attempt = current.play();
    if (attempt) attempt.catch(function (error) {
      /* A pause/navigation can interrupt a pending play without being a failure. */
      if (video !== current || error.name === 'AbortError') return;
      failed = true;
      removeVideo();
    });
  }

  function refresh() {
    var selected = todayScene();
    updateButton(selected);
    var outgoing = null;
    if (selected.id !== sceneId) {
      outgoing = video;
      if (observer) observer.disconnect();
      observer = null;
      video = null;
      sceneId = selected.id;
      failed = false;
    }
    if (!allowed()) return removeVideo();
    var backgrounds = document.querySelectorAll('#_sidebar .sidebar-bg');
    var background = backgrounds[backgrounds.length - 1];
    if (video && (!video.isConnected || video.parentNode !== background)) removeVideo();
    if (video || failed) return syncPlayback();
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
    current.preload = 'metadata';
    current.addEventListener('playing', function () {
      if (video === current) {
        current.classList.add('is-playing');
        if (outgoing && outgoing.isConnected) {
          window.setTimeout(function () { discardVideo(outgoing); }, 1250);
        }
        if (nextButton) nextButton.disabled = false;
      }
    });
    current.addEventListener('error', function () {
      if (video !== current) return;
      discardVideo(current);
      if (outgoing && outgoing.isConnected) {
        video = outgoing;
        sceneId = outgoing.getAttribute('data-scene');
        outgoing.play().catch(function () {});
      } else {
        video = null;
        failed = true;
      }
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
        failed = false;
        refresh();
      });
    });
  }
  checkDay();
}());
