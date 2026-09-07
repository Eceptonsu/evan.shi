# Mountain background footage

- Creator: Tobias Bjørkli
- Source: [Majestic Mountains in Lofoten, Norway, Pexels video 14415567](https://www.pexels.com/video/majestic-mountains-in-lofoten-norway-14415567/)
- License: [Pexels License](https://www.pexels.com/license/), checked September 6, 2026. The source page marks the clip free to use; the license permits website use and modification without mandatory attribution.
- Local asset: `assets/video/blue-fjord-mist.mp4`
- Adaptation: the first 16 seconds resized to 1600 × 900, silent H.264, with a slow forward-and-reverse loop and eased speed at each turnaround. Shadows, midtones, and highlights receive a blue grade with lifted brightness. The shot includes sky, coastal mountains, rippling water, and natural mist around the peaks; no synthetic fog is added.

## Preserved scenes

- `alpine` — Kristian Bechthold, [Cloudy Mountains, Pexels video 27607601](https://www.pexels.com/video/cloudy-mountains-27607601/). Asset: `assets/video/mountain-clouds-blue.mp4`. Approximately 48 seconds, 1920 × 1080, silent H.264, eased forward/reverse loop with the previous blue color grade.
- `mist` — Astrella Visuals, [Moody Clouds Over Dramatic Mountain Peaks, Pexels video 35574243](https://www.pexels.com/video/moody-clouds-over-dramatic-mountain-peaks-35574243/). Asset: `assets/video/mountain-clouds.mp4`. Approximately 24 seconds, 1920 × 1080, silent H.264, slowed with a crossfade. The original desaturated, darker treatment is preserved for this scene.

Both preserved clips use the same Pexels License linked above.

## Daily rotation

`_data/home_backgrounds.yml` sets the order: fjord, alpine, mist. The cycle starts with fjord on September 7, 2026 and uses the calendar date in `America/Los_Angeles`. It changes without a rebuild or scheduled job. A page left open checks the date on minute boundaries and when returning to the tab; refreshing does not randomize the scene. Only the selected video is requested.

Preview a particular scene with `?scene=fjord`, `?scene=alpine`, or `?scene=mist`. Without a valid override, the daily selection applies. A small top-right button advances to the next scene. That manual selection is remembered in the current browser tab for the rest of the Pacific-time day, then the normal daily rotation resumes. The button is positioned over the background and does not alter the front-page layout.

When switching scenes, the current video remains visible while the next video loads. The new scene then fades directly over it for 1.2 seconds, after which the old video is released. The solid blue fallback is only exposed on initial loading or when video cannot play.

The former static background photograph has been removed from the project. A solid blue background is used during initial loading and when video is unavailable, reduced motion is enabled, or data-saving is requested. Only the home page loads video; page content and navigation remain the theme's existing markup.
