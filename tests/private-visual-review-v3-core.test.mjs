import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const html=readFileSync(new URL('./private-visual-review-v3.html',import.meta.url),'utf8');

test('private visual review tool includes only offline source and runnable inline JS',()=>{
 const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(code,'Offline comparator needs a JavaScript entrypoint');
 assert.doesNotThrow(()=>new Script(code,{filename:'private-visual-review-v3.html'}));
 assert.match(html,/connect-src 'none'/);
 assert.match(html,/default-src 'none'/);
 assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|import\s*\(/);
 assert.match(code,/crypto\.subtle\.digest\('SHA-256'/);
 assert.match(code,/await digest\(ref\)/);
 assert.match(code,/sha!==entry\.sha/);
 assert.match(code,/TARGET=\{width:1672,height:941\}/);
});

test('private comparator pins all four distinct owner SHA-256 fingerprints',()=>{
 const fingerprints=[
 '282d589fbbaa041af05e615334dddfcf72ec10e6245f113927e280f216c94675',
 'fbb08ce2a2fb44ab4e77f8e14478c5ce522ee343ca34f2898b4045a3b0f393b3',
 '93557dd0eb3ae08956e4bde4d767b5a7fd27debf7a07472bdfd52ab5f633d467',
 '712a1501a530b5573bb17a6c9ba35f81d65b8d406ffcd3a8b4f0cdd9da32dfd2'
 ];
 for(const sha of fingerprints)assert.ok(html.includes(sha),sha);
 assert.equal(new Set(fingerprints).size,4);
 for(const page of ['home','routines','progress','account'])
  assert.ok(html.includes("id:'"+page+"'"),'missing page '+page);
});
