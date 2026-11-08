import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('V15 retains user provided mockup illustration as site hero, not flattened screenshots',()=>{
 const home=read('index.html'),training=read('training.html'),css=read('site-v15-fidelity.css');
 assert.ok(home.includes('img src="mockup-hero-v15.webp"'));
 assert.ok(training.includes('img src="mockup-hero-v15.webp"'));
 assert.match(css,/mockup-hero-v15\.webp/);
 assert.match(home,/data-v15-stat="sessions"/);
 assert.match(training,/v15-training-week/);
 assert.match(read('account.html'),/v15-cloud-portal/);
});
test('V15 preserves working form, signup and core training IDs',()=>{
 const account=read('account.html'),train=read('training.html');
 for(const id of ['login-form','signup-form','google-signin','delete-account-form','cloud-sync'])assert.ok(account.includes('id="'+id+'"'));
 for(const id of ['builder-form','routine-output','timer-toggle','finish-form','panel-insights'])assert.ok(train.includes('id="'+id+'"'));
});
test('V15 uses only stored user training information and verified cloud session on home',()=>{
 const js=read('site-v15-data.mjs');
 for(const pattern of [/normalizeStore/,/computeStats/,/scopedKey/,/validUid/,/getSession/,/isEnabled/])assert.match(js,pattern);
 assert.doesNotMatch(js,/Math\.random\(|fakeScores|demoSessions/);
});
test('V15 functionality supports five actual training days and user language',()=>{
 const js=read('site-v15-fidelity.js');
 assert.match(js,/data-v15-weekday/);
 assert.match(js,/data-v15-day/);
 assert.match(js,/data-v15-lang/);
 assert.doesNotMatch(js,/(?:fetch\s*\(|XMLHttpRequest|sessionStorage|indexedDB|supabase)/i);
 assert.match(read('site-v15-fidelity.css'),/prefers-reduced-motion:reduce/);
 assert.match(read('site-v15-fidelity.css'),/max-width:760px/);
});
test('V15 all pages load new stylesheet and script and deploy all assets',()=>{
 const pages=['index.html','training.html','account.html','progress.html','product.html','presentation.html','changelog.html','releases.html','updates.html','riot-integration.html','privacy.html','terms.html','404.html'];
 for(const page of pages){
  const html=read(page);
  assert.ok(html.includes('site-v15-fidelity.css?v=1'),page);
  assert.ok(html.includes('site-v15-fidelity.js?v=1'),page);
  assert.ok(html.indexOf('site-v15-fidelity.css?v=1')>html.indexOf('site-v14-gallery.css?v=1'),page);
 }
 const a=read('scripts/public-assets.txt').split(/\r?\n/),sw=read('sw-v6.js');
 for(const name of ['mockup-hero-v15.webp','site-v15-fidelity.css','site-v15-fidelity.js','site-v15-data.mjs']){
  assert.ok(a.includes(name),name);
  assert.ok(sw.includes("'./"+name+"'"),name);
 }
 assert.match(sw,/aimroutine-v8-required-username-20261107/);
});
