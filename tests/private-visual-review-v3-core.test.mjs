import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('./private-visual-review-v3.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('./visual-references/manifest.json',import.meta.url),'utf8'));

test('private visual comparator runs as an offline inline script with no outbound transport',()=>{
 const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(code,'Offline comparator needs a JavaScript entrypoint');
 assert.doesNotThrow(()=>new Script(code,{filename:'private-visual-review-v3.html'}));
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/default-src 'none'/);
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|import\s*\(/);
 assert.match(code,/crypto\.subtle\.digest\('SHA-256'/);
 assert.match(code,/await digest\(ref\)/);
 assert.match(code,/sha!==entry\.sha/);
 assert.match(code,/state\.revision!==run/,'stale async result must be dropped');
});

test('all four owner-reference hashes and viewport match the single source manifest exactly',()=>{
 const declared=[...html.matchAll(/\{id:'(home|routines|progress|account)',label:'[^']+',sha:'([0-9a-f]{64})'\}/g)];
 const pages=Object.keys(manifest.references).sort();
 assert.deepEqual(pages,['account','home','progress','routines']);
 assert.equal(declared.length,4,'Comparator must contain exactly four page mappings');
 const actual=Object.fromEntries(declared.map(([,id,hash])=>[id,hash]));
 assert.equal(Object.keys(actual).length,4,'Each page must be declared once');
 for(const page of pages){
  assert.equal(actual[page],manifest.references[page].sha256,`Outdated SHA-256 for ${page}`);
  assert.match(manifest.references[page].sha256,/^[0-9a-f]{64}$/);
 }
 const target=html.match(/const TARGET=\{width:(\d+),height:(\d+)\}/);
 assert.ok(target,'Viewport must be declared in HTML script');
 assert.deepEqual({width:Number(target[1]),height:Number(target[2])},manifest.viewport);
 assert.deepEqual(manifest.viewport,{width:1672,height:941});
});

test('four verified comparisons are necessary to export any summary report',()=>{
 assert.match(html,/Object\.keys\(results\)\.length!==4/);
 assert.match(html,/if\(Object\.keys\(results\)\.length!==4\)return;/);
 assert.match(html,/delete results\[id\]/);
 assert.match(html,/results\[entry\.id\]/);
});
