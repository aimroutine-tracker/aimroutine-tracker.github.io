import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
test('every catalog exercise name and tip has an English display translation',()=>{
 const entries=[...read('training-core-v5.mjs').matchAll(/name:'([^']+)',tip:'([^']+)'/g)];
 const translations=read('training-i18n-v6.js');
 assert.equal(entries.length,16);
 for(const [,name,tip] of entries){
  assert.ok(translations.includes(JSON.stringify(name)),name);
  assert.ok(translations.includes(JSON.stringify(tip)),tip);
 }
 assert.match(translations,/function lookup\(phrase\)/);
});
test('the training page reloads the updated localizer',()=>{
 assert.match(read('training.html'),/training-i18n-v6\.js\?v=2/);
});
