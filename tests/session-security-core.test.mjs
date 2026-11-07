import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {signOutEverywhere} from '../session-security-v7.mjs';

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
