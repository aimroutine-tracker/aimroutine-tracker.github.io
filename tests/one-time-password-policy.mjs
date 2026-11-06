import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
// One-time server-side threshold comparison; all test passwords are generated
// in ephemeral job memory and never logged.
const cfg=readFileSync('cloud-client-v7.mjs','utf8');
const publishable=cfg.match(/PUBLISHABLE_KEY='(sb_publishable_[A-Za-z0-9_]+)'/)?.[1];
assert.ok(publishable);
const base='https://lmzswtzboobpokumxzhy.supabase.co/auth/v1/signup';
for(const {length,email} of [
  {length:11,email:'aimroutinetracker+pwdpolicy-20261106@gmail.com'},
  {length:12,email:'aimroutinetracker+pwdpolicy12-20261106@gmail.com'}
]){
 const pwd=randomBytes(24).toString('base64url').slice(0,length-3)+'A1!';
 assert.equal(pwd.length,length);
 const resp=await fetch(base,{method:'POST',headers:{apikey:publishable,'Content-Type':'application/json'},
  body:JSON.stringify({email,password:pwd})});
 const data=await resp.json().catch(()=>({}));
 console.log('Direct Auth signup with '+length+' chars: HTTP '+resp.status);
 console.log('Result: '+(resp.ok?'accepted':'rejected'));
 const message=String(data.msg||data.message||'').toLowerCase();
 console.log('Policy detail: '+(message.includes('at least 12')||message.includes('12 characters')?'minimum 12 chars':
  message.includes('password')?'password-related rejection':'no specific public detail'));
 if(resp.ok)assert.ok(!data.access_token&&!data.session?.access_token,'UNSAFE: unconfirmed user got a session');
 if(length===11)assert.ok(!resp.ok,'SECURITY FAILURE: 11-character password accepted');
 if(length===12)assert.ok(resp.ok,'12-character candidate unexpectedly rejected');
}
console.log('Check and remove newly created disposable test account before closing this validation.');
