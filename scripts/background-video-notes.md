The scene manifest is `_data/home_backgrounds.yml`. Only the selected scene's MP4
and JPEG preview load. Desktop uses `file` and `poster`; screens up to 42em or
connections reported as slow-2g, 2g, or 3g use `mobile_file` and `mobile_poster`.
The selection happens when creating a video, so resizing or a network change
does not restart a playing scene. Reduced motion and Save-Data disable video.

## Current exports

The `-v2` files are rebuilt from the three original 3840×2160 Pexels downloads,
not enlarged versions of the old compressed exports. Desktop is 2560×1440
H.264 High (CRF 20, 6.5 Mb/s bitrate ceiling); mobile is 1280×720 H.264 Main
(CRF 23, 1.8 Mb/s ceiling). Both use approximately 30 fps, two-second keyframes,
no audio, and MP4 fast start. Previews match the first video frame, at the
corresponding resolution. The existing CSS preserves mist's darker treatment.

| Scene | Loop length | Desktop bytes | Mobile bytes |
| --- | ---: | ---: | ---: |
| Fjord | ~40 seconds | 32,988,585 | 9,132,484 |
| Alpine | ~40 seconds | 32,919,449 | 3,992,713 |
| Mist | ~30 seconds | 16,506,502 | 2,420,569 |

The first 16 source seconds of fjord/alpine and 12 seconds of mist play forward
and reverse. Only 350 ms at each end slows into the reversal; the rest moves at
constant speed. Frame interpolation blends adjacent source frames during
slowdown instead of deliberately holding frames. Both turnaround endpoints
occur once, including at the loop seam. Reversal stays in the encoded file, so
the browser uses normal forward playback without JavaScript seeking.
Natural mist/cloud movement can still be very slow; a freeze detector's
near-still classification is not necessarily a stalled decoder.

The higher desktop bitrate deliberately increases download size to preserve
water and mountain detail on a 1440p display. Mobile files remain much smaller,
and switching scenes releases the previous decoder after the existing fade.

## Rebuild

Download the original files linked in `licenses/mountain-background.md` into
the ignored `.video-sources/` directory, named `fjord.mp4`, `alpine.mp4`, and
`mist.mp4`. Then run:

```sh
python scripts/build-background-videos.py --ffmpeg /path/to/ffmpeg --source-dir .video-sources
```

Use `--scene fjord` (or alpine/mist) to rebuild one scene. `--reuse-forward`
reuses that scene's previously generated intermediate; omit it when changing
timing or colors. FFmpeg's reverse filter buffers the forward half of the
1440p loop, requiring several GB of available memory. Originals and
intermediates are excluded from Git and Jekyll output. The earlier exports
remain available in `assets/video/` for reference but are no longer selected.

Previews are independent of video loading, so a stalled request or autoplay
restriction still has a scene to display. Versioned filenames prevent an
already cached old video from concealing this update.

Run `node scripts/check-home-background.cjs` for deterministic startup, stalled download,
autoplay denial, navigation, scene cleanup, reduced motion, and consent spacing checks.
Also build Jekyll in production mode and run `node scripts/check-production-loader.cjs`.

Verify each MP4 decodes without errors, contains no audio, has the intended
resolution, and has its `moov` box before `mdat`. Browser QA should cover a
2560×1440 desktop and a 390×844 phone, scene switching, reversal, and loop restart.
