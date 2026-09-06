const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run after JEKYLL_ENV=production bundle exec jekyll build.
const html = fs.readFileSync('_site/index.html', 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]);

for (const marker of ["root.classList.add('site-entering'", 'function openAperture(']) {
  const script = scripts.find(source => source.includes(marker));
  assert.ok(script, `Missing entrance script: ${marker}`);
  new vm.Script(script);
  // Also guard against line comments if someone runs this on a development build.
  new vm.Script(script.replace(/\s+/g, ' '));
}

console.log('Both entrance scripts parse before and after production whitespace compression.');
