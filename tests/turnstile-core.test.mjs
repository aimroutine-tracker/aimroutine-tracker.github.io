import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthCaptcha,TURNSTILE_SITE_KEY,TURNSTILE_SCRIPT} from '../turnstile-v7.mjs';

test('Turnstile disabled by default: login/signup/reset work unchanged',async()=>{
 assert.equal(TURNSTILE_SITE_KEY,'');
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
});
test('Turnstile cannot silently pass when its loader fails',async()=>{
 const captcha=createAuthCaptcha('public-sitekey',{loadApi:async()=>{throw Error('blocked by extension')}});
 await assert.rejects(captcha.mount('login',{}),/blocked by extension/);
 assert.throws(()=>captcha.options('login'),/anti-robots/);
});
