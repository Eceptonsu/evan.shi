---
layout: about
title: Gallery
---

<div class="gallery-toolbar">
  <button class="gallery-view" type="button" data-gallery-toggle data-view="grid" aria-label="Switch to Earth view" title="Switch to Earth view">
    <span class="gallery-view__window" aria-hidden="true"><span class="gallery-view__track">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="14" width="6.5" height="6.5" rx="1.5"/></svg>
    </span></span>
  </button>
<div class="gallery-layout" role="group" aria-label="Gallery layout">
  <button class="gallery-layout__button" type="button" data-gallery-columns="1" aria-label="Show one item per row" aria-pressed="false">
    <span class="gallery-layout__icon gallery-layout__icon--one" aria-hidden="true"><span></span><i></i></span>
  </button>
  <button class="gallery-layout__button is-active" type="button" data-gallery-columns="2" aria-label="Show two items per row" aria-pressed="true">
    <span class="gallery-layout__icon gallery-layout__icon--two" aria-hidden="true"><span></span><i></i></span>
  </button>
  <button class="gallery-layout__button" type="button" data-gallery-columns="4" aria-label="Show four items per row" aria-pressed="false">
    <span class="gallery-layout__icon gallery-layout__icon--four" aria-hidden="true"><span></span><i></i></span>
  </button>
</div>
</div>

<section class="gallery-earth" data-gallery-earth hidden aria-label="Photos around the Earth" data-land-url="{{ '/assets/data/earth-land.geojson' | relative_url }}">
  <header class="gallery-earth__header">
    <div><p class="gallery-earth__eyebrow">A few places, a few memories</p><h2>A world through my lens.</h2></div>
    <span class="gallery-earth__count">10 photographs</span>
  </header>
  <div class="gallery-earth__stage" data-earth-stage>
    <p class="gallery-earth__status" data-earth-status role="status">Loading the Earth…</p>
  </div>
  <div class="gallery-earth__tools" role="group" aria-label="Earth controls">
    <span>Drag to explore · Scroll or pinch to zoom</span>
    <div><button type="button" data-earth-zoom="in" aria-label="Zoom in">+</button><button type="button" data-earth-zoom="out" aria-label="Zoom out">−</button><button type="button" data-earth-reset>Reset</button><button type="button" data-earth-spin aria-pressed="false">Auto-rotate</button></div>
  </div>
  <div class="gallery-earth__browse">
    <label for="earth-place">Find a photograph</label>
    <select id="earth-place" data-earth-place><option value="">Choose a place…</option></select>
    <button type="button" data-earth-open disabled>View photo ↗</button>
  </div>
</section>

<aside class="gallery-caption-bubble" data-gallery-caption aria-hidden="true"></aside>

## Images
{:.gallery-section data-gallery-images-heading="true"}

