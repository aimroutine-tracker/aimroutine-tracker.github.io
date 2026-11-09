import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=name=>readFileSync(new URL('../'+name+'.html',import.meta.url),'utf8');

test('Every V3 reference page prioritizes its actual local hero artwork',()=>{
 for(const name of ['index','training','progress','account']){
  const page=html(name);
  const preloads=[...page.matchAll(/<link\b[^>]*rel="preload"[^>]*as="image"[^>]*>/g)]
   .map(match=>match[0]);
  assert.equal(preloads.length,1,name+' must have only one hero-image preload');
  assert.match(preloads[0],/href="r17-hero\.webp"/,name);
  assert.match(preloads[0],/fetchpriority="high"/,name);
  assert.doesNotMatch(preloads[0],/cmsassets\.rgpub\.io/,name);
 }
});

test('Progress V3 hero is present before JavaScript and its dashboard order is stable',()=>{
 const page=html('progress');
 const script=readFileSync(new URL('../site-rebuild-v17.js',import.meta.url),'utf8');
 assert.match(page,/<main\b[^>]*class="v14-progress-main r17-progress-wrap r17-screen"/);
 assert.match(page,/<section class="r17-hero" aria-labelledby="r17-main-hero-title">/);
 assert.equal((page.match(/id="r17-main-hero-title"/g)||[]).length,1);
 assert.match(page,/class="v14-progress-hero v14-scene r17-obsolete"/);
 const names=[
  'v14-progress-kpis r17-progress-kpis',
  'v14-progress-grid r17-chart-grid',
  'v14-progress-secondary r17-secondary-grid',
  'v14-progress-notice r17-source-notice',
  'v14-progress-toolbar r17-toolbar'
 ];
 const offsets=names.map(name=>page.indexOf(name));
 assert.ok(offsets.every(v=>v>0),'All real data components must remain present');
 assert.ok(offsets.every((v,i)=>i===0||v>offsets[i-1]),
  'Source notice and range toolbar must already follow the actual dashboard');
 assert.match(script,/if\(main\?\.querySelector\('\.r17-hero'\)\)return/);
});
