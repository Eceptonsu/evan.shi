(function (root) {
  'use strict';
  const configs = { easy: { bpm: 90, pool: [0, 1, 2, 4, 5], length: 3 }, medium: { bpm: 108, pool: [0, 1, 2, 3, 4, 5, 6, 7], length: 4 }, hard: { bpm: 126, pool: [0, 1, 2, 3, 4, 5, 6, 7], length: 5 } };
  const midi = [60, 62, 64, 65, 67, 69, 71, 72];
  function phrase(level, round, random = Math.random) {
    const c = configs[level]; const length = Math.min(8, c.length + Math.floor(round / 2));
    return Array.from({ length }, () => c.pool[Math.floor(random() * c.pool.length)]);
  }
  function rhythm(level) {
    const patterns = level === 'easy' ? [[0, 1, 2, 3], [0, 1, 2.5, 3], [0, 1.5, 2, 3]] : level === 'medium' ? [[0, .5, 1.5, 2, 3], [0, 1, 1.5, 2.5, 3.5], [0, .5, 2, 2.5, 3]] : [[0, .5, 1.25, 1.5, 2.5, 3.5], [0, .75, 1.5, 2, 2.5, 3.25], [0, .5, 2.25, 2.5, 3.5]];
    return Array.from({ length: 6 }, (_, bar) => patterns[bar % patterns.length].map((n) => n + bar * 4)).flat();
  }
  function judgment(delta) { const ms = Math.abs(delta * 1000); return ms <= 55 ? { label: 'Perfect', points: 100 } : ms <= 110 ? { label: 'Good', points: 65 } : ms <= 180 ? { label: delta < 0 ? 'Early' : 'Late', points: 25 } : { label: 'Miss', points: 0 }; }
  // Short, original C-major arrangements of historic melodies. Durations are quarter-note beats.
  const songs = {
    joy: { title: 'Ode to Joy', credit: 'Beethoven · 1824', bpm: 108,
      sections: [[[2,1],[2,1],[3,1],[4,1],[4,1],[3,1],[2,1],[1,1]], [[0,1],[0,1],[1,1],[2,1],[2,1.5],[1,.5],[1,2]], [[2,1],[2,1],[3,1],[4,1],[4,1],[3,1],[2,1],[1,1]], [[0,1],[0,1],[1,1],[2,1],[1,1.5],[0,.5],[0,2]]],
      chords: [0,4,0,4,0,4,4,0] },
    jacques: { title: 'Frère Jacques', credit: 'Traditional · French round', bpm: 112,
      sections: [[[0,1],[1,1],[2,1],[0,1],[0,1],[1,1],[2,1],[0,1]], [[2,1],[3,1],[4,2],[2,1],[3,1],[4,2]], [[4,.5],[5,.5],[4,.5],[3,.5],[2,1],[0,1],[4,.5],[5,.5],[4,.5],[3,.5],[2,1],[0,1]], [[0,1],[4,1],[0,2],[0,1],[4,1],[0,2]]],
      chords: [0,0,0,0,0,0,4,0] },
    saints: { title: 'When the Saints', credit: 'Traditional · spiritual', bpm: 116,
      sections: [[[0,1],[2,1],[3,1],[4,3],[-1,2]], [[0,1],[2,1],[3,1],[4,3],[-1,2]], [[0,1],[2,1],[3,1],[4,2],[2,2],[0,1]], [[2,1],[1,1],[1,2],[0,4]]],
      chords: [0,0,0,4,0,3,4,0] }
  };
  function arrangement(id, section = 'all') {
    const song = songs[id];
    const sections = section === 'all' ? song.sections : [song.sections[Number(section)]];
    let beat = 0;
    const events = sections.flatMap((part) => part.map(([note, duration]) => { const event = { note, duration, beat }; beat += duration; return event; }));
    return { events, beats: beat, chordOffset: section === 'all' ? 0 : Number(section) * 2 };
  }
  function songPhrases(id, section, level) {
    const parts = section === 'all' ? songs[id].sections : [songs[id].sections[Number(section)]];
    const size = level === 'easy' ? 4 : level === 'medium' ? 6 : 8;
    return parts.flatMap((part) => { const chunks = []; for (let i = 0; i < part.length; i += size) { const chunk = part.slice(i, i + size); if (chunk.some(([n]) => n >= 0)) chunks.push(chunk); } return chunks; });
  }
  function songTargets(id, section, level) {
    const score = arrangement(id, section);
    if (level === 'easy') return Array.from({ length: Math.ceil(score.beats / 2) }, (_, i) => i * 2);
    const beats = score.events.filter((event) => event.note >= 0).map((event) => event.beat);
    if (level === 'hard') for (const event of score.events) if (event.note >= 0 && event.duration >= 2) beats.push(event.beat + 1);
    return [...new Set(beats)].sort((a,b) => a-b);
  }
  function noteName(pitch, letter) {
    const natural=[0,2,4,5,7,9,11],i=letter%7;
    const accidental=((pitch%12-natural[i]+18)%12)-6;
    return 'CDEFGAB'[i]+(accidental===1?'♯':accidental===-1?'♭':'')+(Math.floor((pitch-accidental)/12)-1);
  }
  function flightScore(id, section, level, tonic = 60) {
    const score = arrangement(id, section), beat = { easy:2, medium:1.6, hard:1.3 }[level];
    const notes = score.events.filter(e => e.note >= 0).map(e => {
      const pitch = midi[e.note] + tonic - 60;
      const letter=[0,2,4,5,7,9,11].indexOf(tonic%12)+e.note;
      return { midi:pitch, label:noteName(pitch,letter), start:e.beat * beat, end:(e.beat + e.duration) * beat };
    });
    return { notes, duration:score.beats * beat, low:Math.min(...notes.map(n => n.midi)), high:Math.max(...notes.map(n => n.midi)), hold:{ easy:.5, medium:.4, hard:.3 }[level] };
  }
  const api = { configs, midi, phrase, rhythm, judgment, songs, arrangement, songPhrases, songTargets, noteName, flightScore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CadenceCore = api;
}(typeof window !== 'undefined' ? window : globalThis));
