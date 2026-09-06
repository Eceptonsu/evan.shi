# Gallery Earth

The interactive gallery uses Three.js 0.180.0 (MIT). The original license is
included at `assets/js/lib/three/LICENSE`. The two minified build files are
unmodified; `TrackballControls.js` only changes its `three` import to the local
module. Source: https://github.com/mrdoob/three.js/tree/r180

The land geometry is Natural Earth 1:110m land, version 5.1.2, in the public domain:
https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson
Terms: https://www.naturalearthdata.com/about/terms-of-use/

The site creates its own cartographic texture and atmosphere shader. All runtime
dependencies and geography are hosted locally; no API keys or CDN are required.

## Maintaining photo locations

In `gallery.md`, each photo anchor with `data-lat`, `data-lng`, and `data-location`
appears on the Earth. Coordinates are decimal degrees (north/east positive).
The existing image, title, and lightbox link supply its thumbnail and full image.
Locations describe the named place rather than verified camera GPS positions.
Both Alaska photographs currently share an explicitly approximate regional pin.
The globe separates nearby thumbnails with lines to their original coordinates.

The library loads only when Earth mode is first selected. The scene pauses when
hidden and releases its resources when Hydejack navigates to another page.
No JavaScript build step is required; build the site with `bundle exec jekyll build`.
