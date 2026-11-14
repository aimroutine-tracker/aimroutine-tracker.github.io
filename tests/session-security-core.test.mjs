import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {signOutEverywhere,verifiedAuthUser} from '../session-security-v7.mjs';

test('single logout always sends global signout to Supabase',async()=>{
 const calls=[],auth={signOut:async options=>{calls.push(options);return {error:null}}};
 await signOutEverywhere(auth);
 assert.deepEqual(calls,[{scope:'global'}]);
});
test('logout propagates Supabase errors without falsely reporting success',async()=>{
 const failed=Error('Supabase indisponible');
 await assert.rejects(signOutEverywhere({signOut:async()=>({error:failed})}),e=>e===failed);
});
test('logout refuses a missing authentication service',async()=>{
 await assert.rejects(signOutEverywhere(null),/indisponible/);
});
test('account page displays a single logout control without other-device actions',()=>{
 const html=readFileSync(new URL('../account.html',import.meta.url),'utf8');
 const code=readFileSync(new URL('../account-v7.mjs',import.meta.url),'utf8');
 assert.match(html,/id="logout"[^>]*>.*?Déconnexion/);
 assert.equal((html.match(/id="logout"/g)||[]).length,1);
 assert.doesNotMatch(html,/session-revoke-others|session-security-panel|Déconnecter mes autres appareils/);
 assert.doesNotMatch(code,/session-revoke-others|SCOPE_OTHER_DEVICES/);
 assert.match(code,/await signOutEverywhere\(supabase\.auth\)/);
});

test('account deletion identity guard rejects missing Auth data and switched accounts',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const other='22222222-2222-4222-8222-222222222222';
 const denied=[
  null,undefined,{}, {data:null,error:null}, {data:{user:null},error:null},
  {error:Error('Session expired')}, {data:{user:{id:other}},error:null},
  {data:{user:{id}},error:Error('Token invalid')}
 ];
 for(const response of denied){
  assert.equal(verifiedAuthUser(response,id),null,
   'Malformed, errored or different-account responses may never authorize deletion');
 }
 const current={id,email:'qa@example.invalid'};
 assert.equal(verifiedAuthUser({data:{user:current},error:null},id),current);
 const account=readFileSync(new URL('../account-v7.mjs',import.meta.url),'utf8');
 assert.match(account,/verifiedAuthUser\(await supabase\.auth\.getUser\(\),oldUid\)/);
 assert.doesNotMatch(account,/data:\{user:checked\},error:authError/);
 assert.match(account,/const loginAuth=await supabase\.auth\.getUser\(\)/);
 assert.match(account,/const initialAuth=await supabase\.auth\.getUser\(\)/);
 assert.doesNotMatch(account,/data:\{user:validated\},error/);
});
