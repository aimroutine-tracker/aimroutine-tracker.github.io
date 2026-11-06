import test from 'node:test';
import assert from 'node:assert/strict';
import {hasGoogleIdentity,isGoogleDeleteVerified,readGoogleDeleteMarker,GOOGLE_DELETE_MARKER} from '../google-delete-v7.mjs';
const uid='11111111-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-06T06:40:00Z');
const google={id:uid,identities:[{provider:'google'}],last_sign_in_at:new Date(now-30_000).toISOString()};
test('recognizes Google identity even with linked auth methods',()=>{
 assert.equal(hasGoogleIdentity(google),true);
 assert.equal(hasGoogleIdentity({id:uid,app_metadata:{providers:['email','google']}}),true);
 assert.equal(hasGoogleIdentity({id:uid,identities:[{provider:'email'}]}),false);
 assert.equal(hasGoogleIdentity(null),false);
});
test('accepts a recent OAuth sign-in for the same user only',()=>{
 assert.equal(isGoogleDeleteVerified(google,{uid,startedAt:now-40_000},now),true);
 assert.equal(isGoogleDeleteVerified(google,{uid:'22222222-2222-4222-8222-222222222222',startedAt:now-40_000},now),false);
 assert.equal(isGoogleDeleteVerified(google,{uid,startedAt:now-350_000},now),false);
 assert.equal(isGoogleDeleteVerified(google,{uid,startedAt:now-5000},now),false);
 assert.equal(isGoogleDeleteVerified({...google,last_sign_in_at:new Date(now-400_000).toISOString()},{uid,startedAt:now-40_000},now),false);
});
test('safely parses local OAuth marker without accepting invalid input',()=>{
 assert.deepEqual(readGoogleDeleteMarker({getItem:k=>k===GOOGLE_DELETE_MARKER?JSON.stringify({uid,startedAt:now}):null}),{uid,startedAt:now});
 assert.equal(readGoogleDeleteMarker({getItem:()=>'{bad'}),null);
 assert.equal(readGoogleDeleteMarker({getItem:()=>null}),null);
});
