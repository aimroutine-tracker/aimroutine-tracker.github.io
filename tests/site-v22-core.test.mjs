import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
const root = new URL('../',import.meta.url);
const page = name => readFileSync(new URL(name,root),'utf8');

test('all public pages use the shared layout and footer', () => {
  for (const filename of readdirSync(root).filter(name=>name.endsWith('.html'))) {
    const version=5;
    assert.ok(page(filename).includes('site-v22.css?v='+version),filename);
    assert.match(page(filename),/<footer class="site31-footer ar22-footer">/,filename);
  }
});

test('the training planner, account form and analytics render from page markup', () => {
  assert.match(page('training.html'),/class="r17-training-wrap r17-screen"/);
  const account = page('account.html');
  assert.ok(account.indexOf('data-r17-auth-slot') < account.indexOf('id="login-form"'));
  assert.match(page('progress.html'),/class="v14-progress-grid r17-chart-grid"/);
  assert.doesNotMatch(page('site-rebuild-v17.js'),/insertAdjacentHTML/);
});
