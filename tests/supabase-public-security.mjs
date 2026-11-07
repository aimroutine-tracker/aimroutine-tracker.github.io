import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const config=readFileSync('cloud-client-v7.mjs','utf8');
const match=config.match(/PUBLISHABLE_KEY='(sb_publishable_[A-Za-z0-9_]+)'/);
assert.ok(match,'Public project publishable key not found');
const key=match[1];
const origin='https://lmzswtzboobpokumxzhy.supabase.co';
const jsonHeaders={'apikey':key,'Content-Type':'application/json'};
const settings=await fetch(origin+'/auth/v1/settings',{headers:{apikey:key}});
assert.equal(settings.status,200,'Public Auth settings endpoint must be reachable');
const publicSettings=await settings.json();
console.log('Auth public configuration: '+JSON.stringify({
 googleProvider:publicSettings.external?.google===true,
 emailProvider:publicSettings.external?.email===true,
 signupDisabledOnServer:publicSettings.disable_signup===true,
 emailAutoConfirm:publicSettings.mailer_autoconfirm===true
}));
assert.equal(publicSettings.external?.google,true,'Google OAuth provider unexpectedly disabled');
assert.notEqual(publicSettings.mailer_autoconfirm,true,'Email should require confirmation for public registration');

// Check the public OAuth initiation path without authenticating as anyone.
// This verifies that Supabase can build the Google consent redirect, but is
// NOT proof of a completed Google sign-in.
const authorizeUrl=origin+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent('https://aimroutine-tracker.github.io/account.html');
const authorize=await fetch(authorizeUrl,{headers:{apikey:key},redirect:'manual'});
const destination=authorize.headers.get('location');
console.log('Google OAuth initiation: HTTP '+authorize.status+'; Google consent redirect='+Boolean(destination&&new URL(destination).hostname==='accounts.google.com'));
assert.ok([302,303,307].includes(authorize.status),'Google OAuth initiation did not redirect to a consent page');
assert.equal(new URL(destination).hostname,'accounts.google.com','Google OAuth redirect host is not the expected official Google service');


// Critical release gate: an email recovery endpoint has no signup-hook
// dependency, so a bogus address cannot trigger an email and MUST be
// denied by Supabase Auth when submitted without a Turnstile token.
// This is a negative production security test, not a real password reset.
const noCaptchaRecover=await fetch(origin+'/auth/v1/recover',{
 method:'POST',headers:jsonHeaders,body:JSON.stringify({
  email:'aimroutine-captcha-negative-20261107@example.invalid',
  gotrue_meta_security:{captcha_token:''}
 })
});
const noCaptchaResponse=await noCaptchaRecover.text();
const captchaFailure=/captcha|turnstile/i.test(noCaptchaResponse);
console.log('Production Auth recovery without CAPTCHA: HTTP '+noCaptchaRecover.status+'; captchaRejected='+captchaFailure);
assert.ok(noCaptchaRecover.status>=400&&noCaptchaRecover.status<500&&captchaFailure,
 'Production Supabase Auth is not rejecting captcha-less recovery requests. Keep email signup gated.');

const url=origin+'/functions/v1/delete-aim-account';
for(const [name,headers] of [
 ['without user JWT',jsonHeaders],
 ['with forged user JWT',{...jsonHeaders,'Authorization':'Bearer test-invalid-jwt'}]
]){
 const result=await fetch(url,{method:'POST',headers,body:JSON.stringify({
  action:'delete_my_account',confirmation:'SUPPRIMER'
 })});
 console.log('Delete endpoint '+name+': HTTP '+result.status);
 assert.ok(result.status>=400&&result.status<500,
  'Unauthenticated account deletion was not rejected');
}
const resetRpc=origin+'/rest/v1/rpc/aim_reset_my_progress';
for(const [label,headers] of [
 ['anonymous',jsonHeaders],
 ['forged JWT',{...jsonHeaders,'Authorization':'Bearer invalid-test-token'}]
]){
 const response=await fetch(resetRpc,{method:'POST',headers,body:'{}'});
 console.log('Progress reset RPC '+label+': HTTP '+response.status);
 assert.ok([401,403].includes(response.status),
  'Account progress reset must reject unauthorized requests');
}
console.log('Live authentication, account deletion and progress reset security smoke checks passed.');
