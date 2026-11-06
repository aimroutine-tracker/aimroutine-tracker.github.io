import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

// ONE-TIME disposable signup attempt. Password stays in job memory only.
// This script never logs tokens, session details or the generated password.
const email='aimroutinetracker+cloud-v7-email-e2e-20261106@gmail.com';
const base='https://lmzswtzboobpokumxzhy.supabase.co/auth/v1';
const publicClient=readFileSync('cloud-client-v7.mjs','utf8');
const key=publicClient.match(/PUBLISHABLE_KEY='(sb_publishable_[A-Za-z0-9_]+)'/)?.[1];
assert.ok(key,'Missing public key');
const password=randomBytes(24).toString('base64url')+'A1!';
const headers={'apikey':key,'Content-Type':'application/json'};
const send=(path,body)=>fetch(base+path,{method:'POST',headers,body:JSON.stringify(body)});
const redirect='https://aimroutine-tracker.github.io/account.html';
const signup=await send('/signup?redirect_to='+encodeURIComponent(redirect),{email,password});
const signed=await signup.json().catch(()=>({}));
console.log('Disposable email signup: HTTP '+signup.status+'; session issued='+Boolean(signed.access_token||signed.session?.access_token));
if(!signup.ok)throw Error('Signup rejected: '+String(signed.code||signed.error_code||signed.msg||signed.message||'unknown'));
assert.ok(!signed.access_token&&!signed.session?.access_token,
 'SECURITY FAILURE: unconfirmed user received a login session');
const login=await send('/token?grant_type=password',{email,password});
const logged=await login.json().catch(()=>({}));
console.log('Unconfirmed email password login: HTTP '+login.status);
assert.ok(login.status>=400,'SECURITY FAILURE: unconfirmed email could log in');
const reset=await send('/recover?redirect_to='+encodeURIComponent(redirect+'?reset=1'),{email});
console.log('Disposable email password-reset request: HTTP '+reset.status);
if(!reset.ok){
 const body=await reset.json().catch(()=>({}));
 console.log('Reset request error code (no tokens): '+String(body.code||body.error_code||'unavailable'));
}
console.log('Disposable test address must be removed after mailbox verification.');
