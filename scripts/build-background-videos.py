"""Rebuild silent background loops from original Pexels downloads.

python scripts/build-background-videos.py --ffmpeg /path/to/ffmpeg --source-dir .video-sources
Source files are fjord.mp4, alpine.mp4, and mist.mp4; originals stay out of Git.
"""
import argparse
from pathlib import Path
import subprocess
import re

SCENES = {
    'fjord': ('blue-fjord-mist', 16, 20,
              'colorbalance=rs=-0.025:gs=0.015:bs=0.07:rm=-0.03:gm=0.02:bm=0.065:rh=-0.02:gh=0.015:bh=0.04,eq=brightness=0.035:saturation=1.04'),
    'alpine': ('mountain-clouds-blue', 16, 20,
               'colorbalance=bs=0.025:bm=0.025,eq=brightness=0.015:saturation=0.92'),
    'mist': ('mountain-clouds', 12, 15, 'null'),
}
FPS = 30
RAMP = 0.35


def run(ffmpeg, *args):
    subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], check=True)


def build(ffmpeg, source_dir, scene, reuse_forward=False):
    stem, source_duration, half_duration, grade = SCENES[scene]
    source = source_dir / (scene + '.mp4')
    if not source.is_file():
        raise FileNotFoundError(source)
    # Constant acceleration for only 350 ms at each end. Its inverse maps source
    # timestamps into playback timestamps; the middle runs at constant speed.
    # Interpolation fills slowed frames, rather than holding a source frame.
    speed = source_duration / (half_duration - RAMP)
    edge = speed * RAMP / 2
    mapping = (f"if(lt(T,{edge}),sqrt(2*{RAMP}*T/{speed}),"
               f"if(gt(T,{source_duration-edge}),{half_duration}-"
               f"sqrt(2*{RAMP}*max(0,{source_duration}-T)/{speed}),T/{speed}+{RAMP/2}))")
    forward = source_dir / (scene + '-forward.mp4')
    frames = half_duration * FPS
    print(f'{scene}: preparing interpolated 1440p forward footage', flush=True)
    if not (reuse_forward and forward.is_file()):
        run(ffmpeg, '-i', source, '-map', '0:v:0', '-map_metadata', '-1', '-an', '-vf',
            f"trim=duration={source_duration},setpts=PTS-STARTPTS,scale=2560:1440:flags=lanczos,"
            f"{grade},settb=AVTB,setpts='{mapping}/TB',"
            f"framerate=fps={FPS}:interp_start=0:interp_end=255:flags=0,tpad=stop_mode=clone:stop_duration=0.1,"
            f"trim=end_frame={frames},setpts=N/({FPS}*TB)",
            '-r', str(FPS), '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-pix_fmt', 'yuv420p',
            '-threads', '4', forward)
    # Fractional source frame rates can make the last frame fall just short of
    # the requested duration. Count actual packets before excluding endpoints.
    progress = subprocess.check_output([ffmpeg, '-v', 'error', '-i', str(forward),
        '-map', '0:v:0', '-c', 'copy', '-progress', 'pipe:1', '-f', 'null', '-'], text=True)
    frames = int(re.findall(r'^frame=(\d+)$', progress, re.MULTILINE)[-1])
    output_dir = Path('assets/video')
    desktop = output_dir / (stem + '-1440p-v2.mp4')
    mobile = output_dir / (stem + '-720p-v2.mp4')
    desktop_render = source_dir / (stem + '-desktop-render.mp4')
    mobile_render = source_dir / (stem + '-mobile-render.mp4')
    print(f'{scene}: encoding desktop loop', flush=True)
    # The two endpoints occur once each, including at the file's loop seam.
    # Reverse is baked into a normally decoded MP4; there is no runtime seeking.
    loop = (f'[0:v]split[f][r];[f]setpts=PTS-STARTPTS[a];'
            f'[r]reverse,trim=start_frame=1:end_frame={frames-1},setpts=PTS-STARTPTS[b];'
            f'[a][b]concat=n=2:v=1:a=0,setpts=N/({FPS}*TB)[loop]')
    run(ffmpeg, '-i', forward, '-filter_complex_threads', '1', '-filter_complex', loop,
        '-map', '[loop]', '-an', '-r', str(FPS), '-fps_mode', 'cfr', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-maxrate', '6500k', '-bufsize', '13000k', '-profile:v', 'high', '-level:v', '5.0',
        '-pix_fmt', 'yuv420p', '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
        '-threads', '4', '-movflags', '+faststart', desktop_render)
    print(f'{scene}: encoding mobile loop and previews', flush=True)
    run(ffmpeg, '-i', desktop_render, '-map', '0:v:0', '-map_metadata', '-1', '-an', '-vf', 'scale=1280:720:flags=lanczos',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-maxrate', '1800k',
        '-bufsize', '3600k', '-profile:v', 'main', '-level:v', '3.1', '-pix_fmt', 'yuv420p',
        '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-threads', '4',
        '-movflags', '+faststart', mobile_render)
    completed = [(desktop_render, desktop), (mobile_render, mobile)]
    for width, label in [(2560, '1440p'), (1280, '720p')]:
        poster_name = stem + '-' + label + '-v2.jpg'
        poster_render = source_dir / poster_name
        run(ffmpeg, '-i', desktop_render, '-frames:v', '1', '-vf', f'scale={width}:-2',
            '-q:v', '2', poster_render)
        completed.append((poster_render, output_dir / poster_name))
    # Leave the previous usable files intact if any encoding step fails.
    for rendered, destination in completed:
        rendered.replace(destination)
    print(f'{scene}: done ({desktop.stat().st_size:,} desktop / {mobile.stat().st_size:,} mobile bytes)', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ffmpeg', default='ffmpeg')
    parser.add_argument('--source-dir', type=Path, default=Path('.video-sources'))
    parser.add_argument('--scene', choices=SCENES)
    parser.add_argument('--reuse-forward', action='store_true', help='Reuse previously generated intermediates')
    options = parser.parse_args()
    for scene in ([options.scene] if options.scene else SCENES):
        build(options.ffmpeg, options.source_dir, scene, options.reuse_forward)
