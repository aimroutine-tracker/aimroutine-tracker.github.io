import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages=['index.html','training.html','account.html','progress.html','product.html','presentation.html','changelog.html','releases.html','updates.html','riot-integration.html','privacy.html','terms.html','404.html'];
test('Official A logo is exactly the supplied two-piece vector mark',()=>{
 const svg=read('aimroutine-brand-a-v2.svg');
 assert.match(svg,/viewBox="-5 -5 115 105"/);
 assert.match(svg,/fill="#FF5B69"/);
 assert.match(svg,/53,0 0,95 31,81 41,67 36,68 55,31 60,40 70,30/);
 assert.match(svg,/71,32 62,48 72,64 44,65 49,68 47,70 105,92/);
 assert.match(read('favicon.svg'),/71,32 62,48/);
});
test('Design tokens are canonical and preserve official palette meanings',()=>{
 const tokens=read('aimroutine-official-tokens-v2.css'),css=read('site-official-v16.css');
 for(const [color,value] of [['bg','#080F18'],['coral','#FF5B69'],['cyan','#37E3DD'],['purple','#BC86E6'],['amber','#FFB453']]){
  assert.ok(tokens.includes('--ar-'+color+': '+value),color);
 }
 assert.match(css,/var\(--ar-coral\)/);
 assert.match(css,/var\(--ar-cyan\)/);
 assert.match(css,/var\(--ar-purple\)/);
 assert.match(css,/var\(--ar-amber\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/max-width:680px/);
});
test('Official vector and responsive layout ship on every page without replacing app logic',()=>{
 for(const file of pages){
  const html=read(file);
  assert.match(html,/site-official-v16\.css\?v=1/);
  assert.match(html,/aimroutine-brand-a-v2\.svg\?v=1/);
  assert.match(html,/favicon\.svg\?v=3/);
  assert.match(html,/aimroutine-official-tokens-v2\.css\?v=1/);
  assert.ok(html.indexOf('site-official-v16.css?v=1')>html.indexOf('site-v15-fidelity.css?v=1'),file);
 }
 const tr=read('training.html'),ac=read('account.html');
 for(const id of ['builder-form','panel-builder','routine-output','finish-form'])assert.ok(tr.includes('id="'+id+'"'));
 for(const id of ['login-form','signup-form','google-signin','delete-account-form'])assert.ok(ac.includes('id="'+id+'"'));
});
test('Official PNG, style and logo are publicly packaged and cached',()=>{
 const assets=read('scripts/public-assets.txt').split(/\r?\n/),worker=read('sw-v6.js');
 for(const f of ['aimroutine-logo.png','aimroutine-brand-a-v2.svg','aimroutine-official-tokens-v2.css','site-official-v16.css']){
  assert.ok(assets.includes(f),f+' not allowlisted');
 }
 for(const f of ['aimroutine-brand-a-v2.svg','aimroutine-official-tokens-v2.css','site-official-v16.css']){
  assert.ok(worker.includes("'./"+f+"'"),f+' not offline');
 }
 assert.match(worker,/aimroutine-v10-owner-reference-20261109/);
 assert.match(read('manifest.webmanifest'),/"sizes": "256x256"/);
});

test('Official raster PWA icon is a valid transparent 256px PNG',()=>{
 const png=readFileSync(new URL('../aimroutine-logo.png',import.meta.url));
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 let position=8,dat=[];
 let width=0,height=0,palette=false,alpha=false,ended=false;
 while(position<png.length){
  const n=png.readUInt32BE(position),tag=png.toString('ascii',position+4,position+8);
  const chunk=png.subarray(position+8,position+8+n);
  if(tag==='IHDR'){width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);}
  if(tag==='PLTE')palette=true;
  if(tag==='tRNS')alpha=true;
  if(tag==='IDAT')dat.push(chunk);
  if(tag==='IEND'){ended=true;break;}
  position+=12+n;
 }
 assert.equal(width,256);assert.equal(height,256);
 assert.ok(palette&&alpha&&ended,'Transparent palette and IEND must be valid');
 const decoded=inflateSync(Buffer.concat(dat));
 assert.equal(decoded.length,256*(1+128));
});
