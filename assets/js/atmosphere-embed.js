// Initialize after either a direct visit or Hydejack's in-place article navigation.
(function () {
  const moduleURL = new URL('./atmosphere.js', document.currentScript.src);
  let current, pending;
  async function refresh() {
    const root = document.querySelector('[data-atmosphere]');
    if (current?.root === root || (root && pending === root)) return;
    current?.dispose();
    current = null;
    pending = root;
    if (!root) return;
    try {
      const module = await import(moduleURL.href);
      if (pending !== root || !root.isConnected) return;
      current = { root, dispose: module.createAtmosphere(root) };
    } catch (error) {
      if (root.isConnected) root.querySelector('[data-status]').textContent = 'The playground could not load. Refresh the page to try again.';
      console.error('Atmosphere playground:', error);
    } finally { if (pending === root) pending = null; }
  }
  refresh();
  document.getElementById('_pushState')?.addEventListener('hy-push-state-after', refresh);
}());
