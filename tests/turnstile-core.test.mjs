import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthCaptcha,TURNSTILE_SITE_KEY,TURNSTILE_SCRIPT} from '../turnstile-v7.mjs';

test('Turnstile uses the existing production public key and allows a disabled test adapter',async()=>{
 assert.equal(TURNSTILE_SITE_KEY,'0x4AAAAAAF32lny7msT5dyQh');
 assert.equal(TURNSTILE_SCRIPT,'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
 const captcha=createAuthCaptcha('',{loadApi:()=>{throw Error('Should not fetch Cloudflare')}}); 
 assert.equal(captcha.enabled,false);
 assert.equal(await captcha.mount('login',null),false);
 assert.deepEqual(captcha.options('login'),{});
 assert.deepEqual(captcha.options('reset'),{});
});

test('Turnstile configured: tokens stay isolated, expire and reset after use',async()=>{
 const handlers=new Map(),resetIds=[];
 const api={
  render(_element,options){handlers.set(options.sitekey+handlers.size,options);return handlers.size-1},
  reset(id){resetIds.push(id)}
 };
 const captcha=createAuthCaptcha('public-sitekey',{loadApi:async()=>api});
 assert.equal(captcha.enabled,true);
 await assert.rejects(captcha.mount('unknown',{}),/inconnu/);
 await assert.rejects(captcha.mount('login',null),/introuvable/);
 const target={};
 assert.equal(await captcha.mount('login',target),true);
 assert.equal(await captcha.mount('login',target),true);
 await assert.rejects(async()=>captcha.options('login'),/anti-robots/);
 const login=[...handlers.values()][0];
 login.callback('login-token');
 assert.deepEqual(captcha.options('login'),{captchaToken:'login-token'});
 await assert.rejects(async()=>captcha.options('reset'),/anti-robots/);
 login['expired-callback']();
 assert.throws(()=>captcha.options('login'),/anti-robots/);
 login.callback('new-token');
 await captcha.mount('reset',{});
 const reset=[...handlers.values()][1];
 reset.callback('reset-token');
 assert.deepEqual(captcha.options('reset'),{captchaToken:'reset-token'});
 assert.deepEqual(captcha.options('login'),{captchaToken:'new-token'});
 captcha.reset('login');
 assert.throws(()=>captcha.options('login'),/anti-robots/);
 assert.deepEqual(captcha.options('reset'),{captchaToken:'reset-token'});
 assert.deepEqual(resetIds,[0]);
 reset['error-callback']();
 assert.throws(()=>captcha.options('reset'),/anti-robots/);
 await captcha.mount('delete',{});
 const deletion=[...handlers.values()][2];
 deletion.callback('delete-reauth-token');
 assert.deepEqual(captcha.options('delete'),{captchaToken:'delete-reauth-token'});
 captcha.reset('delete');
 assert.throws(()=>captcha.options('delete'),/anti-robots/);
 assert.deepEqual(resetIds,[0,2]);
});
test('Turnstile cannot silently pass when its loader fails',async()=>{
 const captcha=createAuthCaptcha('public-sitekey',{loadApi:async()=>{throw Error('blocked by extension')}});
 await assert.rejects(captcha.mount('login',{}),/blocked by extension/);
 assert.throws(()=>captcha.options('login'),/anti-robots/);
});

test('An aging token is reset before Supabase receives it',async()=>{
 let time=1000,resetCount=0,challenge;
 const api={render(_el,opts){challenge=opts;return 'widget-signup'},reset(){resetCount++}};
 const captcha=createAuthCaptcha('public-sitekey',{loadApi:async()=>api,clock:()=>time});
 await captcha.mount('signup',{});
 challenge.callback('fresh-token');
 assert.deepEqual(captcha.options('signup'),{captchaToken:'fresh-token'});
 time+=240001;
 assert.throws(()=>captcha.options('signup'),/expiré/);
 assert.equal(resetCount,1);
 assert.throws(()=>captcha.options('signup'),/anti-robots/);
 challenge.callback('fresh-token-2');
 assert.deepEqual(captcha.options('signup'),{captchaToken:'fresh-token-2'});
});

test('Turnstile rejects a response inconsistent with its callback',async()=>{
 let challenge,liveToken='';
 const api={render(_el,opts){challenge=opts;return 17},getResponse(){return liveToken},isExpired(){return false},reset(){liveToken=''}};
 const captcha=createAuthCaptcha('public-sitekey',{loadApi:async()=>api});
 await captcha.mount('signup',{});
 challenge.callback('first-token');liveToken='first-token';
 assert.deepEqual(captcha.options('signup'),{captchaToken:'first-token'});
 liveToken='different-token';
 assert.throws(()=>captcha.options('signup'),/expiré/);
});
