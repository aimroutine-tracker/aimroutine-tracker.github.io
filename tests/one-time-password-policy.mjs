import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
// One-time server-side password-length policy check, using a disposable unconfirmed
// account. No password, tokens or confirmation URLs are written to the CI log.
const email='aimroutinetracker+pwdpolicy-20261106@gmail.com';
const cfg=readFileSync('cloud-client-v7.mjs','utf8');
const publishable=cfg.match(/PUBLISHABLE_KEY='(sb_publishable_[A-Za-z0-9_]+)'/)?.[1];
assert.ok(publishable);
const shortPassword=randomBytes(12).toString('base64url').slice(0,8)+'A1!';
assert.equal(shortPassword.length,11);
const resp=await fetch('https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/signup',{
 method:'POST',headers:{apikey:publishable,'Content-Type':'application/json'},
 body:JSON.stringify({email,password:shortPassword})
});
const body=await resp.json().catch(()=>({}));
console.log('Direct Auth signup with 11-character random password: HTTP '+resp.status);
console.log('Result: '+(resp.ok?'ACCEPTED: minimum 12 is NOT enforced by server':'REJECTED: check error code and policy settings'));
console.log('Error code (if any): '+String(body.code||body.error_code||'none'));
if(resp.ok){assert.ok(!body.access_token&&!body.session?.access_token,'UNSAFE: unconfirmed signup got valid session');}
console.log('Disposable alias MUST be checked and deleted after this verification.');
