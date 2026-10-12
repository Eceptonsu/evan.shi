// Import the CLI's [x][y][z][rgba] Float32 tables into WebGL's [z][y][x][rgba].
// Usage: node scripts/import-atmosphere.cjs C:/path/to/ACG_Final_Project
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const source = path.resolve(process.argv[2] || '');
assert.ok(process.argv[2], 'Supply the original project directory');
const out = path.resolve(__dirname, '../assets/atmosphere');
fs.mkdirSync(out, { recursive: true });
function half(value) {
  assert.ok(Number.isFinite(value) && value >= 0 && value <= 65504, 'Finite, nonnegative half-float input');
  if (value === 0) return 0;
  if (value < 2 ** -14) return Math.round(value * 2 ** 24);
  const e = Math.floor(Math.log2(value));
  return ((e + 15) << 10) + Math.round((value / 2 ** e - 1) * 1024);
}
for (const [name, w, h, d] of [
  ['transmittance', 256, 64, 1], ['irradiance', 64, 16, 1],
  ['scattering', 256, 128, 32], ['s_mie_scattering', 256, 128, 32],
]) {
  const input = fs.readFileSync(path.join(source, 'data/atomsphere', name + '_lp.bin'));
  assert.equal(input.length, w * h * d * 16, name + ' dimensions');
  const output = Buffer.alloc(w * h * d * 8);
  for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const from = ((x * h + y) * d + z) * 16;
    const to = ((z * h + y) * w + x) * 8;
    for (let c = 0; c < 4; c++) output.writeUInt16LE(half(input.readFloatLE(from + c * 4)), to + c * 2);
  }
  const compressed = zlib.gzipSync(output, { level: 9 });
  fs.writeFileSync(path.join(out, name + '.bin.gz'), compressed);
  console.log(name + ': ' + compressed.length + ' bytes');
}
const original = fs.readFileSync(path.join(source, 'data/atomsphere/atmosphere_shader.txt'), 'utf8');
const glsl = original.replace(/^#version 330\s*/, '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\nprecision highp sampler3D;\n')
  // CLI exports separate Rayleigh/multiple-scattering and single-Mie tables.
  .replace('#define COMBINED_SCATTERING_TEXTURES', '// Separate single-Mie texture.');
fs.writeFileSync(path.join(out, 'model.glsl'), glsl.replace('#version 300 es\n', '#version 300 es\n// Adapted from Evan Shi and Jerry Lu\'s ACG project; see NOTICE.md.\n'));
