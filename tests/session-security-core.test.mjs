import test from 'node:test';
import assert from 'node:assert/strict';
import {signOutSessions,SCOPE_ALL,SCOPE_OTHER_DEVICES} from '../session-security-v7.mjs';

test('ordinary log out explicitly revokes all Supabase sessions, preserving prior behavior',async()=>{
 const calls=[],auth={signOut:async options=>{calls.push(options);return {error:null}}};
 await signOutSessions(auth,SCOPE_ALL);
 assert.deepEqual(calls,[{scope:'global'}]);
});
test('revoke other devices leaves the active device session untouched',async()=>{
 const calls=[],auth={signOut:async options=>{calls.push(options);return {error:null}}};
 await signOutSessions(auth,SCOPE_OTHER_DEVICES);
 assert.deepEqual(calls,[{scope:'others'}]);
});
test('session scope cannot silently widen or be omitted',async()=>{
 let called=false;const auth={signOut:async()=>{called=true;return {error:null}}};
 await assert.rejects(signOutSessions(auth,'local'),/invalide/);
 await assert.rejects(signOutSessions(auth),/invalide/);
 assert.equal(called,false);
});
test('failed server-side sign-out is surfaced to the user',async()=>{
 const failed=Error('Supabase indisponible');
 await assert.rejects(signOutSessions({signOut:async()=>({error:failed})},SCOPE_OTHER_DEVICES),e=>e===failed);
});
