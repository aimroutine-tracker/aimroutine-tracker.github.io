import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pages=['index.html','product.html','presentation.html','training.html',
  'account.html','changelog.html','releases.html','updates.html',
  'riot-integration.html','privacy.html','terms.html','404.html'];
test('motion assets are present on every public page',()=>{
  for(const page of pages){
    const html=read(page);
    assert.match(html,/site-motion-v10\.css\?v=1/,'CSS missing: '+page);
    assert.match(html,/site-motion-v10\.js\?v=1/,'JS missing: '+page);
  }
});
test('home interactive demo has three labeled, navigable panels',()=>{
  const html=read('index.html');
  assert.match(html,/data-ar10-demo/);
  for(const step of ['plan','practice','review']){
    assert.match(html,new RegExp('id="ar10-tab-'+step+'"'));
    assert.match(html,new RegExp('id="ar10-panel-'+step+'"'));
    assert.match(html,new RegExp('aria-controls="ar10-panel-'+step+'"'));
    assert.match(html,new RegExp('aria-labelledby="ar10-tab-'+step+'"'));
  }
  assert.equal((html.match(/data-ar10-step=/g)||[]).length,3);
  assert.equal((html.match(/data-ar10-panel=/g)||[]).length,3);
  assert.match(html,/Graphique illustratif/);
});
test('animations respect accessibility, keep contents and avoid data APIs',()=>{
  const js=read('site-motion-v10.js');
  const css=read('site-motion-v10.css');
  assert.match(js,/IntersectionObserver/);
  assert.match(js,/prefers-reduced-motion: reduce/);
  assert.match(js,/ArrowRight/);
  assert.match(js,/ArrowLeft/);
  assert.match(js,/Home/);
  assert.match(js,/End/);
  assert.match(js,/requestAnimationFrame/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/ar10-flow__panel\[hidden\]/);
  assert.doesNotMatch(js,/(?:localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|supabase)/i);
});
test('motion assets are reviewed and precached',()=>{
  const list=read('scripts/public-assets.txt');
  const sw=read('sw-v6.js');
  for(const name of ['site-motion-v10.css','site-motion-v10.js']){
    assert.match(list,new RegExp('^'+name.replace('.','\\.')+'$','m'));
    assert.ok(sw.includes("'./"+name+"'"));
  }
  // Auth-facing cache version is intentionally unchanged.
  assert.match(sw,/aimroutine-v8-required-username-20261107/);
});