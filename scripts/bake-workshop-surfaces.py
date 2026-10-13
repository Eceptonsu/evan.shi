"""Original spherical terrain and relief, baked offline rather than per frame.

3D value noise is sampled on a sphere, so longitude edges meet and poles do
not stretch a 2D noise field. Color, height, and roughness share the same land.
"""
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'assets/img/workshop'
OUT.mkdir(parents=True, exist_ok=True)
WIDTH, HEIGHT = 2048, 1024
phi = np.linspace(0, 2 * np.pi, WIDTH, dtype=np.float32)[None, :]
theta = np.linspace(np.pi, 0, HEIGHT, dtype=np.float32)[:, None]
x = -np.cos(phi) * np.sin(theta)
y = np.broadcast_to(np.cos(theta), x.shape).copy()
z = np.sin(phi) * np.sin(theta)
x[:, -1], y[:, -1], z[:, -1] = x[:, 0], y[:, 0], z[:, 0]


def lattice(a, b, c, seed):
    with np.errstate(over='ignore'):
        h = a.astype(np.uint32) * np.uint32(374761393)
        h += b.astype(np.uint32) * np.uint32(668265263)
        h += c.astype(np.uint32) * np.uint32(2246822519) + np.uint32(seed)
        h = (h ^ (h >> 13)) * np.uint32(1274126177)
        h ^= h >> 16
    return h.astype(np.float32) / np.float32(4294967295)


def noise(a, b, c, seed):
    ia, ib, ic = np.floor(a).astype(np.int32), np.floor(b).astype(np.int32), np.floor(c).astype(np.int32)
    fa, fb, fc = [(v - i).astype(np.float32) for v, i in ((a, ia), (b, ib), (c, ic))]
    fa, fb, fc = [v * v * (3 - 2 * v) for v in (fa, fb, fc)]
    result = np.zeros(a.shape, dtype=np.float32)
    for i in range(2):
        for j in range(2):
            for k in range(2):
                result += lattice(ia+i, ib+j, ic+k, seed) * (fa if i else 1-fa) * (fb if j else 1-fb) * (fc if k else 1-fc)
    return result


def fbm(a, b, c, seed, frequency=3, octaves=7):
    result = np.zeros(a.shape, dtype=np.float32)
    weight, total = 1., 0.
    for octave in range(octaves):
        result += noise(a*frequency, b*frequency, c*frequency, seed+octave*131) * weight
        total += weight
        frequency *= 2.03
        weight *= .49
    return result / total


def save(name, color, relief, roughness):
    for suffix, pixels in [('color', color), ('height', relief), ('roughness', roughness)]:
        pixels = np.clip(pixels, 0, 255).astype(np.uint8)
        pixels[:, -1] = pixels[:, 0]
        Image.fromarray(pixels).save(OUT / f'{name}-{suffix}.jpg', quality=94, subsampling=0, optimize=True)


for name, seed in [('terrain', 71), ('ocean', 317)]:
    warp = fbm(x, y, z, seed, 2, 3) - .5
    a, b, c = x+warp*.38, y+warp*.2, z-warp*.3
    field = fbm(a, b, c, seed+19)
    fine = fbm(a, b, c, seed+67, 34, 4)
    level = .49 if name == 'terrain' else .535
    land = np.clip((field-level)*90, 0, 1)
    height = np.clip((field-level)*5, 0, 1)
    ridges = (1-np.abs(fine*2-1))**8 * height
    dry = np.clip((fbm(x, y, z, seed+103, 4, 3)-.48)*6, 0, 1)
    water = np.array([9, 29, 48]) + np.clip((field-level+.055)*12, 0, 1)[:, :, None]*np.array([14, 31, 29])
    vegetation = np.array([52, 76, 48]) + fine[:, :, None]*np.array([29, 25, 12])
    ground = vegetation*(1-dry[:, :, None]) + np.array([143, 118, 77])*dry[:, :, None]
    mountains = np.clip(height*.8+ridges*.6, 0, 1)
    ground = ground*(1-mountains[:, :, None]) + np.array([127, 120, 108])*mountains[:, :, None]
    snow = np.clip((np.abs(y)-.84)*12+height*1.9-.55, 0, 1)*land
    ground = ground*(1-snow[:, :, None]) + np.array([220, 224, 216])*snow[:, :, None]
    color = water*(1-land[:, :, None]) + ground*land[:, :, None]
    # Wispy weather has multiple scales rather than broad, rubbery white blobs.
    cloud_field = fbm(x+warp*.2, y, z-warp*.15, seed+211, 6, 6)
    clouds = np.clip((cloud_field-.56)*9, 0, .78)
    color = color*(1-clouds[:, :, None]) + np.array([208, 218, 223])*clouds[:, :, None]
    relief = 100 + land*(height*80+ridges*45+fine*12)
    roughness = 92+land*140
    save(name, color, relief, roughness)
    print(f'Baked {name}: 2048 × 1024 color, height, and roughness.', flush=True)

