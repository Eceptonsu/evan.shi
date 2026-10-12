// Validate GPU assets and, optionally, their spatial mapping to the original CLI exports.
// node scripts/check-atmosphere-data.cjs C:/path/to/ACG_Final_Project
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const assets = path.resolve(__dirname, '../assets/atmosphere');
function decode(bits) {
  const e = (bits >> 10) & 31, m = bits & 1023;
  return e === 0 ? m * 2 ** -24 : e === 31 ? Infinity : (1 + m / 1024) * 2 ** (e - 15);
}
let bytes = 0;
for (const [name,w,h,d] of [['transmittance',256,64,1],['irradiance',64,16,1],['scattering',256,128,32],['s_mie_scattering',256,128,32]]) {
  const compressed = fs.readFileSync(path.join(assets,name+'.bin.gz'));
  const data = zlib.gunzipSync(compressed); bytes += compressed.length;
  assert.equal(data.length,w*h*d*8);
  let max = 0;
  for (let i=0; i<data.length; i+=2) {
    const bits = data.readUInt16LE(i), value = decode(bits);
    assert.ok(bits < 0x8000 && Number.isFinite(value),'Nonnegative finite texel');
    if (i%8 === 6) assert.equal(value,0,'Separate scattering tables have zero alpha');
    max = Math.max(max,value);
    if (name === 'transmittance') assert.ok(value <= 1,'Transmittance stays in [0,1]');
  }
  assert.ok(max > .01,'Table contains nonzero radiance/transmittance');
  if (process.argv[2]) {
    const input=fs.readFileSync(path.join(process.argv[2],'data/atomsphere',name+'_lp.bin'));
    // Check nontrivial coordinates and every boundary, avoiding symmetric indices.
    for (const x of [0,1,Math.floor(w/3),w-1]) for (const y of [0,1,Math.floor(h/3),h-1]) for (const z of [...new Set([0,Math.floor(d/3),d-1])]) for(let c=0;c<4;c++) {
      const original=input.readFloatLE((((x*h)+y)*d+z)*16+c*4);
      const imported=decode(data.readUInt16LE((((z*h)+y)*w+x)*8+c*2));
      assert.ok(Math.abs(imported-original)<=Math.max(2**-24,original*.001),'Coordinate mapping preserves source values within half precision');
    }
  }
  console.log(name+': dimensions, bounds and mapping passed');
}
assert.ok(bytes < 10_000_000,'Compressed download budget');
const model=fs.readFileSync(path.join(assets,'model.glsl'),'utf8');
assert.ok(model.startsWith('#version 300 es\n'),'GLSL ES version is the first line');
assert.ok(!model.includes('#define COMBINED_SCATTERING_TEXTURES'),'Use the separate single-Mie texture');
console.log('GPU assets passed; compressed download '+bytes+' bytes.');
