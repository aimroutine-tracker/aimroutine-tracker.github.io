import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
// Production smoke: one disposable Outlook plus-address; no links or passwords logged.
const email='aimroutine-tracker+e2e1106@outlook.fr';
const source=readFileSync('cloud-client-v7.mjs','utf8');
const key=source.match(/PUBLISHABLE_KEY='(sb_publishable_[A-Za-z0-9_]+)'/)?.[1];
assert.ok(key);
const pwd=randomBytes(32).toString('base64url')+'A1!';
const url='https://lmzswtzboobpokumxzhy.supabase.co/auth/v1';
const headers={'apikey':key,'Content-Type':'application/json'};
const signup=await fetch(url+'/signup?redirect_to=https%3A%2F%2Faimroutine-tracker.github.io%2Faccount.html',{
 method:'POST',headers,body:JSON.stringify({email,password:pwd})
});
const signupData=await signup.json().catch(()=>({}));
console.log('Disposable Outlook signup HTTP '+signup.status+'; session issued: '+Boolean(signupData.access_token||signupData.session));
assert.ok(signup.ok,'Signup failed; do not test with a real account');
assert.ok(!signupData.access_token&&!signupData.session,'Unconfirmed email was authenticated');
const login=await fetch(url+'/token?grant_type=password',{
 method:'POST',headers,body:JSON.stringify({email,password:pwd})
});
console.log('Unconfirmed account login HTTP '+login.status);
assert.ok(login.status>=400,'Unconfirmed Outlook test user should not log in');
const reset=await fetch(url+'/recover?redirect_to=https%3A%2F%2Faimroutine-tracker.github.io%2Faccount.html%3Freset%3D1',{
 method:'POST',headers,body:JSON.stringify({email})
});
console.log('Outlook password reset request HTTP '+reset.status);
assert.ok(reset.ok,'Reset request unsuccessful');
console.log('Outlook test actions complete. Database cleanup is required.');
