# Atmospheric scattering web port

The playground is embedded directly in the atmospheric scattering blog post via
`_includes/atmosphere-playground.html`. The former `/atmosphere/` route redirects
to the post's playground anchor; there is no separate Projects collection entry.
The small `atmosphere-embed.js` loader initializes on direct visits and on Hydejack's
`hy-push-state-after` event. Navigating away aborts downloads, disconnects observers
and listeners, and releases the GPU context. The styles are scoped to the widget.
Primary controls are sun elevation, altitude, and exposure; the other controls live
inside a collapsed More controls section. Shared views use an `atmosphere` query
parameter and the article's playground anchor, preserving other article URL state.
Zoom adjusts the camera field of view from 0.5× to 8× without changing altitude.
The canvas supports mouse-wheel and trackpad zoom, two-finger pinch, +/− buttons,
and keyboard +/−. Zoom is saved in shared views and reset by the presets or Reset.
No backend, new npm dependency, or build step is needed in production.

Preview with `bundle exec jekyll serve --force_polling`, then open
`/blog/cg/2024-01-12-planetary-atmospheric-scattering/#atmosphere-playground`.

To regenerate assets:

```
node scripts/import-atmosphere.cjs C:/Users/evans/Desktop/ACG_Final_Project
node scripts/check-atmosphere-data.cjs C:/Users/evans/Desktop/ACG_Final_Project
```

The importer reads the original CLI exports without modifying the project.
They are little-endian RGBA Float32 arrays stored as `[x][y][z][channel]` (or
`[x][y][channel]` for 2D). It reorders to the GPU's `[z][y][x][channel]`, converts
to RGBA16F, and gzip compresses. The browser decompresses once and uploads
filterable half-float textures. These need no float-linear extension.
The total compressed payload is approximately 9.22 MB, requested only on Start.

The model shader uses GLSL ES 3.00 and separate single-Mie scattering. The original
shader had `COMBINED_SCATTERING_TEXTURES` enabled, but the CLI exports have alpha=0
and store single-Mie separately. Using the combined path would lose Mie scattering.
The original GUI also references a separate `scattering.dat`; this port consistently
uses the CLI exports. The new view shader evaluates the sky, spherical ground,
and solar disk using the original model functions. Camera coordinates are in km,
with Earth centered at the origin and a radius of 6360 km. A fixed-position camera
looks freely from its chosen altitude; it does not orbit arbitrary surface points.

Limitations: the tables fix the Earth atmosphere, solar spectrum, density profiles,
Mie phase parameter, and baked ground albedo. The ground-color control affects the
visible surface, but does not rebake ground feedback into multiple scattering.
No terrain or occluder shadows/light shafts are introduced. Half precision changes
numerical values slightly and underflows very small radiances. The data preserve
the precomputed scattering orders in the supplied cache; the cache does not label
the number of orders. No claim of numerical parity with the native GUI is made.

Future composition controls require regenerating LUTs, either offline for presets
or through a browser GPU precomputation pipeline. They should not be implemented
by scaling the already-computed scattering textures.
