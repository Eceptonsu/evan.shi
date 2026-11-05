const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../assets/js/cadence-core.js');
for (const level of Object.keys(C.configs)) {
  for (let round = 0; round < 20; round++) {
    const phrase = C.phrase(level, round);
    assert.equal(phrase.length, Math.min(8, C.configs[level].length + Math.floor(round / 2)));
    assert.ok(phrase.every((n) => C.configs[level].pool.includes(n) && C.midi[n]));
  }
  const beats = C.rhythm(level);
  assert.equal(beats[0], 0);
  assert.ok(beats.at(-1) < 24);
  assert.ok(beats.every((beat, i) => !i || beat > beats[i - 1]));
  assert.ok(beats.some((beat) => beat % 1), 'Includes offbeat notes');
  assert.ok(beats.some((beat, i) => i && beat - beats[i - 1] > 1), 'Includes rests');
}
assert.deepEqual(C.judgment(0), { label: 'Perfect', points: 100 });
assert.equal(C.judgment(.054).points, 100);
assert.equal(C.judgment(-.1).points, 65);
assert.equal(C.judgment(-.16).label, 'Early');
assert.equal(C.judgment(.16).label, 'Late');
assert.equal(C.judgment(.181).points, 0);
for (const id of Object.keys(C.songs)) {
  for (const section of ['all', '0', '1', '2', '3']) {
    const arrangement = C.arrangement(id, section);
    assert.equal(arrangement.beats, section === 'all' ? 32 : 8, 'Sections align with accompaniment bars');
    assert.ok(arrangement.events.every((e) => e.duration > 0 && e.beat >= 0 && (e.note === -1 || Number.isInteger(C.midi[e.note]))));
    for (const level of Object.keys(C.configs)) {
      const targets = C.songTargets(id, section, level);
      assert.ok(targets.length > 0 && targets.at(-1) < arrangement.beats);
      assert.ok(targets.every((t,i) => i === 0 || t > targets[i - 1]));
      const phrases = C.songPhrases(id, section, level);
      const notes = phrases.flat().filter(([n]) => n >= 0).map(([n]) => n);
      assert.deepEqual(notes, arrangement.events.filter((e) => e.note >= 0).map((e) => e.note), 'All melody notes survive phrase splitting, in order');
      assert.ok(phrases.every((p) => p.length <= ({ easy:4, medium:6, hard:8 }[level])));
    }
    assert.deepEqual(C.songTargets(id, section, 'medium'), arrangement.events.filter((e) => e.note >= 0).map((e) => e.beat), 'Medium taps follow the actual melody');
  }
}
const html = fs.readFileSync(path.join(__dirname, '../_projects/cadence.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../assets/js/cadence.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, 'No duplicate DOM IDs');
for (const match of js.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), `Missing UI element ${match[1]}`);
console.log('Cadence checks passed: song durations, phrase coverage, melody-aligned taps, section offsets, timing judgments, and DOM bindings.');
