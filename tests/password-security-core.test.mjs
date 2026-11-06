import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPasswordLength,findHashSuffix,checkLeakedPassword} from '../password-security-v7.mjs';
test('client-side password length and repetition checks',()=>{
 assert.equal(checkPasswordLength('Aa1!bcd').ok,false); // 7 characters
 assert.equal(checkPasswordLength('Aa1!bcde').ok,true); // exactly 8
 assert.equal(checkPasswordLength('abcdefgh').ok,false); // eight characters but too weak
 assert.equal(checkPasswordLength('aaaaaaaaaaaa').ok,false);
 assert.equal(checkPasswordLength('A-long-unique-passphrase-2026!').ok,true);
});
test('pwned password range matching ignores padded entries',()=>{
 const suffix='1E4C9B93F3F0682250B6CF8331B7EE68FD8';
 assert.equal(findHashSuffix(suffix+':500000\r\n'+'0'.repeat(35)+':0',suffix),500000);
 assert.equal(findHashSuffix('A'.repeat(35)+':5\r\n'+'0'.repeat(35)+':0',suffix),0);
});
test('uses k-anonymity and rejects known breached passwords without transmitting plaintext',async()=>{
 let requested='',headers={};
 const request=async(url,options)=>{requested=url;headers=options.headers;return {ok:true,text:async()=> '1E4C9B93F3F0682250B6CF8331B7EE68FD8:10000\r\n'+('0'.repeat(35))+':0'}};
 await assert.rejects(()=>checkLeakedPassword('pass',{request}),/8 caractères/);
 assert.equal(requested,'');
 const safePassword='A-long-unique-passphrase-2026!';
 const hashBuffer=await crypto.subtle.digest('SHA-1',new TextEncoder().encode(safePassword));
 const hex=[...new Uint8Array(hashBuffer)].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
 const reply=async(url,options)=>{requested=url;headers=options.headers;return {ok:true,text:async()=>hex.slice(5)+':2\\r\\n'+'0'.repeat(35)+':0'}};
 const result=await checkLeakedPassword(safePassword,{request:reply});
 assert.equal(result.safe,false);
 assert.equal(result.exposureCount,2);
 assert.equal(requested,'https://api.pwnedpasswords.com/range/'+hex.slice(0,5));
 assert.equal(headers['Add-Padding'],'true');
 assert.equal(requested.includes(safePassword),false);
});
test('a unique password is accepted when hash is absent',async()=>{
 const request=async()=>({ok:true,text:async()=> '0'.repeat(35)+':0'});
 const result=await checkLeakedPassword('A-long-unique-passphrase-2026!',{request});
 assert.equal(result.safe,true);
});
test('an unavailable breach API fails closed',async()=>{
 await assert.rejects(()=>checkLeakedPassword('a-long-unique-passphrase-2026!',{request:async()=>{throw new Error('offline')}}),/indisponible/);
});
