import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const pages=['index.html','training.html','account.html','progress.html'];
test('V17 uses four independent semantic screens, rather than a flat image',()=>{
 const [home,training,account,progress]=pages.map(read);
 for(const html of [home,training,account,progress]){
  assert.ok(html.includes('class="site31-header ar17-header"'));
  assert.ok(html.includes('site-rebuilt-v17.css?v=1'));
  assert.ok(html.includes('site-rebuilt-v17.js?v=1'));
  assert.ok(html.includes('mockup-hero-v15.webp'));
  assert.ok(html.includes('aimroutine-brand-a-v2.svg?v=1'));
  assert.ok(html.includes('class="ar17-hero'));
  assert.ok(html.includes('href="progress.html"'));
 }
 assert.ok(home.includes('class="ar17-features"')||home.includes('class="v14-home-features ar17-features"'));
 assert.ok(home.includes('class="ar9-path-grid ar17-path-grid"'));
 assert.ok(home.includes('id="choose-path"'));
 assert.ok(home.includes('id="aim-challenge"'));
 assert.ok(home.includes('data-v15-stat="accuracy"'));
 assert.ok(training.includes('class="v14-training-stage ar17-training-grid"'));
 assert.ok(training.includes('class="v15-training-week ar17-training-week ar17-card"'));
 assert.ok(account.includes('class="v15-cloud-portal ar17-cloud-portal"'));
 assert.ok(progress.includes('class="ar17-analytics-grid"'));
});
test('V17 keeps core runtime integration DOM and account flows intact',()=>{
 const tr=read('training.html'),account=read('account.html'),p=read('progress.html');
 for(const id of ['tab-dashboard','tab-builder','panel-builder','panel-insights','panel-data','builder-form','finish-form','routine-output','player-display-name'])assert.ok(tr.includes('id="'+id+'"'),id);
 for(const id of ['login-form','signup-form','signup-username','google-signin','reset-form','dashboard-panel','delete-account-form','cloud-sync'])assert.ok(account.includes('id="'+id+'"'),id);
 for(const id of ['v14-p-sessions','v14-p-average','v14-p-minutes','v14-p-streak','v14-p-line','v14-p-bars','v14-p-distribution','v14-p-goal','v14-p-goalbar'])assert.ok(p.includes('id="'+id+'"'),id);
 assert.equal((tr.match(/data-v15-day="/g)||[]).length,5);
 assert.equal((tr.match(/data-v15-weekday="/g)||[]).length,5);
 assert.equal((tr.match(/data-v14-level="/g)||[]).length,3);
});
test('V17 styles are isolated and responsive with motion controls',()=>{
 const css=read('site-rebuilt-v17.css');
 const js=read('site-rebuilt-v17.js');
 assert.match(css,/--ar17-coral:#ff5b69/);
 assert.match(css,/--ar17-teal:#37e3dd/);
 assert.match(css,/max-width:1050px/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/max-width:390px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(js,/XMLHttpRequest|indexedDB|sessionStorage|localStorage|supabase/);
});
test('V17 new files are reviewed, published and available offline',()=>{
 const list=read('scripts/public-assets.txt').split(/\\r?\\n/);
 const sw=read('sw-v6.js');
 for(const name of ['site-rebuilt-v17.css','site-rebuilt-v17.js']){
  assert.ok(list.includes(name));assert.ok(sw.includes("'./"+name+"'"));
 }
 assert.match(sw,/aimroutine-v8-required-username-20261107/);
});
