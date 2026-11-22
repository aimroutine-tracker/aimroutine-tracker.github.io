import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('the home page puts real routines before an opt-in demos section', () => {
  const firstRoutines = html.indexOf('id="routines-rapides"');
  const details = html.indexOf('<details id="home-details">');
  assert.ok(firstRoutines >= 0 && details > firstRoutines);
  assert.equal((html.slice(firstRoutines, details).match(/class="ar-drill ar-drill--/g) || []).length, 3);
  for (const id of ['aim-challenge', 'app-gallery', 'routine', 'insights', 'community']) {
    assert.ok(html.indexOf('id="' + id + '"') > details, id);
  }
});
