import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const pages=['index.html','training.html','account.html','progress.html'];
test('V17 is a newly authored coherent screen instead of an image of a site',()=>{
 const js=read('site-rebuild-v17.js'),css=read('site-rebuild-v17.css');
 for(const name of ['homepage','routinePage','accountPage','progressPage','navigation']) assert.ok(js.includes('function '+name+'('),name);
 for(const marker of ['r17-home-wrap','r17-training-grid','r17-account-cols','r17-progress-wrap'])assert.ok(css.includes(marker));
 assert.doesNotMatch(js,/supabase\.auth|localStorage\.(?:setItem|removeItem)|fetch\s*\(/i);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:720px/);
});
test('V17 keeps all existing real engines and fields available',()=>{
 const h=read('index.html'),tr=read('training.html'),a=read('account.html'),p=read('progress.html');
 for(const id of ['aim-challenge','choose-path'])assert.ok(h.includes('id="'+id+'"'));
 for(const id of ['builder-form','rank','focus','duration','panel-builder','panel-dashboard','finish-form','weekly-goal'])assert.ok(tr.includes('id="'+id+'"'));
 for(const id of ['login-form','signup-form','google-signin','dashboard-panel','delete-account-form'])assert.ok(a.includes('id="'+id+'"'));
 for(const id of ['v14-p-average','v14-p-sessions','v14-p-line','v14-p-bars','v14-p-distribution'])assert.ok(p.includes('id="'+id+'"'));
});
test('V17 high quality concept-art crop and code ship in PWA and manifest',()=>{
 const allow=read('scripts/public-assets.txt').split(/\r?\n/),sw=read('sw-v6.js');
 for(const path of ['site-rebuild-v17.css','site-rebuild-v17.js','r17-hero.webp']){
  assert.ok(allow.includes(path));
  assert.ok(sw.includes("'./"+path+"'"));
 }
 const img=readFileSync(new URL('../r17-hero.webp',import.meta.url));
 assert.equal(img.subarray(0,4).toString(),'RIFF');
 assert.equal(img.subarray(8,12).toString(),'WEBP');
 assert.ok(img.length>20000,'Full-size hero illustration is not a tiny thumbnail');
 for(const page of pages){
  const html=read(page);
  assert.ok(html.includes('site-rebuild-v17.css?v=1'));
  assert.ok(html.includes('site-rebuild-v17.js?v=1'));
 }
 assert.match(sw,/aimroutine-v8-required-username-20261107/);
});
test('V17 layout never invents XP, ranked badges, connected devices, or Riot scores',()=>{
 const js=read('site-rebuild-v17.js');
 assert.doesNotMatch(js,/\b(?:NeoAim94|72 480|12 846|88,4|Niveau 27)\b/);
 assert.match(js,/getStore/);
 assert.match(js,/cloud-enabled-status/);
 assert.match(js,/data-v15-stat/);
});
