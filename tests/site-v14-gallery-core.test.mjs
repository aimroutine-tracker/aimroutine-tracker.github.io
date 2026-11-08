import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('V14 preserves original functional selectors',()=>{
 const a=load('account.html'),t=load('training.html'),h=load('index.html');
 for(const id of ['login-form','signup-form','google-signin','reset-form','delete-account-form','cloud-sync','dashboard-panel'])assert.ok(a.includes('id="'+id+'"'));
 for(const id of ['tab-dashboard','panel-builder','panel-insights','weekly-goal','total-sessions','routine-output','finish-form'])assert.ok(t.includes('id="'+id+'"'));
 assert.ok(h.includes('id="aim-challenge"'));assert.ok(h.includes('data-v14-ranklink="iron"'));
});
test('V14 stylesheet and script load last on all existing pages',()=>{
 const pages=['index.html','product.html','presentation.html','training.html','account.html','changelog.html','releases.html','updates.html','riot-integration.html','privacy.html','terms.html','404.html'];
 for(const p of pages){
  const s=load(p);
  assert.match(s,/site-v14-gallery\.css\?v=1/);
  assert.match(s,/site-v14-gallery\.js\?v=1/);
  assert.ok(s.indexOf('site-v14-gallery.css?v=1')>s.indexOf('site-future-v13.css?v=1'));
 }
});
test('V14 analytics is based on validated, scoped user sessions',()=>{
 const p=load('progress.html'),js=load('progress-v14.mjs');
 for(const id of ['v14-p-line','v14-p-bars','v14-p-distribution','v14-p-sessions'])assert.ok(p.includes('id="'+id+'"'));
 for(const marker of ['normalizeStore','computeStats','scopedKey','validUid','getSession'])assert.ok(js.includes(marker));
 assert.doesNotMatch(js,/Math\.random\(|fakeData|mockScores/);
});
test('V14 controls are real and animations are accessible',()=>{
 const js=load('site-v14-gallery.js'),css=load('site-v14-gallery.css');
 for(const marker of ['AIMWeb','data-v14-generate','cloud-enabled-status','data-v14-account-action'])assert.ok(js.includes(marker));
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:680px/);
 assert.doesNotMatch(js,/(?:fetch\s*\(|XMLHttpRequest|sessionStorage|indexedDB|supabase|auth\.getSession)/i);
});
test('V14 public manifest and PWA shell updated',()=>{
 const allow=load('scripts/public-assets.txt').split(/\r?\n/),sw=load('sw-v6.js');
 for(const name of ['site-v14-gallery.css','site-v14-gallery.js','progress-v14.mjs','progress.html']){
  assert.ok(allow.includes(name));assert.ok(sw.includes("'./"+name+"'"));
 }
 assert.match(sw,/aimroutine-v8-required-username-20261107/);
});
