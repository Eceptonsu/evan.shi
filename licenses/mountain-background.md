# Mountain background footage

- Creator: Tobias Bjørkli
- Source: [Majestic Mountains in Lofoten, Norway, Pexels video 14415567](https://www.pexels.com/video/majestic-mountains-in-lofoten-norway-14415567/)
- License: [Pexels License](https://www.pexels.com/license/), checked September 6, 2026. The source page marks the clip free to use; the license permits website use and modification without mandatory attribution.
- Current assets: `assets/video/blue-fjord-mist-1440p-v2.mp4` and `blue-fjord-mist-720p-v2.mp4`.
- Adaptation: the first 16 seconds of the original 4K footage, resized to 2560 × 1440 for desktop and 1280 × 720 for mobile. Silent H.264, approximately 30 fps, interpolated slow forward/reverse loop, and a short 350 ms easing interval at each endpoint. Shadows, midtones, and highlights receive a blue grade with lifted brightness. The shot includes sky, coastal mountains, rippling water, and natural mist around the peaks; no synthetic fog is added. Earlier exports remain in the repository for reference.

## Preserved scenes

- `alpine` — Kristian Bechthold, [Cloudy Mountains, Pexels video 27607601](https://www.pexels.com/video/cloudy-mountains-27607601/). Current assets: `mountain-clouds-blue-1440p-v2.mp4` and `mountain-clouds-blue-720p-v2.mp4` in `assets/video/`. Approximately 40 seconds, rebuilt from the original 4K clip with an interpolated forward/reverse loop, short endpoint easing, and a subtle blue grade.
- `mist` — Astrella Visuals, [Moody Clouds Over Dramatic Mountain Peaks, Pexels video 35574243](https://www.pexels.com/video/moody-clouds-over-dramatic-mountain-peaks-35574243/). Current assets: `mountain-clouds-1440p-v2.mp4` and `mountain-clouds-720p-v2.mp4` in `assets/video/`. Approximately 30 seconds, rebuilt from the original 4K clip with an interpolated forward/reverse loop and short endpoint easing. The existing desaturated, darker CSS treatment is preserved for this scene.

Both preserved clips use the same Pexels License linked above.

## Daily rotation

`_data/home_backgrounds.yml` sets the order: fjord, alpine, mist. The cycle starts with fjord on September 7, 2026 and uses the calendar date in `America/Los_Angeles`. It changes without a rebuild or scheduled job. A page left open checks the date on minute boundaries and when returning to the tab; refreshing does not randomize the scene. Only the selected video is requested.

Preview a particular scene with `?scene=fjord`, `?scene=alpine`, or `?scene=mist`. Without a valid override, the daily selection applies. A small top-right button advances to the next scene. That manual selection is remembered in the current browser tab for the rest of the Pacific-time day, then the normal daily rotation resumes. The button is positioned over the background and does not alter the front-page layout.

When switching scenes, the current video remains visible while the next video loads. The new scene then fades directly over it for 1.2 seconds, after which the old video is released. The solid blue fallback is only exposed on initial loading or when video cannot play.

The former static background photograph has been removed from the project. A solid blue background is used during initial loading and when video is unavailable, reduced motion is enabled, or data-saving is requested. Only the home page loads video; page content and navigation remain the theme's existing markup.
