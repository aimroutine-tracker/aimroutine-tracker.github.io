import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('home has a playable, accessible, bilingual mini AIM challenge',()=>{
 const html=read('index.html');
 assert.match(html,/id="aim-challenge"/);
 assert.match(html,/data-ar11-game/);
 assert.match(html,/data-ar11-target/);
 assert.match(html,/aria-label="Toucher la cible \/ Hit target"/);
 assert.match(html,/role="progressbar"/);
 assert.match(html,/data-ar11-status/);
 assert.match(html,/aria-live="polite"/);
 assert.match(html,/data-ar11-mode="precision"/);
 assert.match(html,/data-ar11-mode="reflex"/);
 assert.match(html,/site-arcade-v12.js\?v=1/);
 assert.match(html,/site-arcade-v11.css\?v=1/);
 assert.match(html,/Graphique illustratif/);
});
test('mini-game is local, timed, pausable and maintains honest stats',()=>{
 const js=read('site-arcade-v12.js');
 assert.match(js,/const DURATION=20000/);
 assert.match(js,/setInterval\(tick,100\)/);
 assert.match(js,/function pause\(\)/);
 assert.match(js,/function resume\(\)/);
 assert.match(js,/function finish\(\)/);
 assert.match(js,/document\.hidden/);
 assert.match(js,/hits\/\(hits\+misses\)/);
 assert.match(js,/Math\.random\(\)/);
 assert.match(js,/target\.focus\(/);
 assert.doesNotMatch(js,/(?:fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|supabase)/i);
});
test('animated game respects reduced motion and mobile size',()=>{
 const css=read('site-arcade-v11.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:730px/);
 assert.match(css,/ar11-target\[hidden\]/);
 assert.match(css,/ar11-overlay\[hidden\]/);
});
test('public deployment allowlist includes new game assets',()=>{
 const m=read('scripts/public-assets.txt');
 const sw=read('sw-v6.js');
 for(const name of ['site-arcade-v11.css','site-arcade-v12.js']){
  assert.ok(m.split(/\r?\n/).includes(name));
  assert.ok(sw.includes("'./"+name+"'"));
 }
 assert.match(sw,/aimroutine-v10-owner-reference-20261109/);
});