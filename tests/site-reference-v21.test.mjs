import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('All four screenshot reference routes load the independent V21 interface',()=>{
 for(const p of ['index.html','training.html','account.html','progress.html']){
  const s=read(p);
  assert.ok(s.includes('site-reference-v21.css?v=1'),p);
  assert.ok(s.includes('site-reference-v21.mjs?v=1'),p);
 }
});
test('The V21 interface uses real persisted data, not mockup sample scores',()=>{
 const js=read('site-reference-v21.mjs'),css=read('site-reference-v21.css');
 for(const s of ['window.AIMWeb','createRoutine(','computeStats(','#v14-p-line','#auth-panel','data-a21-livechart'])assert.ok(js.includes(s),s);
 assert.doesNotMatch(js,/Math\.random|localStorage\.setItem|NeoAim94|12\s?846|78,4|72\s?480|85\s?000/);
 for(const s of ['.a21-hero','.a21-training-grid','.a21-account-grid','.a21-analytics-grid','prefers-reduced-motion'])assert.ok(css.includes(s),s);
});
test('V21 visual capture is draft-only and references original 1672x941 size',()=>{
 const qa=read('tests/reference-capture.mjs');
 assert.ok(qa.includes('width:1672,height:941'));
 assert.ok(qa.includes('before'));
 assert.ok(qa.includes('after'));
 assert.ok(qa.includes('side-by-side'));
 const sw=read('sw-v6.js'),allow=read('scripts/public-assets.txt');
 for(const p of ['site-reference-v21.css','site-reference-v21.mjs']){assert.ok(sw.includes(p));assert.ok(allow.includes(p))}
});
