// Keep the 3D library off the critical path, including on the gallery's grid view.
(function () {
  let current;

  function refresh() {
    const root = document.querySelector('[data-gallery-earth]');
    if (current && current.root === root) return;
    if (current) current.dispose();
    current = null;
    if (!root) return;

    const events = new AbortController();
    const toggle = document.querySelector('[data-gallery-toggle]');
    const grid = document.querySelector('[data-gallery-grid]');
    const heading = document.querySelector('[data-gallery-images-heading]');
    const layouts = document.querySelector('[data-gallery-layout]');
    const photos = Array.from(grid.querySelectorAll('a[data-lat][data-lng]'));
    let scene, pending, disposed = false;
    let view = 'grid';

    async function setView(next) {
      view = next;
      const earth = next === 'earth';
      root.hidden = !earth;
      grid.hidden = earth;
      if (heading) heading.hidden = earth;
      if (layouts) layouts.hidden = earth;
      document.querySelector('[data-gallery-caption]')?.classList.remove('is-visible');
      toggle.dataset.view = next;
      const label = earth ? 'Switch to Grid view' : 'Switch to Earth view';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
      if (scene) scene.setActive(earth);
      if (!earth || scene || pending) return;
      root.querySelector('[data-earth-status]').textContent = 'Loading the Earth…';
      pending = import('./gallery-earth-scene.js').then(module => {
        if (disposed) return;
        return module.createEarth(root, photos);
      });
      try {
        scene = await pending;
        if (disposed) scene?.dispose();
        else scene?.setActive(view === 'earth');
      } catch (error) {
        if (!disposed) {
          root.querySelector('[data-earth-status]').textContent = 'The Earth view could not load. You can still explore every photo in Grid view. Select Grid, then Earth to retry.';
          console.warn('Gallery Earth:', error);
        }
      } finally {
        pending = null;
      }
    }

    toggle.addEventListener('click', () => setView(view === 'grid' ? 'earth' : 'grid'), { signal: events.signal });
    current = { root, dispose() { disposed = true; events.abort(); scene?.dispose(); } };
  }

  refresh();
  document.getElementById('_pushState')?.addEventListener('hy-push-state-after', refresh);
}());
