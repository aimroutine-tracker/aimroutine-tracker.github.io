import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {checkPasswordLength,MIN_PASSWORD_LENGTH} from '../password-security-v7.mjs';
const root=new URL('../',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
const htmlHasSignupButton=()=>read('account.html').match(/<button[^>]*id="signup-submit"[^>]*>/)?.[0]||'';

// Release guard: the Supabase backend was explicitly changed to an 8-character
// four-category rule and verified via real Auth API. Never reintroduce an older
// frontend policy via a publishing/security refactor without updating tests.
test('account signup/recovery enforce 8 chars and all four classes',()=>{
 const html=read('account.html');
 const fields=['signup-password','new-password'];
 for(const field of fields){
  const match=html.match(new RegExp('<input\\s+id="'+field+'"[^>]*>'));
  assert.ok(match,'Missing '+field+' password field');
  assert.match(match[0],/minlength="8"/);
  assert.doesNotMatch(match[0],/minlength="12"/);
 }
 assert.match(html,/Mot de passe \(8 caractères minimum\)/);
 assert.match(html,/Nouveau mot de passe \(8 caractères minimum\)/);
 assert.match(html,/account-v7\.mjs\?v=15/);
 assert.equal(MIN_PASSWORD_LENGTH,8);
 assert.equal(checkPasswordLength('Ab1!cdef').ok,true);
 assert.equal(checkPasswordLength('Ab1!cde').ok,false);
 assert.equal(checkPasswordLength('abcdefgh').ok,false);
 assert.equal(checkPasswordLength('ABCDEFGH1!').ok,false);
 assert.equal(checkPasswordLength('Abcdefgh1').ok,false);
 assert.equal(checkPasswordLength('Abcdefgh!').ok,false);
});
test('email signup release is enabled, CAPTCHA remains and offline cache is versioned',()=>{
 const code=read('account-v7.mjs');
 const sw=read('sw-v6.js');
 assert.match(code,/const SIGNUPS_READY=true/);
 assert.match(htmlHasSignupButton(),/id="signup-submit"/);
 assert.doesNotMatch(htmlHasSignupButton(),/id="signup-submit" disabled/);
 assert.match(read('account.html'),/id="captcha-signup"/);
 assert.match(sw,/aimroutine-v8-visual-polish-20261107/);
});
