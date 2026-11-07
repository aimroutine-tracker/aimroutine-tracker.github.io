import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('V12 exposes accessible game controls and the new engine',()=>{
 const html=read('index.html'),js=read('site-arcade-v12.js');
 for(const d of ['15000','20000','30000'])assert.ok(html.includes('data-ar12-duration="'+d+'"'));
 for(const s of ['combo','best','reaction','copy'])assert.ok(html.includes('data-ar12-'+s));
 assert.match(html,/site-arcade-v12\.js\?v=1/);
 assert.match(js,/const DURATION=20000/);
 assert.match(js,/setInterval\(tick,100\)/);
 assert.match(js,/function pause\(\)/);
 assert.match(js,/function resume\(\)/);
 assert.match(js,/function finish\(\)/);
 assert.match(js,/bestBySetup\[setup\]/);
 assert.match(js,/hits\/\(hits\+misses\)/);
 assert.match(js,/event\.key==='Escape'/);
 assert.match(js,/navigator\.clipboard/);
 assert.match(js,/document\.hidden/);
 assert.doesNotMatch(js,/(?:fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|supabase)/i);
});
test('V12 styles respect reduced motion and all routes load them',()=>{
 const css=read('site-arcade-v12.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:730px/);
 for(const page of ['index.html','training.html','account.html','product.html','privacy.html']){
  assert.match(read(page),/site-arcade-v12\.css\?v=1/);
 }
});
test('V12 assets are included in verified public build and offline pre-cache',()=>{
 const allow=read('scripts/public-assets.txt'),sw=read('sw-v6.js');
 for(const name of ['site-arcade-v12.js','site-arcade-v12.css']){
  assert.ok(allow.split(/\r?\n/).includes(name));
  assert.ok(sw.includes("'./"+name+"'"));
 }
 assert.match(sw,/aimroutine-v8-required-username-20261107/);
});