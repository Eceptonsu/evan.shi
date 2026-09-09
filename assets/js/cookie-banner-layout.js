(function () {
  'use strict';

  var banner = null;
  var root = document.documentElement;
  var resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(measure) : null;

  function measure() {
    var height = banner && banner.isConnected ? Math.ceil(banner.getBoundingClientRect().height) : 0;
    root.style.setProperty('--cookie-banner-height', height + 'px');
  }

  function refresh() {
    var current = document.getElementById('_cookies-banner');
    if (banner !== current) {
      if (resizeObserver) resizeObserver.disconnect();
      banner = current;
      if (banner && resizeObserver) resizeObserver.observe(banner);
    }
    measure();
  }

  /* Hydejack inserts the notice asynchronously and removes it on consent. */
  var content = document.getElementById('_pushState');
  if (content) new MutationObserver(refresh).observe(content, { childList: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('pageshow', refresh);
  document.addEventListener('hy--cookies-ok', refresh);
  refresh();
}());