<div class="gallery gallery--media" data-gallery-grid data-gallery-default="2" data-gallery-current="2" style="--columns: 2;">
  <a href="/assets/img/gallery/point_reyes.jpg" data-lightbox="gallery-images" data-title="Point Reyes" data-lat="38.07" data-lng="-122.81" data-location="Point Reyes, California" data-caption="Point Reyes looking extra breezy, with a tiny white house keeping watch over all that blue.">
    <img src="/assets/img/gallery/thumbs/point_reyes.jpg" alt="Point Reyes coast with a white house above the water" width="1050" height="1400" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/moher.jpg" data-lightbox="gallery-images" data-title="Cliffs of Moher" data-lat="52.97" data-lng="-9.43" data-location="Cliffs of Moher, Ireland" data-caption="The Cliffs of Moher doing their big dramatic ocean pose, soft grass and sky included.">
    <img src="/assets/img/gallery/thumbs/moher.jpg" alt="Cliffs of Moher over the ocean" width="1050" height="1400" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/kiyomizu_dera.jpg" data-lightbox="gallery-images" data-title="Kiyomizu-dera" data-lat="34.9949" data-lng="135.785" data-location="Kyoto, Japan" data-caption="Kiyomizu-dera rooflines stacked like a quiet little puzzle against the pale Kyoto sky.">
    <img src="/assets/img/gallery/thumbs/kiyomizu_dera.jpg" alt="Kiyomizu-dera temple rooflines" width="1050" height="1400" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/joshua_milky_way.JPG" data-lightbox="gallery-images" data-title="Joshua Tree Milky Way" data-lat="33.87" data-lng="-115.90" data-location="Joshua Tree, California" data-caption="Joshua Tree after dark, where the Milky Way showed up and casually stole the whole scene.">
    <img src="/assets/img/gallery/thumbs/joshua_milky_way.jpg" alt="Milky Way over Joshua Tree" width="1400" height="932" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/crystal_cove.jpg" data-lightbox="gallery-images" data-title="Crystal Cove" data-lat="33.57" data-lng="-117.84" data-location="Crystal Cove, California" data-caption="Crystal Cove at golden hour, with one small silhouette having a main-character beach moment.">
    <img src="/assets/img/gallery/thumbs/crystal_cove.jpg" alt="Silhouette walking along Crystal Cove at sunset" width="933" height="1400" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/austin.JPG" data-lightbox="gallery-images" data-title="Austin Sunset" data-lat="30.27" data-lng="-97.74" data-location="Austin, Texas" data-caption="Austin sunset poured over the water like warm honey, calm and a little cinematic.">
    <img src="/assets/img/gallery/thumbs/austin.jpg" alt="Austin sunset over water" width="1400" height="1050" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/antelope_canyon.jpg" data-lightbox="gallery-images" data-title="Antelope Canyon" data-lat="36.86" data-lng="-111.37" data-location="Antelope Canyon, Arizona" data-caption="Antelope Canyon looking like the desert carved a secret doorway just for sunlight.">
    <img src="/assets/img/gallery/thumbs/antelope_canyon.jpg" alt="Antelope Canyon walls opening to blue sky" width="1050" height="1400" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/amanyangyun.jpg" data-lightbox="gallery-images" data-title="Amanyangyun" data-lat="31.04" data-lng="121.32" data-location="Shanghai, China" data-caption="Amanyangyun in crisp lines and quiet reflections, a very composed little pause.">
    <img src="/assets/img/gallery/thumbs/amanyangyun.jpg" alt="Amanyangyun architecture reflected in water" width="933" height="1400" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/alaska_posture.jpg" data-lightbox="gallery-images" data-title="Alaska Snow Posture" data-lat="64" data-lng="-152" data-location="Alaska (approximate)" data-caption="Alaska snowfield plus one heroic pose, because fresh powder deserves a tiny performance.">
    <img src="/assets/img/gallery/thumbs/alaska_posture.jpg" alt="Person posing in an Alaska snowfield" width="1050" height="1400" loading="lazy" decoding="async">
  </a>
  <a href="/assets/img/gallery/alaska_aurora.jpg" data-lightbox="gallery-images" data-title="Alaska Aurora" data-lat="64" data-lng="-152" data-location="Alaska (approximate)" data-caption="Alaska aurora drifting above the trees, soft green ribbons doing their night-sky magic.">
    <img src="/assets/img/gallery/thumbs/alaska_aurora.jpg" alt="Aurora over trees in Alaska" width="1400" height="1050" loading="lazy" decoding="async">
  </a>
</div>

## Videos
{:.gallery-section}

<div class="gallery gallery--media" data-gallery-grid data-gallery-default="2" data-gallery-current="2" style="--columns: 2;">
  <a class="gallery-item gallery-item--youtube no-mark-external" href="https://www.youtube.com/watch?v=N6m5hZBK5y0&list=RDN6m5hZBK5y0&start_radio=1" target="_blank" rel="noopener noreferrer" aria-label="Open YouTube video" data-caption="A recording of the Hollow Knight: Silksong Symphonic Suite from GG Orchestra's debut concert in the Bay Area. I played oboe with this orchestra, which brings anime, film, and game music into a full orchestral setting.">
    <img class="gallery-item__thumb" src="https://img.youtube.com/vi/N6m5hZBK5y0/hqdefault.jpg" alt="YouTube video thumbnail" loading="lazy" decoding="async">
    <span class="gallery-item__play" aria-hidden="true"></span>
  </a>
</div>
