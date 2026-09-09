The scene manifest is `_data/home_backgrounds.yml`. Only the selected MP4 and its JPEG preview load.

The optimized fjord derivative preserves the original at `assets/video/blue-fjord-mist.mp4`.
It uses 1280×720 H.264 Main, 24 fps, a 900 kb/s peak bitrate, two-second keyframes,
no audio, and MP4 fast start. The source has a held opening and a held turnaround.
The derivative omits frames 0–17 and 549–582, including the near-still edges around
the turnaround. Its duration is 44.25 seconds and its size is 4,953,455 bytes
(the source is 8,383,762 bytes). FFmpeg detected no remaining freezes lasting
at least 0.5 seconds at the `-50dB` threshold.

Reproduce with FFmpeg:

```sh
ffmpeg -i assets/video/blue-fjord-mist.mp4 \
  -vf "select='gte(n,18)*not(between(n,549,582))',setpts=N/(24*TB),scale=1280:720" \
  -r 24 -fps_mode cfr -an -c:v libx264 -preset slow -crf 26 \
  -maxrate 900k -bufsize 1800k -pix_fmt yuv420p -profile:v main \
  -g 48 -keyint_min 48 -sc_threshold 0 -movflags +faststart \
  assets/video/blue-fjord-mist-720p.mp4
```

JPEG previews use a 1280-pixel width and `-q:v 3`, taking the fjord frame at
0.75 seconds and the other scenes' first frame. These are intentionally independent
of video loading, so a stalled request or an autoplay restriction still has a scene to display.

Run `node scripts/check-home-background.cjs` for deterministic startup, stalled download,
autoplay denial, navigation, scene cleanup, reduced motion, and consent spacing checks.
Also build Jekyll in production mode and run `node scripts/check-production-loader.cjs`.
