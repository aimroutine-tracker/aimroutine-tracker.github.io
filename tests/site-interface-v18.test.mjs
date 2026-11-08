import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages=['index.html','training.html','account.html','progress.html','product.html','presentation.html','changelog.html','releases.html','updates.html','riot-integration.html','privacy.html','terms.html','404.html'];
test('V18 is present on every page and deployable',()=>{
  for(const page of pages){
    const html=read(page);
    assert.ok(html.includes('site-interface-v18.css?v=1'),page);
    assert.ok(html.includes('site-interface-v18.js?v=1'),page);
  }
  const allow=read('scripts/public-assets.txt'),sw=read('sw-v6.js');
  for(const name of ['site-interface-v18.css','site-interface-v18.js']){
    assert.ok(allow.includes(name));assert.ok(sw.includes("'./"+name+"'"));
  }
});
test('V18 wires actual training controls rather than a fake preview',()=>{
 const js=read('site-interface-v18.js');
 for(const marker of ['#panel-builder','tab-builder','showModal','[data-r17-create]','aim-v5-ready','hashchange'])assert.ok(js.includes(marker),marker);
 assert.doesNotMatch(js,/supabase\.auth|Math\.random|localStorage\.(?:setItem|removeItem)|fetch\s*\(/i);
});
test('V18 preserves account, timers, analytics and reduced-motion accessibility',()=>{
 const html=read('account.html'),train=read('training.html'),progress=read('progress.html'),css=read('site-interface-v18.css');
 for(const marker of ['id="google-signin"','id="signup-form"','id="delete-account-form"','account-v7.mjs'])assert.ok(html.includes(marker));
 for(const marker of ['id="start-plan"','id="timer-toggle"','id="finish-form"'])assert.ok(train.includes(marker));
 assert.ok(progress.includes('progress-v14.mjs'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 assert.ok(css.includes('::backdrop'));
});
