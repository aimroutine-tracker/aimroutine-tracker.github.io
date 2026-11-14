import {stylesheetIndex} from './helpers/styles-v3.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages=['index.html','product.html','presentation.html','training.html','account.html',
 'changelog.html','releases.html','updates.html','riot-integration.html',
 'privacy.html','terms.html','404.html'];
test('V13 tactical design is consistently loaded after legacy styles',()=>{
 for(const page of pages){
  const html=read(page);
  const css='<link rel="stylesheet" href="site-future-v13.css?v=1">';
  const js='<script src="site-future-v13.js?v=1" defer></script>';
  const sheetIndex=stylesheetIndex(page,'site-future-v13.css');
  assert.ok(html.includes(js),page+' missing V13 JS');
  assert.ok(sheetIndex>stylesheetIndex(page,'site-arcade-v12.css'),page+' V13 CSS order');
  assert.equal(stylesheetIndex(page,'site-future-v13.css'),sheetIndex);
  assert.equal(html.split(js).length-1,1,page+' duplicate V13 JS');
 }
});
test('V13 has a distinct tactical visual language with accessible fallback',()=>{
 const css=read('site-future-v13.css');
 const js=read('site-future-v13.js');
 assert.match(css,/--ar13-red:/);
 assert.match(css,/--ar13-cyan:/);
 assert.match(css,/ar13-frame-corners/);
 assert.match(css,/ar13-spotlight-glow/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:760px/);
 assert.match(js,/prefers-reduced-motion: reduce/);
 assert.match(js,/pointermove/);
 assert.match(js,/requestAnimationFrame/);
 assert.match(js,/aria-hidden/);
 assert.doesNotMatch(js,/(?:fetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|supabase)/i);
});
test('V13 files are in the reviewed deployment and offline shell',()=>{
 const allow=read('scripts/public-assets.txt').split(/\r?\n/);
 const worker=read('sw-v6.js');
 for(const name of ['site-future-v13.css','site-future-v13.js']){
  assert.ok(allow.includes(name),name+' absent from public allowlist');
  assert.ok(worker.includes("'./"+name+"'"),name+' absent from offline assets');
 }
 assert.match(worker,/aimroutine-v11-home-bundles-20261114/);
});
