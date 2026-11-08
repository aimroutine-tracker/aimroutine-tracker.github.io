import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=n=>readFileSync(new URL('../'+n,import.meta.url),'utf8');
test('V19 reference screens load the native interaction layer',()=>{
 for(const page of ['index.html','training.html','account.html','progress.html']){
  const html=get(page);
  assert.ok(html.includes('site-interface-v19.css?v=1'),page);
  assert.ok(html.includes('site-interface-v19.mjs?v=1'),page);
 }
 for(const name of ['site-interface-v19.css','site-interface-v19.mjs']){
  assert.ok(get('scripts/public-assets.txt').includes(name));
  assert.ok(get('sw-v6.js').includes("'./"+name+"'"));
 }
});
test('V19 uses real builder, cloud actions and analytics without shadow data',()=>{
 const script=get('site-interface-v19.mjs');
 for(const item of ['createRoutine(', 'computeStats(', 'getStore','panel-program','cloud-sync','cloud-import-guest','v14-progress-range','showModal','training-core-v5.mjs'])assert.ok(script.includes(item),item);
 assert.doesNotMatch(script,/Math\.random|localStorage\.setItem|supabase\.auth|fakeResults|mockSessions/);
});
test('V19 responsive cards and dialog account for accessible motion',()=>{
 const css=get('site-interface-v19.css');
 for(const item of ['prefers-reduced-motion:reduce','max-width:700px','::backdrop','.r19-tool-grid','.r19-cloud-actions','.r19-range-buttons'])assert.ok(css.includes(item),item);
});

test('Home and progress proactively pull signed-in Cloud data',()=>{
 const home=get('site-v15-data.mjs'),analytics=get('progress-v14.mjs');
 assert.ok(home.includes('await synchronize(supabase,uid)'));
 assert.ok(analytics.includes('await synchronize(supabase,uid)'));
 assert.ok(analytics.includes('Cloud sync pending'));
});
