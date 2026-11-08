import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('The four reference screens use the same V20 design system',()=>{
 for(const p of ['index.html','training.html','account.html','progress.html']){
  const html=get(p);
  assert.ok(html.includes('site-reference-v20.css?v=1'),p);
  assert.ok(html.includes('site-reference-v20.mjs?v=1'),p);
 }
});
test('The rebuild keeps existing real engines and no fabricated user stats',()=>{
 const js=get('site-reference-v20.mjs'),css=get('site-reference-v20.css');
 for(const selector of ['window.AIMWeb','computeStats','data-r17-chart','v14-p-line-panel','dashboard-panel'])assert.ok(js.includes(selector),selector);
 for(const pattern of ['r17-hero','r17-training-grid','r17-account-profile','r17-chart-grid','prefers-reduced-motion'])assert.ok(css.includes(pattern),pattern);
 assert.doesNotMatch(js,/localStorage\.setItem|Math\.random|mockSession|fakeResult|NeoAim94/);
 for(const p of ['training.html','account.html'])assert.match(get(p),/training-entry-v7|account-v7\.mjs/);
});
test('V20 assets are publishable by Pages',()=>{
 const publish=get('scripts/public-assets.txt'),sw=get('sw-v6.js');
 for(const file of ['site-reference-v20.css','site-reference-v20.mjs']){
  assert.ok(publish.includes(file),file);assert.ok(sw.includes(file),file);
 }
});
